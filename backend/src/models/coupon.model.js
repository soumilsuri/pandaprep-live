import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
    code: { 
        type: String, 
        required: true, 
        unique: true,
        uppercase: true,
        trim: true
    },
    discount_type: { 
        type: String, 
        required: true, 
        enum: ['flat', 'percentage'] 
    },
    discount_value: { 
        type: Number, 
        required: true,
        min: 0
    },
    validity: {
        start_date: { type: Date, required: true },
        end_date: { type: Date, required: true }
    },
    usage_limit: { 
        type: Number, 
        required: true,
        min: 1
    },
    used_count: { 
        type: Number, 
        default: 0 
    },
    is_active: { 
        type: Boolean, 
        default: true 
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// // Index for better performance
// couponSchema.index({ code: 1 });
// couponSchema.index({ validity: 1 });

export const CouponModel = mongoose.model("Coupon", couponSchema);