import nodemailer from 'nodemailer';

// SMTP Configuration
const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.zeptomail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER || 'emailapikey',
    pass: process.env.SMTP_PASS || '',
  },
};

// Create transporter
const transporter = nodemailer.createTransport(smtpConfig);

// Email attachment interface
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string; // Content-ID for inline images
}

// Email options interface
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}

// Send email function
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const fromName = process.env.SMTP_FROM_NAME || 'AMASI Convocation 2026';
    const fromEmail = process.env.SMTP_FROM || 'certificates@amasi.org';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        cid: att.cid,
      })),
      replyTo: options.replyTo || fromEmail,
    };

    console.log(`[Email] Sending to: ${options.to}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Sent successfully. Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Test SMTP connection
export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    await transporter.verify();
    console.log('[Email] SMTP connection verified successfully');
    return { success: true };
  } catch (error) {
    console.error('[Email] SMTP connection failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Helper to strip HTML tags for plain text version
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
