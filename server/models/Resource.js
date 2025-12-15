import mongoose from "mongoose";

const ResourceSchema = mongoose.Schema({
    name: {type: String, required: true, trim: true},
    description: {type: String, required: false, trim: true},
    category: {type: String, required: true, trim: true},
    college: {type: String, required: false, enum: ['Information Technology', 'Science', 'Engineering', 'Business Studies', 'Creative Industries', 'General'], default: 'General', trim: true},
    department: {type: String, required: false, trim: true, default: null},
    barcode: {type: String, required: false, unique: true, sparse: true, trim: true},
    qr_code: {type: String, required: false, unique: true, sparse: true, trim: true},
    status: {type: String, required: true, enum: ['Available', 'Borrowed', 'Reserved', 'Maintenance', 'Lost'], default: 'Available'},
    location: {type: String, required: false, trim: true},
    condition: {type: String, required: false, enum: ['Excellent', 'Good', 'Fair', 'Poor'], default: 'Good'},
    max_borrow_days: {type: Number, required: false, default: 7, min: 1},
    image: {type: String, required: false, trim: true, default: null},
    images: [{type: String, required: false, trim: true}],
    specifications: {type: Map, of: String, required: false},
    total_quantity: {type: Number, required: false, default: 1, min: 1},
    available_quantity: {type: Number, required: false, default: 1, min: 0},
    requires_payment: {type: Boolean, required: false, default: false},
    payment_amount: {type: Number, required: false, default: 0, min: 0},
    replacement_cost: {type: Number, required: false, default: 100, min: 0}, // Cost for loss penalty
    created_by: {type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true},
    created_at: {type: Date, required: false, default: Date.now},
    updated_at: {type: Date, required: false, default: Date.now}
}, {
    timestamps: true
});

// Index for search optimization
ResourceSchema.index({ name: 'text', description: 'text', category: 'text' });
ResourceSchema.index({ status: 1, category: 1 });
ResourceSchema.index({ barcode: 1 });
ResourceSchema.index({ qr_code: 1 });

const ResourceModel = mongoose.model("Resources", ResourceSchema, "Resources");
export default ResourceModel;
