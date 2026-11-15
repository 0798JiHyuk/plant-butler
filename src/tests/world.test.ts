import { describe, expect, it } from 'vitest';
import { createState, decodeState } from '../core/state';
import { furnitureOf, homeCellAllowed, moveHomeFurniture, placeHomeFurniture, setGardenName, storeHomeFurniture } from '../core/world';
import { isWalkable, isDecorTile } from '../scene/map';

describe('정원 이름과 실내 저장', () => {
  it('정원 이름은 공백을 정리하고 16자까지 저장한다', () => {
    const s = createState();
    expect(setGardenName(s, '  작은 정원  ')).toBe(true);
    expect(s.garden.name).toBe('작은 정원');
    expect(setGardenName(s, ' '.repeat(5))).toBe(false);
    expect(setGardenName(s, '가'.repeat(17))).toBe(false);
    expect(s.garden.name).toBe('작은 정원');
  });
  it('기존 저장을 유지하고 이름과 실내 배치를 함께 복원한다', () => {
    const s = createState();
    expect(decodeState(s).garden.interior).toBeUndefined();
    setGardenName(s, '나무 정원');
    s.garden.storage.push({ id: 'chair', type: 'decor', decorKind: 'bench', variant: 0 });
    expect(placeHomeFurniture(s, 'chair', 12, 12)).not.toBeNull();
    const restored = decodeState(JSON.parse(JSON.stringify(s)));
    expect(restored.garden).toEqual(s.garden);
    expect(furnitureOf(restored, true)).toHaveLength(1);
    expect(furnitureOf(restored, false)).toHaveLength(0);
  });
  it('출입구와 벽·중복 배치를 막고 가구를 중복 지급하지 않는다', () => {
    const s = createState();
    s.garden.storage.push({ id: 'a', type: 'decor', decorKind: 'table', variant: 0 }, { id: 'b', type: 'decor', decorKind: 'shelf', variant: 0 });
    expect(homeCellAllowed(19, 18)).toBe(false);
    expect(placeHomeFurniture(s, 'a', 0, 0)).toBeNull();
    expect(placeHomeFurniture(s, 'a', 12, 12)).not.toBeNull();
    expect(placeHomeFurniture(s, 'a', 14, 12)).toBeNull();
    expect(placeHomeFurniture(s, 'b', 12, 12)).toBeNull();
    expect(moveHomeFurniture(s, 'a', 19, 18)).toBe(false);
    expect(moveHomeFurniture(s, 'a', 14, 12)).toBe(true);
    expect(storeHomeFurniture(s, 'a')).toBe(true);
    expect(storeHomeFurniture(s, 'a')).toBe(false);
    expect(s.garden.storage).toHaveLength(2);
    expect(s.fruit).toBe(0);
  });
  it('실내에 씨앗이나 식물을 소비하지 않는다', () => {
    const s = createState();
    s.garden.storage.push({ id: 'flower', type: 'plant', plantId: 'daisy', date: '2026-11-12' });
    expect(placeHomeFurniture(s, 'flower', 12, 12)).toBeNull();
    expect(s.garden.storage).toHaveLength(1);
  });
  it('새 길이 끊기지 않고 확장 마당에 배치할 수 있다', () => {
    for (let y = 680; y < 1410; y += 8) expect(isWalkable(896, y + 1536)).toBe(true);
    expect(isWalkable(10, 800)).toBe(false);
    expect(isDecorTile(17, 76)).toBe(true);
    expect(isDecorTile(27, 71)).toBe(false);
    expect(isDecorTile(27, 77)).toBe(true);
  });
});
