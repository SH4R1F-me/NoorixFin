-- Make trigram indexes portable across backup/restore targets.
--
-- Migration 00024 installed pg_trgm on the then-current search_path, which put
-- its operator class in public. A fresh Supabase database can already carry
-- the extension in `extensions`; restoring indexes qualified as
-- public.gin_trgm_ops then fails. Keep extensions in their dedicated schema and
-- qualify the operator class explicitly.

DROP INDEX IF EXISTS public.idx_journal_entries_search;
DROP INDEX IF EXISTS public.idx_ledger_accounts_name_search;
DROP INDEX IF EXISTS public.idx_categories_name_search;
DROP INDEX IF EXISTS public.idx_tags_name_search;
DROP INDEX IF EXISTS public.idx_recurring_rules_search;

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

CREATE INDEX idx_journal_entries_search
  ON public.journal_entries USING gin
  ((coalesce(payee, '') || ' ' || coalesce(note, '')) extensions.gin_trgm_ops);
CREATE INDEX idx_ledger_accounts_name_search
  ON public.ledger_accounts USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_categories_name_search
  ON public.categories USING gin
  (coalesce(custom_name, translation_key, '') extensions.gin_trgm_ops);
CREATE INDEX idx_tags_name_search
  ON public.tags USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_recurring_rules_search
  ON public.recurring_rules USING gin
  ((name || ' ' || coalesce(payee, '') || ' ' || coalesce(note, '')) extensions.gin_trgm_ops);
