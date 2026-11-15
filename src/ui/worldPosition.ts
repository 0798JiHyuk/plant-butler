import { GARDEN_ORIGIN } from '../core/worldGeometry';
import { useSyncExternalStore } from 'react';
import { events } from '../core/events';
import { zoneAt } from '../core/exploration';
let position = { x: GARDEN_ORIGIN.x+640, y: GARDEN_ORIGIN.y+540, indoor: false };
const listeners = new Set<() => void>();
events.on('world-position', next => { position = next; listeners.forEach(fn => fn()); });
export const currentPosition = () => position;
export const currentZone = () => zoneAt(position.x, position.y, position.indoor);
export const useWorldPosition = () => useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => position);

let storyGuidance=false;
const guidanceListeners=new Set<()=>void>();
export function guideToStory(on:boolean):void {storyGuidance=on;guidanceListeners.forEach(fn=>fn());}
export const useStoryGuidance=()=>useSyncExternalStore(fn=>{guidanceListeners.add(fn);return()=>{guidanceListeners.delete(fn);};},()=>storyGuidance);
events.on('state-restored',()=>guideToStory(false));
