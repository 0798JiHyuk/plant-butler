import { zoneAt } from '../core/exploration';
import { auth } from '../lib/auth';
// 효과음. 파일 없이 브라우저에서 짧은 음을 합성한다. 진짜 소리가 오면 play()만 바꾸면 된다.
import { events } from '../core/events';
import { store } from '../core/store';

type Note = [freq: number, at: number, length: number];

const SOUNDS: Record<string, Note[]> = {
  tap: [[520, 0, 0.05]],
  open: [[392, 0, 0.1], [523, 0.09, 0.14]],
  plant: [[294, 0, 0.09], [392, 0.08, 0.12]],
  harvest: [[523, 0, 0.09], [659, 0.08, 0.09], [784, 0.16, 0.16]],
  buy: [[440, 0, 0.08], [587, 0.08, 0.14]],
  gift: [[587, 0, 0.1], [740, 0.09, 0.1], [880, 0.18, 0.18]],
};

let ctx: AudioContext | null = null;
let ambient: AudioBufferSourceNode | null = null;
let ambientGain: GainNode | null = null;
let location = 'garden';
function updateAmbient():void {
  if(!ctx)return;
  const on=auth.getSnapshot().status==='connected' && store.state.settings.sound && location==='cafe' && document.visibilityState==='visible';
  if(!on){ambient?.stop();ambient=null;ambientGain=null;return;}
  if(ambient)return;
  const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);
  let previous=0;
  for(let i=0;i<data.length;i++){previous=(previous+Math.random()*.04-.02)/1.02;data[i]=previous;}
  ambient=ctx.createBufferSource();ambient.buffer=buffer;ambient.loop=true;
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=900;
  ambientGain=ctx.createGain();ambientGain.gain.value=.12;
  ambient.connect(filter).connect(ambientGain).connect(ctx.destination);ambient.start();
}


function play(name: string): void {
  if (auth.getSnapshot().status!=='connected' || !store.state.settings.sound || !ctx) return;
  const now = ctx.currentTime;
  for (const [freq, at, length] of SOUNDS[name]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.07, now + at + 0.012); // 재촉하는 느낌이 없게 작고 부드럽게
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + length + 0.02);
  }
}

export function startSound(): void {
  // 브라우저는 사용자가 누른 뒤에만 소리를 허락한다.
  document.addEventListener('pointerdown', (e) => {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if ((e.target as HTMLElement).closest?.('button')) play('tap');
    updateAmbient();
  });
  store.subscribe(updateAmbient);
  auth.subscribe(updateAmbient);
  document.addEventListener('visibilitychange',updateAmbient);
  events.on('world-position',p=>{const next=zoneAt(p.x,p.y,p.indoor)==='cafe'?'cafe':'garden';if(next!==location){location=next;updateAmbient();}});
  events.on('sfx', ({ name }) => play(name));
  events.on('harvested', () => play('harvest'));
  events.on('plant-grown', () => play('plant'));
}
