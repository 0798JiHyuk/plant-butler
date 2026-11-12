import { describe, expect, it } from 'vitest';
import { createMissionState, createState, decodeState, encodeState, toSnapshot } from '../core/state';
import type { AppState } from '../core/types';
import { decodeState as theirDecodeState } from './fixtures/teammate_state';
import { decodeMissionProgress as theirDecodeMissions } from './fixtures/teammate_missionState';

const D = '2026-11-12';

/** 우리 쪽에서 쓰는 거의 모든 미션 칸이 채워진 상태 */
function ours(): AppState {
  const s = createState();
  s.missions = {
    ...createMissionState(), category: 'daily', intents: { daily: 'drink', academic: 'exam' }, workStatus: 'returned', stage: { daily: 2, academic: 1, work: 3 },
    skip: { date: D, facts: ['hasCup'], cards: ['D01'] }, seq: 5, last: { daily: 'D01', academic: 'A01' },
    bookmarks: { daily: { missionId: 'D06', variant: 'small' } },
    session: { id: `${D}-s5`, date: D, actions: [{ missionId: 'D01', variant: 'basic' }, { missionId: 'D01', variant: 'small' }] },
  };
  s.sessionPackets = 2;
  s.story.lastDay = D;
  s.logs = [
    { id: `${D}-1`, date: D, missionId: 'D01', variant: 'basic', sessionId: `${D}-s5`, plan: { when: '지금', where: '', minutes: 0 }, chips: ['achieved'], source: 'mission' },
    { id: `${D}-2`, date: D, missionId: 'D01', variant: 'small', sessionId: `${D}-s5`, plan: { when: '지금', where: '', minutes: 0 }, chips: [], source: 'mission' },
    { id: `${D}-3`, date: D, text: '공원 다녀오기', sessionId: `${D}-s5`, plan: { when: '오후 3시', where: '', minutes: 0, criterion: '입구까지' }, chips: [], source: 'design' },
  ];
  s.days[D] = { refresh: 0, energy: 'normal', sessions: 1, plan: { missionId: 'D06', variant: 'small', info: { when: '지금', where: '', minutes: 0 }, source: 'mission' } };
  s.chats.push({ id: 'c1', date: D, npc: 'nuri', lines: [{ from: 'me', text: '안녕' }] });
  return s;
}

describe('조원 버전과 서로 읽을 수 있는 저장', () => {
  it('우리 상태를 저장 모양으로 바꿨다가 불러오면 한 칸도 달라지지 않는다', () => {
    const s = ours();
    expect(decodeState(JSON.parse(JSON.stringify(encodeState(s))))).toEqual(s);
  });

  it('기본 상태도 마찬가지다', () => {
    const s = createState();
    expect(decodeState(JSON.parse(JSON.stringify(encodeState(s))))).toEqual(s);
  });

  it('저장 결과의 미션 칸은 조원의 미션 저장 검사를 통과하고 회차 주머니·열린 회차가 조원 모양으로 들어 있다', () => {
    const enc = encodeState(ours()) as unknown as { missions: Record<string, unknown> };
    const m = theirDecodeMissions(enc.missions);
    expect(m.selectedCategory).toBe('daily');
    expect(m.selectedIntent).toBe('drink');
    expect(m.packets).toBe(2);
    expect(m.activeSessionId).toBe(`${D}-s5`);
    expect(m.sessions[`${D}-s5`].reportedActions.map((a) => [a.missionId, a.variant])).toEqual([['D01', 'basic'], ['D01', 'small']]);
    expect(m.bookmarks.daily).toMatchObject({ sourceMissionId: 'D06', targetMissionId: 'D06', variant: 'small' });
  });

  it('저장 결과 전체가 조원 버전의 불러오기를 통과하고, 조원 버전을 거쳐 와도 우리 값이 남는다(대화 기록은 서버에 없으므로 제외)', () => {
    const snap = toSnapshot(ours());
    const wire = JSON.parse(JSON.stringify(encodeState(snap)));
    const theirs = theirDecodeState(wire); // 조원 버전이 읽고
    const back = decodeState(JSON.parse(JSON.stringify(theirs))); // 다시 저장했다가 우리가 읽는다
    expect(back).toEqual(snap);
  });

  it('조원 버전은 같은 날 기록을 보고 활동 이름을 찾을 수 있도록 activityId와 mission 정보가 들어 있다', () => {
    const wire = JSON.parse(JSON.stringify(encodeState(ours()))) as AppState & { logs: { activityId?: string; mission?: { variant: string } }[] };
    expect(wire.logs[0].activityId).toBe('D01');
    expect(wire.logs[0].mission?.variant).toBe('basic');
    expect(wire.logs[2].activityId).toBeUndefined(); // 직접 적은 일은 그대로
    expect((wire.days[D] as { sessionRewarded?: boolean }).sessionRewarded).toBe(true);
  });

  it('조원 형식에서 온 직접 만든 미션·하루 지도·책갈피 문구는 우리 버전에서 저장해도 조원 칸으로 되돌아간다', () => {
    const base = ours();
    const wire = JSON.parse(JSON.stringify(encodeState(base)));
    wire.missions.custom = [{ id: 'c1', categoryId: 'daily', name: '내 미션', basic: '물 마시기', small: '컵 꺼내기', trigger: '아침', criterion: '한 모금' }];
    wire.missions.myDays = { daily: [{ id: 'e1', customId: 'c1', cue: '먼저', time: '8시' }] };
    wire.missions.dayMapDefault = { daily: true };
    wire.missions.bookmarks.daily.nextAction = '컵을 꺼내 두기';
    wire.missions.bookmarks.daily.locationLabel = '부엌';
    const loaded = decodeState(wire); // 조원 버전에서 저장한 것을 우리가 읽고
    const again = JSON.parse(JSON.stringify(encodeState(loaded))); // 우리가 다시 저장한다
    expect(again.missions.custom).toEqual(wire.missions.custom);
    expect(again.missions.myDays).toEqual(wire.missions.myDays);
    expect(again.missions.dayMapDefault).toEqual({ daily: true });
    expect(again.missions.bookmarks.daily).toMatchObject({ nextAction: '컵을 꺼내 두기', locationLabel: '부엌' });
    expect(() => theirDecodeMissions(again.missions)).not.toThrow();
  });

  it('조원이 올린 단계(5~6)는 우리 화면에서는 4로 보이지만 다시 저장해도 줄어들지 않는다', () => {
    const wire = JSON.parse(JSON.stringify(encodeState(createState())));
    wire.missions.stages = { daily: 6, academic: 1, work: 1 };
    const loaded = decodeState(wire);
    expect(loaded.missions.stage.daily).toBe(4);
    expect(JSON.parse(JSON.stringify(encodeState(loaded))).missions.stages.daily).toBe(6);
  });

  it('열린 회차에 해낸 행동이 없어도(계획만 세운 상태) 조원 검사를 통과한다', () => {
    const s = createState();
    s.missions.session = { id: `${D}-s1`, date: D, actions: [] };
    s.missions.seq = 1;
    const enc = encodeState(s) as unknown as { missions: Record<string, unknown> };
    expect(() => theirDecodeMissions(enc.missions)).not.toThrow();
    expect(decodeState(JSON.parse(JSON.stringify(enc)))).toEqual(s);
  });
});
