/*
  # Add INSERT Policy for wish_status_history

  1. Problem
    - wish_status_history table has no INSERT policy
    - When wishes status changes, the trigger tries to insert into wish_status_history
    - This fails with RLS error "new row violates row-level security policy"
  
  2. Solution
    - Add INSERT policy allowing authenticated users to insert status history
    - Users can insert history for wishes they own or for wishes where they are the parent owner
*/

CREATE POLICY "Users can insert status history for their wishes"
  ON wish_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    wish_id IN (
      SELECT id FROM wishes
      WHERE user_id = auth.uid()
    )
    OR wish_id IN (
      SELECT w.id FROM wishes w
      WHERE w.parent_wish_id IN (
        SELECT id FROM wishes
        WHERE user_id = auth.uid()
      )
    )
  );
