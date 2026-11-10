import { describe, expect, it } from 'vitest';
import {
  buy, canHarvest, claimGift, FRUIT_PER_HARVEST, GIFT_BOARD_SIZE, giftBoard, FRUIT_PER_REGROW, giftAvailable, GIFT_DAILY_FRUIT, growthStage, harvest, placeZone, SHOP,
} from '../core/economy';
import { drawPlant, isTree, plants, RARE_CHANCE, TREE_CHANCE } from '../core/plants';
import { rng } from '../core/random';
import { bagCounts, openBonusPacket, openPacket, pendingPacketCount, plantSeed, chooseRest, storePlant, takeFromStorage } from '../core/rules';
import { createState } from '../core/store';
import type { AppState } from '../core/types';

const D = '2026-11-02';
const plantedOn = (s: AppState, date: string) => {
  s.days[date] = { refresh: 0, packet: 'ready' };
  return plantSeed(s, openPacket(s, date, rng(1))!.id, date, { col: 5, row: 5 })!;
};

describe('씨앗 뽑기', () => {
  it('일반 8종 85%, 특별 4종 15% 정도로 나오고 모든 식물이 나온다', () => {
    const r = rng(11);
    const N = 20000;
    const count = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const p = drawPlant(r);
      count.set(p.id, (count.get(p.id) ?? 0) + 1);
    }
    const rareShare = plants.filter((p) => p.rare).reduce((n, p) => n + (count.get(p.id) ?? 0), 0) / N;
    expect(rareShare).toBeGreaterThan(RARE_CHANCE - 0.02);
    expect(rareShare).toBeLessThan(RARE_CHANCE + 0.02);
    const treeShare = plants.filter((p) => p.tree).reduce((n, p) => n + (count.get(p.id) ?? 0), 0) / N;
    expect(treeShare).toBeGreaterThan(TREE_CHANCE - 0.02);
    expect(treeShare).toBeLessThan(TREE_CHANCE + 0.02);
    expect(count.size).toBe(plants.length);
    expect(plants.filter((p) => p.rare)).toHaveLength(4);
  });

  it('특별만 뽑기를 켜면 특별 씨앗만 나온다', () => {
    const r = rng(3);
    for (let i = 0; i < 200; i++) expect(drawPlant(r, true).rare).toBe(true);
  });
});

describe('성장', () => {
  it('심은 날 씨앗, 다음 날 새싹, 3일 뒤 꽃', () => {
    expect(growthStage('2026-11-02', '2026-11-02')).toBe('seed');
    expect(growthStage('2026-11-02', '2026-11-03')).toBe('sprout');
    expect(growthStage('2026-11-02', '2026-11-04')).toBe('sprout');
    expect(growthStage('2026-11-02', '2026-11-05')).toBe('bloom');
  });

  it('오래 안 와도 꽃은 꽃으로 남고, 달·해를 넘겨도 맞다', () => {
    expect(growthStage('2026-11-02', '2026-12-30')).toBe('bloom');
    expect(growthStage('2026-12-30', '2027-01-02')).toBe('bloom');
    expect(growthStage('2026-12-31', '2027-01-01')).toBe('sprout');
  });
});

describe('열매나무', () => {
  const plantTree = (s: AppState, date: string) => {
    s.days[date] = { refresh: 0, packet: 'opened' };
    s.seeds.push({ id: 'seed-t', plantId: 'apple_tree' });
    return plantSeed(s, 'seed-t', date, { col: 8, row: 8 })!;
  };

  it('나무는 씨앗, 묘목, 어린 나무를 거쳐 6일 뒤에 다 자란다', () => {
    expect(isTree('apple_tree')).toBe(true);
    expect(isTree('dandelion')).toBe(false);
    expect(growthStage(D, '2026-11-02', 'apple_tree')).toBe('seed');
    expect(growthStage(D, '2026-11-03', 'apple_tree')).toBe('sprout');
    expect(growthStage(D, '2026-11-05', 'apple_tree')).toBe('young');
    expect(growthStage(D, '2026-11-08', 'apple_tree')).toBe('bloom');
    expect(growthStage(D, '2026-11-05')).toBe('bloom'); // 꽃은 그대로
  });

  it('나무는 마당에 심는다', () => {
    expect(placeZone({ plantId: 'apple_tree' })).toBe('yard');
    expect(placeZone({ plantId: 'dandelion' })).toBe('field');
    expect(placeZone({ plantId: 'dandelion', harvested: true })).toBe('yard');
  });

  it('첫 열매는 3개이고 나무는 정원에 남는다', () => {
    const s = createState();
    const t = plantTree(s, D);
    expect(harvest(s, t.id, '2026-11-07')).toBe(0); // 아직 어린 나무
    expect(harvest(s, t.id, '2026-11-08')).toBe(FRUIT_PER_HARVEST);
    expect(s.garden.plants).toHaveLength(1);
    expect(s.garden.storage).toHaveLength(0);
    expect(canHarvest(s.garden.plants[0], '2027-11-08', s.days)).toBe(false); // 날짜만 지나서는 열리지 않는다
  });

  it('수확 뒤 주머니를 받은 날이 3번 쌓이면 다시 열리고 1개를 받는다', () => {
    const s = createState();
    const t = plantTree(s, D);
    harvest(s, t.id, '2026-11-08');
    s.days['2026-11-08'] = { refresh: 0, packet: 'opened' }; // 수확한 날은 세지 않는다
    s.days['2026-11-09'] = { refresh: 0, packet: 'ready' };
    s.days['2026-11-12'] = { refresh: 0, packet: 'opened' }; // 연속이 아니어도, 열었어도 센다
    expect(canHarvest(s.garden.plants[0], '2026-11-20', s.days)).toBe(false);
    chooseRest(s, '2026-11-20'); // 쉬기를 고른 날도 센다
    expect(canHarvest(s.garden.plants[0], '2026-11-20', s.days)).toBe(true);
    expect(harvest(s, t.id, '2026-11-20')).toBe(FRUIT_PER_REGROW);
    expect(harvest(s, t.id, '2026-11-20')).toBe(0); // 다시 처음부터 센다
    expect(s.fruit).toBe(FRUIT_PER_HARVEST + FRUIT_PER_REGROW);
  });

  it('회차를 마친 날도 다시 맺기에 센다', () => {
    const s = createState();
    const t = plantTree(s, D);
    harvest(s, t.id, '2026-11-08');
    for (const date of ['2026-11-09', '2026-11-10', '2026-11-11']) s.days[date] = { refresh: 0, sessions: 1 };
    expect(canHarvest(s.garden.plants[0], '2026-11-20', s.days)).toBe(true);
  });

  it('창고에 넣었다 꺼내도 수확 기록은 그대로다', () => {
    const s = createState();
    const t = plantTree(s, D);
    harvest(s, t.id, '2026-11-08');
    storePlant(s, t.id);
    const back = takeFromStorage(s, t.id, { col: 9, row: 9 }) as { harvested?: boolean; harvestedOn?: string };
    expect(back.harvested).toBe(true);
    expect(back.harvestedOn).toBe('2026-11-08');
  });
});

describe('수확', () => {
  it('꽃이 핀 식물에서 열매 3개를 받고, 꽃은 창고로 가서 두둑이 빈다', () => {
    const s = createState();
    const p = plantedOn(s, D);
    expect(harvest(s, p.id, '2026-11-04')).toBe(0); // 아직 새싹
    expect(s.fruit).toBe(0);
    expect(s.garden.plants).toHaveLength(1);
    expect(harvest(s, p.id, '2026-11-05')).toBe(FRUIT_PER_HARVEST);
    expect(s.fruit).toBe(3);
    expect(s.garden.plants).toHaveLength(0);
    expect(s.garden.storage).toEqual([{ id: p.id, type: 'plant', plantId: p.plantId, date: p.date, harvested: true }]);
  });

  it('안 따면 꽃은 언제까지나 밭에 그대로 있다', () => {
    const s = createState();
    const p = plantedOn(s, D);
    expect(canHarvest(s.garden.plants[0], '2027-11-05', s.days)).toBe(true);
    expect(s.garden.plants[0].id).toBe(p.id);
  });

  it('수확한 꽃은 마당에 놓는 장식이고 열매는 다시 열리지 않는다', () => {
    const s = createState();
    const p = plantedOn(s, D);
    harvest(s, p.id, '2026-11-05');
    expect(placeZone(s.garden.storage[0] as { harvested?: boolean })).toBe('yard');
    const back = takeFromStorage(s, p.id, { col: 8, row: 8 }) as { harvested?: boolean; id: string };
    expect(back.harvested).toBe(true);
    expect(canHarvest(s.garden.plants[0], '2027-11-05', s.days)).toBe(false);
    expect(harvest(s, p.id, '2027-11-05')).toBe(0);
    expect(s.fruit).toBe(3);
  });

  it('수확 전에 창고에 넣은 식물은 밭으로 돌아가고 나중에 딸 수 있다', () => {
    const s = createState();
    const p = plantedOn(s, D);
    storePlant(s, p.id);
    expect(placeZone(s.garden.storage[0] as { harvested?: boolean })).toBe('field');
    takeFromStorage(s, p.id, { col: 100, row: 100 });
    expect(harvest(s, p.id, '2026-11-05')).toBe(FRUIT_PER_HARVEST);
  });
});

describe('상점', () => {
  it('열매가 충분하면 소품이 창고에 들어오고 열매가 줄어든다', () => {
    const s = createState();
    s.fruit = 10;
    expect(buy(s, 'bench')).toBe('ok');
    expect(s.fruit).toBe(6);
    expect(s.garden.storage).toEqual([{ id: 'buy-1', type: 'decor', decorKind: 'bench', variant: 0 }]);
  });

  it('열매가 모자라면 아무것도 바뀌지 않는다', () => {
    const s = createState();
    s.fruit = 3;
    expect(buy(s, 'bench')).toBe('poor');
    expect(s.fruit).toBe(3);
    expect(s.garden.storage).toHaveLength(0);
    expect(buy(s, 'nope')).toBe('unknown');
  });

  it('같은 소품을 여러 번 사도 id가 겹치지 않는다', () => {
    const s = createState();
    s.fruit = 100;
    buy(s, 'bench');
    buy(s, 'bench');
    expect(new Set(s.garden.storage.map((i) => i.id)).size).toBe(2);
  });

  it('가장 비싼 소품도 수확 4번이면 살 수 있다', () => {
    expect(Math.max(...SHOP.map((i) => i.price))).toBeLessThanOrEqual(FRUIT_PER_HARVEST * 4);
  });
});

describe('가방 분류', () => {
  it('가진 것을 씨앗·소품·식물로 나누어 센다', () => {
    const s = createState();
    s.seeds.push({ id: 'seed-1', plantId: 'dandelion' });
    s.freePackets = 1;
    s.days[D] = { refresh: 0, packet: 'ready' };
    s.days['2026-11-03'] = { refresh: 0, packet: 'opened' }; // 연 봉투는 세지 않는다
    s.garden.storage.push(
      { id: 'a', type: 'decor', decorKind: 'bench', variant: 0 },
      { id: 'b', type: 'decor', decorKind: 'table', variant: 0 },
      { id: 'c', type: 'plant', plantId: 'violet', date: D, harvested: true },
    );
    expect(bagCounts(s)).toEqual({ seeds: 3, decor: 2, plants: 1 });
  });
});

describe('방문 도장판', () => {
  it('방문 횟수만큼 도장이 찍히고, 기념 선물 칸은 3·7·14번째다', () => {
    const s = createState();
    expect(giftBoard(s)).toHaveLength(GIFT_BOARD_SIZE);
    expect(giftBoard(s).filter((c) => c.stamped)).toHaveLength(0);
    expect(giftBoard(s).filter((c) => c.reward).map((c) => [c.n, c.reward!.kind])).toEqual([[3, 'decor'], [7, 'packet'], [14, 'decor']]);
    for (let i = 1; i <= 5; i++) claimGift(s, `2026-12-0${i}`);
    expect(giftBoard(s).filter((c) => c.stamped)).toHaveLength(5);
    expect(giftBoard(s)[2]).toMatchObject({ n: 3, stamped: true, reward: { kind: 'decor', given: true } }); // 3번째 선물은 받았다
    expect(giftBoard(s)[6]).toMatchObject({ n: 7, stamped: false, reward: { kind: 'packet', given: false } });
  });

  it('쉬어도 도장은 그대로이고 판이 가득 차도 횟수는 계속 센다', () => {
    const s = createState();
    for (let i = 1; i <= 20; i++) claimGift(s, `2026-11-${String(i).padStart(2, '0')}`);
    expect(giftBoard(s).every((c) => c.stamped)).toBe(true);
    expect(s.visits.count).toBe(20);
    claimGift(s, '2027-03-01'); // 몇 달 뒤에 와도 그대로 이어진다
    expect(s.visits.count).toBe(21);
  });
});

describe('방문 선물함', () => {
  it('하루에 한 번만 열매 2개를 받는다', () => {
    const s = createState();
    expect(giftAvailable(s, D)).toBe(true);
    expect(claimGift(s, D)).toMatchObject({ fruit: GIFT_DAILY_FRUIT, count: 1 });
    expect(s.fruit).toBe(2);
    expect(giftAvailable(s, D)).toBe(false);
    expect(claimGift(s, D)).toBeNull();
  });

  it('며칠 쉬어도 횟수는 그대로 이어진다(연속 기록·초기화 없음)', () => {
    const s = createState();
    claimGift(s, '2026-11-02');
    claimGift(s, '2026-11-20');
    claimGift(s, '2027-02-01');
    expect(s.visits.count).toBe(3);
  });

  it('누적 3회 소품, 7회 특별 주머니, 14회 소품을 한 번씩 받는다', () => {
    const s = createState();
    const got: string[] = [];
    for (let i = 1; i <= 16; i++) {
      const r = claimGift(s, `2026-12-${String(i).padStart(2, '0')}`)!;
      if (r.milestone) got.push(`${r.milestone.at}:${r.milestone.reward}`);
    }
    expect(got).toEqual(['3:decor', '7:packet', '14:decor']);
    expect(s.garden.storage.map((i) => (i.type === 'decor' ? i.decorKind : ''))).toEqual(['table', 'hammock']);
    expect(s.bonusPackets).toBe(1);
  });

  it('특별 주머니를 열면 특별 씨앗이 심기고 주머니가 줄어든다', () => {
    const s = createState();
    s.bonusPackets = 1;
    expect(pendingPacketCount(s)).toBe(1);
    const p = openBonusPacket(s, rng(5))!;
    expect(plants.find((x) => x.id === p.plantId)?.rare).toBe(true);
    expect(s.bonusPackets).toBe(0);
    expect(openBonusPacket(s)).toBeNull();
  });

  it('쉬기를 골라도 주머니·열매는 줄지 않는다', () => {
    const s = createState();
    s.fruit = 5;
    chooseRest(s, D);
    expect(s.fruit).toBe(5);
  });
});
