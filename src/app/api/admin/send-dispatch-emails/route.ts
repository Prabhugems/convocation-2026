import { NextRequest, NextResponse } from 'next/server';
import { getAllGraduatesWithCache } from '@/lib/tito';
import { getAirtableDataMap, markDtdcDispatchEmailSent } from '@/lib/airtable';
import { getEmailTemplate, DtdcDispatchData } from '@/lib/email/templates';
import { sendEmailViaResend } from '@/lib/email/resend';
import { ADMIN_ACTION_PASSCODE } from '@/lib/adminPasscode';

interface Candidate {
  convocationNumber: string;
  name: string;
  email: string;
  course: string;
  trackingNumber: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  airtableRecordId: string;
  airtableTableId: string;
}

// Audience: graduates who have actually been scanned/processed at the
// address-label station (so their parcel is genuinely packed and ready —
// not just pre-assigned a tracking number), have a real DTDC tracking
// number (not Speed Post), have an email on file, and haven't already
// received this notification.
async function getCandidates(): Promise<{ candidates: Candidate[]; error?: string }> {
  const [graduatesResult, airtableResult] = await Promise.all([
    getAllGraduatesWithCache(),
    getAirtableDataMap(),
  ]);

  if (!graduatesResult.success || !graduatesResult.data) {
    return { candidates: [], error: graduatesResult.error || 'Failed to fetch graduates' };
  }
  if (!airtableResult.success || !airtableResult.data) {
    return { candidates: [], error: airtableResult.error || 'Failed to fetch Airtable data' };
  }

  const airtableMap = airtableResult.data;
  const candidates: Candidate[] = [];

  for (const graduate of graduatesResult.data) {
    if (!graduate.status.addressLabeled) continue;

    const airtableData = airtableMap.get(graduate.convocationNumber);
    if (!airtableData) continue;
    if (!airtableData.dtdcAvailable) continue;
    if (!airtableData.trackingNumber) continue;
    if (airtableData.dtdcDispatchEmailSent) continue;

    const email = (airtableData.email || graduate.email || '').trim();
    if (!email) continue;

    if (!airtableData.address.line1) continue;

    candidates.push({
      convocationNumber: graduate.convocationNumber,
      name: airtableData.name || graduate.name,
      email,
      course: airtableData.courseDetails || graduate.course,
      trackingNumber: airtableData.trackingNumber,
      address: airtableData.address,
      airtableRecordId: airtableData.airtableRecordId,
      airtableTableId: airtableData.airtableTableId,
    });
  }

  return { candidates };
}

function todayFormatted(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${now.getFullYear()}`;
}

function buildEmail(candidate: Candidate) {
  const data: DtdcDispatchData = {
    name: candidate.name,
    convocationNumber: candidate.convocationNumber,
    course: candidate.course,
    trackingNumber: candidate.trackingNumber,
    dispatchDate: todayFormatted(),
    address: candidate.address,
  };
  return getEmailTemplate('DTDC_DISPATCH_NOTIFICATION', data);
}

function checkAuth(request: NextRequest): boolean {
  return request.headers.get('x-admin-passcode') === ADMIN_ACTION_PASSCODE;
}

// GET: dry-run preview — who would receive this email right now, no sending.
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { candidates, error } = await getCandidates();
  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    count: candidates.length,
    candidates: candidates.map(c => ({
      convocationNumber: c.convocationNumber,
      name: c.name,
      email: c.email,
      trackingNumber: c.trackingNumber,
    })),
  });
}

// POST: { action: 'test', testEmail: string }  -> sends ONE real-data email to testEmail, marks nothing as sent
//       { action: 'send', confirm: true }       -> sends to every candidate, marks each as sent immediately after
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { action, testEmail, confirm } = body;

  const { candidates, error } = await getCandidates();
  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  if (action === 'test') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!testEmail || typeof testEmail !== 'string' || !emailRegex.test(testEmail)) {
      return NextResponse.json({ success: false, error: 'A valid testEmail is required' }, { status: 400 });
    }
    if (candidates.length === 0) {
      return NextResponse.json({ success: false, error: 'No eligible candidates to build a test email from' }, { status: 400 });
    }

    const sample = candidates[0];
    const { subject, html } = buildEmail(sample);
    const result = await sendEmailViaResend({ to: testEmail, subject, html });

    return NextResponse.json({
      success: result.success,
      error: result.error,
      messageId: result.messageId,
      sampleUsed: { convocationNumber: sample.convocationNumber, name: sample.name },
      note: 'Test send only — no Airtable record was marked as sent.',
    });
  }

  if (action === 'send') {
    if (confirm !== true) {
      return NextResponse.json(
        { success: false, error: 'Refusing to send without confirm: true — this sends real emails to real graduates.' },
        { status: 400 }
      );
    }

    const results: { convocationNumber: string; email: string; success: boolean; error?: string }[] = [];

    for (const candidate of candidates) {
      // Small pacing gap so a large batch doesn't slam Resend's rate limit
      // and cause a wave of avoidable failures.
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      const { subject, html } = buildEmail(candidate);
      const sendResult = await sendEmailViaResend({ to: candidate.email, subject, html });

      if (sendResult.success) {
        const markResult = await markDtdcDispatchEmailSent(candidate.airtableTableId, candidate.airtableRecordId);
        results.push({
          convocationNumber: candidate.convocationNumber,
          email: candidate.email,
          success: true,
          error: markResult.success ? undefined : `Sent, but failed to mark as sent: ${markResult.error}`,
        });
      } else {
        results.push({
          convocationNumber: candidate.convocationNumber,
          email: candidate.email,
          success: false,
          error: sendResult.error,
        });
      }
    }

    const sentCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      totalCandidates: candidates.length,
      sentCount,
      failedCount: candidates.length - sentCount,
      results,
    });
  }

  return NextResponse.json({ success: false, error: 'Unknown action. Use "test" or "send".' }, { status: 400 });
}
