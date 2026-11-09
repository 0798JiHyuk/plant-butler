import { describe, expect, it } from 'vitest';
import { activities, activityById } from '../core/activities';
import {
  chooseRest, completePlan, DAILY_LIMIT, defaultPlanInfo, designPlan, flipDecor, limitReached, makeSmaller, pastItems, setEnergy,
  setPlan, storeDecor, storePlant, suggest, swapCandidate, tabHints, takeFromStorage, openPacket, pendingPacketDates, plantSeed, undoRest,
} from '../core/rules';
import { plants } from '../core/plants';
import { rng } from '../core/random';
import { createState } from '../core/store';

const D = '2026-10-26';
const walk = activityById('walk5')!;
const plan = { activityId: walk.id, info: defaultPlanInfo(walk), source: 'mission' as const };
type S = ReturnType<typeof createState>;
const openAndPlant = (s: S, date: string, slot: { col: number; row: number }, r?: () => number) => {
  const seed = openPacket(s, date, r);
  return seed && plantSeed(s, seed.id, date, slot);
};

describe('rules', () => {
  it('하루 3개를 해내면 상한에 닿고 새 계획은 받지 않는다', () => {
    const s = createState();
    for (let i = 0; i < DAILY_LIMIT; i++) {
      expect(setPlan(s, D, plan)).toBe(true);
      expect(completePlan(s, D, [])).not.toBeNull();
    }
    expect(limitReached(s, D)).toBe(true);
    expect(setPlan(s, D, plan)).toBe(false);
  });

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

  it('해낸 활동만 기록하고 씨앗 주머니만 받는다(소품은 바로 받지 않는다)', () => {
    const s = createState();
    setPlan(s, D, plan);
    const res = completePlan(s, D, ['achieved'])!;
    expect(s.logs).toEqual([res.log]);
    expect(s.days[D].plan).toBeUndefined();
    expect(s.days[D].packet).toBe('ready');
    expect(s.garden.items).toHaveLength(0);
    expect(s.garden.storage).toHaveLength(0);
  });

  it('계획 없이는 완료할 수 없다', () => {
    expect(completePlan(createState(), D, [])).toBeNull();
  });

  it('무거운 날은 1~2분짜리만 제안한다', () => {
    const s = createState();
    setEnergy(s, D, 'heavy');
    const list = suggest(s, D);
    expect(list.length).toBeGreaterThan(0);
    for (const a of list) expect(a.minutes).toBeLessThanOrEqual(2);
  });

  it('보통인 날은 서로 다른 종류를 3개 제안한다', () => {
    const s = createState();
    const list = suggest(s, D);
    expect(list).toHaveLength(3);
    expect(new Set(list.map((a) => a.kind)).size).toBe(3);
  });

  it('바꾸기는 보이는 것과 겹치지 않는 후보를 준다', () => {
    const s = createState();
    const shown = suggest(s, D);
    expect(shown.some((a) => a.id === swapCandidate(s, D, shown)!.id)).toBe(false);
  });

  it('더 작게는 끝까지 줄어들고 순환하지 않는다', () => {
    for (const a of activities) {
      let cur = a;
      for (let steps = 0; steps < 10; steps++) {
        const next = makeSmaller(cur);
        if (!next) break;
        expect(next.minutes).toBeLessThan(cur.minutes);
        cur = next;
      }
      expect(makeSmaller(cur)).toBeUndefined();
    }
  });

  it('직접 계획은 글이 비어 있으면 만들 수 없다', () => {
    expect(designPlan('  ', '지금', '')).toBeNull();
    expect(designPlan('공원 다녀오기', '오후 3시', '입구까지')).toMatchObject({
      text: '공원 다녀오기', source: 'design', info: { when: '오후 3시', criterion: '입구까지' },
    });
  });

  it('해본 활동은 최근 순, 중복 없이 일상 연결에 나온다', () => {
    const s = createState();
    for (const [date, p] of [['2026-10-20', plan], ['2026-10-21', designPlan('공원', '지금', '')!], ['2026-10-22', plan]] as const) {
      setPlan(s, date, p);
      completePlan(s, date, []);
    }
    expect(pastItems(s).map((i) => i.label)).toEqual(['집 앞 5분 걷기', '공원']);
  });

  it('탭은 잠기지 않고 기록이 쌓이면 힌트만 켜진다', () => {
    const s = createState();
    expect(tabHints(s)).toEqual({ daily: false, design: false });
    for (let i = 0; i < 3; i++) {
      setPlan(s, `2026-10-2${i}`, plan);
      completePlan(s, `2026-10-2${i}`, []);
    }
    expect(tabHints(s)).toEqual({ daily: true, design: false });
  });

  it('씨앗 봉투는 완료한 날 하루 한 번만 온다', () => {
    const s = createState();
    for (let i = 0; i < 2; i++) {
      setPlan(s, D, plan);
      completePlan(s, D, []);
    }
    expect(pendingPacketDates(s)).toEqual([D]);
  });

  it('쉬기를 고른 날도 봉투를 받고, 마음이 바뀌어도 두 번 받지 않는다', () => {
    const s = createState();
    chooseRest(s, D);
    expect(pendingPacketDates(s)).toEqual([D]);
    openPacket(s, D);
    undoRest(s, D);
    setPlan(s, D, plan);
    completePlan(s, D, []);
    expect(pendingPacketDates(s)).toEqual([]);
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
    chooseRest(s, D);
    const seed = openPacket(s, D)!;
    expect(s.seeds).toEqual([seed]);
    expect(s.garden.plants).toHaveLength(0);
    expect(pendingPacketDates(s)).toEqual([]);
  });

  it('심으면 씨앗함에서 빠지고, 성장은 주머니를 받은 날이 아니라 심은 날부터다', () => {
    const s = createState();
    chooseRest(s, D);
    const seed = openPacket(s, D)!;
    const planted = plantSeed(s, seed.id, '2026-11-10', { col: 101, row: 100 })!;
    expect(planted).toMatchObject({ plantId: seed.plantId, date: '2026-11-10', col: 101, row: 100 });
    expect(s.seeds).toHaveLength(0);
    expect(s.garden.plants).toEqual([planted]);
  });

  it('자리가 없거나 없는 씨앗이면 심지 않고 씨앗은 그대로 남는다', () => {
    const s = createState();
    chooseRest(s, D);
    const seed = openPacket(s, D)!;
    expect(plantSeed(s, seed.id, D, null)).toBeNull();
    expect(plantSeed(s, 'nope', D, { col: 100, row: 100 })).toBeNull();
    expect(s.seeds).toEqual([seed]);
    expect(s.garden.plants).toHaveLength(0);
  });

  it('씨앗함의 씨앗은 며칠이 지나도 사라지지 않고 서로 구분된다', () => {
    const s = createState();
    for (const d of ['2026-11-01', '2026-11-02']) {
      chooseRest(s, d);
      openPacket(s, d);
    }
    expect(s.seeds).toHaveLength(2);
    expect(new Set(s.seeds.map((x) => x.id)).size).toBe(2);
    plantSeed(s, s.seeds[0].id, '2026-12-01', { col: 100, row: 100 });
    chooseRest(s, '2026-12-01');
    openPacket(s, '2026-12-01');
    expect(new Set(s.seeds.map((x) => x.id)).size).toBe(2);
  });

  it('이미 연 봉투는 다시 열 수 없다', () => {
    const s = createState();
    chooseRest(s, D);
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
    chooseRest(s, D);
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
