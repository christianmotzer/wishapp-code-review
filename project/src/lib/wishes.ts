import { supabase } from './supabase';
import type { Wish, WishWithStats, WishStatus, WishType, VoteType, SettlementType } from '../types/database';

const TERMINAL_STATUSES: WishStatus[] = ['accepted', 'rejected', 'retracted', 'cancelled', 'approved_by_vote'];

export type VisibilityFilter = 'all' | 'public' | 'friends' | 'own';

export interface WishFilters {
  category?: string;
  status?: string;
  userId?: string;
  searchQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  minSupporters?: number;
  sortBy?: 'recent' | 'popular' | 'supporters' | 'tokens';
  visibility?: VisibilityFilter;
}

export async function getPublishedWishes(filters?: WishFilters) {
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;

  let query = supabase
    .from('wishes')
    .select('*')
    .eq('is_published', true)
    .neq('wish_type', 'proposal');

  const visibilityFilter = filters?.visibility || 'all';

  if (visibilityFilter === 'own' && userId) {
    query = query.eq('user_id', userId);
  } else if (visibilityFilter === 'public') {
    query = query.eq('visibility', 'public');
  } else if (visibilityFilter === 'friends') {
    query = query.eq('visibility', 'friends_only');
  }

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  }

  const searchQuery = filters?.searchQuery;

  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
  }

  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const sortBy = filters?.sortBy || 'popular';
  if (sortBy === 'recent') {
    query = query.order('created_at', { ascending: false });
  } else if (sortBy === 'tokens') {
    query = query.order('token_count', { ascending: false });
    query = query.order('created_at', { ascending: false });
  } else {
    query = query.order('token_count', { ascending: false });
    query = query.order('created_at', { ascending: false });
  }

  const { data: wishes, error: wishesError } = await query;

  if (wishesError) throw wishesError;
  if (!wishes) return [];

  const wishIds = wishes.map(w => w.id);
  const creatorIds = [...new Set(wishes.map(w => w.user_id))];

  const [statsResult, likesResult, creatorsResult] = await Promise.all([
    supabase.from('wish_stats').select('*').in('wish_id', wishIds),
    userId
      ? supabase.from('wish_likes').select('wish_id').eq('user_id', userId).in('wish_id', wishIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('user_profiles').select('user_id, display_name').in('user_id', creatorIds),
  ]);

  const statsMap = new Map(statsResult.data?.map(s => [s.wish_id, s]) || []);
  const likesSet = new Set(likesResult.data?.map(l => l.wish_id) || []);
  const creatorMap = new Map(creatorsResult.data?.map(c => [c.user_id, c.display_name]) || []);

  let wishesWithStats = wishes.map(wish => ({
    ...wish,
    stats: statsMap.get(wish.id),
    user_has_liked: likesSet.has(wish.id),
    creator_display_name: creatorMap.get(wish.user_id) || null,
  })) as WishWithStats[];

  if (searchQuery) {
    const { data: creatorNameProfiles } = await supabase
      .from('user_profiles')
      .select('user_id')
      .ilike('display_name', `%${searchQuery}%`);

    if (creatorNameProfiles && creatorNameProfiles.length > 0) {
      const matchingUserIds = creatorNameProfiles.map(p => p.user_id);
      const existingIds = new Set(wishesWithStats.map(w => w.id));

      const { data: creatorWishes } = await supabase
        .from('wishes')
        .select('*')
        .in('user_id', matchingUserIds)
        .eq('is_published', true)
        .eq('show_creator_name', true)
        .neq('wish_type', 'proposal');

      if (creatorWishes) {
        for (const cw of creatorWishes) {
          if (!existingIds.has(cw.id)) {
            wishesWithStats.push({
              ...cw,
              stats: statsMap.get(cw.id),
              user_has_liked: likesSet.has(cw.id),
              creator_display_name: creatorMap.get(cw.user_id) || null,
            } as WishWithStats);
          }
        }
      }
    }
  }

  if (filters?.minSupporters !== undefined) {
    wishesWithStats = wishesWithStats.filter(w => (w.stats?.unique_donors || 0) >= (filters.minSupporters || 0));
  }

  if (sortBy === 'supporters') {
    wishesWithStats.sort((a, b) => (b.stats?.unique_donors || 0) - (a.stats?.unique_donors || 0));
  }

  return wishesWithStats;
}

export async function getWishById(wishId: string) {
  const { data, error } = await supabase
    .from('wishes')
    .select('*')
    .eq('id', wishId)
    .maybeSingle();

  if (error) throw error;
  return data as Wish | null;
}

export async function getWishWithStats(wishId: string) {
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;

  const [wishResult, statsResult, likeResult, voteResult] = await Promise.all([
    supabase.from('wishes').select('*').eq('id', wishId).maybeSingle(),
    supabase.from('wish_stats').select('*').eq('wish_id', wishId).maybeSingle(),
    userId
      ? supabase
          .from('wish_likes')
          .select('*')
          .eq('wish_id', wishId)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    userId
      ? supabase
          .from('wish_votes')
          .select('vote_type')
          .eq('wish_id', wishId)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (wishResult.error) throw wishResult.error;

  let creatorName: string | null = null;
  if (wishResult.data?.user_id) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', wishResult.data.user_id)
      .maybeSingle();
    creatorName = profile?.display_name || null;
  }

  return {
    ...wishResult.data,
    stats: statsResult.data || undefined,
    creator_display_name: creatorName,
    user_has_liked: !!likeResult.data,
    user_vote: voteResult.data?.vote_type || null,
  } as WishWithStats;
}

export async function getChildWishes(parentWishId: string) {
  const { data, error } = await supabase
    .from('wishes')
    .select('*')
    .eq('parent_wish_id', parentWishId)
    .eq('wish_type', 'wish')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Wish[];
}

export async function getProposalsForWish(wishId: string) {
  const { data, error } = await supabase
    .from('wishes')
    .select('*')
    .eq('parent_wish_id', wishId)
    .eq('wish_type', 'proposal')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Wish[];
}

export async function getActiveChildCount(wishId: string) {
  const { count, error } = await supabase
    .from('wishes')
    .select('*', { count: 'exact', head: true })
    .eq('parent_wish_id', wishId)
    .in('status', ['active', 'voting', 'draft']);

  if (error) throw error;
  return count || 0;
}

export async function getUserWishes(userId: string) {
  const { data, error } = await supabase
    .from('wishes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Wish[];
}

export async function createWish(wish: {
  title: string;
  description?: string;
  category?: string;
  parent_wish_id?: string;
  is_published?: boolean;
  wish_type?: WishType;
  settlement_type?: SettlementType;
  expires_at?: string;
  visibility?: 'public' | 'friends_only';
  show_creator_name?: boolean;
}) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('wishes')
    .insert({
      ...wish,
      wish_type: wish.wish_type || 'wish',
      user_id: user.user.id,
      status: wish.is_published ? 'active' : 'draft',
      visibility: wish.visibility || 'public',
      show_creator_name: wish.show_creator_name ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Wish;
}

export async function createProposal(proposal: {
  title: string;
  description?: string;
  category?: string;
  parent_wish_id: string;
  is_published?: boolean;
  settlement_type?: SettlementType;
}) {
  return createWish({ ...proposal, wish_type: 'proposal' });
}

export async function updateWish(wishId: string, updates: Partial<Wish>) {
  const { data, error } = await supabase
    .from('wishes')
    .update(updates)
    .eq('id', wishId)
    .select()
    .single();

  if (error) throw error;
  return data as Wish;
}

export async function deleteWish(wishId: string) {
  const { error } = await supabase.from('wishes').delete().eq('id', wishId);

  if (error) throw error;
}

export async function publishWish(wishId: string) {
  return updateWish(wishId, { is_published: true, status: 'active' });
}

export async function acceptWish(
  wishId: string,
  reason?: string,
  closeParent = true,
  tokenDistribution?: {
    amount: number;
  }
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const wish = await getWishById(wishId);
  if (!wish) throw new Error('Wish not found');

  if (wish.wish_type === 'proposal' && wish.parent_wish_id && tokenDistribution) {
    const { distributeTokensOnProposalAcceptance } = await import('./tokens');

    await distributeTokensOnProposalAcceptance(
      wish.parent_wish_id,
      wishId,
      tokenDistribution.amount,
      closeParent,
      reason
    );
  }

  const accepted = await updateWish(wishId, {
    status: 'accepted',
    closed_at: new Date().toISOString(),
    closed_by: user.user.id,
    closure_reason: reason || 'Accepted by creator',
  });

  if (closeParent && wish.wish_type === 'proposal' && wish.parent_wish_id) {
    await updateWish(wish.parent_wish_id, {
      status: 'accepted',
      closed_at: new Date().toISOString(),
      closed_by: user.user.id,
      closure_reason: `Solved: accepted proposal "${wish.title}"`,
    });
  }

  return accepted;
}

export async function rejectWish(wishId: string, reason: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  return updateWish(wishId, {
    status: 'rejected',
    closed_at: new Date().toISOString(),
    closed_by: user.user.id,
    closure_reason: reason,
  });
}

export async function retractWish(wishId: string, reason?: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const activeChildren = await getActiveChildCount(wishId);
  if (activeChildren > 0) {
    throw new Error(
      'Cannot retract: this wish has active proposals or sub-wishes. Resolve or retract them first.'
    );
  }

  return updateWish(wishId, {
    status: 'retracted',
    closed_at: new Date().toISOString(),
    closed_by: user.user.id,
    closure_reason: reason || 'Retracted by creator',
  });
}

export function isTerminalStatus(status: WishStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export async function cancelWish(wishId: string, reason: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  return updateWish(wishId, {
    status: 'cancelled',
    closed_at: new Date().toISOString(),
    closed_by: user.user.id,
    closure_reason: reason,
  });
}

export async function toggleLike(wishId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data: existingLike } = await supabase
    .from('wish_likes')
    .select('*')
    .eq('wish_id', wishId)
    .eq('user_id', user.user.id)
    .maybeSingle();

  if (existingLike) {
    const { error } = await supabase
      .from('wish_likes')
      .delete()
      .eq('wish_id', wishId)
      .eq('user_id', user.user.id);

    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase.from('wish_likes').insert({
      wish_id: wishId,
      user_id: user.user.id,
    });

    if (error) throw error;
    return true;
  }
}

export async function castVote(wishId: string, voteType: VoteType) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data: existingVote } = await supabase
    .from('wish_votes')
    .select('*')
    .eq('wish_id', wishId)
    .eq('user_id', user.user.id)
    .maybeSingle();

  if (existingVote) {
    const { data, error } = await supabase
      .from('wish_votes')
      .update({ vote_type: voteType })
      .eq('wish_id', wishId)
      .eq('user_id', user.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('wish_votes')
      .insert({
        wish_id: wishId,
        user_id: user.user.id,
        vote_type: voteType,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export async function enableVotingForWish(
  wishId: string,
  config: {
    required_votes?: number;
    approval_percentage?: number;
    voting_duration_hours?: number;
  }
) {
  const votingEndsAt = new Date();
  votingEndsAt.setHours(
    votingEndsAt.getHours() + (config.voting_duration_hours || 168)
  );

  await updateWish(wishId, {
    voting_enabled: true,
    status: 'voting',
    voting_ends_at: votingEndsAt.toISOString(),
  });

  const { error } = await supabase.from('voting_configs').insert({
    wish_id: wishId,
    required_votes: config.required_votes || 10,
    approval_percentage: config.approval_percentage || 60,
    voting_duration_hours: config.voting_duration_hours || 168,
  });

  if (error) throw error;
}

export async function trackDonation(
  wishId: string,
  amount: number,
  message?: string
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('donations')
    .insert({
      donor_id: user.user.id,
      wish_id: wishId,
      amount,
      donation_message: message,
      donation_status: 'tracked',
      stripe_enabled: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getWishHierarchy(wishId: string): Promise<Wish[]> {
  const hierarchy: Wish[] = [];
  let currentWishId: string | null = wishId;

  while (currentWishId) {
    const wish = await getWishById(currentWishId);
    if (!wish) break;

    hierarchy.unshift(wish);
    currentWishId = wish.parent_wish_id;
  }

  return hierarchy;
}

export async function getUserWishesWithPendingProposals(): Promise<
  { wish: Wish; proposals: Wish[] }[]
> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const { data: myWishes, error: wishError } = await supabase
    .from('wishes')
    .select('*')
    .eq('user_id', user.user.id)
    .in('status', ['active', 'voting'])
    .order('created_at', { ascending: false });

  if (wishError) throw wishError;
  if (!myWishes || myWishes.length === 0) return [];

  const wishIds = myWishes.map((w: Wish) => w.id);

  const { data: proposals, error: propError } = await supabase
    .from('wishes')
    .select('*')
    .in('parent_wish_id', wishIds)
    .eq('wish_type', 'proposal')
    .eq('is_published', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (propError) throw propError;

  const proposalsByParent = new Map<string, Wish[]>();
  for (const p of (proposals || []) as Wish[]) {
    const existing = proposalsByParent.get(p.parent_wish_id!) || [];
    existing.push(p);
    proposalsByParent.set(p.parent_wish_id!, existing);
  }

  return (myWishes as Wish[])
    .filter((w) => proposalsByParent.has(w.id))
    .map((w) => ({ wish: w, proposals: proposalsByParent.get(w.id)! }));
}

export async function closeWishWithChildren(
  wishId: string,
  reason: string,
  closeChildren: boolean
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase.rpc('close_wish_with_children', {
    p_wish_id: wishId,
    p_closer_id: user.user.id,
    p_reason: reason,
    p_close_children: closeChildren,
  });

  if (error) throw error;
}

export function isWishExpired(wish: Wish): boolean {
  if (!wish.expires_at) return false;
  return new Date(wish.expires_at) < new Date();
}
