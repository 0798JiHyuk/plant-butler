// @ts-nocheck
// 조원 s0-web-demo-base(669d1e5)의 저장 검사 코드를 그대로 복사한 테스트용 파일이다. 우리 저장 결과가 조원 버전에서도 읽히는지 확인하는 데만 쓴다. 수정하지 않는다.
import type { AppState } from '../../core/types';
import { plantById } from '../../core/plants';
import { decodeMissionProgress } from './teammate_missionState';

export function createState(): AppState {
  return { version: 1, logs: [], garden: { items: [], plants: [], storage: [] }, seeds: [], fruit: 0, freePackets: 0, story: { seen: [], choices: {} }, bonusPackets: 0, visits: { count: 0 }, purchases: 0, days: {}, settings: { sound: true, demo: false, dayOffset: 0 } };
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown) => typeof v === 'string';
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const count = (v: unknown) => finite(v) && Number.isSafeInteger(v) && (v as number) >= 0;
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);
const one = (v: unknown, options: readonly unknown[]) => options.includes(v);
const list = (v: unknown, check: (v: unknown) => boolean) => Array.isArray(v) && v.every(check);
const date = (v: unknown) => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string);
const kinds = ['flowerpot', 'table', 'shelf', 'bench', 'birdbath', 'hammock', 'flower', 'pot', 'lamp'];
const source = (v: unknown) => one(v, ['mission', 'daily', 'design']);
const info = (v: unknown) => object(v) && text(v.when) && text(v.where) && finite(v.minutes) && optional(v.criterion, text);
const plantId = (v: unknown) => typeof v === 'string' && !!plantById(v);
const plant = (v: unknown) => object(v) && text(v.id) && plantId(v.plantId) && date(v.date)
  && optional(v.harvested, x => typeof x === 'boolean') && optional(v.harvestedOn, date);
const position = (v: Record<string, unknown>) => Number.isInteger(v.col) && Number.isInteger(v.row);

/** 읽기만으로 기존 원본을 바꾸지 않는다. 알 수 없는 버전/깨진 저장본은 덮어쓰지 않는다. */
export function decodeState(raw: unknown): AppState {
  if (!object(raw) || raw.version !== 1 || !object(raw.garden) || !object(raw.settings)) throw new Error('Invalid progress');
  const base = createState();
  const missions = raw.missions === undefined ? undefined : decodeMissionProgress(raw.missions);
  const v = { ...base, ...raw, garden: { ...base.garden, ...raw.garden }, settings: { ...base.settings, ...raw.settings } };
  const valid = list(v.logs, x => object(x) && text(x.id) && date(x.date) && optional(x.activityId, text) && optional(x.text, text)
      && info(x.plan) && source(x.source) && list(x.chips, c => one(c, ['achieved', 'easier', 'again']))
      && optional(x.mission, m => object(m) && text(m.sessionId) && text(m.actionId) && one(m.variant, ['basic', 'small']) && text(m.record) && optional(m.parentMissionId, text)))
    && list(v.garden.items, x => object(x) && text(x.id) && one(x.kind, kinds) && count(x.variant) && position(x))
    && list(v.garden.plants, x => object(x) && plant(x) && position(x))
    && list(v.garden.storage, x => object(x) && (x.type === 'plant' ? plant(x) : x.type === 'decor' && text(x.id) && one(x.decorKind, kinds) && count(x.variant)))
    && optional(v.garden.bed, x => object(x) && finite(x.x) && finite(x.y))
    && list(v.seeds, x => object(x) && text(x.id) && plantId(x.plantId))
    && [v.fruit, v.freePackets, v.bonusPackets, v.purchases].every(count)
    && object(v.story) && list(v.story.seen, text) && object(v.story.choices) && Object.values(v.story.choices).every(count)
    && object(v.visits) && count(v.visits.count) && optional(v.visits.last, date)
    && object(v.days) && Object.entries(v.days).every(([key, day]) => date(key) && object(day) && count(day.refresh)
      && optional(day.energy, x => one(x, ['heavy', 'normal', 'good'])) && optional(day.rested, x => typeof x === 'boolean')
      && optional(day.packet, x => one(x, ['ready', 'opened']))
      && optional(day.sessionRewarded, x => typeof x === 'boolean')
      && optional(day.plan, x => object(x) && source(x.source) && optional(x.activityId, text) && optional(x.text, text) && info(x.info)))
    && typeof v.settings.sound === 'boolean' && typeof v.settings.demo === 'boolean'
    && Number.isInteger(v.settings.dayOffset) && optional(v.settings.viewZoom, x => finite(x) && (x as number) > 0);
  if (!valid) throw new Error('Invalid progress');
  return structuredClone({ version: 1, logs: v.logs, garden: v.garden, seeds: v.seeds, fruit: v.fruit,
    freePackets: v.freePackets, bonusPackets: v.bonusPackets, story: v.story, visits: v.visits,
    purchases: v.purchases, days: v.days, settings: v.settings, ...(missions ? { missions } : {}) }) as AppState;
}

export function stateKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stateKey).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => `${JSON.stringify(k)}:${stateKey(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function hasProgress(state: AppState): boolean {
  const base = createState();
  return stateKey({ ...state, settings: base.settings }) !== stateKey(base);
}
