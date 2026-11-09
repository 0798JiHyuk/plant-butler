import { loadJson, saveJson } from './storage';
import type { AppState } from './types';

const KEY = 'plantkeeper:v1';

export function createState(): AppState {
  return { version: 1, logs: [], garden: { items: [], plants: [], storage: [] }, seeds: [], fruit: 0, freePackets: 0, story: { seen: [], choices: {} }, bonusPackets: 0, visits: { count: 0 }, purchases: 0, chats: [], days: {}, settings: { sound: true, demo: false, dayOffset: 0 } };
}

export function loadState(): AppState {
  const saved = loadJson<AppState | null>(KEY, null);
  if (!saved || saved.version !== 1) return createState();
  const base = createState();
  // 이전 버전에 저장된 데이터에 없는 항목은 기본값으로 채운다.
  return { ...base, ...saved, garden: { ...base.garden, ...saved.garden }, settings: { ...base.settings, ...saved.settings } };
}

let state = loadState();
const subscribers = new Set<() => void>();

function commit(next: AppState): void {
  state = next;
  saveJson(KEY, next);
  subscribers.forEach((fn) => fn());
}

export const store = {
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
    commit(createState());
  },
  subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};
