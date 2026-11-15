import { describe,expect,it } from 'vitest';
import { withinReach,seatPlacement,INTERACTION_RANGE,SHOP_RANGE } from '../core/interaction';
import { isWalkable,terrainFootBlocked } from '../core/worldTerrain';
import { LANDMARKS,WORLD_EDGES } from '../core/worldGeometry';
import { wallBlocked } from '../core/terrainBoundaries';

describe('가까운 상호작용과 가구 휴식',()=>{
  it('경계 거리까지 허용하고 먼 곳과 유효하지 않은 좌표는 거절한다',()=>{
    const from={x:0,y:0};
    expect(withinReach(from,{x:INTERACTION_RANGE,y:0})).toBe(true);
    expect(withinReach(from,{x:INTERACTION_RANGE+1,y:0})).toBe(false);
    expect(withinReach(from,{x:SHOP_RANGE,y:0},SHOP_RANGE)).toBe(true);
    expect(withinReach(from,{x:NaN,y:0})).toBe(false);
    expect(withinReach(from,{x:220,y:0})).toBe(true);
    expect(withinReach(from,{x:280,y:0},SHOP_RANGE)).toBe(true);
    expect(withinReach(from,{x:600,y:0},SHOP_RANGE)).toBe(false);
  });
  it('벤치는 앉기, 해먹은 눕기를 사용하고 가구보다 앞에 표시한다',()=>{
    const anchor={x:500,y:2500},bench=seatPlacement(anchor,'bench',125),hammock=seatPlacement(anchor,'hammock',135);
    expect(bench.pose).toBe('sit');expect(hammock.pose).toBe('lie');
    expect(bench.y).toBeLessThan(anchor.y);expect(hammock.y).toBeLessThan(bench.y);
    expect(bench.depth).toBeGreaterThan(anchor.y);expect(hammock.depth).toBeGreaterThan(anchor.y);
  });
  it('보이는 중앙 잔디가 열려 있고 돌담·밑동·건물은 통과하지 않는다',()=>{
    expect(isWalkable(2000,2200)).toBe(true); // 이전에는 보이지 않는 경계에 막힘
    expect(isWalkable(2800,2350)).toBe(true);
    expect(wallBlocked(207*4096/1440,1046*4096/1440)).toBe(true);
    expect(isWalkable(370,1840)).toBe(false);
    expect(terrainFootBlocked(2400,400)).toBe(true);
    expect(isWalkable(LANDMARKS.board.x+70,LANDMARKS.board.y+45)).toBe(true);
  });
  it('정원 출입구와 모든 기존 왕복 길은 막지 않는다',()=>{
    for(const points of Object.values(WORLD_EDGES))for(let i=1;i<points.length;i++)for(let t=0;t<=1;t+=.05){
      const a=points[i-1],b=points[i];
      expect(terrainFootBlocked(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)).toBe(false);
    }
  });
  it('지도판 옆 돌담의 밑면은 막고 앞 잔디와 출입구는 열어 둔다',()=>{
    const scale=4096/1440;
    expect(wallBlocked(264*scale,785*scale)).toBe(true);
    expect(terrainFootBlocked(264*scale,785*scale)).toBe(true);
    for(const x of [220,240,260,285,310]){
      expect(terrainFootBlocked(x*scale,815*scale),`grass ${x}`).toBe(false);
    }
    for(let y=2224;y<=2432;y+=8)expect(terrainFootBlocked(896,y),`gate ${y}`).toBe(false);
  });
});
