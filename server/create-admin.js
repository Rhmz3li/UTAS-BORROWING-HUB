import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import UserModel from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const conStr = "mongodb+srv://utas_db:1234@cluster0.eate6en.mongodb.net/UTAS-BORROWING-HUB?appName=Cluster0";

// Default admin credentials - using strong password that meets requirements
const adminEmail = 'admin@utas.edu.om';
const adminPassword = 'Admin123!@#'; // Strong password: 8+ chars, uppercase, lowercase, number, special char
const adminName = 'System Administrator';

async function createAdmin() {
    try {
        await mongoose.connect(conStr);
        console.log("Connected to MongoDB");

        // Normalize email to lowercase (schema will do this, but doing it explicitly for consistency)
        const normalizedEmail = adminEmail.trim().toLowerCase();

        // Check if admin already exists
        const existingAdmin = await UserModel.findOne({ email: normalizedEmail });
        if (existingAdmin) {
            console.log('Admin account already exists!');
            console.log('Resetting password to default...\n');
            
            // Reset password to default
            const hpass = await bcrypt.hash(adminPassword, 10);
            existingAdmin.password = hpass;
            existingAdmin.status = 'Active';
            existingAdmin.role = 'Admin';
            existingAdmin.full_name = adminName; // Update name in case it changed
            await existingAdmin.save();
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✓ Admin password reset successfully!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('Admin Login Credentials:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('Email:', normalizedEmail);
            console.log('Password:', adminPassword);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('⚠️  IMPORTANT: Change the password after first login!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Create admin account
        const hpass = await bcrypt.hash(adminPassword, 10);
        const admin = new UserModel({
            email: normalizedEmail,
            password: hpass,
            full_name: adminName.trim(),
            role: 'Admin',
            status: 'Active'
        });

        await admin.save();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✓ Admin account created successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Admin Login Credentials:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Email:', normalizedEmail);
        console.log('Password:', adminPassword);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️  IMPORTANT: Change the password after first login!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error creating admin:');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (error.name === 'ValidationError') {
            console.error('Validation Error:');
            Object.keys(error.errors).forEach(key => {
                console.error(`  - ${key}: ${error.errors[key].message}`);
            });
        } else if (error.code === 11000) {
            console.error('Duplicate Error: Email already exists in database');
        } else if (error.message) {
            console.error('Error Message:', error.message);
        } else {
            console.error('Full Error:', error);
        }
        
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

createAdmin();

