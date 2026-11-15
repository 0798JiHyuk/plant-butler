export interface Point {x:number;y:number}
export const INTERACTION_RANGE=240;
export const SHOP_RANGE=300;
export function withinReach(from:Point,to:Point,range=INTERACTION_RANGE):boolean {
  return [from.x,from.y,to.x,to.y,range].every(Number.isFinite)&&Math.hypot(from.x-to.x,from.y-to.y)<=range;
}
export function seatPlacement(anchor:Point,kind:'bench'|'hammock',height:number){
  return {x:anchor.x,y:anchor.y-height*(kind==='bench'?.35:.62),depth:anchor.y+2,pose:kind==='bench'?'sit' as const:'lie' as const};
}
