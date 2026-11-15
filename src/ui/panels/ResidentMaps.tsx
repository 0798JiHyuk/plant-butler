import { useState } from 'react';
import { copy } from '../../core/copy';
import { MAP_PLACES, MAP_SYMBOLS, markPlace, type GardenMark, type MapPlace, type MapSymbol } from '../../core/gardenAtlas';
import { LAYER_FACTS, narrative, type LayerId } from '../../core/exploration';
import { completeNameDecision } from '../../core/narrative';
import { store } from '../../core/store';
import { WORLD_SIZE } from '../../core/worldGeometry';
import { WORLD_TILES } from '../../core/worldTiles';
import { NuriTerrain,MoruTerrain,PioTerrain } from './ResidentTerrain';
import { closeModal, openModal } from '../modal';
import { saveProgress } from '../saveProgress';
import { useAppState } from '../useAppState';
import { PanelHead } from './PanelHead';

export type AtlasView=LayerId|'together'|'mine'|'blank';
export const atlasLinks:{resume?:(id:string)=>void}={};
const glyph:Record<MapSymbol,string>={leaf:'❧',stone:'●',arrow:'➜',sound:'♪',quiet:'◌'};
export function ResidentDrawing({view,marks=[],selected,onPlace}:{view:AtlasView;marks?:GardenMark[];selected?:MapPlace;onPlace?:(place:MapPlace)=>void}) {
  const show=(id:LayerId)=>view===id||view==='together';
  return <svg className="resident-drawing" viewBox={`0 0 ${WORLD_SIZE.width} ${WORLD_SIZE.height}`} role="img" aria-label={copy.atlas[view]}>
    <rect width={WORLD_SIZE.width} height={WORLD_SIZE.height} rx="85" fill="#f4e8c8"/>
    <rect x="65" y="65" width={WORLD_SIZE.width-130} height={WORLD_SIZE.height-130} rx="65" fill="none" stroke="#c8b584" strokeWidth="10"/>
    {(view==='mine'||view==='blank')&&WORLD_TILES.map(tile=><image key={tile.id} href={`${import.meta.env.BASE_URL}assets/garden/${tile.file}`} x={tile.x} y={tile.y} width={tile.width} height={tile.height}/>)}
    {show('pio')&&<PioTerrain/>}
    {show('moru')&&<MoruTerrain/>}
    {show('nuri')&&<NuriTerrain/>}
    {view==='mine'&&marks.map(mark=><g key={mark.place}><circle cx={MAP_PLACES[mark.place].x} cy={MAP_PLACES[mark.place].y} r="80" fill="#fff4d2" stroke="#9e7750" strokeWidth="8"/><text x={MAP_PLACES[mark.place].x} y={MAP_PLACES[mark.place].y+32} textAnchor="middle" fontSize="100" fill="#5b7751">{glyph[mark.symbol]}</text></g>)}
    {onPlace&&(Object.keys(MAP_PLACES) as MapPlace[]).map(place=><circle key={place} cx={MAP_PLACES[place].x} cy={MAP_PLACES[place].y} r="85" fill={selected===place?'#e5c77e':'transparent'} fillOpacity=".15" stroke="#816b40" strokeWidth="10" onClick={()=>onPlace(place)}/>)}
  </svg>;
}
function ResidentMaps({initial,preview}:{initial:AtlasView;preview?:LayerId}) {
  const s=useAppState(),p=narrative(s),[view,setView]=useState<AtlasView>(initial);
  const available=(['nuri','moru','pio'] as LayerId[]).filter(id=>p.facts.includes(LAYER_FACTS[id])||preview===id);
  const views:AtlasView[]=[...available];if(available.length===3&&p.facts.includes('slotSeen'))views.push('together');if(p.decision==='own')views.push('mine');if(!views.includes(initial))views.push(initial);
  const note=copy.atlas[`${view}Note`];
  return <section className="panel resident-maps" role="dialog" aria-label={copy.atlas.title}>
    <PanelHead title={copy.atlas.title}/>
    <div className="atlas-content"><div className="atlas-sheet"><ResidentDrawing view={view} marks={p.marks}/>{view==='mine'&&<strong className="atlas-name">{p.mapName??s.garden.name??''}</strong>}</div><div className="atlas-side"><div className="atlas-tabs" role="tablist">{views.map(id=><button className="btn-chip" key={id} role="tab" aria-selected={id===view} onClick={()=>setView(id)}>{copy.atlas[id]}</button>)}</div>
    <p className="atlas-note">{note}</p>{p.facts.includes('slotSeen')&&<button className="btn-chip atlas-edit-link" onClick={openGardenMapEditor}>{copy.atlas.edit}</button>}</div></div>
  </section>;
}
export function openResidentMaps(initial:AtlasView='blank',preview?:LayerId,resumeScene?:string):void {
  openModal(<ResidentMaps initial={initial} preview={preview}/>,true,resumeScene?()=>atlasLinks.resume?.(resumeScene):undefined);
}
function GardenMapEditor() {
  const s=useAppState(),p=narrative(s);
  const [name,setName]=useState(p.mapName??p.draftName??(p.decision==='own'?s.garden.name??'':''));
  const [marks,setMarks]=useState<GardenMark[]>(p.marks??[]),[place,setPlace]=useState<MapPlace>('tree'),[error,setError]=useState(false);
  return <section className="panel map-editor" role="dialog" aria-label={copy.atlas.edit}>
    <PanelHead title={copy.atlas.edit}/><div className="map-editor-body"><div className="atlas-sheet"><ResidentDrawing view="mine" marks={marks} selected={place} onPlace={setPlace}/></div>
      <div className="map-editor-tools"><label>{copy.atlas.name}<input className="text-input" value={name} maxLength={32} placeholder={copy.atlas.nameHint} onChange={e=>setName(e.target.value)}/></label>
        <p>{copy.atlas.markHint}</p><select aria-label={copy.atlas.markHint} value={place} onChange={e=>setPlace(e.target.value as MapPlace)}>{(Object.keys(MAP_PLACES) as MapPlace[]).map(id=><option key={id} value={id}>{copy.atlas.place[id]}</option>)}</select>
        <div className="map-symbols">{MAP_SYMBOLS.map(symbol=><button className="btn-chip" key={symbol} aria-pressed={marks.some(x=>x.place===place&&x.symbol===symbol)} onClick={()=>setMarks(markPlace(marks,place,symbol))}>{glyph[symbol]} {copy.atlas.symbol[symbol]}</button>)}<button className="btn-chip" onClick={()=>setMarks(markPlace(marks,place))}>{copy.atlas.remove}</button></div>
      </div></div>
    {error&&<p className="panel-note">{copy.atlas.invalid}</p>}
    <div className="btn-pair"><button className="btn btn-primary" onClick={()=>{let ok=false;if(saveProgress(s=>{ok=completeNameDecision(s,name,marks);})&&ok){closeModal();openResidentMaps('mine');}else setError(true);}}>{copy.atlas.save}</button>
      <button className="btn btn-secondary" onClick={()=>{if(saveProgress(s=>{completeNameDecision(s,null);}))closeModal();}}>{copy.atlas.empty}</button>
      <button className="btn-chip" onClick={()=>closeModal()}>{copy.atlas.cancel}</button></div>
  </section>;
}
export const openGardenMapEditor=()=>{if(narrative(store.state).facts.includes('slotSeen'))openModal(<GardenMapEditor/>);};
