import mongoose from "mongoose";

const PaymentSchema = mongoose.Schema({
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true},
    penalty_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Penalties', required: false, default: null},
    borrow_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Borrows', required: false, default: null},
    reservation_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Reservations', required: false, default: null},
    resource_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Resources', required: false, default: null},
    payment_type: {type: String, required: false, enum: ['Penalty', 'Resource', 'Reservation'], default: 'Penalty'},
    amount: {type: Number, required: true, min: 0},
    payment_method: {type: String, required: true, enum: ['Cash', 'Card', 'Online', 'Bank Transfer']},
    transaction_id: {type: String, required: false, unique: true, sparse: true, trim: true},
    status: {type: String, required: true, enum: ['Pending', 'Completed', 'Failed', 'Refunded'], default: 'Pending'},
    receipt_url: {type: String, required: false, trim: true},
    processed_by: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: false},
    notes: {type: String, required: false, trim: true},
    // Card details (only stored for Card payments)
    card_last4: {type: String, required: false, trim: true, maxlength: 4},
    card_holder: {type: String, required: false, trim: true},
    card_expiry: {type: String, required: false, trim: true, maxlength: 5},
    created_at: {type: Date, required: false, default: Date.now},
    updated_at: {type: Date, required: false, default: Date.now}
}, {
    timestamps: true
});

// Indexes
PaymentSchema.index({ user_id: 1, status: 1 });
PaymentSchema.index({ penalty_id: 1 });
PaymentSchema.index({ transaction_id: 1 });

const PaymentModel = mongoose.model("Payments", PaymentSchema, "Payments");
export default PaymentModel;
