-- Migration 00023_notifications
-- Global notification system (§5 of the audit).
--
-- Three tables:
--   notifications              — the source of truth; every notification a user receives
--   notification_preferences   — per-user, per-category channel opt-in/out
--   notification_deliveries    — per-channel delivery outcomes (in_app/push/email)
--
-- Design decisions recorded in DEC-0xx (§5.1):
--   1. Realtime carries a payload-free hint, not the notification content.
--   2. The notification row is the source of truth; a push is a best-effort pointer to it.
--   3. security category is not opt-out — delivered regardless of preferences.
--
-- Quiet hours live on profiles: added below as two nullable columns + timezone.

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id  UUID        REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category      TEXT        NOT NULL
                            CHECK (category IN (
                              'security','budget','goal','recurring','transaction',
                              'sync','account','system','operator'
                            )),
  -- INFO | SUCCESS | WARNING | CRITICAL
  severity      TEXT        NOT NULL DEFAULT 'INFO'
                            CHECK (severity IN ('INFO','SUCCESS','WARNING','CRITICAL')),
  title_en      TEXT        NOT NULL,
  title_bn      TEXT,
  body_en       TEXT        NOT NULL,
  body_bn       TEXT,
  action_url    TEXT,
  resource_type TEXT,
  resource_id   UUID,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  read_at       TIMESTAMPTZ,
  archived_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  -- Collapses repeated alerts (e.g. "budget at 90%") into one row per key+user.
  dedupe_key    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Unique per user+dedupe_key so inserting the same event twice is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedupe
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Fast unread badge count and notification centre query.
CREATE INDEX IF NOT EXISTS idx_notif_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notif_user
  ON public.notifications (user_id, created_at DESC);

-- ── notification_preferences ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category  TEXT    NOT NULL
                    CHECK (category IN (
                      'security','budget','goal','recurring','transaction',
                      'sync','account','system','operator'
                    )),
  in_app    BOOLEAN NOT NULL DEFAULT TRUE,
  push      BOOLEAN NOT NULL DEFAULT TRUE,
  email     BOOLEAN NOT NULL DEFAULT FALSE,
  digest    TEXT    NOT NULL DEFAULT 'NONE'
                    CHECK (digest IN ('NONE','DAILY','WEEKLY')),
  PRIMARY KEY (user_id, category)
);

-- ── notification_deliveries ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID        NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  -- NULL means web/in-app delivery (no device)
  device_id       UUID        REFERENCES public.user_devices(id) ON DELETE SET NULL,
  -- in_app | push | email | webpush
  channel         TEXT        NOT NULL CHECK (channel IN ('in_app','push','email','webpush')),
  -- PENDING | SENT | DELIVERED | FAILED | SUPPRESSED
  status          TEXT        NOT NULL CHECK (status IN ('PENDING','SENT','DELIVERED','FAILED','SUPPRESSED')),
  provider_id     TEXT,   -- FCM message ID, SES message ID, etc.
  error           TEXT,
  attempts        SMALLINT    NOT NULL DEFAULT 0,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_notification
  ON public.notification_deliveries (notification_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_pending
  ON public.notification_deliveries (status, created_at)
  WHERE status = 'PENDING';

-- One outcome row per device/channel. Non-device channels get their own partial
-- uniqueness rule because PostgreSQL treats NULLs as distinct in UNIQUE keys.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_device_channel
  ON public.notification_deliveries (notification_id, channel, device_id)
  WHERE device_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_user_channel
  ON public.notification_deliveries (notification_id, channel)
  WHERE device_id IS NULL;

-- ── operator-authored campaigns and reusable templates ──────────────────────
-- These rows hold content the operator authored, never user ledger content.
-- Individual recipients remain represented only by `notifications` and are not
-- exposed through the operator API (DEC-016).
CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  audience      TEXT        NOT NULL CHECK (audience IN ('ALL','OPERATORS')),
  category      TEXT        NOT NULL CHECK (category IN ('system','operator')),
  severity      TEXT        NOT NULL DEFAULT 'INFO'
                            CHECK (severity IN ('INFO','SUCCESS','WARNING','CRITICAL')),
  title_en      TEXT        NOT NULL,
  title_bn      TEXT,
  body_en       TEXT        NOT NULL,
  body_bn       TEXT,
  action_url    TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'SCHEDULED'
                            CHECK (status IN ('DRAFT','SCHEDULED','PROCESSING','SENT','FAILED','CANCELLED')),
  recipient_count INTEGER   NOT NULL DEFAULT 0,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER notification_campaigns_updated_at
  BEFORE UPDATE ON public.notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_due
  ON public.notification_campaigns (scheduled_for)
  WHERE status = 'SCHEDULED';

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  category    TEXT        NOT NULL CHECK (category IN (
                'security','budget','goal','recurring','transaction',
                'sync','account','system','operator'
              )),
  title_en    TEXT        NOT NULL,
  title_bn    TEXT,
  body_en     TEXT        NOT NULL,
  body_bn     TEXT,
  action_url  TEXT,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── payload-free Realtime invalidation ───────────────────────────────────────
-- Clients subscribe to this table, never to `notifications`.  The row carries
-- only ownership and a nonce; after a hint the client fetches the durable body
-- through the authenticated API / delta sync endpoint.
CREATE TABLE IF NOT EXISTS public.notification_hints (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_hints_user
  ON public.notification_hints (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.emit_notification_hint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notification_hints (user_id) VALUES (NEW.user_id);
  DELETE FROM public.notification_hints
   WHERE user_id = NEW.user_id AND created_at < NOW() - INTERVAL '7 days';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_notification_hint() FROM PUBLIC;

CREATE TRIGGER notifications_emit_hint
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.emit_notification_hint();

-- ── daily/weekly digest rollup ────────────────────────────────────────────────
-- pg_cron calls this once per day. DAILY rows roll up the last 24 hours;
-- WEEKLY rows run on Monday and roll up seven days. Original in-app rows stay
-- durable, while deferred external channel rows are linked to one email digest.
CREATE OR REPLACE FUNCTION public.enqueue_notification_digests()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pref RECORD;
  digest_id UUID;
  item_count INTEGER;
  period_key TEXT;
  since_at TIMESTAMPTZ;
BEGIN
  FOR pref IN
    SELECT user_id, category, digest
      FROM public.notification_preferences
     WHERE digest = 'DAILY'
        OR (digest = 'WEEKLY' AND EXTRACT(ISODOW FROM CURRENT_DATE) = 1)
  LOOP
    since_at := NOW() - CASE WHEN pref.digest = 'WEEKLY'
      THEN INTERVAL '7 days' ELSE INTERVAL '1 day' END;

    SELECT COUNT(DISTINCT d.notification_id)::INTEGER
      INTO item_count
      FROM public.notification_deliveries d
      JOIN public.notifications n ON n.id = d.notification_id
     WHERE n.user_id = pref.user_id
       AND n.category = pref.category
       AND n.created_at >= since_at
       AND d.status = 'SUPPRESSED'
       AND d.error = 'Deferred to digest';

    IF item_count = 0 THEN CONTINUE; END IF;

    period_key := CASE WHEN pref.digest = 'WEEKLY'
      THEN to_char(CURRENT_DATE, 'IYYY-IW')
      ELSE to_char(CURRENT_DATE, 'YYYY-MM-DD') END;

    INSERT INTO public.notifications (
      user_id, category, severity, title_en, title_bn, body_en, body_bn,
      action_url, metadata, dedupe_key, archived_at
    ) VALUES (
      pref.user_id, pref.category, 'INFO',
      CASE WHEN pref.digest = 'WEEKLY' THEN 'Your weekly notification digest'
           ELSE 'Your daily notification digest' END,
      CASE WHEN pref.digest = 'WEEKLY' THEN 'আপনার সাপ্তাহিক নোটিফিকেশন সারাংশ'
           ELSE 'আপনার দৈনিক নোটিফিকেশন সারাংশ' END,
      format('%s %s notifications are waiting for you.', item_count, lower(pref.category)),
      format('আপনার জন্য %sটি %s নোটিফিকেশন অপেক্ষা করছে।', item_count, pref.category),
      '/dashboard/notifications',
      jsonb_build_object('digest', pref.digest, 'item_count', item_count),
      format('digest:%s:%s:%s', pref.digest, pref.category, period_key),
      NOW()
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL
    DO UPDATE SET
      body_en = EXCLUDED.body_en,
      body_bn = EXCLUDED.body_bn,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING id INTO digest_id;

    INSERT INTO public.notification_deliveries
      (notification_id, channel, status, error)
    VALUES
      (digest_id, 'in_app', 'SUPPRESSED', 'Digest transport row'),
      (digest_id, 'email', 'PENDING', NULL)
    ON CONFLICT DO NOTHING;

    UPDATE public.notification_deliveries d
       SET error = 'Included in digest:' || digest_id::TEXT
      FROM public.notifications n
     WHERE n.id = d.notification_id
       AND n.user_id = pref.user_id
       AND n.category = pref.category
       AND n.created_at >= since_at
       AND d.status = 'SUPPRESSED'
       AND d.error = 'Deferred to digest';
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification_digests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_notification_digests() TO service_role;

SELECT cron.schedule(
  'notification-digests',
  '0 6 * * *',
  'SELECT public.enqueue_notification_digests()'
);

-- ── quiet hours on profiles ───────────────────────────────────────────────────
-- CRITICAL severity overrides quiet hours (§5.3).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quiet_hours_start TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_end   TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_tz    TEXT DEFAULT 'Asia/Dhaka';

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_hints ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications.
CREATE POLICY "users_read_own_notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users manage only their own preferences.
CREATE POLICY "users_read_own_preferences" ON public.notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_preferences" ON public.notification_preferences
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_read_own_notification_hints" ON public.notification_hints
  FOR SELECT USING (user_id = auth.uid());

-- Deliveries are internal-only; no user-facing RLS (operators see aggregate stats).
-- service_role bypasses RLS automatically.

-- ── service_role grants ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.notifications,
     public.notification_preferences,
     public.notification_deliveries,
     public.notification_campaigns,
     public.notification_templates,
     public.notification_hints
  TO service_role;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT ON public.notification_hints TO authenticated;

-- ── Realtime publication (payload-free hint, not content) ─────────────────────
-- Financial content is deliberately absent from this publication (DEC-011).
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_hints;
