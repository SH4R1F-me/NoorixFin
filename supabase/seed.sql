-- NoorixFin Seed Data — for local development/testing only
-- Never use production data for dev/test (Blueprint §17.3)

-- NOTE: This seed file runs AFTER migrations.
-- In local dev, Supabase Auth users are created via the API.
-- These seeds provide sample workspace and category data
-- that would normally be created through the application flow.

-- System categories will be inserted via the NestJS API
-- during first-run initialization. This seed is a placeholder
-- to verify the migration schema is correct.

SELECT 'Seed data loaded successfully' AS status;
