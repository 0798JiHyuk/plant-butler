/** Café geometry is shared by rendering, movement validation and SQL fixtures. */
export const CAFE = { width:2048, height:1536, left:144, right:1904, top:480, bottom:1380, spawn:{x:1024,y:1280} } as const;
export const CAFE_TABLES = [{x:480,y:700},{x:1024,y:700},{x:1568,y:700},{x:480,y:1060},{x:1568,y:1060}] as const;
export const CAFE_SEATS = CAFE_TABLES.flatMap((table,i)=>[-1,1].map((side,j)=>({id:`chair-${i*2+j+1}`,x:table.x+side*140,y:table.y+110})));
/** 카페 아래 가운데 문(그림의 문턱) 앞. 여기에 닿으면 정원으로 나간다. 처음 서는 자리(spawn)는 이 범위 밖이라 들어오자마자 나가지 않는다. */
export function atCafeDoor(x:number,y:number):boolean {
  return Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-CAFE.spawn.x)<110&&y>=1335;
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface CafeMember { user_id:string; garden_name:string; x:number; y:number; seat_id:string|null; updated_at:string }
export function cafeWalkable(x:number,y:number):boolean {
  return Number.isFinite(x)&&Number.isFinite(y)&&x>CAFE.left&&x<CAFE.right&&y>CAFE.top&&y<CAFE.bottom
    && !CAFE_TABLES.some(p=>Math.abs(x-p.x)<100&&Math.abs(y-p.y)<55)
    && !CAFE_SEATS.some(p=>Math.abs(x-p.x)<42&&y>p.y-28&&y<p.y+6);
}
export function readCafeMember(value:unknown):CafeMember|null {
  if(!value||typeof value!=='object')return null;
  const r=value as Record<string,unknown>;
  if(typeof r.user_id!=='string'||!UUID.test(r.user_id)||typeof r.garden_name!=='string'||typeof r.x!=='number'||typeof r.y!=='number'||typeof r.updated_at!=='string'||!Number.isFinite(Date.parse(r.updated_at)))return null;
  const seat=CAFE_SEATS.find(s=>s.id===r.seat_id);
  if(r.seat_id!==null&&!seat)return null;
  if(seat?(r.x!==seat.x||r.y!==seat.y):!cafeWalkable(r.x,r.y))return null;
  return {user_id:r.user_id,garden_name:r.garden_name.slice(0,24),x:r.x,y:r.y,seat_id:seat?.id??null,updated_at:r.updated_at};
}
export const cafeMemberFresh=(r:CafeMember,now=Date.now())=>now-Date.parse(r.updated_at)<30000;
