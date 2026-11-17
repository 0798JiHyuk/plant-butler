import { describe, expect, it } from 'vitest';
import { doorAt } from '../core/doorEntry';
import { LANDMARKS } from '../core/worldGeometry';

describe('문 앞에 닿으면 들어갈지 묻는 건물', () => {
  it('학교·직장·카페 문 앞 길 표지에 서면 그 건물을 돌려준다', () => {
    for (const id of ['school', 'work', 'cafe'] as const) expect(doorAt(LANDMARKS[id].x, LANDMARKS[id].y)).toBe(id);
  });
  it('상점은 문 앞에 서도 자동으로 열리지 않는다', () => {
    expect(doorAt(LANDMARKS.shop.x, LANDMARKS.shop.y)).toBeNull();
  });
  it('집은 이 규칙이 아니라 기존 규칙을 쓴다', () => {
    expect(doorAt(LANDMARKS.home.x, LANDMARKS.home.y)).toBeNull();
  });
  it('문 앞 직사각형 안에서만 닿은 것으로 본다(좌우 60, 위 100, 아래 40)', () => {
    const { x, y } = LANDMARKS.school;
    expect(doorAt(x + 59, y)).toBe('school');
    expect(doorAt(x - 59, y)).toBe('school');
    expect(doorAt(x + 61, y)).toBeNull();
    expect(doorAt(x, y - 99)).toBe('school');
    expect(doorAt(x, y - 101)).toBeNull();
    expect(doorAt(x, y + 39)).toBe('school');
    expect(doorAt(x, y + 41)).toBeNull();
  });
  it('벽을 따라 걸어와 문 바로 아래 벽 밑단에 서도 닿은 것으로 본다', () => {
    // 건물 막힘 영역 바로 아래(발이 설 수 있는 가장 위쪽 자리)
    expect(doorAt(LANDMARKS.cafe.x, 1830)).toBe('cafe');
    expect(doorAt(LANDMARKS.school.x, 712)).toBe('school');
    expect(doorAt(LANDMARKS.work.x, 712)).toBe('work');
  });
  it('건물에서 멀리 떨어지면 아무것도 아니다', () => {
    expect(doorAt(896, 2224)).toBeNull(); // 정원 입구
    expect(doorAt(Number.NaN, 100)).toBeNull();
  });
});
