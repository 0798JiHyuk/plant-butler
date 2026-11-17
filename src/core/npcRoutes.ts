import type { NpcId } from './events';

/**
 * 정원 주민의 동선 규칙. Phaser를 모르는 순수 규칙이라 테스트할 수 있다.
 * 정류장 좌표는 4096×3072 월드 기준이고, 설 수 있는 자리인지 `tests/npcRoutes.test.ts`가 확인한다.
 * 주민이 사용자 쪽으로 다가오거나 기다리지 않는다(접속하지 않아도 손상 없음).
 */
export type IdleMove = 'none' | 'tilt' | 'tap' | 'hop';
export interface Stop { x: number; y: number; weight: number }
export interface Route {
  /** 첫 정류장은 원래 자리. */
  stops: readonly Stop[];
  speed: number; // px/초
  pauseMs: readonly [number, number];
  idle: Exclude<IdleMove, 'none'>;
}

export const NPC_ROUTES: Record<NpcId, Route> = {
  nuri: {
    stops: [{ x: 506, y: 1866, weight: 3 }, { x: 552, y: 1933, weight: 3 }, { x: 596, y: 1904, weight: 2 }, { x: 560, y: 1840, weight: 2 }],
    speed: 12, pauseMs: [3500, 7000], idle: 'tilt',
  },
  moru: {
    stops: [{ x: 1106, y: 1794, weight: 4 }, { x: 1120, y: 1720, weight: 2 }, { x: 1126, y: 1923, weight: 2 }, { x: 1183, y: 1927, weight: 1 }],
    speed: 20, pauseMs: [2000, 5500], idle: 'tap',
  },
  pio: {
    stops: [{ x: 1241, y: 1891, weight: 3 }, { x: 1183, y: 1927, weight: 2 }, { x: 1300, y: 1850, weight: 1 }, { x: 1180, y: 1860, weight: 1 }, { x: 1260, y: 1950, weight: 1 }],
    speed: 26, pauseMs: [1500, 4000], idle: 'hop',
  },
};

/**
 * 다음 정류장을 비중대로 고른다. 직전 정류장과 지금 설 수 없는 곳은 뺀다. 갈 곳이 없으면 null(제자리에서 쉰다).
 * `rand`는 [0,1) 난수라서 테스트에서 고정할 수 있다.
 */
export function pickStop(id: NpcId, fromIndex: number, rand: () => number, canStand: (x: number, y: number) => boolean): { index: number; x: number; y: number } | null {
  const options = NPC_ROUTES[id].stops
    .map((s, index) => ({ ...s, index }))
    .filter(s => s.index !== fromIndex && canStand(s.x, s.y));
  const total = options.reduce((sum, s) => sum + s.weight, 0);
  if (!options.length) return null;
  let roll = rand() * total;
  for (const s of options) {
    roll -= s.weight;
    if (roll < 0) return { index: s.index, x: s.x, y: s.y };
  }
  const last = options[options.length - 1];
  return { index: last.index, x: last.x, y: last.y };
}

export interface Movement { walks: boolean; speed: number; pauseMs: readonly [number, number]; idle: IdleMove }

/** 쉬는 날은 걷지 않고 정면으로 서 있는다. 움직임 줄이기는 속도 절반·멈춤 2배, 동작 없이 걷기만 한다. */
export function movementFor(id: NpcId, ctx: { resting: boolean; reducedMotion: boolean }): Movement {
  const r = NPC_ROUTES[id];
  if (ctx.resting) return { walks: false, speed: 0, pauseMs: r.pauseMs, idle: 'none' };
  if (ctx.reducedMotion) return { walks: true, speed: r.speed / 2, pauseMs: [r.pauseMs[0] * 2, r.pauseMs[1] * 2], idle: 'none' };
  return { walks: true, speed: r.speed, pauseMs: r.pauseMs, idle: r.idle };
}
