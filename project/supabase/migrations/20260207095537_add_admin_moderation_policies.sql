/*
  # Add Admin Moderation Policies

  1. Changes
    - Add UPDATE policy for admins to edit any wish
    - Add DELETE policy for admins to delete any wish
    
  2. Security
    - Policies check if user's email exists in admin_users table
    - Only authenticated users can use these policies
    - Admins can moderate all wishes, proposals, and sub-wishes
*/

-- Allow admins to update any wish
CREATE POLICY "Admins can update any wish"
  ON wishes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (true);

-- Allow admins to delete any wish
CREATE POLICY "Admins can delete any wish"
  ON wishes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
