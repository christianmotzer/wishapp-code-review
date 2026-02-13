/*
  # Fix user_tokens RLS Policy

  1. Problem
    - The SELECT policy for user_tokens table references auth.users table directly
    - This causes "permission denied for table users" error
  
  2. Solution
    - Replace the subquery on auth.users with auth.jwt()->>'email'
    - This is the proper way to get the current user's email in RLS policies
*/

DROP POLICY IF EXISTS "Users can view own token balance" ON user_tokens;

CREATE POLICY "Users can view own token balance"
  ON user_tokens
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = (auth.jwt()->>'email')
    )
  );
