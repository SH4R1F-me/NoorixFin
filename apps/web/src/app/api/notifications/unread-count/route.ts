import { NextResponse } from 'next/server';
import { apiFetch } from '../../../../lib/api-client';

export async function GET() {
  try {
    return NextResponse.json(await apiFetch<{ count: number }>('/notifications/unread-count'));
  } catch {
    return NextResponse.json({ count: 0 }, { status: 503 });
  }
}
