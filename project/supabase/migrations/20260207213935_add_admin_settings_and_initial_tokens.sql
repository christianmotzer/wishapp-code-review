/*
  # Admin Settings for Initial User Tokens

  ## Summary
  Adds configurable admin settings for initial token allocation to new users.
  By default, new users will receive 1000 WishTokens when they create an account.

  ## 1. New Tables
    - `admin_settings`
      - `key` (text, primary key) - Unique setting identifier
      - `value` (jsonb) - Setting value (supports various data types)
      - `description` (text) - Human-readable description
      - `created_at`, `updated_at` (timestamptz) - Timestamps

  ## 2. Functions
    - `auto_create_user_tokens()` - Creates user_tokens entry with initial balance from admin settings
    - Updates `auto_create_user_profile()` to also create user_tokens

  ## 3. Security
    - Enable RLS on `admin_settings` table
    - Only admins can modify settings
    - All authenticated users can read settings

  ## 4. Important Notes
    - Default initial tokens: 1000
    - Tokens are granted automatically during signup
    - Admins can change the initial token amount via admin dashboard
*/

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default admin settings
INSERT INTO admin_settings (key, value, description) VALUES
  ('initial_tokens_for_new_users', '1000'::jsonb, 'Number of tokens granted to new users upon signup')
ON CONFLICT (key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(key);

-- Enable RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_settings

-- All authenticated users can read settings
CREATE POLICY "Authenticated users can read admin settings"
  ON admin_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert settings
CREATE POLICY "Admins can insert settings"
  ON admin_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (auth.jwt()->>'email')
    )
  );

-- Only admins can update settings
CREATE POLICY "Admins can update settings"
  ON admin_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (auth.jwt()->>'email')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (auth.jwt()->>'email')
    )
  );

-- Only admins can delete settings
CREATE POLICY "Admins can delete settings"
  ON admin_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (auth.jwt()->>'email')
    )
  );

-- Create trigger to update updated_at
CREATE TRIGGER admin_settings_updated_at
  BEFORE UPDATE ON admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create user tokens with initial balance
CREATE OR REPLACE FUNCTION auto_create_user_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initial_tokens integer;
BEGIN
  -- Get initial tokens from admin settings
  SELECT (value::text)::integer INTO initial_tokens
  FROM admin_settings
  WHERE key = 'initial_tokens_for_new_users';
  
  -- Default to 1000 if setting not found
  IF initial_tokens IS NULL THEN
    initial_tokens := 1000;
  END IF;
  
  -- Create user_tokens record with initial balance
  INSERT INTO public.user_tokens (user_id, balance, total_received, created_at, updated_at)
  VALUES (NEW.id, initial_tokens, initial_tokens, now(), now())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create transaction record for the initial grant
  IF initial_tokens > 0 THEN
    INSERT INTO public.token_transactions (
      user_id,
      amount,
      transaction_type,
      direction,
      message,
      created_at
    )
    VALUES (
      NEW.id,
      initial_tokens,
      'admin_grant',
      'credit',
      'Initial token grant for new user',
      now()
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't prevent user creation
    RAISE WARNING 'Failed to create user tokens: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to auto-create tokens on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_tokens ON auth.users;
CREATE TRIGGER on_auth_user_created_tokens
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_user_tokens();

-- Backfill tokens for existing users
DO $$
DECLARE
  user_record RECORD;
  initial_tokens integer;
BEGIN
  -- Get initial tokens from admin settings
  SELECT (value::text)::integer INTO initial_tokens
  FROM admin_settings
  WHERE key = 'initial_tokens_for_new_users';
  
  -- Default to 1000 if setting not found
  IF initial_tokens IS NULL THEN
    initial_tokens := 1000;
  END IF;
  
  FOR user_record IN SELECT id FROM auth.users LOOP
    -- Check if tokens already exist
    IF NOT EXISTS (SELECT 1 FROM user_tokens WHERE user_id = user_record.id) THEN
      -- Create tokens record
      INSERT INTO user_tokens (user_id, balance, total_received, created_at, updated_at)
      VALUES (user_record.id, initial_tokens, initial_tokens, now(), now());
      
      -- Create transaction record
      IF initial_tokens > 0 THEN
        INSERT INTO token_transactions (
          user_id,
          amount,
          transaction_type,
          direction,
          message,
          created_at
        )
        VALUES (
          user_record.id,
          initial_tokens,
          'admin_grant',
          'credit',
          'Initial token grant for existing user (backfill)',
          now()
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;
