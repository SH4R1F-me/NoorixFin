-- Phase 4 notification worker privilege repair.
--
-- Migration 00023 made deliveries/campaigns writable by service_role, but the
-- worker also reads recurring calendar events and resolves their workspace
-- recipients. RLS bypass does not bypass PostgreSQL table privileges, so both
-- reads failed before any reminder could be routed.
GRANT SELECT ON public.calendar_events, public.workspace_members TO service_role;
