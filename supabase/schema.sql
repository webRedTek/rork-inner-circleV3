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
create table public.app_settings (
  id uuid primary key default uuid_generate_v4(),
  tier text not null,
  daily_swipe_limit integer not null,
  daily_match_limit integer not null,
  message_sending_limit integer not null,
  can_see_who_liked_you boolean not null default false,
  can_rewind_last_swipe boolean not null default false,
  boost_duration integer not null default 0,
  boost_frequency integer not null default 0,
  profile_visibility_control boolean not null default false,
  priority_listing boolean not null default false,
  premium_filters_access boolean not null default false,
  global_discovery boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create affiliate_tiers table
create table public.affiliate_tiers (
  id uuid primary key default uuid_generate_v4(),
  tier_name text not null,
  commission_rate decimal not null default 0.0,
  min_referrals integer not null default 0,
  payout_threshold decimal not null default 0.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create affiliate_links table
create table public.affiliate_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  link text not null unique,
  created_at timestamptz not null default now()
);

-- Create affiliate_referrals table
create table public.affiliate_referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referred_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',
  subscription_type text,
  earnings decimal not null default 0.0,
  signup_date timestamptz not null default now(),
  unique(referrer_id, referred_user_id)
);

-- Create affiliate_payouts table
create table public.affiliate_payouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount decimal not null,
  payout_date timestamptz not null default now(),
  status text not null default 'pending'
);

-- Create affiliate_clicks table
create table public.affiliate_clicks (
  id uuid primary key default uuid_generate_v4(),
  link_id uuid not null references public.affiliate_links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

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
  using (auth.uid() = user_id);

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