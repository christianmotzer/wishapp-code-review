/*
  # Create Admin Users System

  1. New Tables
    - `admin_users`
      - `email` (text, primary key) - Admin user's email address
      - `role` (text) - Either 'admin' or 'super_admin'
      - `granted_by` (text, nullable) - Email of who granted admin access
      - `granted_at` (timestamptz) - When admin access was granted
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on `admin_users` table
    - Anyone can read admin_users (to check permissions)
    - Only super admins can insert/update/delete admin_users

  3. Initial Data
    - Automatically insert super admin for christian.motzer@googlemail.com
*/

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  email text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'super_admin')),
  granted_by text,
  granted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read admin_users (needed to check permissions)
CREATE POLICY "Anyone can read admin users"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only super admins can insert new admins
CREATE POLICY "Super admins can insert admins"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (SELECT auth.jwt()->>'email')
      AND role = 'super_admin'
    )
  );

-- Policy: Only super admins can update admins
CREATE POLICY "Super admins can update admins"
  ON admin_users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (SELECT auth.jwt()->>'email')
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (SELECT auth.jwt()->>'email')
      AND role = 'super_admin'
    )
  );

-- Policy: Only super admins can delete admins
CREATE POLICY "Super admins can delete admins"
  ON admin_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (SELECT auth.jwt()->>'email')
      AND role = 'super_admin'
    )
  );

-- Insert initial super admin
INSERT INTO admin_users (email, role, granted_by, granted_at)
VALUES ('christian.motzer@googlemail.com', 'super_admin', 'system', now())
ON CONFLICT (email) DO NOTHING;