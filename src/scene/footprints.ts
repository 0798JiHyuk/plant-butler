// 발자국: 소품·텃밭이 땅에 닿아 있는 자리. 새싹이는 여기를 지나가지 못하고, 앞뒤(그리는 순서)도 여기로 정한다.
// 그림의 아래 가운데에 띠를 두던 방식은 비스듬한 벤치·해먹에서 빈 풀밭을 막았다(보이지 않는 벽).
// 소품 그림을 바꾸면 FOOTPRINTS를 다시 잰다. 주소에 ?hitbox를 붙이면 정원 위에 발자국이 보인다.
import type { DecorItem } from '../core/types';
import { BED, inPolygon } from './map';

export type Foot = [number, number][];

/** 그림 안 좌표(왼쪽 위가 0,0, 단위 px)로 잰 다리·받침의 바닥. 앞쪽 끝은 그림 바닥에 닿는다. */
export const FOOTPRINTS: Record<'bench' | 'hammock' | 'shelf' | 'table' | 'birdbath' | 'flowerpot', Foot> = {
  bench: [[4, 108], [50, 126], [180, 95], [134, 78]], // 왼쪽 끝이 앞, 오른쪽 끝이 뒤로 비스듬하다
  hammock: [[6, 88], [112, 134], [170, 112], [44, 76]], // 오른쪽 아래 받침이 가장 앞
  shelf: [[2, 110], [100, 133], [125, 118], [28, 95]],
  table: [[14, 80], [52, 101], [99, 88], [62, 64]], // X자 다리 네 끝
  birdbath: [[19, 119], [31, 108], [60, 104], [89, 108], [101, 119], [89, 130], [60, 134], [31, 130]], // 둥근 받침
  flowerpot: [[27, 106], [35, 100], [55, 98], [75, 100], [83, 106], [75, 112], [55, 114], [35, 112]], // 화분 굽
};

/** 예전 저장본의 소품('flower'·'pot'·'lamp')은 작은 둥근 받침으로 본다. */
const SMALL: Foot = FOOTPRINTS.flowerpot;

/** 소품 그림(가운데 아래가 x, y이고 크기가 w×h)의 발자국을 정원 좌표로. flip이면 좌우를 바꾼 그림의 발자국. */
export function decorFoot(kind: DecorItem['kind'], x: number, y: number, w: number, h: number, flip = false): Foot {
  const pts = kind in FOOTPRINTS ? FOOTPRINTS[kind as keyof typeof FOOTPRINTS] : SMALL;
  return pts.map(([px, py]) => [x - w / 2 + (flip ? w - px : px), y - h + py]);
}

/** 마당의 나무는 줄기만 차지한다(나뭇잎 아래로는 지나간다). x, y는 줄기 밑동. */
export function trunkFoot(x: number, y: number): Foot {
  return [[x - 14, y - 14], [x + 14, y - 14], [x + 14, y], [x - 14, y]];
}

/** 마당에 장식으로 놓은 꽃: 걸을 땐 막지 않지만, 소품을 그 위에 겹쳐 놓지는 못한다. */
export function smallFoot(x: number, y: number): Foot {
  return [[x - 12, y - 4], [x - 8, y - 8], [x, y - 9], [x + 8, y - 8], [x + 12, y - 4], [x + 8, y], [x, y + 1], [x - 8, y]];
}

/** 볼록한 두 발자국이 겹치는지(분리축 검사). 변끼리 닿기만 하면 겹치지 않은 것으로 본다. */
export function feetOverlap(a: Foot, b: Foot): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y1 - y2; // 이 변에 수직인 축
      const ny = x2 - x1;
      const pa = a.map(([x, y]) => x * nx + y * ny);
      const pb = b.map(([x, y]) => x * nx + y * ny);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false; // 이 축에서 떨어져 있다
    }
  }
  return true;
}

/** 텃밭은 높이가 있는 나무 틀이라, 그림 위쪽 BED_BACK만큼은 틀 뒤의 땅이다(거기 서면 텃밭에 가려진다). */
export const BED_BACK = 26;
/** 원근 때문에 텃밭 그림은 위(뒤)로 갈수록 좁다. 맨 위에서 양옆이 이만큼 안쪽이다(field.png를 화면 크기로 줄여 잰 값). */
const BED_TOP_INSET = 20;

export function bedFoot(): Foot {
  const { x, y, w, h } = BED;
  const inset = BED_TOP_INSET * (1 - BED_BACK / h); // 뒤쪽 땅 줄 높이에서의 안쪽 폭
  return [[x + inset, y + BED_BACK], [x + w - inset, y + BED_BACK], [x + w, y + h], [x, y + h]];
}

export function insideFoot(foot: Foot, x: number, y: number): boolean {
  return inPolygon(x, y, foot);
}

/** x 자리에서 발자국이 차지하는 앞뒤 범위(back이 위·뒤쪽, front가 아래·앞쪽). 발자국 밖의 x는 가장 가까운 끝으로 본다. */
export function spanAt(foot: Foot, x: number): { back: number; front: number } {
  const xs = foot.map((p) => p[0]);
  const cx = Math.min(Math.max(x, Math.min(...xs)), Math.max(...xs));
  let back = Infinity;
  let front = -Infinity;
  for (let i = 0; i < foot.length; i++) {
    const [ax, ay] = foot[i];
    const [bx, by] = foot[(i + 1) % foot.length];
    if (cx < Math.min(ax, bx) || cx > Math.max(ax, bx)) continue;
    const ys = ax === bx ? [ay, by] : [ay + ((cx - ax) * (by - ay)) / (bx - ax)]; // 세로 변이면 양 끝 모두
    back = Math.min(back, ...ys);
    front = Math.max(front, ...ys);
  }
  return { back, front };
}

/** 이 발 위치가 발자국보다 앞(화면 아래쪽)인지. 앞이면 소품보다 나중에(위에) 그린다. */
export function inFront(foot: Foot, x: number, y: number): boolean {
  const { back, front } = spanAt(foot, x);
  return y > (back + front) / 2;
}

/**
 * 발밑에 소품이 놓여 갇혔을 때 옮겨 갈 가장 가까운 자리. 설 수 있으면 그대로 돌려준다.
 * 소품 뒤로 가면 그림에 가려 보이지 않으니 앞쪽(화면 아래) 반원을 먼저 찾고, 없으면 사방을 찾는다.
 * maxR 안에 없으면 null(그땐 걸어서 빠져나가게 둔다).
 */
export function findFreeSpot(x: number, y: number, canStand: (x: number, y: number) => boolean, maxR = 160, step = 8): { x: number; y: number } | null {
  if (canStand(x, y)) return { x, y };
  for (const front of [true, false]) {
    for (let r = step; r <= maxR; r += step) {
      const n = Math.max(8, Math.round((2 * Math.PI * r) / step));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (front && py < y) continue;
        if (canStand(px, py)) return { x: Math.round(px), y: Math.round(py) };
      }
    }
  }
  return null;
}

/** 소품 자체를 그리는 순서: 발자국의 앞뒤 가운데. 새싹이·주민은 inFront로 따로 맞춘다. */
export function footDepth(foot: Foot): number {
  const ys = foot.map((p) => p[1]);
  return (Math.min(...ys) + Math.max(...ys)) / 2;
}
