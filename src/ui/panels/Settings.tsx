import { useState } from 'react';
import { getDayOffset, setDayOffset, todayKey } from '../../core/clock';
import { copy } from '../../core/copy';
import { addTestSeeds, fillSample } from '../../core/demo';
import { directPlanRatio } from '../../core/stats';
import { store } from '../../core/store';
import { nextDecorSlot, nextPlantSlot } from '../../scene/map';
import { afterDayChange } from '../flow';
import { closeModal, openModal } from '../modal';
import { showToast } from '../toast';
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

function Settings({ onAccount }: { onAccount?: () => void }) {
  const { settings, logs } = useAppState();
  const [confirmReset, setConfirmReset] = useState(false);
  const designCount = logs.filter((l) => l.source === 'design').length;
  const pct = logs.length ? Math.round(directPlanRatio(logs) * 100) : 0;
  return (
    <section className="panel settings" role="dialog" aria-label={copy.settings.title}>
      <PanelHead title={copy.settings.title} />
      <div className="settings-body">
        {onAccount && <button type="button" className="btn btn-secondary" onClick={onAccount}>{copy.account.title}</button>}
        <Switch label={copy.settings.sound} checked={!settings.sound} onChange={(off) => store.update((d) => { d.settings.sound = !off; })} />
        <Switch
          label={copy.settings.demo}
          checked={settings.demo}
          onChange={(on) => {
            setDayOffset(0);
            store.update((d) => {
              d.settings.demo = on;
              d.settings.dayOffset = 0;
            });
          }}
        />
        {settings.demo && (
          <div className="demo-box">
            <p className="panel-note">{copy.settings.today(todayKey())}</p>
            <div className="btn-pair">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const offset = getDayOffset() + 1;
                  setDayOffset(offset);
                  store.update((d) => { d.settings.dayOffset = offset; });
                  closeModal();
                  afterDayChange();
                }}
              >
                {copy.settings.nextDay}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  store.update((d) => fillSample(d, todayKey(), { decor: nextDecorSlot, plant: nextPlantSlot }));
                  reload();
                }}
              >
                {copy.settings.fill}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  store.update((d) => addTestSeeds(d, 5));
                  showToast([copy.settings.seedsAdded]);
                }}
              >
                {copy.settings.addSeeds}
              </button>
            </div>
            {/* 직접 계획 비율은 일반 화면에는 보여주지 않고 여기 디버그 줄에서만 보여준다. */}
            <p className="debug-line">{`${copy.settings.debug} · ${copy.settings.directRatio(pct, designCount, logs.length)}`}</p>
          </div>
        )}
        {confirmReset ? (
          <div className="demo-box">
            <p className="panel-note">{copy.settings.resetAsk}</p>
            <div className="btn-pair">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setDayOffset(0);
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

export const openSettings = (onAccount?: () => void) => openModal(<Settings onAccount={onAccount} />);
