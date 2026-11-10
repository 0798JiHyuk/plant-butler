// 화면 사이의 흐름: 하루 첫 여력 체크 → 미션 카드 고르기 → 했어 → 회고 → 정원 변화.
import { setDayOffset, todayKey } from '../core/clock';
import { copy } from '../core/copy';
import { events } from '../core/events';
import { canHarvest, harvest, nextGrowth } from '../core/economy';
import { bookmarkSuggestion, saveBookmark } from '../core/missions';
import { closeSession, isResting, limitReached, pendingPacketCount, pendingPacketDates, reportAction, settleOldSession } from '../core/rules';
import { factLineFor } from '../core/stats';
import { isTree } from '../core/plants';
import { markReturnSeen, needsIntro, nextSceneFor, returnScene, type NpcSpeaker, type StoryAfter } from '../core/story';
import { store } from '../core/store';
import type { ReflectChip } from '../core/types';
import { openBag } from './panels/Bag';
import { chatActions, openChat } from './panels/Chat';
import { showCheckin } from './panels/Checkin';
import { closeModal, isModalOpen } from './modal';
import { openAccount } from './panels/Account';
import { enterDecorate, exitDecorate, isDecorating } from './panels/Decorate';
import { directLinks, openDirect } from './panels/Direct';
import { missionLinks, openBookmark, openMission, openMore } from './panels/Mission';
import { openPacketModal } from './panels/Packet';
import { openRecords } from './panels/Records';
import { openReflect, type AfterReflect } from './panels/Reflect';
import { openSettings } from './panels/Settings';
import { openShop } from './panels/Shop';
import { openStory } from './panels/Story';
import { startSound } from './sound';
import { showToast } from './toast';

let justCompleted = false;

/** 프롤로그 뒤 한 번: 첫 선물(봉투 열기·심기)과 여력 체크가 끝나 화면이 비면 오늘의 영역을 묻는다. "정원 먼저"면 다시 묻지 않는다. */
let askArea = false;
function askAreaWhenIdle(): void {
  window.setTimeout(() => {
    if (!askArea || isModalOpen() || isDecorating()) return;
    if (!store.state.days[todayKey()]?.energy) return showCheckin();
    askArea = false;
    if (!store.state.missions.category) openMission();
  }, 0);
}

/** [했어] 다음: 행동을 기록하고, [여기까지]면 회차를 닫고 [더 해 볼래]면 같은 회차에서 다음 카드로. */
function complete(chips: ReflectChip[], then: AfterReflect): void {
  const date = todayKey();
  let result = null as ReturnType<typeof reportAction>;
  store.update((d) => {
    result = reportAction(d, date, chips);
  });
  if (!result) return;
  const lines = [factLineFor(store.state.logs, result.log, date)];
  if (then === 'end' && chips.length === 0) lines.push(copy.speak(copy.talk.npc.nuri.name, copy.lines.skipReflect));
  showToast(lines.filter(Boolean));
  if (then === 'more') openMore();
  else endSession();
}

/** 회차를 닫는다. 이어갈 작은 행동이 있으면 표지판으로 남길지 먼저 묻는다. 씨앗 주머니는 정원 변화 뒤에 뜬다. */
function endSession(): void {
  const date = todayKey();
  const step = bookmarkSuggestion(store.state, date);
  const close = (save: boolean) => {
    justCompleted = true; // 정원 변화 연출이 끝난 뒤에 주머니를 보여준다
    store.update((d) => {
      if (save && step) saveBookmark(d, step);
      closeSession(d);
    });
    if (limitReached(store.state, date)) showToast([copy.card.enough + '.']);
    events.emit('celebrate', { item: null });
  };
  if (step) openBookmark(step, close);
  else close(false);
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
  } else {
    // 아직 딸 수 없으면 다음 모습까지 남은 날을 그 식물 위에 알려 준다.
    const p = store.state.garden.plants.find((x) => x.id === id);
    const n = p && nextGrowth(p.date, todayKey(), p.plantId);
    if (p && n) events.emit('plant-note', { id, text: copy.plantNote(isTree(p.plantId), n.next, n.days) });
  }
}

/** 지금 세운 계획을 다시 본다: 카드면 그 카드, 직접 적은 일이면 직접 만들기 창, 없으면 카드 흐름 처음. */
function openPlan(): void {
  const plan = store.state.days[todayKey()]?.plan;
  if (plan?.missionId) openMission({ v: 'card', id: plan.missionId, prefer: plan.variant });
  else if (plan?.source === 'design') openDirect();
  else openMission();
}

/** 정원 위 카드의 [다른 걸 할래]: 고른 카드가 있으면 같은 단계의 다른 카드, 아니면 카드 흐름 처음. */
function otherMission(): void {
  const id = store.state.days[todayKey()]?.plan?.missionId;
  openMission(id ? { v: 'other', from: id } : undefined);
}

/** 이야기 장면이 끝난 뒤 이어지는 화면. 패널끼리 직접 부르지 않도록 여기서만 연다. */
function runAfter(after: StoryAfter): void {
  const today = todayKey();
  if (after === 'packet') openPacketModal();
  else if (after === 'seeds') {
    if (pendingPacketCount(store.state) > 0) openPacketModal();
    else openBag('seeds');
  }
  else if (after === 'activity' || after === 'daily') openMission(); // 지난 활동 다시 = 표지판 또는 그 영역의 마지막 카드
  else if (after === 'design') openDirect();
  else if (after === 'plan') openPlan();
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
  else openChat(id);
}

/** 새 하루의 첫 진입(데모 모드의 [다음 날로] 뒤에도). 오랜만이면 복귀 장면을 먼저, 그다음 여력 체크. */
export function afterDayChange(): void {
  const today = todayKey();
  store.update((d) => settleOldSession(d, today)); // 지난 날 열어 둔 회차는 그날 것으로 정산(씨앗은 받는다)
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
    else if (id === 'mission') openMission();
    else if (id === 'mission-other') otherMission();
    else if (id === 'records') openRecords();
    else if (id === 'decorate') enterDecorate();
    else if (id === 'settings') openSettings(openAccount);
    else if (id === 'packet') openPacketModal();
    else if (id === 'bag') openBag('seeds');
    else if (id === 'book') openRecords('book');
    else if (id === 'done') openReflect(complete);
    else if (id === 'session-more') openMore();
    else if (id === 'session-end') endSession();
  });
  // 주민을 누르면 그 주민과 이야기하고, 대화창의 버튼으로 그 주민의 일로 이어진다.
  chatActions.nuri = () => openBag('seeds');
  chatActions.moru = openShop;
  chatActions.pio = () => openRecords('book');
  // 카드 흐름 ↔ 직접 만들기
  missionLinks.direct = openDirect;
  missionLinks.end = endSession;
  directLinks.cards = () => openMission();
  events.on('npc-talk', ({ id }) => meetNpc(id));
  // 꽃이 핀 식물을 누르면 열매를 한 번 딴다.
  events.on('plant-tap', ({ id }) => harvestPlant(id));
  // 쉬는 날이면 새싹이도 같이 쉰다. 마음이 바뀌면 다시 일어난다.
  let wasResting = isResting(store.state, todayKey());
  store.subscribe(() => {
    const resting = isResting(store.state, todayKey());
    if (!store.restoring && resting !== wasResting) events.emit('sprout-pose', { pose: resting ? 'rest' : 'idle' });
    wasResting = resting;
  });
  // 주머니가 새로 도착하면(회차를 마친 직후) 잠시 뒤에 알려준다. 못 열어도 왼쪽 위 버튼에 남는다.
  const arrived = () => pendingPacketDates(store.state).length + store.state.sessionPackets;
  let pending = arrived();
  let packetTimer: number | undefined;
  store.subscribe(() => {
    const n = arrived();
    if (!store.restoring && n > pending) {
      packetTimer = window.setTimeout(openPacketModal, justCompleted ? 3400 : 800);
      justCompleted = false;
    }
    pending = n;
  });
  // 창이 닫히거나 꾸미기가 끝날 때마다 화면이 비었는지 본다(프롤로그 뒤 영역 묻기).
  events.on('ui-lock', ({ locked }) => {
    if (!locked) askAreaWhenIdle();
  });
  // 서버 저장본을 복원하면(다른 기기·계정) 규칙을 다시 돌리지 않고 장면과 첫 화면 흐름만 다시 시작한다.
  events.on('state-restored', () => {
    justCompleted = false;
    window.clearTimeout(packetTimer);
    closeModal(false);
    exitDecorate();
    setDayOffset(store.state.settings.demo ? store.state.settings.dayOffset : 0);
    afterDayChange();
  });
  events.on('garden-ready', () => events.emit('ui-lock', { locked: isModalOpen() }));
  startSound();
  const begin = () => afterDayChange();
  if (needsIntro(store.state)) {
    askArea = true;
    openStory('intro', (after) => (after === 'packet' ? openPacketModal() : begin()));
  } else begin();
}
