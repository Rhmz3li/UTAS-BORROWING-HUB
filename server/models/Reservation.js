import mongoose from "mongoose";

const ReservationSchema = mongoose.Schema({
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true},
    resource_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Resources', required: true},
    reservation_date: {type: Date, required: true, default: Date.now},
    pickup_date: {type: Date, required: true},
    expiry_date: {type: Date, required: true},
    status: {type: String, required: true, enum: ['Pending', 'Confirmed', 'Cancelled', 'Expired', 'Completed'], default: 'Pending'},
    notes: {type: String, required: false, trim: true},
    requires_payment: {type: Boolean, required: false, default: false},
    payment_amount: {type: Number, required: false, default: 0, min: 0},
    payment_method: {type: String, required: false, enum: ['Cash', 'Card', 'Online', 'Bank Transfer', null], default: null},
    payment_status: {type: String, required: false, enum: ['Pending', 'Paid', 'Not Required'], default: 'Not Required'},
    payment_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Payments', required: false, default: null},
    created_at: {type: Date, required: false, default: Date.now},
    updated_at: {type: Date, required: false, default: Date.now}
}, {
    timestamps: true
});

// Indexes
ReservationSchema.index({ user_id: 1, status: 1 });
ReservationSchema.index({ resource_id: 1, status: 1 });
ReservationSchema.index({ expiry_date: 1, status: 1 });

const ReservationModel = mongoose.model("Reservations", ReservationSchema, "Reservations");
export default ReservationModel;
