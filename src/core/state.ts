// 임시 shim: Task 2에서 엄격 검증(decodeState)으로 교체한다.
import type { AppState, MissionState } from './types';

export function createMissionState(): MissionState {
  return {
    category: null, intents: {}, workStatus: 'unknown', stage: { daily: 1, academic: 1, work: 1 },
    skip: { date: '', facts: [], cards: [] }, session: null, seq: 0, bookmarks: {}, last: {},
  };
}

export function createState(): AppState {
  return {
    version: 1, logs: [], garden: { items: [], plants: [], storage: [] }, seeds: [], fruit: 0, freePackets: 0,
    story: { seen: [], choices: {} }, bonusPackets: 0, visits: { count: 0 }, purchases: 0, chats: [],
    missions: createMissionState(), sessionPackets: 0, days: {}, settings: { sound: true, demo: false, dayOffset: 0 },
  };
}

export function decodeState(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 1) throw new Error('Invalid progress');
  return { ...createState(), ...(structuredClone(raw) as AppState) };
}

export function stateKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stateKey).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stateKey(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hasProgress(state: AppState): boolean {
  const base = createState();
  return stateKey({ ...state, settings: base.settings }) !== stateKey(base);
}
