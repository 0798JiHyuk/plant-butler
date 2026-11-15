import { atlasLinks, openResidentMaps, openGardenMapEditor } from './panels/ResidentMaps';
import { openDecorationPreview } from './panels/DecorationPreview';
import { SHOP } from '../core/economy';
import { exploration } from '../core/exploration';
import { currentPosition } from './worldPosition';
import { LANDMARKS } from '../core/worldGeometry';
import { withinReach,INTERACTION_RANGE } from '../core/interaction';
// 화면 사이의 흐름: 하루 첫 여력 체크 → 활동 고르기 → 했어요 → 회고 → 정원 변화.
import { setDayOffset, todayKey } from '../core/clock';
import { copy } from '../core/copy';
import { events } from '../core/events';
import { harvest } from '../core/economy';
import { completePlan, isResting, limitReached, pendingPacketDates } from '../core/rules';
import { factLineFor } from '../core/stats';
import { narrative } from '../core/exploration';
import { sceneAvailable } from '../core/narrative';
import { openNarrative, openNarrativeNotebook, narrativeLinks } from './panels/Narrative';
import { openWorldMap } from './panels/WorldMap';
import { saveProgress } from './saveProgress';
import { ensureExploration } from '../core/exploration';
import { store } from '../core/store';
import type { ReflectChip } from '../core/types';
import { openMissionPanel } from './panels/MissionPanel';
import { activeMissionSession, missionProgress, reportMission } from '../core/missions';
import { decorateLinks, enterDecorate, exitDecorate } from './panels/Decorate';
import { openBag } from './panels/Bag';
import { openPacketModal } from './panels/Packet';
import { openRecords } from './panels/Records';
import { openSettings } from './panels/Settings';
import { openAccount } from './panels/Account';
import { showCheckin } from './panels/Checkin';
import { openReflect } from './panels/Reflect';
import { openShop } from './panels/Shop';
import { openTalk, talkActions } from './panels/Talk';
import { startSound } from './sound';
import { showToast } from './toast';
import { closeModal, isModalOpen } from './modal';
import { photoPolicy } from '../core/photoCheck';
import { stateKey } from '../core/state';
import { openPhotoCheck } from './panels/PhotoCheck';
import { openGardenName } from './panels/GardenName';
import { openHouseEntry } from './panels/HouseEntry';
import { openPlaceExterior } from './panels/PlaceExterior';

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
  events.on('interaction-too-far',()=>showToast([copy.world.comeCloser]));
  decorateLinks.shop = openShop;
  narrativeLinks.showMap=openResidentMaps; narrativeLinks.editMap=openGardenMapEditor; atlasLinks.resume=openNarrative;
  events.on('house-entry', () => { if (!isModalOpen()) openHouseEntry(); });
  narrativeLinks.action = action => {
    if (action === 'mission') openMissionPanel();
    else if (action === 'packet') openPacketModal();
    else if (action === 'bag') openBag('seeds');
    else if (action === 'shop') openShop();
    else if (action === 'decorate') enterDecorate();
    else if (action === 'book') openRecords('book');
    else if (action === 'return') { saveProgress(s => { ensureExploration(s).destination = 'garden'; }); openWorldMap(); }
    else if (action === 'map') openWorldMap();
    else if (action === 'name') openGardenName();
    else if (action === 'gift') openRecords('stamps');
    else if (action === 'records') openRecords();
    else if (action === 'preview') { const item=SHOP.find(x=>x.kind===exploration(store.state).goal?.kind); if(item)openDecorationPreview(item.kind,openNarrativeNotebook,openShop); }
    else if (action === 'harvest') showToast([copy.world.comeCloser]);

  };
  events.on('world-interact', ({ id }) => {
    if (isModalOpen()) return;
    if (id === 'cafe') openNarrative('ST-V01');
      else if(id==='school'||id==='work') openPlaceExterior(id);
    else if(narrative(store.state).decision){const decision=narrative(store.state).decision;openResidentMaps(decision==='own'?'mine':decision==='together'?'together':'blank');}
    else if (sceneAvailable(store.state, 'ST-D01')) openNarrative('ST-D01');
    else if (sceneAvailable(store.state, 'ST-P02')) openNarrative('ST-P02');
    else openNarrative('ST-P01');
  });
  events.on('hud-action', ({ id }) => {
    if (id === 'map') openWorldMap();
    else if (id === 'story') openNarrativeNotebook();
    else if (id === 'talk') {const p=currentPosition();if(!p.indoor&&withinReach(p,LANDMARKS.nuri,INTERACTION_RANGE+60))openTalk('nuri');else showToast([copy.world.comeCloser]);}
    else if (id === 'shop') openShop();
    else if (id === 'gift') openRecords('stamps');
    else if (id === 'other-activity') openMissionPanel(!!activeMissionSession(store.state)?.reportedActions.length && !missionProgress(store.state).execution);
    else if (id === 'plan-check') openMissionPanel(false, true);
    else if (id === 'records') openRecords();
    else if (id === 'decorate') enterDecorate();
    else if (id === 'settings') openSettings(openAccount, openGardenName);
    else if (id === 'packet') openPacketModal();
    else if (id === 'bag') openBag('seeds');
    else if (id === 'book') openRecords('book');
    else if (id === 'done') {
      if (missionProgress(store.state).execution) {
        let reported = false; store.update(s => { reported = reportMission(s, todayKey()); });
        if (reported) openMissionPanel(true);
        return;
      }
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
  events.on('npc-talk', ({ id }) => {
    const scene = id === 'nuri' ? 'ST-A01' : id === 'moru' ? 'ST-B01' : 'ST-C01';
    if (sceneAvailable(store.state, scene) && !narrative(store.state).completed.includes(scene)) openNarrative(scene);
    else openTalk(id);
  });
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
  let pending = pendingPacketDates(store.state).length + (store.state.missions?.packets ?? 0);
  let packetTimer: number | undefined;
  store.subscribe(() => {
    const n = pendingPacketDates(store.state).length + (store.state.missions?.packets ?? 0);
    if (!store.restoring && n > pending) {
      packetTimer = window.setTimeout(openPacketModal, justCompleted ? 3400 : 800);
      justCompleted = false;
    }
    pending = n;
  });
  startSound();
  const begin = () => {
    if (!store.state.story.seen.includes('intro') && store.state.logs.length === 0 && !narrative(store.state).completed.includes('ST-P01')) openNarrative('ST-P01');
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
