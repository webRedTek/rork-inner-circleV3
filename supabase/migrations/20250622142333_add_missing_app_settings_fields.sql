-- Fix app_settings table fields
-- The database already has most fields, but daily_like_limit needs to be NOT NULL

-- Fix daily_like_limit to be NOT NULL (it's currently nullable)
ALTER TABLE public.app_settings 
ALTER COLUMN daily_like_limit SET NOT NULL;

-- Add comments to document the fields
COMMENT ON COLUMN public.app_settings.daily_like_limit IS 'Daily limit for likes per tier';
COMMENT ON COLUMN public.app_settings.groups_creation_limit IS 'Limit for creating groups per tier';
COMMENT ON COLUMN public.app_settings.can_create_groups IS 'Whether users in this tier can create groups';
COMMENT ON COLUMN public.app_settings.trial_duration IS 'Trial duration in days for this tier'; 