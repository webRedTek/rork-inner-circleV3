-- ==================================================================================
-- ADD DEFAULT AFFILIATE TIERS
-- ==================================================================================

-- Insert default affiliate tiers if they don't exist
INSERT INTO public.affiliate_tiers (name, payout_type, monetary_value, recurring_percentage, max_invites, min_payout_threshold, payout_schedule, active)
SELECT 'silver_affiliate', 'one_time', 10.00, null, 100, 50.00, 'monthly', true
WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_tiers WHERE name = 'silver_affiliate');

INSERT INTO public.affiliate_tiers (name, payout_type, monetary_value, recurring_percentage, max_invites, min_payout_threshold, payout_schedule, active)
SELECT 'gold_affiliate', 'one_time', 25.00, null, 500, 50.00, 'monthly', true
WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_tiers WHERE name = 'gold_affiliate'); 