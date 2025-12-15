import mongoose from "mongoose";

const FeedbackSchema = mongoose.Schema({
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true},
    resource_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Resources', required: false, default: null},
    borrow_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Borrows', required: false, default: null},
    rating: {type: Number, required: true, min: 1, max: 5},
    comment: {type: String, required: false, trim: true},
    category: {type: String, required: false, enum: ['Resource', 'Service', 'System', 'Other'], default: 'Other'},
    status: {type: String, required: false, enum: ['Pending', 'Reviewed', 'Resolved', 'Archived'], default: 'Pending'},
    admin_response: {type: String, required: false, trim: true},
    responded_by: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: false, default: null},
    created_at: {type: Date, required: false, default: Date.now},
    updated_at: {type: Date, required: false, default: Date.now}
}, {
    timestamps: true
});

// Indexes
FeedbackSchema.index({ user_id: 1 });
FeedbackSchema.index({ resource_id: 1 });
FeedbackSchema.index({ status: 1 });

const FeedbackModel = mongoose.model("Feedbacks", FeedbackSchema, "Feedbacks");
export default FeedbackModel;
