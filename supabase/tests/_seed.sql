-- Two users: Alice (SUPER_ADMIN) owns ws A; Bob (USER) owns ws B.
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','alice@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bob@example.com');

-- profiles are created automatically by handle_new_user() (migration 00001)
UPDATE profiles SET is_super_admin = TRUE  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
UPDATE profiles SET is_super_admin = FALSE WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

INSERT INTO workspaces (id, type, name, base_currency, timezone, created_by, status) VALUES
  ('11111111-1111-1111-1111-111111111111','PERSONAL','Alice','BDT','Asia/Dhaka','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ACTIVE'),
  ('22222222-2222-2222-2222-222222222222','PERSONAL','Bob','SAR','Asia/Riyadh','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','ACTIVE');

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','OWNER','ACTIVE'),
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','OWNER','ACTIVE');

-- Bob's cash account + an expense category account
INSERT INTO ledger_accounts (id, workspace_id, name, class, subtype, currency_code, normal_balance, created_by) VALUES
  ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','Bob Cash','ASSET','CASH','SAR','DEBIT','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('44444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222','Food','EXPENSE','CATEGORY','SAR','DEBIT','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

INSERT INTO journal_entries (id, workspace_id, entry_type, occurred_at, local_date, status, created_by, client_entry_id) VALUES
  ('55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222','EXPENSE',NOW(),CURRENT_DATE,'POSTED','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','88888888-8888-8888-8888-888888888888');

INSERT INTO journal_postings (id, journal_entry_id, ledger_account_id, debit_minor, credit_minor, currency_code, base_amount_minor) VALUES
  ('66666666-6666-6666-6666-666666666666','55555555-5555-5555-5555-555555555555','44444444-4444-4444-4444-444444444444',5000,0,'SAR',5000),
  ('77777777-7777-7777-7777-777777777777','55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333',0,5000,'SAR',5000);
