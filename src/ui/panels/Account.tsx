import { useState, useSyncExternalStore } from 'react';
import { auth } from '@/lib/auth';
import { copy } from '@/core/copy';
import { openModal } from '@/ui/modal';
import { PanelHead } from '@/ui/panels/PanelHead';
import { gardenSync, summarize } from '@/lib/gardenSync';
import { store } from '@/core/store';

export function Account() {
  const state = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const sync = useSyncExternalStore(gardenSync.subscribe, gardenSync.getSnapshot);
  const [confirm, setConfirm] = useState(false);
  const text = copy.account;
  return <section className="panel settings" style={{ width: 600 }} role="dialog" aria-label={text.title} aria-busy={state.busy}>
    <PanelHead title={text.title} />
    <div className="settings-body">
      <p className="panel-note" role="status">{text.status[state.status]}</p>
      {sync.phase !== 'conflict' && <p className="panel-note">{text.localNotice}</p>}
      <p className="panel-note" role="status">{text.sync[sync.phase]}</p>
      {sync.error && <p className="panel-note">{text.syncErrors[sync.error]}</p>}
      {sync.phase === 'conflict' && <>
        <p className="panel-note">{text.conflictNotice}</p>
        <div className="btn-pair">
          <button className="btn btn-secondary" onClick={() => void gardenSync.resolve('local')}>{text.useLocal}<small style={{ display: 'block' }}>{text.summary(summarize(store.state))}</small></button>
          <button className="btn btn-secondary" onClick={() => void gardenSync.resolve('server')}>{text.useServer}<small style={{ display: 'block' }}>{sync.remote && text.summary(sync.remote)}</small></button>
        </div>
      </>}
      {sync.phase === 'error' && <button className="btn btn-secondary" onClick={() => void gardenSync.refresh()}>{text.retry}</button>}
      {sync.phase === 'pending' && <button className="btn btn-secondary" onClick={() => void gardenSync.flush()}>{text.save}</button>}
      {state.status === 'guest' && sync.phase !== 'conflict' && <p className="panel-note">{text.guestNotice}</p>}
      {state.error && <p className="panel-note" role="alert">{text.errors[state.error]}</p>}
      {sync.phase === 'conflict' ? null : confirm && state.status === 'connected' ? <>
        <p className="panel-note">{text.logoutNotice}</p>
        <div className="btn-pair">
          <button className="btn btn-secondary" disabled={state.busy} onClick={async () => { await gardenSync.flush(); await auth.signOut(); setConfirm(false); }}>{text.logout}</button>
          <button className="btn btn-secondary" disabled={state.busy} onClick={() => setConfirm(false)}>{text.cancel}</button>
        </div>
      </> : <div className="btn-pair">
        {(state.status === 'signed-out' || (state.error === 'request' && state.status !== 'connected')) && <button className="btn btn-secondary" disabled={state.busy} onClick={() => { void auth.startGuest(); }}>{text.guest}</button>}
        {state.status !== 'local' && state.status !== 'connected' && <button className="btn btn-secondary" disabled={state.busy || state.status === 'checking'} onClick={async () => { await gardenSync.flush(); if (state.status !== 'guest') store.prepareTransfer(); void auth.google(); }}>{state.status === 'guest' ? text.link : text.login}</button>}
        {state.status === 'guest' && <button className="btn btn-secondary" disabled={state.busy} onClick={async () => { await gardenSync.flush(); store.prepareTransfer(); void auth.google('existing'); }}>{text.existing}</button>}
        {state.status === 'connected' && <button className="btn btn-secondary" disabled={state.busy} onClick={() => setConfirm(true)}>{text.logout}</button>}
      </div>}
    </div>
  </section>;
}

export const openAccount = () => openModal(<Account />);

export function SaveStatus() {
  const state = useSyncExternalStore(gardenSync.subscribe, gardenSync.getSnapshot);
  if (state.phase === 'local' || state.phase === 'saved') return null;
  return <button className="btn btn-secondary interactive" style={{ position: 'absolute', top: 78, right: 10, width: 'auto', padding: '0 10px', fontSize: 12, minHeight: 44 }} onClick={openAccount}>{copy.account.sync[state.phase]}</button>;
}
