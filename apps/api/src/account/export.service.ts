/**
 * Bounded account exports — DATA-01.
 *
 * Reads always use the caller's RLS-scoped client. Rows are fetched in fixed
 * pages and encoded as NDJSON into <=512 KiB database chunks, so neither the
 * API nor either client ever holds the complete financial history in memory.
 * The artifact carries SHA-256, byte and row counts, expires after 24 hours,
 * can be explicitly deleted, and is streamed chunk-by-chunk on download.
 */
import {
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../observability/audit.service';

export const EXPORT_FORMAT_VERSION = 2;
const PAGE_SIZE = 500;
const CHUNK_BYTES = 512 * 1024;

const EXPORT_TABLES = [
  'ledger_accounts',
  'categories',
  'journal_entries',
  'journal_postings',
  'budgets',
  'budget_lines',
  'savings_goals',
  'debt_details',
  'calendar_events',
  'recurring_rules',
  'tags',
  'journal_entry_tags',
] as const;

type ExportTable = (typeof EXPORT_TABLES)[number];
const EXPORT_ORDER_KEY: Record<ExportTable, string> = {
  ledger_accounts: 'id',
  categories: 'id',
  journal_entries: 'id',
  journal_postings: 'id',
  budgets: 'id',
  budget_lines: 'id',
  savings_goals: 'id',
  debt_details: 'ledger_account_id',
  calendar_events: 'id',
  recurring_rules: 'id',
  tags: 'id',
  journal_entry_tags: 'journal_entry_id',
};

interface PagedQuery {
  select(columns: string): PagedQuery;
  eq(column: string, value: unknown): PagedQuery;
  order(column: string, options: { ascending: boolean }): PagedQuery;
  range(
    from: number,
    to: number,
  ): PromiseLike<{
    data: Array<Record<string, unknown>> | null;
    error: { message: string } | null;
  }>;
}

export interface DataExportArtifact {
  id: string;
  status: string;
  format: string;
  size_bytes: number;
  row_count: number;
  checksum_sha256: string | null;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
  download_url: string | null;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly audit: AuditService,
  ) {}

  async createArtifact(
    userId: string,
    accessToken: string,
  ): Promise<DataExportArtifact> {
    const artifactId = randomUUID();
    const service = this.supabase.getServiceClient();
    const user = this.supabase.getUserClient(accessToken);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    const { error: createError } = await service
      .from('data_export_artifacts')
      .insert({
        id: artifactId,
        user_id: userId,
        status: 'PROCESSING',
        expires_at: expiresAt.toISOString(),
      });
    if (createError) this.fail(createError.message);

    const hash = createHash('sha256');
    let chunk = '';
    let chunkBytes = 0;
    let sequence = 0;
    let rowCount = 0;
    let sizeBytes = 0;

    const flush = async () => {
      if (!chunkBytes) return;
      const { error } = await service.from('data_export_chunks').insert({
        artifact_id: artifactId,
        sequence,
        content: chunk,
        byte_length: chunkBytes,
      });
      if (error) throw new Error(error.message);
      sequence += 1;
      chunk = '';
      chunkBytes = 0;
    };

    const emit = async (type: string, data: unknown, workspaceId?: string) => {
      const line = `${JSON.stringify({ type, workspace_id: workspaceId, data })}\n`;
      const bytes = Buffer.byteLength(line);
      if (bytes > 1024 * 1024)
        throw new Error(
          'One export row exceeded the 1 MiB artifact chunk limit.',
        );
      if (chunkBytes && chunkBytes + bytes > CHUNK_BYTES) await flush();
      chunk += line;
      chunkBytes += bytes;
      sizeBytes += bytes;
      rowCount += 1;
      hash.update(line, 'utf8');
    };

    try {
      await emit('manifest', {
        format_version: EXPORT_FORMAT_VERSION,
        generated_at: createdAt.toISOString(),
        scope:
          'Every row this account owns. Operational system and audit events are excluded.',
      });

      const { data: profile, error: profileError } = await user
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (profileError) throw new Error(profileError.message);
      if (profile) await emit('profile', profile);

      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data: memberships, error } = await user
          .from('workspace_members')
          .select('*')
          .eq('user_id', userId)
          .order('workspace_id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);

        for (const membership of memberships ?? []) {
          await emit('workspace_member', membership, membership.workspace_id);
          const { data: workspace, error: workspaceError } = await user
            .from('workspaces')
            .select('*')
            .eq('id', membership.workspace_id)
            .maybeSingle();
          if (workspaceError) throw new Error(workspaceError.message);
          if (!workspace) continue;
          await emit('workspace', workspace, workspace.id);
          for (const table of EXPORT_TABLES) {
            await this.emitTable(
              user as unknown as { from(table: ExportTable): PagedQuery },
              table,
              workspace.id,
              emit,
            );
          }
          await this.emitAttachments(user, workspace.id, emit);
        }
        if ((memberships?.length ?? 0) < PAGE_SIZE) break;
      }

      await flush();
      const checksum = hash.digest('hex');
      const completedAt = new Date().toISOString();
      const { error: completeError } = await service
        .from('data_export_artifacts')
        .update({
          status: 'READY',
          size_bytes: sizeBytes,
          row_count: rowCount,
          checksum_sha256: checksum,
          completed_at: completedAt,
          error: null,
        })
        .eq('id', artifactId)
        .eq('user_id', userId);
      if (completeError) throw new Error(completeError.message);

      await this.audit.write({
        actorId: userId,
        action: 'DATA_EXPORT_CREATED',
        resourceType: 'data_export_artifact',
        resourceId: artifactId,
        metadata: { size_bytes: sizeBytes, row_count: rowCount, checksum },
      });
      return {
        id: artifactId,
        status: 'READY',
        format: 'ndjson-v1',
        size_bytes: sizeBytes,
        row_count: rowCount,
        checksum_sha256: checksum,
        expires_at: expiresAt.toISOString(),
        created_at: createdAt.toISOString(),
        completed_at: completedAt,
        download_url: `/me/exports/${artifactId}/download`,
      };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message.slice(0, 500) : 'Export failed';
      await service
        .from('data_export_chunks')
        .delete()
        .eq('artifact_id', artifactId);
      await service
        .from('data_export_artifacts')
        .update({ status: 'FAILED', error: message })
        .eq('id', artifactId)
        .eq('user_id', userId);
      this.logger.error(`Export ${artifactId} failed: ${message}`);
      this.fail(message);
    }
  }

  async getArtifact(userId: string, id: string): Promise<DataExportArtifact> {
    return this.toResponse(await this.ownedArtifact(userId, id));
  }

  async streamArtifact(
    userId: string,
    id: string,
    response: Response,
  ): Promise<void> {
    const artifact = await this.ownedArtifact(userId, id);
    if (artifact.status !== 'READY')
      throw new ServiceUnavailableException({
        code: 'EXPORT_NOT_READY',
        message: 'The export artifact is not ready.',
      });

    const digest = Buffer.from(artifact.checksum_sha256!, 'hex').toString(
      'base64',
    );
    response.status(200);
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="noorixfin-export-${artifact.created_at.slice(0, 10)}.ndjson"`,
    );
    response.setHeader('Content-Length', String(artifact.size_bytes));
    response.setHeader('Content-Digest', `sha-256=:${digest}:`);
    response.setHeader('X-Checksum-SHA256', artifact.checksum_sha256!);
    response.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private',
    );
    response.flushHeaders();

    const service = this.supabase.getServiceClient();
    for (let offset = 0; ; offset += 32) {
      const { data, error } = await service
        .from('data_export_chunks')
        .select('content')
        .eq('artifact_id', id)
        .order('sequence', { ascending: true })
        .range(offset, offset + 31);
      if (error) throw new Error(error.message);
      for (const item of data ?? []) {
        if (!response.write(item.content)) await once(response, 'drain');
      }
      if ((data?.length ?? 0) < 32) break;
    }
    response.end();
  }

  async deleteArtifact(
    userId: string,
    id: string,
  ): Promise<{ deleted: boolean }> {
    await this.ownedArtifact(userId, id);
    const { error } = await this.supabase
      .getServiceClient()
      .from('data_export_artifacts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) this.fail(error.message);
    await this.audit.write({
      actorId: userId,
      action: 'DATA_EXPORT_DELETED',
      resourceType: 'data_export_artifact',
      resourceId: id,
    });
    return { deleted: true };
  }

  private async emitTable(
    client: { from(table: ExportTable): PagedQuery },
    table: ExportTable,
    workspaceId: string,
    emit: (type: string, data: unknown, workspaceId?: string) => Promise<void>,
  ) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('workspace_id', workspaceId)
        .order(EXPORT_ORDER_KEY[table], { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) await emit(table, row, workspaceId);
      if ((data?.length ?? 0) < PAGE_SIZE) break;
    }
  }

  private async emitAttachments(
    client: ReturnType<SupabaseService['getUserClient']>,
    workspaceId: string,
    emit: (type: string, data: unknown, workspaceId?: string) => Promise<void>,
  ) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client
        .from('transaction_attachments')
        .select(
          'id, workspace_id, journal_entry_id, original_name, content_type, size_bytes, checksum_sha256, created_at',
        )
        .eq('workspace_id', workspaceId)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      for (const row of data ?? [])
        await emit('transaction_attachments', row, workspaceId);
      if ((data?.length ?? 0) < PAGE_SIZE) break;
    }
  }

  private async ownedArtifact(userId: string, id: string) {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('data_export_artifacts')
      .select(
        'id, status, format, size_bytes, row_count, checksum_sha256, expires_at, created_at, completed_at',
      )
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) this.fail(error.message);
    if (!data)
      throw new NotFoundException({
        code: 'EXPORT_NOT_FOUND',
        message: 'Export artifact not found.',
      });
    if (new Date(data.expires_at).getTime() <= Date.now()) {
      await this.supabase
        .getServiceClient()
        .from('data_export_artifacts')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      throw new GoneException({
        code: 'EXPORT_EXPIRED',
        message: 'The export artifact expired and was deleted.',
      });
    }
    return data;
  }

  private toResponse(
    artifact: Awaited<ReturnType<ExportService['ownedArtifact']>>,
  ): DataExportArtifact {
    return {
      ...artifact,
      download_url:
        artifact.status === 'READY'
          ? `/me/exports/${artifact.id}/download`
          : null,
    };
  }

  private fail(message: string): never {
    throw new ServiceUnavailableException({
      code: 'EXPORT_FAILED',
      message: `The export artifact could not be created: ${message}`,
    });
  }
}
