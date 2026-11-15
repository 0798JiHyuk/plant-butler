import { describe,expect,it } from 'vitest';
import { LANDMARKS, worldEdge, worldRoute, nextRoadPoint, compassDirection } from '../core/worldGeometry';
import { ZONES, route } from '../core/exploration';
import { isWalkable } from '../scene/map';
import { districtBlocked } from '../scene/neighborhood';
import { createState } from '../core/state';
import { choiceReply, confirmedFact, confirmLine, nextMain, sceneById, sceneLines } from '../core/narrative';
import { ensureNarrative } from '../core/exploration';
import { speakerId } from '../ui/SpeakerPortrait';

describe('월드와 지도의 좌표·길 안내',()=>{
  it('지도 POI는 기획 도식이 아닌 실제 월드 위치와 같다',()=>{
    for(const id of ['garden','home','shop','junction','cafe','school','work'] as const){expect(ZONES[id].worldX).toBe(LANDMARKS[id].x);expect(ZONES[id].worldY).toBe(LANDMARKS[id].y);}
    expect(ZONES.home.worldY).toBeLessThan(ZONES.garden.worldY);
    expect(ZONES.shop.worldX).toBeLessThan(ZONES.junction.worldX);
    expect(ZONES.cafe.worldY).toBeGreaterThan(ZONES.junction.worldY);
  });
  it('모든 건물 왕복 안내선의 모든 구간이 실제 통행 가능한 길이다',()=>{
    for(const nodes of ['home','shop','cafe','school','work'].flatMap(id=>[route('garden',id as keyof typeof ZONES),route(id as keyof typeof ZONES,'garden')])){
      const points=worldRoute(nodes);
      for(let i=1;i<points.length;i++)for(let t=0;t<=1;t+=.05){
        const x=points[i-1].x+(points[i].x-points[i-1].x)*t,y=points[i-1].y+(points[i].y-points[i-1].y)*t;
        expect(isWalkable(x,y),`${x},${y}`).toBe(true);expect(districtBlocked(x,y),`${x},${y}`).toBe(false);
      }
    }
  });
  it('귀환은 건물을 가로지르는 직선 대신 실제 모퉁이를 안내한다',()=>{
    const points=worldRoute(route('cafe','garden'));
    expect(nextRoadPoint({x:3112,y:1904},points)).toEqual({x:2840,y:1880});
    expect(compassDirection({x:3112,y:1904},nextRoadPoint({x:3112,y:1904},points)!)).toBe('west');
    expect(nextRoadPoint({x:2840,y:1880},points)).toEqual({x:2640,y:1600});
    expect(worldEdge('shop','garden').slice().reverse()).toEqual(worldEdge('garden','shop'));
  });
});
describe('화자와 실제 확인 사실',()=>{
  it('지도 대사를 확인하고 선택 전에 닫아도 다음 주민을 안내한다',()=>{
    const s=createState(),p=ensureNarrative(s);p.completed.push('ST-P01');
    sceneLines(s,sceneById('ST-P02')).forEach((_,i)=>confirmLine(s,'ST-P02',i));
    expect(p.completed).not.toContain('ST-P02');expect(nextMain(s)).toBe('ST-A01');
  });
  it('선택 답변도 원고의 화자를 사용한다',()=>{
    const scene=sceneById('ST-D01'),s=createState();
    const reply=choiceReply(s,scene,scene.choices.find(x=>x.id==='r2-D01-C3')!);
    expect(reply?.speaker).toBe('느리');expect(speakerId(reply!.speaker)).toBe('nuri');
    expect(speakerId('모루')).toBe('moru');expect(speakerId('피오')).toBe('pio');expect(speakerId('연출')).toBeUndefined();
  });
  it('선물 수령 기록은 조용한 자리 확인 여부를 바꾸지 않는다',()=>{
    const s=createState();ensureNarrative(s);s.story.seen.push('free-packet');
    expect(confirmedFact(s,'quietPlaceSeen')).toBe('unseen');
    const scene=sceneById('ST-C01');expect(choiceReply(s,scene,scene.choices[1])?.text).toBe('안개가 걷힌 곳이 모두 조용한 자리는 아니야. 소리 이야기는 따로 들려줄게.');
  });
  it('조용한 자리 대사 확인 뒤 중단해도 이미 본 사실로 기억한다',()=>{
    const s=createState();ensureNarrative(s).facts.push('pioMapSeen');
    const scene=sceneById('ST-S06');sceneLines(s,scene).forEach((_,i)=>confirmLine(s,scene.id,i));
    expect(confirmedFact(s,'quietPlaceSeen')).toBe('confirmed');expect(s.garden.narrative?.completed).not.toContain('ST-S06');
    const c=sceneById('ST-C01');expect(choiceReply(s,c,c.choices[1])?.text).toContain('그늘에서 조용한 자리도 봤지');
  });
});
