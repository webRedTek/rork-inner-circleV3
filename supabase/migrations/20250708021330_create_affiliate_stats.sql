-- ==================================================================================
-- CREATE AFFILIATE_STATS TABLE (REQUIRED FOR REFERRAL FUNCTION)
-- ==================================================================================

CREATE TABLE IF NOT EXISTS public.affiliate_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  total_referrals integer NOT NULL DEFAULT 0,
  active_referrals integer NOT NULL DEFAULT 0,
  successful_referrals integer NOT NULL DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  pending_earnings numeric DEFAULT 0,
  last_payout_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
); 