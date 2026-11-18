import {canViewAnalytics,openTeamAnalytics} from './TeamAnalytics';
import { useState,useEffect } from 'react';
import { bgmGain } from '../../core/bgm';
import { copy } from '../../core/copy';
import { store } from '../../core/store';
import { closeModal, openModal } from '../modal';
import { useAppState } from '../useAppState';
import { PanelHead } from './PanelHead';

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** 배경음악 음량(0~100%). 움직이는 대로 바로 적용되고 저장된다. 효과음과 "소리 끄기"는 따로다. */
function BgmVolume({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const percent = Math.round(value * 100);
  return (
    <label className="range-row" htmlFor="bgm-volume">
      <span>{copy.settings.bgmVolume}</span>
      <input id="bgm-volume" type="range" min={0} max={100} step={5} value={percent}
        aria-valuetext={`${percent}%`} onChange={(e) => onChange(Number(e.target.value) / 100)} />
      <output htmlFor="bgm-volume">{percent}%</output>
    </label>
  );
}

/** 저장은 끝났으니 장면을 처음부터 다시 그리도록 새로고침한다. */
const reload = () => window.location.reload();

function Settings({ onAccount, onGardenName }: { onAccount?: () => void; onGardenName?: () => void }) {
  const { settings } = useAppState();
  const [team,setTeam]=useState(false);
  useEffect(()=>{let alive=true;void canViewAnalytics().then(ok=>{if(alive)setTeam(ok);});return()=>{alive=false;};},[]);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <section className="panel settings" role="dialog" aria-label={copy.settings.title}>
      <PanelHead title={copy.settings.title} />
      <div className="settings-body">
        {team&&<button className="btn btn-secondary" onClick={openTeamAnalytics}>{copy.analytics.title}</button>}
        <p className="panel-note">{copy.analytics.notice}</p>
        {onGardenName && <button type="button" className="btn btn-secondary" onClick={onGardenName}>{copy.world.nameEdit}</button>}
        {onAccount && <button type="button" className="btn btn-secondary" onClick={onAccount}>{copy.account.title}</button>}
        <button className="btn btn-secondary" onClick={()=>{store.update(s=>{s.settings.folded=true;});closeModal();}}>{copy.map.fold}</button>
        <Switch label={copy.settings.sound} checked={!settings.sound} onChange={(off) => store.update((d) => { d.settings.sound = !off; })} />
        <BgmVolume value={bgmGain(settings.bgmVolume)} onChange={(v) => store.update((d) => { d.settings.bgmVolume = v; })} />
        <Switch label={copy.map.reducedMotion} checked={!!settings.reducedMotion} onChange={value=>store.update(s=>{s.settings.reducedMotion=value;})}/>
        {confirmReset ? (
          <div className="demo-box">
            <p className="panel-note">{copy.settings.resetAsk}</p>
            <div className="btn-pair">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  store.reset();
                  reload();
                }}
              >
                {copy.settings.resetYes}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(false)}>{copy.settings.resetNo}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(true)}>{copy.settings.reset}</button>
        )}
      </div>
      <p className="debug-line" aria-label={copy.settings.version}>
        {`${copy.settings.version} ${__APP_BUILD__.version} · ${__APP_BUILD__.commit || copy.settings.unknownCommit} · ${copy.settings.buildEnvironment[__APP_BUILD__.environment]}`}
      </p>
    </section>
  );
}

export const openSettings = (onAccount?: () => void, onGardenName?: () => void) => openModal(<Settings onAccount={onAccount} onGardenName={onGardenName} />);
