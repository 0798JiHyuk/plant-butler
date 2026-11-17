import { describe, expect, it } from 'vitest';
import { terrainFootBlocked } from '../core/worldTerrain';
import { LANDMARKS } from '../core/worldGeometry';

/**
 * 정원 밖 건물의 막힘 영역이 그림의 벽 아랫단·화분·통까지 덮는지 확인한다.
 * 좌표는 world-boundaries-*.webp 위에 BUILDING_AREAS를 겹쳐 재서 정했다(발 아래쪽이 벽 그림 위에 서던 자리들).
 */
describe('건물 앞 벽 아랫단·화분이 새싹이를 막는다', () => {
  const blocked: [string, number, number][] = [
    ['상점 카운터 아래', 1930, 1790],
    ['상점 앞 큰 화분', 2085, 1830],
    ['상점 왼쪽 나무판', 1560, 1800],
    ['카페 창가 돌 단', 3400, 1835],
    ['카페 왼쪽 화분', 3280, 1870],
    ['집 왼쪽 화분', 980, 1590],
    ['집 오른쪽 화분', 1260, 1590],
  ];
  for (const [name, x, y] of blocked) it(`${name} (${x},${y})`, () => expect(terrainFootBlocked(x, y)).toBe(true));

  it('문 앞 계단과 길 표지는 계속 걸을 수 있다', () => {
    for (const k of ['home', 'shop', 'cafe', 'school', 'work'] as const) expect(terrainFootBlocked(LANDMARKS[k].x, LANDMARKS[k].y), k).toBe(false);
    expect(terrainFootBlocked(1780, 1815)).toBe(false); // 상점 문 앞 계단
    expect(terrainFootBlocked(3112, 1850)).toBe(false); // 카페 문 앞 계단
    expect(terrainFootBlocked(1112, 1600)).toBe(false); // 집 문 앞 계단
  });
});
