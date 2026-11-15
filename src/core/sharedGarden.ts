import type { DecorItem } from './types';
import { plantById } from './plants';
export interface SharedPlant { plantId:string; col:number; row:number; stage:'seed'|'sprout'|'young'|'bloom'; harvested:boolean }
export interface SharedGarden { name:string; bed:{x:number;y:number}; items:DecorItem[]; plants:SharedPlant[] }
const kinds=new Set(['flowerpot','table','shelf','bench','birdbath','hammock','flower','pot','lamp']);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const cell=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<128;
/** Never decode an entire AppState here: private state cannot enter the visitor scene. */
export function readSharedGarden(value:unknown):SharedGarden|null {
  if(!record(value)||typeof value.name!=='string'||!record(value.bed)||!Array.isArray(value.items)||!Array.isArray(value.plants))return null;
  const {x,y}=value.bed;
  if(typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>4096||y<0||y>3072)return null;
  const items:DecorItem[]=[],plants:SharedPlant[]=[];
  for(const r of value.items.slice(0,300))if(record(r)&&typeof r.kind==='string'&&kinds.has(r.kind)&&cell(r.col)&&cell(r.row))items.push({id:`visit-${items.length}`,kind:r.kind as DecorItem['kind'],variant:0,col:r.col as number,row:r.row as number});
  for(const r of value.plants.slice(0,300))if(record(r)&&typeof r.plantId==='string'&&plantById(r.plantId)&&cell(r.col)&&cell(r.row)&&['seed','sprout','young','bloom'].includes(String(r.stage)))plants.push({plantId:r.plantId,col:r.col as number,row:r.row as number,stage:r.stage as SharedPlant['stage'],harvested:r.harvested===true});
  return {name:value.name.slice(0,24),bed:{x,y},items,plants};
}
