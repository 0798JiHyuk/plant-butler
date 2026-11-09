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
      copy.fact.weekNth('집 앞 5분 걷기', 3), copy.panel.minutesFrom(5), copy.panel.minutes(2), copy.panel.smaller(2),
      copy.decorate.count(3), copy.decorate.storage(2), copy.decorate.moving('벤치'),
    ];
    for (const text of texts) for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });

  it('금지 표현이 하나도 없다', () => {
    for (const text of collect(copy)) {
      for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
    }
  });
});
