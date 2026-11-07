// 화면 사이의 흐름: 하루 첫 여력 체크 → 활동 고르기 → 했어요 → 회고 → 정원 변화.
import { setDayOffset, todayKey } from '../core/clock';
import { copy } from '../core/copy';
import { events } from '../core/events';
import { harvest } from '../core/economy';
import { completePlan, isResting, limitReached, pendingPacketDates } from '../core/rules';
import { factLineFor } from '../core/stats';
import { needsIntro } from '../core/story';
import { store } from '../core/store';
import type { ReflectChip } from '../core/types';
import { openActivityPanel } from './panels/ActivityPanel';
import { enterDecorate, exitDecorate } from './panels/Decorate';
import { openBag } from './panels/Bag';
import { openPacketModal } from './panels/Packet';
import { openRecords } from './panels/Records';
import { openSettings } from './panels/Settings';
import { openAccount } from './panels/Account';
import { showCheckin } from './panels/Checkin';
import { openReflect } from './panels/Reflect';
import { openShop } from './panels/Shop';
import { openStory } from './panels/Story';
import { openTalk, talkActions } from './panels/Talk';
import { startSound } from './sound';
import { showToast } from './toast';
import { closeModal, isModalOpen } from './modal';
import { photoPolicy } from '../core/photoCheck';
import { stateKey } from '../core/state';
import { openPhotoCheck } from './panels/PhotoCheck';

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

/** 데모 모드에서 날짜를 넘긴 뒤: 새 하루의 첫 진입처럼 여력 체크부터 다시. */
export function afterDayChange(): void {
  if (!store.state.days[todayKey()]?.energy) showCheckin();
}

export function startFlow(): void {
  events.on('hud-action', ({ id }) => {
    if (id === 'talk') openTalk('nuri');
    else if (id === 'shop') openShop();
    else if (id === 'gift') openRecords('stamps');
    else if (id === 'other-activity') openActivityPanel();
    else if (id === 'plan-check') openActivityPanel({ detail: true });
    else if (id === 'records') openRecords();
    else if (id === 'decorate') enterDecorate();
    else if (id === 'settings') openSettings(openAccount);
    else if (id === 'packet') openPacketModal();
    else if (id === 'bag') openBag('seeds');
    else if (id === 'book') openRecords('book');
    else if (id === 'done') {
      const date = todayKey();
      const plan = store.state.days[date]?.plan;
      if (!plan || limitReached(store.state, date)) return;
      const owner = store.owner;
      const key = stateKey(plan);
      const proceed = () => {
        if (owner !== store.owner || date !== todayKey() || key !== stateKey(store.state.days[date]?.plan)) { closeModal(); return; }
        openReflect(complete);
      };
      if (photoPolicy(plan.activityId)) openPhotoCheck(plan.activityId!, proceed);
      else proceed();
    }
  });
  // 주민을 누르면 그 주민과 대화하고, 대화 끝에 그 주민의 일로 이어진다.
  talkActions.nuri = () => openBag('seeds');
  talkActions.moru = openShop;
  talkActions.pio = () => openRecords('book');
  events.on('npc-talk', ({ id }) => openTalk(id));
  // 꽃이 핀 식물을 누르면 열매를 한 번 딴다. 식물은 그대로 남는다.
  events.on('plant-tap', ({ id }) => {
    let got = 0;
    store.update((d) => {
      got = harvest(d, id, todayKey());
    });
    if (got > 0) {
      const stayed = store.state.garden.plants.some((p) => p.id === id); // 나무는 자리에 남는다
      showToast([stayed ? copy.harvest.doneTree(got) : copy.harvest.done(got), copy.speak(copy.talk.npc.moru.name, copy.lines.harvested)]);
      events.emit('harvested', { id });
    }
  });
  // 쉬는 날이면 새싹이도 같이 쉰다. 마음이 바뀌면 다시 일어난다.
  let wasResting = isResting(store.state, todayKey());
  store.subscribe(() => {
    const resting = isResting(store.state, todayKey());
    if (!store.restoring && resting !== wasResting) events.emit('sprout-pose', { pose: resting ? 'rest' : 'idle' });
    wasResting = resting;
  });
  // 봉투가 새로 도착하면(완료·쉬기 직후) 잠시 뒤에 알려준다. 못 열어도 우상단 버튼에 남는다.
  let pending = pendingPacketDates(store.state).length;
  let packetTimer: number | undefined;
  store.subscribe(() => {
    const n = pendingPacketDates(store.state).length;
    if (!store.restoring && n > pending) {
      packetTimer = window.setTimeout(openPacketModal, justCompleted ? 3400 : 800);
      justCompleted = false;
    }
    pending = n;
  });
  startSound();
  const begin = () => {
    if (needsIntro(store.state)) openStory('intro', after => after === 'packet' ? openPacketModal() : afterDayChange());
    else afterDayChange();
  };
  events.on('state-restored', () => {
    justCompleted = false;
    window.clearTimeout(packetTimer);
    closeModal(false);
    exitDecorate();
    setDayOffset(store.state.settings.demo ? store.state.settings.dayOffset : 0);
    begin();
  });
  events.on('garden-ready', () => events.emit('ui-lock', { locked: isModalOpen() }));
  begin();
}
