import raw from './data/activities.json';
import missionData from './data/missions-v2.json';
import type { Activity } from './types';

export const activities = raw as unknown as Activity[];

export function activityById(id: string | undefined): Activity | undefined {
  if (!id) return undefined;
  const legacy = activities.find(a => a.id === id);
  if (legacy) return legacy;
  const mission = missionData.missions.find(m => m.id === id);
  return mission ? { id, name: mission.name, minutes: 0, kind: mission.categoryId === 'daily' ? 'selfcare' : 'joy', smallerId: null, icon: '🌱' } : undefined;
}

export function activityIconId(id: string | undefined): string {
  if (!id) return 'draw';
  if (activities.some(a => a.id === id)) return id;
  const mission = missionData.missions.find(m => m.id === id);
  const intent = mission?.intentIds[0];
  const icons: Record<string, string> = { drink: 'water', meal: 'meal', wash: 'wash', clothes: 'shower', space: 'window', observe: 'window', outing: 'near-home', rest: 'music', contact: 'message', course: 'book', assignment: 'draw', exam: 'book', work: 'book' };
  return (intent && icons[intent]) || (mission?.categoryId === 'academic' ? 'book' : 'draw');
}

export function smallerOf(a: Activity): Activity | undefined {
  return activityById(a.smallerId ?? undefined);
}
