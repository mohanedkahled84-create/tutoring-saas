-- Migration: Allow zero amount and coupon payment method in payment_proofs for 100% discount coupons

ALTER TABLE public.payment_proofs 
  DROP CONSTRAINT IF EXISTS payment_proofs_amount_check;

ALTER TABLE public.payment_proofs 
  ADD CONSTRAINT payment_proofs_amount_check CHECK (amount >= 0);

ALTER TABLE public.payment_proofs 
  DROP CONSTRAINT IF EXISTS payment_proofs_payment_method_check;

ALTER TABLE public.payment_proofs 
  ADD CONSTRAINT payment_proofs_payment_method_check 
  CHECK (payment_method = ANY (ARRAY['instapay'::text, 'vodafone_cash'::text, 'bank_transfer'::text, 'cash'::text, 'coupon'::text, 'other'::text]));
