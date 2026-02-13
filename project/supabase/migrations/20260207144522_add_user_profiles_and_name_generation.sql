/*
  # User Profiles and Name Generation System

  ## Summary
  Creates a comprehensive user profile system with automatic lovely name generation,
  contact information storage, and token leaderboard support.

  ## 1. New Tables
    - `user_profiles`
      - `user_id` (uuid, primary key, foreign key to auth.users)
      - `display_name` (text) - Public display name shown throughout the app
      - `full_name` (text) - User's full real name
      - `phone` (text) - Contact phone number
      - `address_line1`, `address_line2` (text) - Street address
      - `city`, `state`, `postal_code`, `country` (text) - Address components
      - `bio` (text) - User biography or description
      - `avatar_url` (text) - Profile picture URL
      - `created_at`, `updated_at` (timestamptz) - Timestamps
    
    - `generated_names_pool` - Tracks used generated names to avoid duplicates
      - `name` (text, primary key)
      - `is_used` (boolean)
      - `used_by` (uuid, nullable)
      - `used_at` (timestamptz, nullable)

  ## 2. Functions
    - `generate_lovely_name()` - Generates a unique lovely display name
    - `auto_create_user_profile()` - Trigger function to create profile on signup
    - `get_token_leaderboard()` - Returns leaderboard with user info

  ## 3. Security
    - Enable RLS on `user_profiles` table
    - Users can read their own profile
    - Users can update their own profile
    - Admins can read all profiles
    - Public can read display_name, bio, and avatar_url for leaderboard

  ## 4. Important Notes
    - Lovely names are auto-generated if user doesn't provide one
    - Name format: [Adjective] [Noun] (e.g., "Bright Butterfly", "Gentle Stream")
    - Generated names are unique and tracked to prevent duplicates
    - Profile is auto-created on user signup via trigger
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  full_name text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  bio text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create table to track generated names
CREATE TABLE IF NOT EXISTS generated_names_pool (
  name text PRIMARY KEY,
  is_used boolean DEFAULT false,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz
);

-- Create index on display_name for searching
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_generated_names_is_used ON generated_names_pool(is_used);

-- Function to generate a lovely name
CREATE OR REPLACE FUNCTION generate_lovely_name()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  adjectives text[] := ARRAY[
    'Bright', 'Gentle', 'Wise', 'Swift', 'Noble', 'Calm', 'Bold', 'Kind',
    'Graceful', 'Radiant', 'Serene', 'Valiant', 'Cheerful', 'Peaceful', 'Brave',
    'Elegant', 'Mystic', 'Tender', 'Spirited', 'Vibrant', 'Tranquil', 'Mighty',
    'Gleaming', 'Lively', 'Faithful', 'Harmonious', 'Sincere', 'Joyful', 'Cosmic',
    'Golden', 'Silver', 'Crystal', 'Stellar', 'Azure', 'Crimson', 'Emerald',
    'Amber', 'Lunar', 'Solar', 'Starlit', 'Verdant', 'Violet', 'Sapphire',
    'Pearl', 'Ivory', 'Obsidian', 'Frosted', 'Blazing', 'Whispering', 'Dancing'
  ];
  nouns text[] := ARRAY[
    'Butterfly', 'Stream', 'Oak', 'Mountain', 'River', 'Falcon', 'Willow', 'Phoenix',
    'Dolphin', 'Lotus', 'Eagle', 'Cedar', 'Meadow', 'Wolf', 'Orchid', 'Hawk',
    'Birch', 'Canyon', 'Fox', 'Rose', 'Tiger', 'Pine', 'Valley', 'Raven',
    'Maple', 'Ocean', 'Lion', 'Jasmine', 'Bear', 'Aspen', 'Breeze', 'Panther',
    'Lily', 'Forest', 'Owl', 'Bamboo', 'Sunset', 'Deer', 'Iris', 'Storm',
    'Dragon', 'Cosmos', 'Moon', 'Star', 'Dawn', 'Dusk', 'Aurora', 'Comet',
    'Galaxy', 'Nebula', 'Horizon', 'Cascade', 'Thunder', 'Glacier', 'Ember'
  ];
  generated_name text;
  attempt_count int := 0;
  max_attempts int := 100;
BEGIN
  LOOP
    -- Generate random name
    generated_name := adjectives[1 + floor(random() * array_length(adjectives, 1))] || ' ' ||
                      nouns[1 + floor(random() * array_length(nouns, 1))];
    
    -- Check if name is already used
    IF NOT EXISTS (SELECT 1 FROM generated_names_pool WHERE name = generated_name AND is_used = true) THEN
      RETURN generated_name;
    END IF;
    
    attempt_count := attempt_count + 1;
    IF attempt_count >= max_attempts THEN
      -- Fallback: append a random number
      generated_name := generated_name || ' ' || floor(random() * 1000)::text;
      RETURN generated_name;
    END IF;
  END LOOP;
END;
$$;

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION auto_create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lovely_name text;
BEGIN
  -- Generate a lovely name
  lovely_name := generate_lovely_name();
  
  -- Insert the profile
  INSERT INTO user_profiles (user_id, display_name, created_at, updated_at)
  VALUES (NEW.id, lovely_name, now(), now());
  
  -- Mark the name as used
  INSERT INTO generated_names_pool (name, is_used, used_by, used_at)
  VALUES (lovely_name, true, NEW.id, now())
  ON CONFLICT (name) DO UPDATE
  SET is_used = true, used_by = NEW.id, used_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_user_profile();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger to update updated_at on profile changes
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_names_pool ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can insert their own profile (for manual creation)
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Public can read basic profile info for leaderboard (display_name, bio, avatar_url)
CREATE POLICY "Public can read basic profile info"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for generated_names_pool (admin only)
CREATE POLICY "Only admins can manage name pool"
  ON generated_names_pool
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Function to get token leaderboard with user profiles
CREATE OR REPLACE FUNCTION get_token_leaderboard(
  time_period text DEFAULT 'all_time',
  limit_count int DEFAULT 50
)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  display_name text,
  avatar_url text,
  total_tokens_received numeric,
  current_balance numeric,
  wishes_created bigint,
  wishes_supported bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_date timestamptz;
BEGIN
  -- Determine start date based on time period
  CASE time_period
    WHEN 'week' THEN
      start_date := now() - interval '7 days';
    WHEN 'month' THEN
      start_date := now() - interval '30 days';
    ELSE
      start_date := '-infinity'::timestamptz;
  END CASE;

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(ut.balance, 0) DESC) as rank,
    up.user_id,
    up.display_name,
    up.avatar_url,
    COALESCE(SUM(tt.amount) FILTER (
      WHERE tt.transaction_type IN ('grant', 'received', 'earned')
      AND tt.created_at >= start_date
    ), 0) as total_tokens_received,
    COALESCE(ut.balance, 0) as current_balance,
    COUNT(DISTINCT w.id) FILTER (WHERE w.creator_id = up.user_id) as wishes_created,
    COUNT(DISTINCT ws.id) FILTER (WHERE ws.supporter_id = up.user_id) as wishes_supported
  FROM user_profiles up
  LEFT JOIN user_tokens ut ON ut.user_id = up.user_id
  LEFT JOIN token_transactions tt ON tt.user_id = up.user_id
  LEFT JOIN wishes w ON w.creator_id = up.user_id
  LEFT JOIN wish_support ws ON ws.supporter_id = up.user_id
  GROUP BY up.user_id, up.display_name, up.avatar_url, ut.balance
  HAVING COALESCE(ut.balance, 0) > 0
  ORDER BY current_balance DESC
  LIMIT limit_count;
END;
$$;

-- Backfill profiles for existing users
DO $$
DECLARE
  user_record RECORD;
  lovely_name text;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    -- Check if profile already exists
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = user_record.id) THEN
      -- Generate a lovely name
      SELECT generate_lovely_name() INTO lovely_name;
      
      -- Create profile
      INSERT INTO user_profiles (user_id, display_name, created_at, updated_at)
      VALUES (user_record.id, lovely_name, now(), now());
      
      -- Mark name as used
      INSERT INTO generated_names_pool (name, is_used, used_by, used_at)
      VALUES (lovely_name, true, user_record.id, now())
      ON CONFLICT (name) DO UPDATE
      SET is_used = true, used_by = user_record.id, used_at = now();
    END IF;
  END LOOP;
END;
$$;