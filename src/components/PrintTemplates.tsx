'use client';

import { forwardRef } from 'react';
import QRCode from 'react-qr-code';
import { Graduate, Address } from '@/types';

interface PrintProps {
  graduate: Graduate;
}

// 3x2 inch sticker for certificate envelope
export const Sticker3x2 = forwardRef<HTMLDivElement, PrintProps>(({ graduate }, ref) => {
  return (
    <div
      ref={ref}
      className="print-template w-[3in] h-[2in] bg-white p-3 flex items-center gap-3"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <QRCode value={graduate.registrationNumber} size={80} />
      <div className="flex-1">
        <p className="font-bold text-sm text-gray-900 truncate">{graduate.name}</p>
        <p className="text-xs text-gray-600">{graduate.registrationNumber}</p>
        <p className="text-xs text-gray-500 mt-1">{graduate.course} - {graduate.batch}</p>
        <p className="text-[10px] text-gray-400 mt-2">AMASI Convocation 2026</p>
      </div>
    </div>
  );
});
Sticker3x2.displayName = 'Sticker3x2';

// 4x6 inch badge for registration
export const Badge4x6 = forwardRef<HTMLDivElement, PrintProps>(({ graduate }, ref) => {
  return (
    <div
      ref={ref}
      className="print-template w-[4in] h-[6in] bg-white p-4 flex flex-col"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      {/* Header */}
      <div className="text-center border-b-2 border-blue-600 pb-3">
        <h1 className="text-lg font-bold text-blue-800">AMASI</h1>
        <p className="text-sm text-gray-600">Convocation 2026</p>
      </div>

      {/* QR Code */}
      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <QRCode value={graduate.registrationNumber} size={120} />
        <p className="mt-3 text-sm font-mono text-gray-500">{graduate.registrationNumber}</p>
      </div>

      {/* Graduate Info */}
      <div className="text-center border-t-2 border-blue-600 pt-3">
        <h2 className="text-xl font-bold text-gray-900">{graduate.name}</h2>
        <p className="text-sm text-gray-600 mt-1">{graduate.course}</p>
        <p className="text-xs text-gray-500 mt-1">Batch {graduate.batch}</p>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-gray-200 text-center">
        <p className="text-[10px] text-gray-400">Please wear this badge at all times during the ceremony</p>
      </div>
    </div>
  );
});
Badge4x6.displayName = 'Badge4x6';

// 4x6 inch shipping label
interface LabelProps extends PrintProps {
  address: Address;
}

export const ShippingLabel4x6 = forwardRef<HTMLDivElement, LabelProps>(({ graduate, address }, ref) => {
  return (
    <div
      ref={ref}
      className="print-template w-[4in] h-[6in] bg-white p-4 flex flex-col"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      {/* From Address */}
      <div className="text-xs text-gray-600 pb-2 border-b border-gray-300">
        <p className="font-semibold">FROM:</p>
        <p>AMASI Head Office</p>
        <p>Kolkata, West Bengal</p>
        <p>India - 700001</p>
      </div>

      {/* To Address */}
      <div className="flex-1 py-4">
        <p className="font-semibold text-sm text-gray-600 mb-2">TO:</p>
        <div className="text-base">
          <p className="font-bold text-lg text-gray-900">{graduate.name}</p>
          <p className="text-gray-700 mt-2">{address.line1}</p>
          {address.line2 && <p className="text-gray-700">{address.line2}</p>}
          <p className="text-gray-700">
            {address.city}, {address.state}
          </p>
          <p className="text-gray-700 font-semibold">{address.pincode}</p>
          <p className="text-gray-600">{address.country}</p>
        </div>
      </div>

      {/* QR and Registration */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-300">
        <div>
          <p className="text-xs text-gray-500">Reg. No:</p>
          <p className="font-mono text-sm font-bold">{graduate.registrationNumber}</p>
        </div>
        <QRCode value={graduate.registrationNumber} size={60} />
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-gray-200 text-center">
        <p className="text-[10px] text-gray-400">AMASI Convocation 2026 - Certificate</p>
      </div>
    </div>
  );
});
ShippingLabel4x6.displayName = 'ShippingLabel4x6';

// Print utility function
export function printElement(element: HTMLElement): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          @media print {
            @page { margin: 0; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>${element.outerHTML}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}
