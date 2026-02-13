/*
  # Create Admin Actions Audit Log

  1. New Tables
    - `admin_actions`
      - `id` (uuid, primary key) - Unique identifier for the action
      - `admin_email` (text) - Email of the admin who performed the action
      - `action_type` (text) - Type of action (cancel_wish, add_admin, remove_admin, etc.)
      - `target_id` (text) - ID of the affected entity (wish_id or admin email)
      - `reason` (text, nullable) - Reason provided for the action
      - `metadata` (jsonb, nullable) - Additional context data
      - `created_at` (timestamptz) - When the action was performed

  2. Security
    - Enable RLS on `admin_actions` table
    - Only admins can read audit logs
    - System automatically inserts actions (no manual insert policy needed)

  3. Purpose
    - Track all administrative actions for accountability
    - Provide audit trail for compliance and troubleshooting
*/

-- Create admin_actions table
CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  action_type text NOT NULL,
  target_id text NOT NULL,
  reason text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_email ON admin_actions(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);

-- Enable RLS
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read audit logs
CREATE POLICY "Admins can read audit logs"
  ON admin_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (SELECT auth.jwt()->>'email')
    )
  );

-- Policy: Authenticated users can insert audit logs (for system tracking)
CREATE POLICY "Authenticated users can insert audit logs"
  ON admin_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);