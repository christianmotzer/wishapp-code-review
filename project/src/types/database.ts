export type WishStatus =
  | 'draft'
  | 'active'
  | 'accepted'
  | 'rejected'
  | 'retracted'
  | 'cancelled'
  | 'voting'
  | 'approved_by_vote';

export type WishType = 'wish' | 'proposal';

export type WishVisibility = 'public' | 'friends_only';

export type SettlementType = 'full_settlement' | 'partial_contribution';

export type DonationStatus = 'tracked' | 'pending' | 'completed' | 'refunded';

export type VoteType = 'approve' | 'reject';

export type TokenTransactionType = 'admin_grant' | 'wish_support' | 'hierarchy_distribution';

export type AccountStatus = 'active' | 'blocked' | 'deleted';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface Wish {
  id: string;
  user_id: string;
  parent_wish_id: string | null;
  wish_type: WishType;
  title: string;
  description: string | null;
  category: string | null;
  status: WishStatus;
  is_published: boolean;
  visibility: WishVisibility;
  show_creator_name: boolean;
  voting_enabled: boolean;
  voting_ends_at: string | null;
  reaction_time_hours: number;
  settlement_type: SettlementType | null;
  expires_at: string | null;
  token_count: number;
  tokens_distributed: number;
  tokens_received_on_acceptance: number;
  submitted_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  closure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface WishLike {
  user_id: string;
  wish_id: string;
  created_at: string;
}

export interface Donation {
  id: string;
  donor_id: string;
  wish_id: string;
  amount: number;
  donation_message: string | null;
  donation_status: DonationStatus;
  stripe_payment_intent_id: string | null;
  stripe_enabled: boolean;
  created_at: string;
}

export interface DonationDistribution {
  id: string;
  donation_id: string;
  recipient_id: string;
  wish_id: string;
  distribution_amount: number;
  distribution_percentage: number;
  distribution_level: number;
  created_at: string;
}

export interface WishVote {
  id: string;
  wish_id: string;
  user_id: string;
  vote_type: VoteType;
  created_at: string;
}

export interface VotingConfig {
  id: string;
  wish_id: string;
  required_votes: number;
  approval_percentage: number;
  voting_duration_hours: number;
  eligible_voter_criteria: string;
  created_at: string;
}

export interface DistributionConfig {
  id: string;
  level: number;
  percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  key: string;
  value: any;
  description: string | null;
  updated_at: string;
}

export interface WishStatusHistory {
  id: string;
  wish_id: string;
  old_status: WishStatus | null;
  new_status: WishStatus;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

export interface WishStats {
  wish_id: string;
  title: string;
  status: WishStatus;
  creator_id: string;
  like_count: number;
  donation_count: number;
  total_donations: number;
  unique_donors: number;
  approve_votes: number;
  reject_votes: number;
  total_votes: number;
  proposal_count: number;
  sub_wish_count: number;
}

export interface UserEarnings {
  user_id: string;
  wish_id: string;
  wish_title: string;
  distribution_level: number;
  distribution_count: number;
  total_earned: number;
  avg_earned_per_donation: number;
}

export interface ActiveVoting {
  wish_id: string;
  title: string;
  creator_id: string;
  voting_ends_at: string | null;
  required_votes: number;
  approval_percentage: number;
  approve_votes: number;
  reject_votes: number;
  total_votes: number;
  vote_status: 'passing' | 'failing' | 'pending';
  current_approval_percentage: number;
}

export interface UserTokens {
  user_id: string;
  balance: number;
  total_received: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface TokenTransaction {
  id: string;
  user_id: string;
  wish_id: string | null;
  amount: number;
  transaction_type: TokenTransactionType;
  direction: 'credit' | 'debit';
  parent_transaction_id: string | null;
  admin_email: string | null;
  message: string | null;
  created_at: string;
}

export interface WishWithStats extends Wish {
  stats?: WishStats;
  creator_display_name?: string | null;
  creator?: {
    id: string;
    email: string;
  };
  parent_wish?: {
    id: string;
    title: string;
  };
  user_has_liked?: boolean;
  user_vote?: VoteType | null;
}
