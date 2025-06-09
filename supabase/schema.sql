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

-- Create function to log user actions
create or replace function log_user_action(user_id uuid, action text, details jsonb default null)
returns void as $$
begin
  insert into public.audit_log (user_id, action, details)
  values (user_id, action, details);
end;
$$ language plpgsql security definer;

-- Create function to get user tier settings
create or replace function get_user_tier_settings(user_id uuid)
returns jsonb as $$
declare
  user_tier text;
  settings jsonb;
begin
  -- Get user's membership tier
  select membership_tier into user_tier
  from public.users
  where id = user_id;
  
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
        'global_discovery', false
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
        'global_discovery', false
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
        'global_discovery', false
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
        'global_discovery', true
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
        'global_discovery', false
      );
  end case;
  
  return settings;
end;
$$ language plpgsql security definer;

-- Create function to find users within distance
create or replace function find_users_within_distance(user_id uuid, max_distance integer, global_search boolean default false)
returns table (
  id uuid,
  email text,
  name text,
  bio text,
  location text,
  zip_code text,
  business_field text,
  entrepreneur_status text,
  photo_url text,
  membership_tier text,
  business_verified boolean,
  joined_groups uuid[],
  created_at bigint,
  skills_offered text[],
  skills_seeking text[],
  industry_focus text,
  business_stage text,
  key_challenge text,
  availability_level text[],
  timezone text,
  success_highlight text,
  looking_for text[]
) as $$
begin
  if global_search then
    -- Return all users except the input user
    return query
    select 
      u.id, u.email, u.name, u.bio, u.location, u.zip_code, 
      u.business_field, u.entrepreneur_status, u.photo_url, 
      u.membership_tier, u.business_verified, u.joined_groups, 
      u.created_at, u.skills_offered, u.skills_seeking, 
      u.industry_focus, u.business_stage, u.key_challenge, 
      u.availability_level, u.timezone, u.success_highlight, 
      u.looking_for
    from public.users u
    where u.id != user_id;
  else
    -- Return users within max_distance (mocked based on zip code)
    return query
    select 
      u.id, u.email, u.name, u.bio, u.location, u.zip_code, 
      u.business_field, u.entrepreneur_status, u.photo_url, 
      u.membership_tier, u.business_verified, u.joined_groups, 
      u.created_at, u.skills_offered, u.skills_seeking, 
      u.industry_focus, u.business_stage, u.key_challenge, 
      u.availability_level, u.timezone, u.success_highlight, 
      u.looking_for
    from public.users u
    where u.id != user_id
    and u.zip_code is not null;
    -- In a real implementation, this would use geospatial data
    -- For now, we're just returning users with zip codes as a mock
  end if;
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