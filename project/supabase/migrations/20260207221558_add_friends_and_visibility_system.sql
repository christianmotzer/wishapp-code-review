/*
  # Friends and Visibility System

  ## Summary
  Adds comprehensive friend system and wish visibility controls, plus account management features.

  ## 1. New Tables
    ### `friendships`
    - `id` (uuid, primary key)
    - `requester_id` (uuid, references auth.users)
    - `addressee_id` (uuid, references auth.users)
    - `status` (enum: pending, accepted, declined, blocked)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    - Unique constraint on (requester_id, addressee_id)

  ## 2. Table Modifications
    ### `wishes` table
    - Add `visibility` column (enum: public, friends_only)
    - Default: public

    ### `user_profiles` table
    - Add `account_status` column (enum: active, blocked, deleted)
    - Default: active
    - Add `blocked_at` (timestamptz, nullable)
    - Add `blocked_by` (text, nullable, admin email)
    - Add `deleted_at` (timestamptz, nullable)

  ## 3. New Functions
    - `send_friend_request(addressee_id)` - Send friend request
    - `accept_friend_request(requester_id)` - Accept friend request
    - `decline_friend_request(requester_id)` - Decline friend request
    - `remove_friend(friend_id)` - Remove friend
    - `block_user(user_id)` - Block another user
    - `are_friends(user1_id, user2_id)` - Check friendship status
    - `get_user_friends(user_id)` - Get user's friends list
    - `admin_block_account(user_id, reason)` - Admin blocks account
    - `delete_own_account()` - User deletes their account

  ## 4. Security
    - Enable RLS on `friendships` table
    - Add policies for friend management
    - Update wishes policies for friends-only visibility
    - Add policies for account management

  ## 5. Important Notes
    - Blocked users cannot see or interact with each other
    - Deleted accounts are soft-deleted (data preserved)
    - Admins cannot delete their own accounts
    - Friends-only wishes only visible to accepted friends
    - Bidirectional friendship queries optimized with indexes
*/

-- =========================================
-- PART 1: CREATE ENUMS AND TYPES
-- =========================================

DO $$ BEGIN
  CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wish_visibility AS ENUM ('public', 'friends_only');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'blocked', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =========================================
-- PART 2: CREATE FRIENDSHIPS TABLE
-- =========================================

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT different_users CHECK (requester_id != addressee_id),
  CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id)
);

-- Create indexes for friendship queries
CREATE INDEX IF NOT EXISTS idx_friendships_requester_id ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_id ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_both_users ON friendships(requester_id, addressee_id);

-- =========================================
-- PART 3: MODIFY EXISTING TABLES
-- =========================================

-- Add visibility to wishes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wishes' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE wishes ADD COLUMN visibility wish_visibility NOT NULL DEFAULT 'public';
  END IF;
END $$;

-- Add account status to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN account_status account_status NOT NULL DEFAULT 'active';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'blocked_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN blocked_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'blocked_by'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN blocked_by text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Create index on account_status for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_status ON user_profiles(account_status);

-- =========================================
-- PART 4: HELPER FUNCTIONS
-- =========================================

-- Check if two users are friends
CREATE OR REPLACE FUNCTION are_friends(user1_id uuid, user2_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = user1_id AND addressee_id = user2_id)
      OR (requester_id = user2_id AND addressee_id = user1_id)
    )
  );
END;
$$;

-- Get user's friends
CREATE OR REPLACE FUNCTION get_user_friends(p_user_id uuid)
RETURNS TABLE (
  friend_id uuid,
  display_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN f.requester_id = p_user_id THEN f.addressee_id
      ELSE f.requester_id
    END as friend_id,
    COALESCE(up.display_name, 'Anonymous') as display_name,
    f.created_at
  FROM friendships f
  LEFT JOIN user_profiles up ON (
    CASE
      WHEN f.requester_id = p_user_id THEN f.addressee_id
      ELSE f.requester_id
    END = up.user_id
  )
  WHERE f.status = 'accepted'
  AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
  ORDER BY f.created_at DESC;
END;
$$;

-- =========================================
-- PART 5: FRIEND MANAGEMENT FUNCTIONS
-- =========================================

-- Send friend request
CREATE OR REPLACE FUNCTION send_friend_request(p_addressee_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requester_id uuid;
  v_friendship_id uuid;
BEGIN
  v_requester_id := (select auth.uid());

  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_requester_id = p_addressee_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Check if friendship already exists
  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE (requester_id = v_requester_id AND addressee_id = p_addressee_id)
       OR (requester_id = p_addressee_id AND addressee_id = v_requester_id)
  ) THEN
    RAISE EXCEPTION 'Friend request already exists';
  END IF;

  -- Check if accounts are active
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id IN (v_requester_id, p_addressee_id)
    AND account_status != 'active'
  ) THEN
    RAISE EXCEPTION 'Cannot send friend request to blocked or deleted account';
  END IF;

  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (v_requester_id, p_addressee_id, 'pending')
  RETURNING id INTO v_friendship_id;

  RETURN v_friendship_id;
END;
$$;

-- Accept friend request
CREATE OR REPLACE FUNCTION accept_friend_request(p_requester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_addressee_id uuid;
BEGIN
  v_addressee_id := (select auth.uid());

  IF v_addressee_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE friendships
  SET status = 'accepted', updated_at = now()
  WHERE requester_id = p_requester_id
    AND addressee_id = v_addressee_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
END;
$$;

-- Decline friend request
CREATE OR REPLACE FUNCTION decline_friend_request(p_requester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_addressee_id uuid;
BEGIN
  v_addressee_id := (select auth.uid());

  IF v_addressee_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE friendships
  SET status = 'declined', updated_at = now()
  WHERE requester_id = p_requester_id
    AND addressee_id = v_addressee_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
END;
$$;

-- Remove friend (works for both users)
CREATE OR REPLACE FUNCTION remove_friend(p_friend_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := (select auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM friendships
  WHERE (
    (requester_id = v_user_id AND addressee_id = p_friend_id)
    OR (requester_id = p_friend_id AND addressee_id = v_user_id)
  );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;
END;
$$;

-- Block another user (removes friendship)
CREATE OR REPLACE FUNCTION block_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_blocker_id uuid;
BEGIN
  v_blocker_id := (select auth.uid());

  IF v_blocker_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_blocker_id = p_user_id THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;

  -- Remove existing friendship
  DELETE FROM friendships
  WHERE (
    (requester_id = v_blocker_id AND addressee_id = p_user_id)
    OR (requester_id = p_user_id AND addressee_id = v_blocker_id)
  );

  -- Create blocked relationship
  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (v_blocker_id, p_user_id, 'blocked')
  ON CONFLICT (requester_id, addressee_id) DO UPDATE
  SET status = 'blocked', updated_at = now();
END;
$$;

-- =========================================
-- PART 6: ACCOUNT MANAGEMENT FUNCTIONS
-- =========================================

-- Admin block account
CREATE OR REPLACE FUNCTION admin_block_account(
  p_user_id uuid,
  p_admin_email text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verify admin
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE email = p_admin_email) THEN
    RAISE EXCEPTION 'Unauthorized: Not an admin';
  END IF;

  -- Cannot block another admin
  IF EXISTS (SELECT 1 FROM admin_users au JOIN auth.users u ON au.email = u.email WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Cannot block admin accounts';
  END IF;

  -- Update account status
  UPDATE user_profiles
  SET
    account_status = 'blocked',
    blocked_at = now(),
    blocked_by = p_admin_email,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Log action
  INSERT INTO admin_actions (
    admin_email,
    action_type,
    target_id,
    reason,
    created_at
  )
  VALUES (
    p_admin_email,
    'block_account',
    p_user_id::text,
    p_reason,
    now()
  );
END;
$$;

-- Admin unblock account
CREATE OR REPLACE FUNCTION admin_unblock_account(
  p_user_id uuid,
  p_admin_email text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verify admin
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE email = p_admin_email) THEN
    RAISE EXCEPTION 'Unauthorized: Not an admin';
  END IF;

  -- Update account status
  UPDATE user_profiles
  SET
    account_status = 'active',
    blocked_at = NULL,
    blocked_by = NULL,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Log action
  INSERT INTO admin_actions (
    admin_email,
    action_type,
    target_id,
    reason,
    created_at
  )
  VALUES (
    p_admin_email,
    'unblock_account',
    p_user_id::text,
    p_reason,
    now()
  );
END;
$$;

-- Delete own account
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
BEGIN
  v_user_id := (select auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Prevent admins from deleting their own account
  IF EXISTS (SELECT 1 FROM admin_users WHERE email = v_user_email) THEN
    RAISE EXCEPTION 'Admins cannot delete their own accounts';
  END IF;

  -- Soft delete - mark as deleted
  UPDATE user_profiles
  SET
    account_status = 'deleted',
    deleted_at = now(),
    updated_at = now()
  WHERE user_id = v_user_id;

  -- Remove all friendships
  DELETE FROM friendships
  WHERE requester_id = v_user_id OR addressee_id = v_user_id;

  -- Mark all wishes as retracted
  UPDATE wishes
  SET
    status = 'retracted',
    closure_reason = 'Account deleted by user',
    closed_at = now(),
    updated_at = now()
  WHERE user_id = v_user_id
    AND status NOT IN ('retracted', 'cancelled', 'rejected');
END;
$$;

-- =========================================
-- PART 7: RLS POLICIES FOR FRIENDSHIPS
-- =========================================

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Users can view their own friend requests and friendships
CREATE POLICY "Users can view own friendships"
  ON friendships
  FOR SELECT
  TO authenticated
  USING (
    requester_id = (select auth.uid())
    OR addressee_id = (select auth.uid())
  );

-- Users can create friend requests
CREATE POLICY "Users can send friend requests"
  ON friendships
  FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = (select auth.uid()));

-- Users can update friendships where they are addressee (accept/decline)
CREATE POLICY "Users can respond to friend requests"
  ON friendships
  FOR UPDATE
  TO authenticated
  USING (addressee_id = (select auth.uid()))
  WITH CHECK (addressee_id = (select auth.uid()));

-- Users can delete their own friendships
CREATE POLICY "Users can delete own friendships"
  ON friendships
  FOR DELETE
  TO authenticated
  USING (
    requester_id = (select auth.uid())
    OR addressee_id = (select auth.uid())
  );

-- Admins can view all friendships
CREATE POLICY "Admins can view all friendships"
  ON friendships
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (select auth.jwt()->>'email')
    )
  );

-- =========================================
-- PART 8: UPDATE WISHES RLS FOR VISIBILITY
-- =========================================

-- Drop old policy and create new one with visibility support
DROP POLICY IF EXISTS "Anyone can view published wishes" ON wishes;

CREATE POLICY "Users can view wishes based on visibility"
  ON wishes
  FOR SELECT
  TO authenticated
  USING (
    -- Own wishes
    user_id = (select auth.uid())
    OR
    -- Public published wishes from active accounts
    (
      is_published = true
      AND visibility = 'public'
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = wishes.user_id
        AND user_profiles.account_status = 'active'
      )
    )
    OR
    -- Friends-only wishes from friends
    (
      is_published = true
      AND visibility = 'friends_only'
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = wishes.user_id
        AND user_profiles.account_status = 'active'
      )
      AND are_friends(wishes.user_id, (select auth.uid()))
    )
    OR
    -- Admins can see all
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (select auth.jwt()->>'email')
    )
  );

-- Update wish creation policy to set visibility
DROP POLICY IF EXISTS "Users can create their own wishes" ON wishes;

CREATE POLICY "Users can create wishes"
  ON wishes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = (select auth.uid())
      AND account_status = 'active'
    )
  );

-- =========================================
-- PART 9: UPDATE USER_PROFILES RLS FOR BLOCKED ACCOUNTS
-- =========================================

-- Admins can update any profile (for blocking)
CREATE POLICY "Admins can update any profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (select auth.jwt()->>'email')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (select auth.jwt()->>'email')
    )
  );

-- Update triggers
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
