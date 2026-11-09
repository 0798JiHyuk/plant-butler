import { loadJson, saveJson } from './storage';
import type { AppState } from './types';
import { events } from './events';
import { createState, decodeState, hasProgress, stateKey } from './state';
import { createMissionProgress } from './missions';
export { createState } from './state';

const LEGACY = 'plantkeeper:v1';
const LOCAL = 'plantkeeper:local:v1';
let key = LOCAL;
let owner: string | null = null;
let restoring = false;

export function loadState(): AppState {
  const saved = loadJson<unknown>(key, null) ?? (key === LOCAL && !loadJson('plantkeeper:legacy-owner', null) ? loadJson<unknown>(LEGACY, null) : null);
  if (!saved) return createState();
  try { return decodeState(saved); } catch { return createState(); }
}

let state = loadState();
const subscribers = new Set<() => void>();

function commit(next: AppState): void {
  state = next;
  saveJson(key, next);
  subscribers.forEach((fn) => fn());
}

export const store = {
  get owner(): string | null { return owner; },
  get restoring(): boolean { return restoring; },
  prepareTransfer(): void {
    saveJson('plantkeeper:transfer', { owner, state });
  },
  backup(value: unknown): void {
    const backupKey = `${key}:backup:${crypto.randomUUID()}`;
    saveJson(backupKey, value);
    saveJson(`${key}:backups`, [...loadJson<string[]>(`${key}:backups`, []), backupKey]);
  },
  /** UID별 로컬 진행 선택. 다른 계정에 게스트 진행을 가져올 때는 선택을 강제한다. */
  activateUser(userId: string | null): { imported: boolean; fallback: AppState } {
    const previous = owner;
    const before = state;
    const nextKey = userId ? `plantkeeper:user:${userId}:v1` : LOCAL;
    if (previous === userId && key === nextKey) return { imported: false, fallback: state };
    const raw = loadJson<unknown>(nextKey, null);
    let cached = createState();
    let unreadable = false;
    if (raw) {
      try { cached = decodeState(raw); } catch { saveJson(`${nextKey}:unreadable-backup`, raw); unreadable = true; }
    }
    const transfer = userId ? loadJson<{ owner: string | null; state: AppState } | null>('plantkeeper:transfer', null) : null;
    const imported = !!transfer && transfer.owner !== userId && hasProgress(transfer.state);
    let next = raw ? cached : previous === null && userId ? before : createState();
    key = nextKey;
    owner = userId;
    if (imported) { store.backup(cached); next = decodeState(transfer.state); }
    if (userId && previous === null && !raw) {
      saveJson('plantkeeper:legacy-owner', loadJson('plantkeeper:legacy-owner', null) ?? userId);
      saveJson(LOCAL, createState());
    }
    if (userId && transfer) saveJson('plantkeeper:transfer', null);
    store.restore(next, previous !== null && previous !== userId);
    return { imported: imported || unreadable, fallback: cached };
  },
  restore(next: AppState, force = false): void {
    const different = stateKey(state) !== stateKey(next);
    restoring = true;
    try { commit(decodeState(next)); } finally { restoring = false; }
    if (different || force) events.emit('state-restored', {});
  },
  get state(): AppState {
    return state;
  },
  /** 복사본(draft)을 고쳐서 한 번에 반영·저장한다. */
  update(mutate: (draft: AppState) => void): void {
    const draft = structuredClone(state);
    mutate(draft);
    commit(draft);
  },
  reset(): void {
    commit({ ...createState(), ...(state.missions ? { missions: createMissionProgress() } : {}) });
  },
  subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};
