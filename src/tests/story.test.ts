import { describe, expect, it } from 'vitest';
import { FORBIDDEN_WORDS } from '../core/copy';
import { openFreePacket, pendingPacketCount, pendingPacketDates } from '../core/rules';
import { shiftDate } from '../core/clock';
import {
  applyChoice, brokenLinks, enterNode, finishScene, MAIN_ORDER, markReturnSeen, needsIntro, nextSceneFor, pastPlanDate, rememberChoice,
  resolveNext, returnScene, scenes,
} from '../core/story';
import { createState } from '../core/store';

describe('이야기', () => {
  it('모든 장면의 연결이 맞고 금지 표현이 없다', () => {
    for (const scene of Object.values(scenes)) {
      expect(brokenLinks(scene)).toEqual([]);
      for (const n of Object.values(scene.nodes)) {
        const texts = [n.text, ...(n.choices ?? []).map((c) => c.label)];
        for (const t of texts) for (const w of FORBIDDEN_WORDS) expect(t).not.toContain(w);
      }
    }
  });

  it('어느 선택으로 끝나도, 중간에 닫아도 첫 주머니는 하나만 받는다', () => {
    const s = createState();
    enterNode(s, scenes.intro.nodes['p03-3']);
    expect(pendingPacketCount(s)).toBe(1);
    finishScene(s, 'intro');
    expect(pendingPacketCount(s)).toBe(1);
    const quit = createState();
    finishScene(quit, 'intro'); // 첫 대사에서 닫은 경우
    expect(pendingPacketCount(quit)).toBe(1);
  });

  it('첫 주머니는 날짜와 상관없고, 그날 활동 주머니를 막지 않는다', () => {
    const s = createState();
    finishScene(s, 'intro');
    expect(pendingPacketDates(s)).toEqual([]);
    const seed = openFreePacket(s)!;
    expect(s.seeds).toEqual([seed]);
    expect(pendingPacketCount(s)).toBe(0);
    expect(openFreePacket(s)).toBeNull();
  });

  it('프롤로그는 처음 온 사람에게 한 번만 나온다', () => {
    const s = createState();
    expect(needsIntro(s)).toBe(true);
    finishScene(s, 'intro');
    expect(needsIntro(s)).toBe(false);
    const old = createState();
    old.logs.push({} as never); // 이미 쓰던 저장본
    expect(needsIntro(old)).toBe(false);
  });

  it('고른 답을 기억한다', () => {
    const s = createState();
    rememberChoice(s, 'intro', 'p02-2', 2);
    expect(s.story.choices['intro/p02-2']).toBe(2);
  });
});

describe('주민 이야기가 열리는 순서', () => {
  const T = '2026-11-05';
  const afterIntro = () => {
    const s = createState();
    finishScene(s, 'intro');
    return s;
  };
  const watch = (s: ReturnType<typeof createState>, id: string, day = T) => finishScene(s, id, day);

  it('프롤로그 전에는 주민 이야기가 없다', () => {
    expect(nextSceneFor(createState(), 'nuri', T)).toBeNull();
  });

  it('본편은 순서대로, 그 장면의 주민에게서만 열린다', () => {
    const s = afterIntro();
    expect(nextSceneFor(s, 'moru', T)).toBeNull();
    expect(nextSceneFor(s, 'nuri', T)).toBe('a01');
    const order = MAIN_ORDER.map((m) => m.id);
    expect(order).toEqual(['a01', 'b01', 'b02', 'c01', 'c02', 'd01', 'e01']);
    let day = T;
    for (const m of MAIN_ORDER) {
      const who = m.npc === 'any' ? 'pio' : m.npc;
      expect(nextSceneFor(s, who, day)).toBe(m.id);
      watch(s, m.id, day);
      day = shiftDate(day, 1);
    }
  });

  it('하루에 한 장면만 열린다(데모 모드는 예외)', () => {
    const s = afterIntro();
    watch(s, 'a01');
    expect(nextSceneFor(s, 'moru', T)).toBeNull();
    expect(nextSceneFor(s, 'moru', shiftDate(T, 1))).toBe('b01');
    s.settings.demo = true;
    expect(nextSceneFor(s, 'moru', T)).toBe('b01');
  });

  it('서브 이야기는 그 주민의 본편을 본 뒤에 열린다', () => {
    const s = afterIntro();
    s.settings.demo = true;
    expect(nextSceneFor(s, 'nuri', T)).toBe('a01');
    watch(s, 'a01');
    expect(nextSceneFor(s, 'nuri', T)).toBe('s01');
    watch(s, 's01');
    expect(nextSceneFor(s, 'nuri', T)).toBe('s02');
    watch(s, 's02');
    expect(nextSceneFor(s, 'nuri', T)).toBeNull();
    expect(nextSceneFor(s, 'pio', T)).toBeNull(); // 피오 본편은 모루 본편 뒤
  });

  it('지도판(아무 주민) 본편이 열려 있으면 서브보다 먼저다', () => {
    const s = afterIntro();
    s.settings.demo = true;
    for (const id of ['a01', 'b01', 'b02', 'c01', 'c02']) watch(s, id);
    expect(nextSceneFor(s, 'nuri', T)).toBe('d01');
  });
});

describe('복귀 장면', () => {
  const T = '2026-11-05';
  const used = () => {
    const s = createState();
    finishScene(s, 'intro');
    s.freePackets = 0; // 첫 방문 선물은 열어 둔 상태
    return s;
  };
  const log = (s: ReturnType<typeof createState>, date: string, source: 'mission' | 'design' = 'mission') =>
    s.logs.push({ id: `${date}-${s.logs.length}`, date, plan: { when: '지금', where: '', minutes: 1 }, chips: [], source });

  it('마지막 완료·쉬기부터 2일 이상이면 나온다', () => {
    const s = used();
    expect(returnScene(s, T)).toBeNull(); // 기록이 없으면 아님
    log(s, shiftDate(T, -1));
    expect(returnScene(s, T)).toBeNull();
    s.logs = [];
    log(s, shiftDate(T, -2));
    s.visits.last = T;
    expect(returnScene(s, T)).toBe('r01');
  });

  it('쉬기를 고른 날도 참여로 센다', () => {
    const s = used();
    log(s, shiftDate(T, -5));
    s.days[shiftDate(T, -1)] = { refresh: 0, rested: true };
    expect(returnScene(s, T)).toBeNull();
  });

  it('하루에 한 번만 나온다', () => {
    const s = used();
    log(s, shiftDate(T, -3));
    markReturnSeen(s, T);
    expect(returnScene(s, T)).toBeNull();
  });

  it('상황에 맞는 장면을 고른다', () => {
    const s = used();
    log(s, shiftDate(T, -3));
    s.visits.last = T; // 오늘 선물은 받은 상태
    expect(returnScene(s, T)).toBe('r01');
    s.visits.last = undefined;
    expect(returnScene(s, T)).toBe('r10');
    s.freePackets = 1;
    expect(returnScene(s, T)).toBe('r07');
    s.logs = [];
    log(s, shiftDate(T, -3), 'design');
    expect(returnScene(s, T)).toBe('r03');
    s.days[shiftDate(T, -2)] = { refresh: 0, plan: { text: '산책', info: { when: '지금', where: '', minutes: 0 }, source: 'design' } };
    expect(returnScene(s, T)).toBe('r02');
  });

  it('지난 계획을 오늘로 옮기거나 지운다', () => {
    const s = used();
    const old = shiftDate(T, -2);
    s.days[old] = { refresh: 0, plan: { text: '산책', info: { when: '지금', where: '', minutes: 0 }, source: 'design' } };
    expect(pastPlanDate(s, T)).toBe(old);
    applyChoice(s, { label: '', do: ['restore-plan'] }, T);
    expect(s.days[T].plan?.text).toBe('산책');
    expect(s.days[old].plan).toBeUndefined();
    s.days[old] = { refresh: 0, plan: { text: '정리', info: { when: '지금', where: '', minutes: 0 }, source: 'design' } };
    applyChoice(s, { label: '', do: ['drop-plan'] }, T);
    expect(s.days[old].plan).toBeUndefined();
    expect(s.days[T].plan?.text).toBe('산책');
  });

  it('쉬기 선택지는 오늘을 쉬는 날로 남긴다', () => {
    const s = used();
    applyChoice(s, { label: '', do: ['rest'] }, T);
    expect(s.days[T].rested).toBe(true);
  });
});

describe('상태에 따라 다음 대사 고르기', () => {
  const T = '2026-11-05';
  it('조건이 맞는 첫 갈래로, 없으면 next로 간다', () => {
    const s = createState();
    const node = { who: 'nuri' as const, text: '', next: 'none', branch: [{ if: 'seeds' as const, next: 'seed' }, { if: 'gift' as const, next: 'gift' }] };
    s.visits.last = T;
    expect(resolveNext(s, node, T)).toBe('none');
    s.visits.last = undefined;
    expect(resolveNext(s, node, T)).toBe('gift');
    s.seeds.push({ id: 'x', plantId: 'daisy' });
    expect(resolveNext(s, node, T)).toBe('seed');
  });
});
