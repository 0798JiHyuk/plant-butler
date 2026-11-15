import type { SeedItem } from '../../core/types';
import { copy } from '../../core/copy';
import { plantById } from '../../core/plants';
import { SpeakerPortrait } from '../SpeakerPortrait';
import { closeModal, openModal } from '../modal';
import { openBag } from './Bag';
import { PanelHead } from './PanelHead';

export function openPioSeeds(seeds:SeedItem[]):void {
  openModal(<section className="panel pio-seeds" role="dialog" aria-label={copy.pioSeeds.title}>
    <PanelHead title={copy.pioSeeds.title}/>
    <div className="pio-seed-hero"><SpeakerPortrait name={copy.talk.npc.pio.name}/><p>{copy.pioSeeds.found}</p></div>
    <div className="pio-seed-list">{seeds.map(seed=><div key={seed.id}><img src={`${import.meta.env.BASE_URL}assets/plants/${seed.plantId}.png`} alt=""/><span>{plantById(seed.plantId)?.name}</span></div>)}</div>
    <p className="panel-note">{copy.pioSeeds.note}</p>
    <div className="btn-pair"><button className="btn btn-primary" onClick={()=>{closeModal();openBag('seeds');}}>{copy.pioSeeds.bag}</button><button className="btn btn-secondary" onClick={()=>closeModal()}>{copy.pioSeeds.close}</button></div>
  </section>);
}
