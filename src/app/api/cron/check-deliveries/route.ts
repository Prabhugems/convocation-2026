import { NextRequest, NextResponse } from 'next/server';
import { checkDeliveryStatus } from '@/lib/dtdc';
import { getAirtableDataMap } from '@/lib/airtable';
import { getEmailTemplate } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/send';

// Store recently sent emails to avoid duplicates (in-memory cache)
const recentlySentDeliveryEmails = new Set<string>();

/**
 * GET /api/cron/check-deliveries
 *
 * Cron job endpoint to check all dispatched shipments for delivery status
 * and automatically send confirmation emails.
 *
 * Set up with Vercel Cron or external scheduler to run every 4 hours.
 *
 * vercel.json example:
 * { "crons": [{ "path": "/api/cron/check-deliveries", "schedule": "0 0,4,8,12,16,20 * * *" }] }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting delivery check...');

    // Get all graduates with tracking numbers from Airtable
    const airtableResult = await getAirtableDataMap();
    if (!airtableResult.success || !airtableResult.data) {
      console.error('[Cron] Failed to fetch Airtable data');
      return NextResponse.json(
        { success: false, error: 'Failed to fetch graduate data' },
        { status: 500 }
      );
    }

    // Build map of tracking number -> graduate data
    const trackingToGraduate = new Map<string, {
      email: string;
      name: string;
      convocationNumber: string;
      course: string;
      address: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        pincode: string;
      };
    }>();

    for (const graduate of airtableResult.data.values()) {
      if (graduate.trackingNumber && graduate.email) {
        // Skip if we already sent email for this tracking number recently
        if (recentlySentDeliveryEmails.has(graduate.trackingNumber)) {
          continue;
        }

        trackingToGraduate.set(graduate.trackingNumber, {
          email: graduate.email,
          name: graduate.name,
          convocationNumber: graduate.convocationNumber,
          course: graduate.courseDetails || 'FMAS',
          address: {
            line1: graduate.address.line1,
            line2: graduate.address.line2,
            city: graduate.address.city,
            state: graduate.address.state,
            pincode: graduate.address.pincode,
          },
        });
      }
    }

    const trackingNumbers = Array.from(trackingToGraduate.keys());

    if (trackingNumbers.length === 0) {
      console.log('[Cron] No tracking numbers to check');
      return NextResponse.json({
        success: true,
        message: 'No tracking numbers to check',
        checked: 0,
        delivered: 0,
        emailsSent: 0,
      });
    }

    console.log(`[Cron] Checking ${trackingNumbers.length} shipments...`);

    // Check delivery status
    const results = await checkDeliveryStatus(trackingNumbers);

    // Process delivered shipments
    let deliveredCount = 0;
    let emailsSentCount = 0;
    const emailErrors: string[] = [];

    for (const [trackingNumber, result] of results) {
      if (result.success && result.isDelivered) {
        deliveredCount++;

        const graduate = trackingToGraduate.get(trackingNumber);
        if (!graduate) continue;

        try {
          // Generate and send email
          const { subject, html } = getEmailTemplate('CERTIFICATE_DELIVERED', {
            name: graduate.name,
            convocationNumber: graduate.convocationNumber,
            course: graduate.course,
            courierName: 'DTDC',
            trackingNumber,
            address: graduate.address,
          });

          const emailResult = await sendEmail({
            to: graduate.email,
            subject,
            html,
          });

          if (emailResult.success) {
            emailsSentCount++;
            // Mark as sent to avoid duplicate emails
            recentlySentDeliveryEmails.add(trackingNumber);
            console.log(`[Cron] Delivery email sent to ${graduate.email} for ${trackingNumber}`);
          } else {
            emailErrors.push(`${trackingNumber}: ${emailResult.error}`);
          }
        } catch (error) {
          emailErrors.push(`${trackingNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    console.log(`[Cron] Complete: ${deliveredCount} delivered, ${emailsSentCount} emails sent`);

    return NextResponse.json({
      success: true,
      checked: trackingNumbers.length,
      delivered: deliveredCount,
      emailsSent: emailsSentCount,
      errors: emailErrors.length > 0 ? emailErrors : undefined,
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Cron job failed' },
      { status: 500 }
    );
  }
}

// Clear the recently sent cache periodically (every 24 hours)
// This prevents memory buildup while avoiding duplicate emails within a day
setInterval(() => {
  recentlySentDeliveryEmails.clear();
  console.log('[Cron] Cleared delivery email cache');
}, 24 * 60 * 60 * 1000);
