import { buy, SHOP, type BuyResult } from './economy';
import { ensureExploration } from './exploration';
import { homeCellAllowed } from './world';
import type { AppState } from './types';
export function setDecorationGoal(s:AppState,kind:string,zone:'garden'|'home',col:number,row:number):boolean {
  if(!SHOP.some(x=>x.kind===kind)||!Number.isInteger(col)||!Number.isInteger(row))return false;
  if(zone==='home'&&!homeCellAllowed(col,row))return false;
  ensureExploration(s).goal={kind,zone,col,row};return true;
}
/** Retry the same intent with the same request ID. A different product is never substituted. */
export function purchaseOnce(s:AppState,kind:string,requestId:string):BuyResult {
  const p=ensureExploration(s),old=p.purchases?.[requestId];
  if(old)return old.kind===kind?old.result as BuyResult:'unknown';
  const result=buy(s,kind);
  (p.purchases??={})[requestId]={kind,result};return result;
}
