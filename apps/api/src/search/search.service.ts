import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

type SearchResult = {
  id: string;
  kind: 'transaction' | 'account' | 'category' | 'tag' | 'recurring';
  title: string;
  subtitle: string | null;
  href: string;
};

@Injectable()
export class SearchService {
  constructor(private readonly supabase: SupabaseService) {}

  async search(workspaceId: string, accessToken: string, rawQuery: string) {
    const client = this.supabase.getUserClient(accessToken);
    const query = rawQuery.trim();
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
    const [entries, accounts, categories, tags, recurring] = await Promise.all([
      client
        .from('journal_entries')
        .select('id, payee, note, entry_type, local_date')
        .eq('workspace_id', workspaceId)
        .or(`payee.ilike.${pattern},note.ilike.${pattern}`)
        .order('local_date', { ascending: false })
        .limit(8),
      client
        .from('ledger_accounts')
        .select('id, name, class, subtype')
        .eq('workspace_id', workspaceId)
        .ilike('name', pattern)
        .is('deleted_at', null)
        .order('name')
        .limit(6),
      client
        .from('categories')
        .select('id, custom_name, translation_key, kind, icon')
        .eq('workspace_id', workspaceId)
        .or(`custom_name.ilike.${pattern},translation_key.ilike.${pattern}`)
        .is('deleted_at', null)
        .limit(6),
      client
        .from('tags')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .ilike('name', pattern)
        .is('deleted_at', null)
        .order('name')
        .limit(6),
      client
        .from('recurring_rules')
        .select('id, name, payee, frequency, next_occurrence')
        .eq('workspace_id', workspaceId)
        .or(
          `name.ilike.${pattern},payee.ilike.${pattern},note.ilike.${pattern}`,
        )
        .eq('status', 'ACTIVE')
        .order('next_occurrence')
        .limit(6),
    ]);
    const error = [
      entries.error,
      accounts.error,
      categories.error,
      tags.error,
      recurring.error,
    ].find(Boolean);
    if (error) throw error;
    const results: SearchResult[] = [
      ...(entries.data ?? []).map((row) => ({
        id: row.id,
        kind: 'transaction' as const,
        title: row.payee ?? row.note ?? row.entry_type,
        subtitle: `${row.entry_type} · ${row.local_date}`,
        href: `/dashboard/transactions?entry=${row.id}`,
      })),
      ...(accounts.data ?? []).map((row) => ({
        id: row.id,
        kind: 'account' as const,
        title: row.name,
        subtitle: `${row.class} · ${row.subtype}`,
        href: `/dashboard/accounts?account=${row.id}`,
      })),
      ...(categories.data ?? []).map((row) => ({
        id: row.id,
        kind: 'category' as const,
        title: row.custom_name ?? row.translation_key ?? 'Unnamed category',
        subtitle: `${row.icon} ${row.kind}`,
        href: `/dashboard/transactions?category=${row.id}`,
      })),
      ...(tags.data ?? []).map((row) => ({
        id: row.id,
        kind: 'tag' as const,
        title: `#${row.name}`,
        subtitle: 'Tag',
        href: `/dashboard/transactions?tag=${encodeURIComponent(row.name)}`,
      })),
      ...(recurring.data ?? []).map((row) => ({
        id: row.id,
        kind: 'recurring' as const,
        title: row.name,
        subtitle: `${row.frequency} · ${row.next_occurrence}`,
        href: `/dashboard/calendar?rule=${row.id}`,
      })),
    ];
    return { query, items: results, total: results.length };
  }
}
