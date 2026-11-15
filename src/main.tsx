import Phaser from 'phaser';
import './styles/tokens.css';
import './styles/overlay.css';
import './styles/art.css';
import { GardenScene } from './scene/GardenScene';
import { setDayOffset } from './core/clock';
import { addTestSeeds } from './core/demo';
import { store } from './core/store';
import type { DecorItem } from './core/types';
import { nextDecorSlot } from './scene/map';
import { startFlow } from './ui/flow';
import { createRoot } from 'react-dom/client';
import { SessionGate } from './ui/SessionGate';
import { closeModal } from './ui/modal';
import { exitDecorate } from './ui/panels/Decorate';
import { installUiInputPriority } from './ui/inputPriority';

// 화면은 가로 844 고정, 세로는 창 비율에 맞춰 390(폰 가로)~563 사이에서 늘어난다.
// 그래서 컴퓨터 창에서도 위아래 검은 띠 없이 정원을 더 많이 보여준다. 너무 납작한 창은 양옆에 띠가 생긴다.
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

// 데모 모드에서 넘긴 날짜는 새로고침해도 유지된다.
setDayOffset(store.state.settings.demo ? store.state.settings.dayOffset : 0);

// 테스트용: 주소 끝에 ?decor 를 붙이면 꾸미기용 소품을 몇 개 넣어 준다(한 번만, 저장됨).
if (new URLSearchParams(location.search).has('decor') && !store.state.garden.items.some((i) => i.id.startsWith('test-'))) {
  const kinds: [DecorItem['kind'], number][] = [['flowerpot', 0], ['table', 0], ['bench', 0], ['shelf', 0], ['birdbath', 0], ['hammock', 0]];
  store.update((d) => {
    kinds.forEach(([kind, variant], i) => {
      const slot = nextDecorSlot(d.garden.items);
      if (slot) d.garden.items.push({ id: `test-${i + 1}`, kind, variant, ...slot });
    });
  });
}

// 테스트용: ?packet=3 처럼 붙이면 지난 며칠 치 씨앗 봉투를 받은 상태로 만들어 준다(이미 받은 날은 건드리지 않음).
const packetCount = Number(new URLSearchParams(location.search).get('packet') ?? (location.search.includes('packet') ? 3 : 0));
if (packetCount > 0) {
  store.update((d) => {
    for (let i = 1; i <= Math.min(packetCount, 12); i++) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const info = (d.days[key] ??= { refresh: 0 });
      info.packet ??= 'ready';
    }
  });
}

// 테스트용: ?fruit=20 처럼 붙이면 정원열매를 그 수로 맞춘다(상점 시연용).
const fruitParam = new URLSearchParams(location.search).get('fruit');
if (fruitParam !== null && Number.isFinite(Number(fruitParam))) {
  store.update((d) => {
    d.fruit = Math.max(0, Math.floor(Number(fruitParam)));
  });
}

// 테스트용: ?nostory 를 붙이면 프롤로그를 건너뛴다.
if (location.search.includes('nostory')) store.update((d) => { d.story.seen.push('intro', 'free-packet'); });

// 테스트용: ?seeds=5 처럼 붙이면 씨앗함에 씨앗을 넣어 준다.
const seedsParam = Number(new URLSearchParams(location.search).get('seeds'));
if (seedsParam > 0) store.update((d) => addTestSeeds(d, Math.min(seedsParam, 16)));

let game:Phaser.Game|null=null;
let flowStarted=false;
function setGameAccess(allowed:boolean):void {
  if(!allowed){
    closeModal(false);exitDecorate();
    if(game){game.canvas.style.visibility='hidden';game.input.enabled=false;game.scene.pause('garden');game.loop.sleep();}
    return;
  }
  if(!game){
    game=new Phaser.Game({type:Phaser.AUTO,width:W,height:H,parent:'game',pixelArt:true,backgroundColor:'#4d6d3a',scale:{mode:Phaser.Scale.NONE},scene:[GardenScene]});
    if(location.search.includes('debug'))(window as unknown as {__game:Phaser.Game}).__game=game;
  }else{
    game.loop.wake();game.input.enabled=true;game.scene.resume('garden');game.scene.getScene('garden').scene.restart();game.canvas.style.visibility='visible';
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
