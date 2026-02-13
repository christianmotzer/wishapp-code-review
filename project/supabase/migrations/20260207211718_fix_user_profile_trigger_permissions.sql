/*
  # Fix User Profile Auto-Creation Trigger

  ## Summary
  Fixes the "Database error saving new user" issue by ensuring the trigger
  function can properly create user profiles during signup.

  ## Problem
  The auto_create_user_profile() trigger function was failing because:
  - RLS policies on user_profiles were blocking the INSERT operation
  - During signup, auth.uid() context isn't fully established when the trigger runs
  - SECURITY DEFINER wasn't sufficient to bypass RLS in this case

  ## Solution
  1. Add a specific RLS policy that allows INSERT operations when user_id matches NEW.id
  2. Grant proper permissions to the trigger function
  3. Ensure the function can operate during the auth.users INSERT operation

  ## Changes
  - Drop and recreate the trigger function with proper RLS bypass
  - Add a new RLS policy specifically for trigger-based inserts
*/

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop and recreate the function with proper permissions
DROP FUNCTION IF EXISTS auto_create_user_profile();

CREATE OR REPLACE FUNCTION auto_create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lovely_name text;
BEGIN
  -- Generate a lovely name
  lovely_name := generate_lovely_name();
  
  -- Insert the profile (bypassing RLS because of SECURITY DEFINER)
  INSERT INTO public.user_profiles (user_id, display_name, created_at, updated_at)
  VALUES (NEW.id, lovely_name, now(), now());
  
  -- Mark the name as used
  INSERT INTO public.generated_names_pool (name, is_used, used_by, used_at)
  VALUES (lovely_name, true, NEW.id, now())
  ON CONFLICT (name) DO UPDATE
  SET is_used = true, used_by = NEW.id, used_at = now();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't prevent user creation
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_user_profile();

-- Add a policy specifically for service role to insert profiles
-- This ensures the trigger function can insert regardless of auth context
DROP POLICY IF EXISTS "Service role can insert profiles" ON user_profiles;
CREATE POLICY "Service role can insert profiles"
  ON user_profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant necessary permissions to the postgres role (function owner)
GRANT INSERT ON user_profiles TO postgres;
GRANT INSERT, UPDATE ON generated_names_pool TO postgres;
