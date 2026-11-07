import { getSupabaseClient } from './supabase';
import { parsePhotoVerdict, PHOTO_MAX_BYTES, type PhotoVerdict } from '@/core/photoCheck';

export type PhotoCheckResult = PhotoVerdict | 'unavailable';
export async function checkActivityPhoto(activityId: string, image: string, signal: AbortSignal): Promise<PhotoCheckResult> {
  try {
    if (image.length > PHOTO_MAX_BYTES * 1.4 + 64) return 'unavailable';
    const api = await getSupabaseClient();
    if (!api || signal.aborted) return 'unavailable';
    const { data, error } = await api.auth.getSession();
    if (error || !data.session || signal.aborted) return 'unavailable';
    const response = await fetch(`${import.meta.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-activity`, {
      method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId, image }), signal,
    });
    if (!response.ok) return 'unavailable';
    return parsePhotoVerdict(await response.json()) ?? 'unavailable';
  } catch { return 'unavailable'; }
}
