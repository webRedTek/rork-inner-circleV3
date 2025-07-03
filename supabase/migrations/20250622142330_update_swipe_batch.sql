/**
 * MIGRATION: Remove get_user_tier_settings and Update process_swipe_batch
 * LAST UPDATED: 2024-03-22
 * 
 * CHANGES:
 * 1. Removes the redundant get_user_tier_settings function since tier settings are managed through the auth store
 * 2. Updates process_swipe_batch to use app_settings table directly
 * 
 * DEPENDENCIES:
 * - Requires app_settings table to exist and be populated
 * - Requires check_user_limits function to exist
 */

-- Drop the redundant get_user_tier_settings function
DROP FUNCTION IF EXISTS public.get_user_tier_settings CASCADE;

-- Update process_swipe_batch to use app_settings directly
CREATE OR REPLACE FUNCTION process_swipe_batch(p_swipe_actions jsonb)
RETURNS jsonb AS $$
/**
 * FUNCTION: process_swipe_batch
 * 
 * INITIALIZATION ORDER:
 * 1. Called by matches-store.ts when processing swipe actions
 * 2. Requires app_settings table to be initialized
 * 3. Requires check_user_limits function to be available
 * 4. Updates likes and matches tables
 * 
 * CURRENT STATE:
 * Processes a batch of swipe actions, creating likes and matches while respecting tier limits
 * 
 * FILE INTERACTIONS:
 * - Reads from: app_settings, users tables
 * - Writes to: likes, matches, user_daily_usage tables
 * - Called by: matches-store.ts processSwipeBatch function
 * 
 * KEY FUNCTIONS:
 * - Processes multiple swipes in a single transaction
 * - Checks user limits before processing
 * - Creates matches for mutual likes
 * - Updates usage tracking
 */
DECLARE
  v_swiper_id uuid;
  v_swipee_id uuid;
  v_direction text;
  v_timestamp bigint;
  v_limit_check jsonb;
  v_new_matches jsonb[] = '{}';
  v_processed_swipes jsonb[] = '{}';
  v_swipe_action jsonb;
  v_match_result jsonb;
  v_existing_like jsonb;
  v_new_match_id uuid;
  v_swipe_count integer = 0;
  v_match_count integer = 0;
  v_swipe_limit integer;
  v_match_limit integer;
BEGIN
  -- Loop through each swipe action in the array
  FOR v_swipe_action IN SELECT jsonb_array_elements(p_swipe_actions)
  LOOP
    -- Extract swipe action details
    v_swiper_id := (v_swipe_action->>'swiper_id')::uuid;
    v_swipee_id := (v_swipe_action->>'swipee_id')::uuid;
    v_direction := (v_swipe_action->>'direction')::text;
    v_timestamp := (v_swipe_action->>'swipe_timestamp')::bigint;

    -- Check swipe limits for the user
    SELECT check_user_limits(v_swiper_id, 'swipe') INTO v_limit_check;
    v_swipe_limit := (v_limit_check->>'swipe_limit')::integer;
    v_match_limit := (v_limit_check->>'match_limit')::integer;

    -- Only process if swipe is allowed
    IF (v_limit_check->>'is_allowed')::boolean THEN
      -- Record the swipe in likes table
      INSERT INTO public.likes (liker_id, liked_id, timestamp)
      VALUES (v_swiper_id, v_swipee_id, v_timestamp);

      -- Increment swipe count for usage tracking
      v_swipe_count := v_swipe_count + 1;

      -- If it's a right swipe (like), check for mutual like
      IF v_direction = 'right' THEN
        -- Check if the swipee has liked the swiper
        SELECT jsonb_build_object('exists', true, 'liked_id', liked_id)
        INTO v_existing_like
        FROM public.likes
        WHERE liker_id = v_swipee_id AND liked_id = v_swiper_id
        LIMIT 1;

        -- If mutual like found, create a match if within limits
        IF v_existing_like->>'exists' = 'true' THEN
          SELECT check_user_limits(v_swiper_id, 'match') INTO v_limit_check;
          IF (v_limit_check->>'is_allowed')::boolean THEN
            -- Create a new match
            INSERT INTO public.matches (user_id, matched_user_id, created_at)
            VALUES (v_swiper_id, v_swipee_id, v_timestamp)
            RETURNING id INTO v_new_match_id;

            -- Increment match count for usage tracking
            v_match_count := v_match_count + 1;

            -- Add to new matches array
            v_match_result := jsonb_build_object(
              'match_id', v_new_match_id,
              'user_id', v_swiper_id,
              'matched_user_id', v_swipee_id,
              'created_at', v_timestamp
            );
            v_new_matches := array_append(v_new_matches, v_match_result);
          END IF;
        END IF;
      END IF;

      -- Add processed swipe to array
      v_processed_swipes := array_append(v_processed_swipes, v_swipe_action);
    END IF;
  END LOOP;

  -- Update usage tracking for swipes and matches
  IF v_swipe_count > 0 THEN
    INSERT INTO public.user_daily_usage (user_id, swipe_count, match_count)
    VALUES (v_swiper_id, v_swipe_count, v_match_count)
    ON CONFLICT (user_id) DO UPDATE
    SET swipe_count = user_daily_usage.swipe_count + v_swipe_count,
        match_count = user_daily_usage.match_count + v_match_count;
  END IF;

  -- Return results with processed swipes and any new matches
  RETURN jsonb_build_object(
    'processed_swipes', v_processed_swipes,
    'new_matches', v_new_matches,
    'swipe_limit', v_swipe_limit,
    'match_limit', v_match_limit,
    'swipe_count', v_swipe_count,
    'match_count', v_match_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 