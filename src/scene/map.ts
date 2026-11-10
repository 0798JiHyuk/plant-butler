// 정원 지도. 배경 그림은 팀 가이드 A 테마(art/guide/theme_a_empty.png)를 1266×712로 줄여 쓴다.
// 걸을 수 있는 곳은 그림 위에 손으로 그린 다각형이다. 바뀌면 art 폴더의 점검 방법으로 겹쳐 확인할 것.

export const TILE = 32;
export const MAP_W = 1266;
export const MAP_H = 712;
export const COLS = Math.ceil(MAP_W / TILE);
export const ROWS = Math.ceil(MAP_H / TILE);

/** 발이 닿을 수 있는 영역(잔디 마당 + 길 + 집 앞 계단) */
const WALK: [number, number][] = [
  [100, 352], [140, 302], [210, 262], [300, 240], [440, 232], [540, 215], [560, 160], [565, 128], [650, 130], [690, 190],
  [735, 225], [790, 215], [800, 195], [880, 190], [955, 200], [960, 235], [1000, 262], [1100, 272], [1165, 300], [1210, 345],
  [1215, 400], [1195, 470], [1150, 515], [1105, 555], [1030, 566], [1000, 583], [900, 572], [850, 568], [800, 590], [775, 620],
  [765, 712], [525, 712], [520, 640], [505, 600], [470, 580], [430, 555], [350, 520], [270, 500], [200, 482], [135, 445], [108, 392],
];

/** 길의 가운데 선. 소품이 길을 막지 않도록 거리를 잴 때만 쓴다. */
const PATH_LINE: [number, number][] = [
  [590, 130], [650, 190], [740, 245], [850, 290], [950, 340], [1010, 400], [1020, 450], [980, 500], [900, 540], [800, 580], [700, 620], [640, 712],
];

/** 정원 전체가 한 화면에 꼭 들어오는 배율(이보다 더 줄일 수는 없다) */
export function fitZoom(viewW: number, viewH: number): number {
  return Math.min(viewW / MAP_W, viewH / MAP_H);
}

/** 화면이 정원 그림으로 빈틈없이 덮이는 최소 배율(이보다 줄이면 정원 바깥의 빈 배경이 보인다) */
export function coverZoom(viewW: number, viewH: number): number {
  return Math.max(viewW / MAP_W, viewH / MAP_H);
}

/** 기본 시야: 폰 가로 화면은 가까이, 컴퓨터 창처럼 세로가 넉넉하면 조금 넓게 */
export function defaultViewZoom(viewH: number): number {
  return viewH > 450 ? 0.8 : 1;
}

/** 주민들이 사는 자리(여기를 중심으로 서성인다). 느리는 큰 나무 아래, 모루는 집 옆 작업대, 피오는 식물이 자라는 마당. */
export const NPC_HOMES = {
  nuri: { x: 250, y: 330 },
  moru: { x: 850, y: 258 },
  pio: { x: 985, y: 355 },
} as const;

export const SPAWN = { x: 640, y: 540 };

export function inPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPath(x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < PATH_LINE.length - 1; i++) {
    const [ax, ay] = PATH_LINE[i];
    const [bx, by] = PATH_LINE[i + 1];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return best;
}

export function isWalkable(x: number, y: number): boolean {
  return inPolygon(x, y, WALK);
}

// ---- 밭: 나무 틀 텃밭 그림(garden/field.png) 한 장. 식물은 그림의 두둑 16곳에만 심고 옮길 수 있다(소품은 마당 어디든). ----
// 식물 칸의 번호는 (SLOT_BASE + 열, SLOT_BASE + 행)이라서 소품이 놓이는 마당 칸 번호와 겹치지 않는다.
export const DEFAULT_BED = { x: 420, y: 268, w: 239, h: 140 } as const;
/** 지금 텃밭이 놓인 자리. 꾸미기에서 옮길 수 있어서 x·y만 바뀌고, 두둑 위치(slotWorld)는 항상 이걸 따른다. */
export const BED: { x: number; y: number; w: number; h: number } = { ...DEFAULT_BED };

export function setBedPos(x: number, y: number): void {
  BED.x = x;
  BED.y = y;
}

/** 텃밭을 (x, y)에 놓아도 되는지: 네 귀퉁이와 변 가운데가 걸을 수 있는 마당이고, avoid의 점(소품·새싹이·주민)이 위에 없어야 한다. */
export function bedFits(x: number, y: number, avoid: { x: number; y: number }[]): boolean {
  const { w, h } = BED;
  const edge: [number, number][] = [[0, 0], [w / 2, 0], [w, 0], [0, h / 2], [w, h / 2], [0, h], [w / 2, h], [w, h]];
  if (!edge.every(([dx, dy]) => isWalkable(x + dx, y + dy))) return false;
  const pad = 24;
  const hit = (p: { x: number; y: number }) => p.x >= x - pad && p.x <= x + w + pad && p.y >= y - pad && p.y <= y + h + pad;
  return ![...avoid, SPAWN, ...Object.values(NPC_HOMES)].some(hit);
}
export const SLOT_BASE = 100;
const SLOTS = 4;
// 두둑 가운데(그림에서 잘라 낸 크기 1195×702 기준 좌표). 원근 때문에 아랫줄일수록 넓게 벌어진다.
const MOUNDS: [number, number][][] = [
  [[269, 137], [479, 137], [694, 137], [899, 137]],
  [[249, 242], [469, 242], [689, 242], [909, 242]],
  [[229, 347], [464, 347], [694, 347], [924, 347]],
  [[219, 457], [459, 457], [704, 457], [944, 457]],
];
const IMG_W = 1195;

type Cell = { col: number; row: number };
const taken = (used: Cell[], c: Cell) => used.some((u) => u.col === c.col && u.row === c.row);

export function isFieldTile(col: number, row: number): boolean {
  return col >= SLOT_BASE && col < SLOT_BASE + SLOTS && row >= SLOT_BASE && row < SLOT_BASE + SLOTS;
}

/** 밭의 모든 두둑 칸(위쪽 줄부터). */
export function plantSlots(): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < SLOTS; r++) for (let c = 0; c < SLOTS; c++) cells.push({ col: SLOT_BASE + c, row: SLOT_BASE + r });
  return cells;
}

/** 식물 칸의 정원 속 위치(발 끝). 밭 칸이 아니면 null. */
export function slotWorld(col: number, row: number): { x: number; y: number } | null {
  if (!isFieldTile(col, row)) return null;
  const [mx, my] = MOUNDS[row - SLOT_BASE][col - SLOT_BASE];
  const k = BED.w / IMG_W;
  return { x: BED.x + mx * k, y: BED.y + (my + 30) * k };
}

/** 가장 가까운 식물 칸(maxDist 안에서). 없으면 null. */
export function nearestSlot(x: number, y: number, maxDist: number): Cell | null {
  let best: (Cell & { d: number }) | null = null;
  for (let r = 0; r < SLOTS; r++) {
    for (let c = 0; c < SLOTS; c++) {
      const w = slotWorld(SLOT_BASE + c, SLOT_BASE + r)!;
      const d = Math.hypot(x - w.x, y - (w.y - 8));
      if (d <= maxDist && (!best || d < best.d)) best = { col: SLOT_BASE + c, row: SLOT_BASE + r, d };
    }
  }
  return best ? { col: best.col, row: best.row } : null;
}

/** 밭 그림이 차지하는 곳(걸을 수 없고 소품도 놓지 않는다). 가장자리에 반 칸 여유를 둔다. */
export function inBed(x: number, y: number, margin = 0): boolean {
  return x >= BED.x - margin && x <= BED.x + BED.w + margin && y >= BED.y - margin && y <= BED.y + BED.h + margin;
}

/** 소품을 놓을 수 있는 칸: 마당 안쪽이고 길에서 떨어진 곳. 밭 그림 위는 식물 자리라서 소품은 놓지 않는다. */
export function isDecorTile(col: number, row: number): boolean {
  if (col >= SLOT_BASE || row >= SLOT_BASE) return false;
  const x = col * TILE + TILE / 2;
  const y = row * TILE + TILE / 2;
  if (inBed(x, y, 40)) return false;
  return isWalkable(x, y) && isWalkable(x - 24, y) && isWalkable(x + 24, y) && distToPath(x, y) > 80;
}

/** 나무는 그림이 커서 다른 나무와 세 칸 이상 떨어뜨린다. */
export function treeRoomAt(col: number, row: number, trees: Cell[]): boolean {
  return trees.every((t) => Math.hypot(t.col - col, t.row - row) >= 3);
}

/** 새 식물 자리: 밭의 빈 두둑(위쪽 줄부터). 다 찼으면 null이고, 주머니는 열리지 않은 채 남는다. used에는 놓인 식물·소품 칸을 넘긴다. */
export function nextPlantSlot(used: Cell[]): Cell | null {
  for (const cell of plantSlots()) if (!taken(used, cell)) return cell;
  return null;
}

/** 새 소품 자리: 왼쪽 마당 가운데에서 가까운 빈 칸. 큰 소품끼리 겹치지 않게 4칸 이상 띄우고, 식물 시작 자리는 피한다. */
export function nextDecorSlot(used: Cell[]): Cell | null {
  const focus = { x: 420, y: 400 };
  const spots: { col: number; row: number; d: number }[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!isDecorTile(col, row)) continue;
      spots.push({ col, row, d: Math.hypot(col * TILE + 16 - focus.x, row * TILE + 16 - focus.y) });
    }
  }
  spots.sort((a, b) => a.d - b.d || a.row - b.row || a.col - b.col);
  const free = spots.find((s) => used.every((u) => Math.hypot(u.col - s.col, u.row - s.row) >= 4.2));
  return free ? { col: free.col, row: free.row } : null;
}
