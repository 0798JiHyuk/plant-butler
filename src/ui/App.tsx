import {useSocialLocation,socialLocation} from './socialLocation';
import {CafeControls} from './panels/Cafe';
import { openWorldMap } from './panels/WorldMap';
import { isModalOpen } from './modal';
import '../styles/storyMap.css';
import { Ambient } from './Ambient';
import { useAppState } from './useAppState';
// 정원 위에 겹치는 모든 화면의 뿌리. #ui 바로 아래에 이 요소들이 나란히 놓인다.
import { useEffect } from 'react';
import { SaveStatus } from './panels/Account';
import { DecorateBar } from './panels/Decorate';
import { Hud } from './Hud';
import { Joystick } from './Joystick';
import { ModalHost } from './modal';
import { Rotate } from './Rotate';
import { ToastHost } from './toast';
import { Zoom } from './Zoom';

export function App({ stage }: { stage: HTMLElement }) {
  useEffect(()=>{const key=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(e.key.toLowerCase()==='m'&&socialLocation()==='garden'&&!e.isComposing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!isModalOpen()&&!target.closest('input,textarea,select,[contenteditable=true]')){e.preventDefault();openWorldMap();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const location=useSocialLocation();
  const settings=useAppState().settings;
  useEffect(()=>{const ui=document.getElementById('ui');ui?.classList.toggle('ambient-folded',!!settings.folded);ui?.classList.toggle('reduced-motion',!!settings.reducedMotion);return()=>{ui?.classList.remove('ambient-folded','reduced-motion');};},[settings.folded,settings.reducedMotion]);
  return (
    <>
      {location==='garden'?<><Hud /><Ambient /><SaveStatus /><Zoom stage={stage} /><DecorateBar /></>:<CafeControls/>}
      <Joystick />
      <ModalHost />
      <ToastHost />
      <Rotate />
    </>
  );
}
