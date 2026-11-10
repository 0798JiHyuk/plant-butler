import { describe, expect, it } from 'vitest';
import { createGardenSync } from '../lib/gardenSync';
import type { GardenRecord, GardenRepository } from '../lib/gardenRepository';
import { createState, stateKey, toSnapshot } from '../core/state';
import type { AppState, ChatLog } from '../core/types';

const talk = (id: string): ChatLog => ({ id, date: '2026-11-10', npc: 'nuri', lines: [{ from: 'me', text: '비밀 이야기' }] });

function fakeStore(initial: AppState) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get state() { return state; },
    restoring: false,
    activateUser: () => ({ imported: false, fallback: createState() }),
    restore(next: AppState) { state = next; subs.forEach((f) => f()); },
    backup() {},
    subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
    set(next: AppState) { state = next; subs.forEach((f) => f()); },
  };
}

function fakeRepo(initial: GardenRecord | null) {
  let record = initial;
  const saved: AppState[] = [];
  const repo: GardenRepository = {
    async load() { return record; },
    async save(_user, state, revision) {
      saved.push(state);
      record = { state, revision: revision + 1, updatedAt: new Date().toISOString() };
      return record;
    },
  };
  return { repo, saved };
}

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const options = (meta: { revision: number; baseline: string } | null) => ({ readMeta: () => meta, writeMeta() {}, delay: 0 });

describe('클라우드 저장과 대화 기록', () => {
  it('서버로 보내는 상태에는 대화 기록이 없다', async () => {
    const local = fakeStore({ ...createState(), fruit: 2, chats: [talk('a')] });
    const { repo, saved } = fakeRepo(null);
    await createGardenSync(repo, local, options(null)).connect('u1');
    expect(saved).toHaveLength(1);
    expect(saved[0].chats).toEqual([]);
    expect(saved[0].fruit).toBe(2);
    expect(local.state.chats).toHaveLength(1);
  });

  it('서버 상태를 복원해도 기기의 대화 기록은 남는다', async () => {
    const mine: AppState = { ...createState(), chats: [talk('a')] };
    const server: AppState = { ...createState(), fruit: 9 };
    const local = fakeStore(mine);
    const { repo } = fakeRepo({ state: server, revision: 2, updatedAt: new Date().toISOString() });
    await createGardenSync(repo, local, options({ revision: 1, baseline: stateKey(toSnapshot(mine)) })).connect('u1');
    expect(local.state.fruit).toBe(9);
    expect(local.state.chats.map((c) => c.id)).toEqual(['a']);
  });

  it('대화 기록만 바뀐 변경은 서버 저장을 일으키지 않는다', async () => {
    const local = fakeStore(createState());
    const { repo, saved } = fakeRepo(null);
    await createGardenSync(repo, local, options(null)).connect('u1');
    const before = saved.length;
    local.set({ ...local.state, chats: [talk('b')] });
    await wait();
    expect(saved).toHaveLength(before);
    local.set({ ...local.state, fruit: 5 });
    await wait();
    expect(saved).toHaveLength(before + 1);
  });
});
