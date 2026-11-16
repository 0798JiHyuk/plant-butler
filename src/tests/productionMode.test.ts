import { afterEach, expect, it, vi } from 'vitest';
import { createState, decodeState } from '../core/state';
import { now, todayKey } from '../core/clock';

afterEach(()=>vi.useRealTimers());
it('이전 데모 저장을 읽어도 실제 날짜를 사용하고 진행 데이터는 유지한다',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,10,16,12));
  const old=createState();old.settings.demo=true;old.settings.dayOffset=90;
  old.fruit=23;old.seeds.push({id:'seed-1',plantId:'daisy'});old.days['2026-11-15']={refresh:0,sessionRewarded:true};
  const before=structuredClone(old),restored=decodeState(old);
  expect(restored.settings.demo).toBe(false);expect(restored.settings.dayOffset).toBe(0);
  expect(todayKey()).toBe('2026-11-16');expect(now().getTime()).toBe(Date.now());
  expect({...restored,settings:before.settings}).toEqual(before);expect(old).toEqual(before);
});
