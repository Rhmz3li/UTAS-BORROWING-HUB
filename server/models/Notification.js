import mongoose from "mongoose";

const NotificationSchema = mongoose.Schema({
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true},
    title: {type: String, required: true, trim: true},
    message: {type: String, required: true, trim: true},
    type: {type: String, required: false, enum: ['Info', 'Warning', 'Success', 'Error', 'Reminder'], default: 'Info'},
    related_type: {type: String, required: false, enum: ['Borrow', 'Reservation', 'Penalty', 'Payment', 'System'], default: 'System'},
    related_id: {type: mongoose.Schema.Types.ObjectId, refPath: 'related_type', required: false},
    is_read: {type: Boolean, required: false, default: false},
    read_at: {type: Date, required: false, default: null},
    created_at: {type: Date, required: false, default: Date.now}
}, {
    timestamps: true
});

// Indexes
NotificationSchema.index({ user_id: 1, is_read: 1 });
NotificationSchema.index({ created_at: -1 });

const NotificationModel = mongoose.model("Notifications", NotificationSchema, "Notifications");
export default NotificationModel;
