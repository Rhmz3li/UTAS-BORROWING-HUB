import mongoose from "mongoose";

const AnnouncementSchema = mongoose.Schema({
    title: {type: String, required: true, trim: true},
    message: {type: String, required: true, trim: true},
    priority: {type: String, required: false, enum: ['Low', 'Normal', 'Medium', 'High'], default: 'Normal'},
    // Align with User.role where possible; keep legacy "Students" for older documents
    target_audience: {
        type: String,
        required: false,
        enum: ['All', 'Student', 'Students', 'Staff', 'Admin', 'Assistant'],
        default: 'All'
    },
    created_by: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true},
    is_active: {type: Boolean, required: false, default: true},
    created_at: {type: Date, required: false, default: Date.now},
    updated_at: {type: Date, required: false, default: Date.now}
}, {
    timestamps: true
});

const AnnouncementModel = mongoose.model("Announcements", AnnouncementSchema, "Announcements");
export default AnnouncementModel;
