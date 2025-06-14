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