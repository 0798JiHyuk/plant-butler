import { describe, expect, it } from 'vitest';
import {
  chooseRest, closeSession, DAILY_LIMIT, designPlan, flipDecor, limitReached, openPacket, openSessionPacket, pendingPacketCount,
  pendingPacketDates, plantSeed, reportAction, sessionHasActions, setPlan, settleOldSession, storeDecor, storePlant, takeFromStorage,
} from '../core/rules';
import { plants } from '../core/plants';
import { rng } from '../core/random';
import { createState } from '../core/store';
import type { Plan } from '../core/types';

const D = '2026-10-26';
/** 예전 활동으로 세운 계획(예전 저장본에 남아 있을 수 있다). 미션 카드는 missions.test.ts에서 본다. */
const plan: Plan = { activityId: 'walk5', info: { when: '지금', where: '집 근처', minutes: 5 }, source: 'mission' };
type S = ReturnType<typeof createState>;
/** 예전 저장본의 하루 봉투 */
const ready = (s: S, date: string) => {
  s.days[date] = { refresh: 0, packet: 'ready' };
};
/** 계획을 세우고 [했어]까지(회차는 열어 둔다) */
const doOne = (s: S, date = D) => {
  expect(setPlan(s, date, plan)).toBe(true);
  return reportAction(s, date, [])!;
};
const openAndPlant = (s: S, date: string, slot: { col: number; row: number }, r?: () => number) => {
  const seed = openPacket(s, date, r);
  return seed && plantSeed(s, seed.id, date, slot);
};

describe('rules', () => {
  it('쉬기는 기록을 남기지 않고 계획만 내려놓는다', () => {
    const s = createState();
    setPlan(s, D, plan);
    chooseRest(s, D);
    expect(s.days[D].rested).toBe(true);
    expect(s.days[D].plan).toBeUndefined();
    expect(s.logs).toHaveLength(0);
  });

  it('계획을 세우면 쉬기가 풀린다', () => {
    const s = createState();
    chooseRest(s, D);
    setPlan(s, D, plan);
    expect(s.days[D].rested).toBe(false);
  });

  it('계획 없이는 [했어]를 누를 수 없다', () => {
    expect(reportAction(createState(), D, [])).toBeNull();
  });

  it('직접 계획은 글이 비어 있으면 만들 수 없다', () => {
    expect(designPlan('  ', '지금', '')).toBeNull();
    expect(designPlan('공원 다녀오기', '오후 3시', '입구까지')).toMatchObject({
      text: '공원 다녀오기', source: 'design', info: { when: '오후 3시', criterion: '입구까지' },
    });
  });

  it('주머니를 열면 랜덤 씨앗 하나가 심기고, 같은 식물이 또 나와도 정상이다', () => {
    const s = createState();
    const r = rng(7);
    const ids: string[] = [];
    for (let i = 0; i < 60; i++) {
      const date = `2026-11-${String((i % 28) + 1).padStart(2, '0')}-${i}`;
      s.days[date] = { refresh: 0, packet: 'ready' };
      const planted = openAndPlant(s, date, { col: i % 40, row: 3 }, r)!;
      expect(plants.some((p) => p.id === planted.plantId)).toBe(true);
      ids.push(planted.plantId);
    }
    expect(new Set(ids).size).toBeLessThan(ids.length); // 60번 뽑으면 반드시 중복이 있다
    expect(s.garden.plants).toHaveLength(60);
  });

  it('주머니를 열면 씨앗은 씨앗함에 들어가고, 심기 전에는 정원에 없다', () => {
    const s = createState();
    ready(s, D);
    const seed = openPacket(s, D)!;
    expect(s.seeds).toEqual([seed]);
    expect(s.garden.plants).toHaveLength(0);
    expect(pendingPacketDates(s)).toEqual([]);
  });

  it('심으면 씨앗함에서 빠지고, 성장은 주머니를 받은 날이 아니라 심은 날부터다', () => {
    const s = createState();
    ready(s, D);
    const seed = openPacket(s, D)!;
    const planted = plantSeed(s, seed.id, '2026-11-10', { col: 101, row: 100 })!;
    expect(planted).toMatchObject({ plantId: seed.plantId, date: '2026-11-10', col: 101, row: 100 });
    expect(s.seeds).toHaveLength(0);
    expect(s.garden.plants).toEqual([planted]);
  });

  it('자리가 없거나 없는 씨앗이면 심지 않고 씨앗은 그대로 남는다', () => {
    const s = createState();
    ready(s, D);
    const seed = openPacket(s, D)!;
    expect(plantSeed(s, seed.id, D, null)).toBeNull();
    expect(plantSeed(s, 'nope', D, { col: 100, row: 100 })).toBeNull();
    expect(s.seeds).toEqual([seed]);
    expect(s.garden.plants).toHaveLength(0);
  });

  it('씨앗함의 씨앗은 며칠이 지나도 사라지지 않고 서로 구분된다', () => {
    const s = createState();
    for (const d of ['2026-11-01', '2026-11-02']) {
      ready(s, d);
      openPacket(s, d);
    }
    expect(s.seeds).toHaveLength(2);
    expect(new Set(s.seeds.map((x) => x.id)).size).toBe(2);
    plantSeed(s, s.seeds[0].id, '2026-12-01', { col: 100, row: 100 });
    ready(s, '2026-12-01');
    openPacket(s, '2026-12-01');
    expect(new Set(s.seeds.map((x) => x.id)).size).toBe(2);
  });

  it('이미 연 봉투는 다시 열 수 없다', () => {
    const s = createState();
    ready(s, D);
    expect(openPacket(s, D)).not.toBeNull();
    expect(openPacket(s, D)).toBeNull();
    expect(s.seeds).toHaveLength(1);
  });

  it('소품을 창고로 치우면 정원에서는 사라지고 창고에 쌓인다', () => {
    const s = createState();
    const item = { id: 'decor-1', kind: 'bench' as const, variant: 0, col: 4, row: 4 };
    s.garden.items.push(item);
    storeDecor(s, item.id);
    expect(s.garden.items).toHaveLength(0);
    expect(s.garden.storage).toEqual([{ id: item.id, type: 'decor', decorKind: item.kind, variant: item.variant }]);
  });

  it('없는 소품을 치우려 하면 아무 일도 없다', () => {
    const s = createState();
    storeDecor(s, 'nope');
    expect(s.garden.items).toHaveLength(0);
    expect(s.garden.storage).toHaveLength(0);
  });

  it('창고에서 소품을 꺼내면 정원으로 돌아가고 창고에서는 빠진다', () => {
    const s = createState();
    const item = { id: 'decor-1', kind: 'bench' as const, variant: 0, col: 4, row: 4 };
    s.garden.items.push(item);
    storeDecor(s, item.id);
    const placed = takeFromStorage(s, item.id, { col: 9, row: 9 });
    expect(placed).toMatchObject({ id: item.id, kind: item.kind, variant: item.variant, col: 9, row: 9 });
    expect(s.garden.storage).toHaveLength(0);
    expect(s.garden.items).toEqual([placed]);
  });

  it('창고에 없는 걸 꺼내려 하면 null', () => {
    expect(takeFromStorage(createState(), 'nope', { col: 1, row: 1 })).toBeNull();
  });

  it('소품의 방향(좌우)을 바꾸고, 다시 누르면 처음 방향으로 돌아온다', () => {
    const s = createState();
    s.garden.items.push({ id: 'decor-1', kind: 'bench', variant: 0, col: 4, row: 4 });
    expect(flipDecor(s, 'decor-1')).toBe(true);
    expect(s.garden.items[0].flip).toBe(true);
    flipDecor(s, 'decor-1');
    expect(s.garden.items[0].flip).toBeFalsy();
    expect(flipDecor(s, 'nope')).toBe(false);
  });

  it('바꾼 방향은 창고에 넣었다 꺼내도 그대로다', () => {
    const s = createState();
    s.garden.items.push({ id: 'decor-1', kind: 'bench', variant: 0, col: 4, row: 4, flip: true });
    storeDecor(s, 'decor-1');
    expect(s.garden.storage[0]).toMatchObject({ id: 'decor-1', flip: true });
    expect(takeFromStorage(s, 'decor-1', { col: 9, row: 9 })).toMatchObject({ flip: true, col: 9, row: 9 });
  });

  it('심은 식물도 창고로 치우고 꺼낼 수 있다(처음 만난 날짜는 그대로)', () => {
    const s = createState();
    ready(s, D);
    const planted = openAndPlant(s, D, { col: 14, row: 15 })!;
    storePlant(s, planted.id);
    expect(s.garden.plants).toHaveLength(0);
    expect(s.garden.storage).toEqual([{ id: planted.id, type: 'plant', plantId: planted.plantId, date: planted.date }]);

    const placed = takeFromStorage(s, planted.id, { col: 36, row: 14 });
    expect(placed).toMatchObject({ id: planted.id, plantId: planted.plantId, date: planted.date, col: 36, row: 14 });
    expect(s.garden.storage).toHaveLength(0);
    expect(s.garden.plants).toEqual([placed]);
  });

  it('없는 식물을 치우려 하면 아무 일도 없다', () => {
    const s = createState();
    storePlant(s, 'nope');
    expect(s.garden.plants).toHaveLength(0);
    expect(s.garden.storage).toHaveLength(0);
  });
});

describe('회차와 씨앗', () => {
  it('계획을 세우면 회차가 열리고, [했어]마다 기록이 남지만 씨앗은 회차를 닫을 때 한 번', () => {
    const s = createState();
    const { log } = doOne(s);
    expect(s.logs).toEqual([log]);
    expect(log.sessionId).toBe(s.missions.session!.id);
    expect(s.days[D].plan).toBeUndefined();
    expect(s.sessionPackets).toBe(0);
    expect(sessionHasActions(s, D)).toBe(true);
    doOne(s); // 같은 회차에 하나 더
    expect(s.missions.session!.actions).toHaveLength(2);
    expect(closeSession(s)).toEqual({ seeded: true });
    expect(s.sessionPackets).toBe(1);
    expect(s.days[D].sessions).toBe(1);
  });

  it('닫기를 두 번 눌러도 씨앗은 한 번', () => {
    const s = createState();
    doOne(s);
    closeSession(s);
    expect(closeSession(s)).toEqual({ seeded: false });
    expect(s.sessionPackets).toBe(1);
  });

  it('행동 없이 닫으면 씨앗 없이 건너뛴 것으로 끝난다', () => {
    const s = createState();
    setPlan(s, D, plan);
    expect(closeSession(s)).toEqual({ seeded: false });
    expect(s.sessionPackets).toBe(0);
    expect(s.days[D].sessions).toBeUndefined();
  });

  it('행동 뒤에 쉬면 그 회차를 정상으로 닫고(씨앗 1개) 쉰다', () => {
    const s = createState();
    doOne(s);
    chooseRest(s, D);
    expect(s.sessionPackets).toBe(1);
    expect(s.missions.session).toBeNull();
    expect(s.days[D].rested).toBe(true);
  });

  it('행동 없이 쉬면 씨앗은 없고 잃는 것도 없다', () => {
    const s = createState();
    s.fruit = 5;
    setPlan(s, D, plan);
    chooseRest(s, D);
    expect(s.sessionPackets).toBe(0);
    expect(s.fruit).toBe(5);
    expect(s.days[D].plan).toBeUndefined();
  });

  it('마친 회차가 3개면 새 회차를 열지 않는다(열린 회차 안에서는 계속할 수 있다)', () => {
    const s = createState();
    for (let i = 0; i < DAILY_LIMIT; i++) {
      doOne(s);
      expect(limitReached(s, D)).toBe(false);
      closeSession(s);
    }
    expect(limitReached(s, D)).toBe(true);
    expect(setPlan(s, D, plan)).toBe(false);
    expect(s.sessionPackets).toBe(DAILY_LIMIT);
  });

  it('지난 날에 열어 둔 회차는 그날 것으로 정산한다', () => {
    const s = createState();
    doOne(s, '2026-11-01');
    settleOldSession(s, '2026-11-01'); // 같은 날이면 그대로
    expect(s.missions.session).not.toBeNull();
    settleOldSession(s, '2026-11-02');
    expect(s.missions.session).toBeNull();
    expect(s.days['2026-11-01'].sessions).toBe(1);
    expect(s.sessionPackets).toBe(1);
  });

  it('다음 날 계획을 세우면 어제 회차를 먼저 정산한다', () => {
    const s = createState();
    doOne(s, '2026-11-01');
    setPlan(s, '2026-11-02', plan);
    expect(s.days['2026-11-01'].sessions).toBe(1);
    expect(s.missions.session!.date).toBe('2026-11-02');
  });

  it('회차 주머니를 열면 씨앗함에 씨앗이 들어간다', () => {
    const s = createState();
    doOne(s);
    closeSession(s);
    expect(pendingPacketCount(s)).toBe(1);
    const seed = openSessionPacket(s, rng(3))!;
    expect(s.seeds).toEqual([seed]);
    expect(s.sessionPackets).toBe(0);
    expect(openSessionPacket(s)).toBeNull();
  });
});
