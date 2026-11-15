import { copy } from '../core/copy';
import { exploration } from '../core/exploration';
import { events } from '../core/events';
import { useAppState } from './useAppState';
import { saveProgress } from './saveProgress';
import { openWorldMap } from './panels/WorldMap';

export function Ambient() {
  const s=useAppState(),folded=!!s.settings.folded,seat=exploration(s).seat;
  if(!folded&&!seat)return null;
  return <div className={`ambient-controls interactive${folded?' folded':''}`}>
    {folded&&<button className="btn-chip" onClick={openWorldMap}>{copy.map.open}</button>}
    {seat&&<button className="btn-chip" onClick={()=>events.emit('seat-change',{id:null})}>{copy.map.stand}</button>}
    {folded&&<button className="btn-chip" onClick={()=>saveProgress(s=>{s.settings.folded=false;})}>{copy.map.unfold}</button>}
  </div>;
}
