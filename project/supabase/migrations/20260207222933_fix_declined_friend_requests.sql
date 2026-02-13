/*
  # Fix Declined Friend Requests

  ## Summary
  Allows users to send new friend requests after a previous request was declined.

  ## Changes
  - Update `send_friend_request` function to handle declined friendships
  - When sending a request to someone who previously declined (or you declined), delete the old record first
  - This allows fresh friend requests to be sent

  ## Security
  - Maintains existing authentication checks
  - Only affects declined relationships, not active or pending ones
*/

-- =========================================
-- Update send_friend_request function
-- =========================================

CREATE OR REPLACE FUNCTION send_friend_request(p_addressee_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requester_id uuid;
  v_friendship_id uuid;
  v_existing_status friendship_status;
BEGIN
  v_requester_id := (select auth.uid());

  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_requester_id = p_addressee_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Check if accounts are active
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id IN (v_requester_id, p_addressee_id)
    AND account_status != 'active'
  ) THEN
    RAISE EXCEPTION 'Cannot send friend request to blocked or deleted account';
  END IF;

  -- Check for existing friendship
  SELECT status INTO v_existing_status
  FROM friendships
  WHERE (requester_id = v_requester_id AND addressee_id = p_addressee_id)
     OR (requester_id = p_addressee_id AND addressee_id = v_requester_id)
  LIMIT 1;

  -- If there's an existing friendship
  IF v_existing_status IS NOT NULL THEN
    -- If it's declined, delete it and allow a new request
    IF v_existing_status = 'declined' THEN
      DELETE FROM friendships
      WHERE (requester_id = v_requester_id AND addressee_id = p_addressee_id)
         OR (requester_id = p_addressee_id AND addressee_id = v_requester_id);
    ELSE
      -- For pending, accepted, or blocked, don't allow new request
      RAISE EXCEPTION 'Friend request already exists';
    END IF;
  END IF;

  -- Create new friendship request
  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (v_requester_id, p_addressee_id, 'pending')
  RETURNING id INTO v_friendship_id;

  RETURN v_friendship_id;
END;
$$;
