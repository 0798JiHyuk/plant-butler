import { describe, expect, it } from 'vitest';
import { PLACE_MEMO_MAX, clearMemoDraft, memoDraft, memoKey, placeMemo, savePlaceMemo, setMemoDraft, validMemoText, validPlaceMemos, workReaction } from '../core/placeMemo';
import { createState, decodeState, stateKey } from '../core/state';
import { enterPlace } from '../core/places';
import { ensureNarrative, exploration, narrative } from '../core/exploration';
import { copy, FORBIDDEN_WORDS } from '../core/copy';

const AT = '2026-11-15T13:00:00.000Z';

describe('학교·직장 개인 메모', () => {
  it('장소마다 메모 한 건이고 저장 키는 장소와 메모 종류로 정해진다', () => {
    expect(memoKey('school')).toBe('school:prepare');
    expect(memoKey('work')).toBe('work:carryOn');
  });
  it('처음엔 메모가 없고 저장하면 본문·수정 횟수·저장 시각을 남긴다', () => {
    const s = createState();
    expect(placeMemo(s, 'school')).toBeUndefined();
    expect(savePlaceMemo(s, 'school', '  1장 목차 보기  ', AT)).toBe(true);
    expect(placeMemo(s, 'school')).toEqual({ body: '1장 목차 보기', revision: 1, savedAt: AT });
    expect(placeMemo(s, 'work')).toBeUndefined();
  });
  it('같은 장소에 다시 저장하면 새 건을 만들지 않고 그 한 건을 고친다', () => {
    const s = createState();
    savePlaceMemo(s, 'work', '표지 시안 보기', AT);
    savePlaceMemo(s, 'work', '화살표 굵게', '2026-11-16T09:00:00.000Z');
    expect(Object.keys(s.garden.placeMemos ?? {})).toEqual(['work:carryOn']);
    expect(placeMemo(s, 'work')).toEqual({ body: '화살표 굵게', revision: 2, savedAt: '2026-11-16T09:00:00.000Z' });
  });
  it('빈 글·너무 긴 글·제어 문자는 저장하지 않고 이전 메모를 지키지 않고 건드리지도 않는다', () => {
    const s = createState();
    savePlaceMemo(s, 'school', '처음 메모', AT);
    for (const bad of ['', '   ', 'a'.repeat(PLACE_MEMO_MAX + 1), '줄\n바꿈', 'x\u0000y']) {
      expect(validMemoText(bad)).toBe(false);
      expect(savePlaceMemo(s, 'school', bad, AT)).toBe(false);
    }
    expect(validMemoText('a'.repeat(PLACE_MEMO_MAX))).toBe(true);
    expect(validMemoText('가'.repeat(PLACE_MEMO_MAX))).toBe(true); // 글자 수로 센다
    expect(validMemoText(42)).toBe(false);
    expect(placeMemo(s, 'school')).toEqual({ body: '처음 메모', revision: 1, savedAt: AT });
  });
  it('메모를 남겨도 미션·기록·씨앗·복귀 상태·책갈피·이야기 사실을 만들거나 바꾸지 않는다', () => {
    const s = createState();
    enterPlace(s, 'school');
    const snap = () => JSON.stringify({ m: s.missions, logs: s.logs, seeds: s.seeds, fruit: s.fruit, free: s.freePackets, bonus: s.bonusPackets, days: s.days, bookmarks: exploration(s).bookmarks, facts: narrative(s).facts, completed: narrative(s).completed, plants: s.garden.plants, items: s.garden.items });
    const before = snap();
    savePlaceMemo(s, 'school', '자료 하나 펴 보기', AT);
    savePlaceMemo(s, 'work', '이어갈 일 한 줄', AT);
    expect(snap()).toBe(before);
  });
  it('저장본을 껐다 켜도 메모가 남고 이전 저장본에는 메모 칸이 없어도 된다', () => {
    const s = createState();
    expect(decodeState(JSON.parse(JSON.stringify(s))).garden.placeMemos).toBeUndefined();
    savePlaceMemo(s, 'school', '준비할 일', AT);
    const back = decodeState(JSON.parse(stateKey(s)));
    expect(placeMemo(back, 'school')?.body).toBe('준비할 일');
  });
  it('모양이 잘못된 메모 저장본은 받아들이지 않는다', () => {
    const ok = { 'school:prepare': { body: '글', revision: 1, savedAt: AT } };
    expect(validPlaceMemos(ok)).toBe(true);
    expect(validPlaceMemos({ 'nowhere:prepare': ok['school:prepare'] })).toBe(false);
    expect(validPlaceMemos({ 'school:prepare': { ...ok['school:prepare'], revision: 0 } })).toBe(false);
    expect(validPlaceMemos({ 'school:prepare': { ...ok['school:prepare'], body: '' } })).toBe(false);
    expect(validPlaceMemos({ 'school:prepare': { ...ok['school:prepare'], savedAt: 'yesterday' } })).toBe(false);
    expect(validPlaceMemos('x')).toBe(false);
    const s = createState();
    s.garden.placeMemos = { 'school:prepare': { body: '', revision: 1, savedAt: AT } };
    expect(() => decodeState(JSON.parse(JSON.stringify(s)))).toThrow();
  });
  it('입력 중인 초안은 저장본과 따로 기기 메모리에만 있고 저장하면 지워진다', () => {
    const s = createState();
    clearMemoDraft('school');
    expect(memoDraft('school')).toBeUndefined();
    setMemoDraft('school', '쓰다 만 글');
    expect(memoDraft('school')).toBe('쓰다 만 글');
    expect(JSON.stringify(s)).not.toContain('쓰다 만 글');
    expect(placeMemo(s, 'school')).toBeUndefined();
    savePlaceMemo(s, 'school', '쓰다 만 글', AT);
    clearMemoDraft('school');
    expect(memoDraft('school')).toBeUndefined();
    expect(memoDraft('work')).toBeUndefined();
  });
});

describe('메모 화면 문구와 모루의 마무리 말', () => {
  it('저장 성공 문구는 계획서 원문이고 금지어가 없다', () => {
    expect(copy.placeMemo.saved.school).toBe('준비할 일을 남겼어요.');
    expect(copy.placeMemo.saved.work).toBe('다음에 할 일을 남겼어요.');
    expect(copy.placeMemo.reaction.school).toBe('어디서 시작할지 다음에도 찾을 수 있겠네.');
    expect(copy.placeMemo.reaction.work).toBe('다음엔 이 줄부터 보면 되겠다.');
    const all = JSON.stringify(copy.placeMemo);
    for (const word of FORBIDDEN_WORDS) expect(all).not.toContain(word);
  });
  it('모루는 정원 표식을 실제로 고른 뒤에만 "네가 고른 대로"라고 말한다', () => {
    const s = createState();
    expect(workReaction(s)).toBe(copy.placeMemo.work.entrance);
    ensureNarrative(s).choices['ST-B01'] = 'r2-B01-C4'; // 보류
    expect(workReaction(s)).toBe(copy.placeMemo.work.entrance);
    for (const id of ['r2-B01-C1', 'r2-B01-C2', 'r2-B01-C3']) {
      ensureNarrative(s).choices['ST-B01'] = id;
      expect(workReaction(s)).toBe(copy.placeMemo.work.chosen);
    }
  });
});
