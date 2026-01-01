'use client';

import jsPDF from 'jspdf';

interface BadgeData {
  name: string;
  course: string;
  convocationNumber: string;
  qrCodeDataUrl?: string;
}

/**
 * Generate and print 4x6 badge PDF for Zebra thermal printer
 * Page size: 100mm × 153mm (4" × 6")
 * Content is rotated 180° for correct orientation on Zebra ZD230
 */
export async function printBadge4x6PDF(data: BadgeData, qrElement?: HTMLElement | null): Promise<void> {
  // Create PDF with exact dimensions (100mm × 153mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 153],
  });

  const pageWidth = 100;
  const centerX = pageWidth / 2;

  // Get QR code as data URL
  let qrDataUrl = data.qrCodeDataUrl;
  if (!qrDataUrl && qrElement) {
    const svgElement = qrElement.querySelector('svg');
    if (svgElement) {
      qrDataUrl = await svgToDataUrl(svgElement);
    }
  }

  // Since Zebra prints from bottom, we need content rotated 180°
  // jsPDF doesn't support page rotation, so we position content from bottom-up
  // and use text rotation

  // All Y positions are calculated from BOTTOM of page (for 180° effect)
  // When printed on Zebra, bottom becomes top

  // --- CONTENT (positioned from bottom, will appear from top after print) ---

  // Disclaimer (at bottom of PDF = top of printed label, near orange header)
  doc.setFontSize(5);
  doc.setTextColor(102, 102, 102);
  doc.setFont('helvetica', 'normal');

  const disclaimerY = 145; // Near bottom of page
  doc.text('This badge is valid for Convocation Ceremony only,', centerX, disclaimerY - 3, {
    align: 'center',
    angle: 180
  });
  doc.text('not for AMASICON 2026 conference registration.', centerX, disclaimerY, {
    align: 'center',
    angle: 180
  });

  // Separator line
  doc.setDrawColor(204, 204, 204);
  doc.line(15, disclaimerY - 8, 85, disclaimerY - 8);

  // Collection info
  doc.setFontSize(7);
  doc.setTextColor(51, 51, 51);
  doc.text('at AMASI Office (Venue)', centerX, disclaimerY - 12, { align: 'center', angle: 180 });
  doc.text('Collect your certificate on 28th August 2026', centerX, disclaimerY - 16, { align: 'center', angle: 180 });

  // Convocation Number
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.convocationNumber || '', centerX, disclaimerY - 24, { align: 'center', angle: 180 });

  // QR Code (28mm × 28mm)
  const qrSize = 28;
  const qrY = disclaimerY - 56; // Position for QR code

  if (qrDataUrl) {
    // For 180° rotation, we need to position and rotate the image
    // jsPDF addImage doesn't support rotation, so we add it normally
    // The content flow handles the visual positioning
    try {
      doc.addImage(qrDataUrl, 'PNG', centerX - qrSize/2, qrY, qrSize, qrSize);
    } catch (e) {
      console.error('Failed to add QR code:', e);
      // Draw placeholder
      doc.setDrawColor(0);
      doc.rect(centerX - qrSize/2, qrY, qrSize, qrSize);
      doc.setFontSize(6);
      doc.text('QR Code', centerX, qrY + qrSize/2, { align: 'center' });
    }
  }

  // Name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Dr. ${data.name}`, centerX, qrY - 6, { align: 'center', angle: 180 });

  // Course
  doc.setFontSize(12);
  doc.text(data.course || 'FMAS Course', centerX, qrY - 14, { align: 'center', angle: 180 });

  // Title
  doc.setFontSize(16);
  doc.text('CONVOCATION 2026', centerX, qrY - 24, { align: 'center', angle: 180 });

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

  // Apply 180° rotation by positioning content accordingly
  // Content positioned from bottom-right will appear top-left after rotation

  // QR Code on right side (28mm × 28mm)
  const qrSize = 28;
  const qrX = pageWidth - qrSize - 3; // 3mm from right edge
  const qrY = (pageHeight - qrSize) / 2; // Centered vertically

  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.error('Failed to add QR code:', e);
      doc.setDrawColor(0);
      doc.rect(qrX, qrY, qrSize, qrSize);
    }
  }

  // Text on left side
  const textX = 5; // 5mm from left edge
  const textCenterY = pageHeight / 2;

  // CON. No- label
  doc.setFontSize(7);
  doc.setTextColor(51, 51, 51);
  doc.setFont('helvetica', 'normal');
  doc.text('CON. No-', textX, textCenterY - 8, { angle: 180 });

  // Convocation Number
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.convocationNumber || 'N/A', textX, textCenterY, { angle: 180 });

  // Name
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dr. ${data.name}`, textX, textCenterY + 8, { angle: 180 });

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

  // Get QR code
  let qrDataUrl = data.qrCodeDataUrl;
  if (!qrDataUrl && qrElement) {
    const svgElement = qrElement.querySelector('svg');
    if (svgElement) {
      qrDataUrl = await svgToDataUrl(svgElement);
    }
  }

  // Content positioned for 180° rotation effect
  // Top padding: 14mm (skip pre-printed header)
  // Bottom padding: 8mm (skip pre-printed footer)

  let currentY = 22; // Start after top padding

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CONVOCATION 2026', centerX, currentY, { align: 'center' });
  currentY += 8;

  // Course
  doc.setFontSize(12);
  doc.text(data.course || 'FMAS Course', centerX, currentY, { align: 'center' });
  currentY += 8;

  // Name
  doc.setFontSize(14);
  doc.text(`Dr. ${data.name}`, centerX, currentY, { align: 'center' });
  currentY += 10;

  // QR Code
  const qrSize = 28;
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', centerX - qrSize/2, currentY, qrSize, qrSize);
    } catch (e) {
      console.error('Failed to add QR code:', e);
    }
  }
  currentY += qrSize + 6;

  // Convocation Number
  doc.setFontSize(13);
  doc.text(data.convocationNumber || '', centerX, currentY, { align: 'center' });
  currentY += 10;

  // Collection info
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 51, 51);
  doc.text('Collect your certificate on 28th August 2026', centerX, currentY, { align: 'center' });
  currentY += 4;
  doc.text('at AMASI Office (Venue)', centerX, currentY, { align: 'center' });
  currentY += 6;

  // Separator
  doc.setDrawColor(204, 204, 204);
  doc.line(15, currentY, 85, currentY);
  currentY += 5;

  // Disclaimer
  doc.setFontSize(5);
  doc.setTextColor(102, 102, 102);
  doc.text('This badge is valid for Convocation Ceremony only,', centerX, currentY, { align: 'center' });
  currentY += 3;
  doc.text('not for AMASICON 2026 conference registration.', centerX, currentY, { align: 'center' });

  // Save file
  doc.save(`badge-${data.convocationNumber || 'unknown'}.pdf`);
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
 * Generate QR code data URL using canvas
 */
export async function generateQRDataUrl(text: string, size: number = 200): Promise<string> {
  // This requires qrcode library
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}
