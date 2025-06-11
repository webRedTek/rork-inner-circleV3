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
  looking_for text[],
  distance double precision
) as $$
begin
  if global_search then
    -- Return all users except the input user, excluding liked/matched users
    return query
    select 
      u.id, u.email, u.name, u.bio, u.location, u.zip_code, 
      u.business_field, u.entrepreneur_status, u.photo_url, 
      u.membership_tier, u.business_verified, u.joined_groups, 
      u.created_at, u.skills_offered, u.skills_seeking, 
      u.industry_focus, u.business_stage, u.key_challenge, 
      u.availability_level, u.timezone, u.success_highlight, 
      u.looking_for,
      0.0 as distance
    from public.users u
    where u.id != user_id
    and u.id not in (
      select liked_id from public.likes where liker_id = user_id
    )
    and u.id not in (
      select matched_user_id from public.matches where user_id = user_id
    )
    and u.id not in (
      select user_id from public.matches where matched_user_id = user_id
    )
    order by random()
    limit 50;
  else
    -- Return users within max_distance using geospatial data, excluding liked/matched users
    return query
    select 
      u.id, u.email, u.name, u.bio, u.location, u.zip_code, 
      u.business_field, u.entrepreneur_status, u.photo_url, 
      u.membership_tier, u.business_verified, u.joined_groups, 
      u.created_at, u.skills_offered, u.skills_seeking, 
      u.industry_focus, u.business_stage, u.key_challenge, 
      u.availability_level, u.timezone, u.success_highlight, 
      u.looking_for,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(u.longitude, u.latitude), 4326),
        ST_SetSRID(ST_MakePoint((select longitude from public.users where id = user_id), (select latitude from public.users where id = user_id)), 4326)
      ) / 1000 as distance -- Distance in kilometers
    from public.users u
    where u.id != user_id
    and u.latitude is not null
    and u.longitude is not null
    and (u.location_privacy = 'public' or u.location_privacy = 'matches_only')
    and u.id not in (
      select liked_id from public.likes where liker_id = user_id
    )
    and u.id not in (
      select matched_user_id from public.matches where user_id = user_id
    )
    and u.id not in (
      select user_id from public.matches where matched_user_id = user_id
    )
    and ST_DWithin(
      ST_SetSRID(ST_MakePoint(u.longitude, u.latitude), 4326),
      ST_SetSRID(ST_MakePoint((select longitude from public.users where id = user_id), (select latitude from public.users where id = user_id)), 4326),
      max_distance * 1000 -- Convert km to meters
    )
    order by distance
    limit 50;
  end if;
end;
$$ language plpgsql security definer;

-- Create function to process batch swipes
create type public.swipe_action as (
  swiper_id uuid,
  swipee_id uuid,
  direction text,
  swipe_timestamp bigint
);

create or replace function process_batch_swipes(swipes swipe_action[])
returns table (
  match_id uuid,
  user_id uuid,
  matched_user_id uuid,
  created_at bigint
) as $$
declare
  swipe swipe_action;
  today_timestamp bigint;
  daily_swipe_limit integer;
  daily_match_limit integer;
  today_swipe_count integer;
  today_match_count integer;
  user_tier_settings jsonb;
  new_match_id uuid;
begin
  -- Get today's timestamp for limit checks
  today_timestamp := extract(epoch from (current_date)) * 1000;
  
  -- Check if the array is empty
  if array_length(swipes, 1) is null or array_length(swipes, 1) = 0 then
    return;
  end if;
  
  -- Get the swiper_id from the first swipe action (assuming all swipes are from the same user)
  -- In a real app, you might want to validate that all swiper_ids are the same
  select swipes[1].swiper_id into swipe.swiper_id;
  
  -- Get user's tier settings
  select get_user_tier_settings(swipe.swiper_id) into user_tier_settings;
  daily_swipe_limit := (user_tier_settings->>'daily_swipe_limit')::integer;
  daily_match_limit := (user_tier_settings->>'daily_match_limit')::integer;
  
  -- Count today's swipes for the user
  select count(*) into today_swipe_count
  from public.likes
  where liker_id = swipe.swiper_id
  and timestamp >= today_timestamp;
  
  -- Count today's matches for the user
  select count(*) into today_match_count
  from public.matches
  where user_id = swipe.swiper_id
  and created_at >= today_timestamp;
  
  -- Check if user has already exceeded swipe limit (allowing for some buffer)
  if today_swipe_count >= daily_swipe_limit + array_length(swipes, 1) then
    -- Log the limit reached
    perform log_user_action(
      swipe.swiper_id,
      'swipe_limit_reached_batch',
      jsonb_build_object('attempted_swipes', array_length(swipes, 1))
    );
    return;
  end if;
  
  -- Process each swipe in the batch
  foreach swipe in array swipes
  loop
    -- Only process if within swipe limit (including current batch)
    if today_swipe_count < daily_swipe_limit then
      -- Only record right swipes as likes
      if swipe.direction = 'right' then
        -- Insert into likes table
        insert into public.likes (liker_id, liked_id, timestamp)
        values (swipe.swiper_id, swipe.swipee_id, swipe.swipe_timestamp)
        on conflict (liker_id, liked_id) do nothing;
        
        -- Increment swipe count
        today_swipe_count := today_swipe_count + 1;
        
        -- Log the swipe
        perform log_user_action(
          swipe.swiper_id,
          'batch_swipe_right',
          jsonb_build_object('swipee_id', swipe.swipee_id)
        );
        
        -- Check for reciprocal like (match)
        if exists (
          select 1
          from public.likes
          where liker_id = swipe.swipee_id
          and liked_id = swipe.swiper_id
        ) then
          -- Check match limit
          if today_match_count < daily_match_limit then
            -- Create a match
            new_match_id := uuid_generate_v4();
            insert into public.matches (id, user_id, matched_user_id, created_at)
            values (new_match_id, swipe.swiper_id, swipe.swipee_id, swipe.swipe_timestamp)
            on conflict (user_id, matched_user_id) do nothing
            returning id into new_match_id;
            
            -- If a new match was created, increment count and return it
            if new_match_id is not null then
              today_match_count := today_match_count + 1;
              return query
              select 
                new_match_id as match_id, 
                swipe.swiper_id as user_id, 
                swipe.swipee_id as matched_user_id,
                swipe.swipe_timestamp as created_at;
                
              -- Log the match
              perform log_user_action(
                swipe.swiper_id,
                'batch_match_created',
                jsonb_build_object('matched_user_id', swipe.swipee_id)
              );
            end if;
          else
            -- Log match limit reached
            perform log_user_action(
              swipe.swiper_id,
              'match_limit_reached_batch',
              jsonb_build_object('attempted_match_with', swipe.swipee_id)
            );
          end if;
        end if;
      else
        -- For left swipes (passes), just log the action
        perform log_user_action(
          swipe.swiper_id,
          'batch_swipe_left',
          jsonb_build_object('swipee_id', swipe.swipee_id)
        );
        
        -- Increment swipe count for left swipes too
        today_swipe_count := today_swipe_count + 1;
      end if;
    end if;
  end loop;
  
  return;
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