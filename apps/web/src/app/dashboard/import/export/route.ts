import { NextRequest, NextResponse } from 'next/server';
import { apiFetchRaw } from '../../../../lib/api-client';
import { getActiveWorkspace } from '../../../../lib/workspace';

export async function GET(request: NextRequest) {
  const workspace = await getActiveWorkspace();
  if (!workspace) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const format = request.nextUrl.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';
  try {
    const response = await apiFetchRaw(`/workspaces/${workspace.id}/export?format=${format}`);
    return new NextResponse(response.body, {
      headers: {
        'Content-Type':
          response.headers.get('content-type') ??
          (format === 'pdf' ? 'application/pdf' : 'text/csv'),
        'Content-Disposition':
          response.headers.get('content-disposition') ??
          `attachment; filename="noorixfin.${format}"`,
        'Cache-Control': 'no-store, private',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Export is temporarily unavailable.' }, { status: 503 });
  }
}
