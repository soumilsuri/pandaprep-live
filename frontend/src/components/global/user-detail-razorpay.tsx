"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Funnel_Display } from "next/font/google";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";

const funnel_display = Funnel_Display({
    subsets: ["latin"],
    weight: "400",
});

export interface CustomerDetailsDialogProps {
    idToken: string;
    userId: string;
    BASE_URL: string;
}

export interface Plan {
    title: string;
    cost: number;
    credits: number;
    price?: string;
    features?: string[];
    limitations?: string[];
}

export interface CustomerDetailsDialogRef {
    openDialog: (plan: Plan) => void;
}

const CustomerDetailsDialog = React.forwardRef<CustomerDetailsDialogRef, CustomerDetailsDialogProps>(
    ({ idToken, userId, BASE_URL }, ref) => {
        const [open, setOpen] = React.useState(false);
        const [currentPlan, setCurrentPlan] = React.useState<Plan | null>(null);
        const [customerDetails, setCustomerDetails] = React.useState({
            name: "",
            email: "",
            contact: "",
        });

        const [errors, setErrors] = useState({
            name: '',
            email: '',
            contact: ''
        });

        const [formValid, setFormValid] = useState(false);

        const validateName = (name: string) => {
            return name.trim().length >= 2;
        };

        const validateEmail = (email: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        };

        const validateContact = (contact: any) => {
            const contactRegex = /^\d{10}$/;
            return contactRegex.test(contact);
        };

        // Validate entire form
        useEffect(() => {
            const isValid = 
                validateName(customerDetails.name) && 
                validateEmail(customerDetails.email) && 
                validateContact(customerDetails.contact);
            setFormValid(isValid);
        }, [customerDetails]);

        const { theme, resolvedTheme } = useTheme();
        const [mounted, setMounted] = useState(false);
        const [couponCode, setCouponCode] = React.useState("");
        const [couponDiscount, setCouponDiscount] = React.useState<{
            code: string;
            discount_amount: number;
            original_amount: number;
            final_amount: number;
        } | null>(null);
        const [couponError, setCouponError] = React.useState("");
        const [isValidatingCoupon, setIsValidatingCoupon] = React.useState(false);


        useEffect(() => {
            setMounted(true);
        }, []);

        const isDarkMode = mounted && resolvedTheme === "dark";

        // Function to open dialog with specific plan
        const openDialog = (plan: Plan) => {
            setCurrentPlan(plan);
            setOpen(true);
            // Reset form state when dialog opens
            setCustomerDetails({
                name: "",
                email: "",
                contact: "",
            });
            setErrors({
                name: '',
                email: '',
                contact: ''
            });
            setCouponCode("");
            setCouponDiscount(null);
            setCouponError("");
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value } = e.target;
            setCustomerDetails((prev) => ({
                ...prev,
                [name]: value,
            }));
            
            // Clear error when user starts typing
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        };

        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            const { name, value } = e.target;
            
            // Validate fields on blur
            if (name === 'name') {
                if (!value.trim()) {
                    setErrors(prev => ({ ...prev, name: 'Name is required' }));
                } else if (!validateName(value)) {
                    setErrors(prev => ({ ...prev, name: 'Name must be at least 2 characters' }));
                }
            }
            
            if (name === 'email') {
                if (!value.trim()) {
                    setErrors(prev => ({ ...prev, email: 'Email is required' }));
                } else if (!validateEmail(value)) {
                    setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
                }
            }
            
            if (name === 'contact') {
                if (!value.trim()) {
                    setErrors(prev => ({ ...prev, contact: 'Contact number is required' }));
                } else if (!validateContact(value)) {
                    setErrors(prev => ({ ...prev, contact: 'Please enter a valid 10-digit contact number' }));
                }
            }
        };

        const validateForm = () => {
            const newErrors = {
                name: !customerDetails.name.trim() ? 'Name is required' : 
                      !validateName(customerDetails.name) ? 'Name must be at least 2 characters' : '',
                email: !customerDetails.email.trim() ? 'Email is required' : 
                       !validateEmail(customerDetails.email) ? 'Please enter a valid email address' : '',
                contact: !customerDetails.contact.trim() ? 'Contact number is required' : 
                         !validateContact(customerDetails.contact) ? 'Please enter a valid 10-digit contact number' : ''
            };
            
            setErrors(newErrors);
            
            // Check if there are any errors
            return !Object.values(newErrors).some(error => error);
        };

        const validateCoupon = async () => {
        if (!couponCode.trim() || !currentPlan) return;
        
        setIsValidatingCoupon(true);
        setCouponError("");
        
        try {
            const response = await axios.post(
                `${BASE_URL}/coupon/validate`,
                {
                    couponCode: couponCode.trim(),
                    amount: currentPlan.cost
                },
                {
                    headers: {
                        Authorization: `Bearer ${idToken}`,
                    },
                }
            );
            
            if (response.data.success) {
                setCouponDiscount(response.data.coupon);
                toast.success(`Coupon applied! You save ₹${response.data.coupon.discount_amount}`);
            }
        } catch (error: any) {
            setCouponError(error.response?.data?.error || "Invalid coupon code");
            setCouponDiscount(null);
        } finally {
            setIsValidatingCoupon(false);
        }
    };

    const removeCoupon = () => {
        setCouponCode("");
        setCouponDiscount(null);
        setCouponError("");
    };
        const handleProceed = async () => {
    if (!currentPlan) return;

    // Validate form before proceeding
    if (!validateForm()) {
        toast.error("Please correct the errors in the form");
        return;
    }

    setOpen(false);

    if (!idToken || !userId) {
        console.error("Auth token or user ID not available");
        return;
    }

    try {
        // Calculate the final amount to charge
        const finalAmount = couponDiscount ? couponDiscount.final_amount : currentPlan.cost;
        
        
        const requestPayload = {
            userId: userId,
            amount: finalAmount, // Use discounted amount if coupon is applied
            originalAmount: currentPlan.cost, // Send original amount for reference
            couponCode: couponDiscount?.code || null, // Send coupon code if applied
            discountAmount: couponDiscount?.discount_amount || 0, // Send discount amount
        };
        
        
        const { data } = await axios.post(
            `${BASE_URL}/payment/create-order`,
            requestPayload,
            {
                headers: {
                    Authorization: `Bearer ${idToken}`,
                },
            }
        );


        const { order } = data;
        if (!order) throw new Error("Order creation failed");

        const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: order.amount, // This should now be the discounted amount
            currency: "INR",
            name: "PandaPrep",
            description: `${currentPlan.title} Plan - ${currentPlan.credits} Credits${couponDiscount ? ` (Coupon: ${couponDiscount.code})` : ''}`,
            order_id: order.id,
            method: {
                netbanking: true,
                card: true,
                wallet: true,
                upi: true,
                paylater: true,
                emi: true,
            },
            config: {
                display: {
                    blocks: {
                        upi: {
                            name: "Pay using UPI",
                            instruments: [{ method: "upi" }],
                        },
                        cards: {
                            name: "Pay using Card",
                            instruments: [{ method: "card" }],
                        },
                        wallets: {
                            name: "Pay using Wallets",
                            instruments: [{ method: "wallet" }],
                        },
                    },
                    sequence: ["upi", "cards", "wallets"],
                    preferences: {
                        show_default_blocks: true,
                    },
                },
                recommended: {
                    method: ["upi", "card"],
                    description: "Recommended payment options"
                }
            },
            handler: async (response: any) => {
                try {
                    const verifyRes = await axios.post(
                        `${BASE_URL}/payment/verify-order`,
                        {
                            userId: userId,
                            order_id: order.id,
                            payment_id: response.razorpay_payment_id,
                            signature: response.razorpay_signature,
                            couponCode: couponDiscount?.code || null, // Include coupon info in verification
                            discountAmount: couponDiscount?.discount_amount || 0,
                        },
                        {
                            headers: {
                                Authorization: `Bearer ${idToken}`,
                            },
                        }
                    );

                    if (verifyRes.data.success) {
                        toast.success("Payment Successful! Credits Updated.");
                    } else {
                        toast.error("Payment verification failed.");
                    }
                } catch (error) {
                    toast.error("An error occurred during payment verification.");
                }
            },
            prefill: customerDetails,
            theme: { 
                color: isDarkMode ? "#16814e" : "#B17457" 
            },
            modal: {
                ondismiss: () => {
                    toast.warning("Payment process timed out. Please try again.");
                },
            },
        };


        const rzp = new window.Razorpay(options);
        rzp.open();
    } catch (error) {
        console.error("Payment error:", error);
        toast.error("Payment initiation failed. Please try again.");
    }
};

        React.useImperativeHandle(ref, () => ({
            openDialog,
        }));

        // Updated theme classes to match pricing page theme
        const themeClasses = {
            dialog: isDarkMode 
                ? "border border-[#2A2826] bg-[#1E1D1B]" 
                : "border border-[#B17457] bg-white",
            title: isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]",
            description: isDarkMode ? "text-[#D0CCC4]" : "text-neutral-600",
            label: isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]",
            input: isDarkMode 
                ? "bg-[#2A2926] border-[#2A2826] focus:border-[#D29C7B]" 
                : "bg-white border-[#B17457] focus:border-[#B17457]",
            button: isDarkMode
                ? "bg-[#D29C7B] hover:bg-[#E5A382] text-[#1E1D1B]"
                : "bg-white border-2 border-[#B17457] text-[#B17457] hover:bg-[#B17457] hover:text-[#FAF7F0]",
            error: isDarkMode ? "text-red-400" : "text-red-500",
            inputError: isDarkMode ? "border-red-400" : "border-red-500",
        };

        return (
            <>
                <Toaster richColors position="top-right" closeButton={true} />
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent
                        className={cn(
                            "sm:max-w-md",
                            themeClasses.dialog,
                            funnel_display.className
                        )}
                    >
                        <DialogHeader>
                            <DialogTitle 
                                className={cn(
                                    "text-xl font-bold",
                                    themeClasses.title,
                                    funnel_display.className
                                )}
                            >
                                Customer Information
                            </DialogTitle>
                            <DialogDescription 
                                className={cn(
                                    themeClasses.description,
                                    funnel_display.className
                                )}
                            >
                                Please provide your details for the payment process.
                            </DialogDescription>
                        </DialogHeader>
                        <div className={cn("grid gap-4 py-4", funnel_display.className)}>
                            <div className="flex flex-col gap-2">
                                <Label 
                                    htmlFor="name" 
                                    className={cn(
                                        themeClasses.label,
                                        funnel_display.className
                                    )}
                                >
                                    Name
                                </Label>
                                <div className="col-span-3">
                                    <Input
                                        id="name"
                                        name="name"
                                        value={customerDetails.name}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        placeholder="Enter your name"
                                        className={cn(
                                            "w-full",
                                            themeClasses.input,
                                            errors.name && themeClasses.inputError,
                                            funnel_display.className
                                        )}
                                    />
                                    {errors.name && (
                                        <p className={cn("text-xs mt-1", themeClasses.error)}>
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label 
                                    htmlFor="email" 
                                    className={cn(
                                        themeClasses.label,
                                        funnel_display.className
                                    )}
                                >
                                    Email
                                </Label>
                                <div className="col-span-3">
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={customerDetails.email}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        placeholder="Enter your email"
                                        className={cn(
                                            "w-full",
                                            themeClasses.input,
                                            errors.email && themeClasses.inputError,
                                            funnel_display.className
                                        )}
                                    />
                                    {errors.email && (
                                        <p className={cn("text-xs mt-1", themeClasses.error)}>
                                            {errors.email}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label 
                                    htmlFor="contact" 
                                    className={cn(
                                        themeClasses.label,
                                        funnel_display.className
                                    )}
                                >
                                    Contact
                                </Label>
                                <div className="col-span-3">
                                    <Input
                                        id="contact"
                                        name="contact"
                                        value={customerDetails.contact}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        placeholder="Enter your contact number"
                                        className={cn(
                                            "w-full",
                                            themeClasses.input,
                                            errors.contact && themeClasses.inputError,
                                            funnel_display.className
                                        )}
                                    />
                                    {errors.contact && (
                                        <p className={cn("text-xs mt-1", themeClasses.error)}>
                                            {errors.contact}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                <Label 
                                    htmlFor="coupon" 
                                    className={cn(
                                        themeClasses.label,
                                        funnel_display.className
                                    )}
                                >
                                    Coupon Code (Optional)
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="coupon"
                                        name="coupon"
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                        placeholder="Enter coupon code"
                                        className={cn(
                                            "flex-1",
                                            themeClasses.input,
                                            funnel_display.className
                                        )}
                                        disabled={!!couponDiscount}
                                    />
                                    {!couponDiscount ? (
                                        <Button
                                            type="button"
                                            onClick={validateCoupon}
                                            disabled={!couponCode.trim() || isValidatingCoupon}
                                            className={cn(
                                                "px-4 py-2 text-xs cursor-pointer",
                                                themeClasses.button,
                                                funnel_display.className
                                            )}
                                        >
                                            {isValidatingCoupon ? "Checking..." : "Apply"}
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            onClick={removeCoupon}
                                            variant="outline"
                                            className={cn(
                                                "px-4 py-2 text-xs cursor-pointer",
                                                funnel_display.className
                                            )}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </div>
                                {couponError && (
                                    <p className={cn("text-xs mt-1", themeClasses.error)}>
                                        {couponError}
                                    </p>
                                )}
                                {couponDiscount && (
                                    <div className={cn("text-xs mt-1 p-2 rounded border", 
                                        isDarkMode ? "bg-green-900/20 border-green-700 text-green-400" : "bg-green-50 border-green-200 text-green-700"
                                    )}>
                                        <p>✓ Coupon &quot;{couponDiscount.code}&quot; applied!</p>
                                        <p>Original: ₹{couponDiscount.original_amount}</p>
                                        <p>Discount: -₹{couponDiscount.discount_amount}</p>
                                        <p className="font-semibold">Final: ₹{couponDiscount.final_amount}</p>
                                    </div>
                                )}
                            </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button 
                                type="button" 
                                onClick={handleProceed} 
                                className={cn(
                                    themeClasses.button,
                                    "px-6 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer",
                                    funnel_display.className
                                )}
                                disabled={!formValid}
                            >
                                Proceed to Payment
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        );
    }
);

CustomerDetailsDialog.displayName = "CustomerDetailsDialog";

export default CustomerDetailsDialog;