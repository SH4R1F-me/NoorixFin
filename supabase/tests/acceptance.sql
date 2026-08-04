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
