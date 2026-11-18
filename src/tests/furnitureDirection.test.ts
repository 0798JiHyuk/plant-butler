import { expect, it } from 'vitest';
import { createState,decodeState } from '../core/state';
import { flipFurniture,placeHomeFurniture,storeHomeFurniture } from '../core/world';
import { storeDecor,takeFromStorage } from '../core/rules';
import { readSharedGarden } from '../core/sharedGarden';
import { store } from '../core/store';
import { beginLayout,editLayout,layoutState,undoLayout,discardLayout } from '../core/layoutDraft';
it('가구 방향은 위치·재화 변경 없이 토글되고 저장 복원·창고 이동 시 유지된다',()=>{
  let s=createState();s.garden.items.push({id:'b',kind:'bench',variant:0,col:20,row:80});s.fruit=17;
  expect(flipFurniture(s,'b',false)).toBe(true);expect(s.garden.items[0].flipped).toBe(true);expect(s.fruit).toBe(17);
  s=decodeState(s);storeDecor(s,'b');expect(s.garden.storage[0].type).toBe('decor');
  expect(placeHomeFurniture(s,'b',12,12)?.flipped).toBe(true);expect(flipFurniture(s,'b',true)).toBe(true);expect(s.garden.interior?.items[0].flipped).toBe(false);
  storeHomeFurniture(s,'b');expect((takeFromStorage(s,'b',{col:20,row:80}) as {flipped?:boolean}).flipped).toBe(false);
  expect(flipFurniture(s,'missing',false)).toBe(false);
  const bad=structuredClone(s) as unknown as {garden:{items:{flipped:unknown}[]}};bad.garden.items[0].flipped='true';expect(()=>decodeState(bad)).toThrow();
});
it('공개용 배치에도 방향이 유지되고 임의 원문 필드는 복사하지 않는다',()=>{
  const g=readSharedGarden({name:'정원',bed:{x:560,y:2512},items:[{kind:'bench',col:20,row:80,flipped:true,memo:'secret'}],plants:[]})!;
  expect(g.items[0].flipped).toBe(true);expect(JSON.stringify(g)).not.toContain('secret');
});
it('임시 회전은 저장 전 원본을 바꾸지 않고 되돌리기·취소할 수 있다',()=>{
  const original=store.state,s=createState();s.garden.items.push({id:'draft-bench',kind:'bench',variant:0,col:30,row:85});store.restore(s);
  try{
    beginLayout();editLayout(d=>{flipFurniture(d,'draft-bench',false);});
    expect(layoutState().garden.items[0].flipped).toBe(true);expect(store.state.garden.items[0].flipped).toBeUndefined();
    expect(undoLayout()).toBe(true);expect(layoutState().garden.items[0].flipped).toBeUndefined();
    editLayout(d=>{flipFurniture(d,'draft-bench',false);});discardLayout();expect(store.state.garden.items[0].flipped).toBeUndefined();
  }finally{discardLayout();store.restore(original);}
});
