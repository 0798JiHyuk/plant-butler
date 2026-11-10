import { describe, expect, it } from 'vitest';
import { bedFoot, BED_BACK, decorFoot, feetOverlap, findFreeSpot, FOOTPRINTS, inFront, insideFoot, smallFoot, spanAt, trunkFoot } from '../scene/footprints';
import { BED } from '../scene/map';

// 소품 그림의 크기(public/assets/garden/props/*.png). 그림을 바꾸면 발자국도 다시 잰다.
const SIZE = { bench: [183, 125], hammock: [187, 133], shelf: [128, 131], table: [115, 101], birdbath: [119, 133], flowerpot: [106, 113] } as const;

/** 그림 안의 점(왼쪽 위 기준)을 정원 좌표로. 소품은 칸 가운데 아래(발 끝)에 그림의 가운데 아래를 맞춘다. */
const at = (kind: keyof typeof SIZE, lx: number, ly: number, x = 500, y = 400) => {
  const [w, h] = SIZE[kind];
  return { x: x - w / 2 + lx, y: y - h + ly, foot: decorFoot(kind, x, y, w, h) };
};

describe('소품 발자국', () => {
  it('모든 소품은 그림 안쪽 바닥에 발자국이 있다', () => {
    for (const kind of Object.keys(SIZE) as (keyof typeof SIZE)[]) {
      const [w, h] = SIZE[kind];
      const pts = FOOTPRINTS[kind];
      expect(pts.length).toBeGreaterThanOrEqual(3);
      for (const [px, py] of pts) {
        expect(px).toBeGreaterThanOrEqual(0);
        expect(px).toBeLessThanOrEqual(w);
        expect(py).toBeLessThanOrEqual(h + 2);
      }
      expect(Math.max(...pts.map((p) => p[1]))).toBeGreaterThan(h - 6); // 가장 앞쪽은 그림 바닥에 닿는다
    }
  });

  it('벤치: 다리가 있는 곳은 막고, 다리 옆 빈 풀밭은 막지 않는다', () => {
    const leftLeg = at('bench', 40, 120);
    expect(insideFoot(leftLeg.foot, leftLeg.x, leftLeg.y)).toBe(true);
    const rightLeg = at('bench', 168, 92);
    expect(insideFoot(rightLeg.foot, rightLeg.x, rightLeg.y)).toBe(true);
    // 예전에는 그림 아래 가운데 띠 전체를 막아서 여기(벤치 오른쪽 아래 풀밭)서 보이지 않는 벽에 걸렸다.
    const grass = at('bench', 120, 120);
    expect(insideFoot(grass.foot, grass.x, grass.y)).toBe(false);
  });

  it('비스듬한 벤치의 앞뒤를 발 위치로 가린다', () => {
    const frontRight = at('bench', 160, 112); // 오른쪽 끝 앞
    expect(inFront(frontRight.foot, frontRight.x, frontRight.y)).toBe(true);
    const behindLeft = at('bench', 12, 104); // 왼쪽 끝 뒤
    expect(inFront(behindLeft.foot, behindLeft.x, behindLeft.y)).toBe(false);
    const behindMiddle = at('bench', 90, 88);
    expect(inFront(behindMiddle.foot, behindMiddle.x, behindMiddle.y)).toBe(false);
  });

  it('발자국 밖의 x에서는 가장 가까운 끝의 앞뒤 범위를 쓴다', () => {
    const { foot } = at('flowerpot', 0, 0);
    const xs = foot.map((p) => p[0]);
    const left = spanAt(foot, Math.min(...xs) - 50);
    expect(left.back).toBeLessThanOrEqual(left.front);
    expect(spanAt(foot, Math.min(...xs))).toEqual(left);
  });
});

describe('방향 바꾸기와 겹침', () => {
  const [w, h] = SIZE.bench;
  it('좌우를 바꾸면 발자국도 거울처럼 바뀐다(벤치의 낮은 다리가 오른쪽으로)', () => {
    const normal = decorFoot('bench', 500, 400, w, h);
    const flipped = decorFoot('bench', 500, 400, w, h, true);
    const lowestX = (f: [number, number][]) => f.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    expect(lowestX(normal)).toBeLessThan(500);
    expect(lowestX(flipped)).toBeGreaterThan(500);
    // 왼쪽 다리 자리는 뒤집으면 오른쪽 다리 자리가 된다
    expect(insideFoot(flipped, 500 + w / 2 - 40, 400 - h + 120)).toBe(true);
  });

  it('두 발자국이 겹치는지', () => {
    const a = decorFoot('bench', 500, 400, w, h);
    expect(feetOverlap(a, decorFoot('bench', 532, 400, w, h))).toBe(true); // 한 칸 옆
    expect(feetOverlap(a, decorFoot('bench', 700, 400, w, h))).toBe(false); // 벤치 하나 너비만큼 옆
    expect(feetOverlap(a, decorFoot('bench', 500, 300, w, h))).toBe(false); // 뒤쪽
    const inner = smallFoot(500, 400 - h + 112); // 벤치 발자국 한가운데 꽃 하나
    expect(feetOverlap(a, inner)).toBe(true);
    expect(feetOverlap(inner, a)).toBe(true);
  });

  it('나무는 줄기만, 마당 꽃은 작은 자리만 차지한다', () => {
    expect(insideFoot(trunkFoot(300, 300), 300, 295)).toBe(true);
    expect(insideFoot(trunkFoot(300, 300), 300, 270)).toBe(false); // 줄기 뒤(나뭇잎 아래)는 지나간다
    expect(insideFoot(smallFoot(300, 300), 300, 297)).toBe(true);
    expect(insideFoot(smallFoot(300, 300), 330, 297)).toBe(false);
  });
});

describe('갇혔을 때 빠져나갈 자리', () => {
  const outsideCircle = (r: number) => (x: number, y: number) => Math.hypot(x - 100, y - 100) > r;

  it('설 수 있으면 그 자리 그대로', () => {
    expect(findFreeSpot(10, 10, () => true)).toEqual({ x: 10, y: 10 });
  });

  it('소품 안에 갇히면 가장 가까운 바깥으로', () => {
    const spot = findFreeSpot(100, 100, outsideCircle(30))!;
    const d = Math.hypot(spot.x - 100, spot.y - 100);
    expect(d).toBeGreaterThan(30);
    expect(d).toBeLessThanOrEqual(30 + 8);
  });

  it('뒤쪽이 더 가까워도 앞쪽(화면 아래)으로 비켜서서 소품에 가려지지 않는다', () => {
    const band = (_x: number, y: number) => y < 80 || y > 130; // 위로 5px, 아래로 45px 나가야 빈자리
    const spot = findFreeSpot(100, 85, band)!;
    expect(spot.y).toBeGreaterThan(130);
  });

  it('앞쪽이 막혔으면 뒤쪽이라도', () => {
    const onlyUp = (_x: number, y: number) => y < 80;
    expect(findFreeSpot(100, 85, onlyUp)!.y).toBeLessThan(80);
  });

  it('너무 멀면 찾지 않는다', () => {
    expect(findFreeSpot(100, 100, outsideCircle(500))).toBeNull();
  });
});

describe('텃밭 발자국', () => {
  const cx = BED.x + BED.w / 2;
  it('앞쪽 테두리 바로 아래까지 다가갈 수 있다(예전엔 14px 앞에서 멈췄다)', () => {
    expect(insideFoot(bedFoot(), cx, BED.y + BED.h - 1)).toBe(true);
    expect(insideFoot(bedFoot(), cx, BED.y + BED.h + 1)).toBe(false);
  });

  it('텃밭 그림처럼 뒤쪽이 좁다(뒤 모서리 바깥 풀밭은 막지 않는다)', () => {
    const backY = BED.y + BED_BACK + 2;
    expect(insideFoot(bedFoot(), BED.x + 4, backY)).toBe(false);
    expect(insideFoot(bedFoot(), BED.x + BED.w - 4, backY)).toBe(false);
    expect(insideFoot(bedFoot(), BED.x + 4, BED.y + BED.h - 2)).toBe(true);
  });

  it('뒤쪽 테두리 너머는 텃밭 뒤에 선 자리라 지나갈 수 있다', () => {
    expect(insideFoot(bedFoot(), cx, BED.y + BED_BACK - 1)).toBe(false);
    expect(inFront(bedFoot(), cx, BED.y + BED_BACK - 1)).toBe(false);
    expect(inFront(bedFoot(), cx, BED.y + BED.h + 1)).toBe(true);
  });
});
