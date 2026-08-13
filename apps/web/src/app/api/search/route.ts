import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '../../../lib/api-client';
import { getActiveWorkspace } from '../../../lib/workspace';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json({ query, items: [], total: 0 });
  }

  const workspace = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ query, items: [], total: 0 }, { status: 401 });
  }

  try {
    const result = await apiFetch(
      `/workspaces/${workspace.id}/search?q=${encodeURIComponent(query)}`,
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ query, items: [], total: 0 }, { status: 503 });
  }
}
