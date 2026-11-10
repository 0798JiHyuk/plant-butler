import { describe, expect, it } from 'vitest';
import { FORBIDDEN_WORDS } from '../core/copy';
import {
  advanceStage, alternatives, bookmarkSuggestion, chooseArea, chooseIntent, chooseMission, chooseWorkStatus, eligibleVariants, FIRST, fits,
  lastStep, markNotApplicable, missionById, MISSIONS, moreAfter, preferred, previewCards, saveBookmark, startCard, type Mission,
} from '../core/missions';
import { closeSession, reportAction, setEnergy } from '../core/rules';
import { createState } from '../core/store';
import type { Variant } from '../core/types';

/** 화면에 나오는 글 */
const shown = (m: Mission) => [m.name, m.stageName, m.dialogue, m.basic, m.small, m.record, m.smallRecord, m.conditionSummary, m.buttonLabel];

describe('미션 데이터', () => {
  it('영역마다 30개, 단계마다 15개이고 ID가 겹치지 않는다', () => {
    expect(MISSIONS).toHaveLength(90);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(90);
    for (const c of ['daily', 'academic', 'work'] as const) expect(MISSIONS.filter((m) => m.categoryId === c)).toHaveLength(30);
    for (let st = 1; st <= 6; st++) expect(MISSIONS.filter((m) => m.stage === st)).toHaveLength(15);
  });

  it('다음 후보와 첫 미션 표의 ID가 모두 있다', () => {
    for (const m of MISSIONS) if (m.nextId) expect(missionById(m.nextId), m.id).toBeDefined();
    const firsts = [
      ...FIRST.daily.scenes.map((s) => s.missionId), ...FIRST.daily.previews, FIRST.academic.missionId,
      ...FIRST.work.pre_return.map((s) => s.missionId), ...FIRST.work.returned.map((s) => s.missionId),
    ];
    for (const id of firsts) expect(missionById(id), id).toBeDefined();
  });

  it('주민 이름은 게임 id로 바뀌어 있고, 1~4단계 카드는 느리·모루·피오가 말한다', () => {
    for (const m of MISSIONS) expect(['nuri', 'moru', 'pio', 'sprout']).toContain(m.npc);
    for (const m of MISSIONS.filter((x) => x.stage <= 4)) expect(['nuri', 'moru', 'pio']).toContain(m.npc);
  });

  it('화면에 나오는 글에 금지 표현이 없다', () => {
    const labels = [...FIRST.daily.scenes, ...FIRST.work.pre_return, ...FIRST.work.returned].map((s) => s.label);
    const texts = [...MISSIONS.flatMap(shown), ...labels, ...FIRST.academic.targets.map((t) => t.label)];
    for (const t of texts) for (const w of FORBIDDEN_WORDS) expect(t).not.toContain(w);
  });
});

const D = '2026-11-09';
type S = ReturnType<typeof createState>;
const card = (id: string) => missionById(id)!;
/** 일상 영역(장면을 주면 그 장면) */
const daily = (intent?: string) => {
  const s = createState();
  chooseArea(s, 'daily');
  if (intent) chooseIntent(s, 'daily', intent);
  return s;
};
/** 카드를 고르고 [했어]까지 */
const act = (s: S, missionId: string, variant: Variant) => {
  expect(chooseMission(s, D, { missionId, variant })).toBe(true);
  expect(reportAction(s, D, [])).not.toBeNull();
};

describe('후보 거르기', () => {
  it('일상에서 장면을 건너뛰면 D01·D03·D05를 미리 보여 준다(D05를 강제하지 않는다)', () => {
    expect(previewCards(daily(), D).map((m) => m.id)).toEqual(['D01', 'D03', 'D05']);
  });

  it('장면이 다른 카드는 빼고 all 카드는 남긴다', () => {
    const s = daily('drink');
    expect(fits(s, D, card('D02'), 'daily')).toBe(false);
    expect(fits(s, D, card('D06'), 'daily')).toBe(true);
    expect(fits(s, D, card('D16'), 'daily')).toBe(true);
  });

  it('5~6단계는 추천하지 않는다', () => {
    expect(fits(daily(), D, card('D21'), 'daily')).toBe(false);
  });

  it('복귀 전·모를 때는 W06~W20(실무)을 빼고, 복귀 후에는 넣는다', () => {
    const s = createState();
    chooseArea(s, 'work');
    expect(fits(s, D, card('W06'), 'work')).toBe(false);
    chooseWorkStatus(s, 'pre_return');
    expect(fits(s, D, card('W03'), 'work')).toBe(true);
    expect(fits(s, D, card('W06'), 'work')).toBe(false);
    chooseWorkStatus(s, 'returned');
    expect(fits(s, D, card('W06'), 'work')).toBe(true);
  });

  it('해당 없어요: 그 카드와 같은 조건이 걸린 카드를 그날만 뺀다', () => {
    const s = daily('drink');
    markNotApplicable(s, D, 'D01'); // 컵(hasCup)
    expect(fits(s, D, card('D01'), 'daily')).toBe(false);
    expect(fits(s, D, card('D06'), 'daily')).toBe(false); // 컵이 필요한 카드
    expect(fits(s, D, card('D11'), 'daily')).toBe(true);
    expect(fits(s, '2026-11-10', card('D01'), 'daily')).toBe(true); // 다음 날엔 다시 나온다
  });

  it('기본 행동에만 걸리는 조건이면 줄인 행동만 남는다', () => {
    const s = createState();
    chooseArea(s, 'work');
    chooseWorkStatus(s, 'returned');
    markNotApplicable(s, D, 'W08'); // 작성할 과제(hasWritingTask)
    expect(eligibleVariants(s, D, card('W12'))).toEqual(['small']); // 기본은 예시+작성, 줄인 행동은 예시만
  });

  it('조금 무거운 날은 줄인 행동을 먼저 보여 준다', () => {
    const s = daily('drink');
    expect(preferred(s, D, card('D01'))).toBe('basic');
    setEnergy(s, D, 'heavy');
    expect(preferred(s, D, card('D01'))).toBe('small');
  });
});

describe('더 해 볼래', () => {
  it('음료(D01) 기본 뒤에는 D02가 아니라 D06이고, 단계가 바뀌어 먼저 묻는다', () => {
    const s = daily('drink');
    act(s, 'D01', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)).toEqual({ missionId: 'D06', variant: 'basic', crosses: true });
    advanceStage(s, 'D06');
    expect(moreAfter(s, D, lastStep(s)!)?.crosses).toBe(false);
  });

  it('줄인 행동만 했으면 같은 카드의 기본 행동', () => {
    const s = daily('drink');
    act(s, 'D01', 'small');
    expect(moreAfter(s, D, lastStep(s)!)).toEqual({ missionId: 'D01', variant: 'basic', crosses: false });
    act(s, 'D01', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)?.missionId).toBe('D06');
  });

  it('시험 준비 흐름에서는 과제 전용 카드(A11)를 건너뛴다', () => {
    const s = createState();
    chooseArea(s, 'academic');
    chooseIntent(s, 'academic', 'exam');
    act(s, 'A10', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)?.missionId).toBe('A12');
  });

  it('복귀 전에는 준비 카드 안에서만 잇고, 끝나면 null', () => {
    const s = createState();
    chooseArea(s, 'work');
    chooseWorkStatus(s, 'pre_return');
    act(s, 'W03', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)?.missionId).toBe('W04');
    act(s, 'W05', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)).toBeNull();
  });

  it('4단계 마지막 카드 뒤에는 null(5단계는 추천하지 않는다)', () => {
    const s = daily();
    act(s, 'D20', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)).toBeNull();
  });

  it('하루 상한이면 카드를 고를 수 없다', () => {
    const s = daily('drink');
    for (let i = 0; i < 3; i++) {
      act(s, 'D01', 'small');
      closeSession(s);
    }
    expect(chooseMission(s, D, { missionId: 'D01', variant: 'small' })).toBe(false);
  });
});

describe('다른 걸 할래', () => {
  it('같은 단계에서 맞는 다른 카드 최대 2개(지금 카드 다음 번호부터)', () => {
    const s = createState();
    chooseArea(s, 'academic');
    expect(alternatives(s, D, 'A02').map((m) => m.id)).toEqual(['A03', 'A04']);
  });

  it('같은 단계에 없으면 이전 단계에서 고른다', () => {
    expect(alternatives(daily('drink'), D, 'D06').map((m) => m.id)).toEqual(['D01']);
  });
});

describe('표지판과 다시 열기', () => {
  it('줄인 행동만 했으면 같은 카드의 기본을, 기본을 했으면 다음 카드의 줄인 행동을 제안한다', () => {
    const s = daily('drink');
    act(s, 'D01', 'small');
    expect(bookmarkSuggestion(s, D)).toEqual({ missionId: 'D01', variant: 'basic' });
    act(s, 'D01', 'basic');
    expect(bookmarkSuggestion(s, D)).toEqual({ missionId: 'D06', variant: 'small' });
  });

  it('카드 행동이 없으면 제안하지 않는다', () => {
    expect(bookmarkSuggestion(daily(), D)).toBeNull();
  });

  it('다시 열면 표지판 카드부터, 없으면 마지막 카드부터(조건을 다시 거른다)', () => {
    const s = daily('drink');
    act(s, 'D01', 'basic');
    closeSession(s);
    expect(startCard(s, D)).toEqual({ missionId: 'D01', variant: 'basic', bookmark: false });
    saveBookmark(s, { missionId: 'D06', variant: 'small' });
    expect(startCard(s, D)).toEqual({ missionId: 'D06', variant: 'small', bookmark: true });
    markNotApplicable(s, D, 'D06'); // 컵·음료가 없다 → D06도 D01도 오늘은 안 맞는다
    expect(startCard(s, D)).toBeNull();
  });

  it('표지판 카드를 고르면 표지판을 쓴 것으로 지우고 마지막 카드로 기억한다', () => {
    const s = daily('drink');
    saveBookmark(s, { missionId: 'D06', variant: 'small' });
    chooseMission(s, D, { missionId: 'D06', variant: 'small' });
    expect(s.missions.bookmarks.daily).toBeUndefined();
    expect(s.missions.last.daily).toBe('D06');
    expect(s.days[D].plan).toMatchObject({ missionId: 'D06', variant: 'small', source: 'mission' });
  });

  it('미리보기에서 고른 카드의 장면을 기억한다', () => {
    const s = daily();
    chooseMission(s, D, { missionId: 'D03', variant: 'small' });
    expect(s.missions.intents.daily).toBe('wash');
  });

  it('추천 단계는 다음 길을 고를 때만 오르고 내려가지 않는다(4단계까지)', () => {
    const s = daily();
    advanceStage(s, 'D11');
    expect(s.missions.stage.daily).toBe(3);
    advanceStage(s, 'D01');
    expect(s.missions.stage.daily).toBe(3);
    advanceStage(s, 'D21');
    expect(s.missions.stage.daily).toBe(4);
  });
});
