import { configureStore } from "@reduxjs/toolkit";
import AuthReducer from './reducers/authReducer.js';
import DeviceReducer from './reducers/deviceReducer.js';
import BorrowingReducer from './reducers/borrowingReducer.js';
import ReservationReducer from './reducers/reservationReducer.js';
import NotificationReducer from './reducers/notificationReducer.js';
import PenaltyReducer from './reducers/penaltyReducer.js';
import PaymentReducer from './reducers/paymentReducer.js';
import AdminReducer from './reducers/adminReducer.js';
import PostReducer from './reducers/postReducer.js';
import UserReducer from './reducers/userReducer.js';

export const store = configureStore({
    reducer: {
        auth: AuthReducer,
        devices: DeviceReducer,
        borrowing: BorrowingReducer,
        reservations: ReservationReducer,
        notifications: NotificationReducer,
        penalties: PenaltyReducer,
        payments: PaymentReducer,
        admin: AdminReducer,
        post: PostReducer,
        user: UserReducer
    }
});
