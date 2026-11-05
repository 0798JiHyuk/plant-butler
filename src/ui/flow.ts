// 화면 사이의 흐름: 하루 첫 여력 체크 → 활동 고르기 → 했어요 → 회고 → 정원 변화.
import { todayKey } from '../core/clock';
import { copy } from '../core/copy';
import { events } from '../core/events';
import { harvest } from '../core/economy';
import { completePlan, isResting, limitReached, pendingPacketCount, pendingPacketDates } from '../core/rules';
import { factLineFor } from '../core/stats';
import { canHarvest } from '../core/economy';
import { markReturnSeen, needsIntro, nextSceneFor, returnScene, type NpcSpeaker, type StoryAfter } from '../core/story';
import { store } from '../core/store';
import type { ReflectChip } from '../core/types';
import { openActivityPanel } from './panels/ActivityPanel';
import { enterDecorate } from './panels/Decorate';
import { openBag } from './panels/Bag';
import { openPacketModal } from './panels/Packet';
import { openRecords } from './panels/Records';
import { openSettings } from './panels/Settings';
import { showCheckin } from './panels/Checkin';
import { openReflect } from './panels/Reflect';
import { openShop } from './panels/Shop';
import { openStory } from './panels/Story';
import { openTalk, talkActions } from './panels/Talk';
import { startSound } from './sound';
import { showToast } from './toast';

let justCompleted = false;

function complete(chips: ReflectChip[]): void {
  const date = todayKey();
  justCompleted = true; // 정원 변화 연출이 끝난 뒤에 주머니를 보여준다
  let result = null as ReturnType<typeof completePlan>;
  store.update((d) => {
    result = completePlan(d, date, chips);
  });
  if (!result) return;
  const { log } = result;
  const lines = [factLineFor(store.state.logs, log, date)];
  if (limitReached(store.state, date)) lines.push(copy.card.enough + '.');
  if (chips.length === 0) lines.push(copy.speak(copy.talk.npc.nuri.name, copy.lines.skipReflect));
  showToast(lines.filter(Boolean));
  events.emit('celebrate', { item: null });
}

function checkinIfNeeded(): void {
  if (!store.state.days[todayKey()]?.energy) showCheckin();
}

/** 꽃이 핀 식물에서 열매를 딴다. 나무는 자리에 남고, 꽃은 창고로 간다. */
function harvestPlant(id: string): void {
  let got = 0;
  store.update((d) => {
    got = harvest(d, id, todayKey());
  });
  if (got > 0) {
    const stayed = store.state.garden.plants.some((p) => p.id === id); // 나무는 자리에 남는다
    showToast([stayed ? copy.harvest.doneTree(got) : copy.harvest.done(got), copy.speak(copy.talk.npc.moru.name, copy.lines.harvested)]);
    events.emit('harvested', { id });
  }
}

/** 이야기 장면이 끝난 뒤 이어지는 화면. 패널끼리 직접 부르지 않도록 여기서만 연다. */
function runAfter(after: StoryAfter): void {
  const today = todayKey();
  if (after === 'packet') openPacketModal();
  else if (after === 'seeds') pendingPacketCount(store.state) > 0 ? openPacketModal() : openBag('seeds');
  else if (after === 'activity') openActivityPanel();
  else if (after === 'daily') openActivityPanel({ tab: 'daily' });
  else if (after === 'design') openActivityPanel({ tab: 'design' });
  else if (after === 'plan') openActivityPanel({ detail: true });
  else if (after === 'shop') openShop();
  else if (after === 'book') openRecords('book');
  else if (after === 'gift') openRecords('stamps');
  else if (after === 'harvest') {
    store.state.garden.plants.filter((p) => canHarvest(p, today, store.state.days)).forEach((p) => harvestPlant(p.id));
  }
}

/** 주민을 누르면: 열린 이야기 장면이 있으면 그 장면, 없으면 평소 대사(끝에 그 주민의 일로 이어짐). */
function meetNpc(id: NpcSpeaker): void {
  const scene = nextSceneFor(store.state, id, todayKey());
  if (scene) openStory(scene, (after) => after && runAfter(after));
  else openTalk(id);
}

/** 새 하루의 첫 진입(데모 모드의 [다음 날로] 뒤에도). 오랜만이면 복귀 장면을 먼저, 그다음 여력 체크. */
export function afterDayChange(): void {
  const today = todayKey();
  const scene = returnScene(store.state, today);
  if (!scene) return checkinIfNeeded();
  store.update((d) => markReturnSeen(d, today));
  openStory(scene, (after) => (after ? runAfter(after) : checkinIfNeeded()));
}

export function startFlow(): void {
  events.on('hud-action', ({ id }) => {
    if (id === 'talk') meetNpc('nuri');
    else if (id === 'shop') openShop();
    else if (id === 'gift') openRecords('stamps');
    else if (id === 'other-activity') openActivityPanel();
    else if (id === 'plan-check') openActivityPanel({ detail: true });
    else if (id === 'records') openRecords();
    else if (id === 'decorate') enterDecorate();
    else if (id === 'settings') openSettings();
    else if (id === 'packet') openPacketModal();
    else if (id === 'bag') openBag('seeds');
    else if (id === 'book') openRecords('book');
    else if (id === 'done') openReflect(complete);
  });
  // 주민을 누르면 그 주민과 대화하고, 대화 끝에 그 주민의 일로 이어진다.
  talkActions.nuri = () => openBag('seeds');
  talkActions.moru = openShop;
  talkActions.pio = () => openRecords('book');
  events.on('npc-talk', ({ id }) => meetNpc(id));
  // 꽃이 핀 식물을 누르면 열매를 한 번 딴다.
  events.on('plant-tap', ({ id }) => harvestPlant(id));
  // 쉬는 날이면 새싹이도 같이 쉰다. 마음이 바뀌면 다시 일어난다.
  let wasResting = isResting(store.state, todayKey());
  store.subscribe(() => {
    const resting = isResting(store.state, todayKey());
    if (resting !== wasResting) events.emit('sprout-pose', { pose: resting ? 'rest' : 'idle' });
    wasResting = resting;
  });
  // 봉투가 새로 도착하면(완료·쉬기 직후) 잠시 뒤에 알려준다. 못 열어도 우상단 버튼에 남는다.
  let pending = pendingPacketDates(store.state).length;
  store.subscribe(() => {
    const n = pendingPacketDates(store.state).length;
    if (n > pending) {
      window.setTimeout(openPacketModal, justCompleted ? 3400 : 800);
      justCompleted = false;
    }
    pending = n;
  });
  startSound();
  const begin = () => afterDayChange();
  if (needsIntro(store.state)) openStory('intro', (after) => (after === 'packet' ? openPacketModal() : begin()));
  else begin();
}
