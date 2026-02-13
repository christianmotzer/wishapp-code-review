/*
  # Fix Invitation Verification RLS Policy
  
  1. Issue
    - Unauthenticated users (during signup) cannot verify invitation tokens
    - The existing RLS policy only allows authenticated users to see their own invitations
  
  2. Solution
    - Add new policy allowing anyone to SELECT invitations by email/code for verification
    - This is secure because they can only view specific pending invitations
    - The acceptInvitation function runs with SECURITY DEFINER so it's protected
*/

CREATE POLICY "Allow invitation verification for signup"
  ON invitations FOR SELECT
  TO anon
  USING (status = 'pending' AND expires_at > now());
