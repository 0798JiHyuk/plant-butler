import { ensureExploration, exploration } from './exploration';
import { withinReach } from './interaction';
import { drawPlant } from './plants';
import { addSeed } from './rules';
import type { AppState, SeedItem } from './types';

/** Flowering tree northwest of the house, matching the requested screenshot. */
export const PIO_SEEDS = { x:820, y:1100, radius:84, count:3 } as const;
export function canFindPioSeeds(s:AppState,at:{x:number;y:number;indoor:boolean}):boolean {
  return !at.indoor && !exploration(s).pioSeedsFound && withinReach(at,PIO_SEEDS,PIO_SEEDS.radius);
}
/** Exploration gift only: no activity log, daily quota, packet or story advancement. */
export function findPioSeeds(s:AppState,at:{x:number;y:number;indoor:boolean},rand:()=>number=Math.random):SeedItem[] {
  if(!canFindPioSeeds(s,at))return [];
  const seeds=Array.from({length:PIO_SEEDS.count},()=>addSeed(s,drawPlant(rand).id));
  ensureExploration(s).pioSeedsFound=true;
  return seeds;
}
