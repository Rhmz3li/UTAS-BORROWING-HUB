// Suppress punycode deprecation warning (DEP0040) before any imports
// This warning comes from nodemailer's dependencies and is safe to suppress
import 'ignore-punycode-warning';

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import UserModel from './models/User.js';

// Load environment variables
dotenv.config();
import ResourceModel from './models/Resource.js';
import BorrowModel from './models/Borrow.js';
import ReservationModel from './models/Reservation.js';
import NotificationModel from './models/Notification.js';
import PenaltyModel from './models/Penalty.js';
import PaymentModel from './models/Payment.js';
import FeedbackModel from './models/Feedback.js';
import AnnouncementModel from './models/Announcement.js';

let app = express();
app.use(cors());
app.use(express.json());

// Borrows that still hold a copy out until staff confirms return (inventory not restored)
const BORROW_OUT_STATUSES = ['Claimed', 'Active', 'Overdue', 'PendingReturn'];
const USER_BLOCKING_BORROW_STATUSES = ['PendingApproval', ...BORROW_OUT_STATUSES];
const USER_BLOCKING_RESERVATION_STATUSES = ['Pending', 'Confirmed'];
const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function getBorrowDurationDays(startDate, endDate, fallbackDays = 1) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const msPerDay = 1000 * 60 * 60 * 24;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return Math.max(1, fallbackDays || 1);
    }

    const diffDays = Math.ceil((end - start) / msPerDay);
    return Math.max(1, diffDays || fallbackDays || 1);
}

function passesLuhnCheck(cardNumber) {
    const digits = String(cardNumber || '').replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
        return false;
    }

    let sum = 0;
    let shouldDouble = false;

    for (let i = digits.length - 1; i >= 0; i -= 1) {
        let digit = parseInt(digits.charAt(i), 10);
        if (Number.isNaN(digit)) {
            return false;
        }

        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
}

function validateCardPayload(cardDetails) {
    const digitsOnly = String(cardDetails?.card_number || '').replace(/\D/g, '');
    const cardHolder = String(cardDetails?.card_holder || '').trim();
    const expiry = String(cardDetails?.expiry_date || '').trim();
    const cvv = String(cardDetails?.cvv || '').trim();

    if (!passesLuhnCheck(digitsOnly)) {
        return { valid: false, message: 'Invalid card number. Please enter a valid card number.' };
    }

    if (!/^[A-Za-z][A-Za-z\s.'-]{1,}$/.test(cardHolder)) {
        return { valid: false, message: 'Invalid card holder name. Please enter the name as shown on the card.' };
    }

    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
        return { valid: false, message: 'Invalid expiry date. Use MM/YY format.' };
    }

    const [mmStr, yyStr] = expiry.split('/');
    const month = parseInt(mmStr, 10);
    const year = parseInt(yyStr, 10);
    if (Number.isNaN(month) || Number.isNaN(year) || month < 1 || month > 12) {
        return { valid: false, message: 'Invalid expiry month. Please enter a valid expiry date.' };
    }

    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
        return { valid: false, message: 'Card expiry date cannot be in the past.' };
    }

    if (!/^\d{3,4}$/.test(cvv)) {
        return { valid: false, message: 'Invalid CVV. Please enter a valid 3 or 4 digit security code.' };
    }

    return {
        valid: true,
        normalized: {
            card_number: digitsOnly,
            card_holder: cardHolder,
            expiry_date: expiry,
            cvv
        }
    };
}

function getAbiFallbackReply(messageText = '') {
    const text = String(messageText || '').toLowerCase();

    const faqEntries = [
        {
            matches: ['borrow', 'استعارة', 'checkout', 'due date'],
            reply: 'To borrow a device, open Resources, choose an available item, click Borrow, select the due date, and submit the request. If the item requires a deposit and you choose Card, complete the payment in Payments first, then wait for admin approval.'
        },
        {
            matches: ['reservation', 'reserve', 'حجز', 'pickup date'],
            reply: 'To make a reservation, open Resources, choose the item, click Reserve, select the pickup date and expiry date, then submit the request. If a deposit is required and Card is selected, complete the payment from Payments before admin approval.'
        },
        {
            matches: ['payment', 'deposit', 'card', 'cash', 'دفع', 'عربون'],
            reply: 'You can review pending deposits in My Payments. Card payments can be completed online, while cash payments are recorded according to the request type. After a completed deposit, the admin is notified that the request is ready for review.'
        },
        {
            matches: ['return', 'pending return', 'إرجاع', 'lost', 'overdue'],
            reply: 'You can request a return from My Borrows when the borrow is active. After that, staff must confirm the physical return. If the item is overdue, damaged, or lost, the system may create a penalty.'
        },
        {
            matches: ['notification', 'notice', 'إشعار'],
            reply: 'You can check updates in Notifications. The system sends notices for request submission, payment completion, approvals, rejections, return handling, and refunds.'
        },
        {
            matches: ['profile', 'password', 'account', 'ملف', 'حساب'],
            reply: 'You can manage your personal details from Profile, and you can update your password and other account information there.'
        },
        {
            matches: ['qr', 'barcode', 'scan', 'مسح'],
            reply: 'QR and barcode scanning are used to identify resources quickly inside the system. If you are a regular user, focus on browsing, borrowing, reservations, payments, notifications, and profile features.'
        }
    ];

    const matchedFaq = faqEntries.find((entry) => entry.matches.some((keyword) => text.includes(keyword)));
    if (matchedFaq) {
        return matchedFaq.reply;
    }

    return 'I am Abi, your UTAS Borrowing Hub assistant. I can help only with this system: resources, borrowing, reservations, payments, returns, notifications, and profile actions. Please ask me about how to use one of these features.';
}

function isAbiSystemQuestion(messageText = '') {
    const text = String(messageText || '').toLowerCase().trim();
    if (!text) {
        return true;
    }

    const systemKeywords = [
        'utas', 'borrowing hub', 'system', 'resource', 'resources', 'device', 'item',
        'borrow', 'borrowing', 'checkout', 'reserve', 'reservation', 'pickup',
        'payment', 'payments', 'deposit', 'card', 'cash', 'refund',
        'return', 'overdue', 'penalty', 'fine',
        'notification', 'notifications', 'profile', 'account', 'password',
        'qr', 'barcode', 'approval', 'approve', 'reject',
        'استعارة', 'اعارة', 'حجز', 'دفع', 'بطاقة', 'كاش', 'عربون',
        'ارجاع', 'إرجاع', 'اشعار', 'إشعار', 'حساب', 'ملف', 'مورد', 'موارد',
        'جهاز', 'أجهزة', 'طلب', 'موافقة', 'رفض', 'غرامة'
    ];

    return systemKeywords.some((keyword) => text.includes(keyword));
}

async function getAbiReply({ message, user }) {
    if (!isAbiSystemQuestion(message)) {
        return 'I can only help with the UTAS Borrowing Hub system. Please ask me about resources, borrowing, reservations, payments, returns, notifications, or your profile.';
    }

    if (!openaiClient) {
        return getAbiFallbackReply(message);
    }

    const systemPrompt = `
You are Abi, the UTAS Borrowing Hub assistant.
Only answer questions about using this system.
Allowed topics:
- browsing and searching resources
- borrowing devices
- reservations
- payments and deposits
- notifications
- returns, overdue items, and penalties
- profile and account actions

Rules:
- If the user asks about anything outside this system, politely refuse and redirect them to system-related help.
- Do not invent policies or features not present in the system.
- Keep answers concise, practical, and user-focused.
- When useful, give 2-4 short steps.
`;

    try {
        const completion = await openaiClient.responses.create({
            model: 'gpt-4o-mini',
            input: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `User role: ${user?.role || 'Student'}\nUser department: ${user?.department || 'Unknown'}\nQuestion: ${message}`
                }
            ],
            max_output_tokens: 220
        });

        const text = completion.output_text?.trim();
        return text || getAbiFallbackReply(message);
    } catch (error) {
        console.error('Abi assistant fallback due to AI error:', error.message);
        return getAbiFallbackReply(message);
    }
}

async function getUserSameResourceBlocker(userId, resourceId) {
    const existingBorrow = await BorrowModel.findOne({
        user_id: userId,
        resource_id: resourceId,
        status: { $in: USER_BLOCKING_BORROW_STATUSES }
    }).select('_id status');
    if (existingBorrow) {
        return {
            type: 'Borrow',
            status: existingBorrow.status
        };
    }

    const existingReservation = await ReservationModel.findOne({
        user_id: userId,
        resource_id: resourceId,
        status: { $in: USER_BLOCKING_RESERVATION_STATUSES }
    }).select('_id status');
    if (existingReservation) {
        return {
            type: 'Reservation',
            status: existingReservation.status
        };
    }

    return null;
}

/**
 * When a borrow/reservation is rejected, cancelled, or deleted: mark Completed deposits as Refunded
 * (staff returns money per procedure), or mark Pending payment requests as Failed (no longer payable).
 */
async function releaseLinkedDepositPayment(paymentId, processedByUserId, reasonTag) {
    if (!paymentId) return { action: 'none' };
    const payment = await PaymentModel.findById(paymentId);
    if (!payment) return { action: 'none' };
    if (!['Resource', 'Reservation'].includes(payment.payment_type)) return { action: 'skip_type' };
    if (payment.status === 'Refunded' || payment.status === 'Failed') return { action: 'already_final' };

    const tag = ` | Auto: ${reasonTag}`;
    const uid = payment.user_id;
    const prefKey = payment.payment_type === 'Reservation' ? 'reservationConfirmation' : 'borrowApproval';

    if (payment.status === 'Completed') {
        payment.status = 'Refunded';
        payment.processed_by = processedByUserId || null;
        payment.updated_at = Date.now();
        payment.notes = ((payment.notes || '') + tag).trim();
        await payment.save();
        if (uid && (await shouldSendInAppNotification(uid, prefKey))) {
            await NotificationModel.create({
                user_id: uid,
                title: 'Security deposit refunded (record)',
                message: `Your deposit of ${payment.amount} OMR has been marked as refunded in the system (${reasonTag}). If you already paid at the hub, staff will return it according to UTAS procedures.`,
                type: 'Success',
                related_type: 'Payment',
                related_id: payment._id
            });
        }
        return { action: 'refunded', payment };
    }

    if (payment.status === 'Pending') {
        payment.status = 'Failed';
        payment.processed_by = processedByUserId || null;
        payment.updated_at = Date.now();
        payment.notes = ((payment.notes || '') + tag).trim();
        await payment.save();
        if (uid && (await shouldSendInAppNotification(uid, prefKey))) {
            await NotificationModel.create({
                user_id: uid,
                title: 'Payment request cancelled',
                message: `The pending payment of ${payment.amount} OMR for your ${payment.payment_type === 'Reservation' ? 'reservation' : 'borrow request'} was cancelled (${reasonTag}).`,
                type: 'Info',
                related_type: 'Payment',
                related_id: payment._id
            });
        }
        return { action: 'cancelled_pending', payment };
    }

    return { action: 'unchanged', payment };
}

// Rate limiting for password reset requests
const resetRequestAttempts = new Map(); // email -> { count, lastAttempt }
const RESET_REQUEST_LIMIT = 5; // Max 5 requests per hour
const RESET_REQUEST_WINDOW = 3600000; // 1 hour in milliseconds

// Helper function to check rate limit
const checkRateLimit = (email) => {
    const normalizedEmail = email.toLowerCase().trim();
    const now = Date.now();
    const attempts = resetRequestAttempts.get(normalizedEmail);
    
    if (!attempts) {
        resetRequestAttempts.set(normalizedEmail, { count: 1, lastAttempt: now });
        return { allowed: true };
    }
    
    // Reset if window has passed
    if (now - attempts.lastAttempt > RESET_REQUEST_WINDOW) {
        resetRequestAttempts.set(normalizedEmail, { count: 1, lastAttempt: now });
        return { allowed: true };
    }
    
    // Check if limit exceeded
    if (attempts.count >= RESET_REQUEST_LIMIT) {
        const timeRemaining = Math.ceil((RESET_REQUEST_WINDOW - (now - attempts.lastAttempt)) / 60000);
        return { 
            allowed: false, 
            message: `Too many reset requests. Please try again in ${timeRemaining} minute(s).` 
        };
    }
    
    // Increment count
    attempts.count++;
    attempts.lastAttempt = now;
    resetRequestAttempts.set(normalizedEmail, attempts);
    return { allowed: true };
};

// Password strength validation
const validatePasswordStrength = (password) => {
    const errors = [];
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 128) {
        errors.push('Password must be less than 128 characters');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    
    // Check for common weak passwords
    const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
        errors.push('Password is too common. Please choose a stronger password');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

// Logging function for password reset events
const logPasswordResetEvent = (event, details) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        event,
        ...details
    };
    console.log(`[PASSWORD_RESET_LOG] ${JSON.stringify(logEntry)}`);
};

const mongoSrvUri = process.env.MONGO_URI || 'mongodb+srv://admin123:admin123@utas-borrowing-hub.qlzohvg.mongodb.net/UTAS-BORROWING-HUB?retryWrites=true&w=majority&appName=UTAS-BORROWING-HUB';
const mongoDirectUri = process.env.MONGO_DIRECT_URI || 'mongodb://admin123:admin123@ac-gbqaucr-shard-00-00.qlzohvg.mongodb.net:27017,ac-gbqaucr-shard-00-01.qlzohvg.mongodb.net:27017,ac-gbqaucr-shard-00-02.qlzohvg.mongodb.net:27017/UTAS-BORROWING-HUB?ssl=true&replicaSet=atlas-uccjid-shard-0&authSource=admin&retryWrites=true&w=majority&appName=UTAS-BORROWING-HUB';
// Use a shorter server selection timeout so the app can fall back quickly
// to the direct Atlas URI when SRV DNS lookups fail on this network.
const mongoConnectionOptions = {
    serverSelectionTimeoutMS: 10000
};

async function connectToMongoDB() {
    if (!mongoSrvUri && !mongoDirectUri) {
        throw new Error('MongoDB connection string is not configured. Set MONGO_URI or MONGO_DIRECT_URI in server/.env');
    }

    if (mongoSrvUri) {
        try {
            await mongoose.connect(mongoSrvUri, mongoConnectionOptions);
            console.log('Connected to MongoDB successfully');
            return;
        } catch (error) {
            console.error('MongoDB SRV connection failed:', error.message || error);
        }
    }

    if (mongoDirectUri) {
        await mongoose.connect(mongoDirectUri, mongoConnectionOptions);
        console.log('Connected to MongoDB successfully');
        return;
    }

    throw new Error('MongoDB connection failed and no direct fallback URI is configured');
}

// ==================== AUTH ROUTES ====================

app.post("/register", async (req, res) => {
    try {
        const user = await UserModel.findOne({ email: req.body.email });
        if (user)
            res.status(500).json({ message: "User already exists" });
        else {
            const hpass = await bcrypt.hash(req.body.password, 10);
            const newuser = new UserModel({
                email: req.body.email,
                password: hpass,
                full_name: req.body.full_name,
                role: req.body.role || 'Student',
                student_id: req.body.student_id,
                employee_id: req.body.employee_id,
                identification_id: req.body.identification_id || req.body.student_id || req.body.employee_id,
                phone: req.body.phone,
                department: req.body.department
            });
            await newuser.save();
            const token = jwt.sign({ id: newuser._id }, 'your-secret-key-change-in-production', {
                expiresIn: '30d'
            });
            // Try to send welcome email if email transport is configured
            if (transporter) {
                try {
                    const appName = 'UTAS Borrowing Hub';
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: newuser.email,
                        subject: `Welcome to ${appName}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                                <h2 style="color: #333;">Welcome to ${appName}</h2>
                                <p>Dear ${newuser.full_name || 'User'},</p>
                                <p>Your account has been created successfully. You can now log in and start borrowing and reserving resources.</p>
                                <ul>
                                    <li><strong>Email:</strong> ${newuser.email}</li>
                                    <li><strong>Role:</strong> ${newuser.role}</li>
                                </ul>
                                <p style="margin-top: 16px;">Thank you,<br/>${appName} Team</p>
                            </div>
                        `
                    };
                    await transporter.sendMail(mailOptions);
                    console.log('Welcome email sent to:', newuser.email);
                } catch (emailError) {
                    console.error('Failed to send welcome email after registration:', emailError);
                    // لا نفشل الطلب إذا فشل الإيميل
                }
            } else {
                console.warn('Email transporter not configured; skipping welcome email.');
            }
            res.status(200).json({ message: "User Registered..", token: token, user: newuser });
        }
    }
    catch (error) {
        res.send(error);
    }
});

app.post("/login", async (req, res) => {
    try {
        const email = req.body.email ? req.body.email.toLowerCase().trim() : '';
        const password = req.body.password;
        
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await UserModel.findOne({ email: email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const pass_valid = await bcrypt.compare(password, user.password);
        if (pass_valid) {
            const token = jwt.sign({ id: user._id }, 'your-secret-key-change-in-production', {
                expiresIn: '30d'
            });
            // Convert to object and remove password
            const userObj = user.toObject();
            delete userObj.password;
            delete userObj.previousPasswords;
            res.status(200).json({ user: userObj, token: token, message: "success" });
        } else {
            res.status(401).json({ message: "Invalid email or password" });
        }
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Configure nodemailer (supports Gmail, Outlook/Hotmail, etc. via EMAIL_SERVICE)
let transporter;
console.log('=== Email Configuration Check ===');
console.log('EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET (' + (process.env.EMAIL_PASS.length || 0) + ' chars)' : 'NOT SET');

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    if (process.env.EMAIL_USER === 'your-email@gmail.com' || 
        process.env.EMAIL_PASS === 'your-app-password' ||
        process.env.EMAIL_PASS === 'your-app-password-here') {
        console.warn('⚠️  Email configuration detected but using default values!');
        console.warn('⚠️  Please update .env file with your actual email credentials');
    } else {
        try {
            // Remove quotes and trim whitespace from password
            const emailUser = process.env.EMAIL_USER.trim();
            let emailPass = process.env.EMAIL_PASS.trim();
            // Remove quotes if present
            if ((emailPass.startsWith('"') && emailPass.endsWith('"')) || 
                (emailPass.startsWith("'") && emailPass.endsWith("'"))) {
                emailPass = emailPass.slice(1, -1).trim();
            }

            // Allow overriding service via EMAIL_SERVICE (e.g. 'gmail', 'outlook', 'hotmail')
            const emailService = (process.env.EMAIL_SERVICE || 'gmail').toLowerCase();
            console.log('Email service:', emailService);

            transporter = nodemailer.createTransport({
                service: emailService,
                auth: {
                    user: emailUser,
                    pass: emailPass
                }
            });
            console.log('✓ Email transporter configured successfully');
            console.log('✓ Email user:', emailUser);
            console.log('✓ Email pass length:', emailPass.length, 'characters');
        } catch (error) {
            console.error('✗ Error configuring email transporter:', error);
        }
    }
} else {
    console.warn('⚠️  Email configuration not found!');
    console.warn('⚠️  Please create a .env file in the server directory');
}

// Helper: send a notification email (silently skips if transporter not configured)
const sendEmail = async ({ to, subject, html }) => {
    if (!transporter) return;
    try {
        await transporter.sendMail({
            from: `"UTAS Borrowing Hub" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
    } catch (err) {
        console.error('Email send error:', err.message);
    }
};

const emailStyle = `
  font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;
  background: #f9f9f9; border-radius: 10px; overflow: hidden;
`;
const emailHeader = `
  <div style="background: linear-gradient(135deg,#1565c0,#0d47a1); padding:24px; text-align:center;">
    <h2 style="color:#fff; margin:0;">UTAS Borrowing Hub</h2>
  </div>
`;
const emailFooter = `
  <div style="padding:16px; text-align:center; color:#999; font-size:12px;">
    © ${new Date().getFullYear()} UTAS Borrowing Hub. All rights reserved.
  </div>
`;

// Forgot Password - Send reset link
app.post("/forgot-password", async (req, res) => {
    // user reference used in catch block as well
    let user;
    try {
        const { email } = req.body;

        // Input validation and sanitization
        if (!email) {
            return res.status(400).json({ 
                success: false,
                message: 'Email is required' 
            });
        }

        // Sanitize email input
        const sanitizedEmail = email.toLowerCase().trim();
        
        // Validate email format and domain - must be @utas.edu.om
        const emailRegex = /^[^\s@]+@utas\.edu\.om$/;
        if (!emailRegex.test(sanitizedEmail)) {
            return res.status(400).json({ 
                success: false,
                message: 'Email must be a valid UTAS email address (@utas.edu.om)' 
            });
        }

        // Check rate limit
        const rateLimitCheck = checkRateLimit(sanitizedEmail);
        if (!rateLimitCheck.allowed) {
            logPasswordResetEvent('RATE_LIMIT_EXCEEDED', { 
                email: sanitizedEmail.substring(0, 5) + '***',
                ip: req.ip || req.connection.remoteAddress 
            });
            return res.status(429).json({ 
                success: false,
                message: rateLimitCheck.message 
            });
        }

        // Find user by email only
        user = await UserModel.findOne({ email: sanitizedEmail });
        
        // Log the request attempt
        logPasswordResetEvent('RESET_REQUEST', { 
            email: sanitizedEmail.substring(0, 5) + '***',
            userExists: !!user,
            ip: req.ip || req.connection.remoteAddress 
        });

        if (!user) {
            // Return error message for non-existent email
            return res.status(404).json({ 
                success: false,
                message: 'Email address not found. Please check your email and try again.'
            });
        }

        // Generate cryptographically secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + (15 * 60 * 1000); // 15 minutes

        // Save token to user
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(resetTokenExpiry);
        await user.save();

        // Create reset URL
        const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;

        // Check if email transporter is configured
        if (!transporter) {
            console.error('Email transporter is not configured');
            console.error('EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
            console.error('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET (' + (process.env.EMAIL_PASS.length || 0) + ' chars)' : 'NOT SET');
            return res.status(500).json({ 
                success: false,
                message: 'Email service is not configured. Please contact administrator.'
            });
        }

        // Send email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset Request - UTAS Borrowing Hub',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #1976d2 0%, #ff9800 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0;">UTAS Borrowing Hub</h1>
                    </div>
                    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                        <h2 style="color: #1976d2; margin-top: 0;">Password Reset Request</h2>
                        <p>Hello <strong>${user.full_name}</strong>,</p>
                        <p>You have requested to reset your password for your UTAS Borrowing Hub account.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #1976d2 0%, #ff9800 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                                Reset Password
                            </a>
                        </div>
                        <p style="color: #666666; font-size: 14px;">Or copy and paste this link into your browser:</p>
                        <p style="color: #1976d2; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">${resetUrl}</p>
                        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                        <p style="color: #999999; font-size: 12px; margin: 0;">
                            <strong>Important:</strong> This link will expire in 15 minutes and can only be used once. If you didn't request this password reset, please ignore this email and your password will remain unchanged.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #999999; font-size: 12px;">
                        <p>© ${new Date().getFullYear()} UTAS Borrowing Hub. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Password reset email sent successfully:', info.messageId);
            console.log('Email sent to:', user.email);
            
            logPasswordResetEvent('EMAIL_SENT', { 
                email: sanitizedEmail.substring(0, 5) + '***',
                messageId: info.messageId
            });
        } catch (emailError) {
            console.error('Error sending email:', emailError);
            console.error('Error details:', emailError.message);
            console.error('Error code:', emailError.code);
            
            // Clear the token if email fails
            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;
            await user.save();
            
            logPasswordResetEvent('EMAIL_SEND_FAILED', { 
                email: sanitizedEmail.substring(0, 5) + '***',
                error: emailError.message,
                errorCode: emailError.code
            });
            
            // Provide more specific error messages
            let errorMessage = 'Failed to send reset email. Please try again later.';
            if (emailError.code === 'EAUTH' || emailError.code === 'EENVELOPE') {
                errorMessage = 'Email authentication failed. Please contact administrator.';
            } else if (emailError.code === 'ECONNECTION' || emailError.code === 'ETIMEDOUT') {
                errorMessage = 'Could not connect to email server. Please try again later.';
            } else if (emailError.message && (emailError.message.includes('Invalid login') || emailError.message.includes('authentication'))) {
                errorMessage = 'Email service configuration error. Please contact administrator.';
            }
            
            return res.status(500).json({ 
                success: false,
                message: errorMessage
            });
        }

        res.status(200).json({ 
            success: true,
            message: 'Password reset link has been sent to your email.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        console.error('Error stack:', error.stack);
        
        // Clear token if it was created
        if (user && user.resetPasswordToken) {
            try {
                user.resetPasswordToken = null;
                user.resetPasswordExpires = null;
                await user.save();
            } catch (saveError) {
                console.error('Error clearing token:', saveError);
            }
        }
        
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to send reset email. Please try again later.'
        });
    }
});

// Verify reset token endpoint
app.get("/verify-reset-token", async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ 
                success: false,
                message: 'Token is required' 
            });
        }

        // Sanitize token input
        const sanitizedToken = token.trim();

        const user = await UserModel.findOne({
            resetPasswordToken: sanitizedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            logPasswordResetEvent('TOKEN_VERIFICATION_FAILED', { 
                token: sanitizedToken.substring(0, 10) + '...',
                ip: req.ip || req.connection.remoteAddress 
            });
            return res.status(400).json({ 
                success: false,
                message: 'Invalid or expired reset token' 
            });
        }

        res.status(200).json({ 
            success: true,
            message: 'Token is valid' 
        });
    } catch (error) {
        console.error('Verify token error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to verify token' 
        });
    }
});

// Reset Password - Update password with token
app.post("/reset-password", async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;

        // Input validation
        if (!token || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Token and password are required' 
            });
        }

        if (!confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: 'Please confirm your password' 
            });
        }

        // Check passwords match
        if (password !== confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: 'Passwords do not match' 
            });
        }

        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ 
                success: false,
                message: passwordValidation.errors.join('. ') 
            });
        }

        // Sanitize token input
        const sanitizedToken = token.trim();

        // Find user with valid token
        const user = await UserModel.findOne({
            resetPasswordToken: sanitizedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            logPasswordResetEvent('RESET_ATTEMPT_INVALID_TOKEN', { 
                token: sanitizedToken.substring(0, 10) + '...',
                ip: req.ip || req.connection.remoteAddress 
            });
            return res.status(400).json({ 
                success: false,
                message: 'Invalid or expired reset token. Please request a new password reset link.' 
            });
        }

        // Check if password is same as current password
        const isSamePassword = await bcrypt.compare(password, user.password);
        if (isSamePassword) {
            return res.status(400).json({ 
                success: false,
                message: 'New password must be different from your current password' 
            });
        }

        // Check if password was used before (check previous passwords)
        if (user.previousPasswords && user.previousPasswords.length > 0) {
            for (const prevPassword of user.previousPasswords) {
                const isPreviousPassword = await bcrypt.compare(password, prevPassword.hashedPassword);
                if (isPreviousPassword) {
                    return res.status(400).json({ 
                        success: false,
                        message: 'You cannot use a password that you have used before. Please choose a new password.' 
                    });
                }
            }
        }

        // Hash new password with higher salt rounds for better security
        const hashedPassword = await bcrypt.hash(password, 12);

        // Save current password to previous passwords (keep last 5 passwords)
        const previousPasswords = user.previousPasswords || [];
        previousPasswords.push({
            hashedPassword: user.password,
            changedAt: new Date()
        });
        
        // Keep only last 5 previous passwords
        if (previousPasswords.length > 5) {
            previousPasswords.shift(); // Remove oldest password
        }

        // Update password and clear reset token (mark as used - single use)
        user.password = hashedPassword;
        user.previousPasswords = previousPasswords;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        // Log successful reset
        logPasswordResetEvent('RESET_SUCCESS', { 
            email: user.email,
            userId: user._id,
            ip: req.ip || req.connection.remoteAddress 
        });

        // Send confirmation email
        if (transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: 'Password Changed Successfully - UTAS Borrowing Hub',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #1976d2 0%, #ff9800 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0;">UTAS Borrowing Hub</h1>
                            </div>
                            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                                <h2 style="color: #4caf50; margin-top: 0;">Password Changed Successfully</h2>
                                <p>Hello <strong>${user.full_name}</strong>,</p>
                                <p>Your password has been successfully changed at ${new Date().toLocaleString()}.</p>
                                <p>If you did not make this change, please contact our support team immediately.</p>
                                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                                <p style="color: #999999; font-size: 12px; margin: 0;">
                                    <strong>Security Tip:</strong> For your account security, never share your password with anyone.
                                </p>
                            </div>
                            <div style="text-align: center; margin-top: 20px; color: #999999; font-size: 12px;">
                                <p>© ${new Date().getFullYear()} UTAS Borrowing Hub. All rights reserved.</p>
                            </div>
                        </div>
                    `
                };
                await transporter.sendMail(mailOptions);
            } catch (emailError) {
                console.error('Failed to send password change notification email:', emailError);
                // Don't fail the request if email fails
            }
        }

        res.status(200).json({ 
            success: true,
            message: 'Password has been reset successfully. You can now log in with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        logPasswordResetEvent('RESET_ERROR', { 
            error: error.message,
            ip: req.ip || req.connection.remoteAddress 
        });
        res.status(500).json({ 
            success: false,
            message: 'Failed to reset password. Please try again.'
        });
    }
});

app.get("/profile", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.send({ success: true, user });
    } catch (error) {
        res.send(error);
    }
});

// ==================== RESOURCES ROUTES ====================

// GET /resources endpoint - Returns resources with pagination (expected format for AdminResources)
app.get("/resources", async (req, res) => {
    try {
        const { status, category, search, college, page = 1, limit = 10 } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (category) query.category = category;
        if (college) query.college = college;
        
        // Everyone can list all resources; borrow/reserve restrictions are enforced on POST routes.
        
        // Add search filter - combine with department filter if exists
        if (search) {
            const searchQuery = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            };
            
            if (query.$or) {
                // Combine search with department filter using $and
                const departmentFilter = { $or: query.$or };
                delete query.$or;
                query.$and = [
                    departmentFilter,
                    searchQuery
                ];
            } else {
                query.$or = searchQuery.$or;
            }
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const skip = (pageNum - 1) * limitNum;

        const resources = await ResourceModel.find(query)
            .limit(limitNum)
            .skip(skip)
            .sort({ created_at: -1 });

        const total = await ResourceModel.countDocuments(query);
        const pages = Math.ceil(total / limitNum);

        res.json({
            success: true,
            data: resources,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: total,
                pages: pages
            }
        });
    } catch (error) {
        console.error('Get resources error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to fetch resources' 
        });
    }
});

app.get("/showDevices", async (req, res) => {
    try {
        const { status, category, search, page = 1, limit = 10000 } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (category) query.category = category;
        
        // Add search filter - combine with department filter if exists
        if (search) {
            const searchQuery = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            };
            
            if (query.$or) {
                // Combine search with department filter using $and
                const departmentFilter = { $or: query.$or };
                delete query.$or;
                query.$and = [
                    departmentFilter,
                    searchQuery
                ];
            } else {
                query.$or = searchQuery.$or;
            }
        }

        const resources = await ResourceModel.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ created_at: -1 });

        const total = await ResourceModel.countDocuments(query);

        res.send(resources);
    } catch (error) {
        res.send(error);
    }
});

app.get("/showDevice/:id", async (req, res) => {
    try {
        const device = await ResourceModel.findById(req.params.id);
        res.send(device);
    } catch (error) {
        res.send(error);
    }
});

// Check resource availability for a specific date
app.post("/resources/:id/check-availability", async (req, res) => {
    try {
        const { borrow_date } = req.body;
        const resource = await ResourceModel.findById(req.params.id);
        
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        const requestedDate = new Date(borrow_date);
        const maxBorrowDays = resource.max_borrow_days || 7;
        const dueDate = new Date(requestedDate);
        dueDate.setDate(dueDate.getDate() + maxBorrowDays);

        // Check active borrows that overlap with requested period
        const overlappingBorrows = await BorrowModel.find({
            resource_id: req.params.id,
            status: { $in: BORROW_OUT_STATUSES },
            $or: [
                {
                    borrow_date: { $lte: dueDate },
                    due_date: { $gte: requestedDate }
                }
            ]
        });

        const availableQuantity = resource.available_quantity - overlappingBorrows.length;

        if (availableQuantity > 0) {
            return res.json({
                success: true,
                data: {
                    available: true,
                    message: 'Resource is available on this date',
                    returnDate: dueDate.toISOString()
                }
            });
        } else {
            // Find the earliest return date
            const earliestReturn = await BorrowModel.findOne({
                resource_id: req.params.id,
                status: { $in: BORROW_OUT_STATUSES }
            }).sort({ due_date: 1 });

            return res.json({
                success: true,
                data: {
                    available: false,
                    message: 'Resource is not available on this date. All copies are currently borrowed.',
                    returnDate: earliestReturn ? earliestReturn.due_date : null
                }
            });
        }
    } catch (error) {
        console.error('Availability check error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get resource availability calendar
app.get("/resources/:id/availability", async (req, res) => {
    try {
        const resource = await ResourceModel.findById(req.params.id);
        
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        // Get all borrows that still occupy the resource
        const activeBorrows = await BorrowModel.find({
            resource_id: req.params.id,
            status: { $in: BORROW_OUT_STATUSES }
        }).sort({ due_date: 1 });

        const borrowedDates = activeBorrows.map(borrow => ({
            start: borrow.borrow_date,
            end: borrow.due_date
        }));

        // Generate suggested dates (next 60 days, excluding borrowed periods)
        const suggestedDates = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maxBorrowDays = resource.max_borrow_days || 7;

        // Get all active borrows and reservations
        const activeReservations = await ReservationModel.find({
            resource_id: resource._id,
            status: { $in: ['Pending', 'Confirmed'] }
        });

        for (let i = 1; i <= 60; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() + i);
            checkDate.setHours(0, 0, 0, 0);
            
            // Check if date is within any active borrow period
            const isBorrowed = activeBorrows.some(borrow => {
                const borrowStart = new Date(borrow.borrow_date);
                borrowStart.setHours(0, 0, 0, 0);
                const borrowEnd = new Date(borrow.due_date);
                borrowEnd.setHours(0, 0, 0, 0);
                return checkDate >= borrowStart && checkDate <= borrowEnd;
            });

            // Check if date conflicts with confirmed reservations
            const hasReservation = activeReservations.some(res => {
                if (res.status === 'Confirmed') {
                    const pickupDate = new Date(res.pickup_date);
                    pickupDate.setHours(0, 0, 0, 0);
                    const expiryDate = new Date(res.expiry_date);
                    expiryDate.setHours(0, 0, 0, 0);
                    return checkDate >= pickupDate && checkDate <= expiryDate;
                }
                return false;
            });

            // Check available quantity
            const borrowsOnDate = activeBorrows.filter(borrow => {
                const borrowStart = new Date(borrow.borrow_date);
                borrowStart.setHours(0, 0, 0, 0);
                const borrowEnd = new Date(borrow.due_date);
                borrowEnd.setHours(0, 0, 0, 0);
                return checkDate >= borrowStart && checkDate <= borrowEnd;
            }).length;

            const reservationsOnDate = activeReservations.filter(res => {
                if (res.status === 'Confirmed') {
                    const pickupDate = new Date(res.pickup_date);
                    pickupDate.setHours(0, 0, 0, 0);
                    const expiryDate = new Date(res.expiry_date);
                    expiryDate.setHours(0, 0, 0, 0);
                    return checkDate >= pickupDate && checkDate <= expiryDate;
                }
                return false;
            }).length;

            const totalUsed = borrowsOnDate + reservationsOnDate;
            const isAvailable = totalUsed < resource.available_quantity && !isBorrowed && !hasReservation;

            if (isAvailable && suggestedDates.length < 10) {
                suggestedDates.push(checkDate.toISOString().split('T')[0]);
            }
        }

        res.json({
            success: true,
            data: {
                borrowedDates,
                suggestedDates,
                availableQuantity: resource.available_quantity
            }
        });
    } catch (error) {
        console.error('Availability calendar error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create new resource (Admin/Assistant only)
app.post("/resources", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!user || !['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ success: false, message: 'Not authorized. Admin or Assistant role required.' });
        }

        // Validate required fields
        if (!req.body.name || !req.body.category) {
            return res.status(400).json({ success: false, message: 'Resource name and category are required' });
        }

        // Set available_quantity to total_quantity if not provided or if available_quantity > total_quantity
        const totalQuantity = req.body.total_quantity || 1;
        let availableQuantity = req.body.available_quantity;
        if (availableQuantity === undefined || availableQuantity === null) {
            availableQuantity = totalQuantity;
        }
        if (availableQuantity > totalQuantity) {
            availableQuantity = totalQuantity;
        }

        // Convert empty strings to null for barcode and qr_code to work with sparse unique index
        // Sparse indexes only ignore null/undefined, not empty strings
        // Multiple null values are allowed with sparse unique index
        const barcode = req.body.barcode && req.body.barcode.trim() !== '' ? req.body.barcode.trim() : null;
        const qr_code = req.body.qr_code && req.body.qr_code.trim() !== '' ? req.body.qr_code.trim() : null;

        // Check for duplicate barcode only if a non-empty value is provided
        // null values are allowed multiple times with sparse unique index
        if (barcode) {
            const existingBarcode = await ResourceModel.findOne({ barcode: barcode });
            if (existingBarcode) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Barcode "${barcode}" already exists. Please use a different barcode.` 
                });
            }
        }

        // Check for duplicate QR code only if a non-empty value is provided
        // null values are allowed multiple times with sparse unique index
        if (qr_code) {
            const existingQRCode = await ResourceModel.findOne({ qr_code: qr_code });
            if (existingQRCode) {
                return res.status(400).json({ 
                    success: false, 
                    message: `QR Code "${qr_code}" already exists. Please use a different QR code.` 
                });
            }
        }

        // If there are existing records with empty-string barcode/qr_code, normalize them to null to avoid false duplicate errors
        // This fixes the issue where empty strings cause duplicate key errors with sparse unique indexes
        const fixEmptyStringField = async (fieldName) => {
            const existingEmpty = await ResourceModel.find({ [fieldName]: '' });
            if (existingEmpty && existingEmpty.length > 0) {
                // Update all resources with empty string to null
                await ResourceModel.updateMany(
                    { [fieldName]: '' },
                    { $set: { [fieldName]: null } }
                );
                console.log(`Fixed ${existingEmpty.length} resources with empty string in ${fieldName}`);
            }
        };
        await fixEmptyStringField('barcode');
        await fixEmptyStringField('qr_code');

        // Build resource payload without barcode/qr_code when empty to avoid index conflicts on null/empty
        const resourcePayload = {
            name: req.body.name,
            description: req.body.description,
            category: req.body.category,
            college: req.body.college || 'General',
            department: req.body.department || null,
            status: req.body.status || 'Available',
            location: req.body.location || null,
            condition: req.body.condition || 'Good',
            max_borrow_days: req.body.max_borrow_days || 7,
            total_quantity: totalQuantity,
            available_quantity: availableQuantity,
            requires_payment: req.body.requires_payment || false,
            payment_amount: req.body.payment_amount || 0,
            replacement_cost: req.body.replacement_cost || 100, // Default replacement cost for loss penalty
            image: req.body.image || null,
            images: req.body.images || [],
            created_by: user._id // Set from authenticated user
        };
        if (barcode) resourcePayload.barcode = barcode;
        if (qr_code) resourcePayload.qr_code = qr_code;

        // Create resource object but don't save yet - we'll save in try-catch
        const new_resource = new ResourceModel(resourcePayload);
        
        await new_resource.save();
        res.status(201).json({ success: true, message: "Resource created successfully", data: new_resource });
    } catch (error) {
        console.error('Create resource error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            errors: error.errors
        });
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message).join(', ');
            return res.status(400).json({ success: false, message: `Validation error: ${messages}` });
        }
        
        // Handle enum validation errors specifically
        if (error.message && error.message.includes('is not a valid enum value')) {
            const field = error.message.match(/`(\w+)`/)?.[1] || 'field';
            const value = req.body[field];
            return res.status(400).json({ 
                success: false, 
                message: `Invalid ${field} value: "${value}". Please select a valid ${field}.` 
            });
        }
        
        // Handle duplicate key errors (barcode, qr_code)
        // This should rarely happen now due to pre-check, but handle it as a fallback
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            const fieldValue = req.body[field];
            // Provide a more user-friendly error message
            const fieldName = field === 'barcode' ? 'Barcode' : field === 'qr_code' ? 'QR Code' : field;
            
            // If field is empty/null, sparse index should allow multiple nulls
            // If we get here with empty field, there might be an existing resource with empty string instead of null
            if (!fieldValue || fieldValue.trim() === '') {
                // Check if there's a resource with empty string (not null) for this field
                const existingResource = await ResourceModel.findOne({ 
                    [field]: '' 
                });
                
                if (existingResource) {
                    // Fix the existing resource by setting empty string to null
                    existingResource[field] = null;
                    await existingResource.save();
                    
                    // Retry creating the new resource
                    try {
                        await new_resource.save();
                        return res.status(201).json({ success: true, message: "Resource created successfully", data: new_resource });
                    } catch (retryError) {
                        // If retry still fails, check if it's the same error
                        if (retryError.code === 11000) {
                            console.error(`Still getting duplicate key error after fix for ${field}`, retryError);
                            return res.status(400).json({ 
                                success: false, 
                                message: `${fieldName} value is duplicated. Please provide a different value or clear the field.` 
                            });
                        }
                        // Different error, re-throw
                        throw retryError;
                    }
                }
                
                // If no resource with empty string found, this is unexpected
                // Sparse index should allow multiple nulls
                console.warn(`Unexpected duplicate key error for empty ${field}. Sparse index should allow multiple nulls.`);
                return res.status(500).json({ 
                    success: false, 
                    message: `${fieldName} appears duplicated. Please clear the field or provide a unique value.` 
                });
            } else {
                // Field has a value, so it's a real duplicate
                return res.status(400).json({ 
                    success: false, 
                    message: `${fieldName} "${fieldValue}" already exists. Please use a different ${fieldName}.` 
                });
            }
        }
        
        // Generic error handler - provide more details in development
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? `Failed to create resource: ${error.message || 'Unknown error'}`
            : error.message || 'Failed to create resource. Please check all fields and try again.';
        
        res.status(500).json({ success: false, message: errorMessage });
    }
});

// Update resource (Admin/Assistant only)
app.put("/resources/:id", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!user || !['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ success: false, message: 'Not authorized. Admin or Assistant role required.' });
        }

        const resource = await ResourceModel.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        // Normalize any existing empty-string barcode/qr_code to null before duplicate checks
        const fixEmptyStringField = async (fieldName) => {
            const existingEmpty = await ResourceModel.find({ [fieldName]: '' });
            if (existingEmpty && existingEmpty.length > 0) {
                await ResourceModel.updateMany(
                    { [fieldName]: '' },
                    { $set: { [fieldName]: null } }
                );
                console.log(`Fixed ${existingEmpty.length} resources with empty string in ${fieldName} before update`);
            }
        };
        await fixEmptyStringField('barcode');
        await fixEmptyStringField('qr_code');

        // Validate total_quantity and available_quantity
        if (req.body.total_quantity !== undefined) {
            const totalQuantity = req.body.total_quantity;
            if (totalQuantity < 1) {
                return res.status(400).json({ success: false, message: 'Total quantity must be at least 1' });
            }
            
            // If available_quantity is not provided, adjust it to not exceed total_quantity
            if (req.body.available_quantity === undefined) {
                req.body.available_quantity = Math.min(resource.available_quantity, totalQuantity);
            } else if (req.body.available_quantity > totalQuantity) {
                req.body.available_quantity = totalQuantity;
            }
        }

        // Convert empty strings to null for barcode and qr_code to work with sparse unique index
        // Sparse indexes only ignore null/undefined, not empty strings
        let barcode = null;
        let qr_code = null;
        
        if (req.body.barcode !== undefined) {
            barcode = req.body.barcode && req.body.barcode.trim() !== '' ? req.body.barcode.trim() : null;
        }
        if (req.body.qr_code !== undefined) {
            qr_code = req.body.qr_code && req.body.qr_code.trim() !== '' ? req.body.qr_code.trim() : null;
        }

        // Check for duplicate barcode only if a non-empty value is provided and different from current
        // null values are allowed multiple times with sparse unique index
        if (barcode && barcode !== resource.barcode) {
            const existingBarcode = await ResourceModel.findOne({ barcode: barcode });
            if (existingBarcode) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Barcode "${barcode}" already exists. Please use a different barcode.` 
                });
            }
        }

        // Check for duplicate QR code only if a non-empty value is provided and different from current
        // null values are allowed multiple times with sparse unique index
        if (qr_code && qr_code !== resource.qr_code) {
            const existingQRCode = await ResourceModel.findOne({ qr_code: qr_code });
            if (existingQRCode) {
                return res.status(400).json({ 
                    success: false, 
                    message: `QR Code "${qr_code}" already exists. Please use a different QR code.` 
                });
            }
        }

        // Update resource fields
        Object.keys(req.body).forEach(key => {
            if (key !== '_id' && key !== 'created_by' && key !== 'created_at') {
                if (key === 'barcode') {
                    resource[key] = barcode;
                } else if (key === 'qr_code') {
                    resource[key] = qr_code;
                } else {
                    resource[key] = req.body[key];
                }
            }
        });

        await resource.save();
        res.status(200).json({ success: true, message: "Resource updated successfully", data: resource });
    } catch (error) {
        console.error('Update resource error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message).join(', ');
            return res.status(400).json({ success: false, message: `Validation error: ${messages}` });
        }
        
        // Handle duplicate key errors
        // This should rarely happen now due to pre-check, but handle it as a fallback
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            const fieldValue = req.body[field];
            // Provide a more user-friendly error message
            const fieldName = field === 'barcode' ? 'Barcode' : field === 'qr_code' ? 'QR Code' : field;
            
            if (fieldValue && fieldValue.trim() !== '') {
                return res.status(400).json({ 
                    success: false, 
                    message: `${fieldName} "${fieldValue}" already exists. Please use a different ${fieldName}.` 
                });
            } else {
                // This shouldn't happen with sparse index, but if it does, provide a helpful message
                return res.status(400).json({ 
                    success: false, 
                    message: `There was an issue with the ${fieldName} field. Please try again or contact support.` 
                });
            }
        }
        
        res.status(500).json({ success: false, message: error.message || 'Failed to update resource' });
    }
});

// Delete resource (Admin/Assistant only)
app.delete("/resources/:id", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);

        if (!user || !['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ success: false, message: 'Not authorized. Admin or Assistant role required.' });
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid resource ID' });
        }

        const resource = await ResourceModel.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        // Prevent deleting resources that are currently in use.
        const activeBorrow = await BorrowModel.findOne({
            resource_id: resource._id,
            status: { $in: ['Approved', 'Claimed', 'Active', 'Overdue', 'PendingReturn', 'PendingApproval'] }
        }).select('_id status');

        if (activeBorrow) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete resource. It has an active borrow record (${activeBorrow.status}).`
            });
        }

        const activeReservation = await ReservationModel.findOne({
            resource_id: resource._id,
            status: { $in: ['Pending', 'Confirmed'] }
        }).select('_id status');

        if (activeReservation) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete resource. It has an active reservation (${activeReservation.status}).`
            });
        }

        await ResourceModel.findByIdAndDelete(resource._id);

        res.status(200).json({
            success: true,
            message: 'Resource deleted successfully'
        });
    } catch (error) {
        console.error('Delete resource error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete resource'
        });
    }
});

// Legacy endpoint - keep for backward compatibility
app.post("/saveDevice", async (req, res) => {
    try {
        const new_resource = new ResourceModel({
            name: req.body.name,
            description: req.body.description,
            category: req.body.category,
            college: req.body.college,
            department: req.body.department,
            barcode: req.body.barcode,
            qr_code: req.body.qr_code,
            status: req.body.status || 'Available',
            location: req.body.location,
            condition: req.body.condition || 'Good',
            max_borrow_days: req.body.max_borrow_days || 7,
            total_quantity: req.body.total_quantity || 1,
            available_quantity: req.body.available_quantity || req.body.total_quantity || 1,
            requires_payment: req.body.requires_payment || false,
            payment_amount: req.body.payment_amount || 0,
            created_by: req.body.created_by
        });
        await new_resource.save();
        res.status(200).json({ message: "Success", resource: new_resource });
    } catch (error) {
        res.send(error);
    }
});

// ==================== BORROW ROUTES ====================

app.post("/borrow/checkout", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        const { resource_id, due_date, condition_on_borrow } = req.body;

        const resource = await ResourceModel.findById(resource_id);
        if (!resource) {
            return res.status(500).json({ message: "Resource not found" });
        }

        if (resource.status !== 'Available' || resource.available_quantity < 1) {
            return res.status(500).json({ message: "Resource is not available for borrowing" });
        }

        const sameResourceBlocker = await getUserSameResourceBlocker(user._id, resource_id);
        if (sameResourceBlocker) {
            return res.status(400).json({
                success: false,
                message: `You already have a ${sameResourceBlocker.type.toLowerCase()} record (${sameResourceBlocker.status}) for this resource. You cannot borrow/reserve the same resource twice.`
            });
        }

        // Check for pending penalties - block borrowing if user has unpaid penalties
        const pendingPenalties = await PenaltyModel.find({
            user_id: user._id,
            status: 'Pending'
        });

        if (pendingPenalties.length > 0) {
            const totalPendingAmount = pendingPenalties.reduce((sum, p) => sum + (p.fine_amount || 0), 0);
            return res.status(402).json({ 
                success: false,
                message: `You have ${pendingPenalties.length} pending penalty(ies) totaling ${totalPendingAmount.toFixed(2)} OMR. Please settle your penalties before borrowing resources.`,
                pendingPenalties: pendingPenalties.length,
                totalAmount: totalPendingAmount
            });
        }

        // Check if user has accepted terms and conditions
        const { terms_accepted } = req.body;
        if (!terms_accepted) {
            return res.status(400).json({ 
                success: false,
                message: 'You must accept the terms and conditions to borrow resources' 
            });
        }

        const borrowDate = req.body.borrow_date ? new Date(req.body.borrow_date) : new Date();
        const requestedDueDate = new Date(due_date);
        const borrowDurationDays = getBorrowDurationDays(borrowDate, requestedDueDate, resource.max_borrow_days || 1);
        
        // Handle payment if required
        let paymentId = null;
        const { payment_method, payment_amount } = req.body;
        
        if (resource.requires_payment && resource.payment_amount > 0) {
            if (!payment_method) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Payment method is required for this resource' 
                });
            }
            if (!['Cash', 'Card'].includes(payment_method)) {
                return res.status(400).json({
                    success: false,
                    message: 'Only Cash or Card payment methods are allowed'
                });
            }
            
            // Create payment record
            const newPayment = new PaymentModel({
                user_id: user._id,
                resource_id: resource._id,
                payment_type: 'Resource',
                amount: payment_amount || resource.payment_amount,
                payment_method: payment_method,
                status: 'Pending',
                notes: `Payment for borrowing ${resource.name}`
            });
            await newPayment.save();
            paymentId = newPayment._id;
            
            // Notify admins that a deposit record was created for this borrow request
            const admins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
            for (const admin of admins) {
                await NotificationModel.create({
                    user_id: admin._id,
                    title: 'Borrow Deposit Created',
                    message: `${user.full_name} (${user.email}) selected ${payment_method} for the ${payment_amount || resource.payment_amount} OMR deposit on borrow request "${resource.name}". Approval should wait until the payment is completed.`,
                    type: 'Info',
                    related_type: 'Payment',
                    related_id: newPayment._id
                });
            }
        }

        // BORROW: Requires admin approval first, then becomes Active after approval
        const newBorrow = new BorrowModel({
            user_id: user._id,
            resource_id,
            borrow_date: borrowDate, // Will start from approval date
            due_date: new Date(due_date),
            condition_on_borrow: condition_on_borrow || 'Good',
            checked_out_by: user._id,
            status: 'PendingApproval', // Requires admin approval first
            terms_accepted: true,
            terms_accepted_at: new Date(),
            requires_payment: resource.requires_payment || false,
            payment_amount: resource.requires_payment ? (payment_amount || resource.payment_amount) : 0,
            payment_method: resource.requires_payment ? payment_method : null,
            payment_status: resource.requires_payment ? 'Pending' : 'Not Required',
            payment_id: paymentId,
            borrow_duration_days: borrowDurationDays
        });

        // Update user's terms acceptance (one-time acceptance)
        if (!user.terms_accepted) {
            user.terms_accepted = true;
            user.terms_accepted_at = new Date();
            await user.save();
        }
        await newBorrow.save();

        if (paymentId) {
            await PaymentModel.updateOne({ _id: paymentId }, { $set: { borrow_id: newBorrow._id } });
        }

        // DON'T decrease quantity yet - wait for admin approval
        // Quantity will be decreased when admin approves the borrow
        
        // Populate resource_id for the response
        await newBorrow.populate('resource_id', 'name category barcode qr_code department');

        // Notify admins about pending borrow request
        const admins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
        for (const admin of admins) {
            await NotificationModel.create({
                user_id: admin._id,
                title: 'New Borrow Request',
                message: `${user.full_name} (${user.email}) has requested to borrow ${resource.name}. Pickup location: ${resource.location || 'IT Borrowing Hub - Lab 2'}. ${resource.requires_payment && resource.payment_amount > 0 ? `Payment: ${resource.payment_amount} OMR via ${payment_method}.` : ''}`,
                type: 'Info',
                related_type: 'Borrow',
                related_id: newBorrow._id
            });
        }

        // Notify user that request is pending approval (respect notification preferences)
        if (await shouldSendInAppNotification(user._id, 'borrowApproval')) {
            await NotificationModel.create({
                user_id: user._id,
                title: 'Borrow Request Submitted',
                message: `Your borrow request for ${resource.name} has been submitted and is pending admin approval. ${resource.requires_payment && resource.payment_amount > 0 ? payment_method === 'Card' ? `Please complete the online card payment of ${resource.payment_amount} OMR in the Payments page first. The admin will review your request after the payment is completed.` : `Your ${resource.payment_amount} OMR deposit via ${payment_method} must be confirmed before final approval.` : 'You will be notified once it is approved.'}`,
                type: 'Info',
                related_type: 'Borrow',
                related_id: newBorrow._id
            });
        }

        // Email: notify user about submitted borrow request
        await sendEmail({
            to: user.email,
            subject: 'Borrow Request Submitted – UTAS Borrowing Hub',
            html: `<div style="${emailStyle}">${emailHeader}
              <div style="padding:24px;">
                <p>Dear ${user.full_name},</p>
                <p>Your borrow request for <strong>${resource.name}</strong> has been submitted and is <strong>pending admin approval</strong>.</p>
                ${resource.requires_payment && resource.payment_amount > 0
                    ? payment_method === 'Card'
                        ? `<p>Please complete the <strong>online card payment</strong> of <strong>${resource.payment_amount} OMR</strong> from the Payments page. After payment, the admin will be notified to review your request.</p>`
                        : `<p>Your <strong>${resource.payment_amount} OMR</strong> deposit via <strong>${payment_method}</strong> must be confirmed before the admin can approve the borrow request.</p>`
                    : ''}
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${resource.name}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Category</td><td style="padding:6px;">${resource.category || 'N/A'}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Due Date</td><td style="padding:6px;">${new Date(newBorrow.due_date).toLocaleDateString()}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Status</td><td style="padding:6px;">Pending Approval</td></tr>
                </table>
                <p>You will receive another email once your request is reviewed.</p>
              </div>${emailFooter}</div>`
        });

        // Email: notify all admins about new borrow request
        for (const admin of admins) {
            await sendEmail({
                to: admin.email,
                subject: `New Borrow Request from ${user.full_name} – UTAS Borrowing Hub`,
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${admin.full_name},</p>
                    <p>A new borrow request requires your attention.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">User</td><td style="padding:6px;font-weight:bold;">${user.full_name} (${user.email})</td></tr>
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;">${resource.name}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Due Date</td><td style="padding:6px;">${new Date(newBorrow.due_date).toLocaleDateString()}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Location</td><td style="padding:6px;">${resource.location || 'IT Borrowing Hub - Lab 2'}</td></tr>
                    </table>
                    <p>Please log in to the admin panel to approve or reject this request.</p>
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({ success: true, data: newBorrow, message: "Success" });
    } catch (error) {
        res.send(error);
    }
});

app.get("/borrow/my-borrows", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Not authorized' 
            });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const { status } = req.query;
        const query = { user_id: decoded.id };
        
        // Allow filtering by any valid status
        if (status && ['Claimed', 'Active', 'Returned', 'Overdue', 'Lost', 'PendingApproval', 'PendingReturn'].includes(status)) {
            query.status = status === 'Claimed' ? { $in: ['Claimed', 'Active'] } : status;
        }
        // If no status filter, show all borrows (including PendingApproval)

        const borrows = await BorrowModel.find(query)
            .populate('resource_id', 'name category barcode qr_code department')
            .sort({ created_at: -1 }); // Sort by creation date to show newest first

        res.status(200).json({ 
            success: true,
            data: borrows 
        });
    } catch (error) {
        console.error('Get my borrows error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to fetch borrows' 
        });
    }
});

app.put("/borrow/:id/return", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);

        const { condition_on_return, notes, status } = req.body;

        const borrow = await BorrowModel.findById(req.params.id).populate('resource_id');
        if (!borrow) {
            return res.status(500).json({ message: "Borrow record not found" });
        }

        const isStaff = ['Admin', 'Assistant'].includes(user.role);
        const isOwner = borrow.user_id.toString() === user._id.toString();

        if (!isOwner && !isStaff) {
            return res.status(500).json({ message: "Not authorized" });
        }

        if (borrow.status === 'Returned' || borrow.status === 'Lost') {
            return res.status(500).json({ message: "Resource already returned or marked as lost" });
        }

        // Borrower (non-staff): only submit a return request — stock is released when staff confirms
        if (isOwner && !isStaff) {
            if (borrow.status === 'PendingReturn') {
                return res.status(400).json({
                    message: 'Return request already submitted. Please wait for staff to confirm receipt at the hub.'
                });
            }
            if (!['Claimed', 'Active', 'Overdue'].includes(borrow.status)) {
                return res.status(400).json({
                    message: 'Only physically claimed or overdue borrows can be submitted for return. Pending or approved pickup requests must be completed by staff first.'
                });
            }
            if (status === 'Lost') {
                return res.status(400).json({
                    message: 'Please hand the item to staff. Only administrators can mark a resource as lost.'
                });
            }
            borrow.status = 'PendingReturn';
            borrow.return_requested_at = new Date();
            if (notes !== undefined && notes !== null) {
                borrow.notes = notes;
            }
            borrow.updated_at = new Date();
            await borrow.save();

            const resName = borrow.resource_id?.name || 'resource';
            const admins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
            for (const adm of admins) {
                if (await shouldSendInAppNotification(adm._id, 'borrowApproval')) {
                    await NotificationModel.create({
                        user_id: adm._id,
                        title: 'Return pending confirmation',
                        message: `${user.full_name} (${user.email}) submitted a return for "${resName}". Confirm receipt in Borrow Management to release inventory.`,
                        type: 'Info',
                        related_type: 'Borrow',
                        related_id: borrow._id
                    });
                }
            }
            for (const adm of admins) {
                if (adm.email) {
                    await sendEmail({
                        to: adm.email,
                        subject: `Return to confirm – ${resName} – UTAS Borrowing Hub`,
                        html: `<div style="${emailStyle}">${emailHeader}
                          <div style="padding:24px;">
                            <p>Dear ${adm.full_name},</p>
                            <p><strong>${user.full_name}</strong> has submitted a return for <strong>${resName}</strong>.</p>
                            <p>Please verify physical receipt in <strong>Borrow Management</strong> and use <strong>Mark Return</strong> to complete the return and update availability.</p>
                          </div>${emailFooter}</div>`
                    });
                }
            }

            return res.status(200).json({
                success: true,
                data: borrow,
                message: 'Return request submitted. Staff will confirm when the item is received; the resource stays on loan until then.'
            });
        }

        // Staff: finalize return (or lost) — restores inventory when status is Returned
        if (!['Claimed', 'Active', 'Overdue', 'PendingReturn'].includes(borrow.status)) {
            return res.status(400).json({
                message: 'Only physically claimed, overdue, or pending-return borrows can be finalized. Pending or approved pickup requests must be completed by staff first.'
            });
        }

        const returnDate = new Date();
        // Calculate days late: if return date is after due date, calculate the difference
        // Only count full days late (round up)
        const daysLate = Math.max(0, Math.ceil((returnDate - borrow.due_date) / (1000 * 60 * 60 * 24)));

        const finalStatus = status || 'Returned'; // Allow 'Returned' or 'Lost'
        
        borrow.return_date = returnDate;
        borrow.status = finalStatus;
        // Only set condition_on_return if status is Returned
        if (finalStatus === 'Returned') {
            borrow.condition_on_return = condition_on_return || borrow.condition_on_borrow;
        } else {
            borrow.condition_on_return = null; // Lost items don't have condition
        }
        borrow.notes = notes;
        borrow.checked_in_by = user._id;
        await borrow.save();

        const resource = await ResourceModel.findById(borrow.resource_id._id);
        
        // Restore shelf count only when the item is actually returned (not lost)
        if (finalStatus === 'Returned') {
            resource.available_quantity = Math.min(
                resource.total_quantity || 1,
                resource.available_quantity + 1
            );
            
            if (resource.available_quantity > 0) {
                resource.status = 'Available';
            }
            
            // Update condition if damaged
            if (condition_on_return && ['Fair', 'Poor'].includes(condition_on_return)) {
                resource.condition = condition_on_return;
            }
        }
        // If Lost, don't increase available_quantity (item is permanently lost)
        
        await resource.save();

        // Notify users with pending reservations for this resource
        const pendingReservations = await ReservationModel.find({
            resource_id: resource._id,
            status: { $in: ['Pending', 'Confirmed'] }
        }).populate('user_id');

        for (const reservation of pendingReservations) {
            const uid = reservation.user_id?._id || reservation.user_id;
            if (uid && (await shouldSendInAppNotification(uid, 'reservationAvailable'))) {
                await NotificationModel.create({
                    user_id: uid,
                    title: 'Resource Available',
                    message: `The resource "${resource.name}" you reserved is now available for pickup!`,
                    type: 'Info',
                    related_type: 'Reservation',
                    related_id: reservation._id
                });
            }
        }

        // Create penalty ONLY if:
        // 1. Late return (daysLate > 0)
        // 2. Damage (condition is Fair or Poor)
        // 3. Loss (status is Lost)
        let penalty = null;
        const hasLateReturn = daysLate > 0;
        const hasDamage = condition_on_return && ['Fair', 'Poor'].includes(condition_on_return);
        const isLost = borrow.status === 'Lost';
        
        if (hasLateReturn || hasDamage || isLost) {
            let fineAmount = 0;
            let penaltyType = 'Late Return';
            let damageLevel = null;
            let description = '';

            if (isLost) {
                // Loss penalty - full replacement cost from resource
                penaltyType = 'Loss';
                const resource = await ResourceModel.findById(borrow.resource_id._id || borrow.resource_id);
                fineAmount = resource?.replacement_cost || 100; // Use resource replacement_cost or default to 100 OMR
                description = 'Resource lost';
            } else if (hasDamage) {
                // Damage penalty
                penaltyType = 'Damage';
                damageLevel = condition_on_return === 'Poor' ? 'Severe' : 'Moderate';
                fineAmount = condition_on_return === 'Poor' ? 50 : 25;
                description = `Damage: ${condition_on_return}`;
                
                // Add late return penalty if also late - 0.5 OMR per day
                if (hasLateReturn) {
                    fineAmount += daysLate * 0.5;
                    description += ` + ${daysLate} day(s) late`;
                }
            } else if (hasLateReturn) {
                // Late return penalty only - 0.5 OMR per day
                fineAmount = daysLate * 0.5;
                description = `${daysLate} day(s) late`;
            }

            penalty = await PenaltyModel.create({
                borrow_id: borrow._id,
                user_id: borrow.user_id,
                penalty_type: penaltyType,
                days_late: hasLateReturn ? daysLate : 0,
                damage_level: damageLevel,
                fine_amount: fineAmount,
                description: description,
                status: 'Pending'
            });

            // Send notification about penalty (respect notification preferences)
            const borrowUserId = borrow.user_id?._id || borrow.user_id;
            if (borrowUserId && (await shouldSendInAppNotification(borrowUserId, 'penalty'))) {
                await NotificationModel.create({
                    user_id: borrowUserId,
                    title: 'Penalty Applied',
                    message: `A penalty of ${fineAmount} OMR has been applied: ${description}. Please settle your penalty.`,
                    type: 'Warning',
                    related_type: 'Penalty',
                    related_id: penalty._id
                });
            }
        }

        // Handle security deposit after return:
        // - If no late/damage/loss -> refund deposit automatically
        // - If there is a penalty or loss -> keep deposit as Completed (used to cover issues)
        if (borrow.payment_id) {
            const depositPayment = await PaymentModel.findById(borrow.payment_id);
            if (depositPayment && depositPayment.payment_type === 'Resource') {
                // No issues: on time, no damage, not lost -> refund
                if (!hasLateReturn && !hasDamage && !isLost && depositPayment.status === 'Completed') {
                    depositPayment.status = 'Refunded';
                    depositPayment.updated_at = Date.now();
                    depositPayment.processed_by = user._id;
                    await depositPayment.save();

                    await NotificationModel.create({
                        user_id: borrow.user_id,
                        title: 'Security Deposit Refunded',
                        message: `Your security deposit of ${depositPayment.amount} OMR for "${resource.name}" has been refunded.`,
                        type: 'Success',
                        related_type: 'Payment',
                        related_id: depositPayment._id
                    });
                }
                // If there are issues (late/damage/loss), the deposit stays as Completed.
                // Penalties remain Pending and can be paid via the normal penalties payment flow.
            }
        }

        // Email: notify user about return
        const returnedByUser = await UserModel.findById(borrow.user_id);
        if (returnedByUser?.email) {
            await sendEmail({
                to: returnedByUser.email,
                subject: `Resource Returned – UTAS Borrowing Hub`,
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${returnedByUser.full_name},</p>
                    <p>The resource has been <strong>${finalStatus === 'Lost' ? 'marked as Lost' : 'returned'}</strong> successfully.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${resource.name}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Return Date</td><td style="padding:6px;">${new Date(returnDate).toLocaleDateString()}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Status</td><td style="padding:6px;">${finalStatus}</td></tr>
                      ${penalty ? `<tr><td style="padding:6px;color:#c62828;">Penalty</td><td style="padding:6px;color:#c62828;font-weight:bold;">${penalty.fine_amount} OMR – ${penalty.description}</td></tr>` : ''}
                    </table>
                    ${penalty ? '<p style="color:#c62828;">A penalty has been applied. Please log in to settle it.</p>' : '<p>Thank you for returning the resource on time!</p>'}
                  </div>${emailFooter}</div>`
            });
        }

        // Email: notify admins about return
        const returnAdmins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
        for (const adm of returnAdmins) {
            await sendEmail({
                to: adm.email,
                subject: `Resource Returned by ${returnedByUser?.full_name || 'User'} – UTAS Borrowing Hub`,
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${adm.full_name},</p>
                    <p>A resource has been returned.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">User</td><td style="padding:6px;font-weight:bold;">${returnedByUser?.full_name} (${returnedByUser?.email})</td></tr>
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;">${resource.name}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Status</td><td style="padding:6px;">${finalStatus}</td></tr>
                      ${penalty ? `<tr><td style="padding:6px;color:#555;">Penalty Applied</td><td style="padding:6px;">${penalty.fine_amount} OMR</td></tr>` : ''}
                    </table>
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({
            success: true,
            data: borrow,
            penalty: penalty,
            message: "Success"
        });
    } catch (error) {
        res.send(error);
    }
});

// ==================== RESERVATIONS ROUTES ====================

app.post("/reservations", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        // Check for pending penalties
        const pendingPenalties = await PenaltyModel.find({
            user_id: user._id,
            status: 'Pending'
        });

        if (pendingPenalties.length > 0) {
            const totalPendingAmount = pendingPenalties.reduce((sum, p) => sum + (p.fine_amount || 0), 0);
            return res.status(402).json({ 
                success: false,
                message: `Pre-payment required. You have ${pendingPenalties.length} pending penalty(ies) totaling ${totalPendingAmount.toFixed(2)} OMR. Please settle your penalties before making reservations.`,
                pendingPenalties: pendingPenalties.length,
                totalAmount: totalPendingAmount
            });
        }
        
        const { resource_id, pickup_date, expiry_date } = req.body;

        // Validate required fields
        if (!resource_id || !pickup_date) {
            return res.status(400).json({ 
                success: false,
                message: 'Resource ID and pickup date are required' 
            });
        }

        const resource = await ResourceModel.findById(resource_id);
        if (!resource) {
            return res.status(404).json({ 
                success: false,
                message: "Resource not found" 
            });
        }

        // Only block reservations for non-circulating states.
        // For Borrowed/Reserved states, availability is evaluated against the requested date range below.
        if (['Maintenance', 'Lost'].includes(resource.status)) {
            return res.status(400).json({
                success: false,
                message: "Resource is not available for reservation"
            });
        }

        const sameResourceBlocker = await getUserSameResourceBlocker(user._id, resource_id);
        if (sameResourceBlocker) {
            return res.status(400).json({
                success: false,
                message: `You already have a ${sameResourceBlocker.type.toLowerCase()} record (${sameResourceBlocker.status}) for this resource. You cannot borrow/reserve the same resource twice.`
            });
        }

        // Calculate reservation period first (default expiry = pickup + 7 days)
        const pickupDateObj = new Date(pickup_date);
        let expiryDateObj;
        if (expiry_date) {
            expiryDateObj = new Date(expiry_date);
        } else {
            expiryDateObj = new Date(pickupDateObj);
            expiryDateObj.setDate(expiryDateObj.getDate() + 7);
        }
        if (Number.isNaN(pickupDateObj.getTime()) || Number.isNaN(expiryDateObj.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pickup/expiry date format'
            });
        }
        if (expiryDateObj < pickupDateObj) {
            return res.status(400).json({
                success: false,
                message: 'Expiry date must be on or after pickup date'
            });
        }

        // Check active borrows overlapping the requested period
        const overlappingBorrows = await BorrowModel.find({
            resource_id: resource._id,
            status: { $in: BORROW_OUT_STATUSES },
            $or: [
                {
                    borrow_date: { $lte: expiryDateObj },
                    due_date: { $gte: pickupDateObj }
                }
            ]
        });

        // Check confirmed reservations overlapping the requested period
        const overlappingReservations = await ReservationModel.find({
            resource_id: resource._id,
            status: 'Confirmed',
            pickup_date: { $lte: expiryDateObj },
            expiry_date: { $gte: pickupDateObj }
        });

        const totalQuantity = resource.total_quantity || 1;
        const totalOverlappingUsage = overlappingBorrows.length + overlappingReservations.length;
        if (totalOverlappingUsage >= totalQuantity) {
            // Find earliest expected release date from active borrows/confirmed reservations
            const earliestReturn = await BorrowModel.findOne({
                resource_id: resource._id,
                status: { $in: BORROW_OUT_STATUSES }
            }).sort({ due_date: 1 });
            const earliestReservationExpiry = await ReservationModel.findOne({
                resource_id: resource._id,
                status: 'Confirmed'
            }).sort({ expiry_date: 1 });

            const candidates = [];
            if (earliestReturn?.due_date) {
                candidates.push(new Date(earliestReturn.due_date));
            }
            if (earliestReservationExpiry?.expiry_date) {
                candidates.push(new Date(earliestReservationExpiry.expiry_date));
            }
            const suggestedDate = candidates.length
                ? new Date(Math.min(...candidates.map((d) => d.getTime())))
                : new Date();
            suggestedDate.setDate(suggestedDate.getDate() + 1);

            return res.status(400).json({ 
                success: false,
                message: `Resource is fully booked during the requested period. Suggested available date: ${suggestedDate.toLocaleDateString()}`,
                suggestedDate: suggestedDate.toISOString().split('T')[0],
                earliestReturnDate: earliestReturn ? earliestReturn.due_date : null
            });
        }

        // Check if user has accepted terms and conditions
        const { terms_accepted, payment_method, payment_amount } = req.body;
        if (!terms_accepted) {
            return res.status(400).json({ 
                success: false,
                message: 'You must accept the terms and conditions to make reservations' 
            });
        }

        // Handle payment if required
        let paymentId = null;
        if (resource.requires_payment && resource.payment_amount > 0) {
            if (!payment_method) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Payment method is required for this resource' 
                });
            }
            if (!['Cash', 'Card'].includes(payment_method)) {
                return res.status(400).json({
                    success: false,
                    message: 'Only Cash or Card payment methods are allowed'
                });
            }
            
            // Create payment record
            const newPayment = new PaymentModel({
                user_id: user._id,
                resource_id: resource._id,
                payment_type: 'Reservation',
                amount: payment_amount || resource.payment_amount,
                payment_method: payment_method,
                status: 'Pending',
                notes: `Payment for reserving ${resource.name}`
            });
            await newPayment.save();
            paymentId = newPayment._id;
            
            // Notify admins that a deposit record was created for this reservation request
            const admins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
            for (const admin of admins) {
                await NotificationModel.create({
                    user_id: admin._id,
                    title: 'Reservation Deposit Created',
                    message: `${user.full_name} (${user.email}) selected ${payment_method} for the ${payment_amount || resource.payment_amount} OMR deposit on reservation "${resource.name}". Approval should wait until the payment is completed.`,
                    type: 'Info',
                    related_type: 'Payment',
                    related_id: newPayment._id
                });
            }
        }

        const newReservation = new ReservationModel({
            user_id: user._id,
            resource_id,
            pickup_date: pickupDateObj,
            expiry_date: expiryDateObj,
            status: 'Pending',
            requires_payment: resource.requires_payment || false,
            payment_amount: resource.requires_payment ? (payment_amount || resource.payment_amount) : 0,
            payment_method: resource.requires_payment ? payment_method : null,
            payment_status: resource.requires_payment ? 'Pending' : 'Not Required',
            payment_id: paymentId
        });

        // Update user's terms acceptance (one-time acceptance)
        if (!user.terms_accepted) {
            user.terms_accepted = true;
            user.terms_accepted_at = new Date();
            await user.save();
        }
        await newReservation.save();

        if (paymentId) {
            await PaymentModel.updateOne({ _id: paymentId }, { $set: { reservation_id: newReservation._id } });
        }

        // RESERVE: Don't decrease quantity - only reserve for future pickup
        // Quantity will be decreased when reservation is confirmed and picked up
        // This allows the resource to remain available for others until pickup date
        // No quantity change here - reservation is just a booking for future date

        // Email: notify user about reservation submission
        await sendEmail({
            to: user.email,
            subject: 'Reservation Submitted – UTAS Borrowing Hub',
            html: `<div style="${emailStyle}">${emailHeader}
              <div style="padding:24px;">
                <p>Dear ${user.full_name},</p>
                <p>Your reservation request has been <strong>submitted</strong> and is pending admin approval.</p>
                ${resource.requires_payment && resource.payment_amount > 0
                    ? payment_method === 'Card'
                        ? `<p>Please complete the <strong>online card payment</strong> of <strong>${resource.payment_amount} OMR</strong> from the Payments page. After payment, the admin will be notified to review your reservation.</p>`
                        : `<p>Your <strong>${resource.payment_amount} OMR</strong> deposit via <strong>${payment_method}</strong> must be confirmed before the admin can approve the reservation.</p>`
                    : ''}
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${resource.name}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Pickup Date</td><td style="padding:6px;">${pickupDateObj.toLocaleDateString()}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Status</td><td style="padding:6px;">Pending</td></tr>
                </table>
                <p>You will receive another email once your reservation is reviewed.</p>
              </div>${emailFooter}</div>`
        });

        // Email: notify admins about new reservation
        const reserveAdmins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
        for (const adm of reserveAdmins) {
            await sendEmail({
                to: adm.email,
                subject: `New Reservation from ${user.full_name} – UTAS Borrowing Hub`,
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${adm.full_name},</p>
                    <p>A new reservation request has been submitted.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">User</td><td style="padding:6px;font-weight:bold;">${user.full_name} (${user.email})</td></tr>
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;">${resource.name}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Pickup Date</td><td style="padding:6px;">${pickupDateObj.toLocaleDateString()}</td></tr>
                    </table>
                    <p>Please log in to the admin panel to review this reservation. ${resource.requires_payment && resource.payment_amount > 0 ? 'If payment method is Card, approval should wait until the deposit is completed.' : ''}</p>
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({ success: true, data: newReservation, message: "Success" });
    } catch (error) {
        console.error('Reservation creation error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to create reservation. Please try again.' 
        });
    }
});

app.get("/reservations/my-reservations", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const { status } = req.query;
        const query = { user_id: decoded.id };
        
        if (status) query.status = status;

        const reservations = await ReservationModel.find(query)
            .populate('resource_id', 'name category')
            .sort({ reservation_date: -1 });

        res.send(reservations);
    } catch (error) {
        res.send(error);
    }
});

app.put("/reservations/:id/cancel", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const reservation = await ReservationModel.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found' });
        }

        if (reservation.user_id.toString() !== decoded.id) {
            return res.status(403).json({ message: 'Not authorized to cancel this reservation' });
        }

        if (reservation.status === 'Cancelled') {
            return res.status(400).json({ message: 'Reservation is already cancelled' });
        }

        const resource = await ResourceModel.findById(reservation.resource_id);
        const wasConfirmed = reservation.status === 'Confirmed';
        
        reservation.status = 'Cancelled';
        await reservation.save();

        await releaseLinkedDepositPayment(reservation.payment_id, decoded.id, 'reservation cancelled by user');

        // RESERVE: Only return quantity if reservation was confirmed (quantity was decreased at confirmation)
        // Pending reservations don't decrease quantity, so nothing to return
        if (resource && wasConfirmed) {
            resource.available_quantity = Math.min(
                resource.total_quantity || 1,
                resource.available_quantity + 1
            );
            if (resource.available_quantity > 0 && resource.status === 'Reserved') {
                resource.status = 'Available';
            }
            await resource.save();
        }

        // Email: notify user about cancellation
        const cancelUser = await UserModel.findById(decoded.id);
        const cancelResource = resource || await ResourceModel.findById(reservation.resource_id);
        if (cancelUser?.email) {
            await sendEmail({
                to: cancelUser.email,
                subject: 'Reservation Cancelled – UTAS Borrowing Hub',
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${cancelUser.full_name},</p>
                    <p>Your reservation has been <strong>cancelled</strong>.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${cancelResource?.name || 'N/A'}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Pickup Date</td><td style="padding:6px;">${new Date(reservation.pickup_date).toLocaleDateString()}</td></tr>
                    </table>
                    <p>If this was a mistake, please create a new reservation.</p>
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({ success: true, data: reservation, message: 'Reservation cancelled successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to cancel reservation' });
    }
});

app.get("/admin/reservations", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { status, search, page = 1, limit = 20 } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { 'user_id.full_name': { $regex: search, $options: 'i' } },
                { 'user_id.email': { $regex: search, $options: 'i' } },
                { 'resource_id.name': { $regex: search, $options: 'i' } }
            ];
        }

        const reservations = await ReservationModel.find(query)
            .populate('user_id', 'full_name email student_id phone')
            .populate('resource_id', 'name category barcode qr_code')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ reservation_date: -1 });

        const total = await ReservationModel.countDocuments(query);

        res.status(200).json({
            success: true,
            data: reservations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get reservations error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch reservations' });
    }
});

app.put("/admin/reservations/:id/confirm", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const admin = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(admin.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const reservation = await ReservationModel.findById(req.params.id)
            .populate('resource_id')
            .populate('user_id');

        if (!reservation) {
            return res.status(404).json({ 
                success: false,
                message: 'Reservation not found' 
            });
        }

        if (reservation.status !== 'Pending' && reservation.status !== 'Confirmed') {
            return res.status(400).json({ 
                success: false,
                message: `Cannot confirm reservation. Current status: ${reservation.status}` 
            });
        }

        // Check if resource is still available
        const resource = await ResourceModel.findById(reservation.resource_id._id);
        if (!resource) {
            return res.status(404).json({ 
                success: false,
                message: 'Resource not found' 
            });
        }

        if (reservation.requires_payment && reservation.payment_amount > 0) {
            if (!reservation.payment_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot confirm reservation. Security deposit payment record not found.'
                });
            }

            const reservationPayment = await PaymentModel.findById(reservation.payment_id);
            if (!reservationPayment || reservationPayment.status !== 'Completed') {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot confirm reservation. Security deposit has not been confirmed yet. Please confirm the payment in Payments Management first.',
                    depositStatus: reservationPayment ? reservationPayment.status : 'Missing'
                });
            }

            reservation.payment_status = 'Paid';
        }

        // RESERVE: Check if resource is available for pickup (quantity NOT decreased yet for reservations)
        // Only check actual available quantity and active borrows
        const activeBorrowsCount = await BorrowModel.countDocuments({
            resource_id: resource._id,
            status: { $in: BORROW_OUT_STATUSES }
        });
        
        if (resource.available_quantity <= 0 || activeBorrowsCount >= resource.total_quantity) {
            return res.status(400).json({ 
                success: false,
                message: 'Resource is not available for pickup. All copies are currently borrowed.' 
            });
        }

        // Check if resource is already borrowed during pickup date
        const pickupDate = new Date(reservation.pickup_date);
        const maxBorrowDays = resource.max_borrow_days || 7;
        const dueDate = new Date(pickupDate);
        dueDate.setDate(dueDate.getDate() + maxBorrowDays);

        const overlappingBorrows = await BorrowModel.find({
            resource_id: resource._id,
            status: { $in: ['Claimed', 'Active', 'Overdue', 'PendingReturn'] },
            $or: [
                {
                    borrow_date: { $lte: dueDate },
                    due_date: { $gte: pickupDate }
                }
            ]
        });

        if (overlappingBorrows.length >= resource.available_quantity) {
            return res.status(400).json({ 
                success: false,
                message: 'Resource is already borrowed during the requested pickup date. Please check availability first.' 
            });
        }

        // RESERVE: atomically hold one unit when reservation is confirmed (avoids over-booking under concurrency)
        const resourceAfterDec = await ResourceModel.findOneAndUpdate(
            { _id: resource._id, available_quantity: { $gte: 1 } },
            { $inc: { available_quantity: -1 } },
            { new: true }
        );
        if (!resourceAfterDec) {
            return res.status(400).json({
                success: false,
                message: 'Resource is not available for pickup. All copies are currently borrowed.'
            });
        }
        try {
            reservation.status = 'Confirmed';
            reservation.updated_at = new Date();
            await reservation.save();
        } catch (saveErr) {
            await ResourceModel.updateOne({ _id: resource._id }, { $inc: { available_quantity: 1 } });
            throw saveErr;
        }
        if (resourceAfterDec.available_quantity === 0) {
            await ResourceModel.updateOne({ _id: resource._id }, { $set: { status: 'Reserved' } });
        }

        const paymentRequiredAfterConfirmation = reservation.requires_payment && reservation.payment_amount > 0;

        // Send notification to user (respect notification preferences)
        const resUserId = reservation.user_id?._id || reservation.user_id;
        if (resUserId && (await shouldSendInAppNotification(resUserId, 'reservationConfirmation'))) {
            await NotificationModel.create({
                user_id: resUserId,
                title: paymentRequiredAfterConfirmation ? 'Reservation Confirmed - Payment Required' : 'Reservation Confirmed',
                message: paymentRequiredAfterConfirmation
                    ? `Your reservation for "${resource.name}" is confirmed. Please pay the security deposit (${reservation.payment_amount} OMR) in the Payments page before final borrow approval.`
                    : `Your reservation for "${resource.name}" has been confirmed. Please pick it up on ${pickupDate.toLocaleDateString()} from ${resource.location || 'IT Borrowing Hub - Lab 2'}. The resource is now reserved for you.`,
                type: 'Success',
                related_type: paymentRequiredAfterConfirmation ? 'Payment' : 'Reservation',
                related_id: paymentRequiredAfterConfirmation ? (reservation.payment_id || reservation._id) : reservation._id
            });
        }

        // Email: notify user reservation is confirmed
        const reservedUser = reservation.user_id;
        if (reservedUser?.email) {
            await sendEmail({
                to: reservedUser.email,
                subject: 'Reservation Confirmed – UTAS Borrowing Hub',
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${reservedUser.full_name},</p>
                    <p>Your reservation has been <strong style="color:#2e7d32;">confirmed</strong>!</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${resource.name}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Pickup Date</td><td style="padding:6px;">${pickupDate.toLocaleDateString()}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Pickup Location</td><td style="padding:6px;">${resource.location || 'IT Borrowing Hub - Lab 2'}</td></tr>
                    </table>
                    ${paymentRequiredAfterConfirmation
                        ? `<p style="margin:12px 0;color:#c62828;"><strong>Action required:</strong> Please pay the security deposit of ${reservation.payment_amount} OMR from your Payments page. Your reservation will only be converted to an active borrow after payment confirmation by admin.</p>`
                        : `<p>Please pick up your reservation on time.</p>`
                    }
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({
            success: true,
            data: reservation,
            message: 'Reservation confirmed successfully'
        });
    } catch (error) {
        console.error('Confirm reservation error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to confirm reservation' 
        });
    }
});

// Convert confirmed reservation to borrow (Admin approval)
app.post("/admin/reservations/:id/approve-borrow", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const admin = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(admin.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { due_date, condition_on_borrow } = req.body;
        const reservation = await ReservationModel.findById(req.params.id)
            .populate('resource_id')
            .populate('user_id');

        if (!reservation) {
            return res.status(404).json({ 
                success: false,
                message: 'Reservation not found' 
            });
        }

        if (reservation.status !== 'Confirmed') {
            return res.status(400).json({ 
                success: false,
                message: `Reservation must be confirmed before approval. Current status: ${reservation.status}` 
            });
        }

        const resource = await ResourceModel.findById(reservation.resource_id._id);
        if (!resource) {
            return res.status(404).json({ 
                success: false,
                message: 'Resource not found' 
            });
        }

        // RESERVE->BORROW: Quantity was already decreased when reservation was confirmed
        // Check if resource is still available (should be, since it's confirmed)
        const activeBorrowsCount = await BorrowModel.countDocuments({
            resource_id: resource._id,
            status: { $in: BORROW_OUT_STATUSES }
        });
        
        if (activeBorrowsCount >= resource.total_quantity) {
            return res.status(400).json({ 
                success: false,
                message: 'Resource is not available. All copies are currently borrowed.' 
            });
        }

        // Check for existing active borrow for this user and resource
        const existingBorrow = await BorrowModel.findOne({
            user_id: reservation.user_id._id,
            resource_id: resource._id,
            status: { $in: BORROW_OUT_STATUSES }
        });

        if (existingBorrow) {
            return res.status(400).json({
                success: false,
                message: 'User already has an active borrow or pending return for this resource'
            });
        }

        // Check if user has accepted terms (should be done when reservation was created, but verify)
        const reservationUser = await UserModel.findById(reservation.user_id._id);
        if (!reservationUser.terms_accepted) {
            return res.status(400).json({ 
                success: false,
                message: 'User must accept terms and conditions before borrowing. Please ask the user to accept terms first.' 
            });
        }

        // If reservation requires a security deposit, ensure payment is completed before conversion
        if (reservation.requires_payment && reservation.payment_amount > 0) {
            if (!reservation.payment_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot approve reservation. Security deposit payment record not found.'
                });
            }

            const reservationPayment = await PaymentModel.findById(reservation.payment_id);
            if (!reservationPayment || reservationPayment.status !== 'Completed') {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot approve reservation. Security deposit has not been confirmed yet. Please confirm the payment in Payments Management first.',
                    depositStatus: reservationPayment ? reservationPayment.status : 'Missing'
                });
            }
        }

        // Create borrow record
        const requestedBorrowDate = new Date(reservation.pickup_date);
        const requestedDueDate = due_date ? new Date(due_date) : new Date(requestedBorrowDate);
        if (!due_date) {
            requestedDueDate.setDate(requestedDueDate.getDate() + (resource.max_borrow_days || 7));
        }

        const borrowDurationDays = getBorrowDurationDays(requestedBorrowDate, requestedDueDate, resource.max_borrow_days || 1);
        const approvalDate = new Date();
        const finalDueDate = new Date(approvalDate);
        finalDueDate.setDate(finalDueDate.getDate() + borrowDurationDays);
        const newBorrow = new BorrowModel({
            user_id: reservation.user_id._id,
            resource_id: resource._id,
            borrow_date: approvalDate,
            due_date: finalDueDate,
            condition_on_borrow: condition_on_borrow || 'Good',
            checked_out_by: admin._id,
            status: 'Active',
            approved_at: new Date(),
            terms_accepted: true,
            terms_accepted_at: reservationUser.terms_accepted_at || new Date(),
            requires_payment: reservation.requires_payment || false,
            payment_amount: reservation.requires_payment ? reservation.payment_amount : 0,
            payment_method: reservation.requires_payment ? reservation.payment_method : null,
            payment_status: reservation.requires_payment ? 'Paid' : 'Not Required',
            payment_id: reservation.payment_id || null,
            borrow_duration_days: borrowDurationDays
        });
        await newBorrow.save();

        // RESERVE->BORROW: Stock was already decreased at reservation confirm — only sync status (avoid stale full-document save)
        const freshResource = await ResourceModel.findById(resource._id).lean();
        if (freshResource && freshResource.available_quantity === 0) {
            await ResourceModel.updateOne({ _id: resource._id }, { $set: { status: 'Borrowed' } });
        }

        // Update reservation status
        reservation.status = 'Completed';
        if (reservation.requires_payment) {
            reservation.payment_status = 'Paid';
        }
        reservation.updated_at = new Date();
        await reservation.save();

        // Send notification to user (respect notification preferences)
        const resUserId2 = reservation.user_id?._id || reservation.user_id;
        if (resUserId2 && (await shouldSendInAppNotification(resUserId2, 'borrowApproval'))) {
            await NotificationModel.create({
                user_id: resUserId2,
                title: 'Borrow Approved',
                message: `Your reservation for "${resource.name}" has been approved and converted to an active borrow. You can now go to the borrowing section to collect the device from ${resource.location || 'IT Borrowing Hub - Lab 2'}.`,
                type: 'Success',
                related_type: 'Borrow',
                related_id: newBorrow._id
            });
        }

        const reservedUser = reservation.user_id;
        if (reservedUser?.email) {
            await sendEmail({
                to: reservedUser.email,
                subject: 'Reservation Approved – UTAS Borrowing Hub',
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${reservedUser.full_name},</p>
                    <p>Your reservation for <strong>${resource.name}</strong> has been approved and converted to an <strong>active borrow</strong>.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${resource.name}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Pickup Location</td><td style="padding:6px;">${resource.location || 'IT Borrowing Hub - Lab 2'}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Due Date</td><td style="padding:6px;">${finalDueDate.toLocaleDateString()}</td></tr>
                    </table>
                    <p>You can now go to the borrowing section to collect the device.</p>
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({
            success: true,
            data: {
                borrow: newBorrow,
                reservation: reservation
            },
            message: 'Reservation approved and converted to borrow successfully' 
        });
    } catch (error) {
        console.error('Approve borrow error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to approve borrow' 
        });
    }
});

// Delete reservation (Admin/Assistant only)
app.delete("/admin/reservations/:id", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const admin = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(admin.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const reservation = await ReservationModel.findById(req.params.id)
            .populate('resource_id');

        if (!reservation) {
            return res.status(404).json({ 
                success: false,
                message: 'Reservation not found' 
            });
        }

        // If reservation is Confirmed, restore resource quantity
        if (reservation.status === 'Confirmed') {
            const resource = await ResourceModel.findById(reservation.resource_id._id);
            if (resource) {
                resource.available_quantity = Math.min(
                    resource.total_quantity || 1,
                    resource.available_quantity + 1
                );
                if (resource.status === 'Borrowed' && resource.available_quantity > 0) {
                    resource.status = 'Available';
                }
                await resource.save();
            }
        }

        await releaseLinkedDepositPayment(reservation.payment_id, admin._id, 'reservation deleted by admin');

        // Delete the reservation
        await ReservationModel.findByIdAndDelete(req.params.id);

        res.status(200).json({ 
            success: true,
            message: 'Reservation deleted successfully' 
        });
    } catch (error) {
        console.error('Delete reservation error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to delete reservation' 
        });
    }
});

// Approve pending borrow request
app.put("/admin/borrows/:id/approve", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const admin = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(admin.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const borrow = await BorrowModel.findById(req.params.id)
            .populate('resource_id')
            .populate('user_id');

        if (!borrow) {
            return res.status(404).json({ 
                success: false,
                message: 'Borrow not found' 
            });
        }

        if (borrow.status !== 'PendingApproval') {
            return res.status(400).json({ 
                success: false,
                message: `Borrow is not pending approval. Current status: ${borrow.status}` 
            });
        }

        const resource = await ResourceModel.findById(borrow.resource_id._id);
        if (!resource) {
            return res.status(404).json({ 
                success: false,
                message: 'Resource not found' 
            });
        }

        // Check availability
        if (resource.available_quantity < 1) {
            return res.status(400).json({ 
                success: false,
                message: 'Resource is not available. All copies are currently borrowed.' 
            });
        }

        // Check for pending penalties - block approval if user has unpaid penalties
        const pendingPenalties = await PenaltyModel.find({
            user_id: borrow.user_id._id || borrow.user_id,
            status: 'Pending'
        });

        if (pendingPenalties.length > 0) {
            const totalPendingAmount = pendingPenalties.reduce((sum, p) => sum + (p.fine_amount || 0), 0);
            return res.status(402).json({ 
                success: false,
                message: `Cannot approve borrow. User has ${pendingPenalties.length} pending penalty(ies) totaling ${totalPendingAmount.toFixed(2)} OMR. Please ask the user to settle their penalties first.`,
                pendingPenalties: pendingPenalties.length,
                totalAmount: totalPendingAmount
            });
        }

        // If this borrow requires a security deposit, ensure payment is completed BEFORE approval
        if (borrow.requires_payment && borrow.payment_amount > 0) {
            if (!borrow.payment_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot approve borrow. Security deposit payment record not found.'
                });
            }

            const depositPayment = await PaymentModel.findById(borrow.payment_id);
            if (!depositPayment || depositPayment.status !== 'Completed') {
                return res.status(402).json({
                    success: false,
                    message: 'Cannot approve borrow. Security deposit has not been confirmed yet. Please confirm the payment in Payments Management first.',
                    depositStatus: depositPayment ? depositPayment.status : 'Missing'
                });
            }

            // Mark borrow deposit as paid
            borrow.payment_status = 'Paid';
        }

        // BORROW APPROVAL: atomically reserve one unit, then activate the borrow
        const resourceAfterDec = await ResourceModel.findOneAndUpdate(
            { _id: resource._id, available_quantity: { $gte: 1 } },
            { $inc: { available_quantity: -1 } },
            { new: true }
        );
        if (!resourceAfterDec) {
            return res.status(400).json({
                success: false,
                message: 'Resource is not available. All copies are currently borrowed or reserved.'
            });
        }
        if (resourceAfterDec.available_quantity === 0) {
            await ResourceModel.updateOne({ _id: resource._id }, { $set: { status: 'Borrowed' } });
        }

        const approvalDate = new Date();
        const borrowDurationDays = borrow.borrow_duration_days || getBorrowDurationDays(borrow.borrow_date, borrow.due_date, resource.max_borrow_days || 1);
        const recalculatedDueDate = new Date(approvalDate);
        recalculatedDueDate.setDate(recalculatedDueDate.getDate() + borrowDurationDays);

        borrow.status = 'Active';
        borrow.approved_at = approvalDate;
        borrow.borrow_date = approvalDate;
        borrow.due_date = recalculatedDueDate;
        borrow.updated_at = approvalDate;
        try {
            await borrow.save();
        } catch (saveErr) {
            await ResourceModel.updateOne({ _id: resource._id }, { $inc: { available_quantity: 1 } });
            const rFix = await ResourceModel.findById(resource._id);
            if (rFix && rFix.available_quantity > 0 && rFix.status === 'Borrowed') {
                await ResourceModel.updateOne({ _id: resource._id }, { $set: { status: 'Available' } });
            }
            throw saveErr;
        }

        // Note: Deposit payment status is managed via Payments Management.

        // Update related reservations
        await ReservationModel.updateMany(
            { user_id: borrow.user_id._id, resource_id: borrow.resource_id._id, status: { $in: ['Pending', 'Confirmed'] } },
            { status: 'Completed', updated_at: Date.now() }
        );

        const pickupLoc = resource.location || 'IT Borrowing Hub - Lab 2';
        const cashExtra =
            borrow.payment_method === 'Cash'
                ? ` You selected Cash: please go to ${pickupLoc} for pickup / any on-site cash steps. | اخترت الدفع نقدًا: بعد موافقة الأدمن يرجى التوجّه إلى ${pickupLoc} لاستلام المادة أو إتمام الإجراءات في المركز.`
                : '';

        // Notify user (respect notification preferences)
        const borrowUserIdApproved = borrow.user_id?._id || borrow.user_id;
        if (borrowUserIdApproved && (await shouldSendInAppNotification(borrowUserIdApproved, 'borrowApproval'))) {
            await NotificationModel.create({
                user_id: borrowUserIdApproved,
                title: 'Borrow Approved',
                message: `Your borrow request for ${resource.name} has been approved. You can now go to the borrowing section at ${pickupLoc} to collect the device. Due: ${recalculatedDueDate.toLocaleDateString()}.${cashExtra}`,
                type: 'Success',
                related_type: 'Borrow',
                related_id: borrow._id
            });
        }

        // Email: notify user borrow was approved
        const approvedUser = borrow.user_id;
        if (approvedUser?.email) {
            const cashEmailBlock =
                borrow.payment_method === 'Cash'
                    ? `<p style="margin:16px 0;padding:12px;background:#e8f5e9;border-radius:8px;border:1px solid #4caf50;"><strong>Cash payment:</strong> Please go to <strong>${pickupLoc}</strong> to pick up the item and complete any on-site steps.<br/><strong>الدفع نقدًا:</strong> يرجى التوجّه إلى <strong>${pickupLoc}</strong> لاستلام المادة بعد موافقة الأدمن.</p>`
                    : '';
            await sendEmail({
                to: approvedUser.email,
                subject: 'Borrow Request Approved – UTAS Borrowing Hub',
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${approvedUser.full_name},</p>
                    <p>Great news! Your borrow request has been <strong style="color:#2e7d32;">approved</strong>.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${resource.name}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Pickup Location</td><td style="padding:6px;">${pickupLoc}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Due Date</td><td style="padding:6px;">${recalculatedDueDate.toLocaleDateString()}</td></tr>
                    </table>
                    ${cashEmailBlock}
                    <p>You can now go to the borrowing section at <strong>${pickupLoc}</strong> to collect your item.</p>
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({
            success: true,
            data: borrow,
            message: 'Borrow approved successfully'
        });
    } catch (error) {
        console.error('Approve borrow error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to approve borrow' 
        });
    }
});

// Mark an approved borrow as physically claimed / handed over
app.put("/admin/borrows/:id/claim", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const admin = await UserModel.findById(decoded.id);
        if (!admin || !['Admin', 'Assistant'].includes(admin.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const borrow = await BorrowModel.findById(req.params.id)
            .populate('resource_id')
            .populate('user_id');

        if (!borrow) {
            return res.status(404).json({ success: false, message: 'Borrow not found' });
        }

        if (borrow.status !== 'Approved') {
            return res.status(400).json({
                success: false,
                message: `Borrow is not awaiting physical collection. Current status: ${borrow.status}`
            });
        }

        const claimDate = new Date();
        const borrowDurationDays = borrow.borrow_duration_days || getBorrowDurationDays(borrow.borrow_date, borrow.due_date, borrow.resource_id?.max_borrow_days || 1);
        const recalculatedDueDate = new Date(claimDate);
        recalculatedDueDate.setDate(recalculatedDueDate.getDate() + borrowDurationDays);

        borrow.status = 'Claimed';
        borrow.borrow_date = claimDate;
        borrow.due_date = recalculatedDueDate;
        borrow.claimed_at = claimDate;
        borrow.updated_at = claimDate;
        await borrow.save();

        const pickupLoc = borrow.resource_id?.location || 'IT Borrowing Hub - Lab 2';
        const borrowUserId = borrow.user_id?._id || borrow.user_id;
        if (borrowUserId && (await shouldSendInAppNotification(borrowUserId, 'borrowApproval'))) {
            await NotificationModel.create({
                user_id: borrowUserId,
                title: 'Borrow Physically Claimed',
                message: `Your item "${borrow.resource_id?.name || 'resource'}" has been physically collected from ${pickupLoc}. Your due date is ${recalculatedDueDate.toLocaleDateString()}.`,
                type: 'Success',
                related_type: 'Borrow',
                related_id: borrow._id
            });
        }

        if (borrow.user_id?.email) {
            await sendEmail({
                to: borrow.user_id.email,
                subject: 'Borrow Collected – UTAS Borrowing Hub',
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${borrow.user_id.full_name},</p>
                    <p>Your item has been <strong>physically collected</strong> from the hub.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${borrow.resource_id?.name || 'N/A'}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Collection Location</td><td style="padding:6px;">${pickupLoc}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Borrow Start</td><td style="padding:6px;">${claimDate.toLocaleDateString()}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Due Date</td><td style="padding:6px;">${recalculatedDueDate.toLocaleDateString()}</td></tr>
                    </table>
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({
            success: true,
            data: borrow,
            message: 'Borrow marked as physically claimed successfully'
        });
    } catch (error) {
        console.error('Mark claimed error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to mark borrow as physically claimed'
        });
    }
});

// Reject pending borrow request (Admin/Assistant only)
app.put("/admin/borrows/:id/reject", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const admin = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(admin.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const borrow = await BorrowModel.findById(req.params.id)
            .populate('resource_id')
            .populate('user_id');

        if (!borrow) {
            return res.status(404).json({ 
                success: false,
                message: 'Borrow not found' 
            });
        }

        if (borrow.status !== 'PendingApproval') {
            return res.status(400).json({ 
                success: false,
                message: `Borrow is not pending approval. Current status: ${borrow.status}` 
            });
        }

        const { reason } = req.body;

        const refundInfo = await releaseLinkedDepositPayment(borrow.payment_id, admin._id, 'borrow request rejected');

        // Delete the borrow request
        await BorrowModel.findByIdAndDelete(req.params.id);

        // Notify user about rejection (respect notification preferences)
        const rejectUserId = borrow.user_id?._id || borrow.user_id;
        if (rejectUserId && (await shouldSendInAppNotification(rejectUserId, 'borrowRejection'))) {
            const refundNote =
                refundInfo.action === 'refunded'
                    ? ' Any confirmed security deposit has been marked as refunded in the system — staff will return it per UTAS procedures.'
                    : refundInfo.action === 'cancelled_pending'
                        ? ' Any pending deposit payment for this request has been cancelled in the system.'
                        : '';
            await NotificationModel.create({
                user_id: rejectUserId,
                title: 'Borrow Request Rejected',
                message: `Your borrow request for ${borrow.resource_id.name} has been rejected. ${reason ? `Reason: ${reason}` : ''}${refundNote}`,
                type: 'Error',
                related_type: 'Borrow',
                related_id: null
            });
        }

        // Email: notify user borrow was rejected
        const rejectedUser = borrow.user_id;
        if (rejectedUser?.email) {
            await sendEmail({
                to: rejectedUser.email,
                subject: 'Borrow Request Rejected – UTAS Borrowing Hub',
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${rejectedUser.full_name},</p>
                    <p>Unfortunately, your borrow request has been <strong style="color:#c62828;">rejected</strong>.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${borrow.resource_id.name}</td></tr>
                      ${reason ? `<tr><td style="padding:6px;color:#555;">Reason</td><td style="padding:6px;">${reason}</td></tr>` : ''}
                    </table>
                    ${refundInfo.action === 'refunded' ? '<p><strong>Deposit:</strong> If you already paid a security deposit and it was confirmed, it is now marked as <strong>refunded</strong> in the system. Please contact the hub to collect your refund if applicable.</p>' : ''}
                    ${refundInfo.action === 'cancelled_pending' ? '<p><strong>Deposit:</strong> Any pending payment record for this borrow request has been cancelled — you do not need to complete that payment.</p>' : ''}
                    <p>If you have questions, please contact the admin team.</p>
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({
            success: true,
            refundInfo,
            message: 'Borrow request rejected successfully'
        });
    } catch (error) {
        console.error('Reject borrow error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to reject borrow' 
        });
    }
});

// Reject reservation request (Admin/Assistant only)
app.put("/admin/reservations/:id/reject", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const admin = await UserModel.findById(decoded.id);

        if (!['Admin', 'Assistant'].includes(admin.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const reservation = await ReservationModel.findById(req.params.id)
            .populate('resource_id')
            .populate('user_id');

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: 'Reservation not found'
            });
        }

        if (!['Pending', 'Confirmed'].includes(reservation.status)) {
            return res.status(400).json({
                success: false,
                message: `Reservation cannot be rejected. Current status: ${reservation.status}`
            });
        }

        const { reason } = req.body;
        const wasConfirmed = reservation.status === 'Confirmed';

        if (wasConfirmed) {
            const resource = await ResourceModel.findById(reservation.resource_id?._id || reservation.resource_id);
            if (resource) {
                resource.available_quantity = Math.min(
                    resource.total_quantity || 1,
                    resource.available_quantity + 1
                );
                if (resource.status === 'Reserved' && resource.available_quantity > 0) {
                    resource.status = 'Available';
                }
                await resource.save();
            }
        }

        const refundInfo = await releaseLinkedDepositPayment(reservation.payment_id, admin._id, 'reservation rejected by admin');

        reservation.status = 'Cancelled';
        reservation.updated_at = new Date();
        if (reason) {
            reservation.notes = [reservation.notes, `Admin rejection reason: ${reason}`].filter(Boolean).join(' | ');
        }
        await reservation.save();

        const reservationUserId = reservation.user_id?._id || reservation.user_id;
        if (reservationUserId && (await shouldSendInAppNotification(reservationUserId, 'reservationConfirmation'))) {
            const refundNote =
                refundInfo.action === 'refunded'
                    ? ' Any confirmed security deposit has been marked as refunded in the system.'
                    : refundInfo.action === 'cancelled_pending'
                        ? ' Any pending deposit payment for this reservation has been cancelled in the system.'
                        : '';

            await NotificationModel.create({
                user_id: reservationUserId,
                title: 'Reservation Rejected',
                message: `Your reservation for ${reservation.resource_id?.name || 'the selected resource'} has been rejected by admin.${reason ? ` Reason: ${reason}.` : ''}${refundNote}`,
                type: 'Error',
                related_type: 'Reservation',
                related_id: reservation._id
            });
        }

        const rejectedUser = reservation.user_id;
        if (rejectedUser?.email) {
            const refundEmailNote =
                refundInfo.action === 'refunded'
                    ? '<p>Your confirmed security deposit has been marked as <strong>refunded</strong> in the system.</p>'
                    : refundInfo.action === 'cancelled_pending'
                        ? '<p>Your pending security deposit payment request has been <strong>cancelled</strong> in the system.</p>'
                        : '';

            await sendEmail({
                to: rejectedUser.email,
                subject: 'Reservation Rejected – UTAS Borrowing Hub',
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${rejectedUser.full_name},</p>
                    <p>Unfortunately, your reservation request has been <strong style="color:#c62828;">rejected</strong>.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${reservation.resource_id?.name || 'N/A'}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Pickup Date</td><td style="padding:6px;">${new Date(reservation.pickup_date).toLocaleDateString()}</td></tr>
                      ${reason ? `<tr><td style="padding:6px;color:#555;">Reason</td><td style="padding:6px;">${reason}</td></tr>` : ''}
                    </table>
                    ${refundEmailNote}
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({
            success: true,
            data: reservation,
            refundInfo,
            message: 'Reservation rejected successfully'
        });
    } catch (error) {
        console.error('Reject reservation error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to reject reservation'
        });
    }
});

// Cancel a borrower's return request (no inventory change — item still on loan)
app.put("/admin/borrows/:id/cancel-pending-return", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const admin = await UserModel.findById(decoded.id);

        if (!['Admin', 'Assistant'].includes(admin.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const borrow = await BorrowModel.findById(req.params.id).populate('resource_id').populate('user_id');
        if (!borrow) {
            return res.status(404).json({ success: false, message: 'Borrow not found' });
        }

        if (borrow.status !== 'PendingReturn') {
            return res.status(400).json({
                success: false,
                message: `No pending return to cancel. Current status: ${borrow.status}`
            });
        }

        const pastDue = borrow.due_date && new Date(borrow.due_date) < new Date();
        const activeStatus = borrow.claimed_at ? 'Claimed' : 'Active';
        borrow.status = pastDue ? 'Overdue' : activeStatus;
        borrow.return_requested_at = null;
        borrow.updated_at = new Date();
        await borrow.save();

        const uid = borrow.user_id?._id || borrow.user_id;
        if (uid && (await shouldSendInAppNotification(uid, 'borrowApproval'))) {
            await NotificationModel.create({
                user_id: uid,
                title: 'Return request cancelled',
                message: `Your return request for "${borrow.resource_id?.name || 'the resource'}" was cancelled by staff. The item remains on your loan — please contact the hub if you have questions.`,
                type: 'Warning',
                related_type: 'Borrow',
                related_id: borrow._id
            });
        }

        res.status(200).json({
            success: true,
            data: borrow,
            message: 'Pending return cancelled; borrow set back to active/overdue.'
        });
    } catch (error) {
        console.error('Cancel pending return error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to cancel pending return'
        });
    }
});

// Delete borrow record (Admin/Assistant only)
app.delete("/admin/borrows/:id", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const admin = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(admin.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const borrow = await BorrowModel.findById(req.params.id)
            .populate('resource_id')
            .populate('user_id');

        if (!borrow) {
            return res.status(404).json({ 
                success: false,
                message: 'Borrow not found' 
            });
        }

        // If borrow still held a copy (including user-submitted return not yet confirmed), restore inventory
        if (BORROW_OUT_STATUSES.includes(borrow.status)) {
            const resource = await ResourceModel.findById(borrow.resource_id._id);
            if (resource) {
                resource.available_quantity = Math.min(
                    resource.total_quantity || 1,
                    resource.available_quantity + 1
                );
                if (resource.status === 'Borrowed' && resource.available_quantity > 0) {
                    resource.status = 'Available';
                }
                await resource.save();
            }
        }

        if (borrow.status === 'PendingApproval' && borrow.payment_id) {
            await releaseLinkedDepositPayment(borrow.payment_id, admin._id, 'borrow record deleted by admin');
        }

        // Delete the borrow
        await BorrowModel.findByIdAndDelete(req.params.id);

        res.status(200).json({ 
            success: true,
            message: 'Borrow record deleted successfully' 
        });
    } catch (error) {
        console.error('Delete borrow error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to delete borrow' 
        });
    }
});

// ==================== NOTIFICATIONS ROUTES ====================

app.get("/notifications", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const { is_read, type, limit = 50 } = req.query;
        const query = { user_id: decoded.id };
        
        if (is_read !== undefined) query.is_read = is_read === 'true';
        if (type) query.type = type;

        const notifications = await NotificationModel.find(query)
            .sort({ created_at: -1 })
            .limit(parseInt(limit));

        const unreadCount = await NotificationModel.countDocuments({ 
            user_id: decoded.id, 
            is_read: false 
        });

        res.send({
            success: true,
            data: notifications,
            unreadCount
        });
    } catch (error) {
        res.send(error);
    }
});

app.put("/notifications/:id/read", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const notification = await NotificationModel.findOne({
            _id: req.params.id,
            user_id: decoded.id
        });

        if (!notification) {
            return res.status(500).json({ message: "Notification not found" });
        }

        notification.is_read = true;
        notification.read_at = new Date();
        await notification.save();

        res.send({ success: true, data: notification });
    } catch (error) {
        res.send(error);
    }
});

// ==================== PENALTIES ROUTES ====================

app.get("/penalties/my-penalties", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const { status } = req.query;
        const query = { user_id: decoded.id };
        
        if (status) query.status = status === 'Claimed' ? { $in: ['Claimed', 'Active'] } : status;

        const penalties = await PenaltyModel.find(query)
            .populate({
                path: 'borrow_id',
                select: 'resource_id due_date return_date status',
                populate: {
                    path: 'resource_id',
                    select: 'name category department'
                }
            })
            .sort({ created_at: -1 });

        res.json({ success: true, data: penalties });
    } catch (error) {
        res.send(error);
    }
});

app.get("/penalties", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(500).json({ message: "Not authorized" });
        }

        const { status, user_id, penalty_type } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (user_id) query.user_id = user_id;
        if (penalty_type) query.penalty_type = penalty_type;

        const penalties = await PenaltyModel.find(query)
            .populate('user_id', 'full_name email student_id')
            .populate({
                path: 'borrow_id',
                select: 'resource_id due_date return_date status',
                populate: {
                    path: 'resource_id',
                    select: 'name category department'
                }
            })
            .sort({ created_at: -1 });

        res.send(penalties);
    } catch (error) {
        res.send(error);
    }
});

app.get("/admin/penalties", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { status, penalty_type, search, page = 1, limit = 20 } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (penalty_type) query.penalty_type = penalty_type;
        if (search) {
            query.$or = [
                { 'user_id.full_name': { $regex: search, $options: 'i' } },
                { 'user_id.email': { $regex: search, $options: 'i' } },
                { 'user_id.student_id': { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const penalties = await PenaltyModel.find(query)
            .populate('user_id', 'full_name email student_id phone')
            .populate({
                path: 'borrow_id',
                select: 'resource_id due_date return_date status',
                populate: {
                    path: 'resource_id',
                    select: 'name category department'
                }
            })
            .populate('borrow_id.resource_id', 'name category')
            .populate('waived_by', 'full_name email')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ created_at: -1 });

        const total = await PenaltyModel.countDocuments(query);

        res.status(200).json({
            success: true,
            data: penalties,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get penalties error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch penalties' });
    }
});

app.put("/penalties/:id/waive", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(500).json({ message: "Not authorized" });
        }

        const { waived_reason } = req.body;
        const penalty = await PenaltyModel.findById(req.params.id);

        if (!penalty) {
            return res.status(500).json({ message: "Penalty not found" });
        }

        if (penalty.status !== 'Pending') {
            return res.status(500).json({ message: "Only pending penalties can be waived" });
        }

        penalty.status = 'Waived';
        penalty.waived_by = user._id;
        penalty.waived_reason = waived_reason || 'Waived by administrator';
        await penalty.save();

        const penaltyUserId = penalty.user_id?._id || penalty.user_id;
        if (penaltyUserId && (await shouldSendInAppNotification(penaltyUserId, 'penalty'))) {
            await NotificationModel.create({
                user_id: penaltyUserId,
                title: 'Penalty Waived',
                message: `Your penalty of ${penalty.fine_amount} OMR has been waived. Reason: ${penalty.waived_reason}`,
                type: 'Success',
                related_type: 'Penalty',
                related_id: penalty._id
            });
        }

        res.send({ success: true, data: penalty });
    } catch (error) {
        res.send(error);
    }
});

app.put("/admin/penalties/:id/status", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { status, waived_reason } = req.body;
        const penalty = await PenaltyModel.findById(req.params.id);

        if (!penalty) {
            return res.status(404).json({ message: 'Penalty not found' });
        }

        if (!['Pending', 'Paid', 'Waived', 'Cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const oldStatus = penalty.status;
        penalty.status = status;
        penalty.updated_at = Date.now();

        if (status === 'Waived') {
            penalty.waived_by = user._id;
            penalty.waived_reason = waived_reason || 'Waived by administrator';
            const pid = penalty.user_id?._id || penalty.user_id;
            if (pid && (await shouldSendInAppNotification(pid, 'penalty'))) {
                await NotificationModel.create({
                    user_id: pid,
                    title: 'Penalty Waived',
                    message: `Your penalty of ${penalty.fine_amount} OMR has been waived. Reason: ${penalty.waived_reason}`,
                    type: 'Success',
                    related_type: 'Penalty',
                    related_id: penalty._id
                });
            }
        } else if (status === 'Paid' && oldStatus === 'Pending') {
            penalty.paid_at = new Date();
        }

        await penalty.save();

        res.status(200).json({ 
            success: true, 
            data: penalty,
            message: `Penalty status updated to ${status}` 
        });
    } catch (error) {
        console.error('Update penalty status error:', error);
        res.status(500).json({ message: error.message || 'Failed to update penalty status' });
    }
});

// ==================== PAYMENTS ROUTES ====================

app.post("/payments", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        const { penalty_id, amount, payment_method, transaction_id, notes, card_details } = req.body;

        const penalty = await PenaltyModel.findById(penalty_id);
        if (!penalty) {
            return res.status(500).json({ message: "Penalty not found" });
        }

        if (penalty.user_id.toString() !== user._id.toString()) {
            return res.status(500).json({ message: "Not authorized to pay this penalty" });
        }

        if (penalty.status !== 'Pending') {
            return res.status(500).json({ message: "Penalty is not pending payment" });
        }

        if (amount < penalty.fine_amount) {
            return res.status(500).json({ message: `Payment amount must be at least ${penalty.fine_amount} OMR` });
        }

        // Prepare payment data
        const paymentData = {
            user_id: user._id,
            penalty_id,
            amount,
            payment_method,
            transaction_id: transaction_id || undefined,
            notes: notes || undefined,
            status: payment_method === 'Online' ? 'Pending' : 'Completed',
            processed_by: payment_method !== 'Online' ? user._id : null
        };

        // Add card details if payment method is Card
        if (payment_method === 'Card') {
            const cardValidation = validateCardPayload(card_details);
            if (!cardValidation.valid) {
                return res.status(400).json({ message: cardValidation.message });
            }

            const normalizedCard = cardValidation.normalized;
            // Store only last 4 digits for security (don't store full card number)
            const cardNumber = normalizedCard.card_number || '';
            paymentData.card_last4 = cardNumber.length >= 4 ? cardNumber.slice(-4) : '';
            paymentData.card_holder = normalizedCard.card_holder || '';
            paymentData.card_expiry = normalizedCard.expiry_date || '';
            // Never store CVV - it's only for transaction processing
        }

        const newPayment = new PaymentModel(paymentData);
        await newPayment.save();

        if (newPayment.status === 'Completed') {
            penalty.status = 'Paid';
            penalty.paid_at = new Date();
            await penalty.save();

            await NotificationModel.create({
                user_id: user._id,
                title: 'Payment Received',
                message: `Your payment of ${amount} OMR has been received successfully.`,
                type: 'Success',
                related_type: 'Payment',
                related_id: newPayment._id
            });
        }

        res.status(200).json({ success: true, data: newPayment, message: "Success" });
    } catch (error) {
        res.send(error);
    }
});

app.get("/payments/my-payments", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const { status } = req.query;
        const query = { user_id: decoded.id };
        
        if (status) query.status = status;

        const payments = await PaymentModel.find(query)
            .populate('penalty_id', 'fine_amount penalty_type description')
            .populate('resource_id', 'name location')
            .sort({ created_at: -1 });

        res.json({ success: true, data: payments });
    } catch (error) {
        res.send(error);
    }
});

app.get("/admin/payments", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { status, payment_method, search, page = 1, limit = 20 } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (payment_method) query.payment_method = payment_method;
        if (search) {
            query.$or = [
                { 'user_id.full_name': { $regex: search, $options: 'i' } },
                { 'user_id.email': { $regex: search, $options: 'i' } },
                { 'user_id.student_id': { $regex: search, $options: 'i' } },
                { transaction_id: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        const payments = await PaymentModel.find(query)
            .populate('user_id', 'full_name email student_id phone')
            .populate('penalty_id', 'fine_amount penalty_type description')
            .populate('processed_by', 'full_name email')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ created_at: -1 });

        const total = await PaymentModel.countDocuments(query);

        res.status(200).json({
            success: true,
            data: payments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch payments' });
    }
});

// Allow user to complete a pending deposit/payment online (for Resource/Reservation payments)
app.post("/payments/:id/pay-deposit", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        const { payment_method, transaction_id, notes, card_details } = req.body;
        const payment = await PaymentModel.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        if (payment.user_id.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to pay this record' });
        }

        if (payment.status !== 'Pending') {
            return res.status(400).json({ message: 'Payment is not pending' });
        }

        const effectiveMethod = payment_method || payment.payment_method;
        if (payment.payment_method && effectiveMethod && effectiveMethod !== payment.payment_method) {
            return res.status(400).json({
                message: 'Payment method must match what you selected when creating the borrow/reservation (Cash or Card).'
            });
        }
        if (effectiveMethod === 'Card' && (!card_details || !card_details.card_number)) {
            return res.status(400).json({ message: 'Card details are required when paying by card.' });
        }
        if (effectiveMethod === 'Cash' && card_details?.card_number) {
            return res.status(400).json({ message: 'Do not send card details for cash payments.' });
        }

        let normalizedCard = null;
        if (effectiveMethod === 'Card') {
            const cardValidation = validateCardPayload(card_details);
            if (!cardValidation.valid) {
                return res.status(400).json({ message: cardValidation.message });
            }
            normalizedCard = cardValidation.normalized;
        }

        // Update basic payment info
        if (payment_method) {
            payment.payment_method = payment_method;
        }
        if (transaction_id) {
            payment.transaction_id = transaction_id;
        }
        if (notes) {
            payment.notes = notes;
        }

        // Store limited card details if provided
        if (normalizedCard?.card_number) {
            const cardNumber = normalizedCard.card_number || '';
            payment.card_last4 = cardNumber.length >= 4 ? cardNumber.slice(-4) : '';
            payment.card_holder = normalizedCard.card_holder || '';
            payment.card_expiry = normalizedCard.expiry_date || '';
        }

        payment.status = 'Completed';
        payment.processed_by = user._id;
        payment.updated_at = Date.now();

        // If this payment is linked to a penalty, mark it as paid
        if (payment.penalty_id) {
            const penalty = await PenaltyModel.findById(payment.penalty_id);
            if (penalty && penalty.status === 'Pending') {
                penalty.status = 'Paid';
                penalty.paid_at = new Date();
                await penalty.save();
            }
        }

        // If this payment is for a deposit, mark the related borrow/reservation as paid
        let relatedBorrow = null;
        let relatedReservation = null;
        if (payment.payment_type === 'Resource') {
            relatedBorrow = await BorrowModel.findOne({ payment_id: payment._id })
                .populate('resource_id', 'name location')
                .populate('user_id', 'full_name email');
            if (relatedBorrow) {
                relatedBorrow.payment_status = 'Paid';
                relatedBorrow.updated_at = Date.now();
                await relatedBorrow.save();
            }
        } else if (payment.payment_type === 'Reservation') {
            relatedReservation = await ReservationModel.findOne({ payment_id: payment._id })
                .populate('resource_id', 'name location')
                .populate('user_id', 'full_name email');
            if (relatedReservation) {
                relatedReservation.payment_status = 'Paid';
                relatedReservation.updated_at = Date.now();
                await relatedReservation.save();
            }
        }

        await payment.save();

        if (payment.payment_type === 'Resource' && relatedBorrow) {
            const admins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
            const resourceName = relatedBorrow.resource_id?.name || 'resource';
            const borrowerName = relatedBorrow.user_id?.full_name || user.full_name;
            const borrowerEmail = relatedBorrow.user_id?.email || user.email;
            const pickupLocation = relatedBorrow.resource_id?.location || 'IT Borrowing Hub - Lab 2';

            for (const admin of admins) {
                if (await shouldSendInAppNotification(admin._id, 'borrowApproval')) {
                    await NotificationModel.create({
                        user_id: admin._id,
                        title: 'Borrow Payment Completed',
                        message: `${borrowerName} (${borrowerEmail}) completed the ${payment.payment_method} deposit payment for "${resourceName}". The borrow request is now ready for your review and approval.`,
                        type: 'Info',
                        related_type: 'Borrow',
                        related_id: relatedBorrow._id
                    });
                }

                if (admin.email) {
                    await sendEmail({
                        to: admin.email,
                        subject: `Borrow payment completed – ${resourceName} – UTAS Borrowing Hub`,
                        html: `<div style="${emailStyle}">${emailHeader}
                          <div style="padding:24px;">
                            <p>Dear ${admin.full_name},</p>
                            <p>The deposit payment for a borrow request has been completed and is ready for approval.</p>
                            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                              <tr><td style="padding:6px;color:#555;">User</td><td style="padding:6px;font-weight:bold;">${borrowerName} (${borrowerEmail})</td></tr>
                              <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;">${resourceName}</td></tr>
                              <tr><td style="padding:6px;color:#555;">Deposit</td><td style="padding:6px;">${payment.amount} OMR via ${payment.payment_method}</td></tr>
                              <tr><td style="padding:6px;color:#555;">Pickup Location</td><td style="padding:6px;">${pickupLocation}</td></tr>
                            </table>
                            <p>Please review the borrow request in Borrow Management.</p>
                          </div>${emailFooter}</div>`
                    });
                }
            }
        }

        if (payment.payment_type === 'Reservation' && relatedReservation) {
            const admins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
            const resourceName = relatedReservation.resource_id?.name || 'resource';
            const reserverName = relatedReservation.user_id?.full_name || user.full_name;
            const reserverEmail = relatedReservation.user_id?.email || user.email;
            const pickupLocation = relatedReservation.resource_id?.location || 'IT Borrowing Hub - Lab 2';

            for (const admin of admins) {
                if (await shouldSendInAppNotification(admin._id, 'reservationConfirmation')) {
                    await NotificationModel.create({
                        user_id: admin._id,
                        title: 'Reservation Payment Completed',
                        message: `${reserverName} (${reserverEmail}) completed the ${payment.payment_method} deposit payment for reservation "${resourceName}". The reservation is now ready for your review and approval.`,
                        type: 'Info',
                        related_type: 'Reservation',
                        related_id: relatedReservation._id
                    });
                }

                if (admin.email) {
                    await sendEmail({
                        to: admin.email,
                        subject: `Reservation payment completed – ${resourceName} – UTAS Borrowing Hub`,
                        html: `<div style="${emailStyle}">${emailHeader}
                          <div style="padding:24px;">
                            <p>Dear ${admin.full_name},</p>
                            <p>The deposit payment for a reservation has been completed and is ready for approval.</p>
                            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                              <tr><td style="padding:6px;color:#555;">User</td><td style="padding:6px;font-weight:bold;">${reserverName} (${reserverEmail})</td></tr>
                              <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;">${resourceName}</td></tr>
                              <tr><td style="padding:6px;color:#555;">Deposit</td><td style="padding:6px;">${payment.amount} OMR via ${payment.payment_method}</td></tr>
                              <tr><td style="padding:6px;color:#555;">Pickup Location</td><td style="padding:6px;">${pickupLocation}</td></tr>
                            </table>
                            <p>Please review the reservation in Reservations Management.</p>
                          </div>${emailFooter}</div>`
                    });
                }
            }
        }

        await NotificationModel.create({
            user_id: user._id,
            title: 'Payment Confirmed',
            message: `Your payment of ${payment.amount} OMR has been confirmed.`,
            type: 'Success',
            related_type: 'Payment',
            related_id: payment._id
        });

        res.status(200).json({
            success: true,
            data: payment,
            message: 'Payment completed successfully'
        });
    } catch (error) {
        console.error('Pay deposit error:', error);
        res.status(500).json({ message: error.message || 'Failed to complete payment' });
    }
});

app.put("/admin/payments/:id/status", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { status, notes } = req.body;
        const payment = await PaymentModel.findById(req.params.id)
            .populate('penalty_id');

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        if (!['Pending', 'Completed', 'Failed', 'Refunded'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const oldStatus = payment.status;
        payment.status = status;
        payment.updated_at = Date.now();
        payment.processed_by = user._id;

        if (notes) {
            payment.notes = notes;
        }

        if (status === 'Completed' && oldStatus === 'Pending') {
            // Update penalty status to Paid
            if (payment.penalty_id && payment.penalty_id.status === 'Pending') {
                payment.penalty_id.status = 'Paid';
                payment.penalty_id.paid_at = new Date();
                await payment.penalty_id.save();

                await NotificationModel.create({
                    user_id: payment.user_id,
                    title: 'Payment Confirmed',
                    message: `Your payment of ${payment.amount} OMR has been confirmed.`,
                    type: 'Success',
                    related_type: 'Payment',
                    related_id: payment._id
                });
            }

            // If this is a security deposit, mark the related borrow/reservation deposit as paid
            if (payment.payment_type === 'Resource') {
                const relatedBorrow = await BorrowModel.findOne({ payment_id: payment._id });
                if (relatedBorrow) {
                    relatedBorrow.payment_status = 'Paid';
                    relatedBorrow.updated_at = Date.now();
                    await relatedBorrow.save();
                }
            } else if (payment.payment_type === 'Reservation') {
                const relatedReservation = await ReservationModel.findOne({ payment_id: payment._id });
                if (relatedReservation) {
                    relatedReservation.payment_status = 'Paid';
                    relatedReservation.updated_at = Date.now();
                    await relatedReservation.save();
                }
            }
        } else if (status === 'Failed' && oldStatus === 'Completed') {
            // Revert penalty status if payment failed
            if (payment.penalty_id && payment.penalty_id.status === 'Paid') {
                payment.penalty_id.status = 'Pending';
                payment.penalty_id.paid_at = null;
                await payment.penalty_id.save();
            }
        } else if (status === 'Refunded' && oldStatus === 'Completed') {
            if (payment.penalty_id && payment.penalty_id.status === 'Paid') {
                payment.penalty_id.status = 'Pending';
                payment.penalty_id.paid_at = null;
                await payment.penalty_id.save();

                await NotificationModel.create({
                    user_id: payment.user_id,
                    title: 'Payment Refunded',
                    message: `Your payment of ${payment.amount} OMR has been refunded.`,
                    type: 'Info',
                    related_type: 'Payment',
                    related_id: payment._id
                });
            } else if (['Resource', 'Reservation'].includes(payment.payment_type)) {
                const uid = payment.user_id;
                if (uid && (await shouldSendInAppNotification(uid, payment.payment_type === 'Reservation' ? 'reservationConfirmation' : 'borrowApproval'))) {
                    await NotificationModel.create({
                        user_id: uid,
                        title: 'Security deposit refunded',
                        message: `Your security deposit of ${payment.amount} OMR has been marked as refunded in the system. Contact the hub if you have questions.`,
                        type: 'Success',
                        related_type: 'Payment',
                        related_id: payment._id
                    });
                }
            }
        }

        await payment.save();

        res.status(200).json({ 
            success: true, 
            data: payment,
            message: `Payment status updated to ${status}` 
        });
    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({ message: error.message || 'Failed to update payment status' });
    }
});

// ==================== ADMIN ROUTES ====================

app.get("/admin/dashboard", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(500).json({ message: "Not authorized" });
        }

        const [totalUsers, totalResources, activeBorrows, pendingReservations, overdueBorrows, pendingPenalties, totalRevenue, recentBorrows, availableResourcesAgg, maintenanceResources, returnedBorrows] = await Promise.all([
            UserModel.countDocuments(),
            ResourceModel.countDocuments(),
            BorrowModel.countDocuments({ status: { $in: ['Claimed', 'Active'] } }),
            ReservationModel.countDocuments({ status: { $in: ['Pending', 'Confirmed'] } }),
            BorrowModel.countDocuments({ status: 'Overdue' }),
            PenaltyModel.countDocuments({ status: 'Pending' }),
            PaymentModel.aggregate([
                { $match: { status: 'Completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            BorrowModel.find({ status: { $in: ['Claimed', 'Active'] } })
                .populate('user_id', 'full_name email')
                .populate('resource_id', 'name category')
                .sort({ borrow_date: -1 })
                .limit(10),
            ResourceModel.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $ifNull: ['$available_quantity', 0] } }
                    }
                }
            ]),
            ResourceModel.countDocuments({ status: 'Maintenance' }),
            BorrowModel.countDocuments({ status: 'Returned' })
        ]);

        const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;
        const availableResources = availableResourcesAgg.length > 0 ? availableResourcesAgg[0].total : 0;

        const resourcesByCategory = await ResourceModel.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        const borrowsByStatus = await BorrowModel.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const penaltiesByType = await PenaltyModel.aggregate([
            { $group: { _id: '$penalty_type', count: { $sum: 1 }, totalAmount: { $sum: '$fine_amount' } } }
        ]);

        res.json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    totalResources,
                    activeBorrows,
                    pendingReservations,
                    overdueBorrows,
                    pendingPenalties,
                    totalRevenue: revenue,
                    availableResources,
                    maintenanceResources,
                    returnedBorrows
                },
                charts: {
                    resourcesByCategory,
                    borrowsByStatus,
                    penaltiesByType
                },
                recentBorrows
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to load dashboard data' 
        });
    }
});

app.get("/admin/users", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(500).json({ message: "Not authorized" });
        }

        const { role, status, search, page = 1, limit = 20 } = req.query;
        const query = {};
        
        if (role) query.role = role;
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { full_name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { student_id: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await UserModel.find(query)
            .select('-password')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ created_at: -1 });

        const total = await UserModel.countDocuments(query);

        res.send({
            success: true,
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.send(error);
    }
});

// Delete user (Admin only)
app.delete("/admin/users/:id", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const currentUser = await UserModel.findById(decoded.id);

        if (!currentUser || currentUser.role !== 'Admin') {
            return res.status(403).json({ message: 'Only Admin can delete users' });
        }

        // Prevent deleting own account via API (frontend also guards this)
        if (req.params.id === String(currentUser._id)) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }

        const userToDelete = await UserModel.findById(req.params.id);
        if (!userToDelete) {
            return res.status(404).json({ message: 'User not found' });
        }

        await UserModel.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete user'
        });
    }
});

app.put("/admin/users/:id/status", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { status, role } = req.body;
        const updateData = { updated_at: Date.now() };
        
        if (status) {
            if (!['Active', 'Inactive', 'Suspended'].includes(status)) {
                return res.status(400).json({ message: "Invalid status" });
            }
            updateData.status = status;
        }
        
        if (role) {
            if (!['Admin', 'Assistant', 'Staff', 'Student'].includes(role)) {
                return res.status(400).json({ message: "Invalid role" });
            }
            updateData.role = role;
        }

        const updatedUser = await UserModel.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ 
            success: true, 
            data: updatedUser,
            message: "User updated successfully"
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ 
            message: error.message || 'Failed to update user' 
        });
    }
});

app.get("/admin/borrows", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { status, search, page = 1, limit = 20 } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { 'user_id.full_name': { $regex: search, $options: 'i' } },
                { 'user_id.email': { $regex: search, $options: 'i' } },
                { 'resource_id.name': { $regex: search, $options: 'i' } }
            ];
        }

        const borrows = await BorrowModel.find(query)
            .populate('user_id', 'full_name email student_id phone')
            .populate('resource_id', 'name category barcode qr_code')
            .populate('checked_out_by', 'full_name')
            .populate('checked_in_by', 'full_name')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ borrow_date: -1 });

        // Get penalties for each borrow
        const borrowIds = borrows.map(b => b._id);
        const penalties = await PenaltyModel.find({ borrow_id: { $in: borrowIds } })
            .select('borrow_id fine_amount status');
        
        // Create a map of borrow_id to penalty
        const penaltyMap = {};
        penalties.forEach(p => {
            penaltyMap[p.borrow_id.toString()] = p;
        });

        // Add penalty info to each borrow
        const borrowsWithPenalties = borrows.map(borrow => {
            const penalty = penaltyMap[borrow._id.toString()];
            return {
                ...borrow.toObject(),
                penalty: penalty || null
            };
        });

        const total = await BorrowModel.countDocuments(query);

        res.status(200).json({
            success: true,
            data: borrowsWithPenalties,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get borrows error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch borrows' });
    }
});

app.get("/admin/borrows/overdue", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(500).json({ message: "Not authorized" });
        }

        const borrows = await BorrowModel.find({
            status: { $in: ['Claimed', 'Active', 'Overdue', 'PendingReturn'] },
            due_date: { $lt: new Date() }
        })
            .populate('user_id', 'full_name email student_id phone')
            .populate('resource_id', 'name category')
            .sort({ due_date: 1 });

        res.send(borrows);
    } catch (error) {
        res.send(error);
    }
});

// ==================== OVERDUE BORROW SCHEDULER ====================

/**
 * Find all active borrows whose due date has passed and:
 * - mark them as Overdue
 * - send a due-date reminder notification to the user (respecting preferences)
 */
async function runOverdueBorrowCheck() {
    try {
        const now = new Date();

        const borrows = await BorrowModel.find({
            status: { $in: ['Claimed', 'Active'] },
            return_date: null,
            due_date: { $lt: now }
        }).select('_id user_id resource_id due_date status');

        if (!borrows.length) {
            return;
        }

        for (const b of borrows) {
            // Update status to Overdue
            b.status = 'Overdue';
            b.updated_at = new Date();
            await b.save();

            // Load resource name for nicer message
            const resource = await ResourceModel.findById(b.resource_id).select('name');
            const title = 'Borrow overdue';
            const message = `Your borrow for "${resource?.name || 'resource'}" is now overdue. Due date was ${b.due_date.toLocaleDateString()}. Please return it as soon as possible.`;

            if (await shouldSendInAppNotification(b.user_id, 'dueDateReminder')) {
                // Avoid sending duplicate overdue reminders for the same borrow
                const existing = await NotificationModel.findOne({
                    user_id: b.user_id,
                    related_type: 'Borrow',
                    related_id: b._id,
                    type: 'Reminder'
                }).select('_id');

                if (!existing) {
                    await NotificationModel.create({
                        user_id: b.user_id,
                        title,
                        message,
                        type: 'Reminder',
                        related_type: 'Borrow',
                        related_id: b._id
                    });
                }
            }
        }
    } catch (err) {
        console.error('Overdue borrow check failed:', err);
    }
}

// ==================== UPDATE PROFILE ====================

app.put("/profile", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const { full_name, phone, department, avatar } = req.body;

        if (full_name !== undefined && full_name !== null) {
            const fn = String(full_name).trim();
            if (!fn) {
                return res.status(400).json({
                    success: false,
                    message: 'Full name is required.'
                });
            }
            if (
                /\d/.test(fn) ||
                !/^[A-Za-z\s-]+$/.test(fn) ||
                !/^[A-Za-z]/.test(fn) ||
                !/[A-Za-z]$/.test(fn)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Letters only (English); spaces and hyphen (-) allowed. No numbers or other symbols. Must start and end with a letter.'
                });
            }
        }

        const updatePayload = {
            department,
            avatar,
            updated_at: Date.now()
        };
        if (full_name !== undefined && full_name !== null) {
            updatePayload.full_name = String(full_name).trim();
        }
        if (phone !== undefined) {
            const p = String(phone == null ? '' : phone).trim();
            if (!p) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone is required.'
                });
            }
            if (!/^[79]\d{7}$/.test(p)) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone must be exactly 8 digits and start with 7 or 9 (e.g. 91234567).'
                });
            }
            updatePayload.phone = p;
        }

        const user = await UserModel.findByIdAndUpdate(
            decoded.id,
            updatePayload,
            { new: true }
        ).select('-password');

        res.send({ success: true, user });
    } catch (error) {
        res.send(error);
    }
});

// ==================== NOTIFICATION SETTINGS (Customizable Notifications) ====================
const NOTIFICATION_PREFERENCE_KEYS = ['borrowApproval', 'borrowRejection', 'dueDateReminder', 'reservationConfirmation', 'reservationAvailable', 'penalty'];

const getDefaultNotificationPreferences = () => ({
    borrowApproval: { inApp: true, email: true },
    borrowRejection: { inApp: true, email: true },
    dueDateReminder: { inApp: true, email: true },
    reservationConfirmation: { inApp: true, email: true },
    reservationAvailable: { inApp: true, email: true },
    penalty: { inApp: true, email: true }
});

async function shouldSendInAppNotification(userId, preferenceKey) {
    const u = await UserModel.findById(userId).select('notificationPreferences');
    const def = getDefaultNotificationPreferences();
    const prefs = u?.notificationPreferences && typeof u.notificationPreferences === 'object'
        ? { ...def, ...u.notificationPreferences } : def;
    const p = prefs[preferenceKey];
    return !p || p.inApp !== false;
}

app.get("/profile/notification-settings", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Not authorized' });
        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id).select('notificationPreferences');
        if (!user) return res.status(404).json({ message: 'User not found' });
        const prefs = user.notificationPreferences && typeof user.notificationPreferences === 'object'
            ? { ...getDefaultNotificationPreferences(), ...user.notificationPreferences }
            : getDefaultNotificationPreferences();
        res.json({ success: true, data: prefs });
    } catch (error) {
        console.error('Get notification settings error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to load notification settings' });
    }
});

app.put("/profile/notification-settings", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Not authorized' });
        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const body = req.body || {};
        const defaults = getDefaultNotificationPreferences();
        const prefs = {};
        for (const key of NOTIFICATION_PREFERENCE_KEYS) {
            const b = body[key];
            if (b && typeof b === 'object' && !Array.isArray(b)) {
                prefs[key] = {
                    inApp: b.inApp !== false,
                    email: b.email !== false
                };
            } else {
                prefs[key] = defaults[key] || { inApp: true, email: true };
            }
        }
        const user = await UserModel.findById(decoded.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        user.notificationPreferences = prefs;
        user.updated_at = new Date();
        await user.save();
        res.json({ success: true, data: prefs, message: 'Notification settings saved' });
    } catch (error) {
        console.error('Update notification settings error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to save notification settings' });
    }
});

// ==================== CHANGE PASSWORD ====================

app.put("/auth/change-password", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'Current password and new password are required' 
            });
        }

        const user = await UserModel.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ 
                success: false, 
                message: 'Current password is incorrect' 
            });
        }

        // Validate new password strength
        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ 
                success: false, 
                message: passwordValidation.errors.join('. ') 
            });
        }

        // Check if new password is same as current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'New password must be different from current password' 
            });
        }

        // Check if new password was used recently (last 3 passwords)
        const previousPasswords = user.previousPasswords || [];
        for (const prevPass of previousPasswords.slice(-3)) {
            const isPreviousPassword = await bcrypt.compare(newPassword, prevPass.hashedPassword);
            if (isPreviousPassword) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'You cannot reuse your last 3 passwords' 
                });
            }
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password and add to previous passwords
        const updatedPreviousPasswords = [
            ...previousPasswords,
            {
                hashedPassword: user.password,
                changedAt: Date.now()
            }
        ].slice(-5); // Keep only last 5 passwords

        user.password = hashedNewPassword;
        user.previousPasswords = updatedPreviousPasswords;
        user.updated_at = Date.now();
        await user.save();

        res.json({ 
            success: true, 
            message: 'Password changed successfully' 
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to change password' 
        });
    }
});

// ==================== UPDATE RESOURCE ====================

app.put("/updateDevice", async (req, res) => {
    try {
        const device = await ResourceModel.findOne({ _id: req.body._id });
        if (device) {
            device.name = req.body.name || device.name;
            device.description = req.body.description || device.description;
            device.category = req.body.category || device.category;
            device.status = req.body.status || device.status;
            device.location = req.body.location || device.location;
            device.condition = req.body.condition || device.condition;
            device.max_borrow_days = req.body.max_borrow_days || device.max_borrow_days;
            device.total_quantity = req.body.total_quantity || device.total_quantity;
            device.available_quantity = req.body.available_quantity || device.available_quantity;
            await device.save();
            res.status(200).json({ message: "Success", device: device });
        } else {
            res.status(500).json({ message: "Device not found" });
        }
    } catch (error) {
        res.send(error);
    }
});

// ==================== DELETE RESOURCE ====================

app.delete("/deleteDevice/:id", async (req, res) => {
    try {
        const device = await ResourceModel.findOneAndDelete({ _id: req.params.id });
        res.status(200).json({ device: device, message: "Success" });
    } catch (error) {
        res.send(error);
    }
});

// ==================== SCAN RESOURCE ====================

app.get("/resources/scan/:code", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const { code } = req.params;
        let resource = await ResourceModel.findOne({
            $or: [{ barcode: code }, { qr_code: code }]
        });
        // Fallback: if code is 24 hex chars, treat as MongoDB _id (e.g. printed QR with _id)
        if (!resource && /^[a-fA-F0-9]{24}$/.test(code)) {
            resource = await ResourceModel.findById(code);
        }

        if (!resource) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }

        // For admin/assistant: include active borrow (Active or Overdue) for scan & update status
        let activeBorrow = null;
        activeBorrow = await BorrowModel.findOne({
            resource_id: resource._id,
            status: { $in: BORROW_OUT_STATUSES }
        })
            .populate('user_id', 'full_name email student_id')
            .sort({ borrow_date: -1 })
            .lean();

        res.status(200).json({ success: true, data: resource, activeBorrow: activeBorrow || null });
    } catch (error) {
        res.send(error);
    }
});

// Update resource status only (Maintenance, Available) – Admin/Assistant
app.put("/resources/:id/status", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        if (!user || !['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: 'Admin or Assistant required' });
        }

        const { status } = req.body;
        if (!status || !['Maintenance', 'Available'].includes(status)) {
            return res.status(400).json({ success: false, message: 'status must be Maintenance or Available' });
        }

        const resource = await ResourceModel.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        resource.status = status;
        await resource.save();

        res.status(200).json({ success: true, message: 'Status updated', data: resource });
    } catch (error) {
        console.error('Update resource status error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to update status' });
    }
});

// ==================== CREATE ADMIN ACCOUNT ====================

// Endpoint to create admin account (should be protected in production)
app.post("/create-admin", async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ message: 'Email, password, and full name are required' });
        }

        const user = await UserModel.findOne({ email });
        if (user) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hpass = await bcrypt.hash(password, 10);
        const adminUser = new UserModel({
            email: email.trim().toLowerCase(),
            password: hpass,
            full_name: full_name.trim(),
            role: 'Admin',
            status: 'Active'
        });

        await adminUser.save();

        res.status(200).json({ 
            success: true,
            message: 'Admin account created successfully',
            user: {
                email: adminUser.email,
                full_name: adminUser.full_name,
                role: adminUser.role
            }
        });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to create admin account' 
        });
    }
});

// ==================== REPORTS & ANALYTICS ====================

app.get("/admin/reports/analytics", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { startDate, endDate, search, category, resourceStatus, department, userRole, borrowStatus, paymentStatus } = req.query;

        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.borrow_date = {};
            if (startDate) dateFilter.borrow_date.$gte = new Date(startDate);
            if (endDate) dateFilter.borrow_date.$lte = new Date(endDate);
        }

        // Base borrow match: date + borrow status + payment status (on Borrow)
        const borrowMatch = { ...dateFilter };
        if (borrowStatus) borrowMatch.status = borrowStatus;
        if (paymentStatus === 'Paid' || paymentStatus === 'Unpaid') {
            borrowMatch.payment_status = paymentStatus === 'Paid' ? 'Paid' : 'Pending';
        }

        // When paymentStatus is Refunded or Completed, filter by borrow IDs from Payment collection
        let paymentBorrowIds = null;
        if (paymentStatus === 'Refunded' || paymentStatus === 'Completed') {
            const paymentMatch = { status: paymentStatus, borrow_id: { $exists: true, $ne: null } };
            if (startDate || endDate) {
                paymentMatch.created_at = {};
                if (startDate) paymentMatch.created_at.$gte = new Date(startDate);
                if (endDate) paymentMatch.created_at.$lte = new Date(endDate);
            }
            const paid = await PaymentModel.find(paymentMatch).distinct('borrow_id');
            paymentBorrowIds = paid.filter(Boolean);
            borrowMatch._id = { $in: paymentBorrowIds.length ? paymentBorrowIds : [null] };
        }

        // Optional: filter by search, category, resourceStatus, department, userRole via lookup
        let borrowIdFilter = null;
        const hasLookupFilters = search || category || resourceStatus || department || userRole;
        if (hasLookupFilters) {
            const pipeline = [
                { $match: borrowMatch },
                {
                    $lookup: {
                        from: 'Resources',
                        localField: 'resource_id',
                        foreignField: '_id',
                        as: 'resource'
                    }
                },
                { $unwind: { path: '$resource', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'Users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                { $match: {} }
            ];
            const andConditions = [];
            if (search && search.trim()) {
                const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(term, 'i');
                andConditions.push({
                    $or: [
                        { 'resource.name': regex },
                        { 'resource.barcode': regex },
                        { 'resource.qr_code': regex },
                        { 'user.full_name': regex }
                    ]
                });
            }
            if (category) andConditions.push({ 'resource.category': category });
            if (resourceStatus) andConditions.push({ 'resource.status': resourceStatus });
            if (department) andConditions.push({ 'user.department': department });
            if (userRole) andConditions.push({ 'user.role': userRole });
            if (andConditions.length) pipeline[pipeline.length - 1].$match.$and = andConditions;

            const filtered = await BorrowModel.aggregate([...pipeline, { $project: { _id: 1 } }]);
            const ids = filtered.map(b => b._id);
            borrowIdFilter = ids.length ? { _id: { $in: ids } } : { _id: { $in: [] } };
        }

        const baseFilter = hasLookupFilters ? { ...borrowMatch, ...borrowIdFilter } : borrowMatch;

        // Total Borrows
        const totalBorrows = await BorrowModel.countDocuments(baseFilter);

        // Total Returns
        const returnsFilter = {
            ...baseFilter,
            status: 'Returned',
            return_date: { $exists: true }
        };
        if (startDate || endDate) {
            returnsFilter.return_date = {};
            if (startDate) returnsFilter.return_date.$gte = new Date(startDate);
            if (endDate) returnsFilter.return_date.$lte = new Date(endDate);
        }
        const totalReturns = await BorrowModel.countDocuments(returnsFilter);

        // Overdue Items (apply same filters as other metrics)
        const overdueFilter = { ...baseFilter, status: 'Overdue' };
        const overdueItems = await BorrowModel.countDocuments(overdueFilter);

        // Total Revenue (Payment-based; respect date and paymentStatus if Refunded/Completed)
        const revenueMatch = { status: 'Completed' };
        if (startDate || endDate) {
            revenueMatch.created_at = {};
            if (startDate) revenueMatch.created_at.$gte = new Date(startDate);
            if (endDate) revenueMatch.created_at.$lte = new Date(endDate);
        }
        const revenueData = await PaymentModel.aggregate([
            { $match: revenueMatch },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

        // Most Borrowed Resources (use baseFilter)
        const mostBorrowed = await BorrowModel.aggregate([
            { $match: baseFilter },
            { $group: { _id: '$resource_id', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'Resources',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'resource'
                }
            },
            { $unwind: '$resource' },
            {
                $project: {
                    name: '$resource.name',
                    category: '$resource.category',
                    count: 1
                }
            }
        ]);

        // Department Statistics (filter users by department if department filter set)
        const usersByDeptMatch = { department: { $exists: true, $ne: null, $ne: '' } };
        if (department) usersByDeptMatch.department = department;
        const usersByDept = await UserModel.aggregate([
            { $match: usersByDeptMatch },
            ...(userRole ? [{ $match: { role: userRole } }] : []),
            { $group: { 
                _id: '$department', 
                userIds: { $push: '$_id' },
                users: { $sum: 1 } 
            } }
        ]);

        const departmentStats = await Promise.all(
            usersByDept.map(async (dept) => {
                const borrowQuery = { user_id: { $in: dept.userIds } };
                if (Object.keys(dateFilter).length) borrowQuery.borrow_date = dateFilter.borrow_date;
                if (borrowStatus) borrowQuery.status = borrowStatus;
                if (hasLookupFilters) Object.assign(borrowQuery, borrowIdFilter);
                if (paymentBorrowIds && (paymentStatus === 'Refunded' || paymentStatus === 'Completed')) {
                    borrowQuery._id = { $in: paymentBorrowIds.length ? paymentBorrowIds : [null] };
                }
                const borrowCount = await BorrowModel.countDocuments(borrowQuery);
                return {
                    department: dept._id,
                    users: dept.users,
                    borrows: borrowCount
                };
            })
        );
        departmentStats.sort((a, b) => b.users - a.users);

        // Detailed borrow list for current filters (for UI table)
        const borrowDetails = await BorrowModel.find(baseFilter)
            .populate('user_id', 'full_name email department role')
            .populate('resource_id', 'name category status barcode qr_code')
            .sort({ borrow_date: -1 })
            .limit(200);

        // User Trends (Last 6 months) - no filter applied for simplicity
        const userTrends = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            const newUsers = await UserModel.countDocuments({
                created_at: { $gte: startOfMonth, $lte: endOfMonth }
            });

            const activeUsers = await BorrowModel.distinct('user_id', {
                borrow_date: { $gte: startOfMonth, $lte: endOfMonth }
            });

            const borrows = await BorrowModel.countDocuments({
                borrow_date: { $gte: startOfMonth, $lte: endOfMonth }
            });

            userTrends.push({
                period: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                newUsers,
                activeUsers: activeUsers.length,
                borrows,
                trend: i === 5 ? 0 : Math.round(Math.random() * 20 - 10)
            });
        }

        res.json({
            success: true,
            data: {
                totalBorrows,
                totalReturns,
                overdueItems,
                totalRevenue,
                mostBorrowed,
                departmentStats,
                userTrends,
                borrowDetails
            }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== CALENDAR ====================

app.get("/admin/calendar", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const reservations = await ReservationModel.find({
            status: { $in: ['Pending', 'Confirmed'] }
        })
        .populate('resource_id', 'name')
        .populate('user_id', 'full_name')
        .sort({ pickup_date: 1 });

        const events = reservations.map(res => ({
            id: res._id,
            title: `Reservation: ${res.resource_id?.name || 'Resource'}`,
            description: `User: ${res.user_id?.full_name || 'N/A'}`,
            date: res.pickup_date,
            time: new Date(res.pickup_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            status: res.status
        }));

        res.json({ success: true, data: events });
    } catch (error) {
        console.error('Calendar error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== FEEDBACK ====================

app.get("/admin/feedback", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const feedbacks = await FeedbackModel.find()
            .populate('user_id', 'full_name email')
            .populate('resource_id', 'name')
            .sort({ created_at: -1 });

        res.json({ success: true, data: feedbacks });
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// User submit feedback
app.post("/feedback", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        const { rating, comment, category, resource_id, borrow_id } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        }

        const feedback = new FeedbackModel({
            user_id: user._id,
            resource_id: resource_id || null,
            borrow_id: borrow_id || null,
            rating: rating,
            comment: comment || '',
            category: category || 'Other',
            status: 'Pending'
        });

        await feedback.save();
        
        res.json({ success: true, message: 'Feedback submitted successfully', data: feedback });
    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put("/admin/feedback/:id/respond", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { response, status } = req.body;
        const feedback = await FeedbackModel.findByIdAndUpdate(
            req.params.id,
            {
                admin_response: response,
                status: status || 'Reviewed',
                responded_by: user._id,
                updated_at: Date.now()
            },
            { new: true }
        ).populate('user_id', 'full_name email');

        if (!feedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        res.json({ success: true, data: feedback });
    } catch (error) {
        console.error('Feedback response error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== ANNOUNCEMENTS ====================

// Get announcements for regular users
app.get("/announcements", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        // Filter announcements based on target_audience
        const query = {
            $or: [
                { target_audience: 'All' },
                { target_audience: user.role },
                ...(user.department ? [{ target_audience: user.department }] : [])
            ]
        };

        const announcements = await AnnouncementModel.find(query)
            .populate('created_by', 'full_name email')
            .sort({ created_at: -1 })
            .limit(10); // Get latest 10 announcements

        res.json({ success: true, data: announcements });
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get("/admin/announcements", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const announcements = await AnnouncementModel.find()
            .populate('created_by', 'full_name')
            .sort({ created_at: -1 });

        res.json({ success: true, data: announcements });
    } catch (error) {
        console.error('Announcements error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post("/assistant/abi-chat", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id).select('full_name role department');

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        const message = String(req.body?.message || '').trim();
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const reply = await getAbiReply({ message, user });

        return res.json({
            success: true,
            data: {
                name: 'Abi',
                reply
            }
        });
    } catch (error) {
        console.error('Abi chat error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get Abi response'
        });
    }
});

app.post("/admin/announcements", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { title, message, priority, target_audience } = req.body;

        const announcement = new AnnouncementModel({
            title,
            message,
            priority: priority || 'Normal',
            target_audience: target_audience || 'All',
            created_by: user._id
        });

        await announcement.save();

        res.json({ success: true, data: announcement });
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== EXPORT REPORTS ====================

app.get("/admin/reports/export", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);
        
        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { format, startDate, endDate, search, category, resourceStatus, department, userRole, borrowStatus, paymentStatus } = req.query;

        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.borrow_date = {};
            if (startDate) dateFilter.borrow_date.$gte = new Date(startDate);
            if (endDate) dateFilter.borrow_date.$lte = new Date(endDate);
        }

        const borrowMatch = { ...dateFilter };
        if (borrowStatus) borrowMatch.status = borrowStatus;
        if (paymentStatus === 'Paid' || paymentStatus === 'Unpaid') {
            borrowMatch.payment_status = paymentStatus === 'Paid' ? 'Paid' : 'Pending';
        }
        let paymentBorrowIds = null;
        if (paymentStatus === 'Refunded' || paymentStatus === 'Completed') {
            const paymentMatch = { status: paymentStatus, borrow_id: { $exists: true, $ne: null } };
            if (startDate || endDate) {
                paymentMatch.created_at = {};
                if (startDate) paymentMatch.created_at.$gte = new Date(startDate);
                if (endDate) paymentMatch.created_at.$lte = new Date(endDate);
            }
            paymentBorrowIds = await PaymentModel.find(paymentMatch).distinct('borrow_id');
            borrowMatch._id = { $in: (paymentBorrowIds || []).length ? paymentBorrowIds : [null] };
        }

        const hasLookupFilters = search || category || resourceStatus || department || userRole;
        let baseFilter = borrowMatch;
        if (hasLookupFilters) {
            const pipeline = [
                { $match: borrowMatch },
                { $lookup: { from: 'Resources', localField: 'resource_id', foreignField: '_id', as: 'resource' } },
                { $unwind: { path: '$resource', preserveNullAndEmptyArrays: true } },
                { $lookup: { from: 'Users', localField: 'user_id', foreignField: '_id', as: 'user' } },
                { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                { $match: {} }
            ];
            const andConditions = [];
            if (search && search.trim()) {
                const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(term, 'i');
                andConditions.push({
                    $or: [
                        { 'resource.name': regex },
                        { 'resource.barcode': regex },
                        { 'resource.qr_code': regex },
                        { 'user.full_name': regex }
                    ]
                });
            }
            if (category) andConditions.push({ 'resource.category': category });
            if (resourceStatus) andConditions.push({ 'resource.status': resourceStatus });
            if (department) andConditions.push({ 'user.department': department });
            if (userRole) andConditions.push({ 'user.role': userRole });
            if (andConditions.length) pipeline[pipeline.length - 1].$match.$and = andConditions;
            const filtered = await BorrowModel.aggregate([...pipeline, { $project: { _id: 1 } }]);
            const ids = filtered.map(b => b._id);
            baseFilter = ids.length ? { ...borrowMatch, _id: { $in: ids } } : { _id: { $in: [] } };
        }

        const borrows = await BorrowModel.find(baseFilter)
            .populate('user_id', 'full_name email department role')
            .populate('resource_id', 'name category status barcode qr_code')
            .sort({ borrow_date: -1 });

        const reportData = {
            generated_at: new Date().toISOString(),
            period: { start: startDate || 'All', end: endDate || 'All' },
            total_borrows: borrows.length,
            borrows: borrows.map(b => ({
                user: b.user_id?.full_name || 'N/A',
                resource: b.resource_id?.name || 'N/A',
                category: b.resource_id?.category || 'N/A',
                borrow_date: b.borrow_date,
                due_date: b.due_date,
                return_date: b.return_date,
                status: b.status
            }))
        };

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=report_${Date.now()}.csv`);
            
            let csv = 'User,Resource,Category,Borrow Date,Due Date,Return Date,Status\n';
            reportData.borrows.forEach(b => {
                csv += `"${b.user}","${b.resource}","${b.category}","${b.borrow_date}","${b.due_date}","${b.return_date || 'N/A'}","${b.status}"\n`;
            });
            
            return res.send(csv);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=report_${Date.now()}.json`);
            return res.json(reportData);
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== HEALTH CHECK ====================

app.get("/health", (req, res) => {
    const dbStatuses = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const dbState = dbStatuses[mongoose.connection.readyState] || 'unknown';
    res.send({
        status: dbState === 'connected' ? 'OK' : 'DEGRADED',
        message: 'UTAS Borrowing Hub API is running',
        database: dbState
    });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await connectToMongoDB();

        const server = app.listen(PORT, () => {
            console.log(`Server started at ${PORT}..`);
            // Run overdue check once on startup, then every hour
            runOverdueBorrowCheck().catch((err) => {
                console.error('Initial overdue borrow check failed:', err);
            });
            setInterval(() => {
                runOverdueBorrowCheck().catch((err) => {
                    console.error('Scheduled overdue borrow check failed:', err);
                });
            }, 60 * 60 * 1000);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`\n❌ Error: Port ${PORT} is already in use.`);
                console.error(`Please either:`);
                console.error(`  1. Stop the process using port ${PORT}`);
                console.error(`  2. Or set a different PORT in your .env file (e.g., PORT=5001)`);
                console.error(`\nTo find the process using port ${PORT}, run:`);
                console.error(`  Windows: netstat -ano | findstr :${PORT}`);
                console.error(`  Linux/Mac: lsof -i :${PORT}\n`);
                process.exit(1);
            } else {
                console.error('Server error:', err);
                process.exit(1);
            }
        });

        return server;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

startServer();
