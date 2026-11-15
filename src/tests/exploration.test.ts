import { describe, expect, it } from 'vitest';
import { createState, decodeState } from '../core/state';
import { bookmark, chooseDestination, chooseFrontier, frontierOptions, discover, ensureExploration, ensureNarrative, exploration, route, toggleLayer } from '../core/exploration';
import { commitChoice, completeNameDecision, confirmLine, MAIN, narrativeScenes, sceneAvailable, sceneById, sceneLines } from '../core/narrative';
import { purchaseOnce, setDecorationGoal } from '../core/decoration';
import { stateKey } from '../core/state';

describe('지도와 개정 이야기',()=>{
  it('학교와 직장까지 길이 이어지고 방문 전에는 목적지로 선택하지 않는다',()=>{
    const s=createState();expect(route('cafe','garden')).toEqual(['cafe','junction','shop','garden']);
    expect(route('garden','work')).toEqual(['garden','shop','junction','school','work']);expect(chooseDestination(s,'school')).toBe(false);expect(discover(s,'school')).toBe(true);expect(chooseDestination(s,'school')).toBe(true);
    expect(chooseDestination(s,'cafe')).toBe(false);expect(bookmark(s,'cafe')).toBe(false);
  });
  it('길 끝은 선택해도 발견하지 않고, 아직 보이지 않는 다음 길은 선택하지 않는다',()=>{
    const s=createState();expect(frontierOptions(s)).toEqual(['shop']);
    expect(chooseFrontier(s,'cafe')).toBe(false);expect(chooseFrontier(s,'shop')).toBe(true);
    expect(exploration(s).discovered).toEqual(['garden']);discover(s,'shop');
    expect(exploration(s).destination).toBeUndefined();expect(frontierOptions(s)).toEqual(['junction']);
  });
  it('실제 진입 중복은 한 번이고 지도 선택은 방문 이력을 만들지 않는다',()=>{
    const s=createState();discover(s,'garden');discover(s,'shop');expect(discover(s,'shop')).toBe(false);
    expect(exploration(s).discovered).toEqual(['garden','shop']);expect(exploration(s).walked).toEqual(['garden/shop']);
    chooseDestination(s,'garden');expect(exploration(s).discovered).toEqual(['garden','shop']);
    expect(s.logs).toEqual([]);expect(s.missions).toBeUndefined();expect(s.fruit).toBe(0);
  });
  it('신규 지도 레이어는 실제 확인 사실 없이 과거 완료 이력만으로 열리지 않는다',()=>{
    const s=createState();s.story.seen.push('ST-A01');toggleLayer(s,'nuri');expect(exploration(s).layers).toEqual([]);
    ensureNarrative(s).facts.push('neuriMapSeen');toggleLayer(s,'nuri');expect(exploration(s).layers).toEqual(['nuri']);
  });
  it('미션·방문·구매·레이어 사용 0회로 본편을 끝낸다',()=>{
    const s=createState();
    for(const id of MAIN){
      expect(sceneAvailable(s,id),id).toBe(true);
      const scene=sceneById(id);sceneLines(s,scene).forEach((_,i)=>confirmLine(s,id,i));
      const choice=id==='ST-D01'?'r2-D01-C3':scene.choices[0].id;
      expect(commitChoice(s,id,choice),id).toBe(true);
    }
    expect(s.garden.narrative?.completed).toContain('ST-E01');
    expect([s.logs.length,s.purchases,s.freePackets,s.fruit,s.visits.count]).toEqual([0,0,0,0,0]);
    expect(s.garden.exploration).toBeUndefined();
  });
  it('대화 중 닫기는 완료가 아니고 홈은 발견 대사 확인 전 드러나지 않는다',()=>{
    const s=createState();confirmLine(s,'ST-P01',0);expect(s.garden.narrative?.cursors['ST-P01']).toBe(1);
    expect(s.garden.narrative?.completed).toEqual([]);expect(commitChoice(s,'ST-P01','r2-P01-C1')).toBe(false);
    expect(s.garden.narrative?.facts).not.toContain('slotSeen');
    ensureNarrative(s).facts.push('blankNameSeen','neuriMapSeen','moruMapSeen','pioMapSeen');
    confirmLine(s,'ST-D01',0);expect(s.garden.narrative?.facts).not.toContain('slotSeen');
    confirmLine(s,'ST-D01',1);expect(s.garden.narrative?.facts).toContain('slotSeen');
  });
  it('이름 작성 보류와 명시적인 빈칸 결말을 구분한다',()=>{
    const s=createState(),p=ensureNarrative(s);p.facts.push('blankNameSeen','neuriMapSeen','moruMapSeen','pioMapSeen');
    sceneLines(s,sceneById('ST-D01')).forEach((_,i)=>confirmLine(s,'ST-D01',i));
    commitChoice(s,'ST-D01','r2-D01-C1');expect(p.completed).not.toContain('ST-D01');expect(sceneAvailable(s,'ST-E01')).toBe(false);
    completeNameDecision(s,null);expect(sceneAvailable(s,'ST-E01')).toBe(true);expect(s.garden.name).toBeUndefined();
  });
  it('이전 저장 복원은 자산·직접 미션과 기존 선택을 지우지 않는다',()=>{
    const s=createState();s.fruit=13;s.freePackets=1;s.story.choices['intro/p02-2']=2;
    const before=decodeState(s);expect(before).toEqual(s);
    discover(s,'cafe');bookmark(s,'cafe');confirmLine(s,'ST-P01',0);
    const after=decodeState(JSON.parse(JSON.stringify(s)));expect(after).toEqual(s);expect(after.fruit).toBe(13);expect(after.story.choices).toEqual(before.story.choices);
  });
  it('개정된 14장면은 구 선택 ID를 실행하지 않는다',()=>{
    expect(narrativeScenes).toHaveLength(34);
    for(const x of narrativeScenes.filter(x=>x.revision==='r2'))expect(x.choices.every(c=>c.id.startsWith('r2-')),x.id).toBe(true);
  });
  it('목표는 구매·실배치가 아니고 같은 구매 요청은 한 번만 차감한다',()=>{
    const s=createState();s.fruit=10;const before=stateKey({items:s.garden.items,storage:s.garden.storage,fruit:s.fruit});
    expect(setDecorationGoal(s,'bench','home',10,12)).toBe(true);
    expect(stateKey({items:s.garden.items,storage:s.garden.storage,fruit:s.fruit})).toBe(before);
    expect(purchaseOnce(s,'bench','request-1')).toBe('ok');expect(purchaseOnce(s,'bench','request-1')).toBe('ok');
    expect(s.fruit).toBe(6);expect(s.garden.storage).toHaveLength(1);expect(purchaseOnce(s,'table','request-1')).toBe('unknown');
    expect(purchaseOnce(s,'hammock','request-2')).toBe('poor');expect(s.fruit).toBe(6);
  });
  it('깨진 지도/이야기 저장본은 기존 저장 위에 적용하지 않는다',()=>{
    const s=createState();ensureExploration(s);ensureNarrative(s);const raw=JSON.parse(JSON.stringify(s));raw.garden.narrative.cursors['ST-P01']=-1;
    expect(()=>decodeState(raw)).toThrow();
  });
});
