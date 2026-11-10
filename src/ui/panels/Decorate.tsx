// 꾸미기 모드: 정원 전체가 보이고, 소품·식물을 끌어 칸에 맞춰 놓거나 짚어서 창고에 넣는다. 창고에서 다시 꺼내 놓을 수도 있다.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { copy } from '../../core/copy';
import { events, type AppEvents } from '../../core/events';
import { isTree, plantById } from '../../core/plants';
import { bagCounts } from '../../core/rules';
import type { DecorItem, SeedItem, StoredThing } from '../../core/types';
import { IconBtn, PlantImg, PropImg } from '../icons';
import { closeModal, isModalOpen, openModal } from '../modal';
import { showToast } from '../toast';
import { useAppState } from '../useAppState';
import { PanelHead } from './PanelHead';

const KIND_ORDER: DecorItem['kind'][] = ['flowerpot', 'table', 'shelf', 'bench', 'birdbath', 'hammock', 'flower', 'pot', 'lamp'];

/** 창고 목록 정리: 소품은 종류별로, 식물은 이름순으로 뒤에 묶는다. */
function sortedStorage(storage: StoredThing[]): StoredThing[] {
  return [...storage].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'decor' ? -1 : 1;
    if (a.type === 'decor' && b.type === 'decor') return KIND_ORDER.indexOf(a.decorKind) - KIND_ORDER.indexOf(b.decorKind);
    if (a.type === 'plant' && b.type === 'plant') return (plantById(a.plantId)?.name ?? '').localeCompare(plantById(b.plantId)?.name ?? '');
    return 0;
  });
}

// ---------- 꾸미는 중인지 ----------
let on = false;
/** 심을 곳을 고르는 중이면 true. 꾸미기 화면을 그대로 쓰고 위쪽 바만 바뀐다. */
let picking = false;
let pickHint = '';
const subs = new Set<() => void>();
const notify = () => subs.forEach((fn) => fn());

/** 꾸미거나 심을 곳을 고르는 중인지(flow.ts가 화면이 비었는지 볼 때) */
export const isDecorating = (): boolean => on;

export function exitDecorate(): void {
  if (!on) return;
  on = false;
  picking = false;
  notify();
  events.emit('decorate-mode', { on: false });
  events.emit('ui-lock', { locked: false });
}

export function enterDecorate(): void {
  if (on || isModalOpen()) return;
  on = true;
  notify();
  events.emit('ui-lock', { locked: true });
  events.emit('decorate-mode', { on: true });
}

/** 씨앗을 심을 두둑을 고른다. 고르지 않고 나가면 씨앗은 씨앗함에 그대로 있다. */
export function enterSeedPick(seed: SeedItem): void {
  if (on || isModalOpen()) return;
  const tree = isTree(seed.plantId);
  picking = true;
  pickHint = tree ? copy.seedBox.pickHintTree : copy.seedBox.pickHint;
  enterDecorate();
  events.emit('seed-pick-start', { seedId: seed.id, tree });
}

// ---------- 창고 ----------
/** 창고 목록(소품 또는 식물). placeable이면 꺼내 놓을 수 있고(꾸미기 중), 아니면 보기만 한다(가방). */
export function StorageBody({ placeable, kind }: { placeable: boolean; kind: StoredThing['type'] }) {
  const { garden } = useAppState();
  const items = garden.storage.filter((i) => i.type === kind);
  if (items.length === 0) return <p className="panel-message">{kind === 'decor' ? copy.bag.emptyDecor : copy.bag.emptyPlants}</p>;
  return (
    <>
      <ul className="book-grid">
        {sortedStorage(items).map((item) => (
          <li className="book-card" key={item.id}>
            <span className="book-icon">
              {item.type === 'decor' ? <PropImg kind={item.decorKind} /> : <PlantImg id={item.plantId} />}
            </span>
            <strong>{item.type === 'decor' ? (copy.decorate.kind[item.decorKind] ?? item.decorKind) : plantById(item.plantId)?.name ?? ''}</strong>
            {placeable && (
              <button
                type="button"
                className="btn-chip btn-chip-primary"
                onClick={() => {
                  closeModal();
                  events.emit('decor-place-start', item);
                  showToast([copy.decorate.placeHint]);
                }}
              >
                {copy.decorate.takeOut}
              </button>
            )}
          </li>
        ))}
      </ul>
      {items.some((i) => i.type === 'plant' && i.harvested) && <p className="panel-note">{copy.decorate.flowerHint}</p>}
    </>
  );
}

function Storage() {
  const counts = bagCounts(useAppState());
  const [tab, setTab] = useState<StoredThing['type']>('decor');
  const tabs = (
    <div className="tabs" role="tablist">
      {([['decor', copy.bag.tab(copy.bag.decor, counts.decor)], ['plant', copy.bag.tab(copy.bag.plants, counts.plants)]] as const).map(([id, label]) => (
        <button key={id} type="button" className="tab" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
      ))}
    </div>
  );
  return (
    <section className="panel storage" role="dialog" aria-label={copy.decorate.storageTitle}>
      <PanelHead center={tabs} />
      <StorageBody placeable kind={tab} />
    </section>
  );
}

// ---------- 아래쪽 메뉴: 정원에서 짚은 것 ----------
/** 짚은 소품·식물에 할 수 있는 것: [옮기기]·[방향 바꾸기](소품만)·[창고에 넣기]. 바로 창고에 들어가던 실수를 막는다. */
function SelectBar() {
  const { garden } = useAppState();
  const [sel, setSel] = useState<AppEvents['decor-select']>(null);
  useEffect(() => events.on('decor-select', setSel), []);
  if (!sel) return null;
  const item = sel.type === 'decor' ? garden.items.find((i) => i.id === sel.id) : undefined;
  const plant = sel.type === 'plant' ? garden.plants.find((p) => p.id === sel.id) : undefined;
  if (!item && !plant) return null;
  const name = item ? (copy.decorate.kind[item.kind] ?? item.kind) : (plantById(plant!.plantId)?.name ?? '');
  const act = (action: AppEvents['decor-action']['action']) => events.emit('decor-action', { action });
  return (
    <div className="decorate-bar decorate-select interactive" role="toolbar" aria-label={name}>
      <span className="book-icon">{item ? <PropImg kind={item.kind} /> : <PlantImg id={plant!.plantId} />}</span>
      <div className="decorate-text">
        <strong>{sel.carrying ? copy.decorate.moving(name) : name}</strong>
        <span>{sel.carrying ? copy.decorate.moveHint : copy.decorate.selectHint}</span>
      </div>
      {sel.carrying ? (
        <button type="button" className="btn btn-secondary" onClick={() => act('cancel')}>{copy.decorate.cancel}</button>
      ) : (
        <>
          <button type="button" className="btn btn-secondary" onClick={() => act('move')}>{copy.decorate.move}</button>
          {item && <button type="button" className="btn btn-secondary" onClick={() => act('flip')}>{copy.decorate.flip}</button>}
          <button type="button" className="btn btn-secondary" onClick={() => act('store')}>{copy.decorate.store}</button>
          <IconBtn name="close" label={copy.decorate.close} onClick={() => act('cancel')} />
        </>
      )}
    </div>
  );
}

// ---------- 위쪽 바 ----------
export function DecorateBar() {
  const mode = useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => (on ? (picking ? 'pick' : 'decorate') : 'off'),
  );
  const active = mode !== 'off';
  const { garden } = useAppState();

  useEffect(() => {
    document.getElementById('ui')?.classList.toggle('decorating', active);
    if (!active) return;
    const offChanged = events.on('decor-changed', ({ action }) => {
      showToast([action === 'stored' ? copy.decorate.stored : copy.decorate.placed]);
    });
    const offPlanted = events.on('seed-planted', ({ planted }) => {
      exitDecorate();
      events.emit('plant-grown', { planted }); // 카메라가 돌아와 심기는 모습을 보여준다
    });
    const offBlocked = events.on('decor-blocked', ({ why }) => {
      const d = copy.decorate;
      showToast(why === 'flip' ? [d.flipBlocked, d.flipBlockedHint] : [d.blocked, d.blockedHint]);
    });
    // Esc: 짚은 게 있으면 그것부터 내려놓고, 없으면 꾸미기를 끝낸다.
    let selected = false;
    const offSelect = events.on('decor-select', (s) => {
      selected = !!s;
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isModalOpen()) return;
      if (selected) events.emit('decor-action', { action: 'cancel' });
      else exitDecorate();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      offChanged();
      offPlanted();
      offBlocked();
      offSelect();
      window.removeEventListener('keydown', onKey);
    };
  }, [active]);

  if (!active) return null;
  if (mode === 'pick') {
    return (
      <div className="decorate-bar interactive">
        <div className="decorate-text">
          <strong>{copy.seedBox.pickTitle}</strong>
          <span>{pickHint}</span>
        </div>
        <button type="button" className="btn btn-secondary" onClick={exitDecorate}>{copy.seedBox.pickCancel}</button>
      </div>
    );
  }
  const count = garden.items.length;
  return (
    <>
      <div className="decorate-bar interactive">
        <div className="decorate-text">
          <strong>{copy.decorate.title}</strong>
          <span>{count + garden.plants.length > 0 ? copy.decorate.hint : copy.decorate.none}</span>
          {count > 0 && <small>{copy.decorate.count(count)}</small>}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => openModal(<Storage />)}>
          {copy.decorate.storage(garden.storage.length)}
        </button>
        <button type="button" className="btn btn-primary" onClick={exitDecorate}>{copy.decorate.done}</button>
      </div>
      <SelectBar />
    </>
  );
}
