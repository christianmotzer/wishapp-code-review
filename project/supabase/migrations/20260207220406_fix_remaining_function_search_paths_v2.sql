/*
  # Fix Remaining Function Search Paths v2

  ## Summary
  Sets explicit search_path for remaining functions to prevent search path attacks.
  Drops and recreates functions to ensure clean migration.

  ## Functions Updated
    - prevent_retraction_with_active_children
    - distribute_tokens_to_wish
    - admin_grant_tokens
    - admin_grant_tokens_by_email
    - close_wish_with_children
    - generate_lovely_name
    - update_updated_at_column
    - get_token_leaderboard
    - auto_create_user_tokens

  ## Important Notes
    - All functions now have SET search_path = public, pg_temp
    - This prevents malicious search_path manipulation attacks
*/

-- Drop existing functions first
DROP FUNCTION IF EXISTS prevent_retraction_with_active_children CASCADE;
DROP FUNCTION IF EXISTS distribute_tokens_to_wish CASCADE;
DROP FUNCTION IF EXISTS admin_grant_tokens CASCADE;
DROP FUNCTION IF EXISTS admin_grant_tokens_by_email CASCADE;
DROP FUNCTION IF EXISTS close_wish_with_children CASCADE;
DROP FUNCTION IF EXISTS generate_lovely_name CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS get_token_leaderboard CASCADE;
DROP FUNCTION IF EXISTS auto_create_user_tokens CASCADE;

-- Recreate with proper search_path

CREATE FUNCTION prevent_retraction_with_active_children()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  active_count integer;
BEGIN
  IF NEW.status = 'retracted' AND OLD.status != 'retracted' THEN
    SELECT COUNT(*) INTO active_count
    FROM wishes
    WHERE parent_wish_id = NEW.id
      AND status IN ('active', 'voting', 'draft');
    
    IF active_count > 0 THEN
      RAISE EXCEPTION 'Cannot retract wish: % active child wishes/proposals exist', active_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE FUNCTION distribute_tokens_to_wish(
  p_wish_id uuid,
  p_supporter_id uuid,
  p_tokens integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_wish_id uuid;
  v_creator_id uuid;
  v_level integer := 0;
  v_config_percentage numeric;
  v_tokens_to_distribute integer;
BEGIN
  IF p_tokens <= 0 THEN
    RAISE EXCEPTION 'Token amount must be positive';
  END IF;

  SELECT balance INTO v_tokens_to_distribute
  FROM user_tokens
  WHERE user_id = p_supporter_id;

  IF v_tokens_to_distribute < p_tokens THEN
    RAISE EXCEPTION 'Insufficient token balance';
  END IF;

  UPDATE user_tokens
  SET balance = balance - p_tokens,
      total_spent = total_spent + p_tokens,
      updated_at = now()
  WHERE user_id = p_supporter_id;

  INSERT INTO token_transactions (
    user_id,
    wish_id,
    amount,
    transaction_type,
    direction,
    created_at
  )
  VALUES (
    p_supporter_id,
    p_wish_id,
    p_tokens,
    'wish_support',
    'debit',
    now()
  );

  UPDATE wishes
  SET token_count = token_count + p_tokens,
      updated_at = now()
  WHERE id = p_wish_id;

  v_current_wish_id := p_wish_id;

  WHILE v_current_wish_id IS NOT NULL AND v_level < 5 LOOP
    SELECT user_id, parent_wish_id
    INTO v_creator_id, v_current_wish_id
    FROM wishes
    WHERE id = v_current_wish_id;

    IF v_creator_id IS NOT NULL THEN
      SELECT percentage INTO v_config_percentage
      FROM distribution_config
      WHERE level = v_level AND is_active = true;

      IF v_config_percentage IS NOT NULL THEN
        v_tokens_to_distribute := FLOOR(p_tokens * v_config_percentage / 100);

        IF v_tokens_to_distribute > 0 THEN
          UPDATE user_tokens
          SET balance = balance + v_tokens_to_distribute,
              total_received = total_received + v_tokens_to_distribute,
              updated_at = now()
          WHERE user_id = v_creator_id;

          INSERT INTO token_transactions (
            user_id,
            wish_id,
            amount,
            transaction_type,
            direction,
            message,
            created_at
          )
          VALUES (
            v_creator_id,
            p_wish_id,
            v_tokens_to_distribute,
            'hierarchy_distribution',
            'credit',
            format('Level %s distribution from wish support', v_level),
            now()
          );
        END IF;
      END IF;
    END IF;

    v_level := v_level + 1;
  END LOOP;
END;
$$;

CREATE FUNCTION admin_grant_tokens(
  p_user_id uuid,
  p_amount integer,
  p_admin_email text,
  p_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE email = p_admin_email) THEN
    RAISE EXCEPTION 'Unauthorized: Not an admin';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE user_tokens
  SET balance = balance + p_amount,
      total_received = total_received + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_tokens (user_id, balance, total_received, created_at, updated_at)
    VALUES (p_user_id, p_amount, p_amount, now(), now());
  END IF;

  INSERT INTO token_transactions (
    user_id,
    amount,
    transaction_type,
    direction,
    admin_email,
    message,
    created_at
  )
  VALUES (
    p_user_id,
    p_amount,
    'admin_grant',
    'credit',
    p_admin_email,
    COALESCE(p_message, 'Admin token grant'),
    now()
  );

  INSERT INTO admin_actions (
    admin_email,
    action_type,
    target_id,
    reason,
    metadata,
    created_at
  )
  VALUES (
    p_admin_email,
    'grant_tokens',
    p_user_id::text,
    p_message,
    jsonb_build_object('amount', p_amount),
    now()
  );
END;
$$;

CREATE FUNCTION admin_grant_tokens_by_email(
  p_user_email text,
  p_amount integer,
  p_admin_email text,
  p_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_user_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email: %', p_user_email;
  END IF;

  PERFORM admin_grant_tokens(v_user_id, p_amount, p_admin_email, p_message);
END;
$$;

CREATE FUNCTION close_wish_with_children(
  p_wish_id uuid,
  p_closer_id uuid,
  p_reason text,
  p_close_children boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE wishes
  SET
    status = 'cancelled',
    closed_at = now(),
    closed_by = p_closer_id,
    closure_reason = p_reason,
    updated_at = now()
  WHERE id = p_wish_id;

  IF p_close_children THEN
    UPDATE wishes
    SET
      status = 'cancelled',
      closed_at = now(),
      closed_by = p_closer_id,
      closure_reason = 'Parent wish was cancelled',
      updated_at = now()
    WHERE parent_wish_id = p_wish_id
      AND status NOT IN ('accepted', 'rejected', 'retracted', 'cancelled', 'approved_by_vote');
  END IF;
END;
$$;

CREATE FUNCTION generate_lovely_name()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT name INTO v_name
  FROM generated_names_pool
  WHERE is_used = false
  ORDER BY random()
  LIMIT 1;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'No available names in pool';
  END IF;

  RETURN v_name;
END;
$$;

CREATE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION get_token_leaderboard(p_limit integer DEFAULT 10)
RETURNS TABLE (
  user_id uuid,
  balance integer,
  total_received integer,
  total_spent integer,
  display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ut.user_id,
    ut.balance,
    ut.total_received,
    ut.total_spent,
    COALESCE(up.display_name, 'Anonymous') as display_name
  FROM user_tokens ut
  LEFT JOIN user_profiles up ON ut.user_id = up.user_id
  ORDER BY ut.balance DESC
  LIMIT p_limit;
END;
$$;

CREATE FUNCTION auto_create_user_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  initial_tokens integer;
BEGIN
  SELECT (value::text)::integer INTO initial_tokens
  FROM admin_settings
  WHERE key = 'initial_tokens_for_new_users';
  
  IF initial_tokens IS NULL THEN
    initial_tokens := 1000;
  END IF;
  
  INSERT INTO public.user_tokens (user_id, balance, total_received, created_at, updated_at)
  VALUES (NEW.id, initial_tokens, initial_tokens, now(), now())
  ON CONFLICT (user_id) DO NOTHING;
  
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
    RAISE WARNING 'Failed to create user tokens: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created_tokens ON auth.users;
CREATE TRIGGER on_auth_user_created_tokens
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_user_tokens();

-- Recreate prevent retraction trigger
DROP TRIGGER IF EXISTS prevent_retraction_with_children ON wishes;
CREATE TRIGGER prevent_retraction_with_children
  BEFORE UPDATE ON wishes
  FOR EACH ROW
  EXECUTE FUNCTION prevent_retraction_with_active_children();
