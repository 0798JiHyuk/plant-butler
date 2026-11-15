import { validMapMarks, type GardenMark } from './gardenAtlas';
import { LANDMARKS } from './worldGeometry';
import type { AppState } from './types';

export type ZoneId = 'garden' | 'home' | 'shop' | 'junction' | 'cafe' | 'school' | 'work';
export type LayerId = 'nuri' | 'moru' | 'pio';
export interface Exploration {
  version: 1;
  discovered: ZoneId[];
  walked: string[];
  bookmarks: ZoneId[];
  layers: LayerId[];
  destination?: ZoneId;
  lastZone?: ZoneId;
  seat?: { zone: ZoneId; id: string };
  tutorialSeen?: boolean;
  goal?: { kind: string; zone: 'garden' | 'home'; col: number; row: number };
  starterGranted?: boolean;
  purchases?: Record<string, { kind: string; result: string }>;
}
export interface NarrativeProgress {
  version: 2;
  origin?: 'fresh' | 'legacy';
  cursors: Record<string, number>;
  completed: string[];
  choices: Record<string, string>;
  facts: string[];
  decision?: 'own' | 'together' | 'empty';
  draftName?: string;
  mapName?: string;
  marks?: GardenMark[];
}
export const ZONES: Record<ZoneId, { enabled:boolean;worldX:number;worldY:number }> = {
  garden:{enabled:true,worldX:LANDMARKS.garden.x,worldY:LANDMARKS.garden.y},
  home:{enabled:true,worldX:LANDMARKS.home.x,worldY:LANDMARKS.home.y},
  shop:{enabled:true,worldX:LANDMARKS.shop.x,worldY:LANDMARKS.shop.y},
  junction:{enabled:true,worldX:LANDMARKS.junction.x,worldY:LANDMARKS.junction.y},
  cafe:{enabled:true,worldX:LANDMARKS.cafe.x,worldY:LANDMARKS.cafe.y},
  school:{enabled:true,worldX:LANDMARKS.school.x,worldY:LANDMARKS.school.y},work:{enabled:true,worldX:LANDMARKS.work.x,worldY:LANDMARKS.work.y},
};
export const LINKS: [ZoneId, ZoneId][] = [['garden', 'home'], ['garden', 'shop'], ['shop', 'junction'], ['junction', 'cafe'], ['junction', 'school'], ['school', 'work']];
export const LAYER_FACTS = { nuri: 'neuriMapSeen', moru: 'moruMapSeen', pio: 'pioMapSeen' } as const;
export const exploration = (s: AppState): Exploration => s.garden.exploration ?? { version: 1, discovered: ['garden'], walked: [], bookmarks: [], layers: [] };
export const ensureExploration = (s: AppState): Exploration => s.garden.exploration ??= exploration(s);
export const narrative = (s: AppState): NarrativeProgress => s.garden.narrative ?? { version: 2, origin: s.story.seen.length || s.logs.length ? 'legacy' : 'fresh', cursors: {}, completed: [], choices: {}, facts: [] };
export const ensureNarrative = (s: AppState): NarrativeProgress => s.garden.narrative ??= narrative(s);
export const edgeId = (a: ZoneId, b: ZoneId): string => [a, b].sort().join('/');
export function route(from: ZoneId, to: ZoneId): ZoneId[] {
  if (!ZONES[from].enabled || !ZONES[to].enabled) return [];
  const queue: ZoneId[][] = [[from]], seen = new Set<ZoneId>([from]);
  while (queue.length) {
    const path = queue.shift()!, last = path[path.length-1];
    if (last === to) return path;
    for (const [a, b] of LINKS) {
      const next = a === last ? b : b === last ? a : undefined;
      if (next && ZONES[next].enabled && !seen.has(next)) { seen.add(next); queue.push([...path, next]); }
    }
  }
  return [];
}
/** Only called by the world after actual entry; opening shop/map never calls this. */
export function discover(s: AppState, zone: ZoneId): boolean {
  if (!ZONES[zone].enabled) return false;
  const p = ensureExploration(s), fresh = !p.discovered.includes(zone);
  if (fresh) p.discovered.push(zone);
  if (p.lastZone && LINKS.some(([a, b]) => edgeId(a, b) === edgeId(p.lastZone!, zone))) {
    const edge = edgeId(p.lastZone, zone);
    if (!p.walked.includes(edge)) p.walked.push(edge);
  }
  p.lastZone = zone;
  if (p.destination === zone) delete p.destination;
  return fresh;
}
export function chooseDestination(s: AppState, zone: ZoneId): boolean {
  const p = ensureExploration(s);
  if (!ZONES[zone].enabled || !p.discovered.includes(zone) || !route(p.lastZone ?? 'garden', zone).length) return false;
  p.destination = zone; return true;
}
/** A visible road end is guidance only; its destination name remains concealed. */
export function frontierOptions(s: AppState): ZoneId[] {
  const p=exploration(s);
  return (Object.keys(ZONES) as ZoneId[]).filter(id=>ZONES[id].enabled&&!p.discovered.includes(id)&&id!=='home'
    && LINKS.some(([a,b])=>(a===id&&p.discovered.includes(b))||(b===id&&p.discovered.includes(a))));
}
export function chooseFrontier(s: AppState, zone: ZoneId): boolean {
  if(!frontierOptions(s).includes(zone))return false;
  ensureExploration(s).destination=zone;return true;
}
export function bookmark(s: AppState, zone: ZoneId): boolean {
  const p = ensureExploration(s);
  if (!ZONES[zone].enabled || !p.discovered.includes(zone)) return false;
  if (!p.bookmarks.includes(zone)) p.bookmarks.push(zone);
  return true;
}
export function toggleLayer(s: AppState, layer: LayerId): void {
  if (!narrative(s).facts.includes(LAYER_FACTS[layer])) return;
  const p = ensureExploration(s);
  p.layers = p.layers.includes(layer) ? p.layers.filter(x => x !== layer) : [...p.layers, layer];
}
export function zoneAt(x:number,y:number,indoor:boolean):ZoneId {
  if(indoor)return 'home';
  if(y<1200)return x>3000?'work':'school';
  if(x<1500&&y>1450)return 'garden';
  if(x<2260&&y>1700)return 'shop';
  if(x>2780&&y>1740)return 'cafe';
  return 'junction';
}
/** Existing snapshots keep all their economy/mission fields. No past story facts are guessed. */
export function validExploration(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  const zones = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string' && x in ZONES);
  return p.version === 1 && zones(p.discovered) && zones(p.bookmarks)
    && Array.isArray(p.walked) && p.walked.every(x => typeof x === 'string')
    && Array.isArray(p.layers) && p.layers.every(x => ['nuri', 'moru', 'pio'].includes(String(x)))
    && (p.destination === undefined || zones([p.destination])) && (p.lastZone === undefined || zones([p.lastZone]))
    && (p.goal === undefined || !!p.goal && typeof p.goal === 'object' && typeof (p.goal as Record<string,unknown>).kind === 'string' && ['garden','home'].includes(String((p.goal as Record<string,unknown>).zone)) && Number.isInteger((p.goal as Record<string,unknown>).col) && Number.isInteger((p.goal as Record<string,unknown>).row))
    && (p.purchases === undefined || !!p.purchases && typeof p.purchases === 'object' && !Array.isArray(p.purchases) && Object.values(p.purchases).every(x=>!!x&&typeof x==='object'&&typeof x.kind==='string'&&['ok','poor','unknown'].includes(x.result)))
    && (p.starterGranted === undefined || typeof p.starterGranted === 'boolean')
    && (p.seat === undefined || typeof p.seat === 'object' && p.seat !== null && zones([(p.seat as Record<string, unknown>).zone]) && typeof (p.seat as Record<string, unknown>).id === 'string');
}
export function validNarrative(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
  const record = (v: unknown, check: (x: unknown) => boolean) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(check);
  return p.version === 2 && (p.origin === undefined || p.origin === 'fresh' || p.origin === 'legacy') && strings(p.completed) && strings(p.facts)
    && record(p.cursors, x => Number.isSafeInteger(x) && Number(x) >= 0) && record(p.choices, x => typeof x === 'string')
    && (p.decision === undefined || ['own', 'together', 'empty'].includes(String(p.decision)))
    && (p.mapName === undefined || typeof p.mapName === 'string' && [...p.mapName].length <= 16)
    && (p.marks === undefined || validMapMarks(p.marks))
    && (p.draftName === undefined || typeof p.draftName === 'string' && [...p.draftName].length <= 16);
}
