import { supabase } from './supabase';
import type { UserTokens, TokenTransaction } from '../types/database';

export async function getUserTokenBalance(): Promise<UserTokens | null> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data, error } = await supabase
    .from('user_tokens')
    .select('*')
    .eq('user_id', user.user.id)
    .maybeSingle();

  if (error) throw error;
  return data as UserTokens | null;
}

export async function sendTokensToWish(
  wishId: string,
  amount: number,
  message?: string
): Promise<string> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('distribute_tokens_to_wish', {
    p_sender_id: user.user.id,
    p_wish_id: wishId,
    p_amount: amount,
    p_message: message || null,
  });

  if (error) throw error;
  return data as string;
}

export async function adminGrantTokensByEmail(
  targetEmail: string,
  amount: number,
  message?: string
): Promise<string> {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('admin_grant_tokens_by_email', {
    p_target_email: targetEmail,
    p_amount: amount,
    p_admin_email: currentUser.user.email || '',
    p_message: message || null,
  });

  if (error) throw error;
  return data as string;
}

export async function getUserTransactions(limit = 50): Promise<TokenTransaction[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const { data, error } = await supabase
    .from('token_transactions')
    .select('*')
    .eq('user_id', user.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as TokenTransaction[];
}

export interface TokenDistributionInfo {
  currentTokens: number;
  tokensDistributed: number;
  availableForDistribution: number;
  maxPerProposal: number;
  acceptedProposalsCount: number;
}

export async function getWishTokenDistributionInfo(wishId: string): Promise<TokenDistributionInfo> {
  const { data, error } = await supabase
    .from('wish_token_distribution_summary')
    .select('*')
    .eq('wish_id', wishId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      currentTokens: 0,
      tokensDistributed: 0,
      availableForDistribution: 0,
      maxPerProposal: 0,
      acceptedProposalsCount: 0,
    };
  }

  return {
    currentTokens: data.current_tokens || 0,
    tokensDistributed: data.total_distributed || 0,
    availableForDistribution: data.current_tokens || 0,
    maxPerProposal: data.max_distributable_per_proposal || 0,
    acceptedProposalsCount: data.accepted_proposals_count || 0,
  };
}

export function calculateEqualSplitAmount(
  availableTokens: number,
  numberOfProposals: number
): number {
  if (numberOfProposals === 0) return 0;
  const maxDistributable = Math.floor(availableTokens * 0.5);
  return Math.floor(maxDistributable / numberOfProposals);
}

export function calculateMaxDistributableTokens(
  currentTokens: number,
  isFullSettlement: boolean
): number {
  if (isFullSettlement) {
    return currentTokens;
  }
  return Math.floor(currentTokens * 0.5);
}

export function validateTokenDistribution(
  amount: number,
  availableTokens: number,
  isFullSettlement: boolean
): { valid: boolean; error?: string } {
  if (amount < 0) {
    return { valid: false, error: 'Token amount cannot be negative' };
  }

  if (amount > availableTokens) {
    return { valid: false, error: 'Insufficient tokens available' };
  }

  if (!isFullSettlement) {
    const maxAllowed = Math.floor(availableTokens * 0.5);
    if (amount > maxAllowed) {
      return {
        valid: false,
        error: `Cannot distribute more than 50% (${maxAllowed} tokens) when keeping wish open`,
      };
    }
  }

  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Token amount must be a whole number' };
  }

  return { valid: true };
}

export async function distributeTokensOnProposalAcceptance(
  parentWishId: string,
  proposalId: string,
  tokenAmount: number,
  closeParent: boolean,
  acceptanceMessage?: string
): Promise<any> {
  const { data, error } = await supabase.rpc('distribute_tokens_on_proposal_acceptance', {
    parent_wish_id_param: parentWishId,
    proposal_id_param: proposalId,
    token_amount_param: tokenAmount,
    close_parent_param: closeParent,
    acceptance_message_param: acceptanceMessage || null,
  });

  if (error) throw error;
  return data;
}
