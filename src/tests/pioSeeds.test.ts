import { describe, expect, it, vi } from 'vitest';
import { createState, decodeState } from '../core/state';
import { PIO_SEEDS, canFindPioSeeds, findPioSeeds } from '../core/pioSeeds';
import { ensureExploration } from '../core/exploration';
import { terrainFootBlocked } from '../core/worldTerrain';
import { limitReached } from '../core/rules';
import { plantById } from '../core/plants';

const at={x:PIO_SEEDS.x,y:PIO_SEEDS.y,indoor:false};
describe('피오의 숨겨진 씨앗',()=>{
  it('걷는 위치의 가까운 범위에서만 발견하며 실내와 잘못된 좌표는 제외한다',()=>{
    const s=createState();expect(terrainFootBlocked(at.x,at.y)).toBe(false);
    expect(canFindPioSeeds(s,{...at,x:at.x+PIO_SEEDS.radius})).toBe(true);
    for(const point of [{...at,x:at.x+PIO_SEEDS.radius+1},{...at,x:NaN},{...at,y:Infinity},{...at,indoor:true}]){
      expect(findPioSeeds(s,point)).toEqual([]);expect(s.seeds).toEqual([]);expect(s.garden.exploration).toBeUndefined();
    }
  });
  it('직접 씨앗 3개를 지급하며 기존 씨앗 ID와 겹치지 않는다',()=>{
    const s=createState();s.seeds.push({id:'seed-12',plantId:'daisy'});const rand=vi.fn(()=>.8);
    const seeds=findPioSeeds(s,at,rand);
    expect(seeds).toHaveLength(3);expect(s.seeds).toHaveLength(4);expect(new Set(s.seeds.map(x=>x.id)).size).toBe(4);
    expect(seeds.every(x=>plantById(x.plantId))).toBe(true);expect(ensureExploration(s).pioSeedsFound).toBe(true);
    expect(findPioSeeds(s,at,rand)).toEqual([]);expect(rand).toHaveBeenCalledTimes(6);
  });
  it('저장·복원 후 같은 장소에 다시 가도 중복 지급하지 않는다',()=>{
    const original=createState();findPioSeeds(original,at,()=>.8);
    const restored=decodeState(JSON.parse(JSON.stringify(original)));
    expect(canFindPioSeeds(restored,at)).toBe(false);expect(findPioSeeds(restored,at)).toEqual([]);expect(restored.seeds).toHaveLength(3);
  });
  it('하루 3회 완료 후에도 찾을 수 있고 완료·주머니·재화·스토리를 바꾸지 않는다',()=>{
    const s=createState(),date='2026-11-15';
    for(let i=0;i<3;i++)s.logs.push({id:`log-${i}`,date,activityId:'meal',plan:{when:'',where:'',minutes:0},chips:[],source:'daily'});
    expect(limitReached(s,date)).toBe(true);s.fruit=17;s.garden.storage.push({id:'bench',type:'decor',decorKind:'bench',variant:0});
    const before=structuredClone(s);findPioSeeds(s,at);
    expect(s.logs).toEqual(before.logs);expect(s.days).toEqual(before.days);expect(s.story).toEqual(before.story);
    expect(s.fruit).toBe(17);expect(s.freePackets).toBe(before.freePackets);expect(s.bonusPackets).toBe(before.bonusPackets);
    expect(s.garden.storage).toEqual(before.garden.storage);expect(s.missions).toEqual(before.missions);
  });
  it('구버전 저장은 수령 전으로 유지하고 잘못된 수령 상태는 거절한다',()=>{
    const old=createState();ensureExploration(old);expect(canFindPioSeeds(decodeState(old),at)).toBe(true);
    const invalid=structuredClone(old) as unknown as {garden:{exploration:{pioSeedsFound:unknown}}};invalid.garden.exploration.pioSeedsFound='true';
    expect(()=>decodeState(invalid)).toThrow();
  });
});
