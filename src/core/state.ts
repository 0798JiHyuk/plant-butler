// 저장 상태의 정의·검증. 읽기만으로 원본을 바꾸지 않고, 모르는 버전·깨진 저장은 던진다(호출하는 쪽이 백업한다).
import { missionById } from './missions';
import { plantById } from './plants';
import type { AppState, CategoryId, MissionState, WorkStatus } from './types';

const CATS: CategoryId[] = ['daily', 'academic', 'work'];
const VARIANTS = ['basic', 'small'];

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

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown) => typeof v === 'string';
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const count = (v: unknown) => finite(v) && Number.isSafeInteger(v) && (v as number) >= 0;
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);
const one = (v: unknown, options: readonly unknown[]) => options.includes(v);
const list = (v: unknown, check: (v: unknown) => boolean) => Array.isArray(v) && v.every(check);
const date = (v: unknown) => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string);
const kinds = ['flowerpot', 'table', 'shelf', 'bench', 'birdbath', 'hammock', 'flower', 'pot', 'lamp'];
const source = (v: unknown) => one(v, ['mission', 'daily', 'design']);
const info = (v: unknown) => object(v) && text(v.when) && text(v.where) && finite(v.minutes) && optional(v.criterion, text);
const plantId = (v: unknown) => typeof v === 'string' && !!plantById(v);
const plant = (v: unknown) => object(v) && text(v.id) && plantId(v.plantId) && date(v.date)
  && optional(v.harvested, (x) => typeof x === 'boolean') && optional(v.harvestedOn, date);
const position = (v: Record<string, unknown>) => Number.isInteger(v.col) && Number.isInteger(v.row);
const step = (v: unknown) => object(v) && text(v.missionId) && one(v.variant, VARIANTS);
const chat = (v: unknown) => object(v) && text(v.id) && date(v.date) && one(v.npc, ['nuri', 'moru', 'pio'])
  && list(v.lines, (l) => object(l) && one(l.from, ['me', 'nuri', 'moru', 'pio']) && text(l.text) && optional(l.keep, (k) => typeof k === 'boolean'))
  && optional(v.note, text) && optional(v.mind, text);

function missionsOk(m: unknown): boolean {
  if (!object(m)) return false;
  const stage = m.stage;
  return (m.category === null || one(m.category, CATS))
    && object(m.intents) && Object.entries(m.intents).every(([k, x]) => one(k, CATS) && text(x))
    && one(m.workStatus, ['pre_return', 'returned', 'unknown'])
    && object(stage) && CATS.every((c) => Number.isInteger(stage[c]) && Number(stage[c]) >= 1 && Number(stage[c]) <= 6)
    && object(m.skip) && (m.skip.date === '' || date(m.skip.date)) && list(m.skip.facts, text) && list(m.skip.cards, text)
    && (m.session === null || (object(m.session) && text(m.session.id) && date(m.session.date)
      && list(m.session.actions, (a) => object(a) && optional(a.missionId, text) && optional(a.variant, (x) => one(x, VARIANTS)))))
    && count(m.seq)
    && object(m.bookmarks) && Object.entries(m.bookmarks).every(([k, b]) => one(k, CATS) && step(b))
    && object(m.last) && Object.entries(m.last).every(([k, x]) => one(k, CATS) && text(x));
}

// ---------- 조원 형식(missions.selectedCategory…)을 우리 모양으로 ----------
interface TeammateRaw {
  logs?: { activityId?: string; mission?: { sessionId: string; variant: 'basic' | 'small' }; [k: string]: unknown }[];
  days?: Record<string, { sessionRewarded?: boolean; sessions?: number; plan?: { activityId?: string; missionId?: string; variant?: string; [k: string]: unknown }; [k: string]: unknown }>;
  missions: {
    selectedCategory: CategoryId | null; selectedIntent: string | null; workStatus: WorkStatus;
    stages?: Partial<Record<CategoryId, number>>;
    sessions?: Record<string, { sessionId: string; reportedActions: { missionId: string; variant: 'basic' | 'small'; date: string }[] }>;
    activeSessionId?: string | null; execution?: { variant: 'basic' | 'small' } | null;
    bookmarks?: Partial<Record<CategoryId, { sourceMissionId: string; targetMissionId?: string; variant: 'basic' | 'small' }>>;
    packets?: number;
  };
  [k: string]: unknown;
}

export function isTeammateFormat(raw: unknown): boolean {
  return object(raw) && object(raw.missions) && 'selectedCategory' in raw.missions;
}

const MISSION_ID = /^[DAW]\d{2}$/;

function upgradeTeammate(input: unknown): unknown {
  if (!isTeammateFormat(input)) return input;
  const { missions: m, ...rest } = structuredClone(input) as TeammateRaw;
  const stage = { daily: 1, academic: 1, work: 1 };
  for (const c of CATS) stage[c] = Math.min(4, Math.max(1, m.stages?.[c] ?? 1));
  const active = m.activeSessionId ? m.sessions?.[m.activeSessionId] : undefined;
  const acts = active?.reportedActions ?? [];
  const bookmarks: MissionState['bookmarks'] = {};
  for (const c of CATS) {
    const b = m.bookmarks?.[c];
    const id = b?.targetMissionId ?? b?.sourceMissionId;
    if (b && id && missionById(id)) bookmarks[c] = { missionId: id, variant: b.variant };
  }
  const missions: MissionState = {
    category: m.selectedCategory,
    intents: m.selectedCategory && m.selectedIntent ? { [m.selectedCategory]: m.selectedIntent } : {},
    workStatus: m.workStatus, stage, skip: { date: '', facts: [], cards: [] },
    session: active && acts.length ? { id: active.sessionId, date: acts[acts.length - 1].date, actions: acts.map((a) => ({ missionId: a.missionId, variant: a.variant })) } : null,
    seq: Object.keys(m.sessions ?? {}).length, bookmarks, last: {},
  };
  for (const day of Object.values(rest.days ?? {})) {
    if (day.sessionRewarded && !day.sessions) day.sessions = 1;
    delete day.sessionRewarded;
    const p = day.plan;
    if (p?.activityId && MISSION_ID.test(p.activityId) && missionById(p.activityId)) {
      p.missionId = p.activityId;
      p.variant = m.execution?.variant ?? 'basic';
      delete p.activityId;
    }
  }
  for (const log of rest.logs ?? []) {
    if (!log.mission) continue;
    if (log.activityId && missionById(log.activityId)) {
      log.missionId = log.activityId;
      delete log.activityId;
    }
    log.variant = log.mission.variant;
    log.sessionId = log.mission.sessionId;
    delete log.mission;
  }
  return { ...rest, missions, sessionPackets: m.packets ?? 0 };
}

/** 읽기만으로 기존 원본을 바꾸지 않는다. 알 수 없는 버전/깨진 저장본은 던진다. */
export function decodeState(input: unknown): AppState {
  const raw = upgradeTeammate(input);
  if (!object(raw) || raw.version !== 1 || !object(raw.garden) || !object(raw.settings)) throw new Error('Invalid progress');
  const base = createState();
  const m = raw.missions;
  const missions = m === undefined ? base.missions
    : object(m) ? { ...base.missions, ...m, stage: { ...base.missions.stage, ...(object(m.stage) ? m.stage : {}) } } : m;
  const v = { ...base, ...raw, garden: { ...base.garden, ...raw.garden }, settings: { ...base.settings, ...raw.settings }, missions };
  const valid = list(v.logs, (x) => object(x) && text(x.id) && date(x.date) && optional(x.activityId, text) && optional(x.text, text)
      && optional(x.missionId, text) && optional(x.variant, (z) => one(z, VARIANTS)) && optional(x.sessionId, text)
      && info(x.plan) && source(x.source) && list(x.chips, (c) => one(c, ['achieved', 'easier', 'again'])))
    && list(v.garden.items, (x) => object(x) && text(x.id) && one(x.kind, kinds) && count(x.variant) && position(x))
    && list(v.garden.plants, (x) => object(x) && plant(x) && position(x))
    && list(v.garden.storage, (x) => object(x) && (x.type === 'plant' ? plant(x) : x.type === 'decor' && text(x.id) && one(x.decorKind, kinds) && count(x.variant)))
    && optional(v.garden.bed, (x) => object(x) && finite(x.x) && finite(x.y))
    && list(v.seeds, (x) => object(x) && text(x.id) && plantId(x.plantId))
    && [v.fruit, v.freePackets, v.bonusPackets, v.purchases, v.sessionPackets].every(count)
    && object(v.story) && list(v.story.seen, text) && object(v.story.choices) && Object.values(v.story.choices).every(count)
    && optional(v.story.lastDay, date) && optional(v.story.lastReturn, date)
    && object(v.visits) && count(v.visits.count) && optional(v.visits.last, date)
    && list(v.chats, chat)
    && missionsOk(v.missions)
    && object(v.days) && Object.entries(v.days).every(([key, day]) => date(key) && object(day) && count(day.refresh)
      && optional(day.energy, (x) => one(x, ['heavy', 'normal', 'good'])) && optional(day.rested, (x) => typeof x === 'boolean')
      && optional(day.packet, (x) => one(x, ['ready', 'opened'])) && optional(day.sessions, count)
      && optional(day.plan, (x) => object(x) && source(x.source) && optional(x.activityId, text) && optional(x.missionId, text)
        && optional(x.variant, (z) => one(z, VARIANTS)) && optional(x.text, text) && info(x.info)))
    && typeof v.settings.sound === 'boolean' && typeof v.settings.demo === 'boolean'
    && Number.isInteger(v.settings.dayOffset) && optional(v.settings.viewZoom, (x) => finite(x) && (x as number) > 0);
  if (!valid) throw new Error('Invalid progress');
  return structuredClone({
    version: 1, logs: v.logs, garden: v.garden, seeds: v.seeds, fruit: v.fruit, freePackets: v.freePackets, bonusPackets: v.bonusPackets,
    story: v.story, visits: v.visits, purchases: v.purchases, chats: v.chats, missions: v.missions, sessionPackets: v.sessionPackets,
    days: v.days, settings: v.settings,
  }) as AppState;
}

/** 서버로 보내는 모양: 기기 안에만 두는 대화 기록(chats)은 뺀다. */
export const toSnapshot = (state: AppState): AppState => ({ ...decodeState(state), chats: [] });

export function stateKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stateKey).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stateKey(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function hasProgress(state: AppState): boolean {
  const base = createState();
  return stateKey({ ...state, settings: base.settings }) !== stateKey(base);
}
