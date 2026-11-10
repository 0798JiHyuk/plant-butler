import { useState } from 'react';
import { copy } from '../../core/copy';
import { events } from '../../core/events';
import { isTree, plantById } from '../../core/plants';
import { openBonusPacket, openFreePacket, openPacket, openSessionPacket, pendingPacketDates } from '../../core/rules';
import { store } from '../../core/store';
import type { SeedItem } from '../../core/types';
import { nextDecorSlot, nextPlantSlot } from '../../scene/map';
import { PlantImg, UiIconImg } from '../icons';
import { closeModal, isModalOpen, openModal } from '../modal';
import { showToast } from '../toast';
import { useAppState } from '../useAppState';
import { enterSeedPick } from './Decorate';

/** 이 씨앗을 심을 빈 곳이 있는지: 꽃은 두둑, 나무는 마당 칸. */
const hasRoom = (seed: SeedItem) => {
  const used = [...store.state.garden.plants, ...store.state.garden.items];
  return !!(isTree(seed.plantId) ? nextDecorSlot(used) : nextPlantSlot(used));
};

/** 창을 닫고 심을 두둑을 고르러 간다. */
function pickSpot(seed: SeedItem): void {
  closeModal();
  enterSeedPick(seed);
}

function Packet({ source, date }: { source: 'day' | 'free' | 'session' | 'bonus'; date?: string }) {
  const [opened, setOpened] = useState<{ seed: SeedItem | null; line: string } | null>(null);

  // 안 열어도, 안 심어도 씨앗함에 그대로 있다.
  const keep = () => {
    closeModal();
    showToast([copy.speak(copy.talk.npc.nuri.name, copy.lines.keepSeed)]);
  };

  const open = () => {
    const { garden, seeds } = store.state;
    const met = new Set([...garden.plants, ...garden.storage.filter((s) => s.type === 'plant'), ...seeds].map((p) => ('plantId' in p ? p.plantId : '')));
    let seed = null as SeedItem | null;
    store.update((d) => {
      seed = source === 'day' ? openPacket(d, date!) : source === 'free' ? openFreePacket(d) : source === 'session' ? openSessionPacket(d) : openBonusPacket(d);
    });
    events.emit('sfx', { name: 'open' });
    const drawn = seed ? plantById(seed.plantId) : undefined;
    // 중복은 정상이다. 꽝이나 실망으로 말하지 않고 "어디에 심을까"만 묻는다.
    const line = drawn && met.has(drawn.id) ? copy.seed.again : drawn?.rare ? copy.seed.rare : drawn?.tree ? copy.seed.tree : copy.seed.plain;
    setOpened({ seed, line });
  };

  if (opened) {
    const plant = opened.seed ? plantById(opened.seed.plantId) : undefined;
    const seed = opened.seed;
    const canPlant = !!seed && hasRoom(seed);
    return (
      <section className="panel packet" role="dialog" aria-label={copy.packet.arrived}>
        <span className="packet-art">
          {plant ? <PlantImg id={plant.id} className="packet-img" /> : <UiIconImg name="sprout" className="packet-img" />}
        </span>
        <h2 className="panel-title">{plant?.name}</h2>
        <p className="panel-message">{canPlant ? opened.line : copy.packet.full}</p>
        {seed && canPlant && <button type="button" className="btn btn-primary" onClick={() => pickSpot(seed)}>{copy.packet.plant}</button>}
        <div className="btn-pair">
          <button type="button" className="btn btn-secondary" onClick={keep}>{canPlant ? copy.packet.plantLater : copy.packet.close}</button>
          <button type="button" className="btn btn-secondary" onClick={() => { closeModal(); events.emit('hud-action', { id: 'book' }); }}>{copy.packet.book}</button>
        </div>
      </section>
    );
  }
  return (
    <section className="panel packet" role="dialog" aria-label={copy.packet.arrived}>
      <span className="packet-art"><UiIconImg name="packet" className="packet-img" /></span>
      <h2 className="panel-title">{copy.packet.arrived}</h2>
      <p className="panel-note">{source === 'free' ? copy.packet.pouchFirst : copy.speak(copy.talk.npc.nuri.name, copy.lines.packetArrived)}</p>
      <button type="button" className="btn btn-primary" onClick={open}>{copy.packet.open}</button>
      <button type="button" className="btn btn-secondary" onClick={keep}>{copy.packet.later}</button>
    </section>
  );
}

/** 가장 오래된 주머니부터 연다. 꽝도 등급도 없고, 씨앗은 심거나 씨앗함에 둔다. */
export function openPacketModal(): void {
  if (isModalOpen()) return;
  const { freePackets, sessionPackets, bonusPackets } = store.state;
  const date = pendingPacketDates(store.state)[0];
  // 이야기가 준 주머니, 예전에 날마다 받은 주머니, 회차를 마치고 받은 주머니, 방문 선물의 특별 주머니 순서로 연다.
  if (freePackets > 0) openModal(<Packet source="free" />);
  else if (date) openModal(<Packet source="day" date={date} />);
  else if (sessionPackets > 0) openModal(<Packet source="session" />);
  else if (bonusPackets > 0) openModal(<Packet source="bonus" />);
}

/** 씨앗함의 본문: 안 연 봉투와 안 심은 씨앗. 가방의 씨앗 탭이 쓴다. */
export function SeedBoxBody() {
  const s = useAppState();
  const pouches = pendingPacketDates(s).length + s.freePackets + s.sessionPackets;
  const empty = pouches === 0 && s.bonusPackets === 0 && s.seeds.length === 0;
  const openPouch = () => {
    closeModal();
    openPacketModal();
  };
  const pouchCard = (label: string, key: string) => (
    <li className="book-card" key={key}>
      <span className="book-icon"><UiIconImg name="packet" /></span>
      <strong>{label}</strong>
      <button type="button" className="btn-chip btn-chip-primary" onClick={openPouch}>{copy.seedBox.open}</button>
    </li>
  );
  if (empty) return <p className="panel-message">{copy.seedBox.empty}</p>;
  return (
    <>
      <ul className="book-grid">
        {pouches > 0 && pouchCard(copy.seedBox.pouch(pouches), 'pouch')}
        {pouches === 0 && s.bonusPackets > 0 && pouchCard(copy.seedBox.bonus, 'bonus')}
        {s.seeds.map((seed) => (
          <li className="book-card" key={seed.id}>
            <span className="book-icon"><PlantImg id={seed.plantId} /></span>
            <strong>{plantById(seed.plantId)?.name ?? ''}</strong>
            <button type="button" className="btn-chip btn-chip-primary" disabled={!hasRoom(seed)} onClick={() => pickSpot(seed)}>{copy.seedBox.plant}</button>
          </li>
        ))}
      </ul>
      <p className="panel-note">{s.seeds.every(hasRoom) ? copy.seedBox.note : copy.seedBox.full}</p>
    </>
  );
}
