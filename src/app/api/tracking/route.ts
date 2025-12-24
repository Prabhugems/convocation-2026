import { NextRequest, NextResponse } from 'next/server';
import { trackShipment, checkDeliveryStatus, DTDCTrackingResult } from '@/lib/dtdc';
import { getAirtableDataMap } from '@/lib/airtable';
import { getEmailTemplate } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/send';

/**
 * GET /api/tracking?number=XXXX
 * Track a single shipment
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackingNumber = searchParams.get('number');

  if (!trackingNumber) {
    return NextResponse.json(
      { success: false, error: 'Tracking number is required' },
      { status: 400 }
    );
  }

  console.log(`[Tracking API] Tracking shipment: ${trackingNumber}`);
  const result = await trackShipment(trackingNumber);

  return NextResponse.json(result);
}

/**
 * POST /api/tracking/check-deliveries
 * Check all dispatched shipments for delivery status
 * and send confirmation emails for newly delivered ones
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sendEmails = false, trackingNumbers: providedNumbers } = body;

    console.log('[Tracking API] Checking delivery statuses...');

    // Get tracking numbers to check
    let trackingNumbers: string[] = providedNumbers || [];

    // If no tracking numbers provided, get from Airtable
    if (trackingNumbers.length === 0) {
      const airtableResult = await getAirtableDataMap();
      if (airtableResult.success && airtableResult.data) {
        for (const graduate of airtableResult.data.values()) {
          if (graduate.trackingNumber) {
            trackingNumbers.push(graduate.trackingNumber);
          }
        }
      }
    }

    if (trackingNumbers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tracking numbers to check',
        checked: 0,
        delivered: [],
      });
    }

    console.log(`[Tracking API] Checking ${trackingNumbers.length} shipments...`);

    // Check delivery status for all
    const results = await checkDeliveryStatus(trackingNumbers);

    // Find delivered shipments
    const delivered: DTDCTrackingResult[] = [];
    const emailsSent: string[] = [];

    for (const [trackingNumber, result] of results) {
      if (result.success && result.isDelivered) {
        delivered.push(result);

        // Send delivery confirmation email if requested
        if (sendEmails) {
          const emailResult = await sendDeliveryConfirmationEmail(trackingNumber);
          if (emailResult.success) {
            emailsSent.push(trackingNumber);
          }
        }
      }
    }

    console.log(`[Tracking API] Found ${delivered.length} delivered shipments`);

    return NextResponse.json({
      success: true,
      checked: trackingNumbers.length,
      delivered: delivered.map(d => ({
        trackingNumber: d.trackingNumber,
        deliveryDate: d.deliveryDate,
        status: d.currentStatus,
      })),
      emailsSent: sendEmails ? emailsSent : undefined,
    });
  } catch (error) {
    console.error('[Tracking API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check deliveries' },
      { status: 500 }
    );
  }
}

/**
 * Send delivery confirmation email for a tracking number
 */
async function sendDeliveryConfirmationEmail(trackingNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Find graduate by tracking number
    const airtableResult = await getAirtableDataMap();
    if (!airtableResult.success || !airtableResult.data) {
      return { success: false, error: 'Could not fetch graduate data' };
    }

    let graduate = null;
    for (const g of airtableResult.data.values()) {
      if (g.trackingNumber === trackingNumber) {
        graduate = g;
        break;
      }
    }

    if (!graduate || !graduate.email) {
      return { success: false, error: 'Graduate not found or no email' };
    }

    // Prepare email data
    const emailData = {
      name: graduate.name,
      convocationNumber: graduate.convocationNumber,
      course: graduate.courseDetails || 'FMAS',
      courierName: 'DTDC',
      trackingNumber,
      address: graduate.address,
    };

    // Generate email
    const { subject, html } = getEmailTemplate('CERTIFICATE_DELIVERED', emailData);

    // Send email
    const result = await sendEmail({
      to: graduate.email,
      subject,
      html,
    });

    if (result.success) {
      console.log(`[Tracking API] Delivery email sent to ${graduate.email}`);
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('[Tracking API] Email error:', error);
    return { success: false, error: 'Email sending failed' };
  }
}
