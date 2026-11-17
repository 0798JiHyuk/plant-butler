import { describe, expect, it } from 'vitest';
import { NPC_ROUTES, movementFor, pickStop } from '../core/npcRoutes';
import { isWalkable, NPC_HOMES } from '../scene/map';
import type { NpcId } from '../core/events';

const IDS: NpcId[] = ['nuri', 'moru', 'pio'];
const standable = (x: number, y: number) => isWalkable(x, y) && isWalkable(x - 14, y) && isWalkable(x + 14, y);
const always = () => true;
/** 정해진 순서로 값을 돌려주는 난수. */
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

describe('주민 동선표', () => {
  it('모든 정류장이 실제로 설 수 있는 자리다', () => {
    for (const id of IDS) for (const stop of NPC_ROUTES[id].stops) expect(standable(stop.x, stop.y), `${id} ${stop.x},${stop.y}`).toBe(true);
  });
  it('각 주민의 첫 정류장은 원래 자리다', () => {
    for (const id of IDS) expect(NPC_ROUTES[id].stops[0]).toMatchObject({ x: NPC_HOMES[id].x, y: NPC_HOMES[id].y });
  });
  it('정류장은 주민마다 4곳 이상이고 비중은 양수다', () => {
    for (const id of IDS) {
      expect(NPC_ROUTES[id].stops.length).toBeGreaterThanOrEqual(4);
      for (const s of NPC_ROUTES[id].stops) expect(s.weight).toBeGreaterThan(0);
    }
  });
  it('직전 정류장을 연속으로 고르지 않는다', () => {
    for (const id of IDS) {
      let from = 0;
      for (let i = 0; i < 300; i++) {
        const next = pickStop(id, from, Math.random, always);
        expect(next).not.toBeNull();
        expect(next!.index).not.toBe(from);
        from = next!.index;
      }
    }
  });
  it('난수가 낮을수록 앞쪽, 높을수록 뒤쪽 정류장을 고른다(비중 순서)', () => {
    const r = NPC_ROUTES.moru;
    const first = pickStop('moru', -1, () => 0, always)!;
    const last = pickStop('moru', -1, () => 0.999999, always)!;
    expect(first.index).toBe(0);
    expect(last.index).toBe(r.stops.length - 1);
  });
  it('비중이 큰 원래 자리가 가장 자주 나온다', () => {
    for (const id of IDS) {
      const count = NPC_ROUTES[id].stops.map(() => 0);
      let n = 0;
      const rand = () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296; };
      // 원래 자리가 아닌 곳에서 출발해야 원래 자리도 뽑힌다.
      for (let i = 0; i < 4000; i++) { const p = pickStop(id, 1, rand, always)!; count[p.index]++; }
      expect(count[0]).toBe(Math.max(...count));
    }
  });
  it('설 수 없는 정류장은 건너뛰고, 갈 곳이 없으면 null이다', () => {
    const blockedFirst = (x: number, y: number) => !(x === NPC_ROUTES.nuri.stops[1].x && y === NPC_ROUTES.nuri.stops[1].y);
    for (let i = 0; i < 100; i++) expect(pickStop('nuri', 0, Math.random, blockedFirst)!.index).not.toBe(1);
    expect(pickStop('nuri', 0, Math.random, () => false)).toBeNull();
  });
  it('난수 두 번째 값이 같은 정류장을 가리켜도 연속 선택이 되지 않는다', () => {
    const a = pickStop('pio', 0, seq(0), always)!;
    expect(a.index).not.toBe(0);
  });

  it('걷는 속도는 느리 < 모루 < 피오이고 멈춤도 느리가 가장 길다', () => {
    const m = (id: NpcId) => movementFor(id, { resting: false, reducedMotion: false });
    expect(m('nuri').speed).toBeLessThan(m('moru').speed);
    expect(m('moru').speed).toBeLessThan(m('pio').speed);
    expect(m('nuri').pauseMs[0]).toBeGreaterThan(m('pio').pauseMs[0]);
    expect(m('nuri').pauseMs[1]).toBeGreaterThan(m('moru').pauseMs[1]);
    expect(m('moru').pauseMs[1]).toBeGreaterThan(m('pio').pauseMs[1]);
  });
  it('멈춘 동안 동작: 느리 기울이기, 모루 들썩이기, 피오 통통', () => {
    const m = (id: NpcId) => movementFor(id, { resting: false, reducedMotion: false });
    expect(m('nuri').idle).toBe('tilt');
    expect(m('moru').idle).toBe('tap');
    expect(m('pio').idle).toBe('hop');
  });
  it('쉬는 날에는 걷지 않고 동작도 없다', () => {
    for (const id of IDS) {
      const r = movementFor(id, { resting: true, reducedMotion: false });
      expect(r.walks).toBe(false);
      expect(r.idle).toBe('none');
    }
  });
  it('움직임 줄이기에서는 속도 절반, 멈춤 2배, 동작 없음', () => {
    for (const id of IDS) {
      const base = movementFor(id, { resting: false, reducedMotion: false });
      const r = movementFor(id, { resting: false, reducedMotion: true });
      expect(r.walks).toBe(true);
      expect(r.speed).toBe(base.speed / 2);
      expect(r.pauseMs).toEqual([base.pauseMs[0] * 2, base.pauseMs[1] * 2]);
      expect(r.idle).toBe('none');
    }
  });
});
