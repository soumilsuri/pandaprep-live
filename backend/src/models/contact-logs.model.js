import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        enum: ['general', 'support', 'feedback', 'other'],
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Sent'],
        default: 'Pending'
    }
}, {
    timestamps: true,
});

export const ContactModel = mongoose.model('Contact', contactSchema);