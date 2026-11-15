import { WORLD_SIZE } from './worldGeometry';

/** Repainted regions share one stitched master and exact half-world boundaries. */
export const WORLD_TILES = [
  {id:'nw',x:0,y:0},
  {id:'ne',x:WORLD_SIZE.width/2,y:0},
  {id:'sw',x:0,y:WORLD_SIZE.height/2},
  {id:'se',x:WORLD_SIZE.width/2,y:WORLD_SIZE.height/2},
].map(tile=>({...tile,key:`garden_world_${tile.id}`,file:`world-boundaries-${tile.id}.webp`,width:WORLD_SIZE.width/2,height:WORLD_SIZE.height/2}));
