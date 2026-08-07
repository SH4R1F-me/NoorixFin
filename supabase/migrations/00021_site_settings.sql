-- ============================================================
-- 00021 — Site Settings & Donation Options
-- Marketing website dynamic controls for SUPER_ADMIN panel.
--
-- Two tables:
--   site_settings      — key/value store (logo URL, site name, etc.)
--   donation_options   — structured donation cards (dev + Palestine)
--
-- Access model:
--   anon / authenticated : SELECT only (public marketing pages)
--   service_role         : ALL (admin panel server actions)
--
-- Storage: a `site-assets` bucket is created for logo uploads.
-- The bucket is PUBLIC — logos are displayed on unauthenticated pages.
-- ============================================================

-- ── 1. site_settings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_settings (
  key         TEXT        PRIMARY KEY,
  value       TEXT,
  label       TEXT        NOT NULL DEFAULT '',
  description TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.site_settings IS
  'Global key/value configuration for the marketing website. '
  'Readable by anonymous users; writable only via service_role (admin panel).';

-- Seed defaults — idempotent
INSERT INTO public.site_settings (key, label, description, value) VALUES
  ('logo_url',  'Site Logo URL',  'Public URL of the site logo image (Supabase Storage).', NULL),
  ('site_name', 'Site Name',      'Display name shown in the navigation bar.',              'NoorixFin')
ON CONFLICT (key) DO NOTHING;

-- ── 2. donation_options ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.donation_options (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT        NOT NULL UNIQUE
                              CHECK (type IN ('development', 'palestine')),
  title           TEXT        NOT NULL,
  subtitle        TEXT        NOT NULL DEFAULT '',
  description     TEXT        NOT NULL DEFAULT '',
  icon            TEXT        NOT NULL DEFAULT '💻',
  color_from      TEXT        NOT NULL DEFAULT '#059669',
  color_to        TEXT        NOT NULL DEFAULT '#10b981',
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order   INTEGER     NOT NULL DEFAULT 0,
  -- payment_methods is a JSONB array of:
  -- [{ "method": "bkash"|"paypal"|"bank"|"link",
  --    "label": string, "account"?: string,
  --    "url"?: string, "note"?: string }]
  payment_methods JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.donation_options IS
  'Donation cards shown on the /support page. '
  'payment_methods is a JSONB array so admins can add/remove methods without schema changes.';

-- Seed defaults
INSERT INTO public.donation_options
  (type, title, subtitle, description, icon, color_from, color_to, display_order, payment_methods)
VALUES
  ('development',
   'Support Development',
   'Keep the project alive',
   'Help cover server costs, development time, and keep NoorixFin 100% free for everyone. Every contribution, no matter how small, makes a real difference.',
   '💻',
   '#059669', '#10b981',
   1,
   '[{"method":"paypal","label":"PayPal","url":"https://paypal.me/example","note":"Update this in Admin → Site Settings"},{"method":"bkash","label":"bKash","account":"+880 1XXX-XXXXXX","note":"Personal account — update in admin"}]'::jsonb
  ),
  ('palestine',
   'Support Palestine',
   'Stand in solidarity',
   'Donate to verified humanitarian organizations providing aid to Palestinian civilians. Every amount helps.',
   '🇵🇸',
   '#dc2626', '#ef4444',
   2,
   '[{"method":"link","label":"UNRWA","url":"https://www.unrwa.org/donate","note":"UN Relief and Works Agency for Palestine Refugees"},{"method":"link","label":"Islamic Relief","url":"https://www.islamic-relief.org/appeals/palestine-emergency/","note":"Humanitarian aid organization"}]'::jsonb
  )
ON CONFLICT (type) DO NOTHING;

-- updated_at trigger (reuse existing pattern)
CREATE OR REPLACE FUNCTION public.set_donation_options_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_donation_options_updated_at ON public.donation_options;
CREATE TRIGGER trg_donation_options_updated_at
  BEFORE UPDATE ON public.donation_options
  FOR EACH ROW EXECUTE FUNCTION public.set_donation_options_updated_at();

-- ── 3. RLS ──────────────────────────────────────────────────

-- site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings;
CREATE POLICY "Public read site_settings"
  ON public.site_settings FOR SELECT
  USING (true); -- anon + authenticated can read

-- donation_options
ALTER TABLE public.donation_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read donation_options" ON public.donation_options;
CREATE POLICY "Public read donation_options"
  ON public.donation_options FOR SELECT
  USING (true);

-- ── 4. Grants ────────────────────────────────────────────────

-- anon reads (PostgREST uses anon role for unauthenticated API calls)
GRANT SELECT ON public.site_settings    TO anon;
GRANT SELECT ON public.donation_options TO anon;

-- authenticated reads
GRANT SELECT ON public.site_settings    TO authenticated;
GRANT SELECT ON public.donation_options TO authenticated;

-- service_role gets full DML (admin panel uses service_role client)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donation_options TO service_role;
