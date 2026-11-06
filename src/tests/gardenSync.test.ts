import { describe, it, expect, vi } from 'vitest';
import { createGardenSync, type SyncMetadata } from '@/lib/gardenSync';
import { createState, stateKey, decodeState } from '@/core/state';
import type { AppState } from '@/core/types';
import { GardenError, type GardenRecord, type GardenRepository } from '@/lib/gardenRepository';

function fixture(initial = createState(), initialRemote: GardenRecord | null = null, pendingImport: AppState | null = null) {
  let state = structuredClone(initial);
  let remote = initialRemote && structuredClone(initialRemote);
  const listeners = new Set<() => void>();
  const backups: AppState[] = [];
  const metadata = new Map<string, SyncMetadata>();
  const local = {
    get state() { return state; },
    activateUser: vi.fn((_id: string | null) => ({ imported: false, fallback: createState() })),
    restore(next: AppState) { state = structuredClone(next); listeners.forEach(fn => fn()); },
    backup(next: AppState) { backups.push(structuredClone(next)); },
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
  const repository: GardenRepository = {
    load: vi.fn(async () => remote && structuredClone(remote)),
    save: vi.fn(async (_uid, next, revision) => {
      if ((remote?.revision ?? 0) !== revision) return null;
      remote = { state: structuredClone(next), revision: revision + 1, updatedAt: '2026-11-05T00:00:00Z' };
      return structuredClone(remote);
    }),
  };
  const sync = createGardenSync(repository, local, { delay: 60000, readMeta: id => metadata.get(id) ?? null, writeMeta: (id, meta) => { metadata.set(id, meta); }, readImport: () => pendingImport, writeImport: (_id, value) => { pendingImport = value; } });
  return { sync, local, repository, backups, metadata, change(fn: (s: AppState) => void) { fn(state); listeners.forEach(f => f()); }, get remote() { return remote; }, setRemote(next: GardenRecord) { remote = structuredClone(next); } };
}

describe('계정 진행 동기화', () => {
  it('새 브라우저는 텃밭/씨앗/가방/기록을 계정에서 복원한다', async () => {
    const saved = createState(); saved.garden.bed = { x: 420, y: 350 }; saved.fruit = 19;
    saved.seeds.push({ id: 'seed', plantId: 'daisy' });
    saved.garden.storage.push({ id: 'bench', type: 'decor', decorKind: 'bench', variant: 0 });
    const f = fixture(createState(), { state: saved, revision: 3 });
    await f.sync.connect('A');
    expect(f.local.state).toEqual(saved); expect(f.sync.getSnapshot().phase).toBe('saved');
    expect(f.repository.save).not.toHaveBeenCalled(); f.sync.dispose();
  });
  it('저장 없는 계정은 로컬 전체를 최초 저장하고 중복 클릭은 한 요청으로 처리한다', async () => {
    const f = fixture(); await f.sync.connect('A');
    f.change(s => { s.fruit = 8; s.garden.bed = { x: 400, y: 360 }; });
    await Promise.all([f.sync.flush(), f.sync.flush(), f.sync.flush()]);
    expect(f.remote?.state.fruit).toBe(8); expect(f.remote?.revision).toBe(2);
    expect(f.repository.save).toHaveBeenCalledTimes(2); f.sync.dispose();
  });
  it('서버 변경만 있으면 복원하고 보상을 재지급하지 않는다', async () => {
    const f = fixture(); await f.sync.connect('A');
    const next = createState(); next.fruit = 23; next.freePackets = 2;
    f.setRemote({ state: next, revision: 2 }); await f.sync.refresh();
    expect(f.local.state.fruit).toBe(23); expect(f.local.state.freePackets).toBe(2);
    expect(f.repository.save).toHaveBeenCalledTimes(1); f.sync.dispose();
  });
  it('다른 기기와 동시에 수정되면 덮어쓰지 않고 명시적 선택 후 백업한다', async () => {
    const f = fixture(); await f.sync.connect('A'); f.change(s => { s.fruit = 3; });
    const other = createState(); other.fruit = 40; f.setRemote({ state: other, revision: 2 });
    await f.sync.flush(); expect(f.sync.getSnapshot().phase).toBe('conflict'); expect(f.local.state.fruit).toBe(3);
    await f.sync.resolve('server'); expect(f.local.state.fruit).toBe(40); expect(f.backups.some(s => s.fruit === 3)).toBe(true);
    f.sync.dispose();
  });
  it('로컬 선택은 최신 버전 조건을 사용하며 재화는 합치지 않는다', async () => {
    const local = createState(); local.fruit = 3; const other = createState(); other.fruit = 40;
    const f = fixture(local, { state: other, revision: 2 }); await f.sync.connect('A');
    expect(f.sync.getSnapshot().phase).toBe('conflict'); await f.sync.resolve('local');
    expect(f.remote?.state.fruit).toBe(3); expect(f.remote?.revision).toBe(3); f.sync.dispose();
  });
  it('오프라인 변경은 같은 서버 버전일 때 다시 연결하면 저장한다', async () => {
    const f = fixture(); await f.sync.connect('A'); f.change(s => { s.fruit = 7; });
    await f.sync.refresh(); expect(f.remote?.state.fruit).toBe(7); f.sync.dispose();
  });
  it('저장 중 생긴 변경도 후속 저장한다', async () => {
    const f = fixture(); await f.sync.connect('A');
    let release!: (record: GardenRecord) => void;
    vi.mocked(f.repository.save).mockImplementationOnce(() => new Promise(r => { release = r; }));
    f.change(s => { s.fruit = 1; }); const pending = f.sync.flush();
    await Promise.resolve(); f.change(s => { s.fruit = 2; });
    const first = createState(); first.fruit = 1; f.setRemote({ state: first, revision: 2 }); release({ state: first, revision: 2 });
    await pending; expect(f.sync.getSnapshot().phase).toBe('pending'); await f.sync.flush();
    expect(f.remote?.state.fruit).toBe(2); f.sync.dispose();
  });
  it('이전 계정의 느린 응답은 새 계정에 적용하지 않는다', async () => {
    const f = fixture(); let release!: (v: GardenRecord) => void;
    vi.mocked(f.repository.load).mockImplementationOnce(() => new Promise(r => { release = r; }));
    const pending = f.sync.connect('A'); await new Promise(r => setTimeout(r, 5));
    await f.sync.connect(null); const old = createState(); old.fruit = 100; release({ state: old, revision: 8 }); await pending;
    expect(f.local.state.fruit).toBe(0); expect(f.sync.getSnapshot().phase).toBe('local'); f.sync.dispose();
  });
  it('게스트를 기존 계정으로 가져오면 빈 서버에도 선택을 요청한다', async () => {
    const next = createState(); next.fruit = 9; const f = fixture(next);
    f.local.activateUser.mockReturnValue({ imported: true, fallback: createState() }); await f.sync.connect('A');
    expect(f.sync.getSnapshot().phase).toBe('conflict'); expect(f.repository.save).not.toHaveBeenCalled();
    await f.sync.resolve('server'); expect(f.local.state.fruit).toBe(0); expect(f.backups.some(s => s.fruit === 9)).toBe(true); f.sync.dispose();
  });
  it('테이블 미설정/깨진 서버 데이터는 로컬을 유지하고 재시도할 수 있다', async () => {
    const f = fixture(); f.change(s => { s.fruit = 5; });
    vi.mocked(f.repository.load).mockRejectedValueOnce(new GardenError('setup'));
    await f.sync.connect('A'); expect(f.sync.getSnapshot()).toMatchObject({ phase: 'error', error: 'setup' });
    expect(f.local.state.fruit).toBe(5); await f.sync.refresh(); expect(f.remote?.state.fruit).toBe(5); f.sync.dispose();
  });
  it('기존 계정 가져오기 선택 전 새로고침해도 자동 덮어쓰지 않는다', async () => {
    const guest = createState(); guest.fruit = 9;
    const fallback = createState(); fallback.fruit = 20;
    const f = fixture(guest, { state: fallback, revision: 3 }, fallback);
    f.metadata.set('A', { revision: 3, baseline: stateKey(fallback) });
    await f.sync.connect('A');
    expect(f.sync.getSnapshot().phase).toBe('conflict'); expect(f.repository.save).not.toHaveBeenCalled();
    await f.sync.resolve('server'); expect(f.local.state.fruit).toBe(20); f.sync.dispose();
  });
  it('미래 버전/잘못된 재화는 거부하고 키 순서만 다른 상태는 같다', () => {
    expect(() => decodeState({ ...createState(), version: 2 })).toThrow();
    expect(() => decodeState({ ...createState(), fruit: -1 })).toThrow();
    expect(stateKey({ a: 1, b: 2 })).toBe(stateKey({ b: 2, a: 1 }));
  });
});
