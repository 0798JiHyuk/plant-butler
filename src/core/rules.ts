// 설계 원칙을 코드로 강제하는 곳: 하루 상한, 쉬기, 회차와 씨앗, 안 한 일은 기록하지 않음.
import { drawPlant } from './plants';
import type { AppState, DayInfo, DecorItem, Energy, LogEntry, MissionSession, Plan, PlantedItem, ReflectChip, SeedItem } from './types';

/** 하루에 마치는 회차 수(원칙 "하루 활동 최대 3개"). 씨앗도 하루 최대 3개다. */
export const DAILY_LIMIT = 3;
export const WHEN_OPTIONS = ['지금', '오전', '오후 3시', '저녁'] as const;

export function dayOf(draft: AppState, date: string): DayInfo {
  return (draft.days[date] ??= { refresh: 0 });
}

/** 그날 마친 회차 수 */
export function sessionsDone(state: AppState, date: string): number {
  return state.days[date]?.sessions ?? 0;
}

/** 오늘 열린 회차에 해낸 행동이 있는지([더 해 볼래]·[여기까지]를 보여 줄 때) */
export function sessionHasActions(state: AppState, date: string): boolean {
  const s = state.missions.session;
  return !!s && s.date === date && s.actions.length > 0;
}

/** 오늘 마친 회차가 3개이고 열린 회차가 없으면 새로 시작하지 않는다. 열린 회차 안에서는 이어서 할 수 있다. */
export function limitReached(state: AppState, date: string): boolean {
  return sessionsDone(state, date) >= DAILY_LIMIT && state.missions.session?.date !== date;
}

export function isResting(state: AppState, date: string): boolean {
  return state.days[date]?.rested === true;
}

export function setEnergy(draft: AppState, date: string, energy: Energy): void {
  dayOf(draft, date).energy = energy;
}

// ---------- 회차 ----------
/** 회차를 닫는다(원본 0.7). 해낸 행동이 있으면 씨앗 주머니 1개, 없으면 건너뛴 것으로 끝난다. 닫힌 회차는 사라지므로 두 번 닫아도 씨앗은 한 번이다. */
export function closeSession(draft: AppState): { seeded: boolean } {
  const s = draft.missions.session;
  if (!s) return { seeded: false };
  draft.missions.session = null;
  if (s.actions.length === 0) return { seeded: false };
  draft.sessionPackets += 1;
  const day = dayOf(draft, s.date);
  day.sessions = (day.sessions ?? 0) + 1;
  return { seeded: true };
}

/** 열린 회차. 없으면 연다(하루 상한이면 null). 지난 날의 회차는 그날 것으로 먼저 정산한다. */
function ensureSession(draft: AppState, date: string): MissionSession | null {
  const ms = draft.missions;
  if (ms.session && ms.session.date !== date) closeSession(draft);
  if (ms.session) return ms.session;
  if (sessionsDone(draft, date) >= DAILY_LIMIT) return null;
  ms.seq += 1;
  ms.session = { id: `${date}-s${ms.seq}`, date, actions: [] };
  return ms.session;
}

/** 앱을 열 때: 지난 날에 열어 둔 회차를 그날 것으로 정산한다(해낸 행동이 있었으면 씨앗은 그대로 받는다). */
export function settleOldSession(draft: AppState, today: string): void {
  if (draft.missions.session && draft.missions.session.date < today) closeSession(draft);
}

/** 쉬기도 정상적인 선택. 해낸 행동이 있는 회차는 먼저 정상으로 닫고(씨앗 1개), 없으면 씨앗 없이 쉰다. 잃는 것은 없다. */
export function chooseRest(draft: AppState, date: string): void {
  const day = dayOf(draft, date);
  day.rested = true;
  delete day.plan;
  closeSession(draft);
}

export function pendingPacketDates(state: AppState): string[] {
  return Object.entries(state.days)
    .filter(([, d]) => d.packet === 'ready')
    .map(([date]) => date)
    .sort();
}

/** 열지 않은 씨앗 주머니 수(예전 하루 주머니 + 이야기 + 회차 + 방문 선물의 특별 주머니) */
export function pendingPacketCount(state: AppState): number {
  return pendingPacketDates(state).length + state.freePackets + state.sessionPackets + state.bonusPackets;
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

/** 예전 저장본의 하루 주머니를 연다. 랜덤 씨앗 하나가 씨앗함에 들어가고, 심는 건 따로다. */
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

/** 회차를 마치고 받은 주머니를 연다. 하루 주머니와 같은 확률이다. */
export function openSessionPacket(draft: AppState, rand: () => number = Math.random): SeedItem | null {
  if (draft.sessionPackets <= 0) return null;
  draft.sessionPackets -= 1;
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

/** 계획을 세운다. 회차가 없으면 열고, 하루 상한이면 false. */
export function setPlan(draft: AppState, date: string, plan: Plan): boolean {
  if (!ensureSession(draft, date)) return false;
  const day = dayOf(draft, date);
  day.rested = false;
  day.plan = plan;
  return true;
}

/** [했어]: 고른 행동을 기록하고 회차에 더한다. 씨앗은 회차를 닫을 때 준다. */
export function reportAction(draft: AppState, date: string, chips: ReflectChip[]): { log: LogEntry } | null {
  const day = draft.days[date];
  const plan = day?.plan;
  if (!day || !plan) return null;
  const session = ensureSession(draft, date);
  if (!session) return null;
  const log: LogEntry = {
    id: `${date}-${draft.logs.length + 1}`,
    date,
    activityId: plan.activityId,
    missionId: plan.missionId,
    variant: plan.variant,
    sessionId: session.id,
    text: plan.text,
    plan: plan.info,
    chips,
    source: plan.source,
  };
  draft.logs.push(log);
  session.actions.push({ missionId: plan.missionId, variant: plan.variant });
  delete day.plan;
  return { log };
}

/** 정원에 놓인 소품을 창고로 치운다. */
export function storeDecor(draft: AppState, id: string): void {
  const idx = draft.garden.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const [item] = draft.garden.items.splice(idx, 1);
  draft.garden.storage.push({ id: item.id, type: 'decor', decorKind: item.kind, variant: item.variant, ...(item.flip ? { flip: true } : {}) });
}

/** 놓인 소품의 좌우를 바꾼다. 없는 소품이면 false. 놓을 수 있는지(겹침)는 화면이 먼저 확인한다. */
export function flipDecor(draft: AppState, id: string): boolean {
  const item = draft.garden.items.find((i) => i.id === id);
  if (!item) return false;
  if (item.flip) delete item.flip;
  else item.flip = true;
  return true;
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
    const item: DecorItem = { id: stored.id, kind: stored.decorKind, variant: stored.variant, ...slot, ...(stored.flip ? { flip: true } : {}) };
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
