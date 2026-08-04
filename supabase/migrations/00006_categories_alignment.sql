-- NoorixFin Migration: Categories Alignment (DEC-015)
--
-- `categories.service.ts` was written against a schema that does not exist: it
-- reads and writes `is_system`, `name`, and `type`, none of which are columns,
-- and never supplies the NOT NULL `ledger_account_id`. Every insert and the list
-- query fail at runtime.
--
-- The fix is in the service (see DEC-015), not by adding the phantom columns:
--   `is_system` → `translation_key IS NOT NULL`
--   `name`      → `COALESCE(custom_name, t(translation_key))`, resolved client-side
--   `type`      → `kind`
--
-- This migration adds only what the corrected service needs from the database.

-- ============================================================
-- 1. Idempotent seeding
-- ============================================================
-- Seeding runs on first category access per workspace and must be safe to
-- repeat (two concurrent first-requests would otherwise double-seed).

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_workspace_translation_key
  ON categories(workspace_id, translation_key)
  WHERE translation_key IS NOT NULL;

COMMENT ON INDEX uq_categories_workspace_translation_key IS
  'DEC-015: one row per system category per workspace. Makes seedSystemCategories() idempotent.';

-- Same for the ledger account backing each seeded category.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_accounts_workspace_category_name
  ON ledger_accounts(workspace_id, name)
  WHERE subtype = 'CATEGORY';

-- ============================================================
-- 2. A category must be nameable
-- ============================================================
-- Display name is custom_name when set, otherwise the translated
-- translation_key. A row with neither cannot be rendered at all.

ALTER TABLE categories DROP CONSTRAINT IF EXISTS chk_categories_nameable;
ALTER TABLE categories ADD CONSTRAINT chk_categories_nameable
  CHECK (custom_name IS NOT NULL OR translation_key IS NOT NULL);

-- ============================================================
-- 3. Category kind must agree with its ledger account class
-- ============================================================
-- An INCOME category posting into an EXPENSE account would silently invert the
-- sign of every transaction using it. The FK alone does not prevent that, so
-- enforce the pairing with a trigger.

CREATE OR REPLACE FUNCTION check_category_account_kind()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  account_class TEXT;
  account_workspace UUID;
BEGIN
  SELECT la.class, la.workspace_id
    INTO account_class, account_workspace
    FROM public.ledger_accounts la
   WHERE la.id = NEW.ledger_account_id;

  IF account_class IS NULL THEN
    RAISE EXCEPTION 'ledger account % not found', NEW.ledger_account_id;
  END IF;

  IF account_class <> NEW.kind THEN
    RAISE EXCEPTION
      'category kind % does not match ledger account class %',
      NEW.kind, account_class;
  END IF;

  -- A category and its backing account must belong to the same workspace,
  -- otherwise a posting would cross a tenant boundary (SEC-01).
  IF NEW.workspace_id IS DISTINCT FROM account_workspace THEN
    RAISE EXCEPTION
      'category workspace % does not match ledger account workspace %',
      NEW.workspace_id, account_workspace;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS categories_account_kind ON categories;
CREATE TRIGGER categories_account_kind
  BEFORE INSERT OR UPDATE OF ledger_account_id, kind, workspace_id ON categories
  FOR EACH ROW EXECUTE FUNCTION check_category_account_kind();

COMMENT ON FUNCTION check_category_account_kind() IS
  'DEC-015: a category''s kind must equal its ledger account class, and both must '
  'live in the same workspace. Prevents sign inversion and cross-tenant postings.';
