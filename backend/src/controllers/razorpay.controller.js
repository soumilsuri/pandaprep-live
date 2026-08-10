import Razorpay from 'razorpay';
import crypto from 'crypto';
import { UserModel } from "../models/user.model.js";
import { PaymentLogModel } from "../models/payment-logs.model.js";
import { sendPurchaseReceiptEmail } from '../utils/email.util.js';
import { CouponModel } from "../models/coupon.model.js";

import dotenv from 'dotenv';
dotenv.config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createOrderController = async (req, res) => {
    try {
        const { userId, amount, originalAmount, couponCode, discountAmount } = req.body; 

        // The amount is already discounted from frontend, so use it directly
        const finalAmount = amount;
        let appliedCoupon = null;

        // If coupon was applied, record the coupon details for logging
        if (couponCode) {
            const coupon = await CouponModel.findOne({ 
                code: couponCode.toUpperCase(),
                is_active: true
            });

            if (coupon) {
                appliedCoupon = {
                    code: coupon.code,
                    discount_amount: discountAmount, // Use the discount amount from frontend
                    _id: coupon._id
                };

                // Increment the coupon usage count
                await CouponModel.findByIdAndUpdate(coupon._id, {
                    $inc: { used_count: 1 }
                });
            }
        }

        // Convert to paise for Razorpay
        const paymentAmount = finalAmount * 100;

        const timestamp = Date.now().toString().slice(-10);
        const truncatedUserId = userId.toString().slice(0, 20);
        const receipt = `rcpt_${truncatedUserId}_${timestamp}`.slice(0, 40);

        const options = {
            amount: paymentAmount,
            currency: "INR",
            receipt: receipt,
        };

        console.log("Creating Razorpay order with amount:", paymentAmount, "paise (₹" + finalAmount + ")");

        const order = await razorpay.orders.create(options);

        const paymentLog = new PaymentLogModel({
            userId,
            razorpayOrderId: order.id,
            amount: originalAmount || amount, // Store original amount for reference
            finalAmount: finalAmount, // Store the actual charged amount
            appliedCoupon: appliedCoupon, 
            status: "Pending",
        });

        await paymentLog.save();

        res.json({ success: true, order, appliedCoupon });
    } catch (error) {
        console.error("Create order error:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
}

export const verifyPaymentController = async (req, res) => {
    try {
        const { userId, order_id, payment_id, signature, couponCode, discountAmount } = req.body;

        const paymentLog = await PaymentLogModel.findOne({ razorpayOrderId: order_id });
        if (!paymentLog) return res.status(400).json({ success: false, error: "Invalid Order ID" });

        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(order_id + "|" + payment_id)
            .digest("hex");

        if (generatedSignature !== signature) {
            paymentLog.status = "Failed";
            await paymentLog.save();
            return res.status(400).json({ success: false, error: "Payment Verification Failed" });
        }

        paymentLog.status = "Success";
        paymentLog.razorpayPaymentId = payment_id;
        paymentLog.razorpaySignature = signature;
        await paymentLog.save();

        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: "User not found" });

        // Use the original amount to determine credits (before discount)
        // This ensures users get full credits even with discounted price
        const originalAmount = paymentLog.amount;
        const creditsMap = {
            49: 15,
            249: 100,
            1500: 450,
        };

        const planMap = {
            49: "Starter",
            249: "Growth",
            1500: "Scale"
        };

        const credits = creditsMap[paymentLog.amount] || 0;
        const planTitle = planMap[paymentLog.amount] || "Custom";

        await UserModel.findByIdAndUpdate(userId, {
            $inc: { "subscription.credits": credits },
            $set: { "subscription.plan": "paid" }
        });

        // Send receipt email
        const firstName = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];
        const emailResult = await sendPurchaseReceiptEmail({
            userEmail: user.email,
            userName: firstName,
            planTitle,
            amount: paymentLog.amount,
            credits,
            orderId: order_id,
            paymentId: payment_id,
            date: new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            couponApplied: couponCode ? couponCode.toUpperCase() : null,
            discountAmount: discountAmount || null
        });

        if (!emailResult.success) {
            console.error('Failed to send receipt email:', emailResult.error);
        }
        
        res.json({ 
            success: true, 
            message: "Payment verified, credits added", 
            user,
            emailSent: emailResult.success 
        });
    } catch (error) {
        console.error("Verify payment error:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
}