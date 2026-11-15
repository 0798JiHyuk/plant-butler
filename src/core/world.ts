import type { AppState, DecorItem } from './types';

export const HOME = { left: 96, right: 1170, top: 192, bottom: 640, doorX: 640, doorY: 620 } as const;
export const GARDEN_NAME_MAX = 16;
export function validGardenName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && [...value].length <= GARDEN_NAME_MAX
    && [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);
}
export function setGardenName(s: AppState, value: string): boolean {
  const name = value.trim();
  if (!validGardenName(name)) return false;
  s.garden.name = name;
  s.garden.namePromptSeen = true;
  return true;
}
export const furnitureOf = (s: AppState, indoor: boolean): DecorItem[] => indoor ? s.garden.interior?.items ?? [] : s.garden.items;
export function homeCellAllowed(col: number, row: number): boolean {
  const x = col * 32 + 16, y = (row + 1) * 32;
  return Number.isInteger(col) && Number.isInteger(row) && x > HOME.left + 48 && x < HOME.right - 48
    && y > HOME.top + 80 && y < HOME.bottom - 24 && !(Math.abs(x - HOME.doorX) < 96 && y > HOME.bottom - 160);
}
function free(s: AppState, col: number, row: number, except = ''): boolean {
  return homeCellAllowed(col, row) && !furnitureOf(s, true).some(i => i.id !== except && Math.abs(i.col - col) < 2 && Math.abs(i.row - row) < 2);
}
export function placeHomeFurniture(s: AppState, id: string, col: number, row: number): DecorItem | null {
  const index = s.garden.storage.findIndex(i => i.id === id && i.type === 'decor');
  if (index < 0 || !free(s, col, row)) return null;
  const item = s.garden.storage[index];
  if (item.type !== 'decor') return null;
  const placed = { id, kind: item.decorKind, variant: item.variant, col, row };
  (s.garden.interior ??= { items: [] }).items.push(placed);
  s.garden.storage.splice(index, 1);
  return placed;
}
export function moveHomeFurniture(s: AppState, id: string, col: number, row: number): boolean {
  const item = furnitureOf(s, true).find(i => i.id === id);
  if (!item || !free(s, col, row, id)) return false;
  Object.assign(item, { col, row });
  return true;
}
export function storeHomeFurniture(s: AppState, id: string): boolean {
  const items = s.garden.interior?.items;
  const index = items?.findIndex(i => i.id === id) ?? -1;
  if (!items || index < 0) return false;
  const [item] = items.splice(index, 1);
  s.garden.storage.push({ id, type: 'decor', decorKind: item.kind, variant: item.variant });
  return true;
}
