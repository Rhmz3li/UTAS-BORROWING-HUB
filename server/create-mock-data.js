import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import UserModel from './models/User.js';
import ResourceModel from './models/Resource.js';
import BorrowModel from './models/Borrow.js';
import PenaltyModel from './models/Penalty.js';
import ReservationModel from './models/Reservation.js';
import PaymentModel from './models/Payment.js';

const conStr = "mongodb+srv://admin123:admin123@utas-borrowing-hub.qlzohvg.mongodb.net/UTAS-BORROWING-HUB?retryWrites=true&w=majority&appName=UTAS-BORROWING-HUB";

async function createMockData() {
  try {
    await mongoose.connect(conStr);
    console.log('Connected to MongoDB');

    // 1) Create demo users (student + staff) if not exist
    const users = [];

    const ensureUser = async ({ email, password, full_name, role, student_id, employee_id, department }) => {
      const normalizedEmail = email.trim().toLowerCase();
      let user = await UserModel.findOne({ email: normalizedEmail });
      if (!user) {
        const hashed = await bcrypt.hash(password, 10);
        user = new UserModel({
          email: normalizedEmail,
          password: hashed,
          full_name,
          role,
          student_id,
          employee_id,
          identification_id: student_id || employee_id,
          department,
          status: 'Active'
        });
        await user.save();
        console.log(`✓ Created user: ${normalizedEmail} (${role})`);
      } else {
        // Reset password and basic info so you always know the demo credentials
        const hashed = await bcrypt.hash(password, 10);
        user.password = hashed;
        user.full_name = full_name;
        user.role = role;
        if (student_id) {
          user.student_id = student_id;
          user.identification_id = student_id;
        }
        if (employee_id) {
          user.employee_id = employee_id;
          user.identification_id = employee_id;
        }
        if (department) {
          user.department = department;
        }
        user.status = 'Active';
        await user.save();
        console.log(`• Updated existing user and password: ${normalizedEmail}`);
      }
      users.push(user);
      return user;
    };

    const student = await ensureUser({
      email: 'student.demo@utas.edu.om',
      password: 'Student123!@#',
      full_name: 'Demo Student',
      role: 'Student',
      student_id: 'S1234567',
      department: 'College of Information Technology'
    });

    const staff = await ensureUser({
      email: 'staff.demo@utas.edu.om',
      password: 'Staff123!@#',
      full_name: 'Demo Staff',
      role: 'Staff',
      employee_id: 'E987654',
      department: 'College of Information Technology'
    });

    // 2) Create demo resources (some with deposit)
    const existingResources = await ResourceModel.find({ name: /Demo/i });
    if (existingResources.length > 0) {
      console.log('• Demo resources already exist, skipping creation.');
    } else {
      const creatorId = staff._id;
      const resourcesToCreate = [
        {
          name: 'Demo Laptop Lenovo',
          description: 'Lenovo laptop for testing borrow & deposit flow.',
          category: 'IT',
          college: 'Information Technology',
          department: 'College of Information Technology',
          barcode: 'DEMO-LAPTOP-001',
          qr_code: 'DEMO-LAPTOP-001',
          status: 'Available',
          location: 'IT Borrowing Hub - Lab 2',
          condition: 'Excellent',
          max_borrow_days: 5,
          total_quantity: 3,
          available_quantity: 3,
          requires_payment: true,
          payment_amount: 5,
          replacement_cost: 200,
          created_by: creatorId
        },
        {
          name: 'Demo DSLR Camera',
          description: 'Camera to test penalties and returns.',
          category: 'Media',
          college: 'Creative Industries',
          department: 'College of Creative Industries',
          barcode: 'DEMO-CAM-001',
          qr_code: 'DEMO-CAM-001',
          status: 'Available',
          location: 'Media Lab',
          condition: 'Good',
          max_borrow_days: 3,
          total_quantity: 2,
          available_quantity: 2,
          requires_payment: true,
          payment_amount: 10,
          replacement_cost: 300,
          created_by: creatorId
        },
        {
          name: 'Demo Physics Textbook',
          description: 'Book resource without deposit, for simple borrow tests.',
          category: 'Books',
          college: 'Science',
          department: 'College of Science',
          barcode: 'DEMO-BOOK-001',
          qr_code: 'DEMO-BOOK-001',
          status: 'Available',
          location: 'Main Library',
          condition: 'Good',
          max_borrow_days: 14,
          total_quantity: 5,
          available_quantity: 5,
          requires_payment: false,
          payment_amount: 0,
          replacement_cost: 50,
          created_by: creatorId
        }
      ];

      await ResourceModel.insertMany(resourcesToCreate);
      console.log('✓ Created demo resources');
    }

    const demoResources = await ResourceModel.find({ name: /Demo/i }).limit(3);
    const laptop = demoResources.find(r => r.name.includes('Laptop'));
    const camera = demoResources.find(r => r.name.includes('Camera'));
    const book = demoResources.find(r => r.name.includes('Textbook'));

    // 3) Create a pending borrow with deposit (student + laptop)
    let pendingBorrow = await BorrowModel.findOne({
      user_id: student._id,
      resource_id: laptop?._id,
      status: 'PendingApproval'
    });

    if (!pendingBorrow && laptop) {
      const now = new Date();
      const due = new Date(now);
      due.setDate(due.getDate() + (laptop.max_borrow_days || 5));

      pendingBorrow = new BorrowModel({
        user_id: student._id,
        resource_id: laptop._id,
        borrow_date: now,
        due_date: due,
        status: 'PendingApproval',
        condition_on_borrow: 'Excellent',
        terms_accepted: true,
        terms_accepted_at: now,
        requires_payment: true,
        payment_amount: Math.min(laptop.payment_amount || 5, 10),
        payment_method: 'Cash',
        payment_status: 'Pending'
      });
      await pendingBorrow.save();
      console.log('✓ Created pending borrow with deposit (student + demo laptop)');
    } else {
      console.log('• Pending demo borrow already exists');
    }

    // 4) Create an active borrow + penalty for overdue (student + camera)
    let activeBorrow = await BorrowModel.findOne({
      user_id: student._id,
      resource_id: camera?._id,
      status: { $in: ['Active', 'Overdue', 'Returned'] }
    });

    if (!activeBorrow && camera) {
      const borrowDate = new Date();
      borrowDate.setDate(borrowDate.getDate() - 10); // borrowed 10 days ago
      const dueDate = new Date();
      dueDate.setDate(borrowDate.getDate() + (camera.max_borrow_days || 3)); // due a few days ago

      activeBorrow = new BorrowModel({
        user_id: student._id,
        resource_id: camera._id,
        borrow_date: borrowDate,
        due_date: dueDate,
        status: 'Active',
        condition_on_borrow: 'Good',
        terms_accepted: true,
        terms_accepted_at: borrowDate,
        requires_payment: true,
        payment_amount: Math.min(camera.payment_amount || 10, 10),
        payment_method: 'Card',
        payment_status: 'Paid'
      });
      await activeBorrow.save();
      console.log('✓ Created active/overdue borrow (student + demo camera)');

      // Create a pending late return penalty linked to this borrow
      const daysLate = Math.max(0, Math.ceil((new Date() - dueDate) / (1000 * 60 * 60 * 24)));
      const fineAmount = daysLate * 0.5;

      const penalty = new PenaltyModel({
        borrow_id: activeBorrow._id,
        user_id: student._id,
        penalty_type: 'Late Return',
        days_late: daysLate,
        fine_amount: fineAmount,
        description: `Demo late return penalty (${daysLate} day(s) late).`,
        status: 'Pending'
      });
      await penalty.save();
      console.log('✓ Created pending penalty for overdue camera borrow');
    } else {
      console.log('• Demo active/overdue borrow already exists');
    }

    // 5) Create a confirmed reservation for the book
    const existingReservation = await ReservationModel.findOne({
      user_id: student._id,
      resource_id: book?._id
    });

    if (!existingReservation && book) {
      const pickupDate = new Date();
      pickupDate.setDate(pickupDate.getDate() + 2);
      const expiryDate = new Date(pickupDate);
      expiryDate.setDate(expiryDate.getDate() + 7);

      const reservation = new ReservationModel({
        user_id: student._id,
        resource_id: book._id,
        pickup_date: pickupDate,
        expiry_date: expiryDate,
        status: 'Confirmed',
        requires_payment: false
      });
      await reservation.save();
      console.log('✓ Created confirmed reservation for demo book');
    } else {
      console.log('• Demo reservation already exists');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' Demo data is ready!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' Login accounts you can use:');
    console.log(' - Student: student.demo@utas.edu.om / Student123!@#');
    console.log(' - Staff:   staff.demo@utas.edu.om   / Staff123!@#');
    console.log(' (Use existing admin from create-admin.js for admin views)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating mock data:');
    console.error(error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

createMockData();

