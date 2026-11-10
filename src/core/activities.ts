// 옛 활동 16개. 지금은 예전 기록과 예전 계획을 보여 줄 때만 쓴다.
import raw from './data/activities.json';
import type { Activity } from './types';

export const activities = raw as unknown as Activity[];

export function activityById(id: string | undefined): Activity | undefined {
  return id ? activities.find((a) => a.id === id) : undefined;
}
