import { describe, expect, it } from 'vitest';
import { createState, decodeState } from '../core/state';
import { migrateSave } from '../core/saveMigrations';

describe('저장 스키마 변환 계약',()=>{
  it('구형 저장에 명시적 버전을 붙이며 원본·재화·배치를 보존하고 반복 적용에 안전하다',()=>{
    const old=createState();delete old.saveSchemaVersion;old.fruit=41;
    old.garden.items.push({id:'chair',kind:'bench',variant:0,col:20,row:60,flipped:true});
    const before=structuredClone(old),next=decodeState(old);
    expect(old).toEqual(before);expect(next.saveSchemaVersion).toBe(1);
    expect(next.fruit).toBe(41);expect(next.garden).toEqual(old.garden);
    expect(decodeState(next)).toEqual(next);expect(migrateSave(next)).toEqual(next);
  });
  it('미래 버전과 잘못된 버전은 조용히 초기화하거나 다운그레이드하지 않는다',()=>{
    for(const value of [2,0,null,'1'])expect(()=>decodeState({...createState(),saveSchemaVersion:value})).toThrow();
    expect(()=>decodeState({...createState(),version:2})).toThrow();
  });
});
