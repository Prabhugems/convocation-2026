import { NextRequest, NextResponse } from 'next/server';
import { testSmtpConnection, sendEmail } from '@/lib/email/send';

// Test SMTP connection
export async function GET() {
  try {
    console.log('[Email Test] Testing SMTP connection...');

    const result = await testSmtpConnection();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'SMTP connection successful',
        config: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          from: process.env.SMTP_FROM,
          fromName: process.env.SMTP_FROM_NAME,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: 'SMTP connection failed',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Email Test] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test SMTP connection' },
      { status: 500 }
    );
  }
}

// Send a test email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to } = body;

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Missing "to" email address' },
        { status: 400 }
      );
    }

    console.log(`[Email Test] Sending test email to: ${to}`);

    const result = await sendEmail({
      to,
      subject: 'Test Email - AMASI Convocation 2026',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f4f4f7;
              margin: 0;
              padding: 20px;
            }
            .card {
              max-width: 500px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 16px;
              box-shadow: 0 4px 24px rgba(0,0,0,0.08);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
              padding: 32px;
              text-align: center;
            }
            .header h1 {
              color: #ffffff;
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 32px;
              text-align: center;
            }
            .success-icon {
              font-size: 48px;
              margin-bottom: 16px;
            }
            .content h2 {
              color: #22c55e;
              margin: 0 0 16px;
            }
            .content p {
              color: #64748b;
              line-height: 1.6;
            }
            .footer {
              background: #f8fafc;
              padding: 16px;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              color: #94a3b8;
              font-size: 12px;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>AMASI Convocation 2026</h1>
            </div>
            <div class="content">
              <div class="success-icon">✅</div>
              <h2>Email System Working!</h2>
              <p>This is a test email from the AMASI Certificate Management System.</p>
              <p>If you received this email, your SMTP configuration is correct.</p>
              <p style="margin-top: 24px; color: #94a3b8; font-size: 13px;">
                Sent at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
              </p>
            </div>
            <div class="footer">
              <p>AMASI Certificate Management System</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${to}`,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Email Test] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send test email' },
      { status: 500 }
    );
  }
}
