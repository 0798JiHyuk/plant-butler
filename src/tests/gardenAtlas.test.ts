import { describe,expect,it } from 'vitest';
import { createState,decodeState,stateKey } from '../core/state';
import { completeNameDecision } from '../core/narrative';
import { ensureNarrative } from '../core/exploration';
import { markPlace,validMapMarks } from '../core/gardenAtlas';

describe('이름과 표식으로 남기는 내 지도',()=>{
  it('이름·표식 저장은 지형·가구·재화·미션을 바꾸지 않는다',()=>{
    const s=createState();s.garden.name='기존 정원';s.fruit=12;ensureNarrative(s).facts.push('slotSeen');
    const before=stateKey({items:s.garden.items,plants:s.garden.plants,fruit:s.fruit,missions:s.missions});
    expect(completeNameDecision(s,'그늘이 좋은 길',[{place:'tree',symbol:'leaf'}])).toBe(true);
    expect(s.garden.narrative?.mapName).toBe('그늘이 좋은 길');expect(s.garden.name).toBe('기존 정원');
    expect(stateKey({items:s.garden.items,plants:s.garden.plants,fruit:s.fruit,missions:s.missions})).toBe(before);
    expect(decodeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it('이름 없이 표식만 남길 수 있고 명시적 빈칸 선택과 구분한다',()=>{
    const s=createState(),p=ensureNarrative(s);p.facts.push('slotSeen');
    expect(completeNameDecision(s,'',[{place:'entrance',symbol:'arrow'}])).toBe(true);expect(p.decision).toBe('own');
    expect(completeNameDecision(s,null)).toBe(true);expect(p.decision).toBe('empty');
    expect(p.marks).toEqual([{place:'entrance',symbol:'arrow'}]);
  });
  it('지도판 홈 확인 전에는 최종 지도를 생성하지 않는다',()=>{
    const s=createState();expect(completeNameDecision(s,'내 지도')).toBe(false);expect(s.garden.narrative?.decision).toBeUndefined();
  });
  it('표식은 정해진 장소에 하나씩만 남기고 바꾸거나 지울 수 있다',()=>{
    const first=markPlace([],'tree','leaf'),changed=markPlace(first,'tree','quiet');
    expect(changed).toEqual([{place:'tree',symbol:'quiet'}]);expect(markPlace(changed,'tree')).toEqual([]);
    expect(validMapMarks([{place:'tree',symbol:'leaf'},{place:'tree',symbol:'quiet'}])).toBe(false);
    expect(validMapMarks([{place:'constructor',symbol:'leaf'}])).toBe(false);
  });
});
