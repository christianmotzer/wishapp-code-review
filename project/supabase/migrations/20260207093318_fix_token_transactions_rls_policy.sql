/*
  # Fix token_transactions RLS Policy

  1. Problem
    - The SELECT policy for token_transactions table references auth.users table directly
    - This causes "permission denied for table users" error
  
  2. Solution
    - Replace the subquery on auth.users with auth.jwt()->>'email'
*/

DROP POLICY IF EXISTS "Users can view own token transactions" ON token_transactions;

CREATE POLICY "Users can view own token transactions"
  ON token_transactions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = (auth.jwt()->>'email')
    )
  );
