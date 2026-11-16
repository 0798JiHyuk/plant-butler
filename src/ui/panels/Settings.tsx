import { useState } from 'react';
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

/** 저장은 끝났으니 장면을 처음부터 다시 그리도록 새로고침한다. */
const reload = () => window.location.reload();

function Settings({ onAccount, onGardenName }: { onAccount?: () => void; onGardenName?: () => void }) {
  const { settings } = useAppState();
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <section className="panel settings" role="dialog" aria-label={copy.settings.title}>
      <PanelHead title={copy.settings.title} />
      <div className="settings-body">
        {onGardenName && <button type="button" className="btn btn-secondary" onClick={onGardenName}>{copy.world.nameEdit}</button>}
        {onAccount && <button type="button" className="btn btn-secondary" onClick={onAccount}>{copy.account.title}</button>}
        <button className="btn btn-secondary" onClick={()=>{store.update(s=>{s.settings.folded=true;});closeModal();}}>{copy.map.fold}</button>
        <Switch label={copy.settings.sound} checked={!settings.sound} onChange={(off) => store.update((d) => { d.settings.sound = !off; })} />
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
