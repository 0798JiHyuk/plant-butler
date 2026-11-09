import { activityById } from './activities';
import { copy } from './copy';
import type { Activity, LogEntry } from './types';

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 월요일 시작 주의 첫날 */
export function weekStart(date: string): string {
  const d = parse(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return fmt(d);
}

function thisWeek(logs: LogEntry[], date: string): LogEntry[] {
  const start = weekStart(date);
  return logs.filter((l) => weekStart(l.date) === start);
}

export function countThisWeek(logs: LogEntry[], activityId: string, date: string): number {
  const start = weekStart(date);
  return logs.filter((l) => l.activityId === activityId && weekStart(l.date) === start).length;
}

/** 칭찬 대신 사실: 기록에서 센 숫자만 말한다. */
export function factLine(logs: LogEntry[], activity: Activity, date: string): string {
  return copy.fact.weekNth(activity.name, countThisWeek(logs, activity.id, date));
}

/** 직접 계획 비율. 디버그 패널에서만 보여준다. */
export function directPlanRatio(logs: LogEntry[]): number {
  return logs.length === 0 ? 0 : logs.filter((l) => l.source === 'design').length / logs.length;
}

/** 활동이든 직접 적은 일이든, 같은 것을 이번 주에 몇 번 했는지로 말한다. */
export function factLineFor(logs: LogEntry[], log: LogEntry, date: string): string {
  const same = (l: LogEntry) => (log.activityId ? l.activityId === log.activityId : l.text === log.text);
  const label = log.mission?.record ?? activityName(log) ?? log.text ?? '';
  return copy.fact.weekNth(label, thisWeek(logs, date).filter(same).length);
}

function activityName(log: LogEntry): string | undefined {
  return log.activityId ? activityById(log.activityId)?.name : undefined;
}

/** 이번 주에 해본 서로 다른 일의 수 */
export function weekKindsCount(logs: LogEntry[], date: string): number {
  return new Set(thisWeek(logs, date).map((l) => l.activityId ?? `text:${l.text}`)).size;
}

/** 날짜별(최신 먼저)로 묶는다. 해낸 것만 들어 있다. */
export function groupByDate(logs: LogEntry[]): { date: string; logs: LogEntry[] }[] {
  const map = new Map<string, LogEntry[]>();
  for (const l of logs) map.set(l.date, [...(map.get(l.date) ?? []), l]);
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, list]) => ({ date, logs: list }));
}
