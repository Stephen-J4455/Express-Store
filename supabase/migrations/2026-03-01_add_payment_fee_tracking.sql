-- Migration: Add Paystack fee tracking columns to express_payments (transaction records)
-- Date: 2026-03-01
-- Adds columns to capture Paystack processing fees, platform service fees,
-- seller commissions, and net amounts per order payment record.

BEGIN;

ALTER TABLE public.express_payments
  -- Paystack's total processing fee for this order allocation (in pesewas / minor units)
  ADD COLUMN IF NOT EXISTS paystack_fee_pesewas integer DEFAULT 0,
  -- Paystack-supplied fees_split breakdown JSON (present when using subaccount splits)
  ADD COLUMN IF NOT EXISTS paystack_fee_split jsonb,
  -- The ExpressMart service/delivery fee portion allocated to this order (in GHS)
  -- This amount stays with the main Paystack account, NOT the seller subaccount
  ADD COLUMN IF NOT EXISTS service_fee_amount numeric(12,2) DEFAULT 0,
  -- Platform commission deducted from product subtotal (seller's commission_rate % of subtotal)
  -- This also stays with the main Paystack account
  ADD COLUMN IF NOT EXISTS platform_commission numeric(12,2) DEFAULT 0,
  -- Net amount the seller actually receives (subtotal - platform_commission)
  ADD COLUMN IF NOT EXISTS seller_amount numeric(12,2),
  -- Total amount staying with the main Paystack platform account
  -- = service_fee_amount + platform_commission  (before Paystack deducts its own processing fee)
  ADD COLUMN IF NOT EXISTS platform_amount numeric(12,2);

-- Indexes for analytics and reporting
CREATE INDEX IF NOT EXISTS idx_express_payments_fee_pesewas
  ON public.express_payments (paystack_fee_pesewas)
  WHERE paystack_fee_pesewas IS NOT NULL AND paystack_fee_pesewas > 0;

CREATE INDEX IF NOT EXISTS idx_express_payments_order_status
  ON public.express_payments (order_id, status)
  WHERE order_id IS NOT NULL;

COMMIT;

-- Rollback:
-- DROP INDEX IF EXISTS idx_express_payments_order_status;
-- DROP INDEX IF EXISTS idx_express_payments_fee_pesewas;
-- ALTER TABLE public.express_payments
--   DROP COLUMN IF EXISTS platform_amount,
--   DROP COLUMN IF EXISTS seller_amount,
--   DROP COLUMN IF EXISTS platform_commission,
--   DROP COLUMN IF EXISTS service_fee_amount,
--   DROP COLUMN IF EXISTS paystack_fee_split,
--   DROP COLUMN IF EXISTS paystack_fee_pesewas;
