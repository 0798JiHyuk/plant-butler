import { describe, expect, it } from 'vitest';
import { CAFE, atCafeDoor, cafeWalkable } from '../core/cafe';

describe('카페 문으로 걸어 나가기', () => {
  it('아래 가운데 문 앞에 닿으면 나간다', () => {
    expect(atCafeDoor(1024, 1360)).toBe(true);
    expect(atCafeDoor(950, 1350)).toBe(true);
    expect(atCafeDoor(1100, 1375)).toBe(true);
  });
  it('들어와서 처음 서는 자리에서는 나가지 않는다', () => {
    expect(atCafeDoor(CAFE.spawn.x, CAFE.spawn.y)).toBe(false);
  });
  it('문에서 옆으로 멀거나 문 앞보다 위쪽이면 나가지 않는다', () => {
    expect(atCafeDoor(1024 + 160, 1360)).toBe(false);
    expect(atCafeDoor(1024 - 160, 1360)).toBe(false);
    expect(atCafeDoor(1024, 1300)).toBe(false);
  });
  it('문 앞 범위는 실제로 걸어서 닿을 수 있는 바닥 안이다', () => {
    for (const [x, y] of [[1024, 1360], [950, 1350], [1100, 1375]]) expect(cafeWalkable(x, y)).toBe(true);
  });
  it('좌표가 숫자가 아니면 나가지 않는다', () => {
    expect(atCafeDoor(Number.NaN, 1360)).toBe(false);
    expect(atCafeDoor(1024, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
