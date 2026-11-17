import { LANDMARKS } from './worldGeometry';

/**
 * 정원 밖 건물 문 앞에 닿으면 클릭한 것처럼 "들어갈래요?"를 띄우는 규칙(집은 GardenScene의 기존 규칙, 상점은 바로 창이 열려서 제외).
 * 문 앞 길 표지(계단 맨 아래)를 기준으로, 벽 밑단에서 계단 끝까지를 덮는 직사각형이다.
 * 둥근 반경이면 벽을 따라 걸어와 문 바로 아래에 선 자리가 계단 끝에서 멀어 닿지 않았다.
 */
export type DoorBuilding = 'school' | 'work' | 'cafe';
const HALF_WIDTH = 60, ABOVE = 100, BELOW = 40;
const DOORS: DoorBuilding[] = ['school', 'work', 'cafe'];

export function doorAt(x: number, y: number): DoorBuilding | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return DOORS.find(id => {
    const door = LANDMARKS[id];
    return Math.abs(x - door.x) < HALF_WIDTH && y > door.y - ABOVE && y < door.y + BELOW;
  }) ?? null;
}
