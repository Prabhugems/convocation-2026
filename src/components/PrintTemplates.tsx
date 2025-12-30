'use client';

import { forwardRef } from 'react';
import QRCode from 'react-qr-code';
import { Graduate, Address } from '@/types';

interface PrintProps {
  graduate: Graduate;
}

// 3x2 inch sticker for certificate envelope (LANDSCAPE: 3" wide × 2" tall)
// FIXED: Exact sizing - text 1.6in, QR 1.1in, padding 0.15in on each side
// Layout: Left side has CON. No and Name, Right side has QR code
export const Sticker3x2 = forwardRef<HTMLDivElement, PrintProps>(({ graduate }, ref) => {
  // Generate Tito ticket URL for QR code
  const titoUrl = graduate.ticketSlug
    ? `https://ti.to/tickets/${graduate.ticketSlug}`
    : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${graduate.registrationNumber}`;

  return (
    <div
      ref={ref}
      className="sticker-3x2"
      style={{
        width: '3in',
        height: '2in',
        maxWidth: '3in',
        maxHeight: '2in',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.15in',
        fontFamily: 'Helvetica, Arial, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Left side - 1.6in - Text content */}
      <div
        style={{
          flex: '0 0 1.6in',
          maxWidth: '1.6in',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingRight: '0.1in',
          overflow: 'hidden',
        }}
      >
        {/* CON. No- label */}
        <p
          style={{
            fontSize: '9pt',
            color: '#333',
            margin: 0,
            marginBottom: '2px',
          }}
        >
          CON. No-
        </p>
        {/* Convocation Number - Bold */}
        <p
          style={{
            fontSize: '11pt',
            fontWeight: 'bold',
            color: '#000',
            margin: 0,
            marginBottom: '4px',
          }}
        >
          {graduate.convocationNumber || 'N/A'}
        </p>
        {/* Name with Dr. prefix */}
        <p
          style={{
            fontSize: '10pt',
            fontWeight: 'normal',
            color: '#000',
            margin: 0,
            lineHeight: '1.2',
          }}
        >
          Dr. {graduate.name}
        </p>
      </div>

      {/* Right side - 1.1in - QR Code */}
      <div
        style={{
          flex: '0 0 1.1in',
          width: '1.1in',
          height: '1.1in',
          maxWidth: '1.1in',
          maxHeight: '1.1in',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <QRCode
          value={titoUrl}
          size={105}  // ~1.1 inches at 96 DPI
          style={{
            width: '1.1in',
            height: '1.1in',
            maxWidth: '1.1in',
            maxHeight: '1.1in',
          }}
        />
      </div>
    </div>
  );
});
Sticker3x2.displayName = 'Sticker3x2';

// 4x6 inch badge for registration - BLACK ONLY for thermal/label printer
// Pre-printed overlay has orange header/footer - we print only black content
// MUST MATCH digital badge layout exactly for alignment with pre-printed paper
export const Badge4x6 = forwardRef<HTMLDivElement, PrintProps>(({ graduate }, ref) => {
  // Generate Tito ticket URL for QR code
  const titoUrl = graduate.ticketSlug
    ? `https://ti.to/tickets/${graduate.ticketSlug}`
    : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${graduate.convocationNumber || graduate.registrationNumber}`;

  return (
    <div
      ref={ref}
      className="badge-4x6"
      style={{
        width: '4in',
        height: '6in',
        backgroundColor: 'white',
        fontFamily: 'Arial, Helvetica, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '0.75in',    // Skip overlay header (~220px at 300dpi = 0.73in)
        paddingBottom: '0.4in',  // Skip overlay footer
        paddingLeft: '0.15in',
        paddingRight: '0.15in',
        boxSizing: 'border-box',
      }}
    >
      {/* CONVOCATION 2026 - Black, large, bold */}
      <div
        style={{
          fontSize: '21pt',
          fontWeight: 'bold',
          color: '#000',
          textAlign: 'center',
          marginBottom: '8pt',
          letterSpacing: '1px',
        }}
      >
        CONVOCATION 2026
      </div>

      {/* Course name - Black bold text */}
      <div
        style={{
          fontSize: '16pt',
          fontWeight: 'bold',
          color: '#000',
          textAlign: 'center',
          marginBottom: '10pt',
        }}
      >
        {graduate.course || 'FMAS Course'}
      </div>

      {/* Name with Dr. prefix - Black, large, bold */}
      <div
        style={{
          fontSize: '19pt',
          fontWeight: 'bold',
          color: '#000',
          textAlign: 'center',
          marginBottom: '10pt',
          lineHeight: '1.2',
        }}
      >
        Dr. {graduate.name}
      </div>

      {/* QR Code - centered, larger */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '10pt',
        }}
      >
        <QRCode value={titoUrl} size={130} />
      </div>

      {/* Convocation Number - Black, bold */}
      <div
        style={{
          fontSize: '17pt',
          fontWeight: 'bold',
          color: '#000',
          textAlign: 'center',
          letterSpacing: '1px',
          marginBottom: '12pt',
        }}
      >
        {graduate.convocationNumber || ''}
      </div>

      {/* Collection Info */}
      <div
        style={{
          fontSize: '9pt',
          color: '#333',
          textAlign: 'center',
          marginBottom: '2pt',
        }}
      >
        Collect your certificate on 28th August 2026
      </div>
      <div
        style={{
          fontSize: '9pt',
          color: '#333',
          textAlign: 'center',
          marginBottom: '10pt',
        }}
      >
        at AMASI Office (Venue)
      </div>

      {/* Separator line */}
      <div
        style={{
          width: '80%',
          height: '1px',
          backgroundColor: '#ccc',
          marginBottom: '8pt',
        }}
      />

      {/* Disclaimer note */}
      <div
        style={{
          fontSize: '6pt',
          color: '#666',
          textAlign: 'center',
          lineHeight: '1.4',
        }}
      >
        This badge is valid for Convocation Ceremony only,
        <br />
        not for AMASICON 2026 conference registration.
      </div>
    </div>
  );
});
Badge4x6.displayName = 'Badge4x6';

// Address label data interface (extends Graduate with Airtable data)
export interface AddressLabelData {
  name: string;
  course: string;
  convocationNumber: string;
  ticketSlug?: string;
  registrationNumber: string;
  address: Address;
  phone?: string;
  trackingNumber?: string;
  dtdcAvailable?: boolean;
}

// 4x6 inch address label - INK-SAVING design for WHITE LABEL PAPER
// No filled bars - just text and thin lines
export const AddressLabel4x6 = forwardRef<HTMLDivElement, { data: AddressLabelData }>(({ data }, ref) => {
  // Generate Tito ticket URL for QR code
  const titoUrl = data.ticketSlug
    ? `https://ti.to/tickets/${data.ticketSlug}`
    : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${data.registrationNumber}`;

  return (
    <div
      ref={ref}
      className="address-label-4x6"
      style={{
        width: '4in',
        height: '6in',
        backgroundColor: 'white',
        fontFamily: 'Helvetica, Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        paddingTop: '20pt',
        paddingLeft: '15pt',
        paddingRight: '15pt',
        paddingBottom: '15pt',
      }}
    >
      {/* TOP: Course name (bold text, no bar) + thin separator line */}
      <div
        style={{
          fontSize: '16pt',
          fontWeight: 'bold',
          color: '#000',
          textAlign: 'left',
          marginBottom: '8pt',
        }}
      >
        {data.course || 'FMAS Chandigarh'}
      </div>
      {/* Thin separator line */}
      <div
        style={{
          width: '100%',
          height: '1pt',
          backgroundColor: '#000',
          marginBottom: '15pt',
        }}
      />

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header row: Address left, QR right */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '10pt',
          }}
        >
          {/* Left side - Address */}
          <div style={{ flex: 1, paddingRight: '10pt' }}>
            <p style={{ fontSize: '12pt', color: '#000', marginBottom: '4pt' }}>To</p>
            <p style={{ fontSize: '14pt', fontWeight: 'bold', color: '#000', marginBottom: '2pt' }}>
              Dr. {data.name}
            </p>
            <p style={{ fontSize: '12pt', color: '#000', marginBottom: '6pt' }}>
              CON. No {data.convocationNumber}
            </p>
            <p style={{ fontSize: '11pt', color: '#000', marginBottom: '2pt' }}>{data.address.line1}</p>
            {data.address.line2 && (
              <p style={{ fontSize: '11pt', color: '#000', marginBottom: '2pt' }}>{data.address.line2}</p>
            )}
            <p style={{ fontSize: '11pt', color: '#000', marginBottom: '2pt' }}>{data.address.city}</p>
            <p style={{ fontSize: '11pt', color: '#000', marginBottom: '2pt' }}>
              {data.address.state}- {data.address.pincode}
            </p>
            {data.phone && (
              <p style={{ fontSize: '11pt', color: '#000', marginTop: '6pt' }}>
                Ph No -{data.phone}
              </p>
            )}
          </div>

          {/* Right side - QR Code */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-end',
            }}
          >
            <QRCode value={titoUrl} size={80} />
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottom: Barcode and tracking info */}
        <div style={{ marginTop: 'auto' }}>
          {data.dtdcAvailable && data.trackingNumber ? (
            <>
              {/* Code 128 barcode placeholder - will be rendered in print function */}
              <div
                className="barcode-placeholder"
                data-tracking={data.trackingNumber}
                style={{
                  width: '100%',
                  height: '50pt',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '6pt',
                }}
              >
                {/* Barcode will be inserted here by print function */}
              </div>
              <p style={{ fontSize: '11pt', color: '#000', textAlign: 'center' }}>
                DTDC Tracking No - {data.trackingNumber}
              </p>
            </>
          ) : (
            <p style={{ fontSize: '14pt', fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
              Speed Post
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
AddressLabel4x6.displayName = 'AddressLabel4x6';

// Legacy shipping label (kept for compatibility)
interface LabelProps extends PrintProps {
  address: Address;
}

export const ShippingLabel4x6 = forwardRef<HTMLDivElement, LabelProps>(({ graduate, address }, ref) => {
  // Convert to new format
  const labelData: AddressLabelData = {
    name: graduate.name,
    course: graduate.course,
    convocationNumber: graduate.convocationNumber,
    ticketSlug: graduate.ticketSlug,
    registrationNumber: graduate.registrationNumber,
    address,
    phone: graduate.phone,
    trackingNumber: graduate.trackingNumber,
    dtdcAvailable: graduate.dispatchMethod === 'DTDC',
  };

  return <AddressLabel4x6 ref={ref} data={labelData} />;
});
ShippingLabel4x6.displayName = 'ShippingLabel4x6';

// Print utility function with support for different label sizes
export function printElement(element: HTMLElement, labelType?: '3x2-sticker' | '4x6-badge' | '4x6-label'): void {
  // For 3x2 stickers, use the dedicated function to ensure single page
  if (labelType === '3x2-sticker' || element.classList.contains('sticker-3x2')) {
    // Extract data from element and use dedicated print function
    const convNumber = element.querySelector('[style*="font-weight: bold"]')?.textContent ||
                       element.querySelector('[style*="font-weight:bold"]')?.textContent || '';
    const name = element.querySelectorAll('p')[2]?.textContent || '';
    const qrSvg = element.querySelector('svg');

    print3x2Sticker(convNumber, name, qrSvg?.outerHTML || '');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }

  // 4×6 inch label - portrait orientation
  const pageWidth = '4in';
  const pageHeight = '6in';

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Print Label</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${pageWidth};height:${pageHeight};overflow:hidden}
body{font-family:Helvetica,Arial,sans-serif}
@page{size:${pageWidth} ${pageHeight};margin:0}
</style>
</head>
<body>${element.outerHTML}</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

// Dedicated 3x2 sticker print - guaranteed single page
// FIXED: Enforce exact 3in × 2in (216pt × 144pt) sizing with proper QR constraints
function print3x2Sticker(convNumber: string, name: string, qrSvgHtml: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }

  // Minimal HTML - EXACT 3x2 inch sizing (216pt × 144pt at 72dpi)
  // QR code constrained to 75pt (~1.04 inch) to leave room for text
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Sticker</title>
<style>
@page{size:3in 2in;margin:0!important}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:3in!important;height:2in!important;max-width:3in!important;max-height:2in!important;overflow:hidden!important;font-family:Helvetica,Arial,sans-serif;background:#fff}
.s{width:3in;height:2in;max-width:3in;max-height:2in;display:flex;align-items:center;justify-content:space-between;padding:0.15in;background:#fff;overflow:hidden;box-sizing:border-box}
.l{flex:0 0 1.6in;max-width:1.6in;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
.t{font-size:9pt;color:#333;margin-bottom:2pt}
.n{font-size:11pt;font-weight:700;margin-bottom:4pt;word-wrap:break-word}
.m{font-size:10pt;line-height:1.2;word-wrap:break-word}
.r{flex:0 0 1.1in;width:1.1in;height:1.1in;display:flex;align-items:center;justify-content:flex-end}
.r svg{width:1.1in!important;height:1.1in!important;max-width:1.1in!important;max-height:1.1in!important;display:block}
</style>
</head>
<body><div class="s"><div class="l"><div class="t">CON. No-</div><div class="n">${convNumber}</div><div class="m">${name}</div></div><div class="r">${qrSvgHtml}</div></div></body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}

// Detect iOS/iPadOS
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Print 3x2 sticker directly - SINGLE PAGE GUARANTEED
// FIXED: Enforce exact 3in × 2in sizing with constrained QR code
// Uses different approach for iOS (window.print) vs desktop (iframe)
export function printSticker3x2(graduate: Graduate, elementRef?: HTMLElement | null): void {
  // On iOS/iPad, use window.print() directly - CSS handles the layout
  if (isIOS()) {
    // Make the print-badge visible temporarily
    const printBadge = document.querySelector('.print-badge') as HTMLElement;
    if (printBadge) {
      printBadge.style.display = 'flex';
    }

    // Trigger print
    window.print();

    // Hide it again after print dialog
    setTimeout(() => {
      if (printBadge) {
        printBadge.style.display = 'none';
      }
    }, 1000);
    return;
  }

  // Desktop: Use iframe approach
  let svgHtml = '';

  if (elementRef) {
    const svgElement = elementRef.querySelector('svg');
    if (svgElement) {
      svgHtml = svgElement.outerHTML;
    }
  }

  if (!svgHtml) {
    const titoUrl = graduate.ticketSlug
      ? `https://ti.to/tickets/${graduate.ticketSlug}`
      : graduate.registrationNumber;
    svgHtml = `<div style="width:1.1in;height:1.1in;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:6pt;text-align:center;word-break:break-all;padding:4pt">${titoUrl}</div>`;
  }

  // EXACT 3x2 inch sizing - QR constrained to 1.1in, text to 1.6in
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Sticker</title>
<style>
@page { size: 3in 2in; margin: 0 !important; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 3in !important;
  height: 2in !important;
  max-width: 3in !important;
  max-height: 2in !important;
  overflow: hidden !important;
  font-family: Helvetica, Arial, sans-serif;
  background: #fff;
}
.s {
  width: 3in;
  height: 2in;
  max-width: 3in;
  max-height: 2in;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.15in;
  overflow: hidden;
  box-sizing: border-box;
}
.l {
  flex: 0 0 1.6in;
  max-width: 1.6in;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}
.t { font-size: 9pt; color: #333; margin-bottom: 2pt; }
.n { font-size: 11pt; font-weight: 700; margin-bottom: 4pt; word-wrap: break-word; }
.m { font-size: 10pt; line-height: 1.2; word-wrap: break-word; }
.r {
  flex: 0 0 1.1in;
  width: 1.1in;
  height: 1.1in;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.r svg {
  width: 1.1in !important;
  height: 1.1in !important;
  max-width: 1.1in !important;
  max-height: 1.1in !important;
  display: block;
}
</style>
</head>
<body>
<div class="s">
<div class="l">
<div class="t">CON. No-</div>
<div class="n">${graduate.convocationNumber || 'N/A'}</div>
<div class="m">Dr. ${graduate.name}</div>
</div>
<div class="r">${svgHtml}</div>
</div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    alert('Failed to create print frame');
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 200);
}

// Print 4x6 Badge - BLACK ONLY for thermal/label printer
// Uses different approach for iOS (window.print) vs desktop (iframe)
export function printBadge4x6(graduate: Graduate, elementRef?: HTMLElement | null): void {
  // On iOS/iPad, use window.print() directly
  if (isIOS()) {
    const printBadge = document.querySelector('.print-badge-4x6') as HTMLElement;
    if (printBadge) {
      printBadge.style.display = 'block';
    }
    window.print();
    setTimeout(() => {
      if (printBadge) {
        printBadge.style.display = 'none';
      }
    }, 1000);
    return;
  }

  // Desktop: iframe approach
  let svgHtml = '';

  if (elementRef) {
    const svgElement = elementRef.querySelector('svg');
    if (svgElement) {
      svgHtml = svgElement.outerHTML;
    }
  }

  if (!svgHtml) {
    const titoUrl = graduate.ticketSlug
      ? `https://ti.to/tickets/${graduate.ticketSlug}`
      : graduate.registrationNumber;
    svgHtml = `<div style="width:110pt;height:110pt;border:2px solid #000;display:flex;align-items:center;justify-content:center;font-size:8pt;text-align:center;word-break:break-all;padding:6pt">${titoUrl}</div>`;
  }

  // 4x6 inch = 288 x 432 points
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Badge - ${graduate.convocationNumber}</title>
<style>
@page { size: 288pt 432pt; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 288pt;
  height: 432pt;
  overflow: hidden;
  font-family: Helvetica, Arial, sans-serif;
  background: #fff;
}
.badge {
  width: 288pt;
  height: 432pt;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60pt 12pt 25pt 12pt; /* Skip overlay areas */
}
.title {
  font-size: 28pt;
  font-weight: bold;
  color: #000;
  text-align: center;
  margin-bottom: 12pt;
  letter-spacing: 1px;
}
.course {
  font-size: 14pt;
  font-weight: bold;
  color: #000;
  text-align: center;
  margin-bottom: 15pt;
}
.name {
  font-size: 22pt;
  font-weight: bold;
  color: #000;
  text-align: center;
  margin-bottom: 15pt;
  line-height: 1.2;
}
.qr-container {
  display: flex;
  justify-content: center;
  margin-bottom: 12pt;
}
.qr-container svg {
  width: 110pt;
  height: 110pt;
}
.conv-number {
  font-size: 18pt;
  font-weight: bold;
  color: #000;
  text-align: center;
  letter-spacing: 1px;
  margin-bottom: 8pt;
}
.collection-info {
  font-size: 8pt;
  color: #333;
  text-align: center;
  margin-bottom: 2pt;
}
.separator {
  width: 80%;
  height: 1px;
  background: #ccc;
  margin: 8pt auto;
}
.note {
  font-size: 6pt;
  color: #666;
  text-align: center;
  line-height: 1.3;
}
</style>
</head>
<body>
<div class="badge">
<div class="title">CONVOCATION 2026</div>
<div class="course">${graduate.course || 'FMAS Course'}</div>
<div class="name">Dr. ${graduate.name}</div>
<div class="qr-container">${svgHtml}</div>
<div class="conv-number">${graduate.convocationNumber || ''}</div>
<div class="collection-info">Collect your certificate on 28th August 2026</div>
<div class="collection-info">at AMASI Office (Venue)</div>
<div class="separator"></div>
<div class="note">This badge is valid for Convocation Ceremony only,<br>not for AMASICON 2026 conference registration.</div>
</div>
</body>
</html>`;

  // Create hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    alert('Failed to create print frame');
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content to load, then print
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // Remove iframe after printing
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 200);
}

// Generate Code 128 barcode SVG using JsBarcode
function generateBarcodeSvg(text: string): string {
  // Create a temporary SVG element
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');

  try {
    // Dynamically import JsBarcode
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JsBarcode = require('jsbarcode');
    JsBarcode(svg, text, {
      format: 'CODE128',
      width: 2,
      height: 50,
      displayValue: false,
      margin: 0,
    });
    return svg.outerHTML;
  } catch {
    // Fallback if JsBarcode fails - return a placeholder
    return `<div style="width:100%;height:50pt;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:10pt">${text}</div>`;
  }
}

// Print Address Label 4x6 - INK-SAVING for WHITE LABEL PAPER
// Uses different approach for iOS (window.print) vs desktop (iframe)
export function printAddressLabel4x6(data: AddressLabelData, elementRef?: HTMLElement | null): void {
  // On iOS/iPad, use window.print() directly
  if (isIOS()) {
    const printBadge = document.querySelector('.print-badge-4x6') as HTMLElement;
    if (printBadge) {
      printBadge.style.display = 'block';
    }
    window.print();
    setTimeout(() => {
      if (printBadge) {
        printBadge.style.display = 'none';
      }
    }, 1000);
    return;
  }

  // Desktop: iframe approach
  let qrSvgHtml = '';

  if (elementRef) {
    const svgElement = elementRef.querySelector('svg');
    if (svgElement) {
      qrSvgHtml = svgElement.outerHTML;
    }
  }

  if (!qrSvgHtml) {
    const titoUrl = data.ticketSlug
      ? `https://ti.to/tickets/${data.ticketSlug}`
      : data.registrationNumber;
    qrSvgHtml = `<div style="width:80pt;height:80pt;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:6pt;text-align:center;word-break:break-all;padding:4pt">${titoUrl}</div>`;
  }

  // Generate barcode if DTDC available
  let barcodeHtml = '';
  let trackingText = '';

  if (data.dtdcAvailable && data.trackingNumber) {
    barcodeHtml = generateBarcodeSvg(data.trackingNumber);
    trackingText = `DTDC Tracking No - ${data.trackingNumber}`;
  } else {
    trackingText = 'Speed Post';
  }

  // Build address lines
  const addressLines = [
    data.address.line1,
    data.address.line2,
    data.address.city,
    `${data.address.state}- ${data.address.pincode}`,
  ].filter(Boolean);

  // 4x6 inch = 288 x 432 points
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Address Label - ${data.convocationNumber}</title>
<style>
@page { size: 288pt 432pt; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 288pt;
  height: 432pt;
  overflow: hidden;
  font-family: Helvetica, Arial, sans-serif;
  background: #fff;
}
.label {
  width: 288pt;
  height: 432pt;
  display: flex;
  flex-direction: column;
  padding: 20pt 15pt 15pt 15pt;
}
.course-header {
  font-size: 16pt;
  font-weight: bold;
  color: #000;
  text-align: left;
  margin-bottom: 8pt;
}
.separator-line {
  width: 100%;
  height: 1pt;
  background: #000;
  margin-bottom: 15pt;
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.header-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10pt;
}
.address-section {
  flex: 1;
  padding-right: 10pt;
}
.to-label {
  font-size: 12pt;
  color: #000;
  margin-bottom: 4pt;
}
.name {
  font-size: 14pt;
  font-weight: bold;
  color: #000;
  margin-bottom: 2pt;
}
.conv-no {
  font-size: 12pt;
  color: #000;
  margin-bottom: 6pt;
}
.address-line {
  font-size: 11pt;
  color: #000;
  margin-bottom: 2pt;
}
.phone {
  font-size: 11pt;
  color: #000;
  margin-top: 6pt;
}
.qr-section {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
}
.qr-section svg {
  width: 80pt;
  height: 80pt;
}
.spacer {
  flex: 1;
}
.bottom-section {
  margin-top: auto;
  text-align: center;
}
.barcode-container {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 6pt;
}
.barcode-container svg {
  width: 200pt;
  height: 50pt;
}
.tracking-text {
  font-size: 11pt;
  color: #000;
  text-align: center;
}
.speed-post {
  font-size: 14pt;
  font-weight: bold;
  color: #000;
  text-align: center;
}
</style>
</head>
<body>
<div class="label">
<div class="course-header">${data.course || 'FMAS Chandigarh'}</div>
<div class="separator-line"></div>
<div class="content">
<div class="header-row">
<div class="address-section">
<div class="to-label">To</div>
<div class="name">Dr. ${data.name}</div>
<div class="conv-no">CON. No ${data.convocationNumber}</div>
${addressLines.map(line => `<div class="address-line">${line}</div>`).join('')}
${data.phone ? `<div class="phone">Ph No -${data.phone}</div>` : ''}
</div>
<div class="qr-section">${qrSvgHtml}</div>
</div>
<div class="spacer"></div>
<div class="bottom-section">
${data.dtdcAvailable && data.trackingNumber
  ? `<div class="barcode-container">${barcodeHtml}</div><div class="tracking-text">${trackingText}</div>`
  : `<div class="speed-post">${trackingText}</div>`}
</div>
</div>
</div>
</body>
</html>`;

  // Create hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    alert('Failed to create print frame');
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content to load, then print
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // Remove iframe after printing
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 200);
}
