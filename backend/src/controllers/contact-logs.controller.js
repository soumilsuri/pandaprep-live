import {ContactModel} from '../models/contact-logs.model.js';
import nodemailer from 'nodemailer';

// Nodemailer configuration
let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_MAIL,
        pass: process.env.SMTP_PASSWORD
    }
});

export const createContactLogController = async (req, res) => {
    try {
    const { firstName, lastName, email, phoneNumber, subject, message } = req.body;
    console.log(req.body);
    const contact =  ContactModel.create({
        firstName,
        lastName,
        email,
        phoneNumber,
        subject,
        message
    });
    // Create an email message
    let conf = {
        from: process.env.SMTP_MAIL,
        to: "tshifthappens@gmail.com",
        subject: `Email from ${email}, name: ${firstName + lastName}`,
        text:  message ,
    };
    transporter.sendMail(conf, (err, info) => {
        if (err) {
            console.log('Error occurred. ' + err.message);
            return res.status(500).json({ error: 'Error sending email' });
        }
        ContactModel.findByIdAndUpdate(contact._id, { status: 'Sent' });
        console.log('Message sent: %s', info.messageId);
        res.status(200).json({ message: 'Email sent successfully' });
    });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}