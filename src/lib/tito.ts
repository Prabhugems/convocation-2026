import { TitoCheckin, ApiResponse } from '@/types';

const TITO_API_BASE = 'https://api.tito.io/v3';

async function titoFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = process.env.TITO_API_TOKEN;
  const account = process.env.TITO_ACCOUNT;
  const event = process.env.TITO_EVENT;

  if (!token || !account || !event) {
    return { success: false, error: 'Tito API credentials not configured' };
  }

  try {
    const response = await fetch(`${TITO_API_BASE}/${account}/${event}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Token token=${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Tito API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function getCheckins(): Promise<ApiResponse<TitoCheckin[]>> {
  const response = await titoFetch<{ checkin_lists: { checkins: TitoCheckin[] }[] }>('/checkin_lists');
  if (response.success && response.data) {
    const checkins = response.data.checkin_lists.flatMap((list) => list.checkins || []);
    return { success: true, data: checkins };
  }
  return { success: false, error: response.error || 'Failed to fetch check-ins' };
}

export async function getCheckinByReference(reference: string): Promise<ApiResponse<TitoCheckin | null>> {
  const response = await titoFetch<{ checkins: TitoCheckin[] }>(`/checkins?q[reference_eq]=${reference}`);
  if (response.success && response.data) {
    const checkin = response.data.checkins?.[0] || null;
    return { success: true, data: checkin };
  }
  return { success: false, error: response.error || 'Failed to fetch check-in' };
}

export async function checkInGuest(checkinId: number): Promise<ApiResponse<TitoCheckin>> {
  return titoFetch<TitoCheckin>(`/checkins/${checkinId}`, {
    method: 'PATCH',
    body: JSON.stringify({ checkin: { checked_in: true } }),
  });
}

export async function searchCheckins(query: string): Promise<ApiResponse<TitoCheckin[]>> {
  const response = await titoFetch<{ checkins: TitoCheckin[] }>(`/checkins?q[name_or_email_cont]=${encodeURIComponent(query)}`);
  if (response.success && response.data) {
    return { success: true, data: response.data.checkins || [] };
  }
  return { success: false, error: response.error || 'Failed to search check-ins' };
}
