import type { NpcId } from '../core/events';
import { copy } from '../core/copy';
import { npcUrl } from '../scene/assets';
import { SproutImg } from './icons';

export function speakerId(name:string):NpcId|'sprout'|undefined {
  if(name==='느리')return 'nuri';
  if(name==='모루')return 'moru';
  if(name==='피오')return 'pio';
  if(name==='새싹이')return 'sprout';
  return undefined;
}
export function SpeakerPortrait({name}:{name:string}) {
  const id=speakerId(name);
  return <div className="speaker-identity">
    {id&&<span className="speaker-portrait">{id==='sprout'?<SproutImg/>:<img src={npcUrl(id,'front')} alt={copy.talk.npc[id].name} draggable={false}/>}</span>}
    <strong>{name}</strong>
  </div>;
}
