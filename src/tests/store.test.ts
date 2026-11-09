import { describe, expect, it, vi } from 'vitest';
import { loadState, store } from '../core/store';

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
});
