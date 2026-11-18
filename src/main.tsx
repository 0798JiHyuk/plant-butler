import {captureAcquisition} from './lib/events';
import {SocialScene} from './scene/SocialScene';
import {PlaceScene} from './scene/PlaceScene';
import Phaser from 'phaser';
import './styles/tokens.css';
import './styles/overlay.css';
import './styles/art.css';
import { GardenScene } from './scene/GardenScene';
import { startFlow } from './ui/flow';
import { createRoot } from 'react-dom/client';
import { SessionGate } from './ui/SessionGate';
import { closeModal } from './ui/modal';
import { exitDecorate } from './ui/panels/Decorate';
import { installUiInputPriority } from './ui/inputPriority';

// 화면은 가로 844 고정, 세로는 창 비율에 맞춰 390(폰 가로)~563 사이에서 늘어난다.
// 그래서 컴퓨터 창에서도 위아래 검은 띠 없이 정원을 더 많이 보여준다. 너무 납작한 창은 양옆에 띠가 생긴다.
captureAcquisition();
const W = 844;
const H_MIN = 390;
const H_MAX = 563;

const stage = document.getElementById('stage')!;
/** 창 크기에 맞춰 무대 높이와 배율을 정하고, 높이를 돌려준다. */
function layout(): number {
  const h = Math.min(H_MAX, Math.max(H_MIN, Math.round((W * window.innerHeight) / window.innerWidth)));
  const s = Math.min(window.innerWidth / W, window.innerHeight / h);
  stage.style.setProperty('--stage-h', `${h}px`);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  return h;
}
const H = layout();

let game:Phaser.Game|null=null;
let flowStarted=false;
function setGameAccess(allowed:boolean):void {
  if(!allowed){
    closeModal(false);exitDecorate();
    if(game){game.canvas.style.visibility='hidden';game.input.enabled=false;game.scene.stop('social');game.scene.stop('place');game.scene.stop('garden');game.loop.sleep();}
    return;
  }
  if(!game){
    game=new Phaser.Game({type:Phaser.AUTO,width:W,height:H,parent:'game',pixelArt:true,backgroundColor:'#4d6d3a',scale:{mode:Phaser.Scale.NONE},scene:[GardenScene,SocialScene,PlaceScene]});
    if(import.meta.env.DEV&&new URLSearchParams(location.search).has('debug'))(window as unknown as {__game:Phaser.Game}).__game=game;
  }else{
    game.loop.wake();game.input.enabled=true;game.scene.stop('social');game.scene.stop('place');game.scene.start('garden');game.canvas.style.visibility='visible';
  }
  if(!flowStarted){flowStarted=true;startFlow();}
}
const uiRoot=document.getElementById('ui')!;
const removeUiInputPriority=installUiInputPriority(uiRoot);
if(import.meta.hot)import.meta.hot.dispose(removeUiInputPriority);
createRoot(uiRoot).render(<SessionGate stage={stage} onAccessChange={setGameAccess}/>);

// 화면 배율이 바뀌면 Phaser가 포인터 좌표를 다시 계산하도록 알려준다(꾸미기 드래그가 정확해진다).
window.addEventListener('resize', () => {
  const h = layout();
  if (game) {if(h!==game.scale.height)game.scale.resize(W,h);game.scale.refresh();}
});
