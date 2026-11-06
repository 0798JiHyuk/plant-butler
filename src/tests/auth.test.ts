import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { createAuthService } from '@/lib/auth';
import { store } from '@/core/store';

function session(anonymous: boolean): Session {
  const user: User = { id: 'same-user', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-11-04T00:00:00Z', is_anonymous: anonymous };
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

describe('게스트·Google 인증', () => {
  it('설정이 없거나 클라이언트 생성이 실패해도 초기화 예외를 게임으로 전달하지 않는다', async () => {
    const missing = createAuthService(() => null);
    await expect(missing.initialize()).resolves.toBeUndefined();
    expect(missing.getSnapshot().status).toBe('local');
    const broken = createAuthService(() => { throw new Error('private configuration'); });
    await expect(broken.initialize()).resolves.toBeUndefined();
    expect(broken.getSnapshot().error).toBe('request');
  });
  it('중복 초기화에도 게스트 생성과 세션 구독은 한 번만 수행한다', async () => {
    const f = fixture();
    await Promise.all([f.service.initialize(), f.service.initialize(), f.service.startGuest()]);
    expect(f.api.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(f.api.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(f.service.getSnapshot()).toMatchObject({ status: 'guest', userId: 'same-user', busy: false });
  });
  it.each([true, false])('새로고침 시 기존 세션을 재사용한다: 익명=%s', async anonymous => {
    const f = fixture(session(anonymous));
    await f.service.initialize();
    expect(f.api.signInAnonymously).not.toHaveBeenCalled();
    expect(f.service.getSnapshot().status).toBe(anonymous ? 'guest' : 'connected');
  });
  it('게스트는 새 계정을 만드는 대신 같은 사용자에 Google을 연결한다', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173', pathname: '/demo/', href: 'http://localhost:5173/demo/' } });
    const f = fixture(session(true));
    await f.service.initialize();
    await Promise.all([f.service.google(), f.service.google()]);
    expect(f.api.linkIdentity).toHaveBeenCalledTimes(1);
    expect(f.api.linkIdentity).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'http://localhost:5173/demo/' } });
    expect(f.api.signInWithOAuth).not.toHaveBeenCalled();
  });
  it('기존 계정 로그인은 연결 API와 구분한다', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173', pathname: '/', href: 'http://localhost:5173/' } });
    const f = fixture(session(true));
    await f.service.initialize();
    await f.service.google('existing');
    expect(f.api.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'http://localhost:5173/' } });
    expect(f.api.linkIdentity).not.toHaveBeenCalled();
  });
  it('게스트는 로그아웃할 수 없고 연결 계정만 이 기기에서 로그아웃한다', async () => {
    const f = fixture(session(true));
    await f.service.initialize();
    await f.service.signOut();
    expect(f.api.signOut).not.toHaveBeenCalled();
    f.change(session(false));
    await f.service.signOut();
    expect(f.api.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(f.service.getSnapshot().status).toBe('signed-out');
  });
  it('네트워크 오류는 원문을 노출하지 않고 재시도할 수 있다', async () => {
    const f = fixture();
    f.api.getSession.mockRejectedValueOnce(new Error('private server detail'));
    await f.service.initialize();
    expect(f.service.getSnapshot()).toMatchObject({ status: 'signed-out', error: 'request', busy: false });
    await f.service.startGuest();
    expect(f.service.getSnapshot()).toMatchObject({ status: 'guest', error: null });
  });
  it('Google 취소 콜백과 연결 오류에도 게스트와 기존 정원 진행을 유지한다', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173', pathname: '/', href: 'http://localhost:5173/?error=access_denied' } });
    const before = structuredClone(store.state);
    const f = fixture(session(true));
    await f.service.initialize();
    expect(f.service.getSnapshot().error).toBe('google');
    f.api.linkIdentity.mockResolvedValueOnce({ error: new Error('identity already exists') });
    await f.service.google();
    expect(f.service.getSnapshot()).toMatchObject({ status: 'guest', userId: 'same-user', error: 'google' });
    expect(store.state).toEqual(before);
  });
  it('인증이 아직 대기 중이어도 기존 게임 상태를 잠그거나 변경하지 않는다', async () => {
    let release!: (value: null) => void;
    const pending = new Promise<null>(resolve => { release = resolve; });
    const before = structuredClone(store.state);
    const service = createAuthService(() => pending);
    const initialized = service.initialize();
    expect(service.getSnapshot().busy).toBe(true);
    expect(store.state).toEqual(before);
    release(null);
    await initialized;
    expect(service.getSnapshot().status).toBe('local');
  });
});
