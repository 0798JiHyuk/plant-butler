import type { Point } from './interaction';
import { ensureExploration, type ZoneId } from './exploration';
import type { AppState } from './types';
import { LANDMARKS } from './worldGeometry';

/** 학교·직장 실내. 규칙만 담고 Phaser·DOM은 모른다. 좌표는 실내 그림(1266x712) 기준이다. */
export type PlaceId = 'school' | 'work';
export interface Rect { x: number; y: number; w: number; h: number }
export interface PlaceSpec {
  zone: PlaceId;
  /** 장소 첫 안내로 쓰는 이야기 장면. 팝업을 따로 두지 않고 이 장면을 다시 쓴다. */
  sceneId: string;
  width: number;
  height: number;
  /** 들어왔을 때 서 있는 곳(문 안쪽). */
  spawn: Point;
  /** 문 아래 가운데. 이 자리에 서면 정원으로 나간다. */
  door: Point;
  floor: { left: number; right: number; top: number; bottom: number };
  /** 가구 발밑. 그림 위에 겹쳐 확인한다(tools/place_overlay.py). */
  blocked: Rect[];
  /** 메모를 적는 책상 앞. 책상 위라 바닥으로는 걸을 수 없다. */
  memo: Point;
}

export const PLACE_IDS: PlaceId[] = ['school', 'work'];
export const PLACE_REACH = 160;
const DOOR_HALF = 70;
const DOOR_TOP = 626;

export const PLACES: Record<PlaceId, PlaceSpec> = {
  // 가구를 새싹이 크기에 맞춰 줄인 그림(2026-11-16) 기준으로 잰 값이다.
  school: {
    zone: 'school', sceneId: 'ST-V02', width: 1266, height: 712,
    spawn: { x: 712, y: 600 }, door: { x: 633, y: 640 },
    floor: { left: 70, right: 1195, top: 345, bottom: 640 },
    blocked: [
      { x: 70, y: 335, w: 185, h: 80 },    // 왼쪽 벽 모서리(옷걸이 아래, 곡선 벽)
      { x: 70, y: 410, w: 135, h: 125 },   // 왼쪽 칸 선반
      { x: 235, y: 335, w: 195, h: 35 },   // 지구본과 메모 책상
      { x: 283, y: 393, w: 238, h: 176 },  // 왼쪽 책상 묶음
      { x: 848, y: 393, w: 242, h: 176 },  // 오른쪽 책상 묶음
      { x: 1020, y: 335, w: 125, h: 20 },  // 오른쪽 책장
      { x: 1140, y: 335, w: 70, h: 85 },   // 오른쪽 벽 모서리(곡선 벽)
    ],
    memo: { x: 368, y: 345 },
  },
  work: {
    zone: 'work', sceneId: 'ST-V03', width: 1266, height: 712,
    spawn: { x: 633, y: 600 }, door: { x: 633, y: 640 },
    floor: { left: 70, right: 1195, top: 360, bottom: 640 },
    blocked: [
      { x: 78, y: 355, w: 142, h: 132 },   // 서류함 선반
      { x: 272, y: 355, w: 142, h: 45 },   // 제도대
      { x: 503, y: 355, w: 260, h: 55 },   // 작업 책상과 의자
      { x: 915, y: 355, w: 235, h: 150 },  // 칸막이와 메모 책상·걸상
      { x: 1148, y: 355, w: 50, h: 120 },  // 오른쪽 벽 모서리(곡선 벽)
    ],
    memo: { x: 1035, y: 470 },
  },
};

const inside = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export function placeWalkable(id: PlaceId, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const { floor, blocked } = PLACES[id];
  if (x < floor.left || x > floor.right || y < floor.top || y > floor.bottom) return false;
  return !blocked.some(r => inside(r, x, y));
}

export function atPlaceDoor(id: PlaceId, x: number, y: number): boolean {
  return Math.abs(x - PLACES[id].door.x) < DOOR_HALF && y >= DOOR_TOP;
}

/** 실내 문으로 나올 때 정원에서 서는 곳. 그 건물 앞 길(지도의 장소 표지) 위다. */
export const placeExitPoint = (id: PlaceId): Point => ({ x: LANDMARKS[id].x, y: LANDMARKS[id].y });

export const placeSceneId = (id: PlaceId): string => PLACES[id].sceneId;
export const placeZoneFor = (id: PlaceId): ZoneId => PLACES[id].zone;

/** 실내에 실제로 들어왔을 때만 부른다. 외관 발견(discover)과 따로 기록한다. */
export function enterPlace(s: AppState, id: PlaceId): boolean {
  const p = ensureExploration(s);
  const entered = p.entered ??= [];
  if (entered.includes(id)) return false;
  entered.push(id);
  return true;
}
