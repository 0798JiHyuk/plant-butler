import { GARDEN_LAWN,WORLD_SIZE,AREA_YARDS,BUILDING_AREAS,roadDistance } from './worldGeometry';
import { OPEN_LAWN,GATE_APRON,TREE_TRUNKS,wallBlocked } from './terrainBoundaries';
function inPolygon(x: number, y: number, poly: readonly (readonly [number,number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inGardenRegion(x:number,y:number):boolean {
  return inPolygon(x,y,GARDEN_LAWN);
}
export function isWalkable(x:number,y:number):boolean {
  if(x<20||y<20||x>WORLD_SIZE.width-20||y>WORLD_SIZE.height-20)return false;
  if(wallBlocked(x,y)||TREE_TRUNKS.some(t=>Math.hypot(x-t.x,y-t.y)<t.r))return false;
  const yard=AREA_YARDS.some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom);
  return inPolygon(x,y,OPEN_LAWN)||inPolygon(x,y,GATE_APRON)||inGardenRegion(x,y)||yard||roadDistance(x,y)<90;
}

export function buildingBlocked(x:number,y:number):boolean {
  return Object.values(BUILDING_AREAS).some(r=>x>r.left&&x<r.right&&y>r.top&&y<r.bottom);
}
/** Fixed terrain only; furniture and movable fields are intentionally excluded. */
export function terrainBlocked(x:number,y:number):boolean {return !isWalkable(x,y)||buildingBlocked(x,y);}
export function terrainFootBlocked(x:number,y:number):boolean {
  return [[-12,-8],[12,-8],[-12,-1],[12,-1]].some(([dx,dy])=>terrainBlocked(x+dx,y+dy));
}
