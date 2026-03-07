-- Migration: Add shipping_fee to products/sellers and service_fee_percentage to settings
-- Date: 2026-03-01
--
-- 1. Sellers can set a shipping fee per product (or use 0 for free shipping).
-- 2. Admin sets a global service_fee_percentage in express_settings.
-- 3. During checkout, customer pays: subtotal + shipping_fees + service_fee.
--    service_fee = service_fee_percentage% of product subtotal.
-- 4. Seller subaccount receives: product_subtotal + shipping_fees.
-- 5. Platform keeps: service_fee. Paystack processing fees come from the service fee.

BEGIN;

-- Add shipping_fee column to products (per-product shipping charge set by seller)
ALTER TABLE public.express_products
  ADD COLUMN IF NOT EXISTS shipping_fee numeric(12,2) DEFAULT 0;

-- Add default_shipping_fee to sellers (store-level default; used when product has no shipping_fee)
ALTER TABLE public.express_sellers
  ADD COLUMN IF NOT EXISTS default_shipping_fee numeric(12,2) DEFAULT 0;

-- Add shipping_fee column to express_order_items to record the shipping charged per item at time of purchase
ALTER TABLE public.express_order_items
  ADD COLUMN IF NOT EXISTS shipping_fee numeric(12,2) DEFAULT 0;

-- Add shipping_fee (seller's shipping) and service_fee_pct to express_orders for record keeping
ALTER TABLE public.express_orders
  ADD COLUMN IF NOT EXISTS shipping_fee numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_pct numeric(5,2) DEFAULT 0;

-- Insert default service_fee_percentage setting if it doesn't exist
INSERT INTO public.express_settings (key, value)
VALUES ('service_fee_percentage', '5')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- Rollback:
-- ALTER TABLE public.express_products DROP COLUMN IF EXISTS shipping_fee;
-- ALTER TABLE public.express_sellers DROP COLUMN IF EXISTS default_shipping_fee;
-- ALTER TABLE public.express_order_items DROP COLUMN IF EXISTS shipping_fee;
-- ALTER TABLE public.express_orders DROP COLUMN IF EXISTS shipping_fee;
-- ALTER TABLE public.express_orders DROP COLUMN IF EXISTS service_fee_pct;
-- DELETE FROM public.express_settings WHERE key = 'service_fee_percentage';
