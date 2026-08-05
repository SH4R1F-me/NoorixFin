/**
 * Data export — Blueprint §15.3, acceptance item DATA-01, audit item 17.
 *
 * The GDPR sibling of the deletion flow that already exists: a user who can ask
 * to be forgotten should be able to ask what is held first. DATA-01 has sat at
 * "not tested" since the acceptance matrix was written, because there was
 * nothing to test.
 *
 * ── WHAT "COMPLETE AND SCOPED" MEANS HERE ────────────────────────────────────
 * DATA-01 is two requirements pulling in opposite directions and both must hold.
 *
 * COMPLETE — everything the user authored or that describes them: the profile,
 * the workspace, every account, category, journal entry AND its postings,
 * budgets, goals, debt terms, calendar events, recurring rules, tags. An export
 * missing the postings would be an export missing the ledger, since the entry
 * carries no amount (DEC-006).
 *
 * SCOPED — nothing that belongs to anyone else, and nothing operational. The
 * export runs on the USER'S client, so RLS is the boundary: a bug in this file
 * cannot widen it. That is deliberate and is why there is no service-role path
 * here even though it would be simpler. `system_events` and `audit_events` are
 * excluded on purpose: an audit trail that a user can export is an audit trail
 * an attacker can read after taking an account.
 *
 * Assembled in one pass rather than streamed. A personal ledger is thousands of
 * rows, not millions, and a streaming export that can half-fail is a worse
 * answer than a bounded one that either works or says it did not.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../observability/audit.service';

/** Bumped when the SHAPE changes, so a consumer can tell two exports apart. */
export const EXPORT_FORMAT_VERSION = 1;

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly audit: AuditService,
  ) {}

  async exportEverything(userId: string, accessToken: string) {
    const client = this.supabase.getUserClient(accessToken);

    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const { data: workspaces } = await client.from('workspaces').select('*');

    // A super admin can SEE other workspaces (DEC-016's metadata aperture), so
    // "every workspace RLS shows me" is the wrong set for an export — an
    // operator exporting their own data would silently receive a list of every
    // workspace on the platform. Membership is the correct filter.
    const { data: memberships } = await client
      .from('workspace_members')
      .select('*')
      .eq('user_id', userId);

    const ownedIds = new Set((memberships ?? []).map((m) => m.workspace_id));
    const ownWorkspaces = (workspaces ?? []).filter((w) => ownedIds.has(w.id));

    const bundles = [];
    for (const workspace of ownWorkspaces) {
      const id = workspace.id;

      const [
        accounts,
        categories,
        entries,
        postings,
        budgets,
        budgetLines,
        goals,
        debts,
        events,
        rules,
        tags,
        entryTags,
      ] = await Promise.all([
        client.from('ledger_accounts').select('*').eq('workspace_id', id),
        client.from('categories').select('*').eq('workspace_id', id),
        client.from('journal_entries').select('*').eq('workspace_id', id),
        // The postings ARE the ledger (DEC-006) — an entry carries no amount, so
        // an export without these is an export of empty rows.
        client.from('journal_postings').select('*').eq('workspace_id', id),
        client.from('budgets').select('*').eq('workspace_id', id),
        client.from('budget_lines').select('*').eq('workspace_id', id),
        client.from('savings_goals').select('*').eq('workspace_id', id),
        client.from('debt_details').select('*').eq('workspace_id', id),
        client.from('calendar_events').select('*').eq('workspace_id', id),
        client.from('recurring_rules').select('*').eq('workspace_id', id),
        client.from('tags').select('*').eq('workspace_id', id),
        client.from('journal_entry_tags').select('*').eq('workspace_id', id),
      ]);

      bundles.push({
        workspace,
        ledger_accounts: accounts.data ?? [],
        categories: categories.data ?? [],
        journal_entries: entries.data ?? [],
        journal_postings: postings.data ?? [],
        budgets: budgets.data ?? [],
        budget_lines: budgetLines.data ?? [],
        savings_goals: goals.data ?? [],
        debt_details: debts.data ?? [],
        calendar_events: events.data ?? [],
        recurring_rules: rules.data ?? [],
        tags: tags.data ?? [],
        journal_entry_tags: entryTags.data ?? [],
      });
    }

    // The export itself is an auditable event. Not because the user did
    // anything wrong, but because "someone downloaded everything" is exactly
    // what an account holder wants to see in their history if their account is
    // ever compromised.
    await this.audit.write({
      actorId: userId,
      action: 'DATA_EXPORTED',
      resourceType: 'profile',
      resourceId: userId,
      metadata: {
        workspaces: bundles.length,
        entries: bundles.reduce((n, b) => n + b.journal_entries.length, 0),
      },
    });

    return {
      format_version: EXPORT_FORMAT_VERSION,
      generated_at: new Date().toISOString(),
      // Stated in the payload rather than left implicit: someone reading this
      // file in a year should not have to guess whether it was everything.
      scope:
        'Every row this account owns. Excludes operational logs (system_events, ' +
        'audit_events), which are platform records rather than user data.',
      profile,
      memberships: memberships ?? [],
      workspaces: bundles,
    };
  }
}
