import { copy } from '../../core/copy';
import { chooseDestination } from '../../core/exploration';
import { closeModal, openModal } from '../modal';
import { saveProgress } from '../saveProgress';
import { PanelHead } from './PanelHead';
import { openWorldMap } from './WorldMap';

export function openPlaceExterior(id:'school'|'work'):void {
  openModal(<section className="panel" role="dialog" aria-label={copy.map[id]}>
    <PanelHead title={copy.map[id]}/>
    <p className="panel-message">{copy.map.purpose[id]}</p>
    <p className="panel-message">{copy.map.outsideOnly}</p>
    <div className="btn-pair">
      <button className="btn btn-primary" onClick={()=>{saveProgress(s=>{chooseDestination(s,'garden');});openWorldMap();}}>{copy.map.return}</button>
      <button className="btn btn-secondary" onClick={()=>closeModal()}>{copy.map.close}</button>
    </div>
  </section>);
}
