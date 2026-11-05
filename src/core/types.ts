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
  text?: string;
  info: PlanInfo;
  source: LogSource;
}

export interface LogEntry {
  id: string;
  date: string;
  activityId?: string;
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
  | { id: string; type: 'decor'; decorKind: DecorItem['kind']; variant: number }
  | { id: string; type: 'plant'; plantId: string; date: string; harvested?: boolean; harvestedOn?: string };

export interface DayInfo {
  energy?: Energy;
  rested?: boolean;
  plan?: Plan;
  /** [바꾸기]로 제안 순서를 다시 섞는 용도 */
  refresh: number;
  /** 씨앗 봉투: 완료한 날, 쉬기를 고른 날 하루 한 번 */
  packet?: 'ready' | 'opened';
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
  days: Record<string, DayInfo>;
  /** viewZoom: 정원을 보는 배율(없으면 화면 크기에 맞는 기본값) */
  settings: { sound: boolean; demo: boolean; dayOffset: number; viewZoom?: number };
}
