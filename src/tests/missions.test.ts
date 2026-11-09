import { describe, expect, it } from 'vitest';
import { createState, decodeState, stateKey } from '@/core/state';
import { activeMissionSession, bookmarkSuggestion, chooseMissionStage, closeMissionSession, createMissionProgress, customEligibility,
  missionById, missionCandidates, missionCatalog, missionEligibility, missions, reduceMission, reportMission,
  restMissions, recommendedMission, resumeMissionBookmark, saveCustomMission, saveMissionBookmark, saveMyDay, setMissionCategory, startDayMission, startMission } from '@/core/missions';
import { openMissionPacket, pendingPacketCount } from '@/core/rules';
import { canHarvest } from '@/core/economy';
import { copy } from '@/core/copy';
const D = '2026-11-09';
function fixture(category: 'daily' | 'academic' | 'work' = 'daily', intent = 'drink') {
  const s = createState(); setMissionCategory(s, category); s.missions!.selectedIntent = intent; return s;
}
const custom = (s: ReturnType<typeof fixture>, sourceMissionId?: string) => saveCustomMission(s, {
  categoryId: s.missions!.selectedCategory!, name: '내 행동', basic: '고른 행동 하기', small: '고른 행동의 첫 부분 하기', trigger: '식사 뒤', criterion: '고른 행동 한 번', sourceMissionId,
})!;

describe('최종 90개 콘텐츠', () => {
  it('v2 원본 90개/영역별 30개/단계별 5개 및 참조 ID를 확인한다', () => {
    expect(missionCatalog.schemaVersion).toBe(2); expect(missions).toHaveLength(90); expect(new Set(missions.map(m => m.id)).size).toBe(90);
    for (const c of ['daily', 'academic', 'work']) for (let stage = 1; stage <= 6; stage++) expect(missions.filter(m => m.categoryId === c && m.stage === stage)).toHaveLength(5);
    for (const m of missions) {
      expect(missionById(m.next)).toBeDefined(); expect(missionById(m.recommendation.nominalNextId)).toBeDefined();
      for (const field of ['name', 'dialogue', 'basic', 'small', 'record', 'smallRecord', 'condition'] as const) expect(m[field].length).toBeGreaterThan(0);
    }
  });
  it('새 단계 문구 함수에도 금지 표현이 없다', () => {
    expect(copy.missions.stage(2, '한 가지 해내기')).toBe('2단계 · 한 가지 해내기');
  });
});
describe('조건과 사용자 선택 추천', () => {
  it('영역 자동 선택/선택 보상은 없고 D05를 무조건 추천하지 않는다', () => {
    const s = createState(); expect(createMissionProgress().selectedCategory).toBeNull(); expect(missionCandidates(createMissionProgress())).toEqual([]);
    setMissionCategory(s, 'daily'); expect(pendingPacketCount(s)).toBe(0);
    s.missions!.facts.hasClutteredSeat = false; expect(missionCandidates(s.missions!).some(m => m.id === 'D05')).toBe(false);
  });
  it('unknown은 미리보기만 가능하며 기본/축소에서 false를 따로 적용한다', () => {
    const s = fixture(); const m = missionById('D01')!;
    expect(missionEligibility(s.missions!, m, 'small')).toBe('unknown'); expect(startMission(s, D, m.id, 'small', false)).toBe(false);
    expect(startMission(s, D, m.id, 'small', true)).toBe(true);
    s.missions!.facts.hasCup = false; expect(startMission(s, D, m.id, 'small', true)).toBe(false);
    const outing = missionById('D14')!; s.missions!.facts.canMakeChosenTrip = false; s.missions!.facts.canMoveIndoors = true;
    expect(missionEligibility(s.missions!, outing, 'basic')).toBe('excluded'); expect(missionEligibility(s.missions!, outing, 'small')).toBe('eligible');
  });
  it('D01 음료 뒤 D02 식사가 아니라 D06 후보이며 단계 상승은 동의가 필요하다', () => {
    const s = fixture(); expect(missionCandidates(s.missions!, { after: 'D01' })[0].id).toBe('D06');
    expect(startMission(s, D, 'D06', 'basic', true)).toBe(false); chooseMissionStage(s, missionById('D06')!);
    expect(startMission(s, D, 'D06', 'basic', true)).toBe(true); expect(s.missions!.stages.daily).toBe(2);
    chooseMissionStage(s, missionById('D01')!); expect(s.missions!.stages.daily).toBe(2);
  });
  it('시험 맥락에서 과제 전용 카드를 제외한다', () => {
    const s = fixture('academic', 'exam'); const list = missionCandidates(s.missions!, { allStages: true });
    expect(list.every(m => m.intentIds.includes('exam') || m.intentIds.includes('all'))).toBe(true);
  });
  it('회차 종료 뒤 다시 열어도 현재 목표의 다음 후보를 미리보기로 유지한다', () => {
    const s = fixture(); startMission(s, D, 'D01', 'basic', true); reportMission(s, D); closeMissionSession(s, D, s.missions!.activeSessionId!);
    expect(recommendedMission(s.missions!)?.id).toBe('D06'); expect(s.missions!.stages.daily).toBe(1);
    s.missions!.selectedIntent = 'meal'; expect(recommendedMission(s.missions!)?.id).toBe('D02');
  });
  it('복귀 전/미선택에서는 W06~W20을 제외하고 준비·직접 만들기는 열린다', () => {
    const s = fixture('work', 'work');
    for (const status of ['pre_return', 'unknown'] as const) {
      s.missions!.workStatus = status;
      const ids = missionCandidates(s.missions!, { allStages: true }).map(m => m.id);
      for (let i = 6; i <= 20; i++) expect(ids).not.toContain(`W${String(i).padStart(2, '0')}`);
      expect(ids).toContain('W03'); expect(ids).toContain('W21');
    }
  });
});
describe('실제 행동·회차 정산', () => {
  it('기본·축소·다음 행동이 같은 회차에 묶이고 종료 전 보상은 없다', () => {
    const s = fixture(); startMission(s, D, 'D01', 'small', true); const id = s.missions!.activeSessionId!;
    expect(reportMission(s, D)).toBe(true); expect(s.logs[0].mission?.record).toBe(missionById('D01')!.smallRecord);
    startMission(s, D, 'D01', 'basic', true); reportMission(s, D);
    chooseMissionStage(s, missionById('D06')!); startMission(s, D, 'D06', 'small', true); reportMission(s, D);
    expect(s.logs).toHaveLength(3); expect(s.missions!.activeSessionId).toBe(id); expect(pendingPacketCount(s)).toBe(0);
    expect(startMission(s, D, 'D06', 'basic', true)).toBe(false);
    expect(closeMissionSession(s, D, id)).toBe(true); expect(pendingPacketCount(s)).toBe(1); expect(s.days[D].packet).toBeUndefined();
  });
  it('중복 완료·중복 정산·저장 복원 뒤 재요청에 추가 지급하지 않는다', () => {
    let s = fixture(); startMission(s, D, 'D01', 'small', true); const id = s.missions!.activeSessionId!;
    reportMission(s, D); expect(reportMission(s, D)).toBe(false); closeMissionSession(s, D, id);
    s = decodeState(JSON.parse(JSON.stringify(s))); expect(closeMissionSession(s, D, id)).toBe(false);
    expect(s.logs).toHaveLength(1); expect(s.missions!.packets).toBe(1);
    const seed = openMissionPacket(s, () => 0); expect(seed).not.toBeNull(); expect(openMissionPacket(s)).toBeNull();
  });
  it('같은 행동의 새 회차는 허용하지만 하루 실제 완료 총 3개는 유지한다', () => {
    const s = fixture();
    for (let i = 0; i < 3; i++) { expect(startMission(s, D, 'D01', 'small', true)).toBe(true); reportMission(s, D); closeMissionSession(s, D, s.missions!.activeSessionId!); }
    expect(s.missions!.packets).toBe(3); expect(startMission(s, D, 'D01', 'small', true)).toBe(false);
  });
  it('미수행 쉬기는 보상 0, 수행 후 쉬기는 기존 회차를 한 번 정산한다', () => {
    const s = fixture(); startMission(s, D, 'D01', 'small', true); restMissions(s, D);
    expect(s.logs).toHaveLength(0); expect(pendingPacketCount(s)).toBe(0); expect(activeMissionSession(s)).toBeUndefined();
    startMission(s, D, 'D01', 'small', true); reportMission(s, D); restMissions(s, D); restMissions(s, D);
    expect(s.logs).toHaveLength(1); expect(pendingPacketCount(s)).toBe(1); expect(s.days[D].rested).toBe(true);
  });
  it('쉬기 선택과 D15 실제 휴식 행동 수행은 구분한다', () => {
    const s = fixture('daily', 'rest'); chooseMissionStage(s, missionById('D15')!); startMission(s, D, 'D15', 'small', true); reportMission(s, D);
    closeMissionSession(s, D, s.missions!.activeSessionId!); expect(s.logs).toHaveLength(1); expect(s.missions!.packets).toBe(1);
  });
  it('수행 전 축소는 단계와 완료 횟수를 바꾸지 않고 실제 축소 기록만 남긴다', () => {
    const s = fixture(); startMission(s, D, 'D01', 'basic', true); expect(reduceMission(s, D, true)).toBe(true);
    expect(s.logs).toHaveLength(0); reportMission(s, D); expect(s.logs[0].text).toBe(missionById('D01')!.smallRecord);
  });
});
describe('표지판·자기 미션·하루 지도', () => {
  it('표지판은 숫자 다음 카드가 아닌 목표에 맞는 실제 다음 행동을 제안하고 조건을 다시 확인한다', () => {
    const s = fixture(); startMission(s, D, 'D01', 'small', true); reportMission(s, D);
    const bookmark = bookmarkSuggestion(s)!; expect(bookmark.sourceMissionId).toBe('D01'); expect(bookmark.targetMissionId).toBe('D06');
    expect(bookmark.nextAction).toBe(missionById('D06')!.small); saveMissionBookmark(s, bookmark);
    closeMissionSession(s, D, s.missions!.activeSessionId!);
    expect(resumeMissionBookmark(s, D, 'daily', true)).toBe(false); chooseMissionStage(s, missionById('D06')!);
    expect(resumeMissionBookmark(s, D, 'daily', false)).toBe(false); s.missions!.facts.hasDrink = false;
    expect(resumeMissionBookmark(s, D, 'daily', true)).toBe(false); s.missions!.facts.hasDrink = 'unknown';
    expect(resumeMissionBookmark(s, D, 'daily', true)).toBe(true);
  });
  it('영역 변경과 재접속에서도 단계·직접 만든 미션·정원을 보존한다', () => {
    const s = fixture(); custom(s); s.fruit = 20; s.missions!.stages.daily = 4;
    setMissionCategory(s, 'academic'); setMissionCategory(s, 'daily');
    const restored = decodeState(JSON.parse(JSON.stringify(s))); expect(restored.fruit).toBe(20); expect(restored.missions!.stages.daily).toBe(4); expect(restored.missions!.custom).toHaveLength(1);
  });
  it('직접 만들기는 처음부터 가능하고 저장만으로 활동·씨앗이 늘지 않는다', () => {
    const s = fixture(); const id = custom(s); expect(id).toBeTruthy();
    expect(s.logs).toHaveLength(0); expect(pendingPacketCount(s)).toBe(0); expect(s.missions!.stages.daily).toBe(1);
    expect(startMission(s, D, '', 'small', true, id)).toBe(true);
  });
  it('복사 뒤 이름이나 기준을 바꿔도 원래 행동의 조건을 유지한다', () => {
    const s = fixture('work', 'work'); s.missions!.workStatus = 'returned'; const id = custom(s, 'W06');
    s.missions!.workStatus = 'pre_return'; const c = s.missions!.custom.find(x => x.id === id)!;
    expect(customEligibility(s.missions!, c, 'basic')).toBe('excluded'); expect(startMission(s, D, 'W06', 'basic', true, id)).toBe(false);
    saveCustomMission(s, { ...c, sourceMissionId: undefined }, id); expect(s.missions!.custom[0].sourceMissionId).toBe('W06');
  });
  it('자기 설계 카드만 선택하고 실제 행동 없이 기록할 수 없다', () => {
    const s = fixture(); chooseMissionStage(s, missionById('D21')!); expect(startMission(s, D, 'D21', 'basic', true)).toBe(false);
    chooseMissionStage(s, missionById('D16')!); expect(startMission(s, D, 'D16', 'basic', true)).toBe(false);
  });
  it('A30은 두 개 배치 뒤 하나만 실행해 회차 보상 하나를 받고 나머지는 필수가 아니다', () => {
    const s = fixture('academic', 'exam'); const one = custom(s); const two = custom(s);
    chooseMissionStage(s, missionById('A30')!);
    expect(saveMyDay(s, 'academic', [{ id: '1', customId: one, cue: '먼저' }, { id: '2', customId: two, cue: '나중' }])).toBe(true);
    expect(s.logs).toHaveLength(0); expect(pendingPacketCount(s)).toBe(0);
    expect(startMission(s, D, 'A30', 'basic', true, one, 'A30')).toBe(false);
    expect(startDayMission(s, D, 'academic', '1', 'small', true, 'A30')).toBe(true);
    reportMission(s, D); closeMissionSession(s, D, s.missions!.activeSessionId!);
    expect(s.logs).toHaveLength(1); expect(s.missions!.packets).toBe(1); expect(s.missions!.dayMapDefault.academic).toBe(true);
    expect(s.missions!.myDays.academic).toHaveLength(2);
  });
  it('하루 지도를 하나로 줄이면 축소 방식으로 실행할 수 있다', () => {
    const s = fixture(); const id = custom(s); chooseMissionStage(s, missionById('D30')!);
    saveMyDay(s, 'daily', [{ id: 'one', customId: id, cue: '식사 뒤' }]);
    expect(startDayMission(s, D, 'daily', 'one', 'small', true, 'D30', 'basic')).toBe(false);
    expect(startDayMission(s, D, 'daily', 'one', 'small', true, 'D30', 'small')).toBe(true);
  });
  it('지도의 순서·행동·표지판과 미정산 회차가 로컬/서버 snapshot 왕복에서 보존된다', () => {
    const s = fixture(); const id = custom(s); saveMyDay(s, 'daily', [{ id: 'day', customId: id, cue: '식사 뒤', time: '내 시간', place: '내 자리' }]);
    startDayMission(s, D, 'daily', 'day', 'small', true);
    const restored = decodeState(JSON.parse(JSON.stringify(s))); expect(stateKey(restored)).toBe(stateKey(s));
    reportMission(restored, D); expect(restored.logs[0].plan.when).toContain('식사 뒤'); expect(restored.logs[0].plan.where).toBe('내 자리');
  });
  it('하루 지도에서 선택한 두 번째 행동을 재접속 후에도 기억한다', () => {
    const s = fixture(); const first = custom(s); const second = custom(s);
    saveMyDay(s, 'daily', [{ id: 'one', customId: first, cue: '먼저' }, { id: 'two', customId: second, cue: '나중' }]);
    startDayMission(s, D, 'daily', 'two', 'small', true);
    expect(decodeState(s).missions!.selectedDayEntry?.daily).toBe('two');
  });
  it('이전 저장은 그대로 읽고 알 수 없는 진행 값은 조용히 삭제하지 않는다', () => {
    const old = createState(); expect(decodeState(old)).toEqual(old);
    const s = fixture(); s.missions!.packets = -1; expect(() => decodeState(s)).toThrow();
  });
  it('나무 재수확은 새 회차 보상도 받은 날 단위로 세며 한 날 여러 회차는 중복 계산하지 않는다', () => {
    const s = fixture(); const tree = { id: 'tree', plantId: 'apple_tree', date: '2026-10-01', harvested: true, harvestedOn: '2026-11-01', col: 1, row: 1 };
    for (const date of ['2026-11-02', '2026-11-03', '2026-11-04']) {
      startMission(s, date, 'D01', 'small', true); reportMission(s, date); closeMissionSession(s, date, s.missions!.activeSessionId!);
    }
    expect(canHarvest(tree, D, s.days)).toBe(true);
  });
});
