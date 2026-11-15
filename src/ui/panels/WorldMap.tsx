import { openResidentMaps } from './ResidentMaps';
import { useState } from 'react';
import { store } from '../../core/store';
import { copy } from '../../core/copy';
import { bookmark, chooseDestination, chooseFrontier, frontierOptions, ensureExploration, exploration, LAYER_FACTS, narrative, route, ZONES, type ZoneId, type LayerId } from '../../core/exploration';
import { compassDirection, LANDMARKS, nextRoadPoint, worldRoute, WORLD_SIZE, GARDEN_ORIGIN, CAFE_BENCH, type WorldPoint } from '../../core/worldGeometry';
import { storyTarget } from '../../core/storyNavigation';
import { openModal } from '../modal';
import { useAppState } from '../useAppState';
import { currentZone, guideToStory, useStoryGuidance, useWorldPosition } from '../worldPosition';
import { saveProgress } from '../saveProgress';
import { showToast } from '../toast';
import { PanelHead } from './PanelHead';
import { WORLD_TILES } from '../../core/worldTiles';
import { ExplorationFog } from './ExplorationFog';

const asset=(name:string)=>`${import.meta.env.BASE_URL}assets/garden/${name}`;
const pathD=(points:readonly WorldPoint[])=>points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
export function MapDrawing({ mini=false }: {mini?:boolean}) {
  const s=useAppState(),p=exploration(s),pos=useWorldPosition(),guiding=useStoryGuidance();
  const here=pos.indoor?LANDMARKS.home:pos;
  const target=guiding?storyTarget(s):undefined;
  const known=p.discovered;
  const visiblePoints=known.filter(id=>ZONES[id].enabled).map(id=>({x:ZONES[id].worldX,y:ZONES[id].worldY}));
  visiblePoints.push(LANDMARKS.home,{x:GARDEN_ORIGIN.x,y:GARDEN_ORIGIN.y},{x:GARDEN_ORIGIN.x+GARDEN_ORIGIN.width,y:GARDEN_ORIGIN.y+GARDEN_ORIGIN.height});
  const left=Math.max(0,Math.min(...visiblePoints.map(p=>p.x))-220),top=Math.max(0,Math.min(...visiblePoints.map(p=>p.y))-650);
  const width=Math.min(WORLD_SIZE.width-left,Math.max(...visiblePoints.map(p=>p.x))-left+280),height=Math.min(WORLD_SIZE.height-top,Math.max(...visiblePoints.map(p=>p.y))-top+150);
  const view=mini?`${Math.max(0,Math.min(WORLD_SIZE.width-760,here.x-380))} ${Math.max(0,Math.min(WORLD_SIZE.height-540,here.y-270))} 760 540`:`${left} ${top} ${width} ${height}`;
  const activeRoute=p.destination?worldRoute(route(currentZone(),p.destination)):[];
  return <svg viewBox={view} className="world-map-svg" role="img" aria-label={copy.map.title}>
    <g>
      {WORLD_TILES.map(tile=><image key={tile.id} href={asset(tile.file)} x={tile.x} y={tile.y} width={tile.width} height={tile.height} preserveAspectRatio="none"/>)}
      {known.includes('cafe')&&<image href={asset('props/bench.png')} x={CAFE_BENCH.x-96} y={CAFE_BENCH.y-128} width="192" height="128"/>}
      {activeRoute.length>0&&<><path d={pathD(activeRoute)} stroke="#fff1be" strokeWidth="18" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d={pathD(activeRoute)} stroke="#496c3b" strokeWidth="8" strokeDasharray="12 13" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>}
    </g>
    <ExplorationFog known={known} here={here}/>
    {!mini&&(Object.keys(ZONES) as ZoneId[]).filter(id=>ZONES[id].enabled&&(known.includes(id)||id==='home')).map(id=><g key={id}><rect x={ZONES[id].worldX-180} y={ZONES[id].worldY+18} width="360" height="100" rx="24" fill="#fff4d9" stroke="#a58b5b" strokeWidth="2"/><text x={ZONES[id].worldX} y={ZONES[id].worldY+90} textAnchor="middle" fontSize="64" fill="#4c5035">{copy.map[id]}</text></g>)}
    {!mini&&<text x={LANDMARKS.board.x} y={LANDMARKS.board.y-85} textAnchor="middle" fontSize="60" fill="#3a4d2d" stroke="#fff8df" strokeWidth="5" paintOrder="stroke">{copy.map.board}</text>}
    {p.bookmarks.filter(id=>ZONES[id].enabled&&known.includes(id)).map(id=><path key={id} d={`M${ZONES[id].worldX+50} ${ZONES[id].worldY-15}v-42h28v35l-14-9-14 9`} fill="#b87c40" stroke="#fff5d4" strokeWidth="3"/>)}
    {target&&<g><circle cx={target.point.x} cy={target.point.y-25} r={mini?30:42} fill="#fff0b8" stroke="#8a6535" strokeWidth="4"/>{target.npc?<image href={asset(`npc/${target.npc}_front.png`)} x={target.point.x-40} y={target.point.y-78} width="80" height="80"/>:<path d={`M${target.point.x} ${target.point.y-45}v25m0 8v4`} stroke="#825e30" strokeWidth="8" strokeLinecap="round"/>}</g>}
    <circle cx={here.x} cy={here.y} r={mini?29:50} fill="#fff8d6" opacity=".92"/>
    <path d={`M${here.x} ${here.y-25}l-17 39 17-9 17 9Z`} fill="#355d39" stroke="#fffdf0" strokeWidth="4"/>
  </svg>;
}
function WorldMap() {
  const s=useAppState(),p=exploration(s),facts=narrative(s).facts;
  const [future,setFuture]=useState(false),[selected,setSelected]=useState<ZoneId|null>(null);
  const from=currentZone(),path=p.destination?route(from,p.destination):[];
  const target=storyTarget(s);
  const layers=(['nuri','moru','pio'] as LayerId[]).filter(id=>facts.includes(LAYER_FACTS[id]));
  const setDestination=(id:ZoneId)=>{guideToStory(false);if(saveProgress(s=>{chooseDestination(s,id);}))showToast([copy.map.marked]);};
  return <section className="panel world-map-panel" role="dialog" aria-label={copy.map.title}>
    <PanelHead title={copy.map.title}/>
    <div className="map-body"><div className="map-paper"><MapDrawing/></div><div className="map-controls">
      <p className="map-current" role="status">{copy.map.here} · {copy.map[from]}</p>
      {target&&<button className="map-story-guide" onClick={()=>guideToStory(true)}>{target.npc&&<img src={asset(`npc/${target.npc}_front.png`)} alt=""/>}<span>{copy.map.nextClue}<strong>{target.npc?copy.talk.npc[target.npc].name:copy.map[target.label]}</strong></span></button>}
      <div className="map-place-list">{p.discovered.filter(id=>id!=='junction'&&ZONES[id].enabled).map(id=><button key={id} className="btn-chip" aria-pressed={selected===id} onClick={()=>setSelected(id)}>{copy.map[id]}</button>)}</div>
      {selected&&<><p>{copy.map.purpose[selected]}</p><div className="btn-pair"><button className="btn-chip" onClick={()=>setDestination(selected)}>{copy.map.destination}</button><button className="btn-chip" onClick={()=>saveProgress(s=>{if(exploration(s).bookmarks.includes(selected))ensureExploration(s).bookmarks=exploration(s).bookmarks.filter(x=>x!==selected);else bookmark(s,selected);})}>{p.bookmarks.includes(selected)?copy.map.forget:copy.map.remember}</button></div></>}
      {frontierOptions(s).map((id,i)=><button key={id} className="btn-chip" onClick={()=>{guideToStory(false);saveProgress(s=>{chooseFrontier(s,id);});}}>{copy.map.frontier} {i+1}</button>)}
      {from!=='garden'&&<button className="btn-chip" onClick={()=>setDestination('garden')}>{copy.map.return}</button>}
      {p.destination&&<button className="btn-chip" onClick={()=>saveProgress(s=>{delete ensureExploration(s).destination;})}>{copy.map.clear}</button>}
      {path.length>1&&<p>{path.map(id=>p.discovered.includes(id)?copy.map[id]:copy.map.frontier).join(' → ')}</p>}
      {layers.length>0&&<button className="btn-chip" onClick={()=>openResidentMaps(narrative(s).decision==='together'?'together':narrative(s).decision==='own'?'mine':layers[0])}>{copy.atlas.open}</button>}
      {(Object.keys(ZONES) as ZoneId[]).some(id=>!ZONES[id].enabled)&&<label className="map-future"><input type="checkbox" checked={future} onChange={e=>setFuture(e.target.checked)}/>{copy.map.future}</label>}
      {future&&<p>{copy.map.school} · {copy.map.work} — {copy.map.preparing}</p>}
    </div></div>
  </section>;
}
export function openWorldMap():void {
  const p=exploration(store.state);
  if(p.destination&&!route(currentZone(),p.destination).length){saveProgress(s=>{delete ensureExploration(s).destination;});showToast([copy.map.noRoute]);}
  const active=document.activeElement as HTMLElement|null;
  const focus=active&&active!==document.body&&!active.closest('.modal-layer')?active:document.querySelector<HTMLElement>('.mini-map-open');
  openModal(<WorldMap/>,true,()=>requestAnimationFrame(()=>{if(focus?.isConnected)focus.focus();}));
}
export function MiniMap() {
  const s=useAppState(),pos=useWorldPosition(),guiding=useStoryGuidance();
  const p=exploration(s),zone=currentZone(),target=guiding?storyTarget(s):undefined;
  const road=p.destination?worldRoute(route(zone,p.destination)):[];
  const next=target?.point??nextRoadPoint(pos,road);
  const direction=next?copy.map.direction[compassDirection(pos,next)]:undefined;
  return <aside className="mini-map interactive" aria-label={copy.map.title}>
    <button className="mini-map-open" onClick={openWorldMap}><MapDrawing mini/><span>{copy.map.open}</span></button>
    <span className="map-location" role="status">{copy.map.here} · {copy.map[pos.indoor?'home':zone]}</span>
    {next&&<span className="map-direction">{pos.indoor?copy.map.insideHome:Math.hypot(pos.x-next.x,pos.y-next.y)<70?copy.map.arrived:direction}</span>}
  </aside>;
}
