import { describe, expect, it } from 'vitest';
import { PLACE_IDS, PLACES, atPlaceDoor, enterPlace, placeExitPoint, placeSceneId, placeWalkable, placeZoneFor, PLACE_REACH } from '../core/places';
import { LANDMARKS } from '../core/worldGeometry';
import { isWalkable } from '../core/worldTerrain';
import { createState } from '../core/state';
import { exploration, validExploration } from '../core/exploration';
import { commitChoice, confirmLine, sceneAvailable, sceneById, sceneLines } from '../core/narrative';
import { withinReach } from '../core/interaction';
import { copy, FORBIDDEN_WORDS } from '../core/copy';

/** 8px 격자로 시작 위치에서 걸어갈 수 있는 모든 칸을 모은다. */
function reachableCells(id: 'school' | 'work'): { x: number; y: number }[] {
  const { spawn, width, height } = PLACES[id];
  const step = 8, key = (x: number, y: number) => `${x},${y}`;
  const seen = new Set([key(spawn.x, spawn.y)]), queue = [{ ...spawn }], cells = [{ ...spawn }];
  while (queue.length) {
    const p = queue.shift()!;
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (q.x < 0 || q.y < 0 || q.x > width || q.y > height || seen.has(key(q.x, q.y)) || !placeWalkable(id, q.x, q.y)) continue;
      seen.add(key(q.x, q.y)); queue.push(q); cells.push(q);
    }
  }
  return cells;
}

describe('학교와 직장 실내 구조', () => {
  it('실내 그림은 집 실내와 같은 크기이고 장소는 학교와 직장 둘이다', () => {
    expect(PLACE_IDS).toEqual(['school', 'work']);
    for (const id of PLACE_IDS) expect([PLACES[id].width, PLACES[id].height]).toEqual([1266, 712]);
  });
  it('시작 위치는 걸을 수 있고 문 안쪽이다', () => {
    for (const id of PLACE_IDS) {
      const { spawn } = PLACES[id];
      expect(placeWalkable(id, spawn.x, spawn.y)).toBe(true);
      expect(atPlaceDoor(id, spawn.x, spawn.y)).toBe(false);
    }
  });
  it('그림 바깥 테두리와 가구 위에는 설 수 없다', () => {
    for (const id of PLACE_IDS) {
      expect(placeWalkable(id, 10, 10)).toBe(false);
      expect(placeWalkable(id, 640, 700)).toBe(false);
      expect(placeWalkable(id, Number.NaN, 300)).toBe(false);
    }
    expect(placeWalkable('school', 402, 447)).toBe(false); // 왼쪽 앞 책상
    expect(placeWalkable('school', 950, 440)).toBe(false); // 오른쪽 책상
    expect(placeWalkable('work', 150, 480)).toBe(false); // 서류함 선반
    expect(placeWalkable('work', 630, 380)).toBe(false); // 작업 책상
    expect(placeWalkable('work', 350, 380)).toBe(false); // 제도대
    // 줄인 가구 그림(가구 약 65%) 기준: 가구 사이 통로는 걸을 수 있고, 가구 자리는 막혀 있다.
    expect(placeWalkable('school', 600, 500)).toBe(true);  // 두 책상 묶음 사이 통로
    expect(placeWalkable('school', 220, 560)).toBe(true);  // 왼쪽 선반 아래쪽 바닥
    expect(placeWalkable('school', 1060, 440)).toBe(false); // 오른쪽 책상 묶음 끝
    expect(placeWalkable('school', 130, 380)).toBe(false);  // 왼쪽 벽 모서리(옷걸이 아래)
    expect(placeWalkable('school', 1180, 380)).toBe(false); // 오른쪽 벽 모서리
    expect(placeWalkable('work', 350, 430)).toBe(true);    // 제도대 앞 바닥
    expect(placeWalkable('work', 700, 460)).toBe(true);    // 작업 책상 앞 바닥
    expect(placeWalkable('work', 1030, 440)).toBe(false);  // 메모 책상
    expect(placeWalkable('work', 900, 450)).toBe(true);    // 칸막이 왼쪽 바닥
  });
  it('시작 위치에서 문까지 걸어갈 수 있다', () => {
    for (const id of PLACE_IDS) expect(reachableCells(id).some(c => atPlaceDoor(id, c.x, c.y))).toBe(true);
  });
  it('시작 위치에서 메모 자리 앞까지 걸어갈 수 있다', () => {
    for (const id of PLACE_IDS) {
      const memo = PLACES[id].memo;
      expect(placeWalkable(id, memo.x, memo.y)).toBe(false); // 메모 자리 자체는 책상 위
      expect(reachableCells(id).some(c => withinReach(c, memo, PLACE_REACH))).toBe(true);
    }
  });
  it('가구가 바닥을 다 막지 않고 걸을 곳이 3할 넘게 남는다', () => {
    for (const id of PLACE_IDS) {
      const { floor } = PLACES[id], cells = reachableCells(id);
      const total = ((floor.right - floor.left) / 8) * ((floor.bottom - floor.top) / 8);
      expect(cells.length / total).toBeGreaterThan(0.3);
    }
  });
  it('실내 문으로 나오면 정원 쪽 길 위에 서고 정원에서 그 건물이 보인다', () => {
    for (const id of PLACE_IDS) {
      const out = placeExitPoint(id);
      expect(isWalkable(out.x, out.y)).toBe(true);
      expect(Math.hypot(out.x - LANDMARKS[id].x, out.y - LANDMARKS[id].y)).toBeLessThan(120);
    }
  });
  it('장소와 이야기 장면은 하나씩 이어진다', () => {
    expect(placeSceneId('school')).toBe('ST-V02');
    expect(placeSceneId('work')).toBe('ST-V03');
    expect(placeZoneFor('school')).toBe('school');
    expect(placeZoneFor('work')).toBe('work');
  });
});

describe('실내 진입 기록과 장소 안내 장면', () => {
  it('실내에 들어가 본 장소만 기록하고 같은 곳은 한 번만 쓴다', () => {
    const s = createState();
    expect(exploration(s).entered).toBeUndefined();
    expect(enterPlace(s, 'school')).toBe(true);
    expect(enterPlace(s, 'school')).toBe(false);
    expect(exploration(s).entered).toEqual(['school']);
    expect(validExploration(exploration(s))).toBe(true);
  });
  it('기록 모양이 잘못되면 받아들이지 않는다', () => {
    const base = { version: 1, discovered: ['garden'], walked: [], bookmarks: [], layers: [] };
    expect(validExploration({ ...base, entered: ['school', 'work'] })).toBe(true);
    expect(validExploration({ ...base, entered: ['nowhere'] })).toBe(false);
    expect(validExploration({ ...base, entered: 'school' })).toBe(false);
  });
  it('안내 장면 앞에 말하는 사람 없는 상황 안내 한 줄이 있고 금지어가 없다', () => {
    expect(copy.places.setup.school).toBe('피오가 책상 위의 종이 두 장을 번갈아 보고 있어요.');
    expect(copy.places.setup.work).toBe('모루가 작업대에 표지 시안 두 장을 펼쳐 놓았어요.');
    for (const word of FORBIDDEN_WORDS) expect(JSON.stringify(copy.places.setup)).not.toContain(word);
  });
  it('안내 장면은 그 실내에 들어간 뒤에만 열린다', () => {
    const s = createState();
    expect(sceneAvailable(s, 'ST-V02')).toBe(false);
    expect(sceneAvailable(s, 'ST-V03')).toBe(false);
    enterPlace(s, 'school');
    expect(sceneAvailable(s, 'ST-V02')).toBe(true);
    expect(sceneAvailable(s, 'ST-V03')).toBe(false);
    enterPlace(s, 'work');
    expect(sceneAvailable(s, 'ST-V03')).toBe(true);
  });
  it('안내 장면을 끝까지 봐도 현실 미션·복귀 상태·씨앗을 바꾸지 않는다', () => {
    for (const [id, scene] of [['school', 'ST-V02'], ['work', 'ST-V03']] as const) {
      const s = createState();
      enterPlace(s, id);
      const before = JSON.stringify({ m: s.missions, logs: s.logs, seeds: s.seeds, packets: s.freePackets, fruit: s.fruit });
      const lines = sceneLines(s, sceneById(scene));
      lines.forEach((_, i) => confirmLine(s, scene, i));
      const choice = sceneById(scene).choices.find(c => c.id.endsWith('-C3'))!;
      expect(commitChoice(s, scene, choice.id)).toBe(true);
      expect(JSON.stringify({ m: s.missions, logs: s.logs, seeds: s.seeds, packets: s.freePackets, fruit: s.fruit })).toBe(before);
    }
  });
});
