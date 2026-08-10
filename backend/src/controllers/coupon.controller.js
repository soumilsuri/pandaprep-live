import { CouponModel } from "../models/coupon.model.js";

export const validateCouponController = async (req, res) => {
    try {
        const { couponCode, amount } = req.body;

        if (!couponCode || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: "Coupon code and amount are required" 
            });
        }

        const coupon = await CouponModel.findOne({ 
            code: couponCode.toUpperCase(),
            is_active: true
        });

        if (!coupon) {
            return res.status(404).json({ 
                success: false, 
                error: "Invalid coupon code" 
            });
        }

        // Check validity dates
        const currentDate = new Date();
        if (currentDate < coupon.validity.start_date || currentDate > coupon.validity.end_date) {
            return res.status(400).json({ 
                success: false, 
                error: "Coupon has expired or is not yet active" 
            });
        }

        // Check usage limit
        if (coupon.used_count >= coupon.usage_limit) {
            return res.status(400).json({ 
                success: false, 
                error: "Coupon usage limit exceeded" 
            });
        }

        // Calculate discount
        let discountAmount = 0;
        if (coupon.discount_type === 'percentage') {
            discountAmount = Math.round((amount * coupon.discount_value) / 100); //rounding price??
        } else if (coupon.discount_type === 'flat') {
            discountAmount = Math.min(coupon.discount_value, amount);
        }

        const finalAmount = Math.max(0, amount - discountAmount);

        res.json({
            success: true,
            coupon: {
                code: coupon.code,
                discount_type: coupon.discount_type,
                discount_value: coupon.discount_value,
                discount_amount: discountAmount,
                original_amount: amount,
                final_amount: finalAmount
            }
        });

    } catch (error) {
        console.error("Coupon validation error:", error);
        res.status(500).json({ 
            success: false, 
            error: "Server Error" 
        });
    }
};

export const applyCouponController = async (req, res) => {
    try {
        const { couponCode } = req.body;

        const coupon = await CouponModel.findOneAndUpdate(
            { 
                code: couponCode.toUpperCase(),
                is_active: true,
                used_count: { $lt: "$usage_limit" }
            },
            { 
                $inc: { used_count: 1 },
                $set: { updatedAt: new Date() }
            },
            { new: true }
        );

        if (!coupon) {
            return res.status(400).json({ 
                success: false, 
                error: "Unable to apply coupon" 
            });
        }

        res.json({
            success: true,
            message: "Coupon applied successfully"
        });

    } catch (error) {
        console.error("Apply coupon error:", error);
        res.status(500).json({ 
            success: false, 
            error: "Server Error" 
        });
    }
};