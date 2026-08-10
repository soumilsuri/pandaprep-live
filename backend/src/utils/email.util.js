import axios from 'axios';
import dotenv from 'dotenv';
import { getNotesReadyEmailTemplate, getPurchaseReceiptEmailTemplate } from '../templates/email.template.js';

dotenv.config();

/**
 * Sends email using Brevo (SendinBlue) API
 * @param {Object} emailData - Email configuration
 * @param {string} emailData.to - Recipient email address
 * @param {string} emailData.toName - Recipient name
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.htmlContent - HTML content of the email
 * @param {string} [emailData.textContent] - Plain text content (optional)
 * @returns {Promise<Object>} - Brevo API response
 */
export async function sendBrevoEmail({ to, toName, subject, htmlContent, textContent }) {
  try {
    const brevoApiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'noreply@pandaprepai.tech';
    const fromName = process.env.FROM_NAME || 'PandaPrep Team';

    if (!brevoApiKey) {
      throw new Error('BREVO_API_KEY is not configured in environment variables');
    }

    const emailPayload = {
      sender: {
        name: fromName,
        email: fromEmail
      },
      to: [
        {
          email: to,
          name: toName
        }
      ],
      subject: subject,
      htmlContent: htmlContent,
      ...(textContent && { textContent })
    };

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      emailPayload,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': brevoApiKey
        }
      }
    );

    console.log(`Email sent successfully to ${to}:`, response.data);
    return {
      success: true,
      messageId: response.data.messageId,
      data: response.data
    };

  } catch (error) {
    console.error('Failed to send email via Brevo:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Sends notes ready notification email to user
 * @param {Object} params - Email parameters
 * @param {string} params.userEmail - User's email address  
 * @param {string} params.userName - User's name
 * @param {string} params.subjectName - Subject name of the generated notes
 * @param {string} params.downloadUrl - Direct download link to the notes
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendNotesReadyEmail({ userEmail, userName, subjectName, downloadUrl }) {
  try {
    const htmlContent = getNotesReadyEmailTemplate({
      userName,
      subjectName,
      downloadUrl
    });

    const plainTextContent = `
Hey ${userName},

Great news! Your ${subjectName} notes have been successfully generated and are ready for download.

You can access your notes at: ${downloadUrl}

Or visit your history page: https://pandaprepai.tech/history

If you have any questions, feel free to contact us at support@pandaprepai.tech.

Thanks for using PandaPrep!
— Team PandaPrep
    `.trim();

    const result = await sendBrevoEmail({
      to: userEmail,
      toName: userName,
      subject: `📚 Your ${subjectName} Notes Are Ready!`,
      htmlContent,
      textContent: plainTextContent
    });

    return result;

  } catch (error) {
    console.error('Error sending notes ready email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sends purchase receipt email to user
 * @param {Object} params - Email parameters
 * @param {string} params.userEmail - User's email address  
 * @param {string} params.userName - User's name
 * @param {string} params.planTitle - Title of the purchased plan
 * @param {number} params.amount - Total amount paid
 * @param {number} params.credits - Number of credits added
 * @param {string} params.orderId - Razorpay order ID
 * @param {string} params.paymentId - Razorpay payment ID
 * @param {string} params.date - Purchase date
 * @param {string} [params.couponApplied] - Coupon code if applied
 * @param {number} [params.discountAmount] - Discount amount if coupon applied
 * @returns {Promise<Object>} - Email sending result
 */
export async function sendPurchaseReceiptEmail({ 
  userEmail, 
  userName, 
  planTitle, 
  amount, 
  credits, 
  orderId, 
  paymentId, 
  date,
  couponApplied,
  discountAmount 
}) {
  try {
    const htmlContent = getPurchaseReceiptEmailTemplate({
      userName,
      planTitle,
      amount,
      credits,
      orderId,
      paymentId,
      date,
      couponApplied,
      discountAmount
    });

    const plainTextContent = `
Hey ${userName},

Thank you for purchasing the ${planTitle} plan. Here's your receipt for your records.

Plan: ${planTitle}
Credits Added: ${credits}
${couponApplied ? `Coupon Applied: ${couponApplied}
Discount: -₹${discountAmount}` : ''}
Total Amount: ₹${amount}
Order ID: ${orderId}
Payment ID: ${paymentId}
Date: ${date}

Your credits have been added to your account. You can start using them right away!

If you have any questions about your purchase, feel free to contact us at support@pandaprepai.tech.

Thanks for choosing PandaPrep — we're here to help you prep smarter!
— Team PandaPrep ✨
    `.trim();

    const result = await sendBrevoEmail({
      to: userEmail,
      toName: userName,
      subject: `🎉 Thank You for Your Purchase - ${planTitle} Plan`,
      htmlContent,
      textContent: plainTextContent
    });

    return result;

  } catch (error) {
    console.error('Error sending purchase receipt email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}