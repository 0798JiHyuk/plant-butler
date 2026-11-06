import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

type AuthApi = Pick<SupabaseClient, 'auth'>;
export interface AuthState {
  status: 'checking' | 'local' | 'signed-out' | 'guest' | 'connected';
  userId: string | null;
  busy: boolean;
  error: 'request' | 'google' | null;
}

export function createAuthService(provide: () => AuthApi | null | Promise<AuthApi | null>) {
  let state: AuthState = { status: 'checking', userId: null, busy: false, error: null };
  const listeners = new Set<() => void>();
  let operation: Promise<void> | null = null;
  let initialization: Promise<void> | undefined;
  const publish = (patch: Partial<AuthState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const userChanged = (user: User | null) => publish({
    status: user ? (user.is_anonymous ? 'guest' : 'connected') : 'signed-out', userId: user?.id ?? null,
  });
  function run(action: (api: AuthApi) => Promise<void>, error: AuthState['error'] = 'request'): Promise<void> {
    if (operation) return operation;
    publish({ busy: true, error: null });
    operation = Promise.resolve().then(async () => {
      const api = await provide();
      if (!api) { publish({ status: 'local' }); return; }
      await action(api);
    }).catch(() => {
      publish({ status: state.status === 'checking' ? 'signed-out' : state.status, error });
    }).finally(() => { operation = null; publish({ busy: false }); });
    return operation;
  }
  async function restoreOrStartGuest(api: AuthApi) {
    const { data: saved, error: restoreError } = await api.auth.getSession();
    if (restoreError) throw restoreError;
    if (saved.session) { userChanged(saved.session.user); return; }
    const { data, error } = await api.auth.signInAnonymously();
    if (error || !data.user) throw new Error('Guest authentication unavailable');
    userChanged(data.user);
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    initialize(): Promise<void> {
      if (!initialization) initialization = run(async api => {
        api.auth.onAuthStateChange((_event, session) => {
          // 이 콜백 안에서는 다른 Supabase API를 호출하지 않는다.
          userChanged(session?.user ?? null);
        });
        await restoreOrStartGuest(api);
        if (typeof window !== 'undefined') {
          const callback = new URL(window.location.href);
          if (callback.searchParams.has('error') || new URLSearchParams(callback.hash.slice(1)).has('error')) {
            publish({ error: 'google' });
          }
        }
      });
      return initialization;
    },
    startGuest: () => run(restoreOrStartGuest),
    google: (mode: 'link' | 'existing' = 'link') => run(async api => {
      const { data, error } = await api.auth.getSession();
      if (error) throw error;
      const options = { redirectTo: `${window.location.origin}${window.location.pathname}` };
      const result = mode === 'link' && data.session?.user.is_anonymous
        ? await api.auth.linkIdentity({ provider: 'google', options })
        : await api.auth.signInWithOAuth({ provider: 'google', options });
      if (result.error) throw result.error;
    }, 'google'),
    signOut: () => state.status !== 'connected' ? Promise.resolve() : run(async api => {
      const { error } = await api.auth.signOut({ scope: 'local' });
      if (error) throw error;
      userChanged(null);
    }),
  };
}

export const auth = createAuthService(getSupabaseClient);

/** 인증 실패는 호출자가 처리할 수 있도록 null로 반환하며 게임 시작은 막지 않는다. */
export async function ensureSession(): Promise<string | null> {
  await auth.initialize();
  return auth.getSnapshot().userId;
}
