-- Migration: Allow ad reads + interaction counter updates via RLS
-- Date: 2026-04-03

BEGIN;

-- Ensure RLS is enabled on ads table.
ALTER TABLE IF EXISTS public.express_ads ENABLE ROW LEVEL SECURITY;

-- Remove old policies if they exist so this migration is idempotent.
DROP POLICY IF EXISTS "express_ads_read_active" ON public.express_ads;
DROP POLICY IF EXISTS "express_ads_update_counters_anon" ON public.express_ads;
DROP POLICY IF EXISTS "express_ads_update_counters_authenticated" ON public.express_ads;

-- Allow clients to read active ads.
CREATE POLICY "express_ads_read_active"
ON public.express_ads
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Allow clients to update rows for interaction counters.
-- Column-level grants below restrict anon/authenticated to only clicks/impressions.
CREATE POLICY "express_ads_update_counters_anon"
ON public.express_ads
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "express_ads_update_counters_authenticated"
ON public.express_ads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Restrict public roles to update only interaction counters.
REVOKE UPDATE ON public.express_ads FROM anon;
REVOKE UPDATE ON public.express_ads FROM authenticated;

GRANT UPDATE (impressions, clicks) ON public.express_ads TO anon;
GRANT UPDATE (impressions, clicks) ON public.express_ads TO authenticated;

COMMIT;
