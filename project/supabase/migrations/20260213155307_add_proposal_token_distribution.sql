/*
  # Add Proposal Token Distribution System

  1. New Columns
    - `wishes.tokens_distributed` - Tracks total tokens distributed from this wish to accepted proposals
    - `wishes.tokens_received_on_acceptance` - Tracks tokens received when this proposal was accepted
    
  2. New Function
    - `distribute_tokens_on_proposal_acceptance` - Handles token distribution when a proposal is accepted
      - Validates token amount is available on parent wish
      - Enforces max 50% rule for partial distributions (unless wish is being closed)
      - Deducts tokens from parent wish
      - Distributes tokens to proposal creator through hierarchy
      - Records all transactions
      - Updates proposal tokens_received_on_acceptance
    
  3. Security
    - Only wish owner can distribute tokens
    - Tokens cannot be distributed if parent wish doesn't have enough
    - Ensures token_count never goes negative
    
  4. Helpers
    - View to calculate available tokens for distribution per wish
*/

-- Add new columns to wishes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wishes' AND column_name = 'tokens_distributed'
  ) THEN
    ALTER TABLE wishes ADD COLUMN tokens_distributed integer DEFAULT 0 CHECK (tokens_distributed >= 0);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wishes' AND column_name = 'tokens_received_on_acceptance'
  ) THEN
    ALTER TABLE wishes ADD COLUMN tokens_received_on_acceptance integer DEFAULT 0 CHECK (tokens_received_on_acceptance >= 0);
  END IF;
END $$;

-- Create function to calculate available tokens for distribution
CREATE OR REPLACE FUNCTION get_available_tokens_for_distribution(wish_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  available_tokens integer;
BEGIN
  SELECT token_count INTO available_tokens
  FROM wishes
  WHERE id = wish_id_param;
  
  RETURN COALESCE(available_tokens, 0);
END;
$$;

-- Create function to distribute tokens on proposal acceptance
CREATE OR REPLACE FUNCTION distribute_tokens_on_proposal_acceptance(
  parent_wish_id_param uuid,
  proposal_id_param uuid,
  token_amount_param integer,
  close_parent_param boolean DEFAULT false,
  acceptance_message_param text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_wish_owner uuid;
  proposal_owner uuid;
  parent_token_count integer;
  max_distributable integer;
  distribution_result jsonb;
  parent_transaction_id uuid;
BEGIN
  -- Get parent wish owner and token count
  SELECT user_id, token_count INTO parent_wish_owner, parent_token_count
  FROM wishes
  WHERE id = parent_wish_id_param AND wish_type = 'wish';
  
  IF parent_wish_owner IS NULL THEN
    RAISE EXCEPTION 'Parent wish not found';
  END IF;
  
  -- Verify caller is the parent wish owner
  IF auth.uid() != parent_wish_owner THEN
    RAISE EXCEPTION 'Only the wish owner can distribute tokens';
  END IF;
  
  -- Get proposal owner
  SELECT user_id INTO proposal_owner
  FROM wishes
  WHERE id = proposal_id_param AND wish_type = 'proposal' AND parent_wish_id = parent_wish_id_param;
  
  IF proposal_owner IS NULL THEN
    RAISE EXCEPTION 'Proposal not found or does not belong to this wish';
  END IF;
  
  -- Validate token amount
  IF token_amount_param < 0 THEN
    RAISE EXCEPTION 'Token amount cannot be negative';
  END IF;
  
  IF token_amount_param > parent_token_count THEN
    RAISE EXCEPTION 'Insufficient tokens on parent wish';
  END IF;
  
  -- Enforce 50% rule for partial distributions (unless closing parent)
  IF NOT close_parent_param THEN
    max_distributable := FLOOR(parent_token_count * 0.5);
    IF token_amount_param > max_distributable THEN
      RAISE EXCEPTION 'Cannot distribute more than 50%% of tokens when keeping wish open. Maximum: %', max_distributable;
    END IF;
  END IF;
  
  -- Only distribute tokens if amount > 0
  IF token_amount_param > 0 THEN
    -- Deduct tokens from parent wish
    UPDATE wishes
    SET 
      token_count = token_count - token_amount_param,
      tokens_distributed = tokens_distributed + token_amount_param,
      updated_at = now()
    WHERE id = parent_wish_id_param;
    
    -- Update proposal with tokens received
    UPDATE wishes
    SET 
      tokens_received_on_acceptance = token_amount_param,
      updated_at = now()
    WHERE id = proposal_id_param;
    
    -- Create parent transaction for the deduction from parent wish
    INSERT INTO token_transactions (
      user_id,
      wish_id,
      amount,
      transaction_type,
      direction,
      message,
      created_at
    ) VALUES (
      parent_wish_owner,
      parent_wish_id_param,
      token_amount_param,
      'wish_support',
      'debit',
      COALESCE(
        'Distributed ' || token_amount_param || ' tokens to accepted proposal: ' || acceptance_message_param,
        'Distributed ' || token_amount_param || ' tokens to accepted proposal'
      ),
      now()
    ) RETURNING id INTO parent_transaction_id;
    
    -- Distribute tokens through hierarchy
    SELECT distribute_tokens(
      proposal_id_param,
      token_amount_param,
      parent_transaction_id
    ) INTO distribution_result;
  ELSE
    distribution_result := '{"message": "No tokens distributed"}'::jsonb;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'tokens_distributed', token_amount_param,
    'parent_tokens_remaining', parent_token_count - token_amount_param,
    'distribution_details', distribution_result
  );
END;
$$;

-- Create view for wish token distribution summary
CREATE OR REPLACE VIEW wish_token_distribution_summary AS
SELECT 
  w.id as wish_id,
  w.user_id,
  w.title,
  w.token_count as current_tokens,
  w.tokens_distributed as total_distributed,
  w.token_count + w.tokens_distributed as original_tokens,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'accepted') as accepted_proposals_count,
  COALESCE(SUM(p.tokens_received_on_acceptance) FILTER (WHERE p.status = 'accepted'), 0) as total_tokens_to_proposals,
  CASE 
    WHEN w.status IN ('accepted', 'cancelled', 'rejected') THEN 0
    ELSE FLOOR(w.token_count * 0.5)
  END as max_distributable_per_proposal
FROM wishes w
LEFT JOIN wishes p ON p.parent_wish_id = w.id AND p.wish_type = 'proposal'
WHERE w.wish_type = 'wish'
GROUP BY w.id;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_available_tokens_for_distribution TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_tokens_on_proposal_acceptance TO authenticated;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_wishes_parent_wish_status ON wishes(parent_wish_id, status) WHERE wish_type = 'proposal';
CREATE INDEX IF NOT EXISTS idx_wishes_token_tracking ON wishes(wish_type, tokens_distributed) WHERE token_count > 0;

-- Add comment
COMMENT ON FUNCTION distribute_tokens_on_proposal_acceptance IS 'Distributes tokens from parent wish to proposal creator when proposal is accepted';
COMMENT ON COLUMN wishes.tokens_distributed IS 'Total tokens distributed from this wish to accepted proposals';
COMMENT ON COLUMN wishes.tokens_received_on_acceptance IS 'Tokens received when this proposal was accepted';
