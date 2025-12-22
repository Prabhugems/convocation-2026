import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, EmailAttachment } from '@/lib/email/send';
import {
  getEmailTemplate,
  EmailTemplateType,
  CertificateReadyAttendingData,
  CertificateReadyNotAttendingData,
  DispatchedCourierData,
} from '@/lib/email/templates';
import config from '@/lib/config';

interface SendEmailRequest {
  to: string;
  template: EmailTemplateType;
  data: CertificateReadyAttendingData | CertificateReadyNotAttendingData | DispatchedCourierData;
  attachBadge?: boolean;
  convocationNumber?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json();
    const { to, template, data, attachBadge, convocationNumber } = body;

    if (!to || !template || !data) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, template, data' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    console.log(`[Email API] Sending ${template} email to: ${to}`);

    // Get email template
    const { subject, html } = getEmailTemplate(template, data);

    // Prepare attachments
    const attachments: EmailAttachment[] = [];

    // Attach badge if requested and we have a convocation number
    if (attachBadge && convocationNumber) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const badgeResponse = await fetch(`${baseUrl}/api/badge/${convocationNumber}`);

        if (badgeResponse.ok) {
          const badgeBuffer = await badgeResponse.arrayBuffer();
          attachments.push({
            filename: `Badge_${convocationNumber}.png`,
            content: Buffer.from(badgeBuffer),
            contentType: 'image/png',
          });
          console.log(`[Email API] Badge attached for ${convocationNumber}`);
        } else {
          console.warn(`[Email API] Failed to fetch badge for ${convocationNumber}`);
        }
      } catch (err) {
        console.error('[Email API] Error fetching badge:', err);
      }
    }

    // Send email
    const result = await sendEmail({
      to,
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: `Email sent successfully to ${to}`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Email API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

// GET endpoint to preview email template
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const template = searchParams.get('template') as EmailTemplateType;

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Missing template parameter' },
        { status: 400 }
      );
    }

    // Sample data for preview
    const sampleData = {
      CERTIFICATE_READY_ATTENDING: {
        name: 'Sample Graduate',
        convocationNumber: '119AEC1001',
        course: '119 FMAS Chandigarh',
        trackingUrl: 'https://example.com/track',
      },
      CERTIFICATE_READY_NOT_ATTENDING: {
        name: 'Sample Graduate',
        convocationNumber: '119AEC1001',
        course: '119 FMAS Chandigarh',
        address: {
          line1: '123 Sample Street',
          line2: 'Apartment 4B',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
      },
      DISPATCHED_COURIER: {
        name: 'Sample Graduate',
        convocationNumber: '119AEC1001',
        course: '119 FMAS Chandigarh',
        courierName: 'DTDC',
        trackingNumber: 'D12345678901',
        address: {
          line1: '123 Sample Street',
          line2: 'Apartment 4B',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
      },
    };

    const data = sampleData[template];
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Invalid template type' },
        { status: 400 }
      );
    }

    const { subject, html } = getEmailTemplate(template, data);

    // Return HTML preview
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('[Email API] Preview error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
