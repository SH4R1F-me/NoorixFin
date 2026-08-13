-- First-class debt-term management.
-- Outstanding debt remains derived from the linked LIABILITY account. This
-- table stores terms only, so deleting a row must never delete the account or
-- change its balance.

ALTER TABLE public.debt_details
  DROP CONSTRAINT IF EXISTS debt_details_principal_minor_check,
  DROP CONSTRAINT IF EXISTS debt_details_minimum_payment_minor_check;

ALTER TABLE public.debt_details
  ADD CONSTRAINT debt_details_principal_positive CHECK (principal_minor > 0),
  ADD CONSTRAINT debt_details_minimum_payment_positive
    CHECK (minimum_payment_minor IS NULL OR minimum_payment_minor > 0),
  ADD CONSTRAINT debt_details_rate_reasonable
    CHECK (annual_rate_bps IS NULL OR annual_rate_bps BETWEEN 0 AND 100000);

COMMENT ON TABLE public.debt_details IS
  'Repayment terms for liability accounts. Outstanding amounts are always derived from ledger postings.';
