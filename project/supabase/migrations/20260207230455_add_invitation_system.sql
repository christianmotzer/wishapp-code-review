/*
  # Add Invitation System

  ## Summary
  Allows users to invite friends via email to join the platform.

  ## New Tables
  1. `invitations`
    - `id` (uuid, primary key)
    - `inviter_id` (uuid, references auth.users) - User who sent the invitation
    - `email` (text) - Email address of invitee
    - `invitation_code` (text, unique) - Unique code for tracking
    - `status` (text) - Status: 'pending', 'accepted', 'expired'
    - `sent_at` (timestamptz) - When invitation was sent
    - `accepted_at` (timestamptz) - When invitation was accepted
    - `expires_at` (timestamptz) - Expiration date (30 days from sent)
    - `message` (text) - Optional personal message from inviter

  ## Security
  - Enable RLS on invitations table
  - Users can view their own sent invitations
  - Users can insert new invitations
  - Limit invitations per user to prevent spam
*/

-- =========================================
-- Create invitations table
-- =========================================

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  invitation_code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  message text,
  created_at timestamptz DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invitations_inviter ON invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- =========================================
-- Enable RLS
-- =========================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- =========================================
-- RLS Policies for invitations
-- =========================================

-- Users can view their own sent invitations
CREATE POLICY "Users can view own sent invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid());

-- Users can send invitations (with rate limiting enforced in edge function)
CREATE POLICY "Users can send invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (inviter_id = auth.uid());

-- Users can update their own invitations (e.g., resend)
CREATE POLICY "Users can update own invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (inviter_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid());

-- =========================================
-- Function to check and mark invitation as accepted
-- =========================================

CREATE OR REPLACE FUNCTION accept_invitation(p_invitation_code text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation_id uuid;
  v_inviter_id uuid;
BEGIN
  -- Find the invitation
  SELECT id, inviter_id INTO v_invitation_id, v_inviter_id
  FROM invitations
  WHERE invitation_code = p_invitation_code
    AND status = 'pending'
    AND expires_at > now();

  IF v_invitation_id IS NULL THEN
    RETURN false;
  END IF;

  -- Mark invitation as accepted
  UPDATE invitations
  SET status = 'accepted',
      accepted_at = now()
  WHERE id = v_invitation_id;

  -- Automatically send friend request from inviter to new user
  BEGIN
    INSERT INTO friendships (requester_id, addressee_id, status)
    VALUES (v_inviter_id, p_user_id, 'pending')
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      -- Ignore if friendship already exists or any other error
      NULL;
  END;

  RETURN true;
END;
$$;

-- =========================================
-- Function to expire old invitations
-- =========================================

CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;
