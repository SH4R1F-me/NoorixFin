/**
 * Audit Service — writes to `audit_events`.
 *
 * Distinct from SystemEventsService on purpose (DEC-018):
 *
 *   audit_events  — WHO did WHAT to WHICH resource. A security/business record.
 *                   Append-only, retained indefinitely, survives the deletion of
 *                   the account it describes (actor_id nulls out, the row stays).
 *   system_events — HOW the system behaved. Operational telemetry, pruned on a
 *                   retention window.
 *
 * Every operator mutation calls this. An admin console whose actions leave no
 * trace is not an enterprise admin console — it is a backdoor with a UI.
 *
 * Unlike system events these are written synchronously and awaited: if the audit
 * write fails the caller should know, because "the action happened but was not
 * recorded" is exactly the state an audit trail exists to prevent.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface AuditEntry {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  workspaceId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Record an audited action.
   *
   * Uses the service-role client rather than the caller's token: an operator
   * acting on another user's profile writes a row whose `workspace_id` is NULL
   * and whose subject is someone else, and we do not want that write's success
   * to depend on the shape of an RLS policy written for ordinary members.
   *
   * Returns false rather than throwing — the caller decides whether a failed
   * audit write should abort the operation. It logs at error level regardless.
   */
  async write(entry: AuditEntry): Promise<boolean> {
    try {
      const client = this.supabaseService.getServiceClient();
      const { error } = await client.from('audit_events').insert({
        actor_id: entry.actorId,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId ?? null,
        workspace_id: entry.workspaceId ?? null,
        metadata: entry.metadata ?? {},
        ip_address: entry.ipAddress ?? null,
      });

      if (error) {
        this.logger.error(
          `AUDIT WRITE FAILED for ${entry.action} on ${entry.resourceType}: ${error.message}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        `AUDIT WRITE FAILED for ${entry.action}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return false;
    }
  }
}
