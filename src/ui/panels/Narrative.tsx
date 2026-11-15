import { ResidentDrawing, type AtlasView } from './ResidentMaps';
import type { LayerId } from '../../core/exploration';
import { SpeakerPortrait } from '../SpeakerPortrait';
import { guideToStory, useStoryGuidance, useWorldPosition } from '../worldPosition';
import { withinReach } from '../../core/interaction';
import { storyTarget } from '../../core/storyNavigation';
import { events } from '../../core/events';
import { activeMissionSession, closeMissionSession, reduceMission, restMissions } from '../../core/missions';
import { todayKey } from '../../core/clock';
import { useState } from 'react';
import { copy } from '../../core/copy';
import { ensureNarrative, narrative } from '../../core/exploration';
import { choiceReply, commitChoice, completeNameDecision, confirmLine, narrativeScenes, nextMain, sceneAvailable, sceneById, sceneChoices, sceneLines, type NarrativeChoice } from '../../core/narrative';
import { store } from '../../core/store';
import { enterNode, scenes } from '../../core/story';
import { closeModal, openModal } from '../modal';
import { saveProgress } from '../saveProgress';
import { useAppState } from '../useAppState';
import { PanelHead } from './PanelHead';

export type StoryAction = 'mission' | 'packet' | 'bag' | 'shop' | 'decorate' | 'map' | 'book' | 'sit' | 'return' | 'name' | 'preview' | 'gift' | 'harvest' | 'records';
export const narrativeLinks: { action?: (action: StoryAction) => void; showMap?:(view:AtlasView,preview?:LayerId,resume?:string)=>void; editMap?:()=>void } = {};
function actionFor(id: string): StoryAction | undefined {
  if(id==='r2-P01-C2')return 'mission';
  if(id==='P03-C1'||id==='R07-C1')return 'packet';
  if(id==='r2-B03-C1'||id==='R09-C3')return 'shop';
  if(id==='R09-C1'||id==='R09-C2')return 'preview';
  if(id==='R10-C1')return 'gift';
  if(id==='R06-C1')return 'harvest';
  if(id==='R01-C2'||id==='R04-C2'||id==='R04-C3')return 'records';
  if(id==='r2-B03-C3'||id==='r2-E01-C1')return 'decorate';
  if(id==='C03-C1'||id==='A03-C3'||id==='R08-C3'||id==='P03-C4')return 'book';
  if(id==='A02-C1')return 'packet';
  if(id==='A02-C2'||['R02-C1','R02-C2','R03-C1','R03-C2','R03-C3','R01-C3'].includes(id))return 'mission';
  if(id==='r2-V01-C3')return 'return';
  if(id==='A03-C1'||id==='R08-C1')return 'bag';
  return undefined;
}
function NameDecision({temporary=false}:{temporary?:boolean}) {
  const p=narrative(useAppState());
  const [name,setName]=useState(p.draftName??''),[error,setError]=useState(false);
  return <section className="panel" role="dialog" aria-label={copy.map.nameDraft}><PanelHead title={copy.map.nameDraft}/>
    <input aria-label={copy.world.nameLabel} value={name} maxLength={32} onChange={e=>setName(e.target.value)}/>
    {error&&<p>{copy.world.nameInvalid}</p>}
    <button className="btn btn-primary" onClick={()=>{
      if(!name.trim()||[...name.trim()].length>16){setError(true);return;}
      if(saveProgress(s=>{if(temporary)ensureNarrative(s).draftName=name.trim();else completeNameDecision(s,name);}))closeModal();
    }}>{copy.map.nameConfirm}</button>
    {!temporary&&<button className="btn btn-secondary" onClick={()=>{if(saveProgress(s=>{completeNameDecision(s,null);}))closeModal();}}>{copy.map.emptyName}</button>}
    <button className="btn btn-secondary" onClick={()=>closeModal()}>{copy.map.namePending}</button>
  </section>;
}
function Narrative({id}:{id:string}) {
  const s=useAppState(), scene=sceneById(id), p=narrative(s), lines=sceneLines(s,scene);
  const [index,setIndex]=useState(p.completed.includes(id)?0:Math.min(p.cursors[id]??0,lines.length));
  const [pending,setPending]=useState<NarrativeChoice|null>(null);
  const finish=(choice:NarrativeChoice)=>{
    let ok=false;
    if(!saveProgress(s=>{
      ok=commitChoice(s,id,choice.id);if(!ok)return;
      if(choice.id==='A02-C1'){const active=activeMissionSession(s);if(active)closeMissionSession(s,todayKey(),active.sessionId);}
      if(choice.id==='A02-C3'||choice.id==='R03-C4')restMissions(s,todayKey());
      if(choice.id==='R02-C1')reduceMission(s,todayKey(),true);
      if(choice.id==='R02-C4'){if(s.missions)s.missions.execution=null;if(s.days[todayKey()])delete s.days[todayKey()].plan;}
    })||!ok)return;
    if(choice.id==='r2-D01-C1'){narrativeLinks.editMap?.();return;}
    if(choice.id==='r2-P02-C2'){openModal(<NameDecision temporary/>);return;}
    if(choice.id==='P03-C0'){
      if(!saveProgress(s=>enterNode(s,scenes.intro.nodes['p03-3'])))return;
      setPending(null);setIndex(0);return;
    }
    closeModal();
    if(choice.id==='r2-D01-C2'||choice.id==='r2-D01-C3'){narrativeLinks.showMap?.(choice.id==='r2-D01-C2'?'together':'blank');return;}
    const action=actionFor(choice.id);if(action)narrativeLinks.action?.(action);
  };
  const mapView:LayerId|undefined=id==='ST-A01'?'nuri':id==='ST-B01'?'moru':id==='ST-C01'?'pio':undefined;
  const reply=pending?choiceReply(s,scene,pending):undefined;
  return <section className="panel narrative-panel" role="dialog" aria-label={scene.title}>
    <PanelHead title={scene.title}/>
    {id==='ST-E01'&&<p className="panel-note">{copy.map.currentChoice} · {p.decision==='own'?(p.mapName===undefined?s.garden.name:p.mapName)||copy.map.ownMap:p.decision==='together'?copy.map.togetherMaps:copy.map.blankMap}</p>}
    {mapView&&index<lines.length&&<button className="resident-map-peek" aria-label={copy.atlas.open} onClick={()=>narrativeLinks.showMap?.(mapView,mapView,id)}><ResidentDrawing view={mapView}/><span>{copy.atlas.open}</span></button>}
    {index<lines.length?<><SpeakerPortrait name={lines[index].speaker}/><p className="narrative-text">{lines[index].text}</p><button className="btn btn-primary" onClick={()=>{if(saveProgress(s=>confirmLine(s,id,index)))setIndex(index+1);}}>{copy.map.next}</button></>
      :pending?<>{reply&&<SpeakerPortrait name={reply.speaker}/>}<p className="narrative-text">{reply?.text}</p><button className="btn btn-primary" onClick={()=>finish(pending)}>{copy.map.continue}</button></>
      :<div className="narrative-choices">{sceneChoices(s,scene).map(c=><button className="btn btn-secondary" key={c.id} onClick={()=>choiceReply(s,scene,c)?setPending(c):finish(c)}>{c.text}</button>)}</div>}
    <button className="btn-chip" onClick={()=>closeModal()}>{copy.map.later}</button>
  </section>;
}
export function openNarrative(id:string):void {
  if(!sceneAvailable(store.state,id))return;
  openModal(<Narrative id={id}/>);
}
export function NarrativeNotebook() {
  const s=useAppState(),p=narrative(s);
  return <div className="narrative-list">{narrativeScenes.filter(x=>sceneAvailable(s,x.id)).map(scene=><button key={scene.id} className="btn btn-secondary" onClick={()=>openNarrative(scene.id)}>{scene.title}<small>{p.completed.includes(scene.id)?copy.map.replay:(p.cursors[scene.id]??0)>0?copy.map.resume:copy.map.storyReady}</small></button>)}</div>;
}
export function openNarrativeNotebook():void {
  openModal(<section className="panel" role="dialog" aria-label={copy.map.story}><PanelHead title={copy.map.story}/><NarrativeNotebook/></section>);
}
export function StoryHint() {
  const s=useAppState(),id=nextMain(s),target=storyTarget(s),pos=useWorldPosition(),guiding=useStoryGuidance();
  if(!id||!target)return null;
  const near=!pos.indoor&&withinReach(pos,target.point);
  const text=id==='ST-P01'?copy.map.greetingQuestion:id==='ST-P02'?copy.map.startQuestion:id==='ST-A01'?copy.map.nuriQuestion:id==='ST-B01'?copy.map.moruQuestion:id==='ST-C01'?copy.map.pioQuestion:id==='ST-D01'?copy.map.boardQuestion:sceneById(id).title;
  return <button className="story-hint interactive" onClick={()=>{
    if(near){if(target.label==='board')events.emit('world-interact',{id:'board'});else if(target.npc)events.emit('npc-talk',{id:target.npc});else openNarrative(id);}
    else {guideToStory(!guiding);if(!guiding)narrativeLinks.action?.('map');}
  }}>{target.npc&&<img src={`${import.meta.env.BASE_URL}assets/garden/npc/${target.npc}_front.png`} alt=""/>}<span>{text}<small>{near?copy.map.inspect:guiding?copy.map.guiding:copy.map.showOnMap}</small></span></button>;
}
