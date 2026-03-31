-- Migration: Create app_updates table
-- Date: 2026-03-28

BEGIN;

-- Central table for admin-controlled app update configuration
CREATE TABLE IF NOT EXISTS public.app_updates (
  id serial PRIMARY KEY,
  app text NOT NULL UNIQUE,
  latest_version text,
  min_version text,
  force_update boolean DEFAULT false,
  update_message text,
  download_url text,
  release_notes text,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMIT;

-- Rollback (manual):
-- DROP TABLE IF EXISTS public.app_updates;
