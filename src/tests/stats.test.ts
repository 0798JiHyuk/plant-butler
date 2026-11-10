import { describe, expect, it } from 'vitest';
import { activityById } from '../core/activities';
import { countThisWeek, directPlanRatio, factLine, factLineFor, groupByDate, weekKindsCount, weekStart } from '../core/stats';
import type { LogEntry } from '../core/types';

const info = { when: '지금', where: '집 근처', minutes: 5 };
const log = (date: string, source: LogEntry['source'] = 'mission'): LogEntry => ({
  id: date, date, activityId: 'walk5', plan: info, chips: [], source,
});

describe('stats', () => {
  it('주는 월요일에 시작한다', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // 일요일
    expect(weekStart('2026-10-26')).toBe('2026-10-26'); // 월요일
  });

  it('이번 주 같은 활동 횟수만 센다', () => {
    const logs = [log('2026-10-25'), log('2026-10-26'), log('2026-10-28')];
    expect(countThisWeek(logs, 'walk5', '2026-10-28')).toBe(2);
  });

  it('사실 피드백은 숫자만 말한다', () => {
    const logs = [log('2026-10-26'), log('2026-10-27'), log('2026-10-28')];
    expect(factLine(logs, activityById('walk5')!, '2026-10-28')).toBe('이번 주 집 앞 5분 걷기 3번째예요.');
  });

  it('직접 계획 비율', () => {
    expect(directPlanRatio([])).toBe(0);
    expect(directPlanRatio([log('2026-10-26', 'design'), log('2026-10-27')])).toBe(0.5);
  });

  it('직접 적은 일도 같은 방식으로 센다', () => {
    const mine = (date: string): LogEntry => ({ id: date, date, text: '공원 다녀오기', plan: info, chips: [], source: 'design' });
    const logs = [mine('2026-10-26'), mine('2026-10-27')];
    expect(factLineFor(logs, logs[1], '2026-10-27')).toBe('이번 주 공원 다녀오기 2번째예요.');
  });

  it('주간 요약은 서로 다른 일의 수만 센다', () => {
    const other: LogEntry = { ...log('2026-10-27'), activityId: 'water' };
    expect(weekKindsCount([log('2026-10-26'), log('2026-10-28'), other, log('2026-10-20')], '2026-10-28')).toBe(2);
  });

  it('날짜별로 묶고 최신이 먼저다', () => {
    const groups = groupByDate([log('2026-10-26'), log('2026-10-28'), log('2026-10-28')]);
    expect(groups.map((g) => [g.date, g.logs.length])).toEqual([['2026-10-28', 2], ['2026-10-26', 1]]);
  });

  it('카드 기록은 미션 이름으로 말하고 같은 카드를 센다', () => {
    const card = (date: string, missionId: string): LogEntry => ({
      id: date + missionId, date, missionId, variant: 'basic', plan: { when: '지금', where: '', minutes: 0 }, chips: [], source: 'mission',
    });
    const logs = [card('2026-10-26', 'D01'), card('2026-10-27', 'D06'), card('2026-10-28', 'D01')];
    expect(factLineFor(logs, logs[2], '2026-10-28')).toBe('이번 주 쓸 컵 준비하기 2번째예요.');
    expect(weekKindsCount(logs, '2026-10-28')).toBe(2);
  });
});
