import config from '@/lib/config';

// Email template types
export type EmailTemplateType =
  | 'CERTIFICATE_READY_ATTENDING'
  | 'CERTIFICATE_READY_NOT_ATTENDING'
  | 'DISPATCHED_COURIER';

// Template data interfaces
export interface CertificateReadyAttendingData {
  name: string;
  convocationNumber: string;
  course: string;
}

export interface CertificateReadyNotAttendingData {
  name: string;
  convocationNumber: string;
  course: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
}

export interface DispatchedCourierData {
  name: string;
  convocationNumber: string;
  course: string;
  courierName: string; // DTDC or India Post
  trackingNumber: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
}

// Common email wrapper
function emailWrapper(content: string, preheader: string = ''): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AMASI Convocation 2026</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f4f7;
      color: #333;
      line-height: 1.6;
    }
    .preheader {
      display: none !important;
      visibility: hidden;
      mso-hide: all;
      font-size: 1px;
      line-height: 1px;
      max-height: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      color: rgba(255,255,255,0.8);
      margin: 8px 0 0;
      font-size: 14px;
    }
    .content {
      padding: 32px 24px;
    }
    .greeting {
      font-size: 18px;
      color: #1e3a8a;
      margin-bottom: 16px;
    }
    .info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #64748b;
      font-size: 14px;
    }
    .info-value {
      color: #1e293b;
      font-weight: 600;
      font-size: 14px;
    }
    .highlight-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #f59e0b;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .highlight-box h3 {
      color: #92400e;
      margin: 0 0 12px;
      font-size: 16px;
    }
    .highlight-box p {
      color: #78350f;
      margin: 0;
      font-size: 14px;
    }
    .event-details {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .event-details h3 {
      color: #1e40af;
      margin: 0 0 16px;
      font-size: 16px;
    }
    .event-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }
    .event-item:last-child {
      margin-bottom: 0;
    }
    .event-icon {
      font-size: 18px;
    }
    .event-text {
      color: #1e3a8a;
      font-size: 14px;
    }
    .event-text strong {
      display: block;
      font-size: 15px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      margin: 16px 0;
    }
    .tracking-box {
      background: #f0fdf4;
      border: 2px solid #22c55e;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .tracking-box h3 {
      color: #166534;
      margin: 0 0 8px;
      font-size: 16px;
    }
    .tracking-number {
      font-family: monospace;
      font-size: 20px;
      color: #15803d;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .footer {
      background: #f8fafc;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      color: #64748b;
      font-size: 13px;
      margin: 4px 0;
    }
    .footer a {
      color: #1e3a8a;
      text-decoration: none;
    }
    .badge-image {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 16px 0;
    }
    @media only screen and (max-width: 600px) {
      .container {
        padding: 12px;
      }
      .content {
        padding: 24px 16px;
      }
      .header {
        padding: 24px 16px;
      }
      .header h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <span class="preheader">${preheader}</span>
  <div class="container">
    <div class="card">
      ${content}
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Template: Certificate Ready - Attending
export function certificateReadyAttending(data: CertificateReadyAttendingData): { subject: string; html: string } {
  const content = `
    <div class="header">
      <h1>Convocation 2026</h1>
      <p>AMASI Certificate Management</p>
    </div>
    <div class="content">
      <p class="greeting">Dear Dr. ${data.name},</p>

      <p>Congratulations! Your certificate is ready for the upcoming convocation ceremony. We are delighted to have you join us for this special occasion.</p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Convocation Number</span>
          <span class="info-value">${data.convocationNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Course</span>
          <span class="info-value">${data.course}</span>
        </div>
      </div>

      <div class="event-details">
        <h3>Event Details</h3>
        <div class="event-item">
          <span class="event-icon">📅</span>
          <div class="event-text">
            <strong>27th August 2026, 6:00 PM</strong>
            Gates open at 4:30 PM
          </div>
        </div>
        <div class="event-item">
          <span class="event-icon">📍</span>
          <div class="event-text">
            <strong>Biswa Bangla Convention Center</strong>
            Kolkata, West Bengal
          </div>
        </div>
        <div class="event-item">
          <span class="event-icon">👔</span>
          <div class="event-text">
            <strong>Dress Code</strong>
            Formal attire (Gown will be provided at venue)
          </div>
        </div>
      </div>

      <div class="highlight-box">
        <h3>Important Information</h3>
        <p><strong>Gown Charges:</strong> ₹${config.convocation.gownTotal} (₹${config.convocation.gownRent} rent + ₹${config.convocation.gownDeposit} refundable deposit)</p>
        <p><strong>Certificate Collection:</strong> ${config.convocation.certificateCollectionDate} at AMASI Office</p>
        <p>Please carry your ID proof and this email for verification.</p>
      </div>

      <p>Your digital badge is attached to this email. Please keep it handy for the registration desk.</p>

      <p style="text-align: center;">
        <a href="${config.getTrackUrl(data.convocationNumber)}" class="button">Track Your Certificate</a>
      </p>

      <p>We look forward to celebrating your achievement!</p>

      <p>Warm regards,<br><strong>AMASI Convocation Team</strong></p>
    </div>
    <div class="footer">
      <p>Association of Minimal Access Surgeons of India</p>
      <p>Email: <a href="mailto:${config.contact.email}">${config.contact.email}</a></p>
      <p style="color: #94a3b8; font-size: 11px; margin-top: 16px;">
        This email was sent regarding your AMASICON 2026 convocation registration.
      </p>
    </div>
  `;

  return {
    subject: `Your Certificate is Ready for Convocation - AMASICON 2026`,
    html: emailWrapper(content, `Dr. ${data.name}, your certificate is ready for collection at the convocation ceremony on ${config.convocation.date}.`),
  };
}

// Template: Certificate Ready - Not Attending
export function certificateReadyNotAttending(data: CertificateReadyNotAttendingData): { subject: string; html: string } {
  const addressHtml = data.address ? `
    <div class="info-box">
      <h4 style="margin: 0 0 12px; color: #1e3a8a;">Shipping Address</h4>
      <p style="margin: 0; color: #334155;">
        ${data.address.line1}<br>
        ${data.address.line2 ? `${data.address.line2}<br>` : ''}
        ${data.address.city}, ${data.address.state}<br>
        <strong>${data.address.pincode}</strong>
      </p>
    </div>
  ` : '';

  const content = `
    <div class="header">
      <h1>Convocation 2026</h1>
      <p>AMASI Certificate Management</p>
    </div>
    <div class="content">
      <p class="greeting">Dear Dr. ${data.name},</p>

      <p>Congratulations on your achievement! We understand you won't be able to attend the convocation ceremony in person. Don't worry - your certificate will be safely delivered to you.</p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Convocation Number</span>
          <span class="info-value">${data.convocationNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Course</span>
          <span class="info-value">${data.course}</span>
        </div>
      </div>

      ${addressHtml}

      <div class="highlight-box">
        <h3>What Happens Next?</h3>
        <p>After the convocation ceremony (${config.convocation.date}), your certificate will be couriered to your registered address.</p>
        <p>Expected dispatch: Within 7-10 working days after the ceremony.</p>
        <p>You will receive tracking details once dispatched.</p>
      </div>

      <p>If you need to update your shipping address, please do so before <strong>${config.convocation.addressDeadline}</strong>.</p>

      <p>Warm regards,<br><strong>AMASI Convocation Team</strong></p>
    </div>
    <div class="footer">
      <p>Association of Minimal Access Surgeons of India</p>
      <p>Email: <a href="mailto:${config.contact.email}">${config.contact.email}</a></p>
      <p style="color: #94a3b8; font-size: 11px; margin-top: 16px;">
        This email was sent regarding your AMASICON 2026 convocation registration.
      </p>
    </div>
  `;

  return {
    subject: `Your Certificate Will Be Couriered - AMASICON 2026`,
    html: emailWrapper(content, `Dr. ${data.name}, your certificate will be couriered to you after the convocation ceremony.`),
  };
}

// Template: Dispatched via Courier
export function dispatchedCourier(data: DispatchedCourierData): { subject: string; html: string } {
  const addressHtml = data.address ? `
    <div class="info-box">
      <h4 style="margin: 0 0 12px; color: #1e3a8a;">Delivery Address</h4>
      <p style="margin: 0; color: #334155;">
        ${data.address.line1}<br>
        ${data.address.line2 ? `${data.address.line2}<br>` : ''}
        ${data.address.city}, ${data.address.state}<br>
        <strong>${data.address.pincode}</strong>
      </p>
    </div>
  ` : '';

  const trackingUrlMap: Record<string, string> = {
    'DTDC': `https://www.dtdc.in/tracking.asp`,
    'India Post': `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`,
  };

  const trackingUrl = trackingUrlMap[data.courierName] || '#';

  const content = `
    <div class="header">
      <h1>Convocation 2026</h1>
      <p>AMASI Certificate Management</p>
    </div>
    <div class="content">
      <p class="greeting">Dear Dr. ${data.name},</p>

      <p>Great news! Your certificate has been dispatched and is on its way to you.</p>

      <div class="tracking-box">
        <h3>${data.courierName} Tracking</h3>
        <div class="tracking-number">${data.trackingNumber}</div>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Convocation Number</span>
          <span class="info-value">${data.convocationNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Course</span>
          <span class="info-value">${data.course}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Courier Service</span>
          <span class="info-value">${data.courierName}</span>
        </div>
      </div>

      ${addressHtml}

      <p style="text-align: center;">
        <a href="${trackingUrl}" class="button">Track Your Shipment</a>
      </p>

      <div class="highlight-box">
        <h3>Delivery Information</h3>
        <p>Expected delivery: 5-7 business days (may vary by location)</p>
        <p>Please ensure someone is available to receive the package.</p>
        <p>The package will require a signature upon delivery.</p>
      </div>

      <p>If you have any questions about your delivery, please contact us at <a href="mailto:${config.contact.email}">${config.contact.email}</a>.</p>

      <p>Congratulations once again on your achievement!</p>

      <p>Warm regards,<br><strong>AMASI Convocation Team</strong></p>
    </div>
    <div class="footer">
      <p>Association of Minimal Access Surgeons of India</p>
      <p>Email: <a href="mailto:${config.contact.email}">${config.contact.email}</a></p>
      <p style="color: #94a3b8; font-size: 11px; margin-top: 16px;">
        This email was sent regarding your AMASICON 2026 certificate dispatch.
      </p>
    </div>
  `;

  return {
    subject: `Your Certificate Has Been Dispatched - Tracking: ${data.trackingNumber}`,
    html: emailWrapper(content, `Dr. ${data.name}, your certificate has been dispatched via ${data.courierName}. Tracking: ${data.trackingNumber}`),
  };
}

// Get template by type
export function getEmailTemplate(
  type: EmailTemplateType,
  data: CertificateReadyAttendingData | CertificateReadyNotAttendingData | DispatchedCourierData
): { subject: string; html: string } {
  switch (type) {
    case 'CERTIFICATE_READY_ATTENDING':
      return certificateReadyAttending(data as CertificateReadyAttendingData);
    case 'CERTIFICATE_READY_NOT_ATTENDING':
      return certificateReadyNotAttending(data as CertificateReadyNotAttendingData);
    case 'DISPATCHED_COURIER':
      return dispatchedCourier(data as DispatchedCourierData);
    default:
      throw new Error(`Unknown email template type: ${type}`);
  }
}
