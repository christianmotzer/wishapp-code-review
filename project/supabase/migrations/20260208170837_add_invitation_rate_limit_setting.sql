/*
  # Add Invitation Rate Limit Setting

  ## Summary
  Adds a configurable admin setting for controlling how many invitations a user can send per day.
  Default value is set to 10 invitations per day per user.

  ## Changes
  1. Settings Added
    - `invitation_rate_limit`: Maximum number of invitations a user can send per day (default: 10)

  ## Security
  - Uses existing RLS policies from admin_settings table
  - Only admins can modify the setting
  - All authenticated users can read the setting

  ## Important Notes
  - Rate limit is enforced per user per day
  - Default value: 10 invitations per day
  - Admins can adjust this value via the admin dashboard
*/

-- Add invitation rate limit setting
INSERT INTO admin_settings (key, value, description) VALUES
  ('invitation_rate_limit', '10'::jsonb, 'Maximum number of invitations a user can send per day')
ON CONFLICT (key) DO NOTHING;
