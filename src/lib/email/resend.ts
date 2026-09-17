import { Resend } from 'resend';

// Lazily constructed so a missing key fails at send-time (with a clear error)
// rather than at import/build time.
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendViaResendOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmailViaResend(
  options: SendViaResendOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const fromName = process.env.SMTP_FROM_NAME || 'AMASI Convocation 2026';
    const fromEmail = process.env.RESEND_FROM || 'certificates@amasi.org';

    const { data, error } = await getResendClient().emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error('[Resend] Error sending email:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Resend] Sent successfully to ${options.to}. Message ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[Resend] Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
