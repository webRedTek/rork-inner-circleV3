-- Check current likes and potential matches
WITH mutual_likes AS (
  SELECT 
    l1.liker_id,
    l1.liked_id,
    CASE 
      WHEN m.id IS NOT NULL THEN 'Has Match'
      ELSE 'No Match'
    END as match_status
  FROM public.likes l1
  JOIN public.likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
  LEFT JOIN public.matches m ON 
    (m.user_id = l1.liker_id AND m.matched_user_id = l1.liked_id)
    OR (m.user_id = l1.liked_id AND m.matched_user_id = l1.liker_id)
)
SELECT 
  (SELECT COUNT(*) FROM public.likes) as total_likes,
  (SELECT COUNT(*) FROM mutual_likes) as mutual_likes_count,
  (SELECT COUNT(*) FROM mutual_likes WHERE match_status = 'Has Match') as matched_count,
  (SELECT COUNT(*) FROM mutual_likes WHERE match_status = 'No Match') as unmatched_count,
  (SELECT COUNT(*) FROM public.matches) as total_matches; 