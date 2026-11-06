import { describe, it, expect } from 'vitest';
import { store } from '@/core/store';
import { createState, stateKey } from '@/core/state';
import { loadJson, saveJson } from '@/core/storage';

describe('계정별 로컬 진행', () => {
  it('A에서 B로 바꾸면 이전 정원과 가방을 노출하지 않고 다시 A에서 복원한다', () => {
    store.activateUser('test-A'); store.restore(createState());
    store.update(s => { s.fruit = 12; s.garden.bed = { x: 400, y: 350 }; s.seeds.push({ id: 'a', plantId: 'daisy' }); });
    store.activateUser('test-B'); expect(store.state.fruit).toBe(0); expect(store.state.garden.bed).toBeUndefined(); expect(store.state.seeds).toHaveLength(0);
    store.update(s => { s.fruit = 3; }); store.activateUser('test-A');
    expect(store.state.fruit).toBe(12); expect(store.state.garden.bed?.y).toBe(350);
    store.activateUser(null); expect(store.state.fruit).toBe(0);
  });
  it('기존 계정 로그인 전 게스트 진행을 표시하고 대상 계정 캐시를 백업한다', () => {
    store.activateUser('transfer-target'); store.restore(createState()); store.update(s => { s.fruit = 20; });
    store.activateUser('transfer-guest'); store.restore(createState()); store.update(s => { s.fruit = 5; }); store.prepareTransfer();
    const result = store.activateUser('transfer-target');
    expect(result.imported).toBe(true); expect(result.fallback.fruit).toBe(20); expect(store.state.fruit).toBe(5);
    const keys = loadJson<string[]>('plantkeeper:user:transfer-target:v1:backups', []);
    expect(keys.some(key => loadJson<{ fruit: number }>(key, { fruit: 0 }).fruit === 20)).toBe(true);
  });
  it('동일 UID 재연결은 진행을 초기화하지 않고 구 버전 원본은 유지한다', () => {
    const legacy = loadJson<unknown>('plantkeeper:v1', null);
    store.activateUser('same'); store.restore(createState()); store.update(s => { s.fruit = 8; });
    store.activateUser('same'); expect(store.state.fruit).toBe(8); expect(stateKey(loadJson('plantkeeper:v1', null))).toBe(stateKey(legacy));
  });
  it('알 수 없는 로컬 저장 버전은 보존하고 자동 저장 대신 선택을 요청한다', () => {
    const raw = { ...createState(), version: 2, fruit: 999 }; saveJson('plantkeeper:user:future:v1', raw);
    const result = store.activateUser('future'); expect(result.imported).toBe(true);
    expect(loadJson('plantkeeper:user:future:v1:unreadable-backup', null)).toEqual(raw);
    store.activateUser(null);
  });
});
