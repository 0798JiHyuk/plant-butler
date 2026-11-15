import { isGoogleIdentity } from '../../supabase/functions/_shared/authPolicy';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

export const isGoogleUser=(user:User|null):boolean=>isGoogleIdentity(user);

type AuthApi = Pick<SupabaseClient, 'auth'>;
export interface AuthState {
  status: 'checking' | 'local' | 'signed-out' | 'connected';
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
    status: isGoogleUser(user)?'connected':'signed-out', userId: isGoogleUser(user)?user!.id:null,
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
  async function restoreSession(api:AuthApi) {
    const {data,error}=await api.auth.getSession();
    if(error)throw error;
    userChanged(data.session?.user??null);
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
        await restoreSession(api);
        if (typeof window !== 'undefined') {
          const callback = new URL(window.location.href);
          if (callback.searchParams.has('error') || new URLSearchParams(callback.hash.slice(1)).has('error')) {
            publish({ error: 'google' });
          }
        }
      });
      return initialization;
    },
    retry: () => run(restoreSession),
    google: () => run(async api => {
      const options={redirectTo:`${window.location.origin}${window.location.pathname}`};
      const {error}=await api.auth.signInWithOAuth({provider:'google',options});
      if(error)throw error;
    },'google'),
    signOut: () => state.status !== 'connected' ? Promise.resolve() : run(async api => {
      const { error } = await api.auth.signOut({ scope: 'local' });
      if (error) throw error;
      userChanged(null);
    }),
  };
}

export const auth = createAuthService(getSupabaseClient);

/** Google 세션만 반환한다. 로그인·서버 복원이 끝나기 전에는 진입 화면에서 대기한다. */
export async function ensureSession(): Promise<string | null> {
  await auth.initialize();
  return auth.getSnapshot().userId;
}
