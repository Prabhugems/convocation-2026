import config from '@/lib/config';

// Email template types
export type EmailTemplateType =
  | 'CERTIFICATE_READY_ATTENDING'
  | 'CERTIFICATE_READY_NOT_ATTENDING'
  | 'DISPATCHED_COURIER'
  | 'CERTIFICATE_COLLECTED'
  | 'CERTIFICATE_DELIVERED'
  | 'DTDC_DISPATCH_NOTIFICATION'
  | 'ADDRESS_REQUEST';

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

export interface DtdcDispatchData {
  name: string;
  convocationNumber: string;
  course: string;
  trackingNumber: string;
  dispatchDate: string; // pre-formatted, e.g. "17.09.2026"
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
}

export interface AddressRequestData {
  name: string;
  convocationNumber: string;
  course: string;
  formUrl: string;
}

export interface CertificateCollectedData {
  name: string;
  convocationNumber: string;
  course: string;
  collectionDate: string;
  collectedBy?: string; // If collected by representative
}

export interface CertificateDeliveredData {
  name: string;
  convocationNumber: string;
  course: string;
  courierName: string;
  trackingNumber: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
}

// MMAS convocation numbers are letters-first (e.g. MHPB1018, MHER1001),
// the opposite order from FMAS's digits-first format (e.g. 125AEC1038) —
// same distinction UniversalScanner's detectInputType uses. Used so these
// certificate emails say the right cohort instead of always "FMAS".
function certificateLabel(convocationNumber: string): 'FMAS' | 'MMAS' {
  return /^[a-zA-Z]{2,4}\d{3,5}$/.test(convocationNumber.trim()) ? 'MMAS' : 'FMAS';
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
            <strong>27th August 2026, 5:30 PM</strong>
            Reporting Time: 5:00 PM
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

// Renders one label/value row as an HTML table row with inline styles.
// The rest of this file's label/value pairs use a flexbox `.info-row`
// class, but flexbox is unreliably supported in email clients (Gmail in
// particular) — it silently collapses, running the label and value
// together with no gap. Tables with inline styles are the actually
// portable way to lay out rows in HTML email.
function dtdcInfoRow(label: string, value: string, isLast = false): string {
  const borderStyle = isLast ? '' : 'border-bottom: 1px solid #e2e8f0;';
  return `
    <tr>
      <td style="padding: 8px 0; ${borderStyle} color: #64748b; font-size: 14px; text-align: left;">${label}</td>
      <td style="padding: 8px 0; ${borderStyle} color: #1e293b; font-weight: 600; font-size: 14px; text-align: right;">${value}</td>
    </tr>
  `;
}

// Template: DTDC Dispatch Notification (automated, sent right after address-label scan)
export function dtdcDispatchNotification(data: DtdcDispatchData): { subject: string; html: string } {
  const certLabel = certificateLabel(data.convocationNumber);
  const content = `
    <div class="header">
      <h1>Convocation 2026</h1>
      <p>AMASI Certificate Management</p>
    </div>
    <div class="content">
      <p class="greeting">Dear Dr. ${data.name},</p>

      <p>Greetings from AMASI!</p>

      <p>We are pleased to inform you that your <strong>${certLabel} Certificate</strong> has been dispatched today via <strong>DTDC Courier Services</strong>.</p>

      <div class="info-box">
        <h4 style="margin: 0 0 12px; color: #1e3a8a;">Dispatch Details</h4>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          ${dtdcInfoRow('Tracking Number', data.trackingNumber)}
          ${dtdcInfoRow('Courier Service', 'DTDC')}
          ${dtdcInfoRow('Dispatch Date', data.dispatchDate)}
          ${dtdcInfoRow('Expected Delivery', '10-15 business days', true)}
        </table>
      </div>

      <div class="info-box">
        <h4 style="margin: 0 0 12px; color: #1e3a8a;">Your Address</h4>
        <p style="margin: 0; color: #334155;">
          ${data.address.line1}<br>
          ${data.address.line2 ? `${data.address.line2}<br>` : ''}
          ${data.address.city}, ${data.address.state}<br>
          <strong>${data.address.pincode}</strong>
        </p>
      </div>

      <div class="highlight-box">
        <h3>⚠️ Critical: Do Not Accept If Folded Or Damaged</h3>
        <p>We have specifically instructed the courier service to handle your certificate with care and <strong>NOT to fold</strong> the package during transit. Your certificate should arrive in pristine condition.</p>
      </div>

      <h4 style="color: #1e3a8a; margin: 24px 0 12px;">What to do upon delivery:</h4>
      <ol style="color: #334155; padding-left: 20px; margin: 0 0 24px;">
        <li style="margin-bottom: 8px;"><strong>Inspect the package</strong> before accepting delivery</li>
        <li style="margin-bottom: 8px;"><strong>Check</strong> that the certificate is not folded, bent, or damaged</li>
        <li style="margin-bottom: 8px;"><strong>Accept delivery only if</strong> the certificate is in perfect condition</li>
        <li style="margin-bottom: 8px;"><strong>Refuse delivery if</strong> you notice any folding, creasing, or damage</li>
        <li style="margin-bottom: 0;"><strong>Contact us immediately</strong> if you refuse delivery due to damage</li>
      </ol>

      <p style="text-align: center;">
        <a href="https://www.dtdc.com/track-your-shipment/" class="button">Track Your Certificate</a>
      </p>

      <p style="text-align: center; color: #64748b; font-size: 13px; margin-top: -12px;">
        Enter your tracking number (<strong>${data.trackingNumber}</strong>) as the Shipment Number on the DTDC page.
      </p>

      <p>If you encounter any issues with delivery or need to refuse a damaged certificate, please contact us immediately at <a href="mailto:amasi.india@gmail.com">amasi.india@gmail.com</a>.</p>

      <p>Congratulations once again on achieving your ${certLabel} certification!</p>

      <p>Best regards,<br><strong>AMASI Office</strong></p>
    </div>
    <div class="footer">
      <p>Association of Minimal Access Surgeons of India</p>
      <p>Email: <a href="mailto:amasi.india@gmail.com">amasi.india@gmail.com</a></p>
      <p style="color: #94a3b8; font-size: 11px; margin-top: 16px;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  `;

  return {
    subject: `Your ${certLabel} Certificate Has Been Dispatched via DTDC - Tracking: ${data.trackingNumber}`,
    html: emailWrapper(content, `Dr. ${data.name}, your ${certLabel} certificate has been dispatched via DTDC. Tracking: ${data.trackingNumber}`),
  };
}

// Template: Certificate Collected (In-Person)
export function certificateCollected(data: CertificateCollectedData): { subject: string; html: string } {
  const certLabel = certificateLabel(data.convocationNumber);
  const collectedByHtml = data.collectedBy ? `
    <div class="info-row">
      <span class="info-label">Collected By</span>
      <span class="info-value">${data.collectedBy}</span>
    </div>
  ` : '';

  const content = `
    <div class="header">
      <h1>Certificate Collected</h1>
      <p>AMASI Convocation 2026</p>
    </div>
    <div class="content">
      <p class="greeting">Dear Dr. ${data.name},</p>

      <p>Greetings from AMASI!</p>

      <p>We are pleased to confirm that your <strong>${certLabel} Certificate</strong> has been successfully collected.</p>

      <div class="tracking-box" style="background: #f0fdf4; border-color: #22c55e;">
        <h3 style="color: #166534;">✓ Collection Confirmed</h3>
        <p style="color: #15803d; margin: 0;">Your certificate has been handed over successfully</p>
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
          <span class="info-label">Collection Date</span>
          <span class="info-value">${data.collectionDate}</span>
        </div>
        ${collectedByHtml}
      </div>

      <div class="highlight-box">
        <h3>Thank You for Attending!</h3>
        <p>We hope you had a memorable convocation ceremony. Your dedication and hard work have led to this achievement.</p>
        <p>Please keep your certificate safe. In case of any damage or loss, contact us for assistance.</p>
      </div>

      <p>Congratulations once again on achieving your ${certLabel} certification!</p>

      <p>Best regards,<br><strong>AMASI Office</strong></p>
    </div>
    <div class="footer">
      <p>Association of Minimal Access Surgeons of India</p>
      <p>Email: <a href="mailto:${config.contact.email}">${config.contact.email}</a></p>
      <p style="color: #94a3b8; font-size: 11px; margin-top: 16px;">
        This is a confirmation email for your ${certLabel} certificate collection.
      </p>
    </div>
  `;

  return {
    subject: `Certificate Collection Confirmed - ${certLabel} ${data.convocationNumber}`,
    html: emailWrapper(content, `Dr. ${data.name}, your ${certLabel} certificate collection has been confirmed.`),
  };
}

// Template: Certificate Delivered (Courier Delivery Confirmed)
export function certificateDelivered(data: CertificateDeliveredData): { subject: string; html: string } {
  const certLabel = certificateLabel(data.convocationNumber);
  const addressHtml = data.address ? `
    <div class="info-box">
      <h4 style="margin: 0 0 12px; color: #1e3a8a;">Delivered To</h4>
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
      <h1>Certificate Delivered</h1>
      <p>AMASI Convocation 2026</p>
    </div>
    <div class="content">
      <p class="greeting">Dear Dr. ${data.name},</p>

      <p>Greetings from AMASI!</p>

      <p>We are pleased to inform you that your <strong>${certLabel} Certificate</strong> has been successfully delivered to your registered address.</p>

      <div class="tracking-box" style="background: #f0fdf4; border-color: #22c55e;">
        <h3 style="color: #166534;">✓ Delivery Confirmed</h3>
        <div class="tracking-number" style="color: #15803d;">${data.trackingNumber}</div>
        <p style="color: #166534; margin: 8px 0 0; font-size: 14px;">Service: ${data.courierName}</p>
      </div>

      ${addressHtml}

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

      <p style="text-align: center;">
        <a href="${trackingUrl}" class="button">View Delivery Details</a>
      </p>

      <div class="highlight-box" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-color: #ef4444;">
        <h3 style="color: #991b1b;">⚠️ Important Notice</h3>
        <p style="color: #991b1b;"><strong>Please report any complaints or issues regarding the certificate delivery within 48 hours to:</strong></p>
        <p style="color: #991b1b; font-size: 16px; font-weight: bold;"><a href="mailto:${config.contact.email}" style="color: #991b1b;">${config.contact.email}</a></p>
        <p style="color: #7f1d1d; font-size: 13px; margin-top: 12px;">No response within 48 hours will be considered as confirmation that the delivery is satisfactory and the certificate is in good condition.</p>
      </div>

      <p>Congratulations once again on achieving your ${certLabel} certification!</p>

      <p>Best regards,<br><strong>AMASI Office</strong></p>
    </div>
    <div class="footer">
      <p>Association of Minimal Access Surgeons of India</p>
      <p>Email: <a href="mailto:${config.contact.email}">${config.contact.email}</a></p>
      <p style="color: #94a3b8; font-size: 11px; margin-top: 16px;">
        This is a confirmation email for your ${certLabel} certificate delivery.
      </p>
    </div>
  `;

  return {
    subject: `Certificate Delivered Successfully - ${certLabel} ${data.convocationNumber}`,
    html: emailWrapper(content, `Dr. ${data.name}, your ${certLabel} certificate has been delivered. Please report any issues within 48 hours.`),
  };
}

// Template: Address Request (no address on file, needed before dispatch)
export function addressRequest(data: AddressRequestData): { subject: string; html: string } {
  const certLabel = certificateLabel(data.convocationNumber);
  const content = `
    <div class="header">
      <h1>Convocation 2026</h1>
      <p>AMASI Certificate Management</p>
    </div>
    <div class="content">
      <p class="greeting">Dear Dr. ${data.name},</p>

      <p>Congratulations on your achievement! We are ready to dispatch your <strong>${certLabel} Certificate</strong>, but we do not have a mailing address on file for you yet.</p>

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

      <p>Please submit your complete address so we can courier your certificate to you as soon as possible.</p>

      <p style="text-align: center;">
        <a href="${data.formUrl}" class="button">Submit My Address</a>
      </p>

      <p style="font-size: 13px; color: #64748b;">If the button above doesn't work, copy and paste this link into your browser:<br>${data.formUrl}</p>

      <p>Warm regards,<br><strong>AMASI Convocation Team</strong></p>
    </div>
    <div class="footer">
      <p>Association of Minimal Access Surgeons of India</p>
      <p>Email: <a href="mailto:${config.contact.email}">${config.contact.email}</a></p>
    </div>
  `;

  return {
    subject: `Action Required: Address Needed to Dispatch Your Certificate - ${data.convocationNumber}`,
    html: emailWrapper(content, `Dr. ${data.name}, please submit your address so we can dispatch your certificate.`),
  };
}

// Get template by type
export function getEmailTemplate(
  type: EmailTemplateType,
  data: CertificateReadyAttendingData | CertificateReadyNotAttendingData | DispatchedCourierData | CertificateCollectedData | CertificateDeliveredData | DtdcDispatchData | AddressRequestData
): { subject: string; html: string } {
  switch (type) {
    case 'CERTIFICATE_READY_ATTENDING':
      return certificateReadyAttending(data as CertificateReadyAttendingData);
    case 'CERTIFICATE_READY_NOT_ATTENDING':
      return certificateReadyNotAttending(data as CertificateReadyNotAttendingData);
    case 'DISPATCHED_COURIER':
      return dispatchedCourier(data as DispatchedCourierData);
    case 'CERTIFICATE_COLLECTED':
      return certificateCollected(data as CertificateCollectedData);
    case 'CERTIFICATE_DELIVERED':
      return certificateDelivered(data as CertificateDeliveredData);
    case 'DTDC_DISPATCH_NOTIFICATION':
      return dtdcDispatchNotification(data as DtdcDispatchData);
    case 'ADDRESS_REQUEST':
      return addressRequest(data as AddressRequestData);
    default:
      throw new Error(`Unknown email template type: ${type}`);
  }
}
