-- Phase 5 appearance preference. SYSTEM follows the operating-system choice;
-- explicit LIGHT/DARK follows the user across web sessions and devices.
ALTER TABLE public.profiles
  ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'SYSTEM'
  CONSTRAINT profiles_theme_preference_check
  CHECK (theme_preference IN ('SYSTEM', 'LIGHT', 'DARK'));

COMMENT ON COLUMN public.profiles.theme_preference IS
  'SYSTEM follows prefers-color-scheme/Appearance; LIGHT and DARK are explicit user overrides.';

-- Migration 00012 deliberately replaced table-wide UPDATE with a column list
-- so profile preferences cannot be used to self-promote to super admin. Every
-- new user-editable preference must therefore be granted explicitly.
GRANT UPDATE (theme_preference) ON public.profiles TO authenticated;
