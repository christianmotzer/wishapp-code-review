/*
  # Fix distribute_tokens_to_wish Function Parameters

  ## Summary
  Updates the distribute_tokens_to_wish function to match the frontend's expected parameter names
  and adds support for the message parameter.

  ## Changes
    1. Rename p_supporter_id to p_sender_id
    2. Rename p_tokens to p_amount
    3. Add p_message parameter to allow custom messages in transactions
    4. Update function to use the message parameter in transaction records

  ## Important Notes
    - Function maintains SECURITY DEFINER for safe token operations
    - All existing functionality preserved
    - Adds message support for better transaction tracking
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS distribute_tokens_to_wish(uuid, uuid, integer);

-- Recreate with corrected parameter names and message support
CREATE FUNCTION distribute_tokens_to_wish(
  p_wish_id uuid,
  p_sender_id uuid,
  p_amount integer,
  p_message text DEFAULT NULL
)
RETURNS text
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
  v_sender_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Token amount must be positive';
  END IF;

  SELECT balance INTO v_sender_balance
  FROM user_tokens
  WHERE user_id = p_sender_id;

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'Sender token account not found';
  END IF;

  IF v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient token balance';
  END IF;

  UPDATE user_tokens
  SET balance = balance - p_amount,
      total_spent = total_spent + p_amount,
      updated_at = now()
  WHERE user_id = p_sender_id;

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
    p_sender_id,
    p_wish_id,
    p_amount,
    'wish_support',
    'debit',
    COALESCE(p_message, 'Sent tokens to wish'),
    now()
  );

  UPDATE wishes
  SET token_count = token_count + p_amount,
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
        v_tokens_to_distribute := FLOOR(p_amount * v_config_percentage / 100);

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

  RETURN 'success';
END;
$$;