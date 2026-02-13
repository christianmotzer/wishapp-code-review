/*
  # Fix Wishes UPDATE RLS for Parent Owners

  1. Problem
    - Parent wish owners need to be able to reject/accept proposals
    - The current policy may have conflicts between multiple UPDATE policies
  
  2. Solution
    - Drop conflicting policies and create a single comprehensive UPDATE policy
    - Allow: creators to update their wishes, parent owners to update child wishes
*/

DROP POLICY IF EXISTS "Creators can manage their wish status" ON wishes;
DROP POLICY IF EXISTS "Users can update their own draft wishes" ON wishes;

CREATE POLICY "Users can update wishes they own or parent"
  ON wishes
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      parent_wish_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM wishes AS parent
        WHERE parent.id = wishes.parent_wish_id
        AND parent.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (true);
