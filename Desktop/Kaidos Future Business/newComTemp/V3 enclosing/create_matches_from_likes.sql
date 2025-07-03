-- SQL script to create matches from existing mutual likes
-- This script finds all mutual likes that don't have matches yet and creates matches

-- First, let's see what mutual likes exist without matches
WITH mutual_likes AS (
  SELECT 
    l1.liker_id as user_id,
    l1.liked_id as matched_user_id,
    GREATEST(l1.timestamp, l2.timestamp) as created_at,
    l1.timestamp as user_like_timestamp,
    l2.timestamp as matched_user_like_timestamp
  FROM public.likes l1
  JOIN public.likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
  LEFT JOIN public.matches m ON 
    (m.user_id = l1.liker_id AND m.matched_user_id = l1.liked_id)
    OR (m.user_id = l1.liked_id AND m.matched_user_id = l1.liker_id)
  WHERE m.id IS NULL -- Only get likes without existing matches
)
-- Show what would be created (run this first to preview)
SELECT 
  'Preview - Would create matches for:' as action,
  COUNT(*) as total_matches_to_create,
  jsonb_agg(
    jsonb_build_object(
      'user_id', user_id,
      'matched_user_id', matched_user_id,
      'created_at', created_at,
      'user_like_time', to_timestamp(user_like_timestamp / 1000),
      'matched_user_like_time', to_timestamp(matched_user_like_timestamp / 1000)
    )
  ) as matches_details
FROM mutual_likes;

-- Now create the actual matches
WITH mutual_likes AS (
  SELECT 
    l1.liker_id as user_id,
    l1.liked_id as matched_user_id,
    GREATEST(l1.timestamp, l2.timestamp) as created_at
  FROM public.likes l1
  JOIN public.likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
  LEFT JOIN public.matches m ON 
    (m.user_id = l1.liker_id AND m.matched_user_id = l1.liked_id)
    OR (m.user_id = l1.liked_id AND m.matched_user_id = l1.liker_id)
  WHERE m.id IS NULL -- Only get likes without existing matches
)
INSERT INTO public.matches (user_id, matched_user_id, created_at)
SELECT 
  user_id,
  matched_user_id,
  created_at
FROM mutual_likes
RETURNING 
  id, 
  user_id, 
  matched_user_id, 
  created_at,
  to_timestamp(created_at / 1000) as created_at_readable;

-- Verify the matches were created
SELECT 
  'Verification - Total matches now:' as status,
  COUNT(*) as total_matches
FROM public.matches;

-- Show recent matches
SELECT 
  'Recent matches:' as info,
  m.id,
  u1.name as user_name,
  u2.name as matched_user_name,
  to_timestamp(m.created_at / 1000) as match_created_at
FROM public.matches m
JOIN public.users u1 ON m.user_id = u1.id
JOIN public.users u2 ON m.matched_user_id = u2.id
ORDER BY m.created_at DESC
LIMIT 10; 