-- SQL script to find and create matches from existing mutual likes
WITH mutual_likes AS (
  -- Find all mutual likes that don't have matches yet
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
RETURNING id, user_id, matched_user_id; 