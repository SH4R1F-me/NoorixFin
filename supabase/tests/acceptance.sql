\set ON_ERROR_STOP off
\set ALICE '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set BOB   '''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''

\echo '── 42P17: does the CURRENT profiles policy recurse? (00004 fix) ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) AS profiles_visible_to_alice FROM profiles;
COMMIT;

\echo '── SEC-01: Alice must NOT see Bob''s workspace ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) AS bob_ws_visible_to_alice FROM workspaces WHERE id = '22222222-2222-2222-2222-222222222222';
COMMIT;

\echo '── SEC-02(c): SUPER_ADMIN must NOT read another user''s LEDGER ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) AS bob_entries_visible_to_superadmin FROM journal_entries;
SELECT count(*) AS bob_postings_visible_to_superadmin FROM journal_postings;
SELECT count(*) AS bob_accounts_visible_to_superadmin FROM ledger_accounts;
COMMIT;

\echo '── Bob sees his own ledger (positive control) ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) AS bob_sees_own_entries FROM journal_entries;
SELECT count(*) AS bob_sees_own_postings FROM journal_postings;
COMMIT;

\echo '── SEC-02(a): Bob must NOT write into Alice''s workspace ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
INSERT INTO ledger_accounts (workspace_id, name, class, subtype, currency_code, normal_balance, created_by)
VALUES ('11111111-1111-1111-1111-111111111111','Intruder','ASSET','CASH','BDT','DEBIT','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
ROLLBACK;
\set ON_ERROR_STOP off
\echo '── SEC-01: Bob (plain USER) must NOT see Alice''s workspace or ledger ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) AS alice_ws_visible_to_bob FROM workspaces WHERE id='11111111-1111-1111-1111-111111111111';
SELECT count(*) AS alice_membership_visible_to_bob FROM workspace_members WHERE workspace_id='11111111-1111-1111-1111-111111111111';
SELECT count(*) AS all_ws_visible_to_bob FROM workspaces;
COMMIT;

\echo '── FIN-01: debit AND credit both positive must be rejected ──'
BEGIN;
INSERT INTO journal_postings (journal_entry_id, ledger_account_id, debit_minor, credit_minor, currency_code, base_amount_minor)
VALUES ('55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333',100,100,'SAR',100);
ROLLBACK;

\echo '── FIN-01: zero-only posting must be rejected ──'
BEGIN;
INSERT INTO journal_postings (journal_entry_id, ledger_account_id, debit_minor, credit_minor, currency_code, base_amount_minor)
VALUES ('55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333',0,0,'SAR',0);
ROLLBACK;

\echo '── DEC-007: second member in a workspace must be rejected (00004 index) ──'
BEGIN;
INSERT INTO workspace_members (workspace_id, user_id, role, status)
VALUES ('22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','OWNER','ACTIVE');
ROLLBACK;

\echo '── DEC-007: second active PERSONAL workspace per user must be rejected (00004 index) ──'
BEGIN;
INSERT INTO workspaces (type,name,base_currency,timezone,created_by,status)
VALUES ('PERSONAL','Bob Second','SAR','Asia/Riyadh','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','ACTIVE');
ROLLBACK;

\echo '── DEC-015: category kind must match its ledger account class (00006 trigger) ──'
BEGIN;
INSERT INTO categories (workspace_id, ledger_account_id, kind, translation_key)
VALUES ('22222222-2222-2222-2222-222222222222','44444444-4444-4444-4444-444444444444','INCOME','cat.wrong');
ROLLBACK;

\echo '── DEC-015: matching kind must be ACCEPTED (positive control) ──'
BEGIN;
INSERT INTO categories (workspace_id, ledger_account_id, kind, translation_key)
VALUES ('22222222-2222-2222-2222-222222222222','44444444-4444-4444-4444-444444444444','EXPENSE','cat.food_dining');
SELECT 'accepted' AS matching_kind;
ROLLBACK;

\echo '── DEC-015: cross-workspace category/account pairing must be rejected ──'
BEGIN;
INSERT INTO ledger_accounts (id,workspace_id,name,class,subtype,currency_code,normal_balance,created_by)
VALUES ('99999999-9999-9999-9999-999999999999','11111111-1111-1111-1111-111111111111','AliceFood','EXPENSE','CATEGORY','BDT','DEBIT','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO categories (workspace_id, ledger_account_id, kind, translation_key)
VALUES ('22222222-2222-2222-2222-222222222222','99999999-9999-9999-9999-999999999999','EXPENSE','cat.cross');
ROLLBACK;

\echo '── 00006: a category with neither custom_name nor translation_key must be rejected ──'
BEGIN;
INSERT INTO categories (workspace_id, ledger_account_id, kind)
VALUES ('22222222-2222-2222-2222-222222222222','44444444-4444-4444-4444-444444444444','EXPENSE');
ROLLBACK;

-- ============================================================================
-- ADMIN PLATFORM (DEC-016, DEC-017, DEC-018) — migrations 00012–00014
-- ============================================================================
-- Alice is the SUPER_ADMIN, Bob a plain USER (see _seed.sql).

\echo '── ADMIN-01: a plain USER must NOT see system_events ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) AS system_events_visible_to_bob FROM system_events;
COMMIT;

\echo '── ADMIN-02: SUPER_ADMIN sees system_events (positive control) ──'
-- Seeded inside the test: an empty table would make this pass for the wrong
-- reason — "0 visible" proves nothing about whether the policy grants access.
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO system_events (level, event_code, message) VALUES ('ERROR','PROBE','visible to operators');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) AS system_events_visible_to_alice FROM system_events;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) AS same_events_visible_to_bob FROM system_events;
ROLLBACK;

\echo '── ADMIN-01b: a plain USER must NOT be able to forge a system event ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
INSERT INTO system_events (level, event_code, message) VALUES ('FATAL','FORGED','planted by a user');
ROLLBACK;

\echo '── ADMIN-03: app_settings — a USER sees ONLY public keys ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) AS public_settings_visible_to_bob FROM app_settings;
SELECT count(*) AS private_settings_visible_to_bob FROM app_settings WHERE is_public = FALSE;
COMMIT;

\echo '── ADMIN-03b: SUPER_ADMIN sees private settings too ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) AS private_settings_visible_to_alice FROM app_settings WHERE is_public = FALSE;
COMMIT;

\echo '── ADMIN-04: broadcast visibility — draft/expired/future hidden, live shown ──'
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO broadcasts (id, status, title_en, title_bn, publish_at, expires_at) VALUES
  ('d0000000-0000-0000-0000-000000000001','DRAFT',    'draft',   'খসড়া',   NULL, NULL),
  ('d0000000-0000-0000-0000-000000000002','PUBLISHED','live',    'সরাসরি', NOW() - INTERVAL '1 hour', NULL),
  ('d0000000-0000-0000-0000-000000000003','PUBLISHED','expired', 'মেয়াদোত্তীর্ণ', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
  ('d0000000-0000-0000-0000-000000000004','PUBLISHED','future',  'ভবিষ্যৎ', NOW() + INTERVAL '1 day', NULL),
  ('d0000000-0000-0000-0000-000000000005','ARCHIVED', 'archived','সংরক্ষিত', NOW() - INTERVAL '3 days', NULL);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Must be exactly one: 'live'.
SELECT count(*) AS broadcasts_visible_to_bob, string_agg(title_en, ',') AS which FROM broadcasts;
ROLLBACK;

\echo '── ADMIN-04b: audience=SUPER_ADMINS must be hidden from a plain USER ──'
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO broadcasts (status, audience, title_en, title_bn, publish_at)
VALUES ('PUBLISHED','SUPER_ADMINS','ops only','শুধু অপারেটর', NOW() - INTERVAL '1 hour');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) AS ops_only_visible_to_bob FROM broadcasts WHERE audience = 'SUPER_ADMINS';
ROLLBACK;

\echo '── ADMIN-05: admin_user_overview() must RAISE for a non-admin caller ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) FROM admin_user_overview(NULL,NULL,10,0);
ROLLBACK;

\echo '── ADMIN-05b: admin_platform_stats() must RAISE for a non-admin caller ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT admin_platform_stats();
ROLLBACK;

\echo '── ADMIN-05c: SUPER_ADMIN gets counts, and NO monetary column exists ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT email, workspace_count, account_count, entry_count FROM admin_user_overview(NULL,NULL,10,0) ORDER BY email;
COMMIT;
-- The return type IS the privacy boundary (DEC-016): assert no money column can
-- ever appear, regardless of what the body selects.
SELECT count(*) AS monetary_columns_in_admin_user_overview
  FROM information_schema.routines r
  JOIN information_schema.parameters p ON p.specific_name = r.specific_name
 WHERE r.routine_name = 'admin_user_overview'
   AND p.parameter_mode = 'OUT'
   AND (p.parameter_name ILIKE '%amount%' OR p.parameter_name ILIKE '%minor%'
        OR p.parameter_name ILIKE '%balance%' OR p.parameter_name ILIKE '%payee%'
        OR p.parameter_name ILIKE '%note%' OR p.parameter_name ILIKE '%debit%'
        OR p.parameter_name ILIKE '%credit%');

\echo '── ADMIN-06: SUPER_ADMIN still cannot read another user''s postings (regression) ──'
-- The core guarantee (DEC-002 #12). If a future migration adds a super-admin
-- bypass policy to a ledger table, this is what fails.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) AS bob_postings_visible_to_superadmin FROM journal_postings;
SELECT count(*) AS bob_entries_visible_to_superadmin  FROM journal_entries;
SELECT count(*) AS ledger_policies_granting_superadmin
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('ledger_accounts','categories','journal_entries',
                     'journal_postings','tags','journal_entry_tags')
   AND qual LIKE '%is_super_admin%';
COMMIT;

\echo '── DEC-012: a USER must NOT be able to promote themselves (00012 column grant) ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
UPDATE profiles SET is_super_admin = TRUE WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
ROLLBACK;

\echo '── DEC-017: a USER must NOT be able to clear their own SUSPENDED status ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
UPDATE profiles SET status = 'ACTIVE' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
ROLLBACK;

\echo '── DEC-012: legitimate self-update must still be ACCEPTED (positive control) ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
UPDATE profiles SET display_name = 'Bob Renamed', locale = 'en'
 WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT display_name, locale FROM profiles WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
ROLLBACK;

\echo '── DEC-017: PENDING_DELETION without a deadline must be rejected (00012 CHECK) ──'
BEGIN;
SET LOCAL ROLE postgres;
UPDATE profiles SET status = 'PENDING_DELETION', deletion_scheduled_for = NULL
 WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
ROLLBACK;

\echo '── DEC-017: purge removes only EXPIRED grace periods, in FK order ──'
BEGIN;
SET LOCAL ROLE postgres;
-- Bob is pending but his grace has NOT expired: purge must leave him alone.
UPDATE profiles SET status = 'PENDING_DELETION',
       deletion_requested_at = NOW(), deletion_scheduled_for = NOW() + INTERVAL '30 days'
 WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) AS purged_while_still_in_grace FROM purge_expired_deletions();
SELECT count(*) AS bob_entries_still_present FROM journal_entries;

-- Now expire it: the ledger must go, and the audit row must remain.
UPDATE profiles SET deletion_scheduled_for = NOW() - INTERVAL '1 day'
 WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) AS purged_after_grace_expired FROM purge_expired_deletions();
SELECT count(*) AS bob_entries_after_purge   FROM journal_entries;
SELECT count(*) AS bob_postings_after_purge  FROM journal_postings;
SELECT count(*) AS bob_profile_after_purge   FROM profiles WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) AS purge_audit_rows_written  FROM audit_events WHERE action = 'ACCOUNT_PURGED';
ROLLBACK;

\echo '── DEC-018: prune_system_events() respects the retention window ──'
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO system_events (level, event_code, message, created_at) VALUES
  ('INFO','OLD','beyond retention', NOW() - INTERVAL '90 days'),
  ('INFO','NEW','within retention', NOW());
SELECT prune_system_events(30) AS pruned_rows;
SELECT count(*) AS recent_rows_kept FROM system_events WHERE event_code = 'NEW';
SELECT count(*) AS old_rows_remaining FROM system_events WHERE event_code = 'OLD';
ROLLBACK;

-- ============================================================================
-- GLOBAL NOTIFICATIONS (§5) — migration 00023
-- ============================================================================

\echo '── NOTIF-01: users see only their own durable notifications ──'
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO notifications (id, user_id, category, title_en, body_en) VALUES
  ('e0000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','security','Alice only','private'),
  ('e0000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','system','Bob only','private');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT count(*) AS notifications_visible_to_bob,
       string_agg(title_en, ',') AS which
  FROM notifications
 WHERE id IN ('e0000000-0000-0000-0000-000000000001',
              'e0000000-0000-0000-0000-000000000002');
ROLLBACK;

\echo '── NOTIF-02: a user cannot forge a notification, even for themselves ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
INSERT INTO notifications (user_id, category, title_en, body_en)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','security','Forged','not allowed');
ROLLBACK;

\echo '── NOTIF-03: a user cannot mark another user''s notification read ──'
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO notifications (id, user_id, category, title_en, body_en)
VALUES ('e0000000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','security','Alice only','private');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
UPDATE notifications SET read_at = NOW()
 WHERE id = 'e0000000-0000-0000-0000-000000000003';
SET LOCAL ROLE postgres;
SELECT count(*) AS alice_notification_still_unread
  FROM notifications
 WHERE id = 'e0000000-0000-0000-0000-000000000003'
   AND read_at IS NULL;
ROLLBACK;

\echo '── NOTIF-04: invalid categories and delivery states are rejected ──'
BEGIN;
INSERT INTO notifications (user_id, category, title_en, body_en)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','marketing','Invalid','must fail');
ROLLBACK;

\echo '── NOTIF-05: campaign/template content is service-role only ──'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) AS campaigns_visible_to_operator FROM notification_campaigns;
SELECT count(*) AS templates_visible_to_operator FROM notification_templates;
ROLLBACK;
