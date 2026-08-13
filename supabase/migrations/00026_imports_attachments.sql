-- Phase 5 data portability: private transaction receipts and staged imports.

-- Composite references below make workspace ownership structural rather than
-- trusting API callers to keep a foreign row and workspace id in agreement.
CREATE UNIQUE INDEX uq_journal_entries_id_workspace
  ON public.journal_entries(id, workspace_id);

CREATE TABLE public.transaction_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 180),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (journal_entry_id, workspace_id)
    REFERENCES public.journal_entries(id, workspace_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, owner_id, idempotency_key)
);

CREATE INDEX idx_transaction_attachments_entry ON public.transaction_attachments(journal_entry_id, created_at);
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_read_transaction_attachments" ON public.transaction_attachments
  FOR SELECT USING (owner_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = transaction_attachments.workspace_id
      AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'
  ));
CREATE POLICY "members_insert_own_transaction_attachments" ON public.transaction_attachments
  FOR INSERT WITH CHECK (owner_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = transaction_attachments.workspace_id
      AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'
  ));
CREATE POLICY "owners_delete_transaction_attachments" ON public.transaction_attachments
  FOR DELETE USING (owner_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.transaction_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_attachments TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transaction-receipts', 'transaction-receipts', false, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "members_read_own_receipts" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'transaction-receipts'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[1]
        AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'
    )
  );
CREATE POLICY "members_upload_own_receipts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'transaction-receipts'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[1]
        AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'
    )
  );
CREATE POLICY "members_delete_own_receipts" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'transaction-receipts'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[1]
        AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'
    )
  );

CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('CSV','OFX','QIF')),
  filename TEXT NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 180),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','COMPLETED_WITH_ERRORS','FAILED')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (workspace_id, created_by, idempotency_key)
);

CREATE UNIQUE INDEX uq_import_jobs_id_workspace ON public.import_jobs(id, workspace_id);

CREATE TABLE public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL CHECK (row_number > 0),
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IMPORTED','FAILED')),
  error_message TEXT,
  journal_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, row_number),
  FOREIGN KEY (job_id, workspace_id)
    REFERENCES public.import_jobs(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (journal_entry_id, workspace_id)
    REFERENCES public.journal_entries(id, workspace_id)
    ON DELETE SET NULL (journal_entry_id)
);

CREATE INDEX idx_import_jobs_workspace_created ON public.import_jobs(workspace_id, created_at DESC);
CREATE INDEX idx_import_rows_job ON public.import_rows(job_id, row_number);
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_manage_import_jobs" ON public.import_jobs
  FOR ALL USING (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = import_jobs.workspace_id
      AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'
  )) WITH CHECK (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = import_jobs.workspace_id
      AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'
  ));

CREATE POLICY "owners_manage_import_rows" ON public.import_rows
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.import_jobs j
    WHERE j.id = import_rows.job_id AND j.created_by = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.import_jobs j
    WHERE j.id = import_rows.job_id AND j.created_by = auth.uid()
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs, public.import_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs, public.import_rows TO service_role;

COMMENT ON TABLE public.import_rows IS 'Staging and per-row audit trail for CSV/OFX/QIF imports; money is posted only through TransactionsService.';
COMMENT ON TABLE public.transaction_attachments IS 'Private receipt metadata. Object bytes live in the transaction-receipts bucket.';
