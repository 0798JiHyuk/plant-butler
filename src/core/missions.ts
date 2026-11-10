// 팀 미션 90개(일상·학업·업무복귀 × 6단계)를 고르고 잇는 규칙. 원본은 docs/missions/,
// 게임용 데이터(data/missions.json)는 tools/import_missions.py가 만든다. 이번엔 1~4단계 카드만 추천한다.
import raw from './data/missions.json';
import { setPlan } from './rules';
import type { Speaker } from './story';
import type { AppState, CategoryId, MissionStep, Variant, WorkStatus } from './types';

export interface Mission {
  id: string;
  categoryId: CategoryId;
  stage: number;
  stageName: string;
  /** 장면(drink·exam 등). all이면 그 영역의 모든 장면에 맞는다. */
  intentIds: string[];
  npc: Speaker;
  dialogue: string;
  name: string;
  /** 기본 행동과 줄인 행동 */
  basic: string;
  small: string;
  buttonLabel: string;
  /** 수첩에 남는 기록 문장 */
  record: string;
  smallRecord: string;
  conditionSummary: string;
  /** 비어 있으면 복귀 상태와 상관없다. W06~W20은 복귀 후(returned)만. */
  allowedWorkStatuses: WorkStatus[];
  /** 그 크기를 하는 데 필요한 조건 키. 처음엔 모두 모른다(묻지 않고 카드에 조건을 보여 준다). */
  basicFacts: string[];
  smallFacts: string[];
  mode: 'activity' | 'create_and_execute' | 'plan_and_execute' | 'day_and_execute';
  /** 정렬용 다음 번호. 바로 실행하지 않고, 거르기를 통과하는 다음 카드를 찾을 때만 쓴다. */
  nextId: string | null;
}

export interface SceneChoice {
  label: string;
  missionId: string;
}

interface MissionData {
  version: string;
  first: {
    daily: { scenes: SceneChoice[]; previews: string[] };
    academic: { missionId: string; targets: { label: string; intent: string }[] };
    work: { pre_return: SceneChoice[]; returned: SceneChoice[] };
  };
  missions: Mission[];
}

const data = raw as unknown as MissionData;
export const MISSIONS: Mission[] = data.missions;
/** 영역별 첫 미션 표(원본 firstRecommendations) */
export const FIRST = data.first;
/** 이번엔 4단계까지만 추천한다(5~6단계는 미션 편집기·내 하루 지도와 함께). */
export const MAX_STAGE = 4;

export function missionById(id: string | null | undefined): Mission | undefined {
  return id ? MISSIONS.find((m) => m.id === id) : undefined;
}

// ---------- 거르기 ----------
function skipOf(state: AppState, date: string): AppState['missions']['skip'] {
  return state.missions.skip.date === date ? state.missions.skip : { date, facts: [], cards: [] };
}

/** 그날 "해당 없어요"에 걸리지 않는 크기. 조건을 모르면(처음엔 모두 모른다) 맞는 것으로 보고 카드에 조건을 보여 준다. */
export function eligibleVariants(state: AppState, date: string, m: Mission): Variant[] {
  const skip = skipOf(state, date);
  if (skip.cards.includes(m.id)) return [];
  const ok = (facts: string[]) => !facts.some((f) => skip.facts.includes(f));
  return (['basic', 'small'] as const).filter((v) => ok(v === 'basic' ? m.basicFacts : m.smallFacts));
}

/** 후보 거르기(원본 0.6 순서): 같은 영역 → 장면이 맞거나 all → 업무 복귀 상태 → 조건 → 4단계까지 */
export function fits(state: AppState, date: string, m: Mission, category: CategoryId): boolean {
  const ms = state.missions;
  if (m.categoryId !== category || m.stage > MAX_STAGE) return false;
  const intent = ms.intents[category];
  if (intent && !m.intentIds.includes('all') && !m.intentIds.includes(intent)) return false;
  if (m.allowedWorkStatuses.length > 0 && !m.allowedWorkStatuses.includes(ms.workStatus)) return false;
  return eligibleVariants(state, date, m).length > 0;
}

/** 먼저 보여 줄 크기: 오늘 "조금 무거워요"면 줄인 행동, 아니면 기본(안 맞는 크기는 건너뛴다). 고르는 건 사용자다. */
export function preferred(state: AppState, date: string, m: Mission): Variant {
  const vs = eligibleVariants(state, date, m);
  const heavy = state.days[date]?.energy === 'heavy';
  return (heavy && vs.includes('small')) || !vs.includes('basic') ? 'small' : 'basic';
}

// ---------- 다음 카드 ----------
export interface Suggestion extends MissionStep {
  /** 지금 추천 단계보다 높은 단계라 "다음 길을 볼래?"를 먼저 묻는다 */
  crosses: boolean;
}

/** 이번 회차에 마지막으로 해낸 카드 행동(직접 적은 일은 건너뛴다) */
export function lastStep(state: AppState): MissionStep | null {
  const acts = state.missions.session?.actions ?? [];
  for (let i = acts.length - 1; i >= 0; i--) {
    const { missionId, variant } = acts[i];
    if (missionId && variant) return { missionId, variant };
  }
  return null;
}

/** 다음 번호를 따라가며 거르기를 통과하는 첫 카드. 4단계를 넘으면 멈춘다(번호는 정렬용일 뿐 그대로 실행하지 않는다). */
function nextFitting(state: AppState, date: string, cur: Mission): Mission | null {
  const seen = new Set([cur.id]);
  for (let m = missionById(cur.nextId); m && m.stage <= MAX_STAGE && !seen.has(m.id); m = missionById(m.nextId)) {
    seen.add(m.id);
    if (fits(state, date, m, cur.categoryId)) return m;
  }
  return null;
}

/** [더 해 볼래]: 줄인 행동만 했으면 같은 카드의 기본, 기본을 했으면 조건에 맞는 다음 카드. 4단계 안에 없으면 null. */
export function moreAfter(state: AppState, date: string, step: MissionStep): Suggestion | null {
  const cur = missionById(step.missionId);
  if (!cur) return null;
  const didBasic = (state.missions.session?.actions ?? []).some((a) => a.missionId === cur.id && a.variant === 'basic');
  if (step.variant === 'small' && !didBasic && eligibleVariants(state, date, cur).includes('basic')) {
    return { missionId: cur.id, variant: 'basic', crosses: false };
  }
  const next = nextFitting(state, date, cur);
  if (!next) return null;
  return { missionId: next.id, variant: preferred(state, date, next), crosses: next.stage > state.missions.stage[cur.categoryId] };
}

/** [다른 걸 할래]: 같은 영역·장면·단계에서 맞는 다른 카드 최대 2개(지금 카드 다음 번호부터). 없으면 이전 단계에서 가까운 것부터. */
export function alternatives(state: AppState, date: string, fromId: string): Mission[] {
  const cur = missionById(fromId);
  if (!cur) return [];
  const pool = MISSIONS.filter((m) => m.id !== cur.id && fits(state, date, m, cur.categoryId));
  const same = pool.filter((m) => m.stage === cur.stage);
  const ordered = [...same.filter((m) => m.id > cur.id), ...same.filter((m) => m.id < cur.id)];
  if (ordered.length > 0) return ordered.slice(0, 2);
  return pool.filter((m) => m.stage < cur.stage).sort((a, b) => b.stage - a.stage || a.id.localeCompare(b.id)).slice(0, 2);
}

/** 일상에서 장면을 건너뛰면: D01·D03·D05 미리보기 중 지금 맞는 것 */
export function previewCards(state: AppState, date: string): Mission[] {
  return FIRST.daily.previews.map((id) => missionById(id)).filter((m): m is Mission => !!m && fits(state, date, m, 'daily'));
}

/** 카드 흐름을 다시 열 때의 첫 카드: 표지판 → 마지막으로 고른 카드(둘 다 조건을 다시 거른다). 없으면 null(장면 고르기). */
export function startCard(state: AppState, date: string): (MissionStep & { bookmark: boolean }) | null {
  const cat = state.missions.category;
  if (!cat) return null;
  const bm = state.missions.bookmarks[cat];
  const bmCard = missionById(bm?.missionId);
  if (bm && bmCard && fits(state, date, bmCard, cat)) {
    const vs = eligibleVariants(state, date, bmCard);
    return { missionId: bmCard.id, variant: vs.includes(bm.variant) ? bm.variant : vs[0], bookmark: true };
  }
  const last = missionById(state.missions.last[cat]);
  if (last && fits(state, date, last, cat)) return { missionId: last.id, variant: preferred(state, date, last), bookmark: false };
  return null;
}

/** [여기까지] 뒤 표지판 제안: 줄인 행동만 했으면 같은 카드의 기본, 기본을 했으면 다음 카드의 줄인 행동. 번호만 보고 정하지 않는다. */
export function bookmarkSuggestion(state: AppState, date: string): MissionStep | null {
  const step = lastStep(state);
  if (!step) return null;
  const next = moreAfter(state, date, step);
  if (!next) return null;
  if (next.missionId === step.missionId) return { missionId: step.missionId, variant: 'basic' };
  const m = missionById(next.missionId)!;
  return { missionId: m.id, variant: eligibleVariants(state, date, m).includes('small') ? 'small' : 'basic' };
}

// ---------- 고르기 ----------
export function chooseArea(draft: AppState, category: CategoryId): void {
  draft.missions.category = category;
}

export function chooseWorkStatus(draft: AppState, status: WorkStatus): void {
  draft.missions.workStatus = status;
}

/** 장면 고르기. null이면 그 영역의 모든 장면(미리보기에서 고를 때) */
export function chooseIntent(draft: AppState, category: CategoryId, intent: string | null): void {
  if (intent) draft.missions.intents[category] = intent;
  else delete draft.missions.intents[category];
}

/** "해당 없어요": 이 카드와, 같은 조건이 걸린 카드를 그날만 뺀다. */
export function markNotApplicable(draft: AppState, date: string, id: string): void {
  const m = missionById(id);
  if (!m) return;
  const cur = skipOf(draft, date);
  draft.missions.skip = {
    date,
    facts: [...new Set([...cur.facts, ...m.basicFacts, ...m.smallFacts])],
    cards: [...new Set([...cur.cards, m.id])],
  };
}

/** "다음 길을 볼래": 추천 단계를 그 카드의 단계로 올린다(내려가지 않고 4단계까지). */
export function advanceStage(draft: AppState, id: string): void {
  const m = missionById(id);
  if (!m) return;
  const st = draft.missions.stage;
  st[m.categoryId] = Math.min(MAX_STAGE, Math.max(st[m.categoryId], m.stage));
}

/** 표지판에 남긴다(영역마다 하나). */
export function saveBookmark(draft: AppState, step: MissionStep): void {
  const m = missionById(step.missionId);
  if (m) draft.missions.bookmarks[m.categoryId] = step;
}

/** 카드의 한 크기를 고른다: 오늘 계획이 되고(회차가 없으면 열린다) 마지막 카드·장면을 기억한다. 표지판 카드면 표지판을 쓴 것으로 지운다. 하루 상한이면 false. */
export function chooseMission(draft: AppState, date: string, step: MissionStep): boolean {
  const m = missionById(step.missionId);
  if (!m || !eligibleVariants(draft, date, m).includes(step.variant)) return false;
  const plan = { missionId: m.id, variant: step.variant, info: { when: '지금', where: '', minutes: 0 }, source: 'mission' as const };
  if (!setPlan(draft, date, plan)) return false;
  const ms = draft.missions;
  ms.category = m.categoryId;
  const intent = ms.intents[m.categoryId];
  if (!m.intentIds.includes('all') && !(intent && m.intentIds.includes(intent))) ms.intents[m.categoryId] = m.intentIds[0];
  ms.last[m.categoryId] = m.id;
  if (ms.bookmarks[m.categoryId]?.missionId === m.id) delete ms.bookmarks[m.categoryId];
  return true;
}

// ---------- 문장 ----------
/** 고른 크기의 행동 문장 */
export function actionText(m: Mission, v: Variant): string {
  return v === 'basic' ? m.basic : m.small;
}

/** 수첩에 남는 기록 문장 */
export function recordText(m: Mission, v: Variant): string {
  return v === 'basic' ? m.record : m.smallRecord;
}
