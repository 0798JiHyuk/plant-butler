import { useState } from 'react';
import { copy } from '../../core/copy';
import { store } from '../../core/store';
import { setGardenName } from '../../core/world';
import { closeModal, openModal } from '../modal';
import { PanelHead } from './PanelHead';

function GardenName() {
  const [name, setName] = useState(store.state.garden.name ?? '');
  const [error, setError] = useState(false);
  return <section className="panel garden-name-panel" role="dialog" aria-label={copy.world.nameTitle}>
    <PanelHead title={copy.world.nameTitle} />
    <p className="panel-note">{copy.world.nameHint}</p>
    <form onSubmit={e => {
      e.preventDefault();
      let saved = false;
      store.update(s => { saved = setGardenName(s, name); });
      if (saved) closeModal(); else setError(true);
    }}>
      <label className="mission-field"><span>{copy.world.nameLabel}</span><input className="text-input" value={name} maxLength={32} autoComplete="off" onChange={e => setName(e.target.value)} /></label>
      {error && <p className="panel-note" role="status">{copy.world.nameInvalid}</p>}
      <button className="btn btn-primary" type="submit">{copy.world.nameSave}</button>
      <button className="btn btn-secondary" type="button" onClick={() => closeModal()}>{copy.world.nameLater}</button>
    </form>
  </section>;
}
export function openGardenName(): void {
  openModal(<GardenName />, true, () => store.update(s => { s.garden.namePromptSeen = true; }));
}
