import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let pending: Promise<SupabaseClient<Database> | null> | undefined;

/** 인증 설정 오류가 Phaser의 초기 렌더링을 중단하지 않도록 필요할 때만 만든다. */
export function getSupabaseClient(): Promise<SupabaseClient<Database> | null> {
  if (!pending) pending = (async () => {
    const url = import.meta.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    try {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient<Database>(url, key, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        global: { fetch: (input, init) => fetch(input, {
          ...init, signal: init?.signal ?? AbortSignal.timeout(12000),
        }) },
      });
    } catch {
      // 설정 값이나 오류 원문을 로그에 남기지 않는다.
      return null;
    }
  })();
  return pending;
}
