-- 00024 — Phase 5 search indexes plus operator-controlled mobile distribution
-- workspace search. Release metadata lives in the existing public
-- site_settings registry; migrations declare keys so the admin API can keep an
-- allowlist and a typo can never create live configuration.

INSERT INTO public.site_settings (key, label, description, value) VALUES
  ('site.mobile.ios_url', 'iOS store URL', 'HTTPS App Store listing.', NULL),
  ('site.mobile.android_url', 'Android store URL', 'HTTPS Google Play listing.', NULL),
  ('site.mobile.apk_url', 'Direct APK URL', 'Pinned HTTPS release artifact URL.', NULL),
  ('site.mobile.apk_sha256', 'APK SHA-256', 'Lower-case SHA-256 digest for the current APK.', NULL),
  ('site.mobile.latest_version', 'Latest mobile version', 'Current public semantic version.', '1.0.0'),
  ('site.mobile.min_version', 'Minimum mobile version', 'Clients below this semantic version must upgrade.', '1.0.0'),
  ('site.mobile.release_notes_url', 'Release notes URL', 'HTTPS release notes or changelog URL.', '/changelog'),
  ('site.mobile.ios_status', 'iOS listing status', 'COMING_SOON or LIVE.', 'COMING_SOON'),
  ('site.mobile.android_status', 'Android listing status', 'COMING_SOON or LIVE.', 'COMING_SOON'),
  ('site.mobile.apk_size_bytes', 'APK size', 'Artifact size in bytes.', NULL),
  ('site.mobile.released_at', 'Mobile release date', 'ISO-8601 timestamp of the current release.', NULL),
  ('site.mobile.ios_minimum', 'Minimum iOS', 'Human-readable iOS requirement.', '15.0'),
  ('site.mobile.android_minimum', 'Minimum Android', 'Human-readable Android requirement.', '8.0')
ON CONFLICT (key) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_journal_entries_search
  ON public.journal_entries USING gin
  ((coalesce(payee, '') || ' ' || coalesce(note, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_name_search
  ON public.ledger_accounts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_categories_name_search
  ON public.categories USING gin (coalesce(custom_name, translation_key, '') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tags_name_search
  ON public.tags USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_search
  ON public.recurring_rules USING gin
  ((name || ' ' || coalesce(payee, '') || ' ' || coalesce(note, '')) gin_trgm_ops);

CREATE TABLE public.device_pairing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_device_pairing_tokens_expiry ON public.device_pairing_tokens(expires_at)
  WHERE consumed_at IS NULL;
ALTER TABLE public.device_pairing_tokens ENABLE ROW LEVEL SECURITY;
-- Tokens are issued and atomically consumed by the API service role only.
REVOKE ALL ON public.device_pairing_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_pairing_tokens TO service_role;
