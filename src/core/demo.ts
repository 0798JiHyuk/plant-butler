// 발표용 샘플 데이터: 지난 2주치 기록과 자란 정원. 오늘은 비워 두어 시연자가 직접 해볼 수 있다.
import { shiftDate } from './clock';
import { harvest } from './economy';
import { advanceStage, chooseIntent, chooseMission, FIRST, missionById, moreAfter, type Suggestion } from './missions';
import { isTree, plants } from './plants';
import { rng } from './random';
import { addSeed, chooseRest, closeSession, designPlan, openSessionPacket, plantSeed, reportAction, setEnergy, setPlan, WHEN_OPTIONS } from './rules';
import { createMissionState } from './store';
import type { AppState, MissionStep, ReflectChip } from './types';

type Slot = { col: number; row: number } | null;
export interface SampleSlots {
  decor: (used: { col: number; row: number }[]) => Slot;
  plant: (used: { col: number; row: number }[]) => Slot;
}

const WISHES: [string, string][] = [
  ['좋아하는 공원 다녀오기', '공원 입구까지 가보기'],
  ['동네 한 바퀴 돌기', '골목 끝까지 가보기'],
  ['책방 구경하기', '한 권만 펼쳐보기'],
];
const CHIPS: ReflectChip[] = ['achieved', 'easier', 'again'];

type Rand = () => number;
const pick = <T>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length)];

/** 회차 하나: 일상 장면의 첫 카드를 하고, 절반쯤은 [더 해 볼래]로 한두 번 더 한 뒤 닫는다. 지난 일주일엔 가끔 직접 적은 일. */
function sampleSession(draft: AppState, r: Rand, date: string, ago: number): void {
  const chips = () => CHIPS.filter(() => r() < 0.4);
  if (ago <= 7 && r() < 0.3) {
    const [text, criterion] = pick(r, WISHES);
    if (setPlan(draft, date, designPlan(text, pick(r, WHEN_OPTIONS), criterion)!)) reportAction(draft, date, chips());
  } else {
    const scene = pick(r, FIRST.daily.scenes);
    chooseIntent(draft, 'daily', missionById(scene.missionId)?.intentIds[0] ?? null);
    let step: MissionStep | null = { missionId: scene.missionId, variant: r() < 0.5 ? 'small' : 'basic' };
    for (let i = 0; i < 3 && step; i++) {
      if (!chooseMission(draft, date, step)) break;
      reportAction(draft, date, chips());
      const next: Suggestion | null = r() < 0.5 ? moreAfter(draft, date, step) : null;
      if (next?.crosses) advanceStage(draft, next.missionId); // 시연 데이터에서는 다음 길을 골랐다고 본다
      step = next;
    }
  }
  closeSession(draft);
}

/** 기존 정원·기록을 비우고 지난 14일치를 채운다. 안 한 날은 그냥 비어 있다. */
/** 시험용: 씨앗함에 씨앗을 넣는다. 나무 하나를 먼저 넣고, 나머지는 도감 앞쪽부터 차례로라 특별 씨앗도 섞인다. */
export function addTestSeeds(draft: AppState, count: number): void {
  const trees = plants.filter((p) => p.tree);
  addSeed(draft, trees[draft.seeds.length % trees.length].id);
  for (let i = 1; i < count; i++) addSeed(draft, plants[(draft.seeds.length + i * 2) % plants.length].id);
}

/** 그날 받은 주머니를 열어 심는다. 오래전에 핀 꽃 일부는 열매를 이미 따서 창고에 있고, 최근에 핀 꽃은 시연 때 직접 딸 수 있게 남긴다. */
function plantPackets(draft: AppState, r: Rand, date: string, ago: number, today: string, slots: SampleSlots): void {
  while (draft.sessionPackets > 0) {
    const seed = openSessionPacket(draft, r)!;
    const used = [...draft.garden.plants, ...draft.garden.items];
    const planted = plantSeed(draft, seed.id, date, isTree(seed.plantId) ? slots.decor(used) : slots.plant(used));
    if (planted && ago >= 8 && r() < 0.6) harvest(draft, planted.id, today);
  }
}

export function fillSample(draft: AppState, today: string, slots: SampleSlots): void {
  draft.logs = [];
  draft.garden = { items: [], plants: [], storage: [] };
  draft.days = {};
  draft.bonusPackets = 0;
  draft.freePackets = 0;
  draft.sessionPackets = 0;
  draft.missions = { ...createMissionState(), category: 'daily' };
  draft.seeds = [];
  draft.purchases = 0;
  draft.story.seen = ['intro', 'free-packet']; // 시연은 프롤로그 뒤부터
  const r = rng(20261026);

  for (let ago = 14; ago >= 1; ago--) {
    const date = shiftDate(today, -ago);
    const roll = r();
    // 최근 이틀은 늘 무언가 한 날로 두고, 그 주머니는 열지 않고 남긴다(시연 때 직접 열어 보게).
    if (ago > 2 && roll < 0.15) {
      setEnergy(draft, date, 'heavy');
      chooseRest(draft, date);
    } else if (ago > 2 && roll < 0.32) {
      continue; // 아무것도 안 한 날: 기록도 표시도 남기지 않는다.
    } else {
      setEnergy(draft, date, pick(r, ['heavy', 'normal', 'normal', 'good'] as const));
      const count = ago <= 7 ? 1 + Math.floor(r() * 2) : 1; // 회차는 하루 한두 개(씨앗도 그만큼)
      for (let i = 0; i < count; i++) sampleSession(draft, r, date, ago);
    }
    if (ago > 2) plantPackets(draft, r, date, ago, today, slots);
  }
  // 열매는 이미 모아 둔 만큼(상점을 바로 시연할 수 있게), 소품 둘은 이미 사서 놓아 둔 것으로 한다.
  draft.fruit = 12;
  for (const kind of ['bench', 'flowerpot'] as const) {
    const slot = slots.decor([...draft.garden.items, ...draft.garden.plants]);
    if (slot) draft.garden.items.push({ id: `sample-${kind}`, kind, variant: 0, ...slot });
  }
  // 방문 선물함: 접속한 날은 4번이고 오늘 것은 아직 받지 않은 상태.
  draft.visits = { count: 4, last: shiftDate(today, -1) };
}
