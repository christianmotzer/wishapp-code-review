/*
  # Add Proposal System

  Introduces the concept of "proposals" as a distinct wish type within the multi-level
  task force solution management system. Proposals are direct solutions submitted to
  a parent wish. Sub-wishes remain for problem decomposition.

  ## 1. Schema Changes
    - Add `wish_type` column to `wishes` table
      - Values: 'wish' (default) or 'proposal'
      - Proposals must always have a parent_wish_id

  ## 2. New Constraints
    - `wish_type_check`: Restricts wish_type to valid values
    - `proposals_need_parent`: Ensures proposals always reference a parent wish

  ## 3. New Triggers
    - `prevent_retraction_with_active_children`: Blocks retraction of wishes that have
      active proposals or sub-wishes in non-terminal states (admin cancel bypasses this)

  ## 4. Updated Views
    - `wish_stats`: Added `proposal_count` and `sub_wish_count` columns
    - `active_votings`: Recreated (depends on wish_stats)

  ## 5. New Indexes
    - `idx_wishes_wish_type`: For filtering by wish type
    - `idx_wishes_parent_type`: Composite index for parent + type queries

  ## 6. Security
    - No RLS changes needed (wish_type is on the existing wishes table)
*/

-- Add wish_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wishes' AND column_name = 'wish_type'
  ) THEN
    ALTER TABLE wishes ADD COLUMN wish_type text NOT NULL DEFAULT 'wish';
    ALTER TABLE wishes ADD CONSTRAINT wish_type_check CHECK (wish_type IN ('wish', 'proposal'));
  END IF;
END $$;

-- Add constraint: proposals must have a parent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'proposals_need_parent' AND table_name = 'wishes'
  ) THEN
    ALTER TABLE wishes ADD CONSTRAINT proposals_need_parent CHECK (
      wish_type = 'wish' OR parent_wish_id IS NOT NULL
    );
  END IF;
END $$;

-- Lifecycle guard: prevent retraction of wishes with active children
CREATE OR REPLACE FUNCTION prevent_retraction_with_active_children()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'retracted' AND (OLD.status IS DISTINCT FROM 'retracted') THEN
    IF EXISTS (
      SELECT 1 FROM wishes
      WHERE parent_wish_id = NEW.id
      AND status IN ('active', 'voting', 'draft')
    ) THEN
      RAISE EXCEPTION 'Cannot retract: this wish has active proposals or sub-wishes. Resolve or retract them first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_retraction_trigger ON wishes;
CREATE TRIGGER prevent_retraction_trigger
  BEFORE UPDATE ON wishes
  FOR EACH ROW
  EXECUTE FUNCTION prevent_retraction_with_active_children();

-- Drop dependent views before recreating wish_stats
DROP VIEW IF EXISTS active_votings;
DROP VIEW IF EXISTS wish_stats;

-- Recreate wish_stats with proposal_count and sub_wish_count
CREATE VIEW wish_stats AS
SELECT
  w.id as wish_id,
  w.title,
  w.status,
  w.user_id as creator_id,
  COUNT(DISTINCT wl.user_id) as like_count,
  COUNT(DISTINCT d.id) as donation_count,
  COALESCE(SUM(d.amount), 0) as total_donations,
  COUNT(DISTINCT d.donor_id) as unique_donors,
  COUNT(DISTINCT wv.id) FILTER (WHERE wv.vote_type = 'approve') as approve_votes,
  COUNT(DISTINCT wv.id) FILTER (WHERE wv.vote_type = 'reject') as reject_votes,
  COUNT(DISTINCT wv.id) as total_votes,
  (SELECT COUNT(*) FROM wishes cw WHERE cw.parent_wish_id = w.id AND cw.wish_type = 'proposal' AND cw.is_published = true) as proposal_count,
  (SELECT COUNT(*) FROM wishes cw WHERE cw.parent_wish_id = w.id AND cw.wish_type = 'wish' AND cw.is_published = true) as sub_wish_count
FROM wishes w
LEFT JOIN wish_likes wl ON w.id = wl.wish_id
LEFT JOIN donations d ON w.id = d.wish_id
LEFT JOIN wish_votes wv ON w.id = wv.wish_id
GROUP BY w.id, w.title, w.status, w.user_id;

-- Recreate active_votings view
CREATE VIEW active_votings AS
SELECT
  w.id as wish_id,
  w.title,
  w.user_id as creator_id,
  w.voting_ends_at,
  vc.required_votes,
  vc.approval_percentage,
  ws.approve_votes,
  ws.reject_votes,
  ws.total_votes,
  CASE
    WHEN ws.total_votes >= vc.required_votes THEN
      CASE
        WHEN (ws.approve_votes::numeric / NULLIF(ws.total_votes, 0) * 100) >= vc.approval_percentage THEN 'passing'
        ELSE 'failing'
      END
    ELSE 'pending'
  END as vote_status,
  (ws.approve_votes::numeric / NULLIF(ws.total_votes, 0) * 100) as current_approval_percentage
FROM wishes w
JOIN voting_configs vc ON w.id = vc.wish_id
LEFT JOIN wish_stats ws ON w.id = ws.wish_id
WHERE w.status = 'voting'
  AND w.voting_ends_at > now();

-- Re-grant permissions on views
GRANT SELECT ON wish_stats TO authenticated;
GRANT SELECT ON active_votings TO authenticated;

-- Add indexes for type-based queries
CREATE INDEX IF NOT EXISTS idx_wishes_wish_type ON wishes(wish_type);
CREATE INDEX IF NOT EXISTS idx_wishes_parent_type ON wishes(parent_wish_id, wish_type) WHERE parent_wish_id IS NOT NULL;
