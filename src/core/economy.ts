// 정원의 순환: 씨앗이 자라고(성장), 꽃이 열매를 맺고(수확), 열매로 소품을 사고(상점), 방문하면 작은 선물을 받는다(선물함).
// 모두 순수 함수다. 시드는 식물은 없고, 수확한 꽃은 창고에 남으며, 열매가 줄어드는 건 사용자가 상점에서 쓸 때뿐이다.
import { daysBetween } from './clock';
import { isTree } from './plants';
import { storePlant } from './rules';
import type { AppState, DecorItem, PlantedItem } from './types';

// ---------- 성장 ----------
export type GrowthStage = 'seed' | 'sprout' | 'young' | 'bloom';

/** 심은 날 씨앗, 다음 날부터 새싹, 꽃은 3일 뒤 핀다. 나무는 3일 뒤 어린 나무, 6일 뒤 다 자란다. 저장하는 상태가 없다. */
export function growthStage(plantedOn: string, today: string, plantId = ''): GrowthStage {
  const days = daysBetween(plantedOn, today);
  if (days < 1) return 'seed';
  if (days < 3) return 'sprout';
  return !isTree(plantId) || days >= 6 ? 'bloom' : 'young';
}

// ---------- 수확 ----------
export const FRUIT_PER_HARVEST = 3;
/** 나무에 다시 열린 열매는 하나다. 꽃보다 크게 유리하지 않게 한다(임시값). */
export const FRUIT_PER_REGROW = 1;
/** 나무는 수확 뒤 정원에 참여한 날(회차를 마친 날·쉬기를 고른 날)이 이만큼 쌓이면 다시 열린다. 날짜만 지나서는 열리지 않는다(보상은 현실 활동에서만). */
export const REGROW_DAYS = 3;

/** 그 날짜 뒤로 참여한 날 수: 회차를 마친 날, 쉬기를 고른 날, 예전 저장본에서 하루 주머니를 받은 날. 연속 여부는 보지 않는다. */
function activeDaysSince(days: AppState['days'], since: string): number {
  return Object.entries(days).filter(([date, d]) => date > since && (d.packet || d.rested || (d.sessions ?? 0) > 0)).length;
}

export function canHarvest(plant: PlantedItem, today: string, days: AppState['days']): boolean {
  if (growthStage(plant.date, today, plant.plantId) !== 'bloom') return false;
  if (!plant.harvested) return true;
  return isTree(plant.plantId) && activeDaysSince(days, plant.harvestedOn ?? plant.date) >= REGROW_DAYS;
}

/** 열매를 딴다. 꽃은 창고로 가서 두둑이 비고, 나무는 자리에 남아 다시 맺는다. 딴 열매 수를 돌려준다(못 땄으면 0). */
export function harvest(draft: AppState, plantId: string, today: string): number {
  const plant = draft.garden.plants.find((p) => p.id === plantId);
  if (!plant || !canHarvest(plant, today, draft.days)) return 0;
  const got = plant.harvested ? FRUIT_PER_REGROW : FRUIT_PER_HARVEST;
  plant.harvested = true;
  if (isTree(plant.plantId)) plant.harvestedOn = today;
  else storePlant(draft, plantId);
  draft.fruit += got;
  return got;
}

/** 놓는 곳: 키우는 꽃은 밭의 두둑, 나무와 수확한 꽃은 마당. */
export function placeZone(thing: { plantId?: string; harvested?: boolean }): 'field' | 'yard' {
  return thing.harvested || isTree(thing.plantId ?? '') ? 'yard' : 'field';
}

// ---------- 상점 ----------
export type ShopKind = Extract<DecorItem['kind'], 'bench' | 'table' | 'flowerpot' | 'shelf' | 'birdbath' | 'hammock'>;

/** 가격은 임시값이다. 시연으로 조정한다. 가격이 모두 열매 수확 한두 번 안에 들어오게 잡았다. */
export const SHOP: { kind: ShopKind; price: number }[] = [
  { kind: 'bench', price: 4 },
  { kind: 'table', price: 5 },
  { kind: 'flowerpot', price: 6 },
  { kind: 'shelf', price: 7 },
  { kind: 'birdbath', price: 8 },
  { kind: 'hammock', price: 10 },
];

export type BuyResult = 'ok' | 'poor' | 'unknown';

/** 열매로 소품을 사서 꾸미기 창고에 넣는다(어디에 놓을지는 사용자가 정한다). 열매가 모자라면 아무것도 바뀌지 않는다. */
export function buy(draft: AppState, kind: string): BuyResult {
  const item = SHOP.find((s) => s.kind === kind);
  if (!item) return 'unknown';
  if (draft.fruit < item.price) return 'poor';
  draft.fruit -= item.price;
  draft.purchases += 1;
  draft.garden.storage.push({ id: `buy-${draft.purchases}`, type: 'decor', decorKind: item.kind, variant: 0 });
  return 'ok';
}

// ---------- 방문 선물함 ----------
export const GIFT_DAILY_FRUIT = 2;

/** 누적 방문 횟수 기념 선물. 쉬었다 돌아와도 횟수는 그대로이고 줄어들지 않는다. 숫자와 물품은 임시값. */
export const GIFT_REWARDS: { at: number; reward: 'decor' | 'packet'; kind?: ShopKind }[] = [
  { at: 3, reward: 'decor', kind: 'table' },
  { at: 7, reward: 'packet' },
  { at: 14, reward: 'decor', kind: 'hammock' },
];
export const GIFT_MILESTONES = GIFT_REWARDS.map((r) => r.at);
/** 도장판 한 장의 칸 수. 가득 차도 횟수는 계속 세고 선물은 더 없다. */
export const GIFT_BOARD_SIZE = 14;

export interface GiftResult {
  fruit: number;
  count: number;
  /** 이번에 받은 기념 선물 */
  milestone?: { at: number; reward: 'decor' | 'packet'; kind?: ShopKind };
}

export interface BoardCell {
  n: number;
  /** 그만큼 찾아왔으면 도장이 찍힌다 */
  stamped: boolean;
  /** 기념 선물이 든 칸. given은 이미 받았는지. 날짜를 보지 않으므로 빈 칸이 "놓친 날"로 보이지 않는다. */
  reward?: { kind: 'decor' | 'packet'; decor?: ShopKind; given: boolean };
}

/** 방문 도장판: 날짜 달력이 아니라 누적 횟수만 본다. 연속·초기화·기한이 없다. */
export function giftBoard(state: AppState): BoardCell[] {
  return Array.from({ length: GIFT_BOARD_SIZE }, (_, i) => {
    const n = i + 1;
    const r = GIFT_REWARDS.find((x) => x.at === n);
    const stamped = state.visits.count >= n;
    return { n, stamped, ...(r ? { reward: { kind: r.reward, decor: r.kind, given: stamped } } : {}) };
  });
}

export function giftAvailable(state: AppState, today: string): boolean {
  return state.visits.last !== today;
}

/** 오늘의 선물을 받는다. 하루 한 번이고 연속 여부는 보지 않는다. 이미 받았으면 null. */
export function claimGift(draft: AppState, today: string): GiftResult | null {
  if (!giftAvailable(draft, today)) return null;
  draft.visits.count += 1;
  draft.visits.last = today;
  draft.fruit += GIFT_DAILY_FRUIT;
  const result: GiftResult = { fruit: GIFT_DAILY_FRUIT, count: draft.visits.count };
  const r = GIFT_REWARDS.find((x) => x.at === draft.visits.count);
  if (r?.reward === 'decor' && r.kind) {
    draft.purchases += 1;
    draft.garden.storage.push({ id: `gift-${draft.purchases}`, type: 'decor', decorKind: r.kind, variant: 0 });
    result.milestone = { at: r.at, reward: 'decor', kind: r.kind };
  } else if (r?.reward === 'packet') {
    draft.bonusPackets += 1;
    result.milestone = { at: r.at, reward: 'packet' };
  }
  return result;
}
