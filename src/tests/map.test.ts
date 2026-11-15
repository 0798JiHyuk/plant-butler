import { describe, expect, it } from 'vitest';
import { BED, bedFits, plantSlots, treeRoomAt, DEFAULT_BED, inBed, setBedPos, isDecorTile, isFieldTile, isWalkable, MAP_H, MAP_W, nearestSlot, nextDecorSlot, nextPlantSlot, NPC_HOMES, SLOT_BASE, slotWorld, SPAWN, TILE } from '../scene/map';

describe('map', () => {
  it('새싹이는 걸을 수 있는 곳에서 시작한다', () => {
    expect(isWalkable(SPAWN.x, SPAWN.y)).toBe(true);
    expect(isWalkable(5, 5)).toBe(false); // 왼쪽 위 나무 숲
  });

  it('소품 자리는 6개 이상, 서로 떨어져 있고 모두 걸을 수 있는 마당 안이다', () => {
    const used: { col: number; row: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const slot = nextDecorSlot(used);
      expect(slot).not.toBeNull();
      expect(isDecorTile(slot!.col, slot!.row)).toBe(true);
      expect(isWalkable(slot!.col * TILE + TILE / 2, slot!.row * TILE + TILE / 2)).toBe(true);
      for (const u of used) expect(Math.hypot(u.col - slot!.col, u.row - slot!.row)).toBeGreaterThanOrEqual(4.2);
      used.push(slot!);
    }
  });

  it('식물 칸은 밭 그림의 두둑 16곳이고, 소품 칸과 번호가 겹치지 않는다', () => {
    expect(isFieldTile(SLOT_BASE, SLOT_BASE)).toBe(true);
    expect(isFieldTile(SLOT_BASE + 3, SLOT_BASE + 3)).toBe(true);
    expect(isFieldTile(SLOT_BASE + 4, SLOT_BASE)).toBe(false);
    expect(isFieldTile(34, 12)).toBe(false);
    expect(isDecorTile(SLOT_BASE, SLOT_BASE)).toBe(false);
  });

  it('두둑 16곳은 모두 밭 그림 안에 있고 서로 겹치지 않는다', () => {
    const pts: { x: number; y: number }[] = [];
    const used: { col: number; row: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const cell = nextPlantSlot(used)!;
      expect(cell).not.toBeNull();
      const w = slotWorld(cell.col, cell.row)!;
      expect(inBed(w.x, w.y - 8)).toBe(true);
      for (const q of pts) expect(Math.hypot(q.x - w.x, q.y - w.y)).toBeGreaterThan(14);
      pts.push(w);
      used.push(cell);
    }
    expect(nextPlantSlot(used)).toBeNull();
  });

  it('두둑을 누르면 가장 가까운 칸이 잡히고, 밭 밖이면 없다', () => {
    const w = slotWorld(SLOT_BASE + 2, SLOT_BASE + 1)!;
    expect(nearestSlot(w.x + 3, w.y - 8, 20)).toEqual({ col: SLOT_BASE + 2, row: SLOT_BASE + 1 });
    expect(nearestSlot(5, 5, 34)).toBeNull();
  });

  it('소품은 밭 그림 위와 그 둘레에는 놓지 않고, 자동 자리도 피한다', () => {
    const slot = nextDecorSlot([])!;
    expect(inBed(slot.col * TILE + 16, slot.row * TILE + 16, 40)).toBe(false);
    expect(isDecorTile(Math.floor((BED.x + 100) / TILE), Math.floor((BED.y + 60) / TILE))).toBe(false);
    expect(isDecorTile(17, 76)).toBe(true);
    expect(isDecorTile(18, 57)).toBe(false);
    expect(isDecorTile(0, 0)).toBe(false);
  });

  it('밭 그림은 걸을 수 있는 마당 안에 있다', () => {
    for (const [x, y] of [[BED.x, BED.y], [BED.x + BED.w, BED.y], [BED.x, BED.y + BED.h], [BED.x + BED.w, BED.y + BED.h]]) {
      expect(isWalkable(x, y)).toBe(true);
    }
  });

  it('주민들이 사는 자리는 모두 걸을 수 있는 마당 안이고 서로 떨어져 있다', () => {
    const homes = Object.values(NPC_HOMES);
    for (const h of homes) {
      expect(isWalkable(h.x, h.y)).toBe(true);
      expect(isWalkable(h.x - 14, h.y) && isWalkable(h.x + 14, h.y)).toBe(true);
    }
    for (let i = 0; i < homes.length; i++) {
      for (let j = i + 1; j < homes.length; j++) expect(Math.hypot(homes[i].x - homes[j].x, homes[i].y - homes[j].y)).toBeGreaterThan(150);
    }
  });

  it('텃밭은 처음 자리에 놓을 수 있고, 숲이나 길 밖으로는 옮길 수 없다', () => {
    expect(bedFits(DEFAULT_BED.x, DEFAULT_BED.y, [])).toBe(true);
    expect(bedFits(0, 0, [])).toBe(false);
    expect(bedFits(MAP_W - 20, MAP_H - 20, [])).toBe(false);
  });

  it('텃밭은 소품·새싹이·주민이 있는 곳에는 놓을 수 없다', () => {
    expect(bedFits(DEFAULT_BED.x, DEFAULT_BED.y, [{ x: DEFAULT_BED.x + 50, y: DEFAULT_BED.y + 50 }])).toBe(false);
    expect(bedFits(DEFAULT_BED.x, DEFAULT_BED.y, [{ x: DEFAULT_BED.x + 600, y: DEFAULT_BED.y }])).toBe(true);
    const home = NPC_HOMES.nuri;
    expect(bedFits(home.x - 40, home.y - 40, [])).toBe(false);
  });

  it('텃밭을 옮기면 두둑 위치도 같이 움직인다', () => {
    const before = slotWorld(SLOT_BASE, SLOT_BASE)!;
    setBedPos(DEFAULT_BED.x + 16, DEFAULT_BED.y + 8);
    const after = slotWorld(SLOT_BASE, SLOT_BASE)!;
    expect(after.x - before.x).toBe(16);
    expect(after.y - before.y).toBe(8);
    setBedPos(DEFAULT_BED.x, DEFAULT_BED.y);
  });

  it('심을 곳을 고를 때 쓰는 두둑 목록은 16곳이고 모두 밭 칸이다', () => {
    const slots = plantSlots();
    expect(slots).toHaveLength(16);
    expect(slots.every((c) => isFieldTile(c.col, c.row))).toBe(true);
    expect(new Set(slots.map((c) => `${c.col},${c.row}`)).size).toBe(16);
  });

  it('나무는 다른 나무와 세 칸 이상 떨어져야 한다', () => {
    const trees = [{ col: 10, row: 10 }];
    expect(treeRoomAt(12, 10, trees)).toBe(false);
    expect(treeRoomAt(13, 10, trees)).toBe(true);
    expect(treeRoomAt(10, 10, [])).toBe(true);
  });
});
