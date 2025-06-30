-- Check user roles in the database
SELECT 
  id,
  email,
  role,
  membership_tier
FROM public.users
WHERE role IS NOT NULL; 