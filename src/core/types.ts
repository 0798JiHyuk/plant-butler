import type { NpcId } from './events';

/** 미션 영역: 일상·학업·업무복귀 */
export type CategoryId = 'daily' | 'academic' | 'work';
/** 카드의 두 크기: 기본 행동·줄인 행동 */
export type Variant = 'basic' | 'small';
/** 업무복귀: 복귀 전·복귀 후·모름. W06~W20(실무)은 복귀 후에만 추천한다. */
export type WorkStatus = 'pre_return' | 'returned' | 'unknown';

export type Energy = 'heavy' | 'normal' | 'good';
export type ActivityKind = 'selfcare' | 'outing' | 'joy' | 'connect' | 'plant';
export type LogSource = 'mission' | 'daily' | 'design';
export type ReflectChip = 'achieved' | 'easier' | 'again';

export interface Activity {
  id: string;
  name: string;
  minutes: number;
  kind: ActivityKind;
  smallerId: string | null;
  icon: string;
}

export interface PlanInfo {
  when: string;
  where: string;
  minutes: number;
  criterion?: string;
}

export interface Plan {
  activityId?: string;
  /** 미션 카드와 고른 크기 */
  missionId?: string;
  variant?: Variant;
  text?: string;
  info: PlanInfo;
  source: LogSource;
}

export interface LogEntry {
  id: string;
  date: string;
  activityId?: string;
  missionId?: string;
  variant?: Variant;
  /** 이 행동이 들어간 회차 */
  sessionId?: string;
  text?: string;
  plan: PlanInfo;
  chips: ReflectChip[];
  source: LogSource;
}

export interface DecorItem {
  id: string;
  /** 'flower'·'pot'·'lamp'는 이전 그림의 저장본용. 지금은 새 종류만 만든다. */
  kind: 'flowerpot' | 'table' | 'shelf' | 'bench' | 'birdbath' | 'hammock' | 'flower' | 'pot' | 'lamp';
  variant: number;
  col: number;
  row: number;
  /** 좌우를 바꿔 놓았는지(꾸미기의 [방향 바꾸기]). 없으면 그림 그대로. */
  flip?: boolean;
}

export interface PlantedItem {
  id: string;
  plantId: string;
  /** 심은 날(성장 단계는 이 날과 오늘만으로 계산한다) */
  date: string;
  /** 열매를 땄는지. 딴 꽃은 창고로 가고, 꺼내면 마당의 장식이 된다. */
  harvested?: boolean;
  /** 나무: 마지막으로 수확한 날. 이 뒤로 주머니를 받은 날을 세어 다시 열린다. */
  harvestedOn?: string;
  col: number;
  row: number;
}

/** 씨앗함의 씨앗: 봉투를 열어 나왔지만 아직 심지 않은 것. 사라지지 않는다. */
export interface SeedItem {
  id: string;
  plantId: string;
}

/** 창고에 넣어둔 것: 소품이거나 심은 식물이거나. 칸을 벗어나므로 위치가 없다. */
export type StoredThing =
  | { id: string; type: 'decor'; decorKind: DecorItem['kind']; variant: number; flip?: boolean }
  | { id: string; type: 'plant'; plantId: string; date: string; harvested?: boolean; harvestedOn?: string };

/** 마음 식물: 대화를 끝낼 때 사용자가 고르는 "오늘 내 마음과 닮은 식물". 앱이 판정하지 않는다. */
export type MindPlant = 'sprouting' | 'dry' | 'prune' | 'sideways' | 'steady';

/** 대화 한 줄. keep은 사용자가 굵게 남긴 문장(자기 말에만). */
export interface ChatLine {
  from: 'me' | NpcId;
  text: string;
  keep?: boolean;
}

/** 주민과 나눈 대화 하나. 기기 안에만 있고 집계에 쓰지 않는다. */
export interface ChatLog {
  id: string;
  date: string;
  npc: NpcId;
  lines: ChatLine[];
  /** 한 줄 더 적은 것 */
  note?: string;
  mind?: MindPlant;
}

/** 카드 한 장과 고른 크기 */
export interface MissionStep {
  missionId: string;
  variant: Variant;
}

/** 회차: 계획을 세우면 열리고 [여기까지]·쉬기로 닫힌다. 닫을 때 해낸 행동이 있으면 씨앗 1개(한 번만). */
export interface MissionSession {
  id: string;
  date: string;
  /** 해낸 행동(직접 적은 일·예전 활동은 missionId가 없다) */
  actions: { missionId?: string; variant?: Variant }[];
}

export interface MissionState {
  /** 오늘의 영역(언제든 바꿀 수 있다). 없으면 처음 미션을 열 때 묻는다. */
  category: CategoryId | null;
  /** 영역별로 지금 하려는 장면(drink·exam 등). 없으면 그 영역의 모든 장면 */
  intents: Partial<Record<CategoryId, string>>;
  workStatus: WorkStatus;
  /** 영역별 추천 단계(1~4). "다음 길을 볼래"를 고를 때만 오르고, 쉬거나 작게 해도 내려가지 않는다. */
  stage: Record<CategoryId, number>;
  /** "해당 없어요"라고 한 카드와 그 조건. 조건은 날마다 바뀌어서 그날만 적용한다. */
  skip: { date: string; facts: string[]; cards: string[] };
  session: MissionSession | null;
  /** 회차 번호(id 만들기용) */
  seq: number;
  /** 표지판: 영역별로 다음에 이어갈 작은 행동 */
  bookmarks: Partial<Record<CategoryId, MissionStep>>;
  /** 영역별 마지막으로 고른 카드 */
  last: Partial<Record<CategoryId, string>>;
  /**
   * 조원 형식의 저장에서 옮겨 온 값 중 지금 화면이 쓰지 않는 것(직접 만든 미션·하루 지도·조건 답·책갈피 문구 등).
   * 지우지 않고 그대로 들고 다니며(서버 저장 포함), 직접 만든 미션·하루 지도를 이식할 때 읽는다.
   */
  legacy?: Record<string, unknown>;
}

export interface DayInfo {
  energy?: Energy;
  rested?: boolean;
  plan?: Plan;
  /** [바꾸기]로 제안 순서를 다시 섞는 용도 */
  refresh: number;
  /** 예전 저장본의 하루 봉투(지금은 회차를 마치면 sessionPackets를 받는다) */
  packet?: 'ready' | 'opened';
  /** 그날 마친 회차 수(하루 상한, 나무 다시 맺기) */
  sessions?: number;
}

export interface AppState {
  version: 1;
  logs: LogEntry[];
  garden: { items: DecorItem[]; plants: PlantedItem[]; storage: StoredThing[]; /** 옮긴 텃밭 자리. 없으면 처음 자리. */ bed?: { x: number; y: number } };
  /** 씨앗함: 열어 본 뒤 심지 않은 씨앗 */
  seeds: SeedItem[];
  /** 정원열매: 꾸미기 전용 재화. 줄어드는 건 상점에서 쓸 때뿐이다. */
  fruit: number;
  /** 이야기가 건넨 주머니(날짜에 묶이지 않고, 그날 활동 주머니를 막지 않음) */
  freePackets: number;
  /** 본 장면과 고른 답 */
  story: {
    seen: string[];
    choices: Record<string, number>;
    /** 주민 이야기를 마지막으로 본 날(하루 한 장면) */
    lastDay?: string;
    /** 복귀 장면을 마지막으로 본 날 */
    lastReturn?: string;
  };
  /** 방문 선물로 받은 특별 씨앗 주머니(날짜에 묶이지 않음) */
  bonusPackets: number;
  /** 방문 선물함: 누적 방문 횟수와 마지막으로 받은 날. 연속 기록은 없다. */
  visits: { count: number; last?: string };
  /** 구매 번호(소품 id 만들기용) */
  purchases: number;
  /** 주민과 나눈 대화(사용자가 남기기로 한 것만). 기기 안에만 저장한다. */
  chats: ChatLog[];
  /** 미션 카드 흐름(영역·장면·추천 단계·회차·표지판) */
  missions: MissionState;
  /** 회차를 마치고 받은, 아직 안 연 씨앗 주머니 */
  sessionPackets: number;
  days: Record<string, DayInfo>;
  /** viewZoom: 정원을 보는 배율(없으면 화면 크기에 맞는 기본값) */
  settings: { sound: boolean; demo: boolean; dayOffset: number; viewZoom?: number };
}
