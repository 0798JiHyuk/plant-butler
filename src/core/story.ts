// 이야기 재생 규칙. 대사는 data/story.json에 장면 단위로 넣고, 화면(panels/Story.tsx)은 이 규칙대로 보여 주기만 한다.
// 대본 원본은 팀 스토리 바이블(틈새정원). 옮기지 않은 장면과 이유는 docs/story-scenes.md.
import { daysBetween } from './clock';
import raw from './data/story.json';
import { canHarvest, giftAvailable } from './economy';
import { chooseRest, freePacket, pendingPacketCount, setPlan } from './rules';
import type { AppState } from './types';

export type Speaker = 'nuri' | 'moru' | 'pio' | 'sprout';
export type NpcSpeaker = Exclude<Speaker, 'sprout'>;
/** free-packet만 한 번뿐이고, 나머지는 고를 때마다 일어난다. */
export type StoryEffect = 'free-packet' | 'restore-plan' | 'drop-plan' | 'rest';
/** 장면이 끝난 뒤 이어지는 화면. 여는 일은 flow.ts가 한다. */
export type StoryAfter = 'packet' | 'seeds' | 'activity' | 'daily' | 'design' | 'plan' | 'shop' | 'book' | 'gift' | 'harvest';
/** 대사가 실제 상태와 어긋나지 않게 고르는 조건 */
export type StoryCond = 'seeds' | 'harvestable' | 'gift' | 'pending-plan' | 'decor' | 'plants';

export interface StoryChoice {
  label: string;
  /** 없으면 이 선택으로 장면이 끝난다 */
  next?: string;
  do?: StoryEffect[];
  after?: StoryAfter;
}

export interface StoryNode {
  who: Speaker;
  text: string;
  next?: string;
  choices?: StoryChoice[];
  /** 이 대사가 나올 때 일어나는 일 */
  do?: StoryEffect[];
  /** 장면이 끝난 뒤 이어지는 화면 */
  after?: StoryAfter;
  /** 조건이 맞는 첫 갈래로 간다. 아무것도 안 맞으면 next. */
  branch?: { if: StoryCond; next: string }[];
}

export interface StoryScene {
  start: string;
  nodes: Record<string, StoryNode>;
  /** 어느 길로 끝나든, 중간에 닫아도 받는 것(이야기가 보상을 잠그지 않게) */
  always?: StoryEffect[];
}

export const scenes = raw as unknown as Record<string, StoryScene>;

/** 지난 날에 세워 두고 아직 하지 않은 계획(가장 최근). 오늘 계획이 있으면 없다. */
export function pastPlanDate(state: AppState, today: string): string | null {
  return state.days[today]?.plan ? null : latestPastPlan(state, today);
}

function latestPastPlan(state: AppState, today: string): string | null {
  const dates = Object.keys(state.days).filter((d) => d < today && state.days[d].plan).sort();
  return dates[dates.length - 1] ?? null;
}

function applyEffect(draft: AppState, effect: StoryEffect, today: string): void {
  if (effect === 'free-packet') {
    if (draft.story.seen.includes(effect)) return;
    draft.story.seen.push(effect);
    freePacket(draft);
  } else if (effect === 'rest') {
    chooseRest(draft, today);
  } else {
    const from = effect === 'restore-plan' ? pastPlanDate(draft, today) : latestPastPlan(draft, today);
    if (!from) return;
    const plan = draft.days[from].plan!;
    // 오늘 상한에 닿았으면 옮기지 않고 그대로 둔다(지우지도 않음).
    if (effect === 'restore-plan' && !setPlan(draft, today, plan)) return;
    delete draft.days[from].plan;
  }
}

export function enterNode(draft: AppState, node: StoryNode, today = ''): void {
  node.do?.forEach((e) => applyEffect(draft, e, today));
}

export function applyChoice(draft: AppState, choice: StoryChoice, today: string): void {
  choice.do?.forEach((e) => applyEffect(draft, e, today));
}

function holds(state: AppState, cond: StoryCond, today: string): boolean {
  switch (cond) {
    case 'seeds': return pendingPacketCount(state) + state.seeds.length > 0;
    case 'harvestable': return state.garden.plants.some((p) => canHarvest(p, today, state.days));
    case 'gift': return giftAvailable(state, today);
    case 'pending-plan': return pastPlanDate(state, today) !== null;
    case 'decor': return state.garden.items.length > 0;
    case 'plants': return state.garden.plants.length > 0;
  }
}

export function resolveNext(state: AppState, node: StoryNode, today: string): string | undefined {
  return node.branch?.find((b) => holds(state, b.if, today))?.next ?? node.next;
}

/** 고른 답을 기억한다. 뒤 장면에서 분기할 때 읽는다. */
export function rememberChoice(draft: AppState, sceneId: string, nodeId: string, index: number): void {
  draft.story.choices[`${sceneId}/${nodeId}`] = index;
}

export function finishScene(draft: AppState, sceneId: string, today = ''): void {
  scenes[sceneId].always?.forEach((e) => applyEffect(draft, e, today));
  if (!draft.story.seen.includes(sceneId)) draft.story.seen.push(sceneId);
  if (today && isNpcScene(sceneId)) draft.story.lastDay = today;
}

/** 처음 온 사람에게만 프롤로그를 보여 준다. 이미 쓰던 저장본에는 끼어들지 않는다. */
export function needsIntro(state: AppState): boolean {
  return !state.story.seen.includes('intro') && state.logs.length === 0 && state.garden.plants.length === 0;
}

/** 본편 순서. 앞 장면을 봐야 다음이 열리고, 씨앗·열매·구매 같은 경제 상태로는 잠그지 않는다. */
export const MAIN_ORDER: { id: string; npc: NpcSpeaker | 'any' }[] = [
  { id: 'a01', npc: 'nuri' },
  { id: 'b01', npc: 'moru' },
  { id: 'b02', npc: 'moru' },
  { id: 'c01', npc: 'pio' },
  { id: 'c02', npc: 'pio' },
  { id: 'd01', npc: 'any' },
  { id: 'e01', npc: 'any' },
];

/** 주민별 서브 이야기. 그 주민의 본편을 다 본 뒤 순서대로. */
export const SIDE_ORDER: Record<NpcSpeaker, string[]> = { nuri: ['s01', 's02'], moru: ['s03', 's04'], pio: ['s05', 's06'] };

/** 주민 이야기(본편+서브)는 하루에 하나. 매일 오라고 하지 않고, 다시 올 이유만 남긴다. */
export const SCENES_PER_DAY = 1;

function isNpcScene(id: string): boolean {
  return MAIN_ORDER.some((m) => m.id === id) || Object.values(SIDE_ORDER).some((ids) => ids.includes(id));
}

/** 이 주민을 눌렀을 때 재생할 장면. 없으면 null(평소 대사). 데모 모드는 하루 제한이 없다. */
export function nextSceneFor(state: AppState, npc: NpcSpeaker, today: string): string | null {
  const seen = state.story.seen;
  if (!seen.includes('intro')) return null;
  if (!state.settings.demo && SCENES_PER_DAY <= 1 && state.story.lastDay === today) return null;
  const main = MAIN_ORDER.find((m) => !seen.includes(m.id));
  if (main && (main.npc === npc || main.npc === 'any')) return main.id;
  const ownMainDone = MAIN_ORDER.filter((m) => m.npc === npc).every((m) => seen.includes(m.id));
  if (!ownMainDone) return null;
  return SIDE_ORDER[npc].find((id) => !seen.includes(id)) ?? null;
}

/** 마지막으로 해낸 날 또는 쉬기를 고른 날(앱만 연 날은 세지 않는다). */
function lastActiveDate(state: AppState): string | null {
  const dates = [...state.logs.map((l) => l.date), ...Object.keys(state.days).filter((d) => state.days[d].rested)];
  return dates.sort()[dates.length - 1] ?? null;
}

/** 복귀로 보는 공백(팀 결정 2026-10-29: 마지막 완료·쉬기부터 2일 이상) */
export const RETURN_GAP_DAYS = 2;

/** 오랜만에 돌아왔을 때 보여 줄 장면. 공백 일수는 말하지 않고, 하루에 한 번만. */
export function returnScene(state: AppState, today: string): string | null {
  if (!state.story.seen.includes('intro') || state.story.lastReturn === today) return null;
  const last = lastActiveDate(state);
  if (!last || daysBetween(last, today) < RETURN_GAP_DAYS) return null;
  if (holds(state, 'pending-plan', today)) return 'r02';
  const lastLog = [...state.logs].sort((a, b) => a.date.localeCompare(b.date))[state.logs.length - 1];
  if (lastLog?.source === 'design') return 'r03';
  if (holds(state, 'seeds', today)) return 'r07';
  if (holds(state, 'harvestable', today)) return 'r06';
  if (holds(state, 'gift', today)) return 'r10';
  return 'r01';
}

export function markReturnSeen(draft: AppState, today: string): void {
  draft.story.lastReturn = today;
}

/** 장면의 잘못된 연결을 찾는다(json을 고칠 때 테스트가 잡아 준다). */
export function brokenLinks(scene: StoryScene): string[] {
  const bad: string[] = scene.nodes[scene.start] ? [] : [scene.start];
  for (const node of Object.values(scene.nodes)) {
    for (const to of [node.next, ...(node.choices ?? []).map((c) => c.next), ...(node.branch ?? []).map((b) => b.next)]) {
      if (to && !scene.nodes[to]) bad.push(to);
    }
  }
  return bad;
}
