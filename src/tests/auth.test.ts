import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { createAuthService } from '@/lib/auth';
import { store } from '@/core/store';

function session(anonymous: boolean): Session {
  const user: User = { id: 'same-user', aud: 'authenticated', app_metadata: anonymous?{provider:'anonymous'}:{provider:'google',providers:['google']}, user_metadata: {}, created_at: '2026-11-04T00:00:00Z', is_anonymous: anonymous };
  return { user, access_token: 'fixture-token', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600 };
}
function fixture(initial: Session | null = null) {
  let current = initial;
  let changed: (event: AuthChangeEvent, session: Session | null) => void = () => {};
  const api = {
    getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    onAuthStateChange: vi.fn((fn: typeof changed) => {
      changed = fn;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInAnonymously: vi.fn(async () => {
      current = session(true); changed('SIGNED_IN', current);
      return { data: { user: current.user, session: current }, error: null };
    }),
    linkIdentity: vi.fn().mockResolvedValue({ error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn(async () => { current = null; changed('SIGNED_OUT', null); return { error: null }; }),
  };
  const service = createAuthService(() => ({ auth: api }) as unknown as Pick<SupabaseClient, 'auth'>);
  return { service, api, change(next: Session | null) { current = next; changed(next ? 'SIGNED_IN' : 'SIGNED_OUT', next); } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Google 필수 인증',()=>{
  it('로그인 전에는 익명 계정을 생성하지 않는다',async()=>{
    const f=fixture();await Promise.all([f.service.initialize(),f.service.initialize()]);
    expect(f.api.signInAnonymously).not.toHaveBeenCalled();expect(f.api.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(f.service.getSnapshot()).toMatchObject({status:'signed-out',userId:null});
  });
  it('이전 익명 세션은 게임 접속 세션으로 인정하지 않는다',async()=>{
    const f=fixture(session(true));await f.service.initialize();expect(f.service.getSnapshot()).toMatchObject({status:'signed-out',userId:null});
    expect(f.api.signInAnonymously).not.toHaveBeenCalled();
  });
  it('저장된 Google 세션만 복원한다',async()=>{
    const f=fixture(session(false));await f.service.initialize();expect(f.service.getSnapshot()).toMatchObject({status:'connected',userId:'same-user'});
  });
  it('다른 인증 공급자 세션은 Google 로그인으로 인정하지 않는다',async()=>{
    const other=session(false);other.user.app_metadata={provider:'email',providers:['email']};
    const f=fixture(other);await f.service.initialize();expect(f.service.getSnapshot().status).toBe('signed-out');
  });
  it('설정 없음·연결 오류는 로컬 게임으로 우회하지 않는다',async()=>{
    const missing=createAuthService(()=>null);await missing.initialize();expect(missing.getSnapshot()).toMatchObject({status:'local',userId:null});
    const broken=createAuthService(()=>{throw new Error('private configuration');});await broken.initialize();expect(broken.getSnapshot()).toMatchObject({status:'signed-out',error:'request',userId:null});
  });
  it('이전 익명 세션이 있어도 Google OAuth만 요청한다',async()=>{
    vi.stubGlobal('window',{location:{origin:'http://localhost:5173',pathname:'/',href:'http://localhost:5173/'}});
    const f=fixture(session(true));await f.service.initialize();await Promise.all([f.service.google(),f.service.google()]);
    expect(f.api.signInWithOAuth).toHaveBeenCalledTimes(1);expect(f.api.signInWithOAuth).toHaveBeenCalledWith({provider:'google',options:{redirectTo:'http://localhost:5173/'}});
    expect(f.api.linkIdentity).not.toHaveBeenCalled();expect(f.api.signInAnonymously).not.toHaveBeenCalled();
  });
  it('로그아웃 뒤에는 로그인 전 상태가 된다',async()=>{
    const f=fixture(session(false));await f.service.initialize();await f.service.signOut();
    expect(f.api.signOut).toHaveBeenCalledWith({scope:'local'});expect(f.service.getSnapshot()).toMatchObject({status:'signed-out',userId:null});
  });
  it('네트워크 오류 뒤 세션 확인을 재시도할 수 있고 진행 데이터는 지우지 않는다',async()=>{
    const before=structuredClone(store.state),f=fixture(session(false));f.api.getSession.mockRejectedValueOnce(new Error('private server detail'));
    await f.service.initialize();expect(f.service.getSnapshot().status).toBe('signed-out');await f.service.retry();
    expect(f.service.getSnapshot()).toMatchObject({status:'connected',error:null});expect(store.state).toEqual(before);
  });
  it('Google 취소 콜백에도 새 익명 계정을 만들지 않는다',async()=>{
    vi.stubGlobal('window',{location:{origin:'http://localhost:5173',pathname:'/',href:'http://localhost:5173/?error=access_denied'}});
    const f=fixture();await f.service.initialize();expect(f.service.getSnapshot()).toMatchObject({status:'signed-out',error:'google'});expect(f.api.signInAnonymously).not.toHaveBeenCalled();
  });
});
