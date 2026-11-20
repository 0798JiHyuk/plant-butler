import { getSupabaseClient } from './supabase';
import type { FeedbackInput } from '../../supabase/functions/_shared/feedbackPolicy';

export type FeedbackResult = 'sent' | 'auth' | 'setup' | 'busy' | 'unavailable';
export async function sendFeedback(input: FeedbackInput, owner: string, signal: AbortSignal): Promise<FeedbackResult> {
  try {
    const api = await getSupabaseClient();
    if (!api || signal.aborted) return 'unavailable';
    const {data,error} = await api.auth.getSession();
    if (error || !data.session || data.session.user.id !== owner) return 'auth';
    if (signal.aborted) return 'unavailable';
    const response = await fetch(`${import.meta.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-feedback`, {
      method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,apikey:import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', 'Content-Type':'application/json'},
      body:JSON.stringify(input),signal,
    });
    if (response.status === 401) return 'auth';
    if (response.status === 503) return 'setup';
    if (response.status === 429) return 'busy';
    if (!response.ok) return 'unavailable';
    const result: unknown = await response.json();
    return result && typeof result === 'object' && 'ok' in result && result.ok === true ? 'sent' : 'unavailable';
  } catch { return 'unavailable'; }
}
