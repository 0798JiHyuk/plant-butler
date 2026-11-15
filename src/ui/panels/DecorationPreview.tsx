import { useState } from 'react';
import { copy } from '../../core/copy';
import { setDecorationGoal } from '../../core/decoration';
import type { ShopKind } from '../../core/economy';
import { PropImg } from '../icons';
import { closeModal, openModal } from '../modal';
import { saveProgress } from '../saveProgress';
import { showToast } from '../toast';
import { PanelHead } from './PanelHead';
function DecorationPreview({kind,onBack,onBuy}:{kind:ShopKind;onBack:()=>void;onBuy:()=>void}) {
  const [zone,setZone]=useState<'garden'|'home'>('home');
  const [point,setPoint]=useState({x:50,y:65});
  return <section className="panel preview-panel" role="dialog" aria-label={copy.map.preview}>
    <PanelHead title={copy.map.preview}/>
    <div className="btn-pair">{(['garden','home'] as const).map(id=><button className="btn-chip" aria-pressed={zone===id} key={id} onClick={()=>setZone(id)}>{copy.map[id]}</button>)}</div>
    <div className="preview-room">
      <img alt="" src={`${import.meta.env.BASE_URL}assets/garden/${zone==='home'?'home-interior.webp':'background.webp'}`}/>
      <button aria-label={copy.map.previewPosition} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setPoint({x:Math.max(15,Math.min(85,(e.clientX-r.left)/r.width*100)),y:Math.max(48,Math.min(83,(e.clientY-r.top)/r.height*100))});}}/>
      <span className="preview-prop" style={{left:`${point.x}%`,top:`${point.y}%`}}><PropImg kind={kind}/></span>
      <span className="preview-label">{copy.map.preview}</span>
    </div>
    <div className="btn-pair"><button className="btn btn-secondary" onClick={()=>{
      let ok=false;const col=Math.floor(point.x*1266/100/32),row=Math.floor(point.y*712/100/32)-1;
      if(saveProgress(s=>{ok=setDecorationGoal(s,kind,zone,col,row);})&&ok){showToast([copy.map.goalSaved]);onBack();}
    }}>{copy.map.goal}</button><button className="btn btn-primary" onClick={onBuy}>{copy.map.buy}</button></div>
    <button className="btn-chip" onClick={onBack}>{copy.map.cancelLayout}</button>
    <button className="btn-chip" onClick={()=>closeModal()}>{copy.map.close}</button>
  </section>;
}
export const openDecorationPreview=(kind:ShopKind,onBack:()=>void,onBuy:()=>void)=>openModal(<DecorationPreview kind={kind} onBack={onBack} onBuy={onBuy}/>);
