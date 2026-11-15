import { copy } from '../../core/copy';
import { events } from '../../core/events';
import { closeModal, openModal } from '../modal';
import { PanelHead } from './PanelHead';

export const openHouseEntry = () => openModal(<section className="panel house-entry" role="dialog" aria-label={copy.world.enterAsk}>
  <PanelHead title={copy.world.home} />
  <p className="panel-message">{copy.world.enterAsk}</p>
  <div className="btn-pair"><button className="btn btn-primary" onClick={() => { closeModal(); events.emit('house-travel', { indoor: true }); }}>{copy.world.enter}</button>
    <button className="btn btn-secondary" onClick={() => closeModal()}>{copy.world.cancel}</button></div>
</section>);
