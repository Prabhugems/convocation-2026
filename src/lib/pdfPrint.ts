'use client';

import jsPDF from 'jspdf';

interface BadgeData {
  name: string;
  course: string;
  convocationNumber: string;
  qrCodeDataUrl?: string;
}

/**
 * Generate and print 4x6 badge PDF for Zebra ZD230 thermal printer
 *
 * PAGE SIZE: 100mm × 153mm (4" × 6")
 *
 * PRE-PRINTED LABEL LAYOUT:
 * - Orange header: 22mm (with AMASI & FMAS logos) - DO NOT PRINT HERE
 * - White printable area: 123mm
 * - Orange footer: 8mm - DO NOT PRINT HERE
 *
 * QR CODE: 50mm × 50mm (2" × 2")
 *
 * FONT SIZES:
 * - Title "CONVOCATION 2026": 18pt bold
 * - Course: 14pt bold
 * - Name: 16pt bold
 * - Convocation Number: 14pt bold
 * - Collection info: 9pt
 * - Disclaimer: 6pt gray
 *
 * NOTE: Content is NOT rotated. Zebra printer handles orientation.
 */
export async function printBadge4x6PDF(data: BadgeData, qrElement?: HTMLElement | null): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 153],
  });

  const pageWidth = 100;
  const centerX = pageWidth / 2;

  // ALIGNMENT VALUES (based on pre-printed label)
  const headerHeight = 22;  // Orange header - skip this area

  // Get QR code as data URL
  let qrDataUrl = data.qrCodeDataUrl;
  if (!qrDataUrl && qrElement) {
    const svgElement = qrElement.querySelector('svg');
    if (svgElement) {
      qrDataUrl = await svgToDataUrl(svgElement);
    }
  }

  // Start content after header + small gap
  let currentY = headerHeight + 5;

  // Title - CONVOCATION 2026
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CONVOCATION 2026', centerX, currentY, { align: 'center' });
  currentY += 10;

  // Course
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.course || 'FMAS Course', centerX, currentY, { align: 'center' });
  currentY += 10;

  // Name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Dr. ${data.name}`, centerX, currentY, { align: 'center' });
  currentY += 10;

  // QR Code - 50mm × 50mm (2" × 2")
  const qrSize = 50;
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', centerX - qrSize / 2, currentY, qrSize, qrSize);
    } catch (e) {
      console.error('Failed to add QR code:', e);
      // Draw placeholder rectangle
      doc.setDrawColor(0);
      doc.rect(centerX - qrSize / 2, currentY, qrSize, qrSize);
    }
  } else {
    // Draw placeholder if no QR
    doc.setDrawColor(0);
    doc.rect(centerX - qrSize / 2, currentY, qrSize, qrSize);
    doc.setFontSize(8);
    doc.text('QR CODE', centerX, currentY + qrSize / 2, { align: 'center' });
  }
  currentY += qrSize + 6;

  // Convocation Number
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.convocationNumber || '', centerX, currentY, { align: 'center' });
  currentY += 10;

  // Collection Info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 51, 51);
  doc.text('Collect your certificate on 28th August 2026', centerX, currentY, { align: 'center' });
  currentY += 5;
  doc.text('at AMASI Office (Venue)', centerX, currentY, { align: 'center' });
  currentY += 6;

  // Separator line
  doc.setDrawColor(204, 204, 204);
  doc.line(15, currentY, 85, currentY);
  currentY += 5;

  // Disclaimer
  doc.setFontSize(6);
  doc.setTextColor(102, 102, 102);
  doc.text('This badge is valid for Convocation Ceremony only,', centerX, currentY, { align: 'center' });
  currentY += 3;
  doc.text('not for AMASICON 2026 conference registration.', centerX, currentY, { align: 'center' });

  // Open PDF in new window and trigger print
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);

  const printWindow = window.open(pdfUrl, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  } else {
    // Fallback: download the PDF
    doc.save(`badge-${data.convocationNumber || 'unknown'}.pdf`);
    alert('Popup blocked. PDF downloaded instead. Please open and print manually.');
  }
}

/**
 * Generate and print 3x2 sticker PDF for Zebra thermal printer
 * Page size: 75mm × 50mm (3" × 2")
 *
 * LAYOUT:
 * - Left side: Text (CON. No, Number, Name)
 * - Right side: QR code (28mm × 28mm)
 *
 * FONT SIZES:
 * - CON. No- label: 7pt
 * - Convocation Number: 10pt bold
 * - Name: 8pt
 */
export async function printSticker3x2PDF(data: BadgeData, qrElement?: HTMLElement | null): Promise<void> {
  // Create PDF with exact dimensions (75mm × 50mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [75, 50],
  });

  const pageWidth = 75;
  const pageHeight = 50;

  // Get QR code as data URL
  let qrDataUrl = data.qrCodeDataUrl;
  if (!qrDataUrl && qrElement) {
    const svgElement = qrElement.querySelector('svg');
    if (svgElement) {
      qrDataUrl = await svgToDataUrl(svgElement);
    }
  }

  // QR Code on right side (28mm × 28mm)
  const qrSize = 28;
  const qrX = pageWidth - qrSize - 5; // 5mm from right edge
  const qrY = (pageHeight - qrSize) / 2; // Centered vertically

  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.error('Failed to add QR code:', e);
      doc.setDrawColor(0);
      doc.rect(qrX, qrY, qrSize, qrSize);
    }
  } else {
    doc.setDrawColor(0);
    doc.rect(qrX, qrY, qrSize, qrSize);
  }

  // Text on left side
  const textX = 5; // 5mm from left edge
  let textY = 15;

  // CON. No- label
  doc.setFontSize(7);
  doc.setTextColor(51, 51, 51);
  doc.setFont('helvetica', 'normal');
  doc.text('CON. No-', textX, textY);
  textY += 6;

  // Convocation Number
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.convocationNumber || 'N/A', textX, textY);
  textY += 8;

  // Name
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dr. ${data.name}`, textX, textY);

  // Open PDF in new window and trigger print
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);

  const printWindow = window.open(pdfUrl, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  } else {
    doc.save(`sticker-${data.convocationNumber || 'unknown'}.pdf`);
    alert('Popup blocked. PDF downloaded instead. Please open and print manually.');
  }
}

/**
 * Download badge as PDF file (for manual printing)
 */
export async function downloadBadge4x6PDF(data: BadgeData, qrElement?: HTMLElement | null): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 153],
  });

  const pageWidth = 100;
  const centerX = pageWidth / 2;
  const headerHeight = 22;

  let qrDataUrl = data.qrCodeDataUrl;
  if (!qrDataUrl && qrElement) {
    const svgElement = qrElement.querySelector('svg');
    if (svgElement) {
      qrDataUrl = await svgToDataUrl(svgElement);
    }
  }

  let currentY = headerHeight + 5;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CONVOCATION 2026', centerX, currentY, { align: 'center' });
  currentY += 10;

  // Course
  doc.setFontSize(14);
  doc.text(data.course || 'FMAS Course', centerX, currentY, { align: 'center' });
  currentY += 10;

  // Name
  doc.setFontSize(16);
  doc.text(`Dr. ${data.name}`, centerX, currentY, { align: 'center' });
  currentY += 10;

  // QR Code - 50mm × 50mm
  const qrSize = 50;
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', centerX - qrSize / 2, currentY, qrSize, qrSize);
    } catch (e) {
      console.error('Failed to add QR code:', e);
    }
  }
  currentY += qrSize + 6;

  // Convocation Number
  doc.setFontSize(14);
  doc.text(data.convocationNumber || '', centerX, currentY, { align: 'center' });
  currentY += 10;

  // Collection Info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 51, 51);
  doc.text('Collect your certificate on 28th August 2026', centerX, currentY, { align: 'center' });
  currentY += 5;
  doc.text('at AMASI Office (Venue)', centerX, currentY, { align: 'center' });
  currentY += 6;

  // Separator
  doc.setDrawColor(204, 204, 204);
  doc.line(15, currentY, 85, currentY);
  currentY += 5;

  // Disclaimer
  doc.setFontSize(6);
  doc.setTextColor(102, 102, 102);
  doc.text('This badge is valid for Convocation Ceremony only,', centerX, currentY, { align: 'center' });
  currentY += 3;
  doc.text('not for AMASICON 2026 conference registration.', centerX, currentY, { align: 'center' });

  doc.save(`badge-${data.convocationNumber || 'unknown'}.pdf`);
}

/**
 * Download sticker as PDF file (for manual printing)
 */
export async function downloadSticker3x2PDF(data: BadgeData, qrElement?: HTMLElement | null): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [75, 50],
  });

  const pageWidth = 75;
  const pageHeight = 50;

  let qrDataUrl = data.qrCodeDataUrl;
  if (!qrDataUrl && qrElement) {
    const svgElement = qrElement.querySelector('svg');
    if (svgElement) {
      qrDataUrl = await svgToDataUrl(svgElement);
    }
  }

  // QR Code on right side
  const qrSize = 28;
  const qrX = pageWidth - qrSize - 5;
  const qrY = (pageHeight - qrSize) / 2;

  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.error('Failed to add QR code:', e);
    }
  }

  // Text on left side
  const textX = 5;
  let textY = 15;

  doc.setFontSize(7);
  doc.setTextColor(51, 51, 51);
  doc.setFont('helvetica', 'normal');
  doc.text('CON. No-', textX, textY);
  textY += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.convocationNumber || 'N/A', textX, textY);
  textY += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dr. ${data.name}`, textX, textY);

  doc.save(`sticker-${data.convocationNumber || 'unknown'}.pdf`);
}

/**
 * Convert SVG element to data URL for embedding in PDF
 */
async function svgToDataUrl(svgElement: SVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 200;
        canvas.height = img.height || 200;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG'));
      };

      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Generate QR code data URL using qrcode library
 */
export async function generateQRDataUrl(text: string, size: number = 200): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}
