import raw from './data/missions-v2.json';
import type { AppState, Plan, ReflectChip } from './types';
import type { CategoryId, CustomMission, DayMission, Mission, MissionBookmark, MissionProgress, MissionVariant, FactValue } from './missionTypes';
import { limitReached } from './rules';

export const missionCatalog = raw;
export const missions = raw.missions as Mission[];
export const missionById = (id: string | undefined) => missions.find(m => m.id === id);
export const categories: CategoryId[] = ['daily', 'academic', 'work'];
export function createMissionProgress(): MissionProgress {
  return { selectedCategory: null, selectedIntent: null, workStatus: 'unknown', stages: { daily: 1, academic: 1, work: 1 }, facts: {}, sessions: {}, activeSessionId: null, execution: null, bookmarks: {}, custom: [], myDays: {}, dayMapDefault: {}, packets: 0 };
}
export const missionProgress = (s: AppState): MissionProgress => s.missions ?? createMissionProgress();
const writable = (s: AppState) => (s.missions ??= createMissionProgress());
export const activeMissionSession = (s: AppState) => {
  const p = missionProgress(s); return p.activeSessionId ? p.sessions[p.activeSessionId] : undefined;
};

export function setMissionCategory(s: AppState, category: CategoryId): void {
  const p = writable(s); if (p.selectedCategory !== category) { p.selectedCategory = category; p.selectedIntent = null; }
}
export function setMissionFact(s: AppState, key: string, value: FactValue): void {
  if (!raw.factKeys.includes(key)) return;
  writable(s).facts[key] = value;
}
/** Do not infer unknown conditions, user health, or work readiness from text. */
export function missionEligibility(p: MissionProgress, m: Mission, variant: MissionVariant): 'eligible' | 'unknown' | 'excluded' {
  const e = m.eligibility;
  if (m.categoryId === 'work' && e.allowedWorkStatuses.length && !e.allowedWorkStatuses.includes(p.workStatus)) return 'excluded';
  const keys = variant === 'basic' ? e.basicRequiredFacts : e.smallRequiredFacts;
  if (keys.some(k => p.facts[k] === false)) return 'excluded';
  return keys.some(k => p.facts[k] !== true) ? 'unknown' : 'eligible';
}
export function missionCandidates(p: MissionProgress, options: { after?: string; exclude?: string[]; allStages?: boolean } = {}): Mission[] {
  if (!p.selectedCategory) return [];
  const stage = p.stages[p.selectedCategory];
  const eligible = missions.filter(m => m.categoryId === p.selectedCategory && (!p.selectedIntent || m.intentIds.includes(p.selectedIntent) || m.intentIds.includes('all'))
    && !options.exclude?.includes(m.id) && ['basic', 'small'].some(v => missionEligibility(p, m, v as MissionVariant) !== 'excluded'));
  const after = missionById(options.after);
  const number = (m: Mission) => Number(m.id.slice(1));
  const ordered = eligible.slice().sort((a, b) => number(a) - number(b));
  if (options.allStages) return ordered;
  if (after) {
    const later = ordered.filter(m => number(m) > number(after));
    const same = later.filter(m => m.stage <= stage);
    return [...same, ...later.filter(m => m.stage > stage)];
  }
  return [...ordered.filter(m => m.stage === stage), ...ordered.filter(m => m.stage < stage)];
}
export function chooseMissionStage(s: AppState, m: Mission): void {
  const p = writable(s); p.stages[m.categoryId] = Math.max(p.stages[m.categoryId], m.stage);
}
export function recommendedMission(p: MissionProgress): Mission | undefined {
  const reports = Object.values(p.sessions).flatMap(s => s.reportedActions);
  const last = reports.reverse().find(a => {
    const m = missionById(a.missionId);
    return m?.categoryId === p.selectedCategory && (!p.selectedIntent || m.intentIds.includes(p.selectedIntent) || m.intentIds.includes('all'))
      && ['basic', 'small'].some(v => missionEligibility(p, m, v as MissionVariant) !== 'excluded');
  });
  if (last && p.selectedIntent) {
    const source = missionById(last.missionId)!;
    if (source.recommendation.afterFinal) return undefined;
    if (source.mode === 'activity' && last.variant === 'small') return source;
    const next = missionCandidates(p, { after: source.id })[0];
    if (next) return next;
  }
  const defaults: Record<string, string> = { drink: 'D01', meal: 'D02', wash: 'D03', clothes: 'D04', space: 'D05', observe: 'D13', outing: 'D14', rest: 'D15', contact: 'D20' };
  const preferred = p.selectedCategory === 'daily' ? missionById(defaults[p.selectedIntent ?? '']) : undefined;
  if (preferred && preferred.stage >= p.stages.daily && ['basic', 'small'].some(v => missionEligibility(p, preferred, v as MissionVariant) !== 'excluded')) return preferred;
  return missionCandidates(p)[0];
}
export function customEligibility(p: MissionProgress, c: CustomMission, variant: MissionVariant) {
  const source = missionById(c.sourceMissionId);
  return source ? missionEligibility(p, source, variant) : 'eligible';
}
function ensureSession(p: MissionProgress) {
  let session = p.activeSessionId ? p.sessions[p.activeSessionId] : undefined;
  if (!session || session.status !== 'active') {
    const id = crypto.randomUUID();
    session = { sessionId: id, status: 'active' as const, reportedActions: [], rewardGranted: false };
    p.sessions[id] = session; p.activeSessionId = id;
  }
  return session;
}
export function missionPlan(s: AppState): Plan | undefined {
  const p = missionProgress(s); const x = p.execution;
  if (!x || activeMissionSession(s)?.status !== 'active') return undefined;
  const c = p.custom.find(item => item.id === x.customId);
  return { activityId: x.missionId || undefined, text: x.text, source: c ? 'design' : 'mission',
    info: { when: x.when ?? c?.trigger ?? '', where: x.where ?? '', minutes: 0, criterion: x.criterion ?? c?.criterion ?? x.text } };
}
function startExecution(s: AppState, date: string, missionId: string, variant: MissionVariant, confirmed: boolean,
  customId?: string, parentMissionId?: string): boolean {
  if (limitReached(s, date)) return false;
  const p = writable(s); const m = missionById(missionId); const c = p.custom.find(item => item.id === customId);
  if ((!m && !c) || (m && m.categoryId !== p.selectedCategory) || (c && c.categoryId !== p.selectedCategory)) return false;
  if (m && (((!c || parentMissionId === m.id) && m.stage > p.stages[m.categoryId]) || ((m.mode !== 'activity' || m.eligibility.inheritCustomActionRequirements) && !c))) return false;
  const status = c ? customEligibility(p, c, variant) : missionEligibility(p, m!, variant);
  if (status === 'excluded' || (status === 'unknown' && !confirmed)) return false;
  ensureSession(p);
  p.execution = { actionId: crypto.randomUUID(), missionId, variant, customId, parentMissionId,
    text: c ? c[variant] : m![variant], record: c ? c[variant] : variant === 'basic' ? m!.record : m!.smallRecord,
    when: c?.trigger ?? '', where: '', criterion: variant === 'small' ? c?.small ?? m!.small : c?.criterion ?? m!.basic };
  const day = (s.days[date] ??= { refresh: 0 }); day.rested = false; day.plan = missionPlan(s);
  return true;
}
export function startMission(s: AppState, date: string, missionId: string, variant: MissionVariant, confirmed: boolean,
  customId?: string, parentMissionId?: string): boolean {
  const m = missionById(missionId);
  if (m?.mode === 'plan_and_execute' || m?.mode === 'day_and_execute') return false;
  return startExecution(s, date, missionId, variant, confirmed, customId, parentMissionId);
}
export function reportMission(s: AppState, date: string): boolean {
  const p = writable(s); const session = activeMissionSession(s); const x = p.execution;
  if (!x || !session || session.status !== 'active' || limitReached(s, date) || session.reportedActions.some(a => a.actionId === x.actionId)) return false;
  const plan = missionPlan(s)!;
  const isCustom = p.custom.some(c => c.id === x.customId);
  const logId = `${date}-${s.logs.length + 1}`;
  s.logs.push({ id: logId, date, activityId: isCustom ? undefined : x.missionId || undefined, text: x.record, plan: plan.info, chips: [], source: plan.source,
    mission: { sessionId: session.sessionId, actionId: x.actionId, variant: x.variant, record: x.record, parentMissionId: x.parentMissionId } });
  session.reportedActions.push({ ...x, date, logId }); p.execution = null;
  if (s.days[date]) delete s.days[date].plan;
  const parent = missionById(x.parentMissionId);
  if (parent?.recommendation.afterFinal) p.dayMapDefault[parent.categoryId] = true;
  return true;
}
export function reduceMission(s: AppState, date: string, confirmed: boolean): boolean {
  const p = writable(s); const x = p.execution; if (!x) return false;
  const c = p.custom.find(v => v.id === x.customId); const m = missionById(x.missionId);
  const status = c ? customEligibility(p, c, 'small') : m ? missionEligibility(p, m, 'small') : 'excluded';
  if (!confirmed || status === 'excluded') return false;
  x.variant = 'small'; x.text = c?.small ?? m!.small; x.record = c?.small ?? m!.smallRecord; x.criterion = x.text;
  (s.days[date] ??= { refresh: 0 }).plan = missionPlan(s); return true;
}
/** Mark the same session closed and award its one pouch in the same store transaction. */
export function closeMissionSession(s: AppState, date: string, sessionId: string, chips?: ReflectChip[]): boolean {
  const p = writable(s); const session = p.sessions[sessionId];
  if (!session || session.status !== 'active') return false;
  const performed = session.reportedActions.length > 0;
  if (performed && !session.rewardGranted) {
    p.packets++; session.rewardGranted = true;
    (s.days[date] ??= { refresh: 0 }).sessionRewarded = true;
    const log = s.logs.find(l => l.id === session.reportedActions[session.reportedActions.length - 1]?.logId);
    if (log && chips) log.chips = chips;
  }
  session.status = performed ? 'closed' : 'skipped'; session.closedOn = date;
  if (p.activeSessionId === sessionId) { p.activeSessionId = null; p.execution = null; if (s.days[date]) delete s.days[date].plan; }
  return performed;
}
export function restMissions(s: AppState, date: string): void {
  const session = activeMissionSession(s); if (session) closeMissionSession(s, date, session.sessionId);
  const day = (s.days[date] ??= { refresh: 0 }); day.rested = true; delete day.plan;
}
export function saveMissionBookmark(s: AppState, bookmark: MissionBookmark): boolean {
  if (!bookmark.nextAction.trim() || !missionById(bookmark.sourceMissionId) || (bookmark.targetMissionId && !missionById(bookmark.targetMissionId))) return false;
  writable(s).bookmarks[bookmark.categoryId] = { ...bookmark, nextAction: bookmark.nextAction.trim() }; return true;
}
export function resumeMissionBookmark(s: AppState, date: string, category: CategoryId, confirmed: boolean): boolean {
  const p = writable(s); const b = p.bookmarks[category]; if (!b || limitReached(s, date)) return false;
  setMissionCategory(s, category);
  const source = missionById(b.targetMissionId ?? b.sourceMissionId);
  if (!source) return false;
  const custom = p.custom.find(c => c.id === b.customId);
  if ((custom ? customEligibility(p, custom, 'small') : missionEligibility(p, source, 'small')) === 'excluded' || !confirmed || (!custom && source.stage > p.stages[category])) return false;
  if (!source.intentIds.includes('all')) p.selectedIntent = source.intentIds[0];
  ensureSession(p);
  p.execution = { actionId: crypto.randomUUID(), missionId: source.id, variant: 'small', text: b.nextAction, record: b.nextAction, customId: b.customId, criterion: b.nextAction };
  const day = (s.days[date] ??= { refresh: 0 }); day.rested = false; day.plan = missionPlan(s); return true;
}
export function saveCustomMission(s: AppState, input: Omit<CustomMission, 'id'>, id?: string): string | null {
  if (![input.name, input.basic, input.small, input.criterion].every(x => x.trim() && x.length <= 500)) return null;
  const original = missionById(input.sourceMissionId);
  if (input.sourceMissionId && (original?.categoryId !== input.categoryId || original.mode !== 'activity' || original.eligibility.inheritCustomActionRequirements)) return null;
  const p = writable(s); const found = p.custom.find(c => c.id === id);
  const next = { ...input, sourceMissionId: found?.sourceMissionId ?? input.sourceMissionId, id: found?.id ?? crypto.randomUUID() };
  if (found) Object.assign(found, next); else p.custom.push(next);
  return next.id;
}
export function saveMyDay(s: AppState, category: CategoryId, entries: DayMission[]): boolean {
  const p = writable(s);
  if (entries.length < 1 || entries.length > 3 || new Set(entries.map(x => x.id)).size !== entries.length
    || entries.some(e => !p.custom.some(c => c.id === e.customId && c.categoryId === category) || !e.cue.trim())) return false;
  p.myDays[category] = structuredClone(entries);
  p.selectedDayEntry ??= {};
  if (!entries.some(e => e.id === p.selectedDayEntry![category])) p.selectedDayEntry[category] = entries[0].id;
  return true;
}

export function startDayMission(s: AppState, date: string, category: CategoryId, entryId: string, variant: MissionVariant,
  confirmed: boolean, parentId?: string, parentVariant: MissionVariant = 'basic'): boolean {
  const p = missionProgress(s); const entries = p.myDays[category] ?? [];
  const entry = entries.find(e => e.id === entryId); const c = p.custom.find(x => x.id === entry?.customId);
  const parent = missionById(parentId);
  if (!entry || !c || p.selectedCategory !== category || (parent && parent.stage > p.stages[category])) return false;
  if (parent && parentVariant === 'basic' && [26, 27, 30].includes(Number(parent.id.slice(1))) && entries.length < 2) return false;
  const ok = startExecution(s, date, parentId ?? c.sourceMissionId ?? '', variant, confirmed, c.id, parentId);
  if (ok && s.days[date]?.plan) {
    p.selectedDayEntry ??= {}; p.selectedDayEntry[category] = entryId;
    p.execution!.when = [entry.cue, entry.time].filter(Boolean).join(' · ');
    p.execution!.where = entry.place ?? '';
    s.days[date].plan = missionPlan(s);
  }
  return ok;
}

export function bookmarkSuggestion(s: AppState): MissionBookmark | null {
  const p = missionProgress(s); const session = activeMissionSession(s) ?? Object.values(p.sessions).filter(x => x.status === 'closed').slice(-1)[0];
  const last = session?.reportedActions[session.reportedActions.length - 1]; const source = missionById(last?.missionId);
  if (!last || !source) return null;
  const custom = p.custom.find(c => c.id === last.customId);
  const target = custom ? missionById(custom.sourceMissionId) ?? source
    : missionCandidates({ ...p, selectedCategory: source.categoryId }, { after: source.id }).find(m => m.mode === 'activity' && !m.intentIds.includes('all')) ?? source;
  return { categoryId: source.categoryId, sourceMissionId: source.id, targetMissionId: target.id,
    nextAction: custom?.small ?? target.small, variant: 'small', customId: last.customId };
}
