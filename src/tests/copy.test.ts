import { describe, expect, it } from 'vitest';
import { copy, FORBIDDEN_WORDS } from '../core/copy';

function collect(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collect(v, out));
  return out;
}

describe('copy', () => {
  it('문구를 만드는 함수의 결과에도 금지 표현이 없다', () => {
    const texts = [
      copy.fact.weekNth('집 앞 5분 걷기', 3),
      copy.decorate.count(3), copy.decorate.storage(2), copy.decorate.moving('벤치'),
      copy.chat.placeholder('느리'),
      copy.mission.when('지금 컵이 필요할 때.'), copy.mission.stage(1, '첫발 떼기'), copy.mission.bookmarkAsk('쓸 컵 준비하기'),
      ...(['sprout', 'young', 'bloom'] as const).flatMap((n) => [1, 3].flatMap((d) => [copy.plantNote(false, n, d), copy.plantNote(true, n, d)])),
    ];
    for (const text of texts) for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });

  it('금지 표현이 하나도 없다', () => {
    for (const text of collect(copy)) {
      for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
    }
  });
});
