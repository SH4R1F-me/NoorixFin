-- NoorixFin Ledger Schema Migration
-- Blueprint §9.3: ledger_accounts, categories, journal_entries, journal_postings

-- ============================================================
-- LEDGER ACCOUNTS (§9.3)
-- ============================================================
CREATE TABLE ledger_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  class TEXT NOT NULL CHECK (class IN ('ASSET','LIABILITY','INCOME','EXPENSE','EQUITY')),
  subtype TEXT NOT NULL CHECK (subtype IN ('CASH','BANK','MOBILE_WALLET','CREDIT_CARD','LOAN','SAVINGS','CATEGORY','SYSTEM')),
  currency_code CHAR(3) NOT NULL,
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('DEBIT','CREDIT')),
  include_in_budget BOOLEAN NOT NULL DEFAULT TRUE,
  include_in_net_worth BOOLEAN NOT NULL DEFAULT TRUE,
  opening_date DATE,
  archived_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_ledger_accounts_workspace ON ledger_accounts(workspace_id);
ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace accounts"
  ON ledger_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ledger_accounts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

CREATE POLICY "Editors+ can create accounts"
  ON ledger_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ledger_accounts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND wm.role IN ('OWNER','ADMIN','EDITOR')
    )
  );

CREATE POLICY "Editors+ can update accounts"
  ON ledger_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ledger_accounts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND wm.role IN ('OWNER','ADMIN','EDITOR')
    )
  );

-- ============================================================
-- CATEGORIES (§9.3)
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE RESTRICT,
  ledger_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  kind TEXT NOT NULL CHECK (kind IN ('INCOME','EXPENSE')),
  parent_id UUID REFERENCES categories(id),
  translation_key TEXT,
  custom_name TEXT,
  icon TEXT NOT NULL DEFAULT '📦',
  color TEXT NOT NULL DEFAULT '#6B7785',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_workspace ON categories(workspace_id);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view categories"
  ON categories FOR SELECT
  USING (
    workspace_id IS NULL  -- system categories visible to all
    OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = categories.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- JOURNAL ENTRIES (§9.3)
-- ============================================================
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('INCOME','EXPENSE','TRANSFER','ADJUSTMENT','OPENING','REVERSAL')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  local_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payee TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING','POSTED','VOIDED')),
  source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','IMPORT','RECURRING','SYSTEM')),
  client_entry_id UUID NOT NULL,
  idempotency_key_hash TEXT,
  reverses_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- Indexes (§9.6)
CREATE INDEX idx_journal_entries_workspace_date ON journal_entries(workspace_id, occurred_at DESC, id);
CREATE INDEX idx_journal_entries_workspace_local ON journal_entries(workspace_id, local_date DESC);
CREATE UNIQUE INDEX idx_idempotency ON journal_entries(created_by, idempotency_key_hash) WHERE idempotency_key_hash IS NOT NULL;

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace entries"
  ON journal_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = journal_entries.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

CREATE POLICY "Editors+ can create entries"
  ON journal_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = journal_entries.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND wm.role IN ('OWNER','ADMIN','EDITOR')
    )
  );

CREATE POLICY "Editors+ can update entries"
  ON journal_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = journal_entries.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND wm.role IN ('OWNER','ADMIN','EDITOR')
    )
  );

-- ============================================================
-- JOURNAL POSTINGS (§9.3)
-- ============================================================
CREATE TABLE journal_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
  ledger_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  debit_minor BIGINT NOT NULL DEFAULT 0,
  credit_minor BIGINT NOT NULL DEFAULT 0,
  currency_code CHAR(3) NOT NULL,
  base_amount_minor BIGINT NOT NULL DEFAULT 0,
  fx_rate NUMERIC,
  memo TEXT,
  -- Blueprint §9.3: debit and credit cannot both be positive; no zero-only posting
  CONSTRAINT chk_posting_sides CHECK (
    NOT (debit_minor > 0 AND credit_minor > 0)
  ),
  CONSTRAINT chk_posting_nonzero CHECK (
    debit_minor > 0 OR credit_minor > 0
  ),
  CONSTRAINT chk_posting_nonnegative CHECK (
    debit_minor >= 0 AND credit_minor >= 0
  )
);

CREATE INDEX idx_journal_postings_entry ON journal_postings(journal_entry_id);
CREATE INDEX idx_journal_postings_account ON journal_postings(ledger_account_id);

ALTER TABLE journal_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view postings"
  ON journal_postings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      JOIN workspace_members wm ON wm.workspace_id = je.workspace_id
      WHERE je.id = journal_postings.journal_entry_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- TAGS & JOURNAL ENTRY TAGS (§9.5)
-- ============================================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (workspace_id, name)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE TABLE journal_entry_tags (
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (journal_entry_id, tag_id)
);

ALTER TABLE journal_entry_tags ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- IDEMPOTENCY RECORDS (§8.3)
-- ============================================================
CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  route TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  UNIQUE (actor_user_id, route, key_hash)
);

-- ============================================================
-- AUDIT EVENTS (§7.2 step 7)
-- ============================================================
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_workspace ON audit_events(workspace_id, created_at DESC);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Audit events: only owner can view
CREATE POLICY "Owners can view audit events"
  ON audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = audit_events.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND wm.role = 'OWNER'
    )
  );

-- Triggers
CREATE TRIGGER ledger_accounts_updated_at
  BEFORE UPDATE ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
