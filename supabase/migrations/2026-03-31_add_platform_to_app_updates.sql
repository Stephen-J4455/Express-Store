-- Migration: Add platform column to app_updates and make app+platform unique
-- Date: 2026-03-31

BEGIN;

-- add platform column (nullable). existing rows remain unchanged (null)
ALTER TABLE IF EXISTS public.app_updates ADD COLUMN IF NOT EXISTS platform text;

-- set existing NULL platform rows to 'android' so current deployments keep previous behavior
UPDATE public.app_updates
SET platform = 'android'
WHERE platform IS NULL;

-- drop previous single-column unique constraint on app (if present)
ALTER TABLE IF EXISTS public.app_updates DROP CONSTRAINT IF EXISTS app_updates_app_key;

-- add composite unique constraint across app + platform
ALTER TABLE IF EXISTS public.app_updates ADD CONSTRAINT app_updates_app_platform_key UNIQUE (app, platform);

COMMIT;

-- Rollback (manual):
-- ALTER TABLE public.app_updates DROP CONSTRAINT IF EXISTS app_updates_app_platform_key;
-- ALTER TABLE public.app_updates ADD CONSTRAINT app_updates_app_key UNIQUE (app);
-- ALTER TABLE public.app_updates DROP COLUMN IF EXISTS platform;
