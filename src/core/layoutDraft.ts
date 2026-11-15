import type { AppState } from './types';
import { stateKey } from './state';
import { store } from './store';
let draft: AppState | null = null;
let baseline = '';
let owner: string | null = null;
const history: AppState[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());
const placement = (s: AppState) => ({ items: s.garden.items, plants: s.garden.plants, storage: s.garden.storage, interior: s.garden.interior, bed: s.garden.bed });
export function beginLayout(): void { owner=store.owner; baseline=stateKey(placement(store.state)); draft=structuredClone(store.state); history.length=0; notify(); }
export const layoutState = () => draft ?? store.state;
export const layoutActive = () => !!draft;
export const subscribeLayout = (fn:()=>void) => { listeners.add(fn); return ()=>{listeners.delete(fn);}; };
export function editLayout(change:(s:AppState)=>void):void {
  if(!draft){store.update(change);return;}
  history.push(structuredClone(draft)); if(history.length>30)history.shift();
  change(draft); draft=structuredClone(draft); notify();
}
export function undoLayout():boolean { const prev=history.pop(); if(!prev)return false;draft=prev;notify();return true; }
export function discardLayout():void {draft=null;history.length=0;notify();}
export function saveLayout(): 'ok'|'conflict'|'storage' {
  if(!draft)return 'ok';
  if(owner!==store.owner||stateKey(placement(store.state))!==baseline)return 'conflict';
  const next=structuredClone(placement(draft));
  if(!store.tryUpdate(s=>{Object.assign(s.garden,next);}))return 'storage';
  discardLayout();return 'ok';
}
