import { SpeakerPortrait } from './SpeakerPortrait';
/** Authored mission dialogue remains fixed text; no AI dialogue is introduced. */
export function MissionSpeaker({name,children}:{name:string;children:React.ReactNode}){
  return <div className="mission-speaker"><SpeakerPortrait name={name}/><div className="mission-speech">{children}</div></div>;
}
