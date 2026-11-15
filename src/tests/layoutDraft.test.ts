import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../core/store';
import { beginLayout, discardLayout, editLayout, layoutState, saveLayout, undoLayout } from '../core/layoutDraft';
import { placeHomeFurniture } from '../core/world';
import { createState } from '../core/state';

describe('배치 초안과 저장 오류',()=>{
  beforeEach(()=>{
    const values=new Map<string,string>();
    vi.stubGlobal('localStorage',{setItem:vi.fn((k:string,v:string)=>values.set(k,v)),getItem:vi.fn((k:string)=>values.get(k)??null)});
    store.restore(createState());
    store.update(s=>{s.garden.storage.push({id:'chair',type:'decor',decorKind:'bench',variant:0});});
  });
  afterEach(()=>{discardLayout();vi.unstubAllGlobals();});
  it('초안 이동·되돌리기·취소는 실제 자산을 바꾸지 않는다',()=>{
    beginLayout();editLayout(s=>{placeHomeFurniture(s,'chair',10,12);});
    expect(layoutState().garden.interior?.items).toHaveLength(1);expect(store.state.garden.interior).toBeUndefined();
    expect(undoLayout()).toBe(true);expect(layoutState().garden.storage).toHaveLength(1);
    editLayout(s=>{placeHomeFurniture(s,'chair',10,12);});discardLayout();
    expect(store.state.garden.storage).toHaveLength(1);expect(store.state.garden.interior).toBeUndefined();
  });
  it('마지막 정상 배치는 저장 실패 때 유지하고 초안으로 재시도한다',()=>{
    beginLayout();editLayout(s=>{placeHomeFurniture(s,'chair',10,12);});
    const set=vi.spyOn(localStorage,'setItem').mockImplementation(()=>{throw new Error('quota');});
    expect(saveLayout()).toBe('storage');expect(store.state.garden.interior).toBeUndefined();expect(layoutState().garden.interior?.items).toHaveLength(1);
    set.mockRestore();expect(saveLayout()).toBe('ok');expect(store.state.garden.interior?.items).toHaveLength(1);
  });
  it('편집 도중 다른 저장 배치가 들어오면 덮어쓰지 않는다',()=>{
    beginLayout();editLayout(s=>{placeHomeFurniture(s,'chair',10,12);});
    store.update(s=>{s.garden.storage.push({id:'other',type:'decor',decorKind:'table',variant:0});});
    expect(saveLayout()).toBe('conflict');expect(store.state.garden.storage).toHaveLength(2);expect(layoutState().garden.interior?.items).toHaveLength(1);
  });
  it('배치 저장은 편집 도중 바뀐 열매나 미션을 덮어쓰지 않는다',()=>{
    beginLayout();editLayout(s=>{placeHomeFurniture(s,'chair',10,12);});store.update(s=>{s.fruit=17;});
    expect(saveLayout()).toBe('ok');expect(store.state.fruit).toBe(17);expect(store.state.garden.storage).toHaveLength(0);
  });
});
