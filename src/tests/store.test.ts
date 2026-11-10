import { describe, expect, it, vi } from 'vitest';
import { createMissionState, loadState, store } from '../core/store';

describe('store', () => {
  it('변경을 반영하고 구독자에게 알리고 다시 불러올 수 있다', () => {
    const fn = vi.fn();
    store.subscribe(fn);
    store.update((d) => {
      d.settings.sound = false;
    });
    expect(store.state.settings.sound).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(loadState().settings.sound).toBe(false);
  });

  it('reset은 처음 상태로 돌린다', () => {
    store.reset();
    expect(store.state.logs).toEqual([]);
    expect(store.state.settings.sound).toBe(true);
  });

  it('예전 저장본에 대화 기록이 없으면 빈 목록으로 채운다', () => {
    store.update((d) => {
      delete (d as { chats?: unknown }).chats;
    });
    expect(loadState().chats).toEqual([]);
  });

  it('예전 저장본에 미션 상태가 없으면 기본값으로, 단계는 칸별로 채운다', () => {
    store.update((d) => {
      delete (d as { missions?: unknown }).missions;
      delete (d as { sessionPackets?: unknown }).sessionPackets;
    });
    expect(loadState().missions).toEqual(createMissionState());
    expect(loadState().sessionPackets).toBe(0);
    store.update((d) => {
      d.missions = { ...createMissionState(), stage: { daily: 3 } as never };
    });
    expect(loadState().missions.stage).toEqual({ daily: 3, academic: 1, work: 1 });
  });
});
