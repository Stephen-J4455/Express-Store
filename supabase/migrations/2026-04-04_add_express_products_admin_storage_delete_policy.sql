-- Migration: Allow authenticated users to delete product images from storage
-- Date: 2026-04-04

BEGIN;

DROP POLICY IF EXISTS "express_products_delete_admin" ON storage.objects;
DROP POLICY IF EXISTS "express_products_delete_authenticated" ON storage.objects;

CREATE POLICY "express_products_delete_authenticated"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'express-products'
);

COMMIT;