-- First-class recurring-rule management.
--
-- The table already stores the template safely outside the ledger. This
-- migration closes two integrity gaps exposed once rules can be managed from
-- their own page: blank names and impossible date windows. Neither check
-- changes the core guarantee that a rule never posts money automatically.

ALTER TABLE public.recurring_rules
  ADD CONSTRAINT recurring_rules_name_not_blank
    CHECK (btrim(name) <> ''),
  ADD CONSTRAINT recurring_rules_date_window
    CHECK (ends_at IS NULL OR ends_at >= next_occurrence);

CREATE INDEX idx_recurring_workspace_status
  ON public.recurring_rules(workspace_id, status, next_occurrence);

COMMENT ON TABLE public.recurring_rules IS
  'User-managed reminder/draft templates. Rules never post ledger entries without confirmation.';
