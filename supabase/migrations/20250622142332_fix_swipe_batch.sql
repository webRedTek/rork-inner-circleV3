/**
 * MIGRATION: Fix process_swipe_batch function
 * LAST UPDATED: 2024-03-22
 * 
 * CHANGES:
 * 1. Updates process_swipe_batch to get tier settings directly from app_settings table
 * 2. Removes dependency on the deleted get_user_tier_settings function
 * 
 * DEPENDENCIES:
 * - Requires app_settings table to exist and be populated
 * - Requires check_user_limits function to exist
 */

-- Update process_swipe_batch to use app_settings directly
CREATE OR REPLACE FUNCTION process_swipe_batch(p_swipe_actions jsonb)
RETURNS jsonb AS $$
DECLARE
  action jsonb;
  user_id uuid;
  target_user_id uuid;
  action_type text;
  user_tier text;
  tier_settings jsonb;
  result jsonb := '[]'::jsonb;
  action_result jsonb;
BEGIN
  -- Process each swipe action
  FOR action IN SELECT * FROM jsonb_array_elements(p_swipe_actions)
  LOOP
    user_id := (action->>'user_id')::uuid;
    target_user_id := (action->>'target_user_id')::uuid;
    action_type := action->>'action_type';
    
    -- Get user's membership tier
    SELECT membership_tier INTO user_tier
    FROM public.users
    WHERE id = user_id;
    
    -- Get tier settings from app_settings table
    SELECT row_to_json(s)::jsonb INTO tier_settings
    FROM app_settings s
    WHERE s.tier = user_tier;
    
    -- If no settings found, use bronze tier as fallback
    IF tier_settings IS NULL THEN
      SELECT row_to_json(s)::jsonb INTO tier_settings
      FROM app_settings s
      WHERE s.tier = 'bronze';
    END IF;
    
    -- Check user limits using the tier settings
    SELECT check_user_limits(user_id, action_type, tier_settings) INTO action_result;
    
    -- Add result to the array
    result := result || action_result;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql; 