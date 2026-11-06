// core·scene·ui가 서로를 직접 참조하지 않고 대화하는 얇은 이벤트 버스.

export type HudAction = 'records' | 'decorate' | 'settings' | 'talk' | 'plan-check' | 'other-activity' | 'done' | 'packet' | 'shop' | 'bag' | 'book' | 'gift';

export type NpcId = 'nuri' | 'moru' | 'pio';

import type { DecorItem, PlantedItem, StoredThing } from './types';

export interface AppEvents {
  /** 계정/서버 저장본 복원. 게임 규칙 재실행 없이 장면만 다시 그린다. */
  'state-restored': Record<string, never>;
  'garden-ready': Record<string, never>;
  'move-input': { x: number; y: number };
  'player-screen': { x: number; y: number; zoom: number };
  'hud-action': { id: HudAction };
  'ui-lock': { locked: boolean };
  /** 정원을 보는 배율(시야) 바꾸기 */
  'view-zoom': { zoom: number };
  'sprout-pose': { pose: 'rest' | 'idle' };
  'plant-grown': { planted: PlantedItem };
  'decorate-mode': { on: boolean };
  celebrate: { item: DecorItem | null };
  /** 창고에서 꺼낸 것(소품·식물)을 정원에 놓는 중임을 씬에 알린다. */
  'decor-place-start': StoredThing;
  /** 씨앗함의 씨앗을 심을 두둑을 고르기 시작한다. */
  'seed-pick-start': { seedId: string; tree: boolean };
  /** 고른 두둑에 씨앗을 심었다 */
  'seed-planted': { planted: PlantedItem };
  /** 소품이 창고↔정원 사이에서 옮겨졌을 때 UI(꾸미기 바)가 반응하도록. */
  'decor-changed': { action: 'stored' | 'placed' };
  /** 정원에서 주민을 눌렀을 때(대화를 연다) */
  'npc-talk': { id: NpcId };
  /** 정원에서 식물을 눌렀을 때(꽃이 폈으면 열매를 딴다) */
  'plant-tap': { id: string };
  /** 효과음을 낸다 */
  sfx: { name: 'open' | 'buy' | 'gift' };
  /** 열매를 땄다 */
  harvested: { id: string };
}

type Handler<T> = (payload: T) => void;

class EventBus {
  private handlers: { [K in keyof AppEvents]?: Handler<AppEvents[K]>[] } = {};

  on<K extends keyof AppEvents>(name: K, fn: Handler<AppEvents[K]>): () => void {
    const list = (this.handlers[name] ??= []) as Handler<AppEvents[K]>[];
    list.push(fn);
    return () => {
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    };
  }

  emit<K extends keyof AppEvents>(name: K, payload: AppEvents[K]): void {
    (this.handlers[name] as Handler<AppEvents[K]>[] | undefined)?.slice().forEach((fn) => fn(payload));
  }
}

export const events = new EventBus();
