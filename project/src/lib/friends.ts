import { supabase } from './supabase';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface Friend {
  friend_id: string;
  display_name: string;
  created_at: string;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  display_name: string;
  created_at: string;
}

export async function sendFriendRequest(addresseeId: string): Promise<{ data: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('send_friend_request', {
      p_addressee_id: addresseeId,
    });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export async function acceptFriendRequest(requesterId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('accept_friend_request', {
      p_requester_id: requesterId,
    });

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function declineFriendRequest(requesterId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('decline_friend_request', {
      p_requester_id: requesterId,
    });

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function removeFriend(friendId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('remove_friend', {
      p_friend_id: friendId,
    });

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function blockUser(userId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('block_user', {
      p_user_id: userId,
    });

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function getFriends(): Promise<{ data: Friend[] | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('get_user_friends', {
      p_user_id: user.id,
    });

    if (error) throw error;
    return { data: data as Friend[], error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export async function getPendingFriendRequests(): Promise<{ data: FriendRequest[] | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        requester_id,
        created_at
      `)
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const requestsWithNames = await Promise.all(
      (data || []).map(async (request) => {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('display_name')
          .eq('user_id', request.requester_id)
          .maybeSingle();

        return {
          id: request.id,
          requester_id: request.requester_id,
          display_name: profile?.display_name || 'Anonymous',
          created_at: request.created_at,
        };
      })
    );

    return { data: requestsWithNames, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export async function getSentFriendRequests(): Promise<{ data: FriendRequest[] | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        addressee_id,
        created_at
      `)
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const requestsWithNames = await Promise.all(
      (data || []).map(async (request) => {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('display_name')
          .eq('user_id', request.addressee_id)
          .maybeSingle();

        return {
          id: request.id,
          requester_id: request.addressee_id,
          display_name: profile?.display_name || 'Anonymous',
          created_at: request.created_at,
        };
      })
    );

    return { data: requestsWithNames, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export async function areFriends(userId: string): Promise<{ data: boolean; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: false, error: null };

    const { data, error } = await supabase.rpc('are_friends', {
      user1_id: user.id,
      user2_id: userId,
    });

    if (error) throw error;
    return { data: data as boolean, error: null };
  } catch (error) {
    return { data: false, error: error as Error };
  }
}

export async function deleteOwnAccount(): Promise<{ error: Error | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-account`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deletion_type: 'self',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete account');
    }

    await supabase.auth.signOut();
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}
