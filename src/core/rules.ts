// 설계 원칙을 코드로 강제하는 곳: 하루 상한, 쉬기, 더 작게, 안 한 일은 기록하지 않음.
import { activities, activityById, smallerOf } from './activities';
import { hashSeed, shuffle } from './random';
import { drawPlant } from './plants';
import type { Activity, AppState, DayInfo, DecorItem, Energy, LogEntry, Plan, PlanInfo, PlantedItem, ReflectChip, SeedItem } from './types';

export const DAILY_LIMIT = 3;
export const PLACE_OPTIONS = ['집 안', '집 근처', '집 밖'] as const;
export const WHEN_OPTIONS = ['지금', '오전', '오후 3시', '저녁'] as const;

export function dayOf(draft: AppState, date: string): DayInfo {
  return (draft.days[date] ??= { refresh: 0 });
}

export function doneCount(state: AppState, date: string): number {
  return state.logs.filter((l) => l.date === date).length;
}

export function limitReached(state: AppState, date: string): boolean {
  return doneCount(state, date) >= DAILY_LIMIT;
}

export function isResting(state: AppState, date: string): boolean {
  return state.days[date]?.rested === true;
}

export function setEnergy(draft: AppState, date: string, energy: Energy): void {
  dayOf(draft, date).energy = energy;
}

/** 쉬기도 정상적인 선택. 기록은 남기지 않고 계획만 내려놓는다. */
export function chooseRest(draft: AppState, date: string): void {
  const day = dayOf(draft, date);
  day.rested = true;
  delete day.plan;
  grantPacket(draft, date);
}

/** 하루에 한 번. 꽝·등급 없이 그냥 봉투 하나. */
export function grantPacket(draft: AppState, date: string): void {
  const day = dayOf(draft, date);
  if (!day.packet) day.packet = 'ready';
}

export function pendingPacketDates(state: AppState): string[] {
  return Object.entries(state.days)
    .filter(([, d]) => d.packet === 'ready')
    .map(([date]) => date)
    .sort();
}

/** 열지 않은 씨앗 주머니 수(날마다 받는 것 + 방문 선물로 받은 특별 주머니) */
export function pendingPacketCount(state: AppState): number {
  return pendingPacketDates(state).length + state.freePackets + state.bonusPackets + (state.missions?.packets ?? 0);
}

export function openMissionPacket(draft: AppState, rand: () => number = Math.random): SeedItem | null {
  if (!draft.missions || draft.missions.packets <= 0) return null;
  draft.missions.packets--;
  return addSeed(draft, drawPlant(rand).id);
}

function plantNew(draft: AppState, plantId: string, date: string, slot: { col: number; row: number }): PlantedItem {
  const taken = [...draft.garden.plants, ...draft.garden.storage].map((p) => Number(/^plant-(\d+)$/.exec(p.id)?.[1] ?? 0));
  const planted: PlantedItem = { id: `plant-${Math.max(0, ...taken) + 1}`, plantId, date, ...slot };
  draft.garden.plants.push(planted);
  return planted;
}

export function addSeed(draft: AppState, plantId: string): SeedItem {
  const taken = draft.seeds.map((x) => Number(/^seed-(\d+)$/.exec(x.id)?.[1] ?? 0));
  const seed = { id: `seed-${Math.max(0, ...taken) + 1}`, plantId };
  draft.seeds.push(seed);
  return seed;
}

/** 그날의 주머니를 연다. 랜덤 씨앗 하나가 씨앗함에 들어가고, 심는 건 따로다. */
export function openPacket(draft: AppState, date: string, rand: () => number = Math.random): SeedItem | null {
  const day = draft.days[date];
  if (!day || day.packet !== 'ready') return null;
  day.packet = 'opened';
  return addSeed(draft, drawPlant(rand).id);
}

/** 가방의 칸별 개수. 씨앗은 안 연 봉투와 안 심은 씨앗을 합친다. */
export function bagCounts(state: AppState): { seeds: number; decor: number; plants: number } {
  const decor = state.garden.storage.filter((i) => i.type === 'decor').length;
  return { seeds: pendingPacketCount(state) + state.seeds.length, decor, plants: state.garden.storage.length - decor };
}

export function freePacket(draft: AppState): void {
  draft.freePackets += 1;
}

/** 이야기가 건넨 주머니를 연다. 활동 주머니와 같은 확률이다. */
export function openFreePacket(draft: AppState, rand: () => number = Math.random): SeedItem | null {
  if (draft.freePackets <= 0) return null;
  draft.freePackets -= 1;
  return addSeed(draft, drawPlant(rand).id);
}

/** 방문 선물로 받은 특별 주머니를 연다. 특별 씨앗만 나온다. */
export function openBonusPacket(draft: AppState, rand: () => number = Math.random): SeedItem | null {
  if (draft.bonusPackets <= 0) return null;
  draft.bonusPackets -= 1;
  return addSeed(draft, drawPlant(rand, true).id);
}

/** 씨앗함의 씨앗을 심는다. 성장은 심은 날부터이고, 자리가 없으면 씨앗은 그대로 남는다. */
export function plantSeed(draft: AppState, seedId: string, date: string, slot: { col: number; row: number } | null): PlantedItem | null {
  const idx = draft.seeds.findIndex((x) => x.id === seedId);
  if (idx === -1 || !slot) return null;
  const [seed] = draft.seeds.splice(idx, 1);
  return plantNew(draft, seed.plantId, date, slot);
}

export function undoRest(draft: AppState, date: string): void {
  dayOf(draft, date).rested = false;
}

export function defaultPlanInfo(a: Activity, when: string = WHEN_OPTIONS[0]): PlanInfo {
  return { when, where: a.kind === 'outing' ? '집 근처' : '집 안', minutes: a.minutes };
}

/** 상한에 닿았으면 false. */
export function setPlan(draft: AppState, date: string, plan: Plan): boolean {
  if (limitReached(draft, date)) return false;
  const day = dayOf(draft, date);
  day.rested = false;
  day.plan = plan;
  return true;
}

export function completePlan(
  draft: AppState,
  date: string,
  chips: ReflectChip[],
): { log: LogEntry } | null {
  const day = draft.days[date];
  const plan = day?.plan;
  if (!day || !plan || limitReached(draft, date)) return null;
  const log: LogEntry = {
    id: `${date}-${draft.logs.length + 1}`,
    date,
    activityId: plan.activityId,
    text: plan.text,
    plan: plan.info,
    chips,
    source: plan.source,
  };
  draft.logs.push(log);
  delete day.plan;
  grantPacket(draft, date);
  return { log };
}

/** 오늘 제안 후보를 섞은 순서로. 무거운 날은 1~2분짜리만. */
export function candidates(state: AppState, date: string): Activity[] {
  const day = state.days[date];
  const energy = day?.energy ?? 'normal';
  const doneIds = new Set(state.logs.filter((l) => l.date === date).map((l) => l.activityId));
  const pool = activities.filter((a) => !doneIds.has(a.id) && (energy !== 'heavy' || a.minutes <= 2));
  return shuffle(pool, hashSeed(`${date}|${energy}|${day?.refresh ?? 0}`));
}

export function suggest(state: AppState, date: string, count = 3): Activity[] {
  const all = candidates(state, date);
  const picked: Activity[] = [];
  for (const a of all) if (picked.length < count && !picked.some((p) => p.kind === a.kind)) picked.push(a);
  for (const a of all) if (picked.length < count && !picked.includes(a)) picked.push(a);
  return picked;
}

/** [바꾸기]: 지금 보이는 것들과 겹치지 않는 후보 중 하나를 무작위로. 없으면 undefined. */
export function swapCandidate(state: AppState, date: string, shown: Activity[]): Activity | undefined {
  const pool = candidates(state, date).filter((a) => !shown.some((s) => s.id === a.id));
  return pool[Math.floor(Math.random() * pool.length)];
}

/** [더 작게]: 더 작은 버전이 없으면 undefined. */
export function makeSmaller(a: Activity): Activity | undefined {
  return smallerOf(a);
}

export interface PastItem {
  key: string;
  activityId?: string;
  text?: string;
  label: string;
  icon: string;
  minutes: number;
  where: string;
  criterion?: string;
}

/** 전에 해본 활동(최근 순, 중복 없음). 일상 연결 탭의 재료. */
export function pastItems(state: AppState): PastItem[] {
  const seen = new Set<string>();
  const out: PastItem[] = [];
  for (const l of [...state.logs].reverse()) {
    const key = l.activityId ?? `text:${l.text ?? ''}`;
    if (seen.has(key) || (!l.activityId && !l.text)) continue;
    seen.add(key);
    const a = activityById(l.activityId);
    out.push({
      key, activityId: l.activityId, text: l.text, label: a?.name ?? l.text ?? '', icon: a?.icon ?? '✍️',
      minutes: l.plan.minutes, where: l.plan.where, criterion: l.plan.criterion,
    });
  }
  return out;
}

/** 기록이 쌓이면 탭에 "해볼까요?"만 붙인다. 잠그지는 않는다. */
export function tabHints(state: AppState): { daily: boolean; design: boolean } {
  return { daily: state.logs.length >= 3, design: state.logs.length >= 7 };
}

/** 정원에 놓인 소품을 창고로 치운다. */
export function storeDecor(draft: AppState, id: string): void {
  const idx = draft.garden.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const [item] = draft.garden.items.splice(idx, 1);
  draft.garden.storage.push({ id: item.id, type: 'decor', decorKind: item.kind, variant: item.variant });
}

/** 창고를 오가도 수확 기록은 그대로 들고 간다. */
function harvestInfo(p: { harvested?: boolean; harvestedOn?: string }) {
  return { ...(p.harvested ? { harvested: true } : {}), ...(p.harvestedOn ? { harvestedOn: p.harvestedOn } : {}) };
}

/** 심은 식물을 창고로 치운다. 처음 만난 날짜는 그대로 들고 간다(도감 기록 유지). */
export function storePlant(draft: AppState, id: string): void {
  const idx = draft.garden.plants.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const [plant] = draft.garden.plants.splice(idx, 1);
  draft.garden.storage.push({ id: plant.id, type: 'plant', plantId: plant.plantId, date: plant.date, ...harvestInfo(plant) });
}

/** 창고에서 꺼내 칸에 놓는다. 칸이 비어 있는지는 호출하는 쪽(화면)이 먼저 확인한다. */
export function takeFromStorage(draft: AppState, id: string, slot: { col: number; row: number }): DecorItem | PlantedItem | null {
  const idx = draft.garden.storage.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const [stored] = draft.garden.storage.splice(idx, 1);
  if (stored.type === 'decor') {
    const item: DecorItem = { id: stored.id, kind: stored.decorKind, variant: stored.variant, ...slot };
    draft.garden.items.push(item);
    return item;
  }
  const planted: PlantedItem = { id: stored.id, plantId: stored.plantId, date: stored.date, ...harvestInfo(stored), ...slot };
  draft.garden.plants.push(planted);
  return planted;
}

export function designPlan(text: string, when: string, criterion: string): Plan | null {
  const t = text.trim();
  if (!t) return null;
  const c = criterion.trim();
  return { text: t, info: { when, where: '', minutes: 0, ...(c ? { criterion: c } : {}) }, source: 'design' };
}
