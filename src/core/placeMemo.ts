import { copy } from './copy';
import { narrative } from './exploration';
import { now } from './clock';
import { PLACE_IDS, type PlaceId } from './places';
import type { AppState } from './types';

/**
 * 학교·직장 개인 메모. 계획서의 "저장 키는 이용 저장본·장소·메모 종류 조합으로 한 건을 수정한다"를 따른다.
 * 이용 저장본은 이 상태 자체이고, 장소마다 메모 종류가 하나라 키는 `장소:종류`다.
 * NPC 관찰 메모(이야기 사실)·책갈피와는 다른 상태라 narrative·exploration에 섞지 않는다.
 */
export type MemoKind = 'prepare' | 'carryOn';
export interface PlaceMemo { body: string; revision: number; savedAt: string }

export const MEMO_KIND: Record<PlaceId, MemoKind> = { school: 'prepare', work: 'carryOn' };
/** 임시 값: 입력 제한과 운영 저장 위치는 기존 어댑터 결정 뒤 확정한다(계획서). 정원 이름 한도(16)보다 넉넉한 한 줄. */
export const PLACE_MEMO_MAX = 60;

export const memoKey = (place: PlaceId): string => `${place}:${MEMO_KIND[place]}`;
const KEYS = new Set(PLACE_IDS.map(memoKey));

export const placeMemo = (s: AppState, place: PlaceId): PlaceMemo | undefined => s.garden.placeMemos?.[memoKey(place)];

const noControl = (value: string) => ![...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
/** 한 줄, 글자 수 기준. 앞뒤 공백을 뺀 값을 본다. */
export function validMemoText(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const body = value.trim(), length = [...body].length;
  return length > 0 && length <= PLACE_MEMO_MAX && noControl(body);
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
export function validPlaceMemos(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value as Record<string, unknown>).every(([key, memo]) => {
    if (!KEYS.has(key) || !memo || typeof memo !== 'object') return false;
    const m = memo as Record<string, unknown>;
    return validMemoText(m.body) && m.body === m.body.trim() && Number.isSafeInteger(m.revision) && Number(m.revision) >= 1
      && typeof m.savedAt === 'string' && ISO.test(m.savedAt) && Number.isFinite(Date.parse(m.savedAt));
  });
}

/** 확정 저장. 글이 올바르지 않으면 아무것도 바꾸지 않는다. 같은 장소는 새 건을 만들지 않고 그 한 건을 고친다. */
export function savePlaceMemo(s: AppState, place: PlaceId, text: string, savedAt: string = now().toISOString()): boolean {
  if (!validMemoText(text)) return false;
  const memos = s.garden.placeMemos ??= {}, key = memoKey(place);
  memos[key] = { body: text.trim(), revision: (memos[key]?.revision ?? 0) + 1, savedAt };
  return true;
}

/** 편집 초안: 기기 메모리에만 둔다. 저장본·서버로 나가지 않고, 저장 실패 때 입력을 잃지 않게 한다. */
const drafts = new Map<PlaceId, string>();
export const memoDraft = (place: PlaceId): string | undefined => drafts.get(place);
export const setMemoDraft = (place: PlaceId, text: string): void => { drafts.set(place, text); };
export const clearMemoDraft = (place: PlaceId): void => { drafts.delete(place); };

/** 모루의 마무리 말. 정원 표식을 실제로 고르고 저장한 경우에만 "네가 고른 대로"라고 말한다. */
const CHOSEN_MARK = ['r2-B01-C1', 'r2-B01-C2', 'r2-B01-C3'];
export function workReaction(s: AppState): string {
  const chosen = CHOSEN_MARK.includes(narrative(s).choices['ST-B01'] ?? '');
  return chosen ? copy.placeMemo.work.chosen : copy.placeMemo.work.entrance;
}
