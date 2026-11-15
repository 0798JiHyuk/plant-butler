import { useEffect, useState } from 'react';
import { copy } from '../../core/copy';
import { events, type AppEvents } from '../../core/events';
import type { CafeMember } from '../../core/cafe';
import { auth } from '../../lib/auth';
import { gardenSharing, sharedGarden } from '../../lib/cafe';
import { closeModal, openModal } from '../modal';
import { useSocialLocation,socialGardenName } from '../socialLocation';
import { PanelHead } from './PanelHead';
import { openNarrative } from './Narrative';
import '../../styles/cafe.css';

function CafeEntry(){
  const location=useSocialLocation();
  const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(false),[loaded,setLoaded]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{let alive=true;setBusy(true);setError(false);void gardenSharing().then(value=>{if(alive){setEnabled(value);setLoaded(true);}},()=>{if(alive)setError(true);}).finally(()=>{if(alive)setBusy(false);});return()=>{alive=false;};},[attempt]);
  const toggle=async()=>{setBusy(true);setError(false);try{const value=await gardenSharing(!enabled);setEnabled(value);}catch{setError(true);}finally{setBusy(false);}};
  return <section className="panel cafe-panel" role="dialog" aria-label={copy.cafe.title}>
    <PanelHead title={copy.cafe.title}/><div className="cafe-panel-body">
      <p>{copy.cafe.intro}</p>
      <label className="cafe-sharing"><input type="checkbox" checked={enabled} disabled={busy||!loaded} onChange={()=>void toggle()}/>{copy.cafe.share}</label>
      <p className="cafe-note">{copy.cafe.shareNote}</p><p className="cafe-note">{copy.cafe.snapshot}</p>
      {error&&<p role="status">{copy.cafe.error}<button className="btn-chip" onClick={()=>setAttempt(n=>n+1)}>{copy.cafe.retry}</button></p>}
      <button className="btn btn-primary" disabled={busy||!loaded} onClick={()=>{closeModal();if(location!=='cafe')events.emit('social-travel',{destination:'cafe'});}}>{busy?copy.cafe.loading:location==='cafe'?copy.cafe.close:copy.cafe.enter}</button>
      <button className="btn btn-secondary" onClick={()=>openNarrative('ST-V01')}>{copy.cafe.story}</button>
    </div>
  </section>;
}
export const openCafe=()=>openModal(<CafeEntry/>);

function Person({member}:{member:CafeMember}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [owner]=useState(()=>auth.getSnapshot().userId);
  const [alive]=useState(()=>({current:true}));
  useEffect(()=>()=>{alive.current=false;},[alive]);
  const visit=async()=>{
    if(busy)return;setBusy(true);setMessage('');
    try{const garden=await sharedGarden(member.user_id);
      if(!alive.current||owner!==auth.getSnapshot().userId)return;
      if(!garden){setMessage(copy.cafe.unavailable);return;}
      closeModal();events.emit('social-travel',{destination:'visit',garden});
    }catch{if(alive.current)setMessage(copy.cafe.error);}finally{if(alive.current)setBusy(false);}
  };
  return <section className="panel cafe-panel" role="dialog" aria-label={member.garden_name}>
    <PanelHead title={member.garden_name}/><div className="cafe-panel-body">
      <p>{copy.cafe.snapshot}</p><button className="btn btn-primary" disabled={busy} onClick={()=>void visit()}>{busy?copy.cafe.loading:`${member.garden_name} ${copy.cafe.visit}`}</button>
      {message&&<p role="status">{message}</p>}
    </div>
  </section>;
}
export const openCafePerson=(member:CafeMember)=>openModal(<Person member={member}/>);

export function CafeControls(){
  const location=useSocialLocation();
  const [state,setState]=useState<AppEvents['cafe-state']>({status:'connecting',count:0,seated:false});
  useEffect(()=>events.on('cafe-state',setState),[]);
  const status=state.status==='online'?`${copy.cafe.online} ${state.count}`:state.status==='error'?copy.cafe.offline:state.status==='replaced'?copy.cafe.replaced:copy.cafe.connecting;
  return <div className="social-controls interactive">
    <div className="social-status" role="status">{location==='visit'?`${socialGardenName()} · ${copy.cafe.readonly}`:status}</div>
    <div className="social-actions">
      {location==='cafe'&&state.seated&&<button className="btn-chip" onClick={()=>events.emit('cafe-stand',{})}>{copy.cafe.stand}</button>}
      {location==='cafe'&&<button className="btn-chip" onClick={openCafe}>{copy.cafe.share}</button>}
      {location==='cafe'&&(state.status==='error'||state.status==='replaced')&&<button className="btn-chip" onClick={()=>events.emit('social-travel',{destination:'cafe'})}>{copy.cafe.retry}</button>}
      <button className="btn-chip" onClick={()=>{closeModal();events.emit('social-travel',{destination:location==='visit'?'cafe':'garden'});}}>{location==='visit'?copy.cafe.back:copy.cafe.leave}</button>
    </div>
  </div>;
}
