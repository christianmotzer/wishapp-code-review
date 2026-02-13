/*
  # Add Account Deletion and GDPR Features

  1. New Tables
    - `account_deletion_log` - Audit trail for account deletions
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `deleted_by` (text) - email of admin or 'user' for self-deletion
      - `deletion_type` (text) - 'self' or 'admin'
      - `reason` (text, nullable) - deletion reason
      - `status` (text) - 'pending' or 'completed'
      - `created_at` (timestamp)
      - `completed_at` (timestamp, nullable)

  2. New Columns
    - Add `email` to `user_profiles` for easier admin display
    - Add `tos_accepted` and `gdpr_accepted` to `user_profiles` for consent tracking

  3. Security
    - Enable RLS on `account_deletion_log`
    - Add admin-only policy for deletion log
*/

CREATE TABLE IF NOT EXISTS account_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deleted_by text NOT NULL,
  deletion_type text NOT NULL CHECK (deletion_type IN ('self', 'admin')),
  reason text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

ALTER TABLE account_deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view deletion log"
  ON account_deletion_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = auth.email()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'tos_accepted'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN tos_accepted boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'gdpr_accepted'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN gdpr_accepted boolean DEFAULT false;
  END IF;
END $$;
