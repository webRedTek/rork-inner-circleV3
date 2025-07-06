-- Remove handle_user_usage function since it's not being used in the app
-- This function was available but not actively utilized

-- Drop the function
DROP FUNCTION IF EXISTS handle_user_usage(uuid, text, integer, jsonb);

-- Also remove the batchUpdateUsage function from lib/supabase.ts since it's not used
-- Note: This migration only removes the database function
-- The TypeScript function in lib/supabase.ts should be removed separately
