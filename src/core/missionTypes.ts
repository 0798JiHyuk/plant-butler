export type CategoryId = 'daily' | 'academic' | 'work';
export type MissionVariant = 'basic' | 'small';
export type FactValue = boolean | 'unknown';
export type WorkStatus = 'pre_return' | 'returned' | 'unknown';
export interface Mission {
  id: string; categoryId: CategoryId; category: string; stage: number; stageName: string;
  name: string; npc: string; dialogue: string; basic: string; small: string; done: string;
  record: string; smallRecord: string; condition: string; conditionSummary: string; intentIds: string[];
  mode: 'activity' | 'create_and_execute' | 'plan_and_execute' | 'day_and_execute';
  next: string;
  recommendation: { nominalNextId: string; afterFinal: string | null };
  eligibility: { allowedWorkStatuses: WorkStatus[]; basicRequiredFacts: string[]; smallRequiredFacts: string[]; inheritCustomActionRequirements: boolean };
  completion: { buttonLabel: string };
}
export interface MissionExecution {
  actionId: string; missionId: string; variant: MissionVariant; text: string; record: string;
  customId?: string; parentMissionId?: string;
  when?: string; where?: string; criterion?: string;
}
export interface MissionReport extends MissionExecution { date: string; logId: string }
export interface MissionSession {
  sessionId: string; status: 'active' | 'closed' | 'skipped'; reportedActions: MissionReport[];
  rewardGranted: boolean; closedOn?: string;
}
export interface MissionBookmark {
  categoryId: CategoryId; sourceMissionId: string; targetMissionId?: string; nextAction: string; locationLabel?: string;
  variant: MissionVariant; customId?: string;
}
export interface CustomMission {
  id: string; categoryId: CategoryId; name: string; basic: string; small: string;
  trigger: string; criterion: string; sourceMissionId?: string;
}
export interface DayMission { id: string; customId: string; cue: string; time?: string; place?: string }
export interface MissionProgress {
  onboardingSeen?: boolean;
  selectedCategory: CategoryId | null; selectedIntent: string | null; workStatus: WorkStatus;
  stages: Record<CategoryId, number>; facts: Record<string, FactValue>;
  sessions: Record<string, MissionSession>; activeSessionId: string | null; execution: MissionExecution | null;
  bookmarks: Partial<Record<CategoryId, MissionBookmark>>;
  custom: CustomMission[]; myDays: Partial<Record<CategoryId, DayMission[]>>;
  dayMapDefault: Partial<Record<CategoryId, boolean>>;
  selectedDayEntry?: Partial<Record<CategoryId, string>>;
  restCues?: Partial<Record<CategoryId, string>>;
  packets: number;
}
