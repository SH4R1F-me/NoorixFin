import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '../../../../lib/api-client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await context.params;
  const workspaceId = request.nextUrl.searchParams.get('workspaceId');
  const transactionId = request.nextUrl.searchParams.get('transactionId');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !workspaceId ||
    !transactionId ||
    ![workspaceId, transactionId, attachmentId].every((value) => uuid.test(value))
  ) {
    return NextResponse.json({ error: 'Invalid receipt link' }, { status: 400 });
  }
  try {
    const result = await apiFetch(
      `/workspaces/${workspaceId}/transactions/${transactionId}/attachments/${attachmentId}`,
    );
    const receipt = await fetch(result.url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!receipt.ok || !receipt.body) throw new Error('Receipt object is unavailable');
    return new NextResponse(receipt.body, {
      headers: {
        'Content-Type': receipt.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Receipt is unavailable' }, { status: 404 });
  }
}
