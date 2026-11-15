import { exploration } from '../../core/exploration';
import { WORLD_SIZE,LANDMARKS } from '../../core/worldGeometry';
import { useAppState } from '../useAppState';
import { useWorldPosition } from '../worldPosition';
import { ExplorationFog } from './ExplorationFog';

const asset=(name:string)=>`${import.meta.env.BASE_URL}assets/garden/${name}`;
/** Fresh raster illustrations aligned to the existing map's landmark positions. */
export function NuriTerrain(){
  return <g className="atlas-nuri"><image href={asset('resident-nuri-painted.webp')} width={WORLD_SIZE.width} height={WORLD_SIZE.height} preserveAspectRatio="none"/></g>;
}
export function MoruTerrain(){
  return <g className="atlas-moru"><image href={asset('resident-moru-painted.webp')} width={WORLD_SIZE.width} height={WORLD_SIZE.height} preserveAspectRatio="none"/></g>;
}
export function PioTerrain(){
  const s=useAppState(),pos=useWorldPosition();
  return <g className="atlas-pio"><ExplorationFog known={exploration(s).discovered} here={pos.indoor?LANDMARKS.home:pos}/></g>;
}
