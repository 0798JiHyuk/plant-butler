import type { MissionProgress } from './missionTypes';

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => typeof v === 'string';
const optional = (v: unknown, test: (x: unknown) => boolean) => v === undefined || test(v);
const arr = (v: unknown, test: (x: unknown) => boolean) => Array.isArray(v) && v.every(test);
const cat = (v: unknown) => v === 'daily' || v === 'academic' || v === 'work';
const variant = (v: unknown) => v === 'basic' || v === 'small';
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const execution = (v: unknown) => obj(v) && str(v.actionId) && str(v.missionId) && variant(v.variant)
  && str(v.text) && str(v.record) && optional(v.customId, str) && optional(v.parentMissionId, str) && optional(v.when, str) && optional(v.where, str) && optional(v.criterion, str);

/** Validate persisted v2 runtime separately; old saves need no destructive migration. */
export function decodeMissionProgress(raw: unknown): MissionProgress {
  if (!obj(raw) || !(raw.selectedCategory === null || cat(raw.selectedCategory)) || !(raw.selectedIntent === null || str(raw.selectedIntent))
    || !['pre_return', 'returned', 'unknown'].includes(String(raw.workStatus)) || !obj(raw.stages)
    || !['daily', 'academic', 'work'].every(c => typeof raw.stages === 'object' && raw.stages !== null && c in raw.stages && Number.isInteger((raw.stages as Record<string, unknown>)[c])
      && Number((raw.stages as Record<string, unknown>)[c]) >= 1 && Number((raw.stages as Record<string, unknown>)[c]) <= 6)
    || !optional(raw.onboardingSeen, x => typeof x === 'boolean')
    || !obj(raw.facts) || !Object.values(raw.facts).every(x => typeof x === 'boolean' || x === 'unknown')
    || !Number.isSafeInteger(raw.packets) || Number(raw.packets) < 0
    || !(raw.activeSessionId === null || str(raw.activeSessionId)) || !(raw.execution === null || execution(raw.execution))
    || !obj(raw.sessions) || !Object.entries(raw.sessions).every(([id, s]) => obj(s) && s.sessionId === id
      && ['active', 'closed', 'skipped'].includes(String(s.status)) && typeof s.rewardGranted === 'boolean'
      && optional(s.closedOn, date) && arr(s.reportedActions, a => execution(a) && obj(a) && date(a.date) && str(a.logId))
      && (s.status !== 'active' || s.rewardGranted === false)
      && (s.status !== 'closed' || (Array.isArray(s.reportedActions) && s.reportedActions.length > 0 && s.rewardGranted === true))
      && (s.status !== 'skipped' || (Array.isArray(s.reportedActions) && s.reportedActions.length === 0 && s.rewardGranted === false)))
    || !obj(raw.bookmarks) || !Object.entries(raw.bookmarks).every(([key, b]) => cat(key) && obj(b) && b.categoryId === key && str(b.sourceMissionId) && optional(b.targetMissionId, str) && str(b.nextAction) && variant(b.variant) && optional(b.locationLabel, str) && optional(b.customId, str))
    || !arr(raw.custom, c => obj(c) && str(c.id) && cat(c.categoryId) && ['name', 'basic', 'small', 'trigger', 'criterion'].every(k => str(c[k])) && optional(c.sourceMissionId, str))
    || !obj(raw.myDays) || !Object.entries(raw.myDays).every(([key, entries]) => cat(key) && arr(entries, e => obj(e) && str(e.id) && str(e.customId) && str(e.cue) && optional(e.time, str) && optional(e.place, str)) && Array.isArray(entries) && entries.length <= 3)
    || !obj(raw.dayMapDefault) || !Object.entries(raw.dayMapDefault).every(([key, v]) => cat(key) && typeof v === 'boolean')
    || !optional(raw.selectedDayEntry, items => obj(items) && Object.entries(items).every(([k, v]) => cat(k) && str(v)))
    || !optional(raw.restCues, cues => obj(cues) && Object.entries(cues).every(([k, v]) => cat(k) && str(v)))) throw new Error('Invalid mission progress');
  const value = raw as unknown as MissionProgress;
  if (value.activeSessionId && value.sessions[value.activeSessionId]?.status !== 'active') throw new Error('Invalid active session');
  if (value.execution && !value.activeSessionId) throw new Error('Missing session');
  for (const session of Object.values(value.sessions)) if (new Set(session.reportedActions.map(a => a.actionId)).size !== session.reportedActions.length) throw new Error('Duplicate mission action');
  if (new Set(value.custom.map(c => c.id)).size !== value.custom.length) throw new Error('Duplicate custom mission');
  return structuredClone(value);
}
