# UTAS Borrowing Hub

A comprehensive resource borrowing management system built with MERN Stack (MongoDB, Express, React, Node.js).

## Features

- 🔐 User Authentication (Login/Register)
- 📦 Resource Management (CRUD operations)
- 📚 Borrowing System (Checkout/Return)
- 📅 Reservation System
- 🔔 Real-time Notifications
- ⚠️ Penalty Management
- 💳 Payment Processing
- 📊 Admin Dashboard with Analytics
- 📱 QR/Barcode Scanning Support
- 🤖 AI Chatbot (Basic)

## Tech Stack

### Backend
- Node.js & Express
- MongoDB with Mongoose
- JWT Authentication
- bcryptjs for password hashing

### Frontend
- React 18 with Vite
- Redux Toolkit for state management
- Reactstrap & Bootstrap 5 for UI
- React Router for navigation
- Yup for form validation
- Axios for API calls

## Project Structure

```
UTAS-BORROWING-HUB/
├── server/
│   ├── index.js              # Server entry point
│   ├── models/               # MongoDB models
│   │   ├── User.js
│   │   ├── Resource.js
│   │   ├── Borrow.js
│   │   ├── Reservation.js
│   │   ├── Notification.js
│   │   ├── Penalty.js
│   │   ├── Payment.js
│   │   └── Feedback.js
│   ├── routes/               # API routes
│   ├── controllers/          # Route controllers
│   └── middleware/           # Auth middleware
│
└── client/
    ├── src/
    │   ├── App.jsx           # Main app component
    │   ├── store.js          # Redux store
    │   ├── components/       # Reusable components
    │   ├── features/         # Feature modules
    │   │   ├── auth/
    │   │   ├── inventory/
    │   │   ├── borrowing/
    │   │   ├── reservations/
    │   │   ├── notifications/
    │   │   ├── penalties/
    │   │   ├── payments/
    │   │   └── admin/
    │   ├── validations/      # Yup schemas
    │   └── utils/            # Utilities (API, etc.)
    └── package.json
```

## Installation

### Backend Setup

```bash
cd server
npm install
```

Create a `.env` file in the server directory:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://utas_db:1234@cluster0.eate6en.mongodb.net/UTAS-BORROWING-HUB?appName=Cluster0
JWT_SECRET=your-secret-key-change-in-production
```

Start the server:

```bash
npm run dev
```

### Frontend Setup

```bash
cd client
npm install
```

Start the development server:

```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Resources
- `GET /api/resources` - Get all resources (with filters)
- `GET /api/resources/:id` - Get single resource
- `POST /api/resources` - Create resource (Admin/Assistant)
- `PUT /api/resources/:id` - Update resource (Admin/Assistant)
- `DELETE /api/resources/:id` - Delete resource (Admin)
- `GET /api/resources/scan/:code` - Scan barcode/QR

### Borrowing
- `POST /api/borrow/checkout` - Checkout resource
- `PUT /api/borrow/:id/return` - Return resource
- `GET /api/borrow/my-borrows` - Get user borrows
- `GET /api/borrow` - Get all borrows (Admin/Assistant)
- `GET /api/borrow/:id` - Get single borrow

### Reservations
- `POST /api/reservations` - Create reservation
- `GET /api/reservations/my-reservations` - Get user reservations
- `PUT /api/reservations/:id/cancel` - Cancel reservation
- `GET /api/reservations` - Get all reservations (Admin/Assistant)
- `PUT /api/reservations/:id/confirm` - Confirm reservation (Admin/Assistant)

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Penalties
- `GET /api/penalties/my-penalties` - Get user penalties
- `GET /api/penalties` - Get all penalties (Admin/Assistant)
- `GET /api/penalties/:id` - Get single penalty
- `PUT /api/penalties/:id/waive` - Waive penalty (Admin/Assistant)

### Payments
- `POST /api/payments` - Create payment
- `GET /api/payments/my-payments` - Get user payments
- `GET /api/payments` - Get all payments (Admin/Assistant)
- `PUT /api/payments/:id/status` - Update payment status (Admin/Assistant)

### Admin
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/borrows/overdue` - Get overdue borrows
- `GET /api/admin/borrows/upcoming-returns` - Get upcoming returns

## User Roles

- **Admin**: Full access to all features
- **Assistant**: Can manage resources, borrows, and reservations
- **Staff**: Can borrow and reserve resources
- **Student**: Can borrow and reserve resources

## Business Logic

### Borrowing Flow
1. User selects available resource
2. System checks for conflicts (active borrows, reservations)
3. Creates borrow record and updates resource status
4. Sends notification to user

### Return Flow
1. User returns resource
2. System checks for late returns and damage
3. Calculates penalties if applicable
4. Updates resource status to Available
5. Creates penalty record if needed

### Penalty Calculation
- Late Return: 0.5 OMR per day (calculated from due date)
- Damage: 25-50 OMR based on severity (Fair = 25 OMR, Poor = 50 OMR)
- Loss: Full replacement cost (configurable per resource, default: 100 OMR)
- System blocks borrowing/reservation if user has pending penalties

## Development

The project uses modern development practices:
- Redux Toolkit for state management
- Formik + Yup for form handling and validation
- React Router for navigation
- Axios interceptors for token management
- Toast notifications for user feedback

## License

This project is created for UTAS (University of Technology and Applied Sciences).

