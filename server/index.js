// Suppress punycode deprecation warning (DEP0040) before any imports
// This warning comes from nodemailer's dependencies and is safe to suppress
import 'ignore-punycode-warning';

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import UserModel from './models/User.js';
import ResourceModel from './models/Resource.js';
import BorrowModel from './models/Borrow.js';
import ReservationModel from './models/Reservation.js';
import NotificationModel from './models/Notification.js';
import PenaltyModel from './models/Penalty.js';
import PaymentModel from './models/Payment.js';
import FeedbackModel from './models/Feedback.js';
import AnnouncementModel from './models/Announcement.js';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Always load server/.env (not cwd), so Abi and DB keys work when started from repo root
dotenv.config({ path: path.join(__dirname, '.env') });

let app = express();
app.use(cors());
app.use(express.json());

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

// Mongo connection is established in startServer() after dotenv loads — see end of file.

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
        
        // Check if user is authenticated and get their department
        let userDepartment = null;
        let userRole = null;
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {
                const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
                const user = await UserModel.findById(decoded.id);
                if (user) {
                    userDepartment = user.department;
                    userRole = user.role;
                }
            }
        } catch (authError) {
            // If auth fails, continue without department filter (for public access)
        }
        
        if (status) query.status = status;
        if (category) query.category = category;
        if (college) query.college = college;
        
        // Filter by department: Users can only see resources from their department
        // Admin and Assistant can see all resources
        if (userDepartment && !['Admin', 'Assistant'].includes(userRole)) {
            // If user has a department, show only resources from their department or resources without department assigned
            query.$or = [
                { department: userDepartment },
                { department: null },
                { department: '' },
                { department: { $exists: false } }
            ];
        }
        
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

// GET single resource by id (catalog detail page; rejects non-ObjectId ids so /resources/scan/... is unaffected)
app.get("/resources/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        const resource = await ResourceModel.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        let userDepartment = null;
        let userRole = null;
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {
                const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
                const user = await UserModel.findById(decoded.id);
                if (user) {
                    userDepartment = user.department;
                    userRole = user.role;
                }
            }
        } catch (authError) {
            /* optional auth — continue without department filter */
        }

        if (userDepartment && !['Admin', 'Assistant'].includes(userRole)) {
            const resDept = (resource.department || '').trim();
            const userDept = (userDepartment || '').trim();
            if (resDept && userDept && resDept.toLowerCase() !== userDept.toLowerCase()) {
                return res.status(404).json({ success: false, message: 'Resource not found' });
            }
        }

        res.json({ success: true, data: resource });
    } catch (error) {
        console.error('Get resource by id error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch resource'
        });
    }
});

app.get("/showDevices", async (req, res) => {
    try {
        const { status, category, search, page = 1, limit = 10 } = req.query;
        const query = {};
        
        // Check if user is authenticated and get their department
        let userDepartment = null;
        let userRole = null;
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {
                const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
                const user = await UserModel.findById(decoded.id);
                if (user) {
                    userDepartment = user.department;
                    userRole = user.role;
                }
            }
        } catch (authError) {
            // If auth fails, continue without department filter (for public access)
        }
        
        if (status) query.status = status;
        if (category) query.category = category;
        
        // Filter by department: Users can only see resources from their department
        // Admin and Assistant can see all resources
        if (userDepartment && !['Admin', 'Assistant'].includes(userRole)) {
            // If user has a department, show only resources from their department or resources without department assigned
            query.$or = [
                { department: userDepartment },
                { department: null },
                { department: '' },
                { department: { $exists: false } }
            ];
        }
        
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
            status: 'Active',
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
                status: 'Active'
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

        // Get all active borrows
        const activeBorrows = await BorrowModel.find({
            resource_id: req.params.id,
            status: 'Active'
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

        if ((barcode || qr_code) && barcode !== qr_code) {
            return res.status(400).json({
                success: false,
                message:
                    'Barcode and QR code must be the same value. Leave both empty or use identical text in both fields, or use Generate unique codes.'
            });
        }

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

/** Unique label for barcode + QR (same value on both fields). */
async function allocateUniqueResourceAssetCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 50; attempt++) {
        const buf = crypto.randomBytes(10);
        let code = 'UBH-';
        for (let i = 0; i < 10; i++) code += alphabet[buf[i] % alphabet.length];
        const clash = await ResourceModel.findOne({
            $or: [{ barcode: code }, { qr_code: code }]
        })
            .select('_id')
            .lean();
        if (!clash) return code;
    }
    throw new Error('Unable to generate a unique asset code');
}

// Generate / assign matching barcode + QR code (Admin/Assistant)
app.post('/admin/resources/generate-codes', async (req, res) => {
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

        const { resource_id, replace } = req.body || {};
        const code = await allocateUniqueResourceAssetCode();

        if (resource_id) {
            const resource = await ResourceModel.findById(resource_id);
            if (!resource) {
                return res.status(404).json({ success: false, message: 'Resource not found' });
            }
            const hasCodes = !!(resource.barcode || resource.qr_code);
            const openBorrowStatuses = [
                'PendingApproval',
                'Approved',
                'Claimed',
                'Active',
                'Overdue',
                'PendingReturn'
            ];
            const hasOpenBorrow = await BorrowModel.exists({
                resource_id: resource._id,
                status: { $in: openBorrowStatuses }
            });
            if (hasOpenBorrow && hasCodes) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Cannot replace barcode or QR while this resource has an active or pending borrow. Wait until it is returned first.'
                });
            }
            if (hasCodes && !replace) {
                return res.status(400).json({
                    success: false,
                    message: 'This resource already has a barcode or QR value. Send replace: true to overwrite both with a new code.'
                });
            }
            resource.barcode = code;
            resource.qr_code = code;
            resource.updated_at = Date.now();
            await resource.save();
            return res.status(200).json({
                success: true,
                message: 'Unique codes assigned to this resource.',
                data: resource,
                codes: { barcode: code, qr_code: code }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Unique code generated. Paste into the form or save to a new resource.',
            codes: { barcode: code, qr_code: code }
        });
    } catch (error) {
        console.error('Generate resource codes error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to generate codes' });
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

        const nextBarcode = req.body.barcode !== undefined ? barcode : resource.barcode;
        const nextQr = req.body.qr_code !== undefined ? qr_code : resource.qr_code;
        if (req.body.barcode !== undefined || req.body.qr_code !== undefined) {
            const effB =
                nextBarcode == null || String(nextBarcode).trim() === '' ? null : String(nextBarcode).trim();
            const effQ = nextQr == null || String(nextQr).trim() === '' ? null : String(nextQr).trim();
            if ((effB || effQ) && effB !== effQ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Barcode and QR code must be the same value. Leave both empty or use identical text in both fields, or use Generate unique codes.'
                });
            }
        }
        const identifiersChange =
            (req.body.barcode !== undefined && nextBarcode !== resource.barcode) ||
            (req.body.qr_code !== undefined && nextQr !== resource.qr_code);

        if (identifiersChange) {
            const openBorrowStatuses = [
                'PendingApproval',
                'Approved',
                'Claimed',
                'Active',
                'Overdue',
                'PendingReturn'
            ];
            const hasOpenBorrow = await BorrowModel.exists({
                resource_id: resource._id,
                status: { $in: openBorrowStatuses }
            });
            if (hasOpenBorrow) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Cannot change barcode or QR code while this resource has an active or pending borrow. Wait until it is returned or resolve the borrow request first.'
                });
            }
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
            status: { $in: ['Active', 'Overdue', 'PendingApproval'] }
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

        const existingBorrow = await BorrowModel.findOne({
            user_id: user._id,
            resource_id,
            status: 'Active'
        });

        if (existingBorrow) {
            return res.status(500).json({ message: "You already have an active borrow for this resource" });
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
            
            // Notify admins about payment
            const admins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
            for (const admin of admins) {
                await NotificationModel.create({
                    user_id: admin._id,
                    title: 'New Payment Request',
                    message: `${user.full_name} (${user.email}) has made a payment request of ${payment_amount || resource.payment_amount} OMR via ${payment_method} for borrowing ${resource.name}.`,
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
            payment_id: paymentId
        });

        // Update user's terms acceptance (one-time acceptance)
        if (!user.terms_accepted) {
            user.terms_accepted = true;
            user.terms_accepted_at = new Date();
            await user.save();
        }
        await newBorrow.save();

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
                message: `Your borrow request for ${resource.name} has been submitted and is pending admin approval. You will be notified once it's approved. ${resource.requires_payment && resource.payment_amount > 0 ? `Payment of ${resource.payment_amount} OMR via ${payment_method} will be processed upon approval.` : ''}`,
                type: 'Info',
                related_type: 'Borrow',
                related_id: newBorrow._id
            });
        }

        // Email: notify user about submitted borrow request
        if (await shouldSendEmailNotification(user._id, 'borrowApproval')) {
            await sendEmail({
                to: user.email,
                subject: 'Borrow Request Submitted – UTAS Borrowing Hub',
                html: `<div style="${emailStyle}">${emailHeader}
              <div style="padding:24px;">
                <p>Dear ${user.full_name},</p>
                <p>Your borrow request for <strong>${resource.name}</strong> has been submitted and is <strong>pending admin approval</strong>.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${resource.name}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Category</td><td style="padding:6px;">${resource.category || 'N/A'}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Due Date</td><td style="padding:6px;">${new Date(newBorrow.due_date).toLocaleDateString()}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Status</td><td style="padding:6px;">Pending Approval</td></tr>
                </table>
                <p>You will receive another email once your request is reviewed.</p>
              </div>${emailFooter}</div>`
            });
        }

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
        
        // Allow filtering by any valid status including PendingApproval
        if (status && ['Active', 'Returned', 'Overdue', 'Lost', 'PendingApproval'].includes(status)) {
            query.status = status;
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

        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only administrators or assistants can confirm a resource return. Please return the item at the borrowing hub.'
            });
        }

        if (borrow.status === 'Returned' || borrow.status === 'Lost') {
            return res.status(500).json({ message: "Resource already returned or marked as lost" });
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
        
        // Only return quantity if status is Returned (not Lost)
        if (finalStatus === 'Returned') {
            // Return the quantity
            resource.available_quantity += 1;
            
            // Update status to Available if quantity > 0
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
            const resUserDoc = reservation.user_id;
            const uid = resUserDoc?._id || reservation.user_id;
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
            if (
                resUserDoc?.email &&
                uid &&
                (await shouldSendEmailNotification(uid, 'reservationAvailable'))
            ) {
                await sendEmail({
                    to: resUserDoc.email,
                    subject: `Resource available: ${resource.name} – UTAS Borrowing Hub`,
                    html: `<div style="${emailStyle}">${emailHeader}
              <div style="padding:24px;">
                <p>Dear ${resUserDoc.full_name || 'User'},</p>
                <p>The resource <strong>${resource.name}</strong> you reserved is now <strong>available for pickup</strong>.</p>
                <p>Please check your reservations in the hub and arrange pickup.</p>
              </div>${emailFooter}</div>`
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

            const penalizedUserBrief = await UserModel.findById(borrowUserId).select('full_name email');
            const penaltyAdmins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
            for (const adm of penaltyAdmins) {
                await NotificationModel.create({
                    user_id: adm._id,
                    title: 'Penalty Applied',
                    message: `${penalizedUserBrief?.full_name || 'User'} (${penalizedUserBrief?.email || ''}): ${fineAmount} OMR — ${description}. Resource: ${resource.name}.`,
                    type: 'Warning',
                    related_type: 'Penalty',
                    related_id: penalty._id
                });
            }

            if (borrowUserId && (await shouldSendEmailNotification(borrowUserId, 'penalty'))) {
                const penalizedUser = await UserModel.findById(borrowUserId).select('email full_name');
                if (penalizedUser?.email) {
                    await sendEmail({
                        to: penalizedUser.email,
                        subject: 'Penalty applied – UTAS Borrowing Hub',
                        html: `<div style="${emailStyle}">${emailHeader}
              <div style="padding:24px;">
                <p>Dear ${penalizedUser.full_name || 'User'},</p>
                <p>A penalty of <strong>${fineAmount} OMR</strong> has been applied to your account.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:6px;color:#555;">Reason</td><td style="padding:6px;">${description}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Type</td><td style="padding:6px;">${penaltyType}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Amount</td><td style="padding:6px;font-weight:bold;">${fineAmount} OMR</td></tr>
                </table>
                <p>Please sign in to the hub and settle your penalty from the Penalties page.</p>
              </div>${emailFooter}</div>`
                    });
                }
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

/** If linked Reservation deposit payment is already Completed, align reservation.payment_status (fixes legacy rows). */
async function syncReservationDepositPaidFromPayments(reservations) {
    const list = Array.isArray(reservations) ? reservations : [];
    const needSync = list.filter(
        (r) =>
            r.requires_payment &&
            (r.payment_amount || 0) > 0 &&
            r.payment_status !== 'Paid' &&
            r.payment_id
    );
    if (!needSync.length) return;
    const ids = [...new Set(needSync.map((r) => r.payment_id))];
    const payments = await PaymentModel.find({ _id: { $in: ids } }).lean();
    const payMap = new Map(payments.map((p) => [String(p._id), p]));
    const updates = [];
    for (const r of needSync) {
        const p = payMap.get(String(r.payment_id));
        if (p && p.payment_type === 'Reservation' && p.status === 'Completed') {
            r.payment_status = 'Paid';
            updates.push(
                ReservationModel.updateOne(
                    { _id: r._id },
                    { $set: { payment_status: 'Paid', updated_at: new Date() } }
                )
            );
        }
    }
    if (updates.length) await Promise.all(updates);
}

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

        // Check if resource is available
        if (resource.status !== 'Available' || resource.available_quantity < 1) {
            return res.status(400).json({ 
                success: false,
                message: "Resource is not available for reservation" 
            });
        }

        // Check if resource is already borrowed during the requested pickup date
        const pickupDate = new Date(pickup_date);
        const expiryDate = expiry_date ? new Date(expiry_date) : new Date(pickupDate);
        expiryDate.setDate(expiryDate.getDate() + (resource.max_borrow_days || 7));

        // Check for active borrows that overlap with the requested dates
        const overlappingBorrows = await BorrowModel.find({
            resource_id: resource._id,
            status: 'Active',
            $or: [
                {
                    borrow_date: { $lte: expiryDate },
                    due_date: { $gte: pickupDate }
                }
            ]
        });

        if (overlappingBorrows.length >= resource.available_quantity) {
            // Find the earliest return date
            const earliestReturn = await BorrowModel.findOne({
                resource_id: resource._id,
                status: 'Active'
            }).sort({ due_date: 1 });

            const suggestedDate = earliestReturn 
                ? new Date(earliestReturn.due_date)
                : new Date();
            suggestedDate.setDate(suggestedDate.getDate() + 1);

            return res.status(400).json({ 
                success: false,
                message: `Resource is already borrowed during the requested period. Suggested available date: ${suggestedDate.toLocaleDateString()}`,
                suggestedDate: suggestedDate.toISOString().split('T')[0],
                earliestReturnDate: earliestReturn ? earliestReturn.due_date : null
            });
        }

        // Calculate expiry date if not provided (default: pickup_date + 7 days)
        const pickupDateObj = new Date(pickup_date);
        let expiryDateObj;
        if (expiry_date) {
            expiryDateObj = new Date(expiry_date);
        } else {
            expiryDateObj = new Date(pickupDateObj);
            expiryDateObj.setDate(expiryDateObj.getDate() + 7); // Default 7 days expiry
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
            
            // Notify admins about payment
            const admins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
            for (const admin of admins) {
                await NotificationModel.create({
                    user_id: admin._id,
                    title: 'New Payment Request',
                    message: `${user.full_name} (${user.email}) has made a payment request of ${payment_amount || resource.payment_amount} OMR via ${payment_method} for reserving ${resource.name}.`,
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
            await PaymentModel.findByIdAndUpdate(paymentId, {
                reservation_id: newReservation._id,
                updated_at: Date.now()
            });
        }

        // RESERVE: Don't decrease quantity - only reserve for future pickup
        // Quantity will be decreased when reservation is confirmed and picked up
        // This allows the resource to remain available for others until pickup date
        // No quantity change here - reservation is just a booking for future date

        const reserveAdmins = await UserModel.find({ role: { $in: ['Admin', 'Assistant'] } });
        for (const adm of reserveAdmins) {
            await NotificationModel.create({
                user_id: adm._id,
                title: 'New Reservation Request',
                message: `${user.full_name} (${user.email}) reserved ${resource.name}. Pickup: ${pickupDateObj.toLocaleDateString()}.`,
                type: 'Info',
                related_type: 'Reservation',
                related_id: newReservation._id
            });
        }

        // Email: notify user about reservation submission
        if (await shouldSendEmailNotification(user._id, 'reservationConfirmation')) {
            await sendEmail({
                to: user.email,
                subject: 'Reservation Submitted – UTAS Borrowing Hub',
                html: `<div style="${emailStyle}">${emailHeader}
              <div style="padding:24px;">
                <p>Dear ${user.full_name},</p>
                <p>Your reservation request has been <strong>submitted</strong> and is pending confirmation.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${resource.name}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Pickup Date</td><td style="padding:6px;">${pickupDateObj.toLocaleDateString()}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Status</td><td style="padding:6px;">Pending</td></tr>
                </table>
                <p>You will receive another email once the reservation is confirmed by an admin.</p>
              </div>${emailFooter}</div>`
            });
        }

        // Email: notify admins about new reservation
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
                    <p>Please log in to the admin panel to review this reservation.</p>
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

        await syncReservationDepositPaidFromPayments(reservations);

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

        // RESERVE: Only return quantity if reservation was confirmed (quantity was decreased at confirmation)
        // Pending reservations don't decrease quantity, so nothing to return
        if (resource && wasConfirmed) {
            resource.available_quantity += 1;
            // Update status back to Available if quantity > 0
            if (resource.available_quantity > 0 && resource.status === 'Reserved') {
                resource.status = 'Available';
            }
            await resource.save();
        }

        // Email: notify user about cancellation
        const cancelUser = await UserModel.findById(decoded.id);
        const cancelResource = resource || await ResourceModel.findById(reservation.resource_id);
        if (cancelUser?.email && (await shouldSendEmailNotification(cancelUser._id, 'reservationConfirmation'))) {
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

        await syncReservationDepositPaidFromPayments(reservations);

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

        // RESERVE: Check if resource is available for pickup (quantity NOT decreased yet for reservations)
        // Only check actual available quantity and active borrows
        const activeBorrowsCount = await BorrowModel.countDocuments({
            resource_id: resource._id,
            status: 'Active'
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
            status: 'Active',
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

        reservation.status = 'Confirmed';
        reservation.updated_at = new Date();
        await reservation.save();

        // RESERVE: NOW decrease quantity when reservation is confirmed (user will pick up soon)
        resource.available_quantity -= 1;
        if (resource.available_quantity === 0) {
            resource.status = 'Reserved';
        }
        await resource.save();

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
        const reservedUserId = reservedUser?._id || resUserId;
        if (reservedUser?.email && reservedUserId && (await shouldSendEmailNotification(reservedUserId, 'reservationConfirmation'))) {
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
            status: 'Active'
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
            status: 'Active'
        });

        if (existingBorrow) {
            return res.status(400).json({ 
                success: false,
                message: 'User already has an active borrow for this resource' 
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
        const borrowDate = new Date(reservation.pickup_date);
        const finalDueDate = due_date ? new Date(due_date) : new Date(borrowDate);
        if (!due_date) {
            finalDueDate.setDate(finalDueDate.getDate() + (resource.max_borrow_days || 7));
        }

        const newBorrow = new BorrowModel({
            user_id: reservation.user_id._id,
            resource_id: resource._id,
            borrow_date: borrowDate,
            due_date: finalDueDate,
            condition_on_borrow: condition_on_borrow || 'Good',
            checked_out_by: admin._id,
            status: 'Active',
            terms_accepted: true,
            terms_accepted_at: reservationUser.terms_accepted_at || new Date(),
            requires_payment: reservation.requires_payment || false,
            payment_amount: reservation.requires_payment ? reservation.payment_amount : 0,
            payment_method: reservation.requires_payment ? reservation.payment_method : null,
            payment_status: reservation.requires_payment ? 'Paid' : 'Not Required',
            payment_id: reservation.payment_id || null
        });
        await newBorrow.save();

        // RESERVE->BORROW: Quantity already decreased when reservation was confirmed
        // Just update status if needed
        if (resource.available_quantity === 0) {
            resource.status = 'Borrowed';
        }
        await resource.save();

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
                message: `Your reservation for "${resource.name}" has been approved and converted to a borrow. Due date: ${finalDueDate.toLocaleDateString()}.`,
                type: 'Success',
                related_type: 'Borrow',
                related_id: newBorrow._id
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
                resource.available_quantity += 1;
                if (resource.status === 'Borrowed' && resource.available_quantity > 0) {
                    resource.status = 'Available';
                }
                await resource.save();
            }
        }

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

        // BORROW APPROVAL: Update borrow status to Active and decrease quantity
        borrow.status = 'Active';
        borrow.borrow_date = new Date(); // Start borrow period from approval date
        borrow.updated_at = new Date();
        await borrow.save();

        // Decrease available quantity when approved
        resource.available_quantity -= 1;
        
        // Update status only if all items are borrowed
        if (resource.available_quantity === 0) {
            resource.status = 'Borrowed';
        }
        
        await resource.save();

        // Note: Deposit payment status is managed via Payments Management.

        // Update related reservations
        await ReservationModel.updateMany(
            { user_id: borrow.user_id._id, resource_id: borrow.resource_id._id, status: { $in: ['Pending', 'Confirmed'] } },
            { status: 'Completed', updated_at: Date.now() }
        );

        // Notify user (respect notification preferences)
        const borrowUserIdApproved = borrow.user_id?._id || borrow.user_id;
        if (borrowUserIdApproved && (await shouldSendInAppNotification(borrowUserIdApproved, 'borrowApproval'))) {
            await NotificationModel.create({
                user_id: borrowUserIdApproved,
                title: 'Borrow Approved',
                message: `Your borrow request for ${resource.name} has been approved. Please pick it up from: ${resource.location || 'IT Borrowing Hub - Lab 2'}. Due date: ${new Date(borrow.due_date).toLocaleDateString()}. ${borrow.requires_payment && borrow.payment_status === 'Pending' ? 'Payment has been processed.' : ''}`,
                type: 'Success',
                related_type: 'Borrow',
                related_id: borrow._id
            });
        }

        // Email: notify user borrow was approved
        const approvedUser = borrow.user_id;
        if (approvedUser?.email && borrowUserIdApproved && (await shouldSendEmailNotification(borrowUserIdApproved, 'borrowApproval'))) {
            await sendEmail({
                to: approvedUser.email,
                subject: 'Borrow Request Approved – UTAS Borrowing Hub',
                html: `<div style="${emailStyle}">${emailHeader}
                  <div style="padding:24px;">
                    <p>Dear ${approvedUser.full_name},</p>
                    <p>Great news! Your borrow request has been <strong style="color:#2e7d32;">approved</strong>.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${resource.name}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Pickup Location</td><td style="padding:6px;">${resource.location || 'IT Borrowing Hub - Lab 2'}</td></tr>
                      <tr><td style="padding:6px;color:#555;">Due Date</td><td style="padding:6px;">${new Date(borrow.due_date).toLocaleDateString()}</td></tr>
                    </table>
                    <p>Please pick up your item from the location above.</p>
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

        // Delete the borrow request
        await BorrowModel.findByIdAndDelete(req.params.id);

        // Notify user about rejection (respect notification preferences)
        const rejectUserId = borrow.user_id?._id || borrow.user_id;
        if (rejectUserId && (await shouldSendInAppNotification(rejectUserId, 'borrowRejection'))) {
            await NotificationModel.create({
                user_id: rejectUserId,
                title: 'Borrow Request Rejected',
                message: `Your borrow request for ${borrow.resource_id.name} has been rejected. ${reason ? `Reason: ${reason}` : ''}`,
                type: 'Error',
                related_type: 'Borrow',
                related_id: null
            });
        }

        // Email: notify user borrow was rejected
        const rejectedUser = borrow.user_id;
        if (rejectedUser?.email && rejectUserId && (await shouldSendEmailNotification(rejectUserId, 'borrowRejection'))) {
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
                    <p>If you have questions, please contact the admin team.</p>
                  </div>${emailFooter}</div>`
            });
        }

        res.status(200).json({
            success: true,
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

        // If borrow is Active, increase resource quantity
        if (borrow.status === 'Active') {
            const resource = await ResourceModel.findById(borrow.resource_id._id);
            if (resource) {
                resource.available_quantity += 1;
                if (resource.status === 'Borrowed' && resource.available_quantity > 0) {
                    resource.status = 'Available';
                }
                await resource.save();
            }
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
        
        if (status) query.status = status;

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
        if (payment_method === 'Card' && card_details) {
            // Store only last 4 digits for security (don't store full card number)
            const cardNumber = card_details.card_number || '';
            paymentData.card_last4 = cardNumber.length >= 4 ? cardNumber.slice(-4) : '';
            paymentData.card_holder = card_details.card_holder || '';
            paymentData.card_expiry = card_details.expiry_date || '';
            if (card_details.card_network) {
                paymentData.card_network = String(card_details.card_network).trim().slice(0, 40);
            }
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
        if (card_details && card_details.card_number) {
            const cardNumber = card_details.card_number || '';
            payment.card_last4 = cardNumber.length >= 4 ? cardNumber.slice(-4) : '';
            payment.card_holder = card_details.card_holder || '';
            payment.card_expiry = card_details.expiry_date || '';
            if (card_details.card_network) {
                payment.card_network = String(card_details.card_network).trim().slice(0, 40);
            }
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

        // If this payment is for a resource borrow deposit, mark the borrow as deposit-paid
        if (payment.payment_type === 'Resource') {
            const relatedBorrow = await BorrowModel.findOne({ payment_id: payment._id });
            if (relatedBorrow) {
                relatedBorrow.payment_status = 'Paid';
                relatedBorrow.updated_at = Date.now();
                await relatedBorrow.save();
            }
        }

        if (payment.payment_type === 'Reservation') {
            let relatedReservation = payment.reservation_id
                ? await ReservationModel.findById(payment.reservation_id)
                : null;
            if (!relatedReservation) {
                relatedReservation = await ReservationModel.findOne({ payment_id: payment._id });
            }
            if (relatedReservation) {
                relatedReservation.payment_status = 'Paid';
                relatedReservation.updated_at = Date.now();
                await relatedReservation.save();
            }
        }

        await payment.save();

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

            // If this is a resource security deposit, mark the related borrow deposit as paid
            if (payment.payment_type === 'Resource') {
                const relatedBorrow = await BorrowModel.findOne({ payment_id: payment._id });
                if (relatedBorrow) {
                    relatedBorrow.payment_status = 'Paid';
                    relatedBorrow.updated_at = Date.now();
                    await relatedBorrow.save();
                }
            }

            if (payment.payment_type === 'Reservation') {
                let relatedReservation = payment.reservation_id
                    ? await ReservationModel.findById(payment.reservation_id)
                    : null;
                if (!relatedReservation) {
                    relatedReservation = await ReservationModel.findOne({ payment_id: payment._id });
                }
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
        } else if (status === 'Refunded') {
            // Revert penalty status if refunded
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

        const [totalUsers, totalResources, activeBorrows, pendingReservations, overdueBorrows, pendingPenalties, totalRevenue, recentBorrows, availableResources, maintenanceResources, returnedBorrows] = await Promise.all([
            UserModel.countDocuments(),
            ResourceModel.countDocuments(),
            BorrowModel.countDocuments({ status: 'Active' }),
            ReservationModel.countDocuments({ status: { $in: ['Pending', 'Confirmed'] } }),
            BorrowModel.countDocuments({ status: 'Overdue' }),
            PenaltyModel.countDocuments({ status: 'Pending' }),
            PaymentModel.aggregate([
                { $match: { status: 'Completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            BorrowModel.find({ status: 'Active' })
                .populate('user_id', 'full_name email')
                .populate('resource_id', 'name category')
                .sort({ borrow_date: -1 })
                .limit(10),
            ResourceModel.countDocuments({ status: 'Available' }),
            ResourceModel.countDocuments({ status: 'Maintenance' }),
            BorrowModel.countDocuments({ status: 'Returned' })
        ]);

        const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

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
            status: { $in: ['Active', 'Overdue'] },
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
        if (mongoose.connection.readyState !== mongoose.STATES.connected) {
            console.warn('Skipping overdue borrow check: MongoDB is not connected.');
            return;
        }

        const now = new Date();

        const borrows = await BorrowModel.find({
            status: 'Active',
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

            // Email once when borrow first becomes overdue (same scheduler pass as status flip)
            if (await shouldSendEmailNotification(b.user_id, 'dueDateReminder')) {
                const overdueUser = await UserModel.findById(b.user_id).select('email full_name');
                if (overdueUser?.email) {
                    await sendEmail({
                        to: overdueUser.email,
                        subject: 'Borrow overdue – UTAS Borrowing Hub',
                        html: `<div style="${emailStyle}">${emailHeader}
              <div style="padding:24px;">
                <p>Dear ${overdueUser.full_name || 'User'},</p>
                <p>${message}</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:6px;color:#555;">Resource</td><td style="padding:6px;font-weight:bold;">${resource?.name || 'Resource'}</td></tr>
                  <tr><td style="padding:6px;color:#555;">Due date</td><td style="padding:6px;">${b.due_date.toLocaleDateString()}</td></tr>
                </table>
                <p>Please return the item as soon as possible to avoid further penalties.</p>
              </div>${emailFooter}</div>`
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

async function shouldSendEmailNotification(userId, preferenceKey) {
    const u = await UserModel.findById(userId).select('notificationPreferences');
    const def = getDefaultNotificationPreferences();
    const prefs = u?.notificationPreferences && typeof u.notificationPreferences === 'object'
        ? { ...def, ...u.notificationPreferences } : def;
    const p = prefs[preferenceKey];
    return !p || p.email !== false;
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

        let code = String(req.params.code ?? '')
            .trim()
            .replace(/[\u200B-\u200D\uFEFF]/g, '');
        if (code.length > 256) {
            code = code.slice(0, 256);
        }
        try {
            code = code.normalize('NFC');
        } catch (e) {
            /* ignore invalid unicode in older environments */
        }
        if (!code) {
            return res.status(400).json({ success: false, message: 'Missing or empty scan code' });
        }

        const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const exactNoCase = new RegExp(`^${escaped}$`, 'i');

        let resource = await ResourceModel.findOne({
            $or: [{ barcode: exactNoCase }, { qr_code: exactNoCase }]
        });
        // Fallback: if code is 24 hex chars, treat as MongoDB _id (e.g. printed QR with _id)
        if (!resource && /^[a-fA-F0-9]{24}$/.test(code)) {
            resource = await ResourceModel.findById(code);
        }
        // Fallback: asset tag stored as resource name (only when unambiguous)
        if (!resource) {
            const byName = await ResourceModel.find({ name: exactNoCase }).limit(2).select('_id');
            if (byName.length === 1) {
                resource = await ResourceModel.findById(byName[0]._id);
            }
        }

        if (!resource) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }

        // For staff: include in-flight borrow so scan UI can confirm return / see status immediately
        let activeBorrow = null;
        activeBorrow = await BorrowModel.findOne({
            resource_id: resource._id,
            status: { $in: ['Approved', 'Claimed', 'Active', 'Overdue', 'PendingReturn'] }
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

// ==================== AI ASSISTANT (ABI) ====================

const ABI_SYSTEM_PROMPT = `You are Abi, the AI Chatbot for Assistance inside the UTAS Borrowing Hub web application.
Your main job for hub-related questions is FAQ-style help: borrowing rules, return deadlines and due dates, resource availability, reservations, payments, returns, notifications, and profile — always grounded in the verified facts below.
You may still answer brief general questions (study tips, technology, everyday topics) when the user is not asking about the hub.
Answer clearly, factually, and in well-formed sentences.

Language rules (critical — follow strictly):
- If the user writes in English, or mostly in English, reply in clear natural English only.
- If the user writes in Arabic, reply in clear Modern Standard Arabic only.
- If the user explicitly asks for English (examples: "in English please", "speak English", "بالإنجليزي", "انجليزي"), your entire reply must be in English only, even if earlier turns were Arabic.
- Use exactly one primary language per reply. Do not mix Arabic and English in the same sentence unless the user explicitly asked for bilingual text.
- Do not insert random words from other languages (no German, French, Vietnamese, Hindi/Devanagari, etc.) unless the user quoted them or asked for them.
- Use correct letters for the chosen language only; avoid gibberish, invented words, and "word salad".

Product-specific answers (critical):
- When the question is about how UTAS Borrowing Hub works (menus, pages, steps, rules shown in the app), use ONLY the facts in the "Verified app facts" block below. Do not invent extra screens, fees, deadlines, university policies, or legal text that are not stated there.
- If the user needs a detail that is not in that block, say you are not sure and tell them which in-app area to open (use the path names from the block, e.g. /payments) or to contact hub staff for campus-specific policy — unless a "[LIVE CATALOG SNAPSHOT]" or "[LIVE MY BORROWS SNAPSHOT]" block is attached to the user message, in which case use that block for lists or personal due dates respectively.
- For general knowledge unrelated to this app, you may answer from general knowledge as usual.`;

const ABI_HUB_KNOWLEDGE = `Verified app facts (UTAS Borrowing Hub — student/staff web app):

Public (no login): Landing "/", login "/login", register "/register", forgot password "/forgot-password", reset password "/reset-password". Registration and password reset use UTAS email domain @utas.edu.om where the app enforces it.

After login, users see a sidebar. Main student/staff routes: Home "/home", Resources catalog "/resources", single resource "/resources/:id", My Borrows "/my-borrows", Reservations "/reservations", Notifications "/notifications", Payments "/payments", Penalties "/penalties", Profile "/profile", Notification settings "/notification-settings".

Roles: "Admin" and "Assistant" use admin pages. Shared admin routes include "/admin/dashboard", "/admin/resources", "/admin/borrows", "/admin/reservations", "/admin/payments", "/admin/penalties". Only "Admin" may use "/admin/users" and "/admin/reports". Regular students/staff are sent to "/home" and cannot open admin routes.

Borrowing: From Resources or a resource detail page, choose an available item, open Borrow, accept terms and conditions, set the due/borrow date as the UI asks. If a refundable security deposit is required, pick a payment method; for Card, the app creates a payment record and the user completes card payment from the Payments page, then staff/admin review. Card flow: user finishes payment in Payments; status becomes Paid and admin is notified. If no card deposit is required, the request still goes through admin approval as designed.

Reservations: From Resources or detail, Reserve, set pickup and expiry dates, accept terms. If a card deposit is required, pay via Payments before admin review.

Returns: My Borrows → active borrow → request return. Physical return must be confirmed by hub staff in the system before it is fully completed.

Notifications: Page "/notifications" shows approvals, rejections, payment events, returns, refunds, and other system messages. "/notification-settings" controls notification preferences where implemented.

Payments: "/payments" lists payment records and supports completing required card payments.

Penalties: "/penalties" shows penalty information when the account has penalties.

Department rule: If a resource has a "department" field set, only users whose profile department matches that resource's department can borrow or reserve it. Admin and Assistant roles bypass this restriction.

Resources list may be filtered by category/college on Home. Resource location in messages defaults to text like "IT Borrowing Hub - Lab 2" when the resource has no custom location.

Home can show announcements from admins. Users may submit feedback/reviews from the Home UI where the review action is offered.

Scanning: Sidebar may expose QR/barcode scan tools for staff/admin workflows (borrow/return/resource management) where the role allows.

Availability: Resource detail can check date availability via the app's availability check before confirming a borrow date.

Live catalog for Abi: If the user's message asks to list, show, or enumerate resources/devices (including "per department" / "كل قسم"), or asks what types/kinds of devices exist (e.g. "what type laptop you have?", "what laptops are available?", "do you have laptops?"), the server may append a "[LIVE CATALOG SNAPSHOT]" block with real rows from the database. Answer only from that snapshot, grouped by its "##" section headers (department or college). Never claim you lack access or that you cannot see the list when that block is present.

My borrows for Abi: If the user's message is about their own loan (return date, how many days left, overdue, "I borrowed", "استعارة"), the server may append a "[LIVE MY BORROWS SNAPSHOT]" block with that user's borrow rows (with resource names and due_date). Answer using those dates only; explain days remaining using the calendar summary lines.`;

const ABI_FULL_SYSTEM_PROMPT = `${ABI_SYSTEM_PROMPT}\n\n${ABI_HUB_KNOWLEDGE}`;

/** Free local LLM via https://ollama.com — set USE_OLLAMA=true in server/.env */
async function abiCompleteWithOllama(systemPrompt, userMessage) {
    const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
    const model = process.env.OLLAMA_MODEL || 'llama3.2:1b';
    const ollamaTemp = Number.isFinite(Number(process.env.OLLAMA_TEMPERATURE))
        ? Math.min(2, Math.max(0, Number(process.env.OLLAMA_TEMPERATURE)))
        : 0.35;
    const controller = new AbortController();
    let timeoutMs = Math.min(Math.max(Number(process.env.OLLAMA_TIMEOUT_MS) || 120000, 5000), 900000);
    if (userMessage.includes('LIVE CATALOG SNAPSHOT') || userMessage.includes('LIVE MY BORROWS')) {
        timeoutMs = Math.max(timeoutMs, 300000);
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                stream: false,
                options: {
                    temperature: ollamaTemp,
                    top_p: 0.9,
                    repeat_penalty: 1.12,
                    num_predict: 1200
                }
            })
        });
        const rawText = await res.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch {
            const err = new Error(`Ollama returned non-JSON (HTTP ${res.status}): ${rawText.slice(0, 200)}`);
            err.status = res.status;
            throw err;
        }
        if (!res.ok) {
            const bodyErr = typeof data?.error === 'string' ? data.error : data?.error?.message;
            const err = new Error(bodyErr || rawText.slice(0, 300) || `Ollama HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return (data?.message?.content || '').trim();
    } finally {
        clearTimeout(timer);
    }
}

/** User-facing hint when Ollama fails (connection vs model runner crash). */
function abiOllamaFailureMessage(baseUrl, model, cause) {
    const causeStr = String(cause || '').trim();
    if (/abort|aborted/i.test(causeStr)) {
        return (
            `Ollama stopped before finishing (request timed out or was cancelled). Model: ${model}. ` +
            `Fix: in server/.env set OLLAMA_TIMEOUT_MS=600000 (10 min) or higher for big catalog questions; lower ABI_CATALOG_MAX_ITEMS (e.g. 60) and ABI_CATALOG_MAX_CHARS; keep the Ollama app running. ` +
            `If OPENROUTER_API_KEY or OPENAI_API_KEY is set, the server can fall back when Ollama fails. Technical: ${causeStr.slice(0, 200)} / انتهت مهلة Ollama: زد OLLAMA_TIMEOUT_MS أو قلّل حجم لقطة الموارد`
        );
    }
    const runnerCrash =
        /exit code|terminated|llama runner|process has terminated|runner process|cuda|gguf|vram|out of memory|cuda error|metal error|vk_error/i.test(
            causeStr
        );
    if (runnerCrash) {
        return (
            `Ollama model crashed while running "${model}" (often not enough VRAM/RAM or a driver issue). ` +
            `Try a smaller model: run "ollama pull phi3" then set OLLAMA_MODEL=phi3 in server/.env (or try llama3.2:1b). ` +
            `Run "ollama run ${model}" in a terminal to see the full error. Update Ollama and GPU drivers. ` +
            `Technical: ${causeStr.slice(0, 200)} / تعطل تشغيل النموذج: جرّب phi3 أو llama3.2:1b، أو عطّل USE_OLLAMA واستخدم OpenRouter (OPENROUTER_API_KEY) أو OpenAI إن وُجد مفتاح.`
        );
    }
    return (
        `Cannot reach Ollama (${baseUrl}). On Windows: open the Ollama app from the Start menu, then run: ollama pull ${model} . ` +
        `If Ollama runs elsewhere, set OLLAMA_BASE_URL. Technical: ${causeStr.slice(0, 220) || 'connection failed'} / شغّل تطبيق Ollama، ثم ollama pull ${model}`
    );
}

/** Reinforce English-only when user asks; helps small local models follow the request. */
function abiAugmentUserMessageForLanguage(message) {
    if (/\b(in english|english please|speak english|reply in english|only english|use english|بالإنجليزي|بالانجليزي|انجليزي)\b/i.test(message)) {
        return `${message}\n\n[Abi: Your reply for this turn must be in English only — clear sentences, no Arabic or other languages.]`;
    }
    return message;
}

/** User wants an inventory-style answer from the live catalog. */
function abiWantsResourceCatalog(message) {
    const t = message.toLowerCase();
    const en =
        /\b(list|show|all|catalog|enumerate|display|give me)\b[\s\S]{0,80}\b(resources?|devices?|equipment|items?)\b/i.test(t) ||
        /\b(resources?|devices?|equipment)\b[\s\S]{0,80}\b(list|catalog|all|every|each|per department|by department|grouped)\b/i.test(t) ||
        /\b(what|which)\b[\s\S]{0,50}\b(resources?|devices?)\b[\s\S]{0,60}\b(available|borrow|in the hub|in the system)\b/i.test(t) ||
        // "What type laptop you have?", "what laptops are there?", "do you have laptops?"
        /\bwhat\b[\s\S]{0,120}\b(laptop|laptops|notebook|chromebook|macbook|device|devices|equipment|resource|resources|item|items)\b/i.test(t) ||
        /\b(what|which)\s+(kind|type|sort|kinds|types)\s+of\b[\s\S]{0,100}\b(laptop|laptops|notebook|device|devices|equipment|resources?)\b/i.test(t) ||
        /\b(do you have|have you got|have you|is there|are there|got any)\b[\s\S]{0,120}\b(laptop|laptops|notebook|device|devices|equipment|resources?)\b/i.test(t) ||
        /\b(show|list|give)\s+me\b[\s\S]{0,80}\b(laptop|laptops|devices?|equipment|resources?)\b/i.test(t) ||
        /\b(laptop|laptops|notebook|chromebook)\b[\s\S]{0,60}\b(available|borrow|have|you have|in stock|list)\b/i.test(t);
    const ar =
        /قائمة|كل الموارد|قائمه الموارد|عرض الموارد|ما هي الموارد|الموارد المتاحة|موارد كل قسم|لكل قسم|حسب القسم|بالأقسام|الأقسام|الاقسام|اذكر الموارد|اذكر الاجهزة|الأجهزة المتاحة|لابتوب|لاب توب|حاسوب محمول|ما نوع|أي أجهزة|أي موارد/i.test(
            message
        );
    return !!(en || ar);
}

/** Pull a compact catalog from DB so Abi can list real resources (grouped by department/college). */
async function abiBuildLiveCatalogAppendix(message) {
    if (!abiWantsResourceCatalog(message)) return '';
    const maxItems = Math.min(250, Math.max(10, Number(process.env.ABI_CATALOG_MAX_ITEMS) || 80));
    const laptopFocus =
        /\b(laptop|laptops|notebook|chromebook|macbook|ultrabook)\b/i.test(message) ||
        /\b(لابتوب|لاب توب|حاسوب محمول)\b/i.test(message);

    const selectFields = 'name category college department status available_quantity total_quantity description';
    const sortSpec = { department: 1, college: 1, name: 1 };

    let rows;
    if (laptopFocus) {
        const laptopRegex = /laptop|notebook|chromebook|macbook|ultrabook|حاسوب|لابتوب|لاب توب/i;
        rows = await ResourceModel.find({
            $or: [
                { name: laptopRegex },
                { description: laptopRegex },
                { category: { $regex: /^(IT|Electronics)$/i } }
            ]
        })
            .select(selectFields)
            .sort(sortSpec)
            .limit(maxItems)
            .lean();
        if (!rows.length) {
            rows = await ResourceModel.find({})
                .select(selectFields)
                .sort(sortSpec)
                .limit(maxItems)
                .lean();
        }
    } else {
        rows = await ResourceModel.find({})
            .select(selectFields)
            .sort(sortSpec)
            .limit(maxItems)
            .lean();
    }

    if (!rows.length) {
        return '[LIVE CATALOG SNAPSHOT: The database returned no resource rows. Say that the catalog is empty or you could not load items.]';
    }

    const groups = new Map();
    for (const r of rows) {
        const dept = (r.department && String(r.department).trim()) || '';
        const coll = (r.college && String(r.college).trim()) || '';
        const key = dept || coll || 'General (no department set)';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
    }

    const lines = [
        '[LIVE CATALOG SNAPSHOT — data from the UTAS Borrowing Hub database right now. Use ONLY this list to answer. Do not say you lack access. Present clearly grouped by the ## section headers (department or college).]',
        laptopFocus
            ? '[FILTER HINT: User asked about laptops / similar devices — prioritize rows whose name or category clearly match laptops or IT-style devices; if the list includes non-laptops, say those are other IT resources in the same snapshot.]'
            : '',
        `Total resources in this snapshot: ${rows.length} (may be truncated if the catalog is large).`,
        ''
    ].filter(Boolean);

    const sortedKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    for (const key of sortedKeys) {
        lines.push(`## ${key}`);
        for (const r of groups.get(key)) {
            const avail = r.available_quantity ?? 0;
            const tot = r.total_quantity ?? 1;
            lines.push(
                `- ${r.name} | category: ${r.category} | status: ${r.status} | available: ${avail}/${tot}`
            );
        }
        lines.push('');
    }

    let out = lines.join('\n');
    const maxChars = Math.min(28000, Math.max(2000, Number(process.env.ABI_CATALOG_MAX_CHARS) || 10000));
    if (out.length > maxChars) {
        out = `${out.slice(0, maxChars)}\n…(snapshot truncated; ask the user to open Resources in the app for the full searchable catalog.)`;
    }
    return out;
}

function abiDueSummaryLine(dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const days = Math.ceil(diffMs / 86400000);
    if (days > 1) return `${days} calendar days remaining until the due date`;
    if (days === 1) return '1 calendar day remaining until the due date';
    if (days === 0) return 'due today — user should return per hub rules and use My Borrows if a return request is needed';
    return `overdue by ${Math.abs(days)} calendar day(s) — user should return as soon as possible`;
}

function abiWantsMyBorrowsContext(message) {
    const t = message.toLowerCase();
    const en =
        /\b(my borrow|my borrows|i borrowed|i have borrowed|i have borrow|i've borrowed|when (do|should|must) i return|how many days.*return|days.*(return|left)|due date|is it due|overdue|pending return|active borrow|return it back|return this)\b/i.test(t) ||
        /\b(how long|how many days)\b[\s\S]{0,60}\b(borrow|borrowed|return|due|keep|have|back)\b/i.test(t) ||
        /\bthis resource\b[\s\S]{0,100}\b(return|days|due|borrow|back)\b/i.test(t);
    const ar =
        /استعارت|استعار|مستعير|مُستعير|استعارة|إرجاع|ارجاع|متى أرجع|متى ارجع|كم يوم|عدد أيام|موعد الإرجاع|موعد الارجاع|تاريخ الإرجاع|التسليم|الاستحقاق|تأخير|متأخر|هذا المورد|هذا الجهاز/i.test(
            message
        );
    return !!(en || ar);
}

/** Current user's borrow rows so Abi can answer due dates / days left accurately. */
async function abiBuildMyBorrowsAppendix(message, userId) {
    if (!abiWantsMyBorrowsContext(message)) return '';
    const statuses = ['Active', 'Claimed', 'PendingReturn', 'Overdue', 'PendingApproval'];
    const borrows = await BorrowModel.find({ user_id: userId, status: { $in: statuses } })
        .populate('resource_id', 'name max_borrow_days category')
        .sort({ due_date: 1 })
        .limit(40)
        .lean();

    if (!borrows.length) {
        return '[LIVE MY BORROWS SNAPSHOT: No borrow rows in Active / Pending approval / Pending return / Overdue for this user. Suggest opening My Borrows in the app to confirm history.]';
    }

    const lines = [
        '[LIVE MY BORROWS SNAPSHOT — database rows for this logged-in user only. Use them to answer how many days until return, due dates, overdue status, and device names. Do not invent borrows.]',
        ''
    ];
    for (const b of borrows) {
        const res = b.resource_id;
        const resName = res?.name || '(unknown resource)';
        const maxBorrow = res?.max_borrow_days ?? 'n/a';
        const dueStr = b.due_date ? new Date(b.due_date).toISOString().slice(0, 10) : 'n/a';
        const borrowStr = b.borrow_date ? new Date(b.borrow_date).toISOString().slice(0, 10) : 'n/a';
        lines.push(`- Resource: ${resName}`);
        lines.push(`  borrow status: ${b.status}`);
        lines.push(`  borrow_date: ${borrowStr}`);
        lines.push(`  due_date (return by): ${dueStr}`);
        lines.push(`  borrow_duration_days (stored on record): ${b.borrow_duration_days ?? 'n/a'}; resource max_borrow_days: ${maxBorrow}`);
        lines.push(`  calendar vs now: ${b.due_date ? abiDueSummaryLine(b.due_date) : 'n/a'}`);
        lines.push('');
    }
    return lines.join('\n');
}

/** OpenAI-compatible chat (direct OpenAI or OpenRouter https://openrouter.ai ). */
async function abiChatCompletionCompatible({ apiKey, baseURL, model, systemPrompt, userContent }) {
    const temperature = Number.isFinite(Number(process.env.OPENAI_TEMPERATURE))
        ? Math.min(2, Math.max(0, Number(process.env.OPENAI_TEMPERATURE)))
        : 0.45;
    const isOpenRouter = typeof baseURL === 'string' && baseURL.includes('openrouter.ai');
    const client = new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL: baseURL.replace(/\/$/, '') } : {}),
        ...(isOpenRouter
            ? {
                  defaultHeaders: {
                      'HTTP-Referer':
                          process.env.OPENROUTER_HTTP_REFERER ||
                          process.env.FRONTEND_URL ||
                          'http://localhost:3000',
                      'X-Title': process.env.OPENROUTER_APP_TITLE || 'UTAS Borrowing Hub'
                  }
              }
            : {})
    });
    const completion = await client.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ],
        max_tokens: 1200,
        temperature
    });
    return (completion.choices?.[0]?.message?.content || '').trim();
}

app.post("/assistant/abi-chat", async (req, res) => {
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

        const raw = req.body?.message;
        const message = typeof raw === 'string' ? raw.trim() : '';
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }
        if (message.length > 12000) {
            return res.status(400).json({ success: false, message: 'Message is too long' });
        }

        const useOllama = ['1', 'true', 'yes'].includes(String(process.env.USE_OLLAMA || '').toLowerCase());
        const openaiApiKey = String(process.env.OPENAI_API_KEY || '').trim();
        const openrouterApiKey = String(process.env.OPENROUTER_API_KEY || '').trim();
        const openrouterBase =
            String(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '') || 'https://openrouter.ai/api/v1';
        const openrouterModel = process.env.OPENROUTER_MODEL || 'inclusionai/ring-2.6-1t:free';
        const hasCloudFallback = !!(openrouterApiKey || openaiApiKey);

        const modelUserMessage = abiAugmentUserMessageForLanguage(message);
        const appendixParts = [];
        const catalogAppendix = await abiBuildLiveCatalogAppendix(message);
        if (catalogAppendix) appendixParts.push(catalogAppendix);
        const borrowsAppendix = await abiBuildMyBorrowsAppendix(message, user._id);
        if (borrowsAppendix) appendixParts.push(borrowsAppendix);
        const sentUserMessage =
            appendixParts.length > 0
                ? `${modelUserMessage}\n\n---\n\n${appendixParts.join('\n\n---\n\n')}`
                : modelUserMessage;

        let reply = '';

        if (useOllama) {
            try {
                reply = await abiCompleteWithOllama(ABI_FULL_SYSTEM_PROMPT, sentUserMessage);
            } catch (ollamaErr) {
                console.error('Abi Ollama error:', ollamaErr);
                if (!hasCloudFallback) {
                    const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
                    const model = process.env.OLLAMA_MODEL || 'llama3.2:1b';
                    const cause = String(ollamaErr?.message || ollamaErr || '').trim();
                    return res.status(503).json({
                        success: false,
                        message: abiOllamaFailureMessage(baseUrl, model, cause)
                    });
                }
                console.warn('Abi: Ollama failed; trying OpenRouter / OpenAI.', ollamaErr?.message);
            }
        }

        if (!reply && openrouterApiKey) {
            try {
                reply = await abiChatCompletionCompatible({
                    apiKey: openrouterApiKey,
                    baseURL: openrouterBase,
                    model: openrouterModel,
                    systemPrompt: ABI_FULL_SYSTEM_PROMPT,
                    userContent: sentUserMessage
                });
            } catch (orErr) {
                console.warn('Abi: OpenRouter request failed.', orErr?.message || orErr);
            }
        }

        if (!reply && openaiApiKey) {
            try {
                reply = await abiChatCompletionCompatible({
                    apiKey: openaiApiKey,
                    baseURL: undefined,
                    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                    systemPrompt: ABI_FULL_SYSTEM_PROMPT,
                    userContent: sentUserMessage
                });
            } catch (oaErr) {
                console.warn('Abi: direct OpenAI request failed.', oaErr?.message || oaErr);
            }
        }

        if (!reply) {
            if (!useOllama && !hasCloudFallback) {
                return res.status(503).json({
                    success: false,
                    message:
                        'Abi chat is not configured. Add OPENROUTER_API_KEY (https://openrouter.ai) and OPENROUTER_MODEL, or OPENAI_API_KEY, or set USE_OLLAMA=true with a local Ollama model. Restart the server after editing server/.env. / أضف OPENROUTER_API_KEY أو OPENAI_API_KEY أو USE_OLLAMA=true'
                });
            }
            return res.status(502).json({ success: false, message: 'No reply from the language model.' });
        }

        res.json({ success: true, data: { reply } });
    } catch (error) {
        console.error('Abi chat error:', error);
        const httpStatus = error?.status;
        if (httpStatus === 429) {
            return res.status(429).json({
                success: false,
                message:
                    'Rate or quota limit (429) from the model provider. If you use OpenRouter, check credits at https://openrouter.ai/credits ; for OpenAI see https://platform.openai.com/account/billing — then try again. / تحقق من الرصيد في OpenRouter أو OpenAI'
            });
        }
        if (httpStatus === 401) {
            return res.status(502).json({
                success: false,
                message:
                    'Invalid API key (401). Check OPENROUTER_API_KEY or OPENAI_API_KEY in server/.env. / تحقق من مفتاح OpenRouter أو OpenAI'
            });
        }
        const msg = error?.message || 'Chat request failed';
        return res.status(typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 600 ? httpStatus : 500).json({
            success: false,
            message: msg
        });
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
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { response, status } = req.body;
        const trimmedResponse = typeof response === 'string' ? response.trim() : '';
        if (!trimmedResponse) {
            return res.status(400).json({ success: false, message: 'Response text is required' });
        }

        const feedback = await FeedbackModel.findByIdAndUpdate(
            req.params.id,
            {
                admin_response: trimmedResponse,
                status: status || 'Reviewed',
                responded_by: user._id,
                updated_at: Date.now()
            },
            { new: true }
        ).populate('user_id', 'full_name email');

        if (!feedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        try {
            const recipientId = feedback.user_id?._id || feedback.user_id;
            if (recipientId) {
                const adminName = user.full_name || user.email || 'Administrator';
                const excerpt =
                    trimmedResponse.length > 1500 ? `${trimmedResponse.slice(0, 1500)}…` : trimmedResponse;
                await NotificationModel.create({
                    user_id: recipientId,
                    title: 'Reply to your feedback',
                    message: `${adminName}:\n\n${excerpt}`,
                    type: 'Success',
                    related_type: 'System'
                });
            }
        } catch (notifyErr) {
            console.error('Feedback user notification error:', notifyErr);
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

        // Match audience to app roles (User.role uses "Student", not "Students")
        const audienceOr = [{ target_audience: 'All' }];
        if (user.role === 'Student') {
            audienceOr.push({ target_audience: 'Student' }, { target_audience: 'Students' });
        } else {
            audienceOr.push({ target_audience: user.role });
        }

        const query = {
            is_active: { $ne: false },
            $or: audienceOr
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

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

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

app.post("/admin/announcements", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const user = await UserModel.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        if (!['Admin', 'Assistant'].includes(user.role)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { title, message, priority, target_audience } = req.body || {};
        const titleTrim = typeof title === 'string' ? title.trim() : '';
        const messageTrim = typeof message === 'string' ? message.trim() : '';
        if (!titleTrim || !messageTrim) {
            return res.status(400).json({
                success: false,
                message: 'Title and message are required'
            });
        }

        const allowedPriority = ['Low', 'Normal', 'Medium', 'High'];
        const p = allowedPriority.includes(priority) ? priority : 'Normal';

        let ta = typeof target_audience === 'string' ? target_audience.trim() : 'All';
        if (ta === 'Students') ta = 'Student';
        const allowedAudience = ['All', 'Student', 'Staff', 'Admin', 'Assistant'];
        if (!allowedAudience.includes(ta)) ta = 'All';

        const announcement = new AnnouncementModel({
            title: titleTrim,
            message: messageTrim,
            priority: p,
            target_audience: ta,
            created_by: user._id
        });

        await announcement.save();

        res.status(201).json({ success: true, data: announcement });
    } catch (error) {
        console.error('Create announcement error:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors || {})
                .map((e) => e.message)
                .join(', ');
            return res.status(400).json({ success: false, message: messages || error.message });
        }
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
            .sort({ borrow_date: -1 })
            .limit(200);

        const fmtDate = (d) => {
            if (!d) return 'N/A';
            const t = new Date(d).getTime();
            return Number.isNaN(t) ? 'N/A' : new Date(d).toISOString().slice(0, 10);
        };

        const reportData = {
            generated_at: new Date().toISOString(),
            period: { start: startDate || 'All', end: endDate || 'All' },
            total_borrows: borrows.length,
            borrows: borrows.map((b) => ({
                user: b.user_id?.full_name || 'N/A',
                email: b.user_id?.email || '',
                department: b.user_id?.department || '',
                role: b.user_id?.role || '',
                resource: b.resource_id?.name || 'N/A',
                category: b.resource_id?.category || 'N/A',
                resource_status: b.resource_id?.status || '',
                barcode: b.resource_id?.barcode || '',
                borrow_date: fmtDate(b.borrow_date),
                due_date: fmtDate(b.due_date),
                return_date: b.return_date ? fmtDate(b.return_date) : 'N/A',
                status: b.status,
                payment_status: b.payment_status || ''
            }))
        };

        const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=report_${Date.now()}.csv`);

            let csv =
                '\uFEFFUser,Email,Department,Role,Resource,Category,ResourceStatus,Barcode,BorrowDate,DueDate,ReturnDate,Status,PaymentStatus\n';
            reportData.borrows.forEach((b) => {
                csv += [
                    csvEscape(b.user),
                    csvEscape(b.email),
                    csvEscape(b.department),
                    csvEscape(b.role),
                    csvEscape(b.resource),
                    csvEscape(b.category),
                    csvEscape(b.resource_status),
                    csvEscape(b.barcode),
                    csvEscape(b.borrow_date),
                    csvEscape(b.due_date),
                    csvEscape(b.return_date),
                    csvEscape(b.status),
                    csvEscape(b.payment_status)
                ].join(',');
                csv += '\n';
            });

            return res.send(csv);
        }

        if (format === 'xlsx' || format === 'xls') {
            const [totalUsers, totalResources] = await Promise.all([
                UserModel.countDocuments({}),
                ResourceModel.countDocuments({})
            ]);

            const statusCounts = borrows.reduce((acc, b) => {
                acc[b.status] = (acc[b.status] || 0) + 1;
                return acc;
            }, {});

            const summaryRows = [
                { Metric: 'Generated (UTC)', Value: reportData.generated_at },
                { Metric: 'Period start', Value: String(startDate || 'All') },
                { Metric: 'Period end', Value: String(endDate || 'All') },
                { Metric: 'Users (total in system)', Value: totalUsers },
                { Metric: 'Resources (total in system)', Value: totalResources },
                { Metric: 'Borrow rows (this export)', Value: borrows.length },
                ...Object.keys(statusCounts)
                    .sort()
                    .map((k) => ({ Metric: `Borrow status: ${k}`, Value: statusCounts[k] }))
            ];

            const detailRows = borrows.map((b) => ({
                User: b.user_id?.full_name || 'N/A',
                Email: b.user_id?.email || '',
                Department: b.user_id?.department || '',
                Role: b.user_id?.role || '',
                Resource: b.resource_id?.name || 'N/A',
                Category: b.resource_id?.category || '',
                ResourceStatus: b.resource_id?.status || '',
                Barcode: b.resource_id?.barcode || '',
                QRCode: b.resource_id?.qr_code || '',
                BorrowDate: fmtDate(b.borrow_date),
                DueDate: fmtDate(b.due_date),
                ReturnDate: b.return_date ? fmtDate(b.return_date) : 'N/A',
                Status: b.status,
                PaymentStatus: b.payment_status || ''
            }));

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(
                    detailRows.length ? detailRows : [{ User: '', Resource: '', Status: 'No borrow rows for filters' }]
                ),
                'Borrows'
            );

            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader('Content-Disposition', `attachment; filename=report_${Date.now()}.xlsx`);
            return res.send(Buffer.from(buf));
        }

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=report_${Date.now()}.json`);
            return res.json(reportData);
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=report_${Date.now()}.csv`);
        let csvFallback =
            '\uFEFFUser,Email,Department,Role,Resource,Category,ResourceStatus,Barcode,BorrowDate,DueDate,ReturnDate,Status,PaymentStatus\n';
        reportData.borrows.forEach((b) => {
            csvFallback += [
                csvEscape(b.user),
                csvEscape(b.email),
                csvEscape(b.department),
                csvEscape(b.role),
                csvEscape(b.resource),
                csvEscape(b.category),
                csvEscape(b.resource_status),
                csvEscape(b.barcode),
                csvEscape(b.borrow_date),
                csvEscape(b.due_date),
                csvEscape(b.return_date),
                csvEscape(b.status),
                csvEscape(b.payment_status)
            ].join(',');
            csvFallback += '\n';
        });
        return res.send(csvFallback);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== HEALTH CHECK ====================

app.get("/health", (req, res) => {
    res.send({ status: 'OK', message: 'UTAS Borrowing Hub API is running' });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
const MONGO_CONNECT_TIMEOUT_MS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000);

function configureMongoDnsIfNeeded() {
    const raw = process.env.MONGO_DNS_SERVERS;
    if (!raw || !raw.trim()) return;
    const servers = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (servers.length > 0) {
        dns.setServers(servers);
    }
}

async function connectMongoOrExit() {
    const mongoUri =
        (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) ||
        (process.env.MONGO_URI && process.env.MONGO_URI.trim());

    if (!mongoUri) {
        console.error('\n❌ Missing MongoDB connection string.');
        console.error(
            'Set MONGODB_URI (or MONGO_URI) in server/.env — e.g. Atlas mongodb+srv://... or mongodb://...'
        );
        process.exit(1);
    }

    mongoose.set('bufferCommands', false);
    configureMongoDnsIfNeeded();

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS
        });
        console.log('Connected to MongoDB successfully.');
    } catch (err) {
        console.error('\n❌ Cannot connect to MongoDB. The API will not start.');
        console.error(`   URI host starts with: ${mongoUri.replace(/^[^:]+:[^@]+@/, '***:***@').slice(0, 80)}…`);
        console.error(`   ${err.message}`);
        console.error('\nFix checklist (most common first):');
        console.error(
            '   1) MongoDB Atlas → Network Access → add your current public IP (or 0.0.0.0/0 for dev only).'
        );
        console.error('      https://www.mongodb.com/docs/atlas/security-ip-access-list/');
        console.error('   2) Confirm username/password in the URI (Database Access user, not Atlas UI login).');
        console.error('   3) VPN / firewall / corporate network blocking outbound 27017 to Atlas.');
        console.error(
            '   4) Local dev without Atlas: run MongoDB locally and set MONGODB_URI=mongodb://127.0.0.1:27017/UTAS-BORROWING-HUB'
        );
        console.error(
            `   5) Increase wait time if slow network: MONGO_CONNECT_TIMEOUT_MS=${Math.max(MONGO_CONNECT_TIMEOUT_MS, 30000)}`
        );
        if (/querySrv\s+ECONNREFUSED/i.test(err.message)) {
            console.error(
                '   6) querySrv ECONNREFUSED: your router/DNS may block SRV lookups from Node. Add to server/.env:'
            );
            console.error('      MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1');
            console.error('      Or set Windows DNS to 8.8.8.8 / 1.1.1.1, then restart the terminal.');
        }
        process.exit(1);
    }
}

async function startServer() {
    await connectMongoOrExit();

    app.listen(PORT, () => {
        console.log(`Server started at ${PORT}..`);
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
}

startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
