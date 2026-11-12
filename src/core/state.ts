// 저장 상태의 정의·검증. 읽기만으로 원본을 바꾸지 않고, 모르는 버전·깨진 저장은 던진다(호출하는 쪽이 백업한다).
import { actionText, missionById, recordText } from './missions';
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
    && object(m.last) && Object.entries(m.last).every(([k, x]) => one(k, CATS) && text(x))
    && (m.legacy === undefined || object(m.legacy));
}

// ---------- 조원 형식(missions.selectedCategory…)과 서로 바꾸기 ----------
// 저장 파일의 missions는 조원 모양으로 쓰고(조원 버전도 읽을 수 있게), 조원 모양에 없는 우리 값은 missions.baek에 넣는다.
// 앱 안의 상태(AppState)는 우리 모양 그대로다.
interface TeammateRaw {
  logs?: { activityId?: string; mission?: { sessionId: string; variant: 'basic' | 'small' }; [k: string]: unknown }[];
  days?: Record<string, { sessionRewarded?: boolean; sessions?: number; plan?: { activityId?: string; missionId?: string; variant?: string; [k: string]: unknown }; [k: string]: unknown }>;
  missions: {
    selectedCategory: CategoryId | null; selectedIntent: string | null; workStatus: WorkStatus;
    stages?: Partial<Record<CategoryId, number>>;
    sessions?: Record<string, { sessionId: string; reportedActions: { missionId: string; variant: 'basic' | 'small'; date: string }[] }>;
    activeSessionId?: string | null; execution?: { variant: 'basic' | 'small' } | null;
    bookmarks?: Partial<Record<CategoryId, { sourceMissionId: string; targetMissionId?: string; nextAction?: string; locationLabel?: string; variant: 'basic' | 'small' }>>;
    packets?: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export function isTeammateFormat(raw: unknown): boolean {
  return object(raw) && object(raw.missions) && 'selectedCategory' in raw.missions;
}

/** 조원 버전이 쓴 저장인지(우리가 쓴 저장은 missions.baek이 있어 변환해도 잃는 게 없다). 변환 전에 원본을 백업할지 정할 때 쓴다. */
export function writtenByTeammate(raw: unknown): boolean {
  return isTeammateFormat(raw) && !object((raw as { missions: Record<string, unknown> }).missions.baek);
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
  // 지금 화면이 쓰지 않는 값은 지우지 않고 legacy에 보관한다(이식할 때 읽는다).
  const bookmarkText: Record<string, { nextAction?: string; locationLabel?: string }> = {};
  for (const c of CATS) {
    const b = m.bookmarks?.[c];
    const card = missionById(b?.targetMissionId ?? b?.sourceMissionId);
    const computed = card && b ? actionText(card, b.variant) : '';
    const custom = !!b?.nextAction && b.nextAction !== computed; // 직접 고쳐 쓴 문구만 따로 보관
    if (b && (custom || b.locationLabel)) {
      bookmarkText[c] = { ...(custom ? { nextAction: b.nextAction } : {}), ...(b.locationLabel ? { locationLabel: b.locationLabel } : {}) };
    }
  }
  const keep: Record<string, unknown> = {};
  for (const k of ['custom', 'myDays', 'dayMapDefault', 'selectedDayEntry', 'restCues', 'facts', 'onboardingSeen'] as const) {
    const v = m[k];
    const empty = v === undefined || v === false || (Array.isArray(v) && v.length === 0) || (object(v) && Object.keys(v).length === 0);
    if (!empty) keep[k] = v;
  }
  if (Object.keys(bookmarkText).length) keep.bookmarkText = bookmarkText;
  if (m.stages && CATS.some((c) => (m.stages?.[c] ?? 0) > 4)) keep.stages = m.stages; // 4단계로 줄이기 전의 값
  if (Object.keys(keep).length) missions.legacy = keep;
  // 우리 버전이 저장한 값(missions.baek)이 있으면 조원 모양에 없는 칸을 되살린다.
  const baek = object(m.baek) ? m.baek : undefined;
  if (baek) {
    if (object(baek.intents)) missions.intents = { ...(baek.intents as MissionState['intents']), ...missions.intents };
    if (baek.skip !== undefined) missions.skip = baek.skip as MissionState['skip'];
    if (count(baek.seq)) missions.seq = Math.max(baek.seq as number, missions.seq);
    if (baek.last !== undefined) missions.last = baek.last as MissionState['last'];
    const own = baek.session;
    // 조원 버전이 같은 회차에 행동을 더했으면(개수가 다르면) 조원 값을 따른다.
    if (object(own) && own.id === m.activeSessionId && Array.isArray(own.actions) && own.actions.length === acts.length) missions.session = own as unknown as MissionState['session'];
  }
  for (const day of Object.values(rest.days ?? {})) {
    if (day.sessionRewarded && !day.sessions) day.sessions = 1;
    delete day.sessionRewarded;
    const p = day.plan;
    if (p?.activityId && MISSION_ID.test(p.activityId) && missionById(p.activityId)) {
      if (!p.missionId) {
        p.missionId = p.activityId;
        p.variant = m.execution?.variant ?? 'basic';
      }
      if (p.missionId === p.activityId) delete p.activityId;
    }
  }
  for (const log of rest.logs ?? []) {
    if (!log.mission) continue;
    if (log.activityId && missionById(log.activityId)) {
      if (!log.missionId) log.missionId = log.activityId;
      if (log.missionId === log.activityId) delete log.activityId;
    }
    log.variant = log.variant ?? log.mission.variant;
    log.sessionId = log.sessionId ?? (log.mission.sessionId || undefined);
    delete log.mission;
  }
  return { ...rest, missions, sessionPackets: m.packets ?? 0 };
}

/** 저장 파일(기기·서버)에 쓰는 모양. missions를 조원 모양으로 바꾸고, 기록·날짜에 조원 화면이 읽는 칸을 더한다. decodeState가 되돌린다. */
export function encodeState(state: AppState): Record<string, unknown> {
  const m = state.missions ?? createMissionState(); // 예전 저장본을 흉내 낸 부분 상태도 저장할 수 있게
  const lg = (m.legacy ?? {}) as Record<string, unknown>;
  const stored = object(lg.stages) ? lg.stages : {};
  const stages: Record<string, number> = {};
  for (const c of CATS) {
    const before = Number(stored[c]);
    stages[c] = Number.isInteger(before) && before > m.stage[c] ? before : m.stage[c]; // 조원이 올린 5~6단계는 줄이지 않는다
  }
  const texts = (object(lg.bookmarkText) ? lg.bookmarkText : {}) as Record<string, { nextAction?: string; locationLabel?: string }>;
  const bookmarks: Record<string, unknown> = {};
  for (const c of CATS) {
    const b = m.bookmarks[c];
    if (!b) continue;
    const card = missionById(b.missionId);
    bookmarks[c] = {
      categoryId: c, sourceMissionId: b.missionId, targetMissionId: b.missionId, variant: b.variant,
      nextAction: texts[c]?.nextAction || (card ? actionText(card, b.variant) : ''),
      ...(texts[c]?.locationLabel ? { locationLabel: texts[c].locationLabel } : {}),
    };
  }
  const sessions: Record<string, unknown> = {};
  const open = m.session;
  if (open) {
    const own = state.logs.filter((l) => l.sessionId === open.id);
    sessions[open.id] = {
      sessionId: open.id, status: 'active', rewardGranted: false,
      reportedActions: open.actions.map((a, i) => {
        const log = own[i];
        const card = missionById(a.missionId ?? log?.missionId);
        const variant = a.variant ?? 'basic';
        const record = card && a.variant ? recordText(card, variant) : (log?.text ?? '');
        return {
          actionId: log?.id ?? `${open.id}-a${i + 1}`, missionId: a.missionId ?? '', variant, text: record, record,
          date: log?.date ?? open.date, logId: log?.id ?? `${open.date}-${i + 1}`,
        };
      }),
    };
  }
  const missions: Record<string, unknown> = {
    selectedCategory: m.category, selectedIntent: m.category ? (m.intents[m.category] ?? null) : null, workStatus: m.workStatus, stages,
    facts: object(lg.facts) ? lg.facts : {}, sessions, activeSessionId: open ? open.id : null, execution: null, bookmarks,
    custom: Array.isArray(lg.custom) ? lg.custom : [], myDays: object(lg.myDays) ? lg.myDays : {}, dayMapDefault: object(lg.dayMapDefault) ? lg.dayMapDefault : {},
    ...(object(lg.selectedDayEntry) ? { selectedDayEntry: lg.selectedDayEntry } : {}),
    ...(object(lg.restCues) ? { restCues: lg.restCues } : {}),
    ...(typeof lg.onboardingSeen === 'boolean' ? { onboardingSeen: lg.onboardingSeen } : {}),
    packets: state.sessionPackets ?? 0,
    baek: { intents: m.intents, skip: m.skip, seq: m.seq, last: m.last, session: open },
  };
  const logs = state.logs.map((l) => {
    const card = missionById(l.missionId);
    if (!l.missionId || !card) return l;
    return { ...l, activityId: l.missionId, mission: { sessionId: l.sessionId ?? '', actionId: l.id, variant: l.variant ?? 'basic', record: recordText(card, l.variant ?? 'basic') } };
  });
  const days: Record<string, unknown> = {};
  for (const [key, d] of Object.entries(state.days)) {
    days[key] = {
      ...d, ...((d.sessions ?? 0) > 0 ? { sessionRewarded: true } : {}),
      ...(d.plan?.missionId ? { plan: { ...d.plan, activityId: d.plan.missionId } } : {}),
    };
  }
  return { ...state, logs, days, missions };
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
