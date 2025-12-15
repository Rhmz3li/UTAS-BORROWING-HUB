import mongoose from "mongoose";

const PenaltySchema = mongoose.Schema({
    borrow_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Borrows', required: true},
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true},
    penalty_type: {type: String, required: true, enum: ['Late Return', 'Damage', 'Loss']},
    days_late: {type: Number, required: false, default: 0, min: 0},
    damage_level: {type: String, required: false, enum: ['Minor', 'Moderate', 'Severe', 'Total Loss'], default: null},
    fine_amount: {type: Number, required: true, min: 0},
    description: {type: String, required: false, trim: true},
    status: {type: String, required: true, enum: ['Pending', 'Paid', 'Waived', 'Cancelled'], default: 'Pending'},
    paid_at: {type: Date, required: false, default: null},
    waived_by: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: false, default: null},
    waived_reason: {type: String, required: false, trim: true},
    created_at: {type: Date, required: false, default: Date.now},
    updated_at: {type: Date, required: false, default: Date.now}
}, {
    timestamps: true
});

// Indexes
PenaltySchema.index({ user_id: 1, status: 1 });
PenaltySchema.index({ borrow_id: 1 });
PenaltySchema.index({ status: 1 });

const PenaltyModel = mongoose.model("Penalties", PenaltySchema, "Penalties");
export default PenaltyModel;
