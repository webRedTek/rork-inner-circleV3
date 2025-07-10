-- ==================================================================================
-- AFFILIATE SYSTEM FUNCTIONS
-- ==================================================================================

-- Function to get affiliate tier ID from membership tier
create or replace function get_affiliate_tier_id(membership text)
returns uuid as $$
declare
  tier_id uuid;
begin
  -- Map membership tier to affiliate tier
  case membership
    when 'bronze' then
      -- Bronze users are not eligible for affiliate program
      return null;
    when 'silver' then
      select id into tier_id from public.affiliate_tiers where name = 'silver_affiliate' and active = true limit 1;
    when 'gold' then
      select id into tier_id from public.affiliate_tiers where name = 'gold_affiliate' and active = true limit 1;
    else
      return null;
  end case;
  
  return tier_id;
end;
$$ language plpgsql security definer;

-- Function to get affiliate tier name from membership tier
create or replace function get_affiliate_tier_name(membership_tier text)
returns text as $$
begin
  case membership_tier
    when 'bronze' then return 'bronze_affiliate';
    when 'silver' then return 'silver_affiliate';
    when 'gold' then return 'gold_affiliate';
    else return null;
  end case;
end;
$$ language plpgsql security definer;

-- Function to create affiliate referral record
create or replace function create_affiliate_referral(
  p_referral_code text,
  p_referred_user_id uuid
)
returns jsonb as $$
declare
  v_referrer_id uuid;
  v_tier_id uuid;
  v_referrer_membership text;
  v_referral_id uuid;
  v_result jsonb;
begin
  -- Get referrer information from referral code
  select al.user_id, u.membership_tier into v_referrer_id, v_referrer_membership
  from public.affiliate_links al
  join public.users u on al.user_id = u.id
  where al.referral_code = p_referral_code
  and al.is_active = true
  limit 1;
  
  -- Check if referrer exists and is eligible
  if v_referrer_id is null then
    raise exception 'Invalid referral code';
  end if;
  
  if v_referrer_membership = 'bronze' then
    raise exception 'Bronze tier users are not eligible for affiliate program';
  end if;
  
  -- Check if user has already been referred
  if exists (
    select 1 from public.affiliate_referrals 
    where referred_id = p_referred_user_id
  ) then
    raise exception 'User has already been referred';
  end if;
  
  -- Get affiliate tier ID
  select get_affiliate_tier_id(v_referrer_membership) into v_tier_id;
  
  if v_tier_id is null then
    raise exception 'No valid affiliate tier found for membership: %', v_referrer_membership;
  end if;
  
  -- Create referral record
  insert into public.affiliate_referrals (
    referrer_id,
    referred_id,
    tier_id,
    referral_code,
    status,
    subscription_status,
    initial_subscription_date,
    payout_status
  ) values (
    v_referrer_id,
    p_referred_user_id,
    v_tier_id,
    p_referral_code,
    'pending',
    'trial',
    now(),
    'pending'
  ) returning id into v_referral_id;
  
  -- Update affiliate stats for referrer
  insert into public.affiliate_stats (
    user_id,
    total_referrals,
    active_referrals
  ) values (
    v_referrer_id,
    1,
    1
  ) on conflict (user_id) do update
  set total_referrals = affiliate_stats.total_referrals + 1,
      active_referrals = affiliate_stats.active_referrals + 1,
      updated_at = now();
  
  -- Log the action
  perform log_user_action(v_referrer_id, 'referral_created', jsonb_build_object(
    'referral_id', v_referral_id,
    'referred_user_id', p_referred_user_id,
    'referral_code', p_referral_code
  ));
  
  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'referral_id', v_referral_id,
    'referrer_id', v_referrer_id,
    'tier_id', v_tier_id,
    'message', 'Referral created successfully'
  );
  
  return v_result;
end;
$$ language plpgsql security definer;

