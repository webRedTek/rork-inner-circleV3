-- This file contains the SQL schema for the Supabase database
-- You can run this in your Supabase SQL editor to create the necessary tables

-- Enable RLS (Row Level Security)
alter table auth.users enable row level security;

-- Create users table
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null unique,
  name text not null,
  bio text,
  location text,
  zip_code text,
  latitude double precision,
  longitude double precision,
  preferred_distance integer default 50,
  location_privacy text not null default 'public', -- 'public', 'matches_only', 'hidden'
  business_field text not null,
  entrepreneur_status text not null,
  photo_url text,
  membership_tier text not null default 'basic',
  business_verified boolean not null default false,
  joined_groups uuid[] default '{}',
  created_at bigint not null default extract(epoch from now()) * 1000,
  skills_offered text[] default '{}',
  skills_seeking text[] default '{}',
  industry_focus text,
  business_stage text,
  key_challenge text,
  availability_level text[] default '{}',
  timezone text,
  success_highlight text,
  looking_for text[] default '{}'
);

-- Create matches table
create table public.matches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  matched_user_id uuid not null references public.users(id) on delete cascade,
  created_at bigint not null default extract(epoch from now()) * 1000,
  last_message_at bigint,
  unique(user_id, matched_user_id)
);

-- Create messages table
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  receiver_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  type text not null default 'text',
  voice_url text,
  voice_duration integer,
  image_url text,
  created_at bigint not null default extract(epoch from now()) * 1000,
  read boolean not null default false
);

-- Create groups table
create table public.groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text not null,
  image_url text,
  member_ids uuid[] not null default '{}',
  created_by uuid not null references public.users(id) on delete cascade,
  created_at bigint not null default extract(epoch from now()) * 1000,
  category text not null,
  industry text
);

-- Create group_messages table
create table public.group_messages (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  type text not null default 'text',
  image_url text,
  created_at bigint not null default extract(epoch from now()) * 1000
);

-- Create group_events table
create table public.group_events (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null,
  location text,
  start_time bigint not null,
  end_time bigint,
  reminder bigint,
  created_at bigint not null default extract(epoch from now()) * 1000
);

-- Create group_event_rsvps table
create table public.group_event_rsvps (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.group_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  response text not null default 'maybe', -- 'yes', 'no', 'maybe'
  created_at bigint not null default extract(epoch from now()) * 1000,
  unique(event_id, user_id)
);

-- Create likes table
create table public.likes (
  id uuid primary key default uuid_generate_v4(),
  liker_id uuid not null references public.users(id) on delete cascade,
  liked_id uuid not null references public.users(id) on delete cascade,
  timestamp bigint not null default extract(epoch from now()) * 1000,
  unique(liker_id, liked_id)
);

-- Create portfolio_items table
create table public.portfolio_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null,
  image_url text,
  link text,
  created_at bigint not null default extract(epoch from now()) * 1000
);

-- Create audit_log table
create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  details jsonb,
  timestamp timestamptz not null default now()
);

-- Create app_settings table
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tier text NOT NULL,
  daily_swipe_limit integer NOT NULL,
  daily_match_limit integer NOT NULL,
  message_sending_limit integer NOT NULL,
  can_see_who_liked_you boolean NOT NULL DEFAULT false,
  can_rewind_last_swipe boolean NOT NULL DEFAULT false,
  boost_duration integer NOT NULL DEFAULT 0,
  boost_frequency integer NOT NULL DEFAULT 0,
  profile_visibility_control boolean NOT NULL DEFAULT false,
  priority_listing boolean NOT NULL DEFAULT false,
  premium_filters_access boolean NOT NULL DEFAULT false,
  global_discovery boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  groups_limit integer NOT NULL DEFAULT 1,
  featured_portfolio_limit integer NOT NULL DEFAULT 1,
  events_per_month integer NOT NULL DEFAULT 0,
  has_business_verification boolean NOT NULL DEFAULT false,
  has_advanced_analytics boolean NOT NULL DEFAULT false,
  has_priority_inbox boolean NOT NULL DEFAULT false,
  can_send_direct_intro boolean NOT NULL DEFAULT false,
  has_virtual_meeting_room boolean NOT NULL DEFAULT false,
  has_custom_branding boolean NOT NULL DEFAULT false,
  has_dedicated_support boolean NOT NULL DEFAULT false,
  can_create_groups boolean NOT NULL DEFAULT false,
  groups_creation_limit integer NOT NULL DEFAULT 0,
  CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);

-- Create affiliate_tiers table
CREATE TABLE public.affiliate_tiers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL CHECK (name = ANY (ARRAY['bronze_affiliate', 'silver_affiliate', 'gold_affiliate'])),
  payout_type text NOT NULL CHECK (payout_type = ANY (ARRAY['one_time', 'recurring'])),
  monetary_value numeric NOT NULL,
  recurring_percentage numeric,
  max_invites integer NOT NULL,
  min_payout_threshold numeric NOT NULL DEFAULT 50.00,
  payout_schedule text NOT NULL DEFAULT 'monthly' CHECK (payout_schedule = ANY (ARRAY['weekly', 'monthly', 'quarterly'])),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_tiers_pkey PRIMARY KEY (id)
);

-- Create affiliate_stats table
create table public.affiliate_stats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  total_referrals integer not null default 0,
  active_referrals integer not null default 0,
  total_earnings decimal not null default 0.0,
  pending_payouts decimal not null default 0.0,
  last_payout jsonb default '{"amount": 0, "date": "N/A"}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create affiliate_links table
CREATE TABLE public.affiliate_links (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  tier_id uuid NOT NULL,
  referral_code text NOT NULL UNIQUE,
  app_store_link text,
  play_store_link text,
  total_clicks integer NOT NULL DEFAULT 0,
  unique_clicks integer NOT NULL DEFAULT 0,
  last_clicked_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_links_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT affiliate_links_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.affiliate_tiers(id)
);

-- Create affiliate_referrals table
CREATE TABLE public.affiliate_referrals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  tier_id uuid NOT NULL,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'completed', 'expired'])),
  subscription_id text,
  subscription_status text CHECK (subscription_status = ANY (ARRAY['trial', 'active', 'expired', 'cancelled'])),
  initial_subscription_date timestamp with time zone,
  last_renewal_date timestamp with time zone,
  next_renewal_date timestamp with time zone,
  total_paid_months integer DEFAULT 0,
  lifetime_value numeric DEFAULT 0.00,
  payout_status text NOT NULL DEFAULT 'pending' CHECK (payout_status = ANY (ARRAY['pending', 'processing', 'paid', 'failed'])),
  last_payout_date timestamp with time zone,
  next_payout_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_referrals_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id),
  CONSTRAINT affiliate_referrals_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.affiliate_tiers(id),
  CONSTRAINT affiliate_referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES public.users(id)
);

-- Create affiliate_payouts table
CREATE TABLE public.affiliate_payouts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  affiliate_id uuid NOT NULL,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'processing', 'completed', 'failed'])),
  payout_method text NOT NULL,
  payout_details jsonb,
  transaction_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_payouts_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_payouts_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.users(id)
);

-- Create affiliate_clicks table
CREATE TABLE public.affiliate_clicks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  link_id uuid NOT NULL,
  ip_address text,
  user_agent text,
  referrer text,
  platform text CHECK (platform = ANY (ARRAY['ios', 'android', 'web'])),
  clicked_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_clicks_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_clicks_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.affiliate_links(id)
);

-- Create usage_tracking table
CREATE TABLE public.usage_tracking (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['swipe', 'match', 'message', 'group_join', 'group_create', 'portfolio_feature', 'event_create', 'direct_intro', 'boost_use', 'rewind_use', 'virtual_meeting'])),
  first_action_timestamp bigint NOT NULL,
  last_action_timestamp bigint NOT NULL,
  current_count integer NOT NULL DEFAULT 0,
  reset_timestamp bigint NOT NULL,
  boost_minutes_remaining integer DEFAULT 0,
  boost_uses_remaining integer DEFAULT 0,
  events_created_this_month integer DEFAULT 0,
  events_month_reset_timestamp bigint,
  direct_intros_sent integer DEFAULT 0,
  virtual_meetings_hosted integer DEFAULT 0,
  groups_joined integer DEFAULT 0,
  groups_created integer DEFAULT 0,
  featured_portfolios_count integer DEFAULT 0,
  messages_sent_count integer DEFAULT 0,
  priority_messages_sent integer DEFAULT 0,
  profile_views_received integer DEFAULT 0,
  search_appearances integer DEFAULT 0,
  premium_features_used jsonb,
  last_tier_change_timestamp bigint,
  tier_history jsonb,
  CONSTRAINT usage_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT usage_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- Enable RLS on all affiliate tables
alter table public.affiliate_stats enable row level security;
alter table public.affiliate_tiers enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_payouts enable row level security;
alter table public.affiliate_clicks enable row level security;

-- Enable RLS on group related tables
alter table public.group_messages enable row level security;
alter table public.group_events enable row level security;
alter table public.group_event_rsvps enable row level security;

-- Create function to log user actions
create or replace function log_user_action(user_id uuid, action text, details jsonb default null)
returns void as $$
begin
  insert into public.audit_log (user_id, action, details)
  values (user_id, action, details);
end;
$$ language plpgsql security definer;

-- Create function to get user tier settings
create or replace function get_user_tier_settings(p_user_id uuid)
returns jsonb as $$
declare
  user_tier text;
  settings jsonb;
begin
  -- Get user's membership tier
  select membership_tier into user_tier
  from public.users
  where id = p_user_id;
  
  -- Return settings based on tier
  case user_tier
    when 'basic' then
      settings := jsonb_build_object(
        'daily_swipe_limit', 10,
        'daily_match_limit', 5,
        'message_sending_limit', 20,
        'can_see_who_liked_you', false,
        'can_rewind_last_swipe', false,
        'boost_duration', 0,
        'boost_frequency', 0,
        'profile_visibility_control', false,
        'priority_listing', false,
        'premium_filters_access', false,
        'global_discovery', false,
        'groups_limit', 0,
        'groups_creation_limit', 0,
        'featured_portfolio_limit', 0,
        'events_per_month', 0,
        'can_create_groups', false,
        'has_business_verification', false,
        'has_advanced_analytics', false,
        'has_priority_inbox', false,
        'can_send_direct_intro', false,
        'has_virtual_meeting_room', false,
        'has_custom_branding', false,
        'has_dedicated_support', false
      );
    when 'bronze' then
      settings := jsonb_build_object(
        'daily_swipe_limit', 10,
        'daily_match_limit', 5,
        'message_sending_limit', 20,
        'can_see_who_liked_you', false,
        'can_rewind_last_swipe', false,
        'boost_duration', 0,
        'boost_frequency', 0,
        'profile_visibility_control', false,
        'priority_listing', false,
        'premium_filters_access', false,
        'global_discovery', false,
        'groups_limit', 0,
        'groups_creation_limit', 0,
        'featured_portfolio_limit', 0,
        'events_per_month', 0,
        'can_create_groups', false,
        'has_business_verification', false,
        'has_advanced_analytics', false,
        'has_priority_inbox', false,
        'can_send_direct_intro', false,
        'has_virtual_meeting_room', false,
        'has_custom_branding', false,
        'has_dedicated_support', false
      );
    when 'silver' then
      settings := jsonb_build_object(
        'daily_swipe_limit', 30,
        'daily_match_limit', 15,
        'message_sending_limit', 50,
        'can_see_who_liked_you', true,
        'can_rewind_last_swipe', true,
        'boost_duration', 30,
        'boost_frequency', 1,
        'profile_visibility_control', true,
        'priority_listing', false,
        'premium_filters_access', true,
        'global_discovery', false,
        'groups_limit', 3,
        'groups_creation_limit', 1,
        'featured_portfolio_limit', 3,
        'events_per_month', 2,
        'can_create_groups', true,
        'has_business_verification', false,
        'has_advanced_analytics', false,
        'has_priority_inbox', false,
        'can_send_direct_intro', false,
        'has_virtual_meeting_room', false,
        'has_custom_branding', false,
        'has_dedicated_support', false
      );
    when 'gold' then
      settings := jsonb_build_object(
        'daily_swipe_limit', 100,
        'daily_match_limit', 50,
        'message_sending_limit', 200,
        'can_see_who_liked_you', true,
        'can_rewind_last_swipe', true,
        'boost_duration', 60,
        'boost_frequency', 3,
        'profile_visibility_control', true,
        'priority_listing', true,
        'premium_filters_access', true,
        'global_discovery', true,
        'groups_limit', 10,
        'groups_creation_limit', 5,
        'featured_portfolio_limit', 10,
        'events_per_month', 10,
        'can_create_groups', true,
        'has_business_verification', true,
        'has_advanced_analytics', true,
        'has_priority_inbox', true,
        'can_send_direct_intro', true,
        'has_virtual_meeting_room', true,
        'has_custom_branding', true,
        'has_dedicated_support', true
      );
    else
      settings := jsonb_build_object(
        'daily_swipe_limit', 10,
        'daily_match_limit', 5,
        'message_sending_limit', 20,
        'can_see_who_liked_you', false,
        'can_rewind_last_swipe', false,
        'boost_duration', 0,
        'boost_frequency', 0,
        'profile_visibility_control', false,
        'priority_listing', false,
        'premium_filters_access', false,
        'global_discovery', false,
        'groups_limit', 0,
        'groups_creation_limit', 0,
        'featured_portfolio_limit', 0,
        'events_per_month', 0,
        'can_create_groups', false,
        'has_business_verification', false,
        'has_advanced_analytics', false,
        'has_priority_inbox', false,
        'can_send_direct_intro', false,
        'has_virtual_meeting_room', false,
        'has_custom_branding', false,
        'has_dedicated_support', false
      );
  end case;
  
  return settings;
end;
$$ language plpgsql security definer;

-- Create function to check and enforce swipe/match limits
create or replace function check_user_limits(user_id uuid, action_type text)
returns jsonb as $$
declare
  today_timestamp bigint;
  daily_swipe_limit integer;
  daily_match_limit integer;
  today_swipe_count integer;
  today_match_count integer;
  user_tier_settings jsonb;
  is_allowed boolean;
begin
  -- Get today's timestamp for limit checks
  today_timestamp := extract(epoch from (current_date)) * 1000;
  
  -- Get user's tier settings
  select get_user_tier_settings(user_id) into user_tier_settings;
  daily_swipe_limit := (user_tier_settings->>'daily_swipe_limit')::integer;
  daily_match_limit := (user_tier_settings->>'daily_match_limit')::integer;
  
  -- Count today's swipes for the user
  select count(*) into today_swipe_count
  from public.likes
  where liker_id = user_id
  and timestamp >= today_timestamp;
  
  -- Count today's matches for the user
  select count(*) into today_match_count
  from public.matches
  where user_id = user_id
  and created_at >= today_timestamp;
  
  -- Determine if the action is allowed based on type
  if action_type = 'swipe' then
    is_allowed := today_swipe_count < daily_swipe_limit;
  elsif action_type = 'match' then
    is_allowed := today_match_count < daily_match_limit;
  else
    is_allowed := false;
  end if;
  
  -- Return the result with current usage stats
  return jsonb_build_object(
    'is_allowed', is_allowed,
    'action_type', action_type,
    'current_swipe_count', today_swipe_count,
    'swipe_limit', daily_swipe_limit,
    'current_match_count', today_match_count,
    'match_limit', daily_match_limit
  );
end;
$$ language plpgsql security definer;

-- Create stored procedure to process swipe batch
create or replace function process_swipe_batch(p_swipe_actions jsonb)
returns jsonb as $$
declare
  v_swiper_id uuid;
  v_swipee_id uuid;
  v_direction text;
  v_timestamp bigint;
  v_limit_check jsonb;
  v_new_matches jsonb[] = '{}';
  v_processed_swipes jsonb[] = '{}';
  v_swipe_action jsonb;
  v_match_result jsonb;
  v_existing_like jsonb;
  v_new_match_id uuid;
  v_swipe_count integer = 0;
  v_match_count integer = 0;
  v_swipe_limit integer;
  v_match_limit integer;
begin
  -- Loop through each swipe action in the array
  for v_swipe_action in select jsonb_array_elements(p_swipe_actions)
  loop
    -- Extract swipe action details
    v_swiper_id := (v_swipe_action->>'swiper_id')::uuid;
    v_swipee_id := (v_swipe_action->>'swipee_id')::uuid;
    v_direction := (v_swipe_action->>'direction')::text;
    v_timestamp := (v_swipe_action->>'swipe_timestamp')::bigint;

    -- Check swipe limits for the user
    select check_user_limits(v_swiper_id, 'swipe') into v_limit_check;
    v_swipe_limit := (v_limit_check->>'swipe_limit')::integer;
    v_match_limit := (v_limit_check->>'match_limit')::integer;

    -- Only process if swipe is allowed
    if (v_limit_check->>'is_allowed')::boolean then
      -- Record the swipe in likes table
      insert into public.likes (liker_id, liked_id, timestamp)
      values (v_swiper_id, v_swipee_id, v_timestamp);

      -- Increment swipe count for usage tracking
      v_swipe_count := v_swipe_count + 1;

      -- If it's a right swipe (like), check for mutual like
      if v_direction = 'right' then
        -- Check if the swipee has liked the swiper
        select jsonb_build_object('exists', true, 'liked_id', liked_id)
        into v_existing_like
        from public.likes
        where liker_id = v_swipee_id and liked_id = v_swiper_id
        limit 1;

        -- If mutual like found, create a match if within limits
        if v_existing_like->>'exists' = 'true' then
          select check_user_limits(v_swiper_id, 'match') into v_limit_check;
          if (v_limit_check->>'is_allowed')::boolean then
            -- Create a new match
            insert into public.matches (user_id, matched_user_id, created_at)
            values (v_swiper_id, v_swipee_id, v_timestamp)
            returning id into v_new_match_id;

            -- Increment match count for usage tracking
            v_match_count := v_match_count + 1;

            -- Add to new matches array
            v_match_result := jsonb_build_object(
              'match_id', v_new_match_id,
              'user_id', v_swiper_id,
              'matched_user_id', v_swipee_id,
              'created_at', v_timestamp
            );
            v_new_matches := array_append(v_new_matches, v_match_result);
          end if;
        end if;
      end if;

      -- Add processed swipe to array
      v_processed_swipes := array_append(v_processed_swipes, v_swipe_action);
    end if;
  end loop;

  -- Update usage tracking for swipes and matches
  if v_swipe_count > 0 then
    insert into public.usage_tracking (user_id, action_type, first_action_timestamp, last_action_timestamp, current_count, reset_timestamp)
    values (v_swiper_id, 'swipe', extract(epoch from now()) * 1000, extract(epoch from now()) * 1000, v_swipe_count, extract(epoch from (current_date + interval '1 day')) * 1000)
    on conflict (user_id, action_type) do update
    set current_count = usage_tracking.current_count + v_swipe_count,
        last_action_timestamp = extract(epoch from now()) * 1000;
  end if;

  if v_match_count > 0 then
    insert into public.usage_tracking (user_id, action_type, first_action_timestamp, last_action_timestamp, current_count, reset_timestamp)
    values (v_swiper_id, 'match', extract(epoch from now()) * 1000, extract(epoch from now()) * 1000, v_match_count, extract(epoch from (current_date + interval '1 day')) * 1000)
    on conflict (user_id, action_type) do update
    set current_count = usage_tracking.current_count + v_match_count,
        last_action_timestamp = extract(epoch from now()) * 1000;
  end if;

  -- Return results with processed swipes and any new matches
  return jsonb_build_object(
    'processed_swipes', v_processed_swipes,
    'new_matches', v_new_matches,
    'swipe_limit', v_swipe_limit,
    'match_limit', v_match_limit,
    'swipe_count', v_swipe_count,
    'match_count', v_match_count
  );
end;
$$ language plpgsql security definer;

-- Create stored procedure to fetch potential matches
create or replace function fetch_potential_matches(p_user_id uuid, p_max_distance integer, p_is_global_discovery boolean, p_limit integer default 25)
returns jsonb as $$
declare
  v_user jsonb;
  v_user_lat double precision;
  v_user_lon double precision;
  v_potential_matches jsonb[] = '{}';
  v_liked_ids uuid[];
  v_matched_ids uuid[];
  v_match jsonb;
begin
  -- Get user data for location and preferences
  select jsonb_build_object(
    'latitude', latitude,
    'longitude', longitude,
    'business_field', business_field,
    'looking_for', looking_for
  ) into v_user
  from public.users
  where id = p_user_id;

  v_user_lat := (v_user->>'latitude')::double precision;
  v_user_lon := (v_user->>'longitude')::double precision;

  -- Get IDs of users already liked by the current user
  select array_agg(liked_id) into v_liked_ids
  from public.likes
  where liker_id = p_user_id;

  -- Get IDs of users already matched with the current user
  select array_agg(matched_user_id) into v_matched_ids
  from public.matches
  where user_id = p_user_id
  union
  select array_agg(user_id)
  from public.matches
  where matched_user_id = p_user_id;

  -- Fetch potential matches
  for v_match in
    select jsonb_build_object(
      'id', u.id,
      'name', u.name,
      'bio', u.bio,
      'location', u.location,
      'zip_code', u.zip_code,
      'latitude', u.latitude,
      'longitude', u.longitude,
      'business_field', u.business_field,
      'entrepreneur_status', u.entrepreneur_status,
      'photo_url', u.photo_url,
      'membership_tier', u.membership_tier,
      'business_verified', u.business_verified,
      'created_at', u.created_at,
      'skills_offered', u.skills_offered,
      'skills_seeking', u.skills_seeking,
      'industry_focus', u.industry_focus,
      'business_stage', u.business_stage,
      'looking_for', u.looking_for,
      'availability_level', u.availability_level,
      'distance', case
        when p_is_global_discovery or u.latitude is null or u.longitude is null or v_user_lat is null or v_user_lon is null then null
        else round((
          6371 * acos(
            cos(radians(v_user_lat)) * cos(radians(u.latitude)) * cos(radians(u.longitude) - radians(v_user_lon)) +
            sin(radians(v_user_lat)) * sin(radians(u.latitude))
          )
        )::numeric, 2)
      end
    ) as match_data
    from public.users u
    where u.id != p_user_id
    and (v_liked_ids is null or u.id != any(v_liked_ids))
    and (v_matched_ids is null or u.id != any(v_matched_ids))
    and (p_is_global_discovery or (
      u.latitude is not null and u.longitude is not null and
      v_user_lat is not null and v_user_lon is not null and
      (
        6371 * acos(
          cos(radians(v_user_lat)) * cos(radians(u.latitude)) * cos(radians(u.longitude) - radians(v_user_lon)) +
          sin(radians(v_user_lat)) * sin(radians(u.latitude))
        )
      ) <= p_max_distance
    ))
    order by
      case when p_is_global_discovery then random() end,
      case when not p_is_global_discovery then
        6371 * acos(
          cos(radians(v_user_lat)) * cos(radians(u.latitude)) * cos(radians(u.longitude) - radians(v_user_lon)) +
          sin(radians(v_user_lat)) * sin(radians(u.latitude))
        )
      end asc,
      u.created_at desc
    limit p_limit
  loop
    v_potential_matches := array_append(v_potential_matches, v_match);
  end loop;

  -- Log the action
  perform log_user_action(p_user_id, 'fetch_potential_matches', jsonb_build_object(
    'count', array_length(v_potential_matches, 1),
    'max_distance', p_max_distance,
    'global_discovery', p_is_global_discovery
  ));

  -- Return the potential matches
  return jsonb_build_object(
    'matches', v_potential_matches,
    'count', array_length(v_potential_matches, 1),
    'max_distance', p_max_distance,
    'is_global', p_is_global_discovery
  );
end;
$$ language plpgsql security definer;

-- Create function to sync usage counters
create or replace function sync_usage_counters(p_user_id uuid)
returns jsonb as $$
declare
  v_today_timestamp bigint;
  v_swipe_count integer = 0;
  v_match_count integer = 0;
  v_user_tier_settings jsonb;
  v_swipe_limit integer;
  v_match_limit integer;
begin
  -- Get today's timestamp for counting
  v_today_timestamp := extract(epoch from (current_date)) * 1000;
  
  -- Get user's tier settings
  select get_user_tier_settings(p_user_id) into v_user_tier_settings;
  v_swipe_limit := (v_user_tier_settings->>'daily_swipe_limit')::integer;
  v_match_limit := (v_user_tier_settings->>'daily_match_limit')::integer;
  
  -- Count today's swipes
  select count(*) into v_swipe_count
  from public.likes
  where liker_id = p_user_id
  and timestamp >= v_today_timestamp;
  
  -- Count today's matches
  select count(*) into v_match_count
  from public.matches
  where user_id = p_user_id
  and created_at >= v_today_timestamp;
  
  -- Log the action
  perform log_user_action(p_user_id, 'sync_usage_counters', jsonb_build_object(
    'swipe_count', v_swipe_count,
    'match_count', v_match_count
  ));
  
  -- Return current usage stats
  return jsonb_build_object(
    'swipe_count', v_swipe_count,
    'match_count', v_match_count,
    'swipe_limit', v_swipe_limit,
    'match_limit', v_match_limit,
    'swipe_remaining', greatest(0, v_swipe_limit - v_swipe_count),
    'match_remaining', greatest(0, v_match_limit - v_match_count),
    'timestamp', extract(epoch from now()) * 1000
  );
end;
$$ language plpgsql security definer;

-- Create indexes for performance optimization
create index if not exists idx_likes_liker_id_timestamp on public.likes (liker_id, timestamp);
create index if not exists idx_likes_liked_id on public.likes (liked_id);
create index if not exists idx_matches_user_id_created_at on public.matches (user_id, created_at);
create index if not exists idx_matches_matched_user_id on public.matches (matched_user_id);
create index if not exists idx_users_location on public.users (latitude, longitude);
create index if not exists idx_group_messages_group_id_created_at on public.group_messages (group_id, created_at);
create index if not exists idx_group_events_group_id_start_time on public.group_events (group_id, start_time);

-- Create RLS policies

-- Users table policies
create policy "Users can view all profiles"
  on public.users for select
  using (true);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Only authenticated users can insert"
  on public.users for insert
  with check (auth.role() = 'authenticated');

-- Matches table policies
create policy "Users can view their own matches"
  on public.matches for select
  using (auth.uid() = user_id or auth.uid() = matched_user_id);

create policy "Users can create matches"
  on public.matches for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own matches"
  on public.matches for update
  using (auth.uid() = user_id or auth.uid() = matched_user_id);

-- Messages table policies
create policy "Users can view messages in their conversations"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Users can update their own messages"
  on public.messages for update
  using (auth.uid() = sender_id);

-- Groups table policies
create policy "Anyone can view groups"
  on public.groups for select
  using (true);

create policy "Users can create groups"
  on public.groups for insert
  with check (auth.uid() = created_by);

create policy "Group creators can update their groups"
  on public.groups for update
  using (auth.uid() = created_by);

-- Group messages policies
create policy "Group members can view messages"
  on public.group_messages for select
  using (
    exists (
      select 1 from public.groups
      where groups.id = group_messages.group_id
      and auth.uid() = ANY(groups.member_ids)
    )
  );

create policy "Only group creators can send messages"
  on public.group_messages for insert
  with check (
    exists (
      select 1 from public.groups
      where groups.id = group_messages.group_id
      and groups.created_by = auth.uid()
    )
  );

-- Group events policies
create policy "Group members can view events"
  on public.group_events for select
  using (
    exists (
      select 1 from public.groups
      where groups.id = group_events.group_id
      and auth.uid() = ANY(groups.member_ids)
    )
  );

create policy "Only group creators can create events"
  on public.group_events for insert
  with check (
    exists (
      select 1 from public.groups
      where groups.id = group_events.group_id
      and groups.created_by = auth.uid()
    )
  );

create policy "Only group creators can update events"
  on public.group_events for update
  using (
    exists (
      select 1 from public.groups
      where groups.id = group_events.group_id
      and groups.created_by = auth.uid()
    )
  );

-- Group event RSVPs policies
create policy "Users can view their own RSVPs"
  on public.group_event_rsvps for select
  using (auth.uid() = user_id);

create policy "Group members can RSVP to events"
  on public.group_event_rsvps for insert
  with check (
    exists (
      select 1 from public.group_events
      join public.groups on group_events.group_id = groups.id
      where group_events.id = group_event_rsvps.event_id
      and auth.uid() = ANY(groups.member_ids)
    )
  );

create policy "Users can update their own RSVPs"
  on public.group_event_rsvps for update
  using (auth.uid() = user_id);

-- Likes table policies
create policy "Users can view likes they've given or received"
  on public.likes for select
  using (auth.uid() = liker_id or auth.uid() = liked_id);

create policy "Users can create likes"
  on public.likes for insert
  with check (auth.uid() = liker_id);

-- Portfolio items policies
create policy "Anyone can view portfolio items"
  on public.portfolio_items for select
  using (true);

create policy "Users can create their own portfolio items"
  on public.portfolio_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own portfolio items"
  on public.portfolio_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own portfolio items"
  on public.portfolio_items for delete
  using (auth.uid() = user_id);

-- Audit log policies
create policy "Users can view their own audit logs"
  on public.audit_log for select
  using (auth.uid() = user_id);

-- App settings policies
create policy "Anyone can view app settings"
  on public.app_settings for select
  using (true);

-- Affiliate tiers policies
create policy "Anyone can view affiliate tiers"
  on public.affiliate_tiers for select
  using (true);

create policy "Only admins can update affiliate tiers"
  on public.affiliate_tiers for update
  using (auth.role() = 'service_role');

create policy "Only admins can insert affiliate tiers"
  on public.affiliate_tiers for insert
  with check (auth.role() = 'service_role');

-- Affiliate stats policies
create policy "Users can view their own affiliate stats"
  on public.affiliate_stats for select
  using (auth.uid() = user_id);

create policy "System can update affiliate stats"
  on public.affiliate_stats for update
  using (auth.uid() = user_id);

create policy "System can create affiliate stats"
  on public.affiliate_stats for insert
  with check (auth.uid() = user_id);

-- Affiliate links policies
create policy "Users can view their own affiliate links"
  on public.affiliate_links for select
  using (auth.uid() = user_id);

create policy "Users can create their own affiliate links"
  on public.affiliate_links for insert
  with check (auth.uid() = user_id);

-- Affiliate referrals policies
create policy "Users can view their own referrals"
  on public.affiliate_referrals for select
  using (auth.uid() = referrer_id);

create policy "System can create referrals during signup"
  on public.affiliate_referrals for insert
  with check (auth.role() = 'service_role' or auth.role() = 'authenticated');

-- Affiliate payouts policies
create policy "Users can view their own payouts"
  on public.affiliate_payouts for select
  using (auth.uid() = affiliate_id);

create policy "Only system or admins can create or update payouts"
  on public.affiliate_payouts for insert
  with check (auth.role() = 'service_role');

create policy "Only system or admins can update payouts"
  on public.affiliate_payouts for update
  using (auth.role() = 'service_role');

-- Affiliate clicks policies
create policy "Users can view clicks on their links"
  on public.affiliate_clicks for select
  using (
    exists (
      select 1 from public.affiliate_links
      where affiliate_links.id = affiliate_clicks.link_id
      and affiliate_links.user_id = auth.uid()
    )
  );

create policy "System can create click records"
  on public.affiliate_clicks for insert
  with check (true);