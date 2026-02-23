import { NextResponse } from 'next/server';
import { getRfidTagMap } from '@/lib/rfid';

// Temporary debug endpoint — returns a sample of stored EPCs to diagnose format mismatch
export async function GET() {
  const mapResult = await getRfidTagMap();
  if (!mapResult.success || !mapResult.data) {
    return NextResponse.json({ error: mapResult.error }, { status: 500 });
  }

  const tags = Array.from(mapResult.data.values());
  const sample = tags.slice(0, 20).map(t => ({
    epc: t.epc,
    epcLength: t.epc.length,
    convocationNumber: t.convocationNumber,
    graduateName: t.graduateName,
    type: t.type,
  }));

  return NextResponse.json({
    totalTags: tags.size,
    sample,
    epcLengths: [...new Set(tags.map(t => t.epc.length))],
  });
}
