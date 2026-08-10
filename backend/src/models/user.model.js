import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    displayName: { type: String, required: true },
    photoURL: { type: String },
    providerId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: Date.now },
    gender:{ type: String },
    country: { type: String },
    address: { type: String },
    providerData: {
        providerId: { type: String },
        uid: { type: String },
        displayName: { type: String },
        email: { type: String },
        photoURL: { type: String }
    },
    tokens: {
        accessToken: { type: String },
        refreshToken: { type: String },
        expirationTime: { type: Number }
    },
    subscription: {
        plan: { type: String, default: "free" },
        credits: { type: Number, default: 3 },
    },
    cookieAcknowledged: { type: Boolean, default: false },
});

export const UserModel = mongoose.model("User", userSchema);
