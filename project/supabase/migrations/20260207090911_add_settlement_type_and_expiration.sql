/*
  # Add proposal settlement type and wish expiration

  1. Modified Tables
    - `wishes`
      - Added `settlement_type` (text, nullable): 'full_settlement' or 'partial_contribution'
        Only applicable to proposals. Indicates whether the proposal aims to fully
        resolve the parent wish or just contribute partially.
      - Added `expires_at` (timestamptz, nullable): Optional expiration date for wishes.
        After this date, the wish no longer accepts new proposals or tokens.

  2. New Functions
    - `close_wish_with_children(wish_id, closer_id, reason, close_children)`:
      Closes a wish and optionally cascades the closure to all active sub-wishes
      and proposals.

  3. Indexes
    - `idx_wishes_expires_at` for efficient expiration queries
    - `idx_wishes_settlement_type` for filtering by settlement type

  4. Important Notes
    - settlement_type constraint ensures only valid values
    - Proposals with 'full_settlement' signal to the parent wish creator that
      accepting this proposal should close the parent wish
    - Expiration is purely a deadline; it does not auto-close the wish in the database,
      but the application enforces it by preventing actions on expired wishes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wishes' AND column_name = 'settlement_type'
  ) THEN
    ALTER TABLE wishes ADD COLUMN settlement_type text;
    ALTER TABLE wishes ADD CONSTRAINT valid_settlement_type
      CHECK (settlement_type IS NULL OR settlement_type IN ('full_settlement', 'partial_contribution'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wishes' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE wishes ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wishes_expires_at ON wishes(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wishes_settlement_type ON wishes(settlement_type) WHERE settlement_type IS NOT NULL;

CREATE OR REPLACE FUNCTION close_wish_with_children(
  p_wish_id uuid,
  p_closer_id uuid,
  p_reason text,
  p_close_children boolean DEFAULT false
) RETURNS void AS $$
DECLARE
  v_child RECORD;
BEGIN
  UPDATE wishes SET
    status = 'accepted',
    closed_at = now(),
    closed_by = p_closer_id,
    closure_reason = p_reason
  WHERE id = p_wish_id
    AND status NOT IN ('accepted', 'rejected', 'retracted', 'cancelled', 'approved_by_vote');

  IF p_close_children THEN
    FOR v_child IN
      SELECT id FROM wishes
      WHERE parent_wish_id = p_wish_id
        AND status IN ('active', 'voting', 'draft')
    LOOP
      UPDATE wishes SET
        status = 'cancelled',
        closed_at = now(),
        closed_by = p_closer_id,
        closure_reason = 'Parent wish was closed: ' || p_reason
      WHERE id = v_child.id;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
