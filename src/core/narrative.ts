import { validMapMarks, type GardenMark } from './gardenAtlas';
import raw from './data/story-map.json';
import type { AppState } from './types';
import { ensureNarrative, narrative, exploration, LAYER_FACTS } from './exploration';
import { pendingPacketCount } from './rules';
import { canHarvest, giftAvailable } from './economy';
import { todayKey } from './clock';

export interface NarrativeLine { speaker: string; text: string; condition?: string; fact?: string }
export interface NarrativeChoice { id: string; text: string; response: string; effect: string; condition?: string }
export interface NarrativeScene { id: string; title: string; type: string; revision: string; lines: NarrativeLine[]; choices: NarrativeChoice[] }
export const narrativeScenes: NarrativeScene[] = raw.scenes;
export const MAIN = ['ST-P01', 'ST-P02', 'ST-A01', 'ST-B01', 'ST-C01', 'ST-D01', 'ST-E01'];
export const sceneById = (id: string) => narrativeScenes.find(x => x.id === id)!;
export function sceneAvailable(s: AppState, id: string): boolean {
  const p = narrative(s), facts = p.facts, done = p.completed;
  if (id === 'ST-P01') return true;
  if (id === 'ST-P02') return facts.includes('greetingSeen') || done.includes('ST-P01') || s.story.seen.includes('intro');
  if (id === 'ST-A01') return facts.includes('blankNameSeen');
  if (id === 'ST-B01') return facts.includes('neuriMapSeen');
  if (id === 'ST-C01') return facts.includes('moruMapSeen');
  if (id === 'ST-D01') return ['blankNameSeen', ...Object.values(LAYER_FACTS)].every(x => facts.includes(x));
  if (id === 'ST-E01') return !!p.decision && facts.includes('slotSeen');
  if (id === 'ST-P03') return true;
  if (id === 'ST-A02') return !!s.missions?.activeSessionId && !!s.missions.sessions[s.missions.activeSessionId]?.reportedActions.length;
  if (id === 'ST-A03') return s.seeds.length > 0;
  if (id.startsWith('ST-B')) return facts.includes('moruMapSeen');
  if (id.startsWith('ST-C')) return facts.includes('pioMapSeen');
  if (id === 'ST-V01') return exploration(s).discovered.includes('cafe');
  if (id.startsWith('ST-V') || id === 'ST-X01') return false; // P1 locations not built.
  if (id === 'ST-R05') return false; // No team-verified help resources supplied.
  if (id === 'ST-R09') return !!exploration(s).goal;
  if (id === 'ST-R02') return !!s.missions?.execution || !!s.days[todayKey()]?.plan;
  if (id === 'ST-R06') return s.garden.plants.some(x => canHarvest(x, todayKey(), s.days));
  if (id === 'ST-R07') return pendingPacketCount(s) > 0;
  if (id === 'ST-R08') return s.seeds.length > 0;
  if (id === 'ST-R10') return giftAvailable(s, todayKey());
  if (id.startsWith('ST-R')) return true;
  if (id === 'ST-S01' || id === 'ST-S02') return facts.includes('neuriMapSeen');
  if (id === 'ST-S03' || id === 'ST-S04') return facts.includes('moruMapSeen');
  return facts.includes('pioMapSeen');
}
/** Unknown prose conditions are hidden instead of guessed. */
function condition(s: AppState, value?: string): boolean {
  if (!value) return true;
  if (value.includes('granted_unopened')) return s.story.seen.includes('free-packet') && s.freePackets > 0;
  if (value.includes('available')) return !s.story.seen.includes('free-packet');
  if (value.includes('opened')) return s.story.seen.includes('free-packet') && s.freePackets === 0;
  if (value.includes('current owned unconsumed seed')) return s.seeds.length > 0;
  if (value.includes('미인사')) return true;
  if (value.includes('실제 배치가 있을')) return s.garden.items.length > 0;
  if (value.includes('참조할 배치가 없')) return s.garden.items.length === 0;
  if (value.includes('실제 수령 가능')) return giftAvailable(s, todayKey());
  return false;
}
export function sceneLines(s: AppState, scene: NarrativeScene): NarrativeLine[] {
  const lines = scene.lines.filter(l => condition(s, l.condition));
  if (scene.id === 'ST-E01') {
    const p = narrative(s), choice = p.choices['ST-C01'];
    return [
      { speaker: '느리', text: '이건 ‘돌 보고 싶은 날’이라고 적어야겠어.' },
      { speaker: '모루', text: '다음 표시는 써보고 고치자.' },
      { speaker: '피오', text: choice === 'r2-C01-C2' ? '조용한 자리 이야기도 기억해둘게. 안개 지도와는 따로.' : choice === 'r2-C01-C3' ? '소리 수첩은 다음에 펼쳐볼게.' : choice === 'r2-C01-C1' ? '아직 가보지 않은 곳의 안개를 남겨뒀어.' : '다음에 적을 자리도 남겨뒀어.' },
      ...(confirmedFact(s,'fourthStoneSeen')==='confirmed' ? [
        {speaker:'느리',text:'새로 찾은 돌도 다시 보고 올게.'},{speaker:'피오',text:'이번엔 어디가 달라 보이는지 적어둬.'},
      ] : confirmedFact(s,'fourthStoneSeen')==='unseen' ? [
        {speaker:'느리',text:'난 저 돌 셋을 다시 보고 올게. 네 번째가 있는지도 보고.'},{speaker:'피오',text:'이번엔 찾으면 알려줘.'},{speaker:'느리',text:'이름부터 떠오르면 어쩌지?'},
      ] : [{speaker:'느리',text:'난 그늘에 있는 돌을 다시 보고 올게.'},{speaker:'피오',text:'이번엔 어디가 달라 보이는지 적어둬.'}]),
    ];
  }
  return lines.map(l => ({ ...l, text: l.text.replace(/^“|”$/g, '') }));
}
export const sceneChoices = (s: AppState, scene: NarrativeScene) => scene.choices.filter(c => condition(s, c.condition));
export function confirmLine(s: AppState, id: string, index: number): void {
  if (!sceneAvailable(s, id)) return;
  const scene = sceneById(id), lines = sceneLines(s, scene), p = ensureNarrative(s);
  if (!Number.isInteger(index) || index < 0 || index >= lines.length || index > (p.cursors[id] ?? 0)) return;
  p.cursors[id] = Math.max(p.cursors[id] ?? 0, index + 1);
  const add = (fact: string) => { if (!p.facts.includes(fact)) p.facts.push(fact); };
  if(lines[index].fact)add(lines[index].fact!);
}
export function commitChoice(s: AppState, id: string, choiceId: string): boolean {
  if (!sceneAvailable(s, id)) return false;
  const scene = sceneById(id), p = ensureNarrative(s);
  if ((p.cursors[id] ?? 0) < sceneLines(s, scene).length || !sceneChoices(s, scene).some(c => c.id === choiceId)) return false;
  p.choices[id] = choiceId;
  if (id === 'ST-D01' && choiceId === 'r2-D01-C1') return true; // Name editor: cancellation is pending.
  if (id === 'ST-D01') p.decision = choiceId === 'r2-D01-C2' ? 'together' : 'empty';
  if (!p.completed.includes(id)) p.completed.push(id);
  return true;
}
export function completeNameDecision(s: AppState, value: string | null, marks:GardenMark[]=[]): boolean {
  const p = ensureNarrative(s);
  if(!p.facts.includes('slotSeen')||!validMapMarks(marks)||value!==null&&((!value.trim()&&!marks.length)||[...value.trim()].length>16||[...value].some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)))return false;
  if (value !== null) { p.mapName = value.trim(); p.marks=structuredClone(marks); p.decision = 'own'; } else p.decision = 'empty';
  p.choices['ST-D01'] = value === null ? 'r2-D01-NAME-EMPTY' : 'r2-D01-NAME-SAVE';
  if (!p.completed.includes('ST-D01')) p.completed.push('ST-D01');
  return true;
}
export function nextMain(s: AppState): string | undefined {
  const p=narrative(s);
  const confirmed:Record<string,string>={'ST-P01':'greetingSeen','ST-P02':'blankNameSeen','ST-A01':'neuriMapSeen','ST-B01':'moruMapSeen','ST-C01':'pioMapSeen'};
  return MAIN.find(id=>sceneAvailable(s,id)&&(id==='ST-P01'&&p.completed.includes(id)?false:confirmed[id]?!p.facts.includes(confirmed[id]):!p.completed.includes(id)));
}

export function confirmedFact(s:AppState,key:string):'confirmed'|'unseen'|'unknown' {
  const p=narrative(s);
  return p.facts.includes(key)?'confirmed':p.origin==='fresh'?'unseen':'unknown';
}
export function choiceReply(s:AppState,scene:NarrativeScene,choice:NarrativeChoice):NarrativeLine|undefined {
  if(choice.id==='r2-C01-C2')return {speaker:'피오',text:confirmedFact(s,'quietPlaceSeen')==='confirmed'?'그늘에서 조용한 자리도 봤지. 소리 이야기는 그쪽에서 이어가자.':confirmedFact(s,'quietPlaceSeen')==='unseen'?'안개가 걷힌 곳이 모두 조용한 자리는 아니야. 소리 이야기는 따로 들려줄게.':'조용한 자리 이야기는 안개 지도와 따로 들려줄게.'};
  const text=choice.response.match(/“([^”]+)”/)?.[1]??(scene.revision==='r2'&&!choice.response.includes(':')?choice.response:'');
  if(!text)return undefined;
  const attributed=(choice.response+' '+choice.effect).match(/(느리|모루|피오|새싹이): “/);
  return {speaker:attributed?.[1]??scene.lines[scene.lines.length-1]?.speaker??'',text};
}
