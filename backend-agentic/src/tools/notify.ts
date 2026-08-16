import type { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface NotifyOptions {
  recipientEmail: string;
  subjectName: string;
  requestId: string;
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  return `${local.charAt(0)}***@${domain}`;
}

let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (!transporter) {
    const nodemailer = (await import('nodemailer')).default;
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_MAIL,
        pass: env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function notifyNotesReady(options: NotifyOptions): Promise<boolean> {
  const { recipientEmail, subjectName, requestId } = options;

  if (!recipientEmail) {
    logger.warn('No recipient email specified for notification');
    return false;
  }

  logger.info(
    { recipientEmail: maskEmail(recipientEmail), subjectName, requestId },
    'Sending notes ready notification email...'
  );

  // Check if SMTP is configured
  if (env.SMTP_HOST && env.SMTP_MAIL && env.SMTP_PASSWORD) {
    try {
      const smtpTransporter = await getTransporter();

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #4F46E5;">🐼 Your PandaPrep Revision Notes are Ready!</h2>
          <p>Hi there,</p>
          <p>Great news! Your revision notes for <strong>${escapeHtml(subjectName)}</strong> have been generated, fully verified, and are ready in your dashboard.</p>
          <div style="margin: 24px 0;">
            <a href="https://pandaprep.tech/history" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View & Download Notes
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">Request ID: ${escapeHtml(requestId)}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 11px;">Team PandaPrep — Structured revision notes tailored for exam success.</p>
        </div>
      `;

      await smtpTransporter.sendMail({
        from: `"${env.FROM_NAME}" <${env.FROM_EMAIL || env.SMTP_MAIL}>`,
        to: recipientEmail,
        subject: `Your ${escapeHtml(subjectName)} Revision Notes are Ready! 🐼`,
        html: emailHtml,
      });

      logger.info(
        { recipientEmail: maskEmail(recipientEmail), requestId },
        'Notification email sent successfully'
      );
      return true;
    } catch (error) {
      logger.warn(
        { err: error, recipientEmail: maskEmail(recipientEmail) },
        'Failed to send notification email via SMTP'
      );
      return false;
    }
  }

  logger.info(
    { recipientEmail: maskEmail(recipientEmail) },
    'SMTP not configured; simulated email dispatch logged successfully'
  );
  return true;
}