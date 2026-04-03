-- Migration: Fix express_ads RLS so admins can manage campaigns while users can only update counters
-- Date: 2026-04-03

BEGIN;

ALTER TABLE IF EXISTS public.express_ads ENABLE ROW LEVEL SECURITY;

-- Helper: determine whether current user is an admin in express_profiles.
CREATE OR REPLACE FUNCTION public.is_express_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.express_profiles p
    WHERE p.id = user_id
      AND p.role = 'admin'
  );
$$;

-- Replace ad policies with explicit admin + tracking behavior.
DROP POLICY IF EXISTS "express_ads_read_active" ON public.express_ads;
DROP POLICY IF EXISTS "express_ads_update_counters_anon" ON public.express_ads;
DROP POLICY IF EXISTS "express_ads_update_counters_authenticated" ON public.express_ads;
DROP POLICY IF EXISTS "express_ads_read_all_admin" ON public.express_ads;
DROP POLICY IF EXISTS "express_ads_insert_admin" ON public.express_ads;
DROP POLICY IF EXISTS "express_ads_update_any_authenticated" ON public.express_ads;
DROP POLICY IF EXISTS "express_ads_delete_admin" ON public.express_ads;

-- Public/customer reads: only active ads.
CREATE POLICY "express_ads_read_active"
ON public.express_ads
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Admin reads: allow viewing all ads (including inactive/scheduled).
CREATE POLICY "express_ads_read_all_admin"
ON public.express_ads
FOR SELECT
TO authenticated
USING (public.is_express_admin(auth.uid()));

-- Admin inserts/deletes.
CREATE POLICY "express_ads_insert_admin"
ON public.express_ads
FOR INSERT
TO authenticated
WITH CHECK (public.is_express_admin(auth.uid()));

CREATE POLICY "express_ads_delete_admin"
ON public.express_ads
FOR DELETE
TO authenticated
USING (public.is_express_admin(auth.uid()));

-- Updates are allowed by RLS for clients, but guarded by trigger below.
CREATE POLICY "express_ads_update_any_authenticated"
ON public.express_ads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "express_ads_update_counters_anon"
ON public.express_ads
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Trigger guard: non-admin users can only update clicks/impressions.
CREATE OR REPLACE FUNCTION public.enforce_express_ads_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Let service role and postgres bypass app-level restrictions.
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('service_role', 'postgres') THEN
    RETURN NEW;
  END IF;

  -- Admins can edit all fields.
  IF public.is_express_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-admin users can only change interaction counters.
  IF (to_jsonb(NEW) - ARRAY['impressions', 'clicks']) =
     (to_jsonb(OLD) - ARRAY['impressions', 'clicks']) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only admins can manage ad campaign fields'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_express_ads_update_permissions ON public.express_ads;
CREATE TRIGGER trg_enforce_express_ads_update_permissions
BEFORE UPDATE ON public.express_ads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_express_ads_update_permissions();

-- Grants: authenticated can write (trigger + policies enforce limits);
-- anon can only update counters.
GRANT SELECT ON public.express_ads TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.express_ads TO authenticated;

REVOKE UPDATE ON public.express_ads FROM anon;
GRANT UPDATE (impressions, clicks) ON public.express_ads TO anon;

COMMIT;
