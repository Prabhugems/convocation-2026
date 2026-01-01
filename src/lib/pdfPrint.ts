'use client';

import jsPDF from 'jspdf';

interface BadgeData {
  name: string;
  course: string;
  convocationNumber: string;
  qrCodeDataUrl?: string;
}

/**
 * Generate and AUTO-DOWNLOAD 4x6 badge PDF for Zebra ZD230 thermal printer
 *
 * PAGE SIZE: 100mm × 153mm (4" × 6")
 *
 * PRE-PRINTED LABEL LAYOUT:
 * - Orange header: 22mm (with AMASI & FMAS logos) - DO NOT PRINT HERE
 * - White printable area: 123mm (from 22mm to 145mm)
 * - Orange footer: 8mm - DO NOT PRINT HERE
 *
 * CONTENT LAYOUT (centered in white area):
 * - Title "CONVOCATION 2026": 16pt bold
 * - Course: 12pt bold  
 * - Name: 14pt bold
 * - QR Code: 40mm × 40mm (reduced from 50mm)
 * - Convocation Number: 13pt bold
 * - Collection info: 8pt
 * - Disclaimer: 5pt gray
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
  const footerHeight = 8;   // Orange footer - skip this area
  const printableStart = headerHeight;
  const printableEnd = 153 - footerHeight; // 145mm
  const printableHeight = printableEnd - printableStart; // 123mm

  // Get QR code as data URL
  let qrDataUrl = data.qrCodeDataUrl;
  if (!qrDataUrl && qrElement) {
    const svgElement = qrElement.querySelector('svg');
    if (svgElement) {
      qrDataUrl = await svgToDataUrl(svgElement);
    }
  }

  // Calculate content heights to center vertically
  const qrSize = 40; // Reduced from 50mm
  const totalContentHeight = 10 + 8 + 8 + qrSize + 8 + 8 + 5 + 8; // ~95mm
  const startY = printableStart + (printableHeight - totalContentHeight) / 2 + 5;

  let currentY = startY;

  // Title - CONVOCATION 2026
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CONVOCATION 2026', centerX, currentY, { align: 'center' });
  currentY += 10;

  // Course
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.course || 'FMAS Course', centerX, currentY, { align: 'center' });
  currentY += 8;

  // Name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Dr. ${data.name}`, centerX, currentY, { align: 'center' });
  currentY += 10;

  // QR Code - 40mm × 40mm (reduced size)
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', centerX - qrSize / 2, currentY, qrSize, qrSize);
    } catch (e) {
      console.error('Failed to add QR code:', e);
      doc.setDrawColor(0);
      doc.rect(centerX - qrSize / 2, currentY, qrSize, qrSize);
    }
  } else {
    doc.setDrawColor(0);
    doc.rect(centerX - qrSize / 2, currentY, qrSize, qrSize);
    doc.setFontSize(8);
    doc.text('QR CODE', centerX, currentY + qrSize / 2, { align: 'center' });
  }
  currentY += qrSize + 6;

  // Convocation Number
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.convocationNumber || '', centerX, currentY, { align: 'center' });
  currentY += 10;

  // Collection Info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 51, 51);
  doc.text('Collect your certificate on 28th August 2026', centerX, currentY, { align: 'center' });
  currentY += 4;
  doc.text('at AMASI Office (Venue)', centerX, currentY, { align: 'center' });
  currentY += 6;

  // Separator line
  doc.setDrawColor(204, 204, 204);
  doc.line(20, currentY, 80, currentY);
  currentY += 4;

  // Disclaimer
  doc.setFontSize(5);
  doc.setTextColor(128, 128, 128);
  doc.text('This badge is valid for Convocation Ceremony only,', centerX, currentY, { align: 'center' });
  currentY += 2.5;
  doc.text('not for AMASICON 2026 conference registration.', centerX, currentY, { align: 'center' });

  // AUTO-DOWNLOAD the PDF
  const fileName = `badge-${data.convocationNumber || data.name.replace(/\s+/g, '-') || 'unknown'}.pdf`;
  doc.save(fileName);
}

/**
 * Generate and print 3x2 sticker PDF for Zebra thermal printer
 * Page size: 75mm × 50mm (3" × 2")
 */
export async function printSticker3x2PDF(data: BadgeData, qrElement?: HTMLElement | null): Promise<void> {
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

  // QR Code on right side (28mm × 28mm)
  const qrSize = 28;
  const qrX = pageWidth - qrSize - 5;
  const qrY = (pageHeight - qrSize) / 2;

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

  // AUTO-DOWNLOAD
  const fileName = `sticker-${data.convocationNumber || 'unknown'}.pdf`;
  doc.save(fileName);
}

/**
 * Download badge as PDF file (same as print but explicit download)
 */
export async function downloadBadge4x6PDF(data: BadgeData, qrElement?: HTMLElement | null): Promise<void> {
  await printBadge4x6PDF(data, qrElement);
}

/**
 * Download sticker as PDF file
 */
export async function downloadSticker3x2PDF(data: BadgeData, qrElement?: HTMLElement | null): Promise<void> {
  await printSticker3x2PDF(data, qrElement);
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
