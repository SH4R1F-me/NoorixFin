import { createHash } from 'node:crypto';
import type { SupabaseService } from '../supabase/supabase.service';
import type { AuditService } from '../observability/audit.service';
import { ExportService } from './export.service';

type Result = { data: unknown; error: { message: string } | null };

class Query implements PromiseLike<Result> {
  constructor(
    private readonly result: Result,
    private readonly onInsert?: (value: unknown) => void,
    private readonly onRange?: (from: number, to: number) => void,
  ) {}

  select() {
    return this;
  }
  eq() {
    return this;
  }
  order() {
    return this;
  }
  maybeSingle() {
    return this;
  }
  update() {
    return this;
  }
  delete() {
    return this;
  }
  insert(value: unknown) {
    this.onInsert?.(value);
    return this;
  }
  range(from: number, to: number) {
    this.onRange?.(from, to);
    return this;
  }
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

describe('ExportService bounded artifact', () => {
  it('pages every relation, chunks NDJSON, and publishes matching integrity metadata', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const workspaceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const chunks: Array<{ content: string; byte_length: number }> = [];
    const ranges: Array<[number, number]> = [];

    const userClient = {
      from: (table: string) => {
        const data =
          table === 'profiles'
            ? { id: userId, email: 'redacted@example.test' }
            : table === 'workspace_members'
              ? [{ user_id: userId, workspace_id: workspaceId }]
              : table === 'workspaces'
                ? { id: workspaceId, name: 'Personal' }
                : [];
        return new Query({ data, error: null }, undefined, (from, to) =>
          ranges.push([from, to]),
        );
      },
    };
    const serviceClient = {
      from: (table: string) =>
        new Query({ data: null, error: null }, (value) => {
          if (table === 'data_export_chunks')
            chunks.push(value as { content: string; byte_length: number });
        }),
    };
    const service = new ExportService(
      {
        getUserClient: () => userClient,
        getServiceClient: () => serviceClient,
      } as unknown as SupabaseService,
      { write: jest.fn() } as unknown as AuditService,
    );

    const artifact = await service.createArtifact(userId, 'token');
    const body = chunks.map((item) => item.content).join('');

    expect(artifact.status).toBe('READY');
    expect(artifact.format).toBe('ndjson-v1');
    expect(artifact.size_bytes).toBe(Buffer.byteLength(body));
    expect(artifact.checksum_sha256).toBe(
      createHash('sha256').update(body).digest('hex'),
    );
    expect(chunks.every((item) => item.byte_length <= 512 * 1024)).toBe(true);
    expect(ranges.length).toBeGreaterThan(10);
    expect(ranges.every(([from, to]) => to - from + 1 === 500)).toBe(true);
    expect(new Date(artifact.expires_at).getTime()).toBeGreaterThan(Date.now());
  });
});
