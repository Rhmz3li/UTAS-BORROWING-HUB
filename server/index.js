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

const conStr = "mongodb+srv://utas_db:1234@cluster0.eate6en.mongodb.net/UTAS-BORROWING-HUB?retryWrites=true&w=majority&appName=Cluster0";
mongoose
  .connect(conStr)
  .then(() => {
    console.log("Connected to MongoDB successfully!");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

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

// Configure nodemailer (using Gmail as example - you should use environment variables)
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
            
            transporter = nodemailer.createTransport({
                service: 'gmail',
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

// Forgot Password - Send reset link
app.post("/forgot-password", async (req, res) => {
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
        const user = await UserModel.findOne({ email: sanitizedEmail });
        
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

        // Access check: department-only (unless Admin/Assistant). If resource has a department, user must match exactly.
        if (!['Admin', 'Assistant'].includes(user.role)) {
            if (resource.department && resource.department.trim() !== '') {
                const userDept = (user.department || '').trim().toLowerCase();
                const resourceDept = resource.department.trim().toLowerCase();

                if (!userDept || userDept !== resourceDept) {
                    return res.status(403).json({ 
                        success: false, 
                        message: `You can only borrow resources from your department. Your department is "${user.department || 'Not assigned'}", but this resource belongs to "${resource.department}" department. Please contact admin to update your department information.` 
                    });
                }
            }
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

        // Notify user that request is pending approval
        await NotificationModel.create({
            user_id: user._id,
            title: 'Borrow Request Submitted',
            message: `Your borrow request for ${resource.name} has been submitted and is pending admin approval. You will be notified once it's approved. ${resource.requires_payment && resource.payment_amount > 0 ? `Payment of ${resource.payment_amount} OMR via ${payment_method} will be processed upon approval.` : ''}`,
            type: 'Info',
            related_type: 'Borrow',
            related_id: newBorrow._id
        });

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

        if (borrow.user_id.toString() !== user._id.toString() && !['Admin', 'Assistant'].includes(user.role)) {
            return res.status(500).json({ message: "Not authorized" });
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
            await NotificationModel.create({
                user_id: reservation.user_id._id,
                title: 'Resource Available',
                message: `The resource "${resource.name}" you reserved is now available for pickup!`,
                type: 'Info',
                related_type: 'Reservation',
                related_id: reservation._id
            });
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

            // Send notification about penalty
            await NotificationModel.create({
                user_id: borrow.user_id,
                title: 'Penalty Applied',
                message: `A penalty of ${fineAmount} OMR has been applied: ${description}. Please settle your penalty.`,
                type: 'Warning',
                related_type: 'Penalty',
                related_id: penalty._id
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

        // Access check: department-only (unless Admin/Assistant). If resource has a department, user must match exactly.
        if (!['Admin', 'Assistant'].includes(user.role)) {
            if (resource.department && resource.department.trim() !== '') {
                const userDept = (user.department || '').trim().toLowerCase();
                const resourceDept = resource.department.trim().toLowerCase();

                if (!userDept || userDept !== resourceDept) {
                    return res.status(403).json({ 
                        success: false, 
                        message: `You can only reserve resources from your department. Your department is "${user.department || 'Not assigned'}", but this resource belongs to "${resource.department}" department. Please contact admin to update your department information.` 
                    });
                }
            }
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

        // RESERVE: Don't decrease quantity - only reserve for future pickup
        // Quantity will be decreased when reservation is confirmed and picked up
        // This allows the resource to remain available for others until pickup date
        // No quantity change here - reservation is just a booking for future date

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

        // Send notification to user
        await NotificationModel.create({
            user_id: reservation.user_id._id,
            title: 'Reservation Confirmed',
            message: `Your reservation for "${resource.name}" has been confirmed. Please pick it up on ${pickupDate.toLocaleDateString()} from ${resource.location || 'IT Borrowing Hub - Lab 2'}. The resource is now reserved for you.`,
            type: 'Success',
            related_type: 'Reservation',
            related_id: reservation._id
        });

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
            terms_accepted_at: reservationUser.terms_accepted_at || new Date()
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
        reservation.updated_at = new Date();
        await reservation.save();

        // Send notification to user
        await NotificationModel.create({
            user_id: reservation.user_id._id,
            title: 'Borrow Approved',
            message: `Your reservation for "${resource.name}" has been approved and converted to a borrow. Due date: ${finalDueDate.toLocaleDateString()}.`,
            type: 'Success',
            related_type: 'Borrow',
            related_id: newBorrow._id
        });

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

        // Update payment status if payment was made
        if (borrow.payment_id) {
            const payment = await PaymentModel.findById(borrow.payment_id);
            if (payment && payment.status === 'Pending') {
                payment.status = 'Completed';
                payment.processed_by = admin._id;
                await payment.save();
            }
        }

        // Update related reservations
        await ReservationModel.updateMany(
            { user_id: borrow.user_id._id, resource_id: borrow.resource_id._id, status: { $in: ['Pending', 'Confirmed'] } },
            { status: 'Completed', updated_at: Date.now() }
        );

        // Notify user
        await NotificationModel.create({
            user_id: borrow.user_id._id,
            title: 'Borrow Approved',
            message: `Your borrow request for ${resource.name} has been approved. Please pick it up from: ${resource.location || 'IT Borrowing Hub - Lab 2'}. Due date: ${new Date(borrow.due_date).toLocaleDateString()}. ${borrow.requires_payment && borrow.payment_status === 'Pending' ? 'Payment has been processed.' : ''}`,
            type: 'Success',
            related_type: 'Borrow',
            related_id: borrow._id
        });

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

        // Notify user about rejection
        await NotificationModel.create({
            user_id: borrow.user_id._id,
            title: 'Borrow Request Rejected',
            message: `Your borrow request for ${borrow.resource_id.name} has been rejected. ${reason ? `Reason: ${reason}` : ''}`,
            type: 'Error',
            related_type: 'Borrow',
            related_id: null
        });

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

        await NotificationModel.create({
            user_id: penalty.user_id,
            title: 'Penalty Waived',
            message: `Your penalty of ${penalty.fine_amount} OMR has been waived. Reason: ${penalty.waived_reason}`,
            type: 'Success',
            related_type: 'Penalty',
            related_id: penalty._id
        });

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
            
            await NotificationModel.create({
                user_id: penalty.user_id,
                title: 'Penalty Waived',
                message: `Your penalty of ${penalty.fine_amount} OMR has been waived. Reason: ${penalty.waived_reason}`,
                type: 'Success',
                related_type: 'Penalty',
                related_id: penalty._id
            });
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

// ==================== UPDATE PROFILE ====================

app.put("/profile", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key-change-in-production');
        const { full_name, phone, department, avatar } = req.body;
        
        const user = await UserModel.findByIdAndUpdate(
            decoded.id,
            { full_name, phone, department, avatar, updated_at: Date.now() },
            { new: true }
        ).select('-password');

        res.send({ success: true, user });
    } catch (error) {
        res.send(error);
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
        const resource = await ResourceModel.findOne({
            $or: [{ barcode: code }, { qr_code: code }]
        });

        if (!resource) {
            return res.status(500).json({ message: "Resource not found" });
        }

        res.send({ success: true, data: resource });
    } catch (error) {
        res.send(error);
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

        const { startDate, endDate } = req.query;
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.borrow_date = {};
            if (startDate) dateFilter.borrow_date.$gte = new Date(startDate);
            if (endDate) dateFilter.borrow_date.$lte = new Date(endDate);
        }

        // Total Borrows
        const totalBorrows = await BorrowModel.countDocuments(dateFilter);

        // Total Returns
        const totalReturns = await BorrowModel.countDocuments({
            status: 'Returned',
            return_date: { $exists: true },
            ...(startDate || endDate ? {
                return_date: {
                    ...(startDate ? { $gte: new Date(startDate) } : {}),
                    ...(endDate ? { $lte: new Date(endDate) } : {})
                }
            } : {})
        });

        // Overdue Items
        const overdueItems = await BorrowModel.countDocuments({
            status: 'Overdue'
        });

        // Total Revenue
        const revenueData = await PaymentModel.aggregate([
            { $match: { status: 'Completed', ...(startDate || endDate ? {
                created_at: {
                    ...(startDate ? { $gte: new Date(startDate) } : {}),
                    ...(endDate ? { $lte: new Date(endDate) } : {})
                }
            } : {}) } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

        // Most Borrowed Resources
        const mostBorrowed = await BorrowModel.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$resource_id', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'resources',
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

        // Department Statistics
        // First get all users grouped by department
        const usersByDept = await UserModel.aggregate([
            { $match: { department: { $exists: true, $ne: null, $ne: '' } } },
            { $group: { 
                _id: '$department', 
                userIds: { $push: '$_id' },
                users: { $sum: 1 } 
            } }
        ]);

        // Then get borrow counts for each department
        const departmentStats = await Promise.all(
            usersByDept.map(async (dept) => {
                const borrowQuery = {
                    user_id: { $in: dept.userIds }
                };
                if (dateFilter.borrow_date) {
                    borrowQuery.borrow_date = dateFilter.borrow_date;
                }
                const borrowCount = await BorrowModel.countDocuments(borrowQuery);
                return {
                    department: dept._id,
                    users: dept.users,
                    borrows: borrowCount
                };
            })
        );
        
        // Sort by users descending
        departmentStats.sort((a, b) => b.users - a.users);

        // User Trends (Last 6 months)
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
                trend: i === 5 ? 0 : Math.round(Math.random() * 20 - 10) // Placeholder for trend calculation
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
                userTrends
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

        const { format, startDate, endDate } = req.query;

        // For now, return JSON. In production, use libraries like pdfkit, exceljs, or csv-writer
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.created_at = {};
            if (startDate) dateFilter.created_at.$gte = new Date(startDate);
            if (endDate) dateFilter.created_at.$lte = new Date(endDate);
        }

        const borrows = await BorrowModel.find(dateFilter)
            .populate('user_id', 'full_name email')
            .populate('resource_id', 'name category')
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
    res.send({ status: 'OK', message: 'UTAS Borrowing Hub API is running' });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server started at ${PORT}..`);
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
