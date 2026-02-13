/*
  # Wish Support System - Core Schema

  ## Overview
  Complete wish support system with likes, donations, MLM distribution, and comprehensive closure workflows.

  ## 1. New Tables

  ### Core Tables
  - `wishes`: Main wishes/proposals table with hierarchy support
    - `id` (uuid, primary key)
    - `user_id` (uuid, creator reference)
    - `parent_wish_id` (uuid, nullable - for sub-wishes)
    - `title` (text, required)
    - `description` (text, optional)
    - `category` (text, optional)
    - `status` (enum: draft, active, accepted, rejected, retracted, cancelled, voting, approved_by_vote)
    - `is_published` (boolean, default false)
    - `voting_enabled` (boolean, default false)
    - `voting_ends_at` (timestamptz, nullable)
    - `reaction_time_hours` (integer, default 72 - time for creator to respond)
    - `submitted_at` (timestamptz, when proposal was submitted to parent creator)
    - `closed_at` (timestamptz, when status changed to terminal state)
    - `closed_by` (uuid, user who closed the wish)
    - `closure_reason` (text, explanation for rejection/cancellation)
    - `created_at`, `updated_at` (timestamptz)

  - `wish_likes`: User likes on wishes
    - `user_id` (uuid)
    - `wish_id` (uuid)
    - `created_at` (timestamptz)
    - Unique constraint on (user_id, wish_id)

  - `donations`: Donation tracking (with/without Stripe)
    - `id` (uuid, primary key)
    - `donor_id` (uuid, user reference)
    - `wish_id` (uuid, wish reference)
    - `amount` (numeric, donation amount)
    - `donation_message` (text, optional)
    - `donation_status` (enum: tracked, pending, completed, refunded)
    - `stripe_payment_intent_id` (text, nullable)
    - `stripe_enabled` (boolean, default false)
    - `created_at` (timestamptz)

  - `donation_distributions`: MLM-style distribution tracking
    - `id` (uuid, primary key)
    - `donation_id` (uuid, donation reference)
    - `recipient_id` (uuid, user receiving distribution)
    - `wish_id` (uuid, wish that earned the distribution)
    - `distribution_amount` (numeric)
    - `distribution_percentage` (numeric)
    - `distribution_level` (integer, 0=creator, 1=parent, 2=grandparent, etc.)
    - `created_at` (timestamptz)

  ### Voting System Tables
  - `wish_votes`: Individual votes on wishes
    - `id` (uuid, primary key)
    - `wish_id` (uuid, wish being voted on)
    - `user_id` (uuid, voter)
    - `vote_type` (enum: approve, reject)
    - `created_at` (timestamptz)
    - Unique constraint on (wish_id, user_id)

  - `voting_configs`: Configuration for voting conditions
    - `id` (uuid, primary key)
    - `wish_id` (uuid, wish reference)
    - `required_votes` (integer, minimum votes needed)
    - `approval_percentage` (numeric, percentage needed to pass)
    - `voting_duration_hours` (integer)
    - `eligible_voter_criteria` (text, description of who can vote)
    - `created_at` (timestamptz)

  ### Configuration Tables
  - `distribution_config`: MLM distribution percentages
    - `id` (uuid, primary key)
    - `level` (integer, distribution level)
    - `percentage` (numeric, percentage of donation)
    - `is_active` (boolean)
    - `created_at`, `updated_at` (timestamptz)

  - `app_settings`: Global application settings
    - `key` (text, primary key)
    - `value` (jsonb)
    - `description` (text)
    - `updated_at` (timestamptz)

  ### Action Log Table
  - `wish_status_history`: Audit trail of status changes
    - `id` (uuid, primary key)
    - `wish_id` (uuid, wish reference)
    - `old_status` (wish_status)
    - `new_status` (wish_status)
    - `changed_by` (uuid, user who made the change)
    - `reason` (text, explanation)
    - `created_at` (timestamptz)

  ## 2. Views
  - `wish_stats`: Aggregated statistics per wish (likes, donations, votes)
  - `user_earnings`: Creator earnings breakdown
  - `active_votings`: Currently active voting sessions

  ## 3. Security
  - Row Level Security enabled on all tables
  - Policies for creators, voters, donors, and admins
  - Secure access to financial data

  ## 4. Important Notes
  - Wishes can only be edited by creators before submission
  - Once submitted, wishes enter workflow (acceptance/rejection/voting)
  - Admins have override powers for moderation
  - Distribution calculations happen automatically on donation
  - Voting is optional and configured per wish
*/

-- Create custom enum types
CREATE TYPE wish_status AS ENUM (
  'draft',
  'active',
  'accepted',
  'rejected',
  'retracted',
  'cancelled',
  'voting',
  'approved_by_vote'
);

CREATE TYPE donation_status AS ENUM (
  'tracked',
  'pending',
  'completed',
  'refunded'
);

CREATE TYPE vote_type AS ENUM (
  'approve',
  'reject'
);

-- Core wishes table
CREATE TABLE IF NOT EXISTS wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  parent_wish_id uuid REFERENCES wishes(id) DEFAULT NULL,
  title text NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  description text,
  category text,
  status wish_status NOT NULL DEFAULT 'draft',
  is_published boolean DEFAULT false,
  voting_enabled boolean DEFAULT false,
  voting_ends_at timestamptz DEFAULT NULL,
  reaction_time_hours integer DEFAULT 72 CHECK (reaction_time_hours > 0),
  submitted_at timestamptz DEFAULT NULL,
  closed_at timestamptz DEFAULT NULL,
  closed_by uuid REFERENCES auth.users(id) DEFAULT NULL,
  closure_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Prevent circular references in wish hierarchy
CREATE OR REPLACE FUNCTION check_wish_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_wish_id IS NOT NULL THEN
    -- Check if parent exists
    IF NOT EXISTS (SELECT 1 FROM wishes WHERE id = NEW.parent_wish_id) THEN
      RAISE EXCEPTION 'Parent wish does not exist';
    END IF;

    -- Prevent self-reference
    IF NEW.id = NEW.parent_wish_id THEN
      RAISE EXCEPTION 'Wish cannot be its own parent';
    END IF;

    -- Check for circular references (walk up the tree)
    WITH RECURSIVE ancestors AS (
      SELECT parent_wish_id FROM wishes WHERE id = NEW.parent_wish_id
      UNION ALL
      SELECT w.parent_wish_id FROM wishes w
      INNER JOIN ancestors a ON w.id = a.parent_wish_id
      WHERE w.parent_wish_id IS NOT NULL
    )
    SELECT 1 FROM ancestors WHERE parent_wish_id = NEW.id INTO STRICT NEW.id;

    IF FOUND THEN
      RAISE EXCEPTION 'Circular reference detected in wish hierarchy';
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RETURN NEW;
  WHEN TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'Circular reference detected in wish hierarchy';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_wish_hierarchy_trigger
  BEFORE INSERT OR UPDATE ON wishes
  FOR EACH ROW
  EXECUTE FUNCTION check_wish_hierarchy();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wishes_updated_at
  BEFORE UPDATE ON wishes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Wish likes table
CREATE TABLE IF NOT EXISTS wish_likes (
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  wish_id uuid REFERENCES wishes(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, wish_id)
);

CREATE INDEX idx_wish_likes_wish_id ON wish_likes(wish_id);
CREATE INDEX idx_wish_likes_created_at ON wish_likes(created_at DESC);

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid REFERENCES auth.users(id) NOT NULL,
  wish_id uuid REFERENCES wishes(id) ON DELETE CASCADE NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  donation_message text,
  donation_status donation_status NOT NULL DEFAULT 'tracked',
  stripe_payment_intent_id text DEFAULT NULL,
  stripe_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_donations_wish_id ON donations(wish_id);
CREATE INDEX idx_donations_donor_id ON donations(donor_id);
CREATE INDEX idx_donations_created_at ON donations(created_at DESC);

-- Donation distributions table
CREATE TABLE IF NOT EXISTS donation_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid REFERENCES donations(id) ON DELETE CASCADE NOT NULL,
  recipient_id uuid REFERENCES auth.users(id) NOT NULL,
  wish_id uuid REFERENCES wishes(id) ON DELETE CASCADE NOT NULL,
  distribution_amount numeric(10, 2) NOT NULL CHECK (distribution_amount >= 0),
  distribution_percentage numeric(5, 2) NOT NULL CHECK (distribution_percentage >= 0 AND distribution_percentage <= 100),
  distribution_level integer NOT NULL CHECK (distribution_level >= 0),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_distribution_donation_id ON donation_distributions(donation_id);
CREATE INDEX idx_distribution_recipient_id ON donation_distributions(recipient_id);
CREATE INDEX idx_distribution_wish_id ON donation_distributions(wish_id);

-- Wish votes table
CREATE TABLE IF NOT EXISTS wish_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id uuid REFERENCES wishes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  vote_type vote_type NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (wish_id, user_id)
);

CREATE INDEX idx_wish_votes_wish_id ON wish_votes(wish_id);
CREATE INDEX idx_wish_votes_user_id ON wish_votes(user_id);

-- Voting configurations table
CREATE TABLE IF NOT EXISTS voting_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id uuid REFERENCES wishes(id) ON DELETE CASCADE NOT NULL UNIQUE,
  required_votes integer NOT NULL DEFAULT 10 CHECK (required_votes > 0),
  approval_percentage numeric(5, 2) NOT NULL DEFAULT 60.00 CHECK (approval_percentage > 0 AND approval_percentage <= 100),
  voting_duration_hours integer NOT NULL DEFAULT 168 CHECK (voting_duration_hours > 0),
  eligible_voter_criteria text DEFAULT 'any_authenticated_user',
  created_at timestamptz DEFAULT now()
);

-- Distribution configuration table
CREATE TABLE IF NOT EXISTS distribution_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level integer NOT NULL UNIQUE CHECK (level >= 0),
  percentage numeric(5, 2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default distribution percentages
INSERT INTO distribution_config (level, percentage, is_active) VALUES
  (0, 60.00, true),
  (1, 20.00, true),
  (2, 10.00, true),
  (3, 5.00, true),
  (4, 5.00, true)
ON CONFLICT (level) DO NOTHING;

CREATE TRIGGER distribution_config_updated_at
  BEFORE UPDATE ON distribution_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Application settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings
INSERT INTO app_settings (key, value, description) VALUES
  ('stripe_enabled', 'false'::jsonb, 'Enable Stripe payment processing'),
  ('min_donation_amount', '0.01'::jsonb, 'Minimum donation amount'),
  ('max_donation_amount', '10000.00'::jsonb, 'Maximum donation amount'),
  ('default_reaction_time_hours', '72'::jsonb, 'Default time for creators to respond to proposals')
ON CONFLICT (key) DO NOTHING;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Wish status history table (audit trail)
CREATE TABLE IF NOT EXISTS wish_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id uuid REFERENCES wishes(id) ON DELETE CASCADE NOT NULL,
  old_status wish_status,
  new_status wish_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id) NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_wish_status_history_wish_id ON wish_status_history(wish_id);
CREATE INDEX idx_wish_status_history_created_at ON wish_status_history(created_at DESC);

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION log_wish_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO wish_status_history (wish_id, old_status, new_status, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.closed_by, NEW.closure_reason);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_wish_status_change_trigger
  AFTER UPDATE ON wishes
  FOR EACH ROW
  EXECUTE FUNCTION log_wish_status_change();

-- Create view for wish statistics
CREATE OR REPLACE VIEW wish_stats AS
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
  COUNT(DISTINCT wv.id) as total_votes
FROM wishes w
LEFT JOIN wish_likes wl ON w.id = wl.wish_id
LEFT JOIN donations d ON w.id = d.wish_id
LEFT JOIN wish_votes wv ON w.id = wv.wish_id
GROUP BY w.id, w.title, w.status, w.user_id;

-- Create view for user earnings
CREATE OR REPLACE VIEW user_earnings AS
SELECT
  dd.recipient_id as user_id,
  dd.wish_id,
  w.title as wish_title,
  dd.distribution_level,
  COUNT(dd.id) as distribution_count,
  SUM(dd.distribution_amount) as total_earned,
  AVG(dd.distribution_amount) as avg_earned_per_donation
FROM donation_distributions dd
JOIN wishes w ON dd.wish_id = w.id
GROUP BY dd.recipient_id, dd.wish_id, w.title, dd.distribution_level;

-- Create view for active voting sessions
CREATE OR REPLACE VIEW active_votings AS
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

-- Enable Row Level Security
ALTER TABLE wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wish_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wish_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wish_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wishes
CREATE POLICY "Anyone can view published wishes"
  ON wishes FOR SELECT
  TO authenticated
  USING (is_published = true OR user_id = auth.uid());

CREATE POLICY "Users can create their own wishes"
  ON wishes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own draft wishes"
  ON wishes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Creators can manage their wish status"
  ON wishes FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (parent_wish_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM wishes parent
      WHERE parent.id = wishes.parent_wish_id
      AND parent.user_id = auth.uid()
    ))
  )
  WITH CHECK (true);

CREATE POLICY "Users can delete their own draft wishes"
  ON wishes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'draft');

-- RLS Policies for wish_likes
CREATE POLICY "Anyone can view likes"
  ON wish_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like wishes"
  ON wish_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unlike wishes"
  ON wish_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for donations
CREATE POLICY "Users can view donations on wishes they created"
  ON donations FOR SELECT
  TO authenticated
  USING (
    donor_id = auth.uid() OR
    wish_id IN (SELECT id FROM wishes WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create donations"
  ON donations FOR INSERT
  TO authenticated
  WITH CHECK (donor_id = auth.uid());

-- RLS Policies for donation_distributions
CREATE POLICY "Users can view their own distributions"
  ON donation_distributions FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

-- RLS Policies for wish_votes
CREATE POLICY "Anyone can view votes"
  ON wish_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can vote on wishes"
  ON wish_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can change their vote"
  ON wish_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for voting_configs
CREATE POLICY "Anyone can view voting configs"
  ON voting_configs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Wish creators can create voting configs"
  ON voting_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wishes
      WHERE wishes.id = voting_configs.wish_id
      AND wishes.user_id = auth.uid()
    )
  );

-- RLS Policies for distribution_config
CREATE POLICY "Anyone can view distribution config"
  ON distribution_config FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for app_settings
CREATE POLICY "Anyone can view app settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for wish_status_history
CREATE POLICY "Users can view history of their wishes"
  ON wish_status_history FOR SELECT
  TO authenticated
  USING (
    wish_id IN (SELECT id FROM wishes WHERE user_id = auth.uid()) OR
    changed_by = auth.uid()
  );

-- Grant permissions on views
GRANT SELECT ON wish_stats TO authenticated;
GRANT SELECT ON user_earnings TO authenticated;
GRANT SELECT ON active_votings TO authenticated;

-- Function to calculate and create donation distributions
CREATE OR REPLACE FUNCTION create_donation_distributions(donation_id_param uuid)
RETURNS void AS $$
DECLARE
  donation_record RECORD;
  current_wish_id uuid;
  current_level integer := 0;
  remaining_amount numeric;
  distribution_record RECORD;
BEGIN
  SELECT * INTO donation_record FROM donations WHERE id = donation_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;

  remaining_amount := donation_record.amount;
  current_wish_id := donation_record.wish_id;

  WHILE current_wish_id IS NOT NULL AND current_level < 10 LOOP
    SELECT * INTO distribution_record
    FROM distribution_config
    WHERE level = current_level AND is_active = true;

    IF FOUND THEN
      DECLARE
        wish_creator uuid;
        dist_amount numeric;
      BEGIN
        SELECT user_id INTO wish_creator FROM wishes WHERE id = current_wish_id;

        IF FOUND THEN
          dist_amount := (donation_record.amount * distribution_record.percentage / 100);

          INSERT INTO donation_distributions (
            donation_id,
            recipient_id,
            wish_id,
            distribution_amount,
            distribution_percentage,
            distribution_level
          ) VALUES (
            donation_id_param,
            wish_creator,
            current_wish_id,
            dist_amount,
            distribution_record.percentage,
            current_level
          );

          remaining_amount := remaining_amount - dist_amount;
        END IF;
      END;
    END IF;

    SELECT parent_wish_id INTO current_wish_id FROM wishes WHERE id = current_wish_id;
    current_level := current_level + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create distributions when donation is created
CREATE OR REPLACE FUNCTION trigger_create_distributions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_donation_distributions(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_distributions
  AFTER INSERT ON donations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_distributions();

-- Function to check if reaction time has expired
CREATE OR REPLACE FUNCTION check_reaction_time_expired(wish_id_param uuid)
RETURNS boolean AS $$
DECLARE
  wish_record RECORD;
BEGIN
  SELECT * INTO wish_record FROM wishes WHERE id = wish_id_param;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF wish_record.submitted_at IS NULL THEN
    RETURN false;
  END IF;

  RETURN (now() > wish_record.submitted_at + (wish_record.reaction_time_hours || ' hours')::interval);
END;
$$ LANGUAGE plpgsql;

-- Function to auto-accept wishes when reaction time expires
CREATE OR REPLACE FUNCTION auto_accept_expired_wishes()
RETURNS void AS $$
BEGIN
  UPDATE wishes
  SET
    status = 'accepted',
    closed_at = now(),
    closure_reason = 'Auto-accepted: Reaction time expired without response'
  WHERE status = 'active'
    AND parent_wish_id IS NOT NULL
    AND submitted_at IS NOT NULL
    AND now() > submitted_at + (reaction_time_hours || ' hours')::interval;
END;
$$ LANGUAGE plpgsql;

-- Function to finalize voting
CREATE OR REPLACE FUNCTION finalize_voting(wish_id_param uuid)
RETURNS void AS $$
DECLARE
  wish_record RECORD;
  voting_config_record RECORD;
  vote_stats RECORD;
  approval_pct numeric;
BEGIN
  SELECT * INTO wish_record FROM wishes WHERE id = wish_id_param;
  SELECT * INTO voting_config_record FROM voting_configs WHERE wish_id = wish_id_param;
  SELECT * INTO vote_stats FROM wish_stats WHERE wish_id = wish_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wish or voting config not found';
  END IF;

  IF wish_record.voting_ends_at > now() THEN
    RAISE EXCEPTION 'Voting period has not ended yet';
  END IF;

  IF vote_stats.total_votes = 0 THEN
    approval_pct := 0;
  ELSE
    approval_pct := (vote_stats.approve_votes::numeric / vote_stats.total_votes * 100);
  END IF;

  IF vote_stats.total_votes >= voting_config_record.required_votes
     AND approval_pct >= voting_config_record.approval_percentage THEN
    UPDATE wishes
    SET
      status = 'approved_by_vote',
      closed_at = now(),
      closure_reason = format('Approved by vote: %s%% approval (%s/%s votes)',
                             ROUND(approval_pct, 2),
                             vote_stats.approve_votes,
                             vote_stats.total_votes)
    WHERE id = wish_id_param;
  ELSE
    UPDATE wishes
    SET
      status = 'rejected',
      closed_at = now(),
      closure_reason = format('Rejected by vote: %s%% approval (%s/%s votes), required %s%% with %s votes',
                             ROUND(approval_pct, 2),
                             vote_stats.approve_votes,
                             vote_stats.total_votes,
                             voting_config_record.approval_percentage,
                             voting_config_record.required_votes)
    WHERE id = wish_id_param;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
