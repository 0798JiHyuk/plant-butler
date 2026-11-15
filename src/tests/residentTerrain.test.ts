import { describe,expect,it } from 'vitest';
import { terrainFootBlocked } from '../core/worldTerrain';
import { LANDMARKS,WORLD_EDGES } from '../core/worldGeometry';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExplorationFog } from '../ui/panels/ExplorationFog';
import { createState } from '../core/state';
import { discover,ensureNarrative } from '../core/exploration';
import { sceneAvailable,sceneById,sceneLines } from '../core/narrative';
import { MAP_PLACES } from '../core/gardenAtlas';

describe('주민 전체 지도와 고정 지형',()=>{
  it('이동 판정은 유지하고 피오의 안개만 발견 상태에 따라 걷힌다',()=>{
    expect(terrainFootBlocked(40,40)).toBe(true);
    expect(terrainFootBlocked(2400,400)).toBe(true); // 학교 건물
    expect(terrainFootBlocked(3496,500)).toBe(true); // 직장 건물
    for(const points of Object.values(WORLD_EDGES))for(let i=1;i<points.length;i++){
      const [a,b]=[points[i-1],points[i]];
      for(let t=0;t<=1;t+=.1)expect(terrainFootBlocked(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)).toBe(false);
    }
    const s=createState();
    const before=renderToStaticMarkup(createElement(ExplorationFog,{known:['garden'],here:LANDMARKS.garden}));
    discover(s,'shop');discover(s,'junction');discover(s,'school');
    const after=renderToStaticMarkup(createElement(ExplorationFog,{known:['garden','shop','junction','school'],here:LANDMARKS.garden}));
    expect(after).not.toBe(before);expect(after).toContain('resident-pio-painted.webp');expect(after).not.toContain('world-hd-');expect(s.logs).toEqual([]);expect(s.fruit).toBe(0);
  });
  it('표식은 축소된 옛 정원이 아니라 현재 월드의 같은 장소에 놓인다',()=>{
    expect(MAP_PLACES.home).toEqual(LANDMARKS.home);
    expect(MAP_PLACES.entrance).toEqual(LANDMARKS.garden);
    expect(MAP_PLACES.shelf).toEqual(LANDMARKS.pio);
  });
  it('지도 문구를 바꿔도 이전 확인 사실과 엔딩 선행 조건을 유지한다',()=>{
    const s=createState(),p=ensureNarrative(s);
    p.facts.push('blankNameSeen','neuriMapSeen','moruMapSeen','pioMapSeen');
    expect(sceneAvailable(s,'ST-D01')).toBe(true);
    expect(sceneLines(s,sceneById('ST-C01')).some(x=>x.fact==='pioMapSeen')).toBe(true);
    expect(sceneById('ST-C01').choices.map(x=>x.id)).toEqual(['r2-C01-C1','r2-C01-C2','r2-C01-C3','r2-C01-C4']);
  });
});
