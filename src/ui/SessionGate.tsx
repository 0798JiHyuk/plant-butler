import { useEffect, useState, useSyncExternalStore } from 'react';
import { auth } from '../lib/auth';
import { gardenSync, startAccountData } from '../lib/gardenSync';
import { copy } from '../core/copy';
import { Account } from './panels/Account';
import { App } from './App';
import { SproutImg } from './icons';

export function SessionGate({stage,onAccessChange}:{stage:HTMLElement;onAccessChange:(ready:boolean)=>void}) {
  useEffect(startAccountData,[]);
  const session=useSyncExternalStore(auth.subscribe,auth.getSnapshot),sync=useSyncExternalStore(gardenSync.subscribe,gardenSync.getSnapshot);
  const [loaded,setLoaded]=useState<string|null>(null);
  useEffect(()=>{
    if(session.status!=='connected')setLoaded(null);
    else if(['saved','pending','saving'].includes(sync.phase))setLoaded(session.userId);
  },[session.status,session.userId,sync.phase]);
  const ready=session.status==='connected'&&!!session.userId&&loaded===session.userId;
  useEffect(()=>{onAccessChange(ready);},[ready,onAccessChange]);
  if(ready)return <App stage={stage}/>;
  if(session.status==='connected'&&sync.phase==='conflict')return <div className="login-gate login-conflict interactive"><Account/><button className="btn-chip login-switch-account" onClick={()=>void auth.signOut()}>{copy.login.signOut}</button></div>;
  return <section className="login-gate interactive" role="main" aria-label={copy.login.title}>
    <div className="login-card">
      <span className="login-sprout"><SproutImg/></span>
      <h1>{copy.login.title}</h1><p>{copy.login.subtitle}</p>
      <p className="login-notice" role="status">{session.status==='checking'?copy.login.checking:session.status==='local'?copy.login.setup:session.status==='connected'?copy.login.loading:copy.login.notice}</p>
      {(session.error||sync.phase==='error')&&<p role="alert">{copy.login.error}</p>}
      {session.status==='signed-out'&&<button className="btn btn-primary" disabled={session.busy} onClick={()=>void auth.google()}>{copy.login.button}</button>}
      {(session.error||session.status==='local')&&<button className="btn btn-secondary" disabled={session.busy} onClick={()=>void auth.retry()}>{copy.login.retry}</button>}
      {session.status==='connected'&&sync.phase==='error'&&<button className="btn btn-primary" onClick={()=>void gardenSync.refresh()}>{copy.login.retry}</button>}
      {session.status==='connected'&&<button className="btn-chip" onClick={()=>void auth.signOut()}>{copy.login.signOut}</button>}
    </div>
  </section>;
}
