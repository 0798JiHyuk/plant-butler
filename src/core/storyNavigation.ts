import type { AppState } from './types';
import { nextMain } from './narrative';
import { LANDMARKS, type WorldPoint } from './worldGeometry';
import type { NpcId } from './events';
export interface StoryTarget { sceneId:string;point:WorldPoint;label:'board'|'nuri'|'moru'|'pio'|'home';npc?:NpcId }
export function storyTarget(s:AppState):StoryTarget|undefined {
  const id=nextMain(s);
  if(!id)return undefined;
  if(id==='ST-P01'||id==='ST-A01')return {sceneId:id,point:LANDMARKS.nuri,label:'nuri',npc:'nuri'};
  if(id==='ST-B01')return {sceneId:id,point:LANDMARKS.moru,label:'moru',npc:'moru'};
  if(id==='ST-C01')return {sceneId:id,point:LANDMARKS.pio,label:'pio',npc:'pio'};
  if(id==='ST-E01')return {sceneId:id,point:LANDMARKS.home,label:'home'};
  return {sceneId:id,point:LANDMARKS.board,label:'board'};
}
