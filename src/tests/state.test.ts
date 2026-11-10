import { describe, expect, it } from 'vitest';
import { fillSample } from '../core/demo';
import { createMissionState, createState, decodeState, isTeammateFormat, toSnapshot } from '../core/state';

const slots = {
  decor: (u: unknown[]) => ({ col: u.length % 20, row: 7 }),
  plant: (u: unknown[]) => ({ col: u.length % 20, row: 15 }),
};

describe('decodeState', () => {
  it('우리 상태를 한 칸도 잃지 않고 그대로 돌려준다(대화 기록·회차 주머니·미션 포함)', () => {
    const s = createState();
    fillSample(s, '2026-10-26', slots);
    s.chats.push({ id: 'c1', date: '2026-10-25', npc: 'nuri', lines: [{ from: 'me', text: '안녕', keep: true }, { from: 'nuri', text: '응' }], note: '한 줄', mind: 'steady' });
    s.story.lastDay = '2026-10-25';
    s.sessionPackets = 2;
    s.missions = { ...createMissionState(), category: 'daily', intents: { daily: 'drink' }, bookmarks: { daily: { missionId: 'D06', variant: 'small' } }, last: { daily: 'D01' } };
    expect(decodeState(s)).toEqual(s);
  });

  it('깨진 저장과 모르는 버전은 거부한다', () => {
    expect(() => decodeState(null)).toThrow();
    expect(() => decodeState({ version: 2 })).toThrow();
    const bad = createState();
    (bad as { fruit: unknown }).fruit = -1;
    expect(() => decodeState(bad)).toThrow();
  });

  it('예전 저장본에 없는 칸은 기본값으로 채우고, 단계는 칸별로 채운다', () => {
    const old = { ...createState(), missions: { ...createMissionState(), stage: { daily: 3 } } } as Record<string, unknown>;
    delete old.chats;
    delete old.sessionPackets;
    const out = decodeState(old);
    expect(out.chats).toEqual([]);
    expect(out.sessionPackets).toBe(0);
    expect(out.missions.stage).toEqual({ daily: 3, academic: 1, work: 1 });
  });

  it('조원 형식의 진행을 우리 모양으로 바꾼다', () => {
    const legacy = {
      ...createState(),
      logs: [{ id: '2026-11-09-1', date: '2026-11-09', activityId: 'D01', text: '쓸 컵을 헹궈 준비했다.', plan: { when: '', where: '', minutes: 0 }, chips: [], source: 'mission',
        mission: { sessionId: 's1', actionId: 'a1', variant: 'basic', record: '쓸 컵을 헹궈 준비했다.' } }],
      days: { '2026-11-09': { refresh: 0, sessionRewarded: true } },
      missions: {
        selectedCategory: 'daily', selectedIntent: 'drink', workStatus: 'unknown', stages: { daily: 6, academic: 1, work: 1 }, facts: {},
        sessions: { s1: { sessionId: 's1', status: 'active', rewardGranted: false,
          reportedActions: [{ actionId: 'a1', missionId: 'D01', variant: 'basic', date: '2026-11-09', logId: '2026-11-09-1', text: '', record: '' }] } },
        activeSessionId: 's1', execution: null,
        bookmarks: { daily: { categoryId: 'daily', sourceMissionId: 'D01', targetMissionId: 'D06', nextAction: 'x', variant: 'small' } },
        custom: [], myDays: {}, dayMapDefault: {}, packets: 2,
      },
    };
    expect(isTeammateFormat(legacy)).toBe(true);
    const out = decodeState(legacy);
    expect(out.missions.category).toBe('daily');
    expect(out.missions.intents).toEqual({ daily: 'drink' });
    expect(out.missions.stage.daily).toBe(4);
    expect(out.missions.session).toEqual({ id: 's1', date: '2026-11-09', actions: [{ missionId: 'D01', variant: 'basic' }] });
    expect(out.missions.bookmarks.daily).toEqual({ missionId: 'D06', variant: 'small' });
    expect(out.sessionPackets).toBe(2);
    expect(out.logs[0]).toMatchObject({ missionId: 'D01', variant: 'basic', sessionId: 's1' });
    expect(out.logs[0].activityId).toBeUndefined();
    expect('mission' in out.logs[0]).toBe(false);
    expect(out.days['2026-11-09'].sessions).toBe(1);
    expect('sessionRewarded' in out.days['2026-11-09']).toBe(false);
  });

  it('서버로 보내는 모양에는 대화 기록이 없고 나머지는 그대로다', () => {
    const s = createState();
    s.chats.push({ id: 'c1', date: '2026-10-25', npc: 'moru', lines: [{ from: 'me', text: '비밀' }] });
    s.fruit = 3;
    const snap = toSnapshot(s);
    expect(snap.chats).toEqual([]);
    expect(snap.fruit).toBe(3);
    expect(s.chats).toHaveLength(1); // 원본은 그대로
  });
});
