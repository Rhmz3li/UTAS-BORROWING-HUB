import mongoose from "mongoose";

const BorrowSchema = mongoose.Schema({
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true},
    resource_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Resources', required: true},
    borrow_date: {type: Date, required: true, default: Date.now},
    due_date: {type: Date, required: true},
    return_date: {type: Date, required: false, default: null},
    status: {type: String, required: true, enum: ['Active', 'Returned', 'Overdue', 'Lost', 'PendingApproval'], default: 'PendingApproval'},
    condition_on_borrow: {type: String, required: false, enum: ['Excellent', 'Good', 'Fair', 'Poor'], default: 'Good'},
    condition_on_return: {
        type: String, 
        required: false,
        validate: {
            validator: function(v) {
                // Allow null, undefined, or valid enum values
                // When item is borrowed, this will be null/undefined until returned
                return v === null || v === undefined || ['Excellent', 'Good', 'Fair', 'Poor'].includes(v);
            },
            message: 'condition_on_return must be null, undefined, or one of: Excellent, Good, Fair, Poor'
        }
    },
    notes: {type: String, required: false, trim: true},
    checked_out_by: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: false},
    checked_in_by: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: false},
    terms_accepted: {type: Boolean, required: false, default: false},
    terms_accepted_at: {type: Date, required: false, default: null},
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
BorrowSchema.index({ user_id: 1, status: 1 });
BorrowSchema.index({ resource_id: 1, status: 1 });
BorrowSchema.index({ due_date: 1, status: 1 });

// Virtual for days late
BorrowSchema.virtual('days_late').get(function() {
    if (this.status === 'Active' && this.due_date < new Date()) {
        const diffTime = Math.abs(new Date() - this.due_date);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return 0;
});

const BorrowModel = mongoose.model("Borrows", BorrowSchema, "Borrows");
export default BorrowModel;
