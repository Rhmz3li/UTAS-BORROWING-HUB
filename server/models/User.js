import mongoose from "mongoose";

const UserSchema = mongoose.Schema({
    email: {type: String, required: true, unique: true, lowercase: true, trim: true},
    password: {type: String, required: true},
    full_name: {type: String, required: true, trim: true},
    role: {type: String, enum: ['Admin', 'Assistant', 'Staff', 'Student'], default: 'Student', required: true},
    student_id: {type: String, required: false, trim: true},
    employee_id: {type: String, required: false, trim: true},
    identification_id: {type: String, required: false, unique: true, sparse: true, trim: true},
    phone: {type: String, required: false, trim: true},
    college: {type: String, required: false, enum: ['Information Technology', 'Science', 'Engineering', 'Business Studies', 'Creative Industries', 'General'], default: 'General', trim: true},
    department: {type: String, required: false, trim: true},
    status: {type: String, enum: ['Active', 'Inactive', 'Suspended'], default: 'Active'},
    avatar: {type: String, required: false, default: ''},
    resetPasswordToken: {type: String, required: false, default: null},
    resetPasswordExpires: {type: Date, required: false, default: null},
    previousPasswords: [{
        hashedPassword: {type: String, required: true},
        changedAt: {type: Date, default: Date.now}
    }],
    terms_accepted: {type: Boolean, required: false, default: false},
    terms_accepted_at: {type: Date, required: false, default: null},
    created_at: {type: Date, required: false, default: Date.now},
    updated_at: {type: Date, required: false, default: Date.now}
}, {
    timestamps: true
});

// Remove password from JSON output
UserSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const UserModel = mongoose.model("Users", UserSchema, "Users");
export default UserModel;
