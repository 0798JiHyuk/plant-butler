import { describe, expect, it } from 'vitest';
import { createState, decodeState } from '../core/state';
import { ensureExploration } from '../core/exploration';
import { upgradeGardenLayout } from '../core/worldMigration';

describe('넓어진 정원 저장 이전',()=>{
  it('기존 바깥 좌표만 한 번 이동하고 텃밭 슬롯·실내·재화는 보존한다',()=>{
    const old=createState();delete old.garden.layoutVersion;
    old.garden.items.push({id:'bench',kind:'bench',variant:0,col:10,row:9});
    old.garden.plants.push({id:'a',plantId:'daisy',date:'2026-11-12',col:9,row:28},{id:'b',plantId:'daisy',date:'2026-11-12',col:100,row:101});
    old.garden.bed={x:420,y:268};
    old.garden.interior={items:[{id:'table',kind:'table',variant:0,col:12,row:12}]};
    old.garden.storage.push({id:'stored',type:'decor',decorKind:'shelf',variant:1});
    old.fruit=37;old.visits.count=5;old.garden.name='내 정원';
    ensureExploration(old).goal={kind:'table',zone:'garden',col:10,row:12};
    const before=structuredClone(old),restored=decodeState(old);
    expect(old).toEqual(before);
    expect(restored.garden.items[0]).toMatchObject({col:18,row:57});
    expect(restored.garden.plants[0]).toMatchObject({col:17,row:76,date:'2026-11-12'});
    expect(restored.garden.plants[1]).toEqual(old.garden.plants[1]);
    expect(restored.garden.bed).toEqual({x:676,y:1804});
    expect(restored.garden.exploration?.goal).toMatchObject({col:18,row:60});
    expect(restored.garden.interior).toEqual(old.garden.interior);
    expect(restored.garden.storage).toEqual(old.garden.storage);
    expect(restored.fruit).toBe(37);expect(restored.visits.count).toBe(5);expect(restored.garden.name).toBe('내 정원');
    expect(restored.garden.layoutVersion).toBe(2);
    const once=structuredClone(restored);upgradeGardenLayout(restored);
    expect(restored).toEqual(once);expect(decodeState(JSON.parse(JSON.stringify(restored)))).toEqual(once);
  });
  it('새 정원과 실내 목표의 좌표는 이동하지 않는다',()=>{
    const current=createState();current.garden.items.push({id:'a',kind:'bench',variant:0,col:18,row:57});
    expect(decodeState(current)).toEqual(current);
    delete current.garden.layoutVersion;
    ensureExploration(current).goal={kind:'table',zone:'home',col:12,row:12};
    expect(decodeState(current).garden.exploration?.goal).toEqual(current.garden.exploration?.goal);
  });
});
