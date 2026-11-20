import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { copy } from '@/core/copy';
import { auth } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase';
import { sendFeedback, type FeedbackResult } from '@/lib/feedback';
import { feedbackKinds, FEEDBACK_MAX_LENGTH, type FeedbackKind } from '../../../supabase/functions/_shared/feedbackPolicy';
import { closeModal, openModal } from '../modal';
import { PanelHead } from './PanelHead';
import '../../styles/feedback.css';

export function Feedback() {
  const account = useSyncExternalStore(auth.subscribe,auth.getSnapshot);
  const owner = useRef(account.userId).current;
  const [kind,setKind] = useState<FeedbackKind>('bug');
  const [message,setMessage] = useState(''); const [reply,setReply] = useState(false);
  const [consent,setConsent] = useState(false); const [email,setEmail] = useState('');
  const [busy,setBusy] = useState(false); const [result,setResult] = useState<FeedbackResult | null>(null);
  const request = useRef<{body:string;id:string} | null>(null);
  const pending = useRef<AbortController | null>(null); const alive = useRef(true);
  const text = copy.feedback;
  useEffect(()=>{
    alive.current = true;
    void getSupabaseClient().then(async api=>{
      const session = await api?.auth.getSession(); const user = session?.data.session?.user;
      if (alive.current && user?.id === owner && user.email_confirmed_at) setEmail(user.email ?? '');
    }).catch(()=>{});
    return ()=>{alive.current=false;pending.current?.abort();};
  },[owner]);
  useEffect(()=>{if(account.userId !== owner){pending.current?.abort();closeModal();}},[account.userId,owner]);
  async function submit() {
    if (pending.current || !owner || !consent || !message.trim()) return;
    const body = JSON.stringify({kind,message,reply:reply && kind !== 'feedback'});
    if (request.current?.body !== body) request.current = {body,id:crypto.randomUUID()};
    const controller = new AbortController(); pending.current = controller; setBusy(true); setResult(null);
    const timer = window.setTimeout(()=>controller.abort(),25000);
    try {
      const value = await sendFeedback({kind,message,reply:reply && kind !== 'feedback',consent:true,requestId:request.current.id},owner,controller.signal);
      if (alive.current && auth.getSnapshot().userId === owner) setResult(value);
    } finally {window.clearTimeout(timer);pending.current=null;if(alive.current)setBusy(false);}
  }
  return <section className="panel feedback-panel" role="dialog" aria-label={text.title} aria-busy={busy}>
    <PanelHead title={text.title}/>
    {result === 'sent' ? <div className="feedback-body"><p role="status">{text.sent}</p><button className="btn btn-primary" onClick={()=>closeModal()}>{text.close}</button></div> : <form className="feedback-body" onSubmit={e=>{e.preventDefault();void submit();}}>
      <label>{text.kind}<select value={kind} disabled={busy} onChange={e=>{setKind(e.target.value as FeedbackKind);setReply(false);}}>{feedbackKinds.map(k=><option key={k} value={k}>{text.kinds[k]}</option>)}</select></label>
      <label>{text.message}<textarea value={message} disabled={busy} maxLength={FEEDBACK_MAX_LENGTH} placeholder={text.placeholder} onChange={e=>setMessage(e.target.value)} required/></label>
      <small>{message.length}/{FEEDBACK_MAX_LENGTH}</small>
      <p className="panel-note">{text.privacy}</p>
      {kind !== 'feedback' && <>
        <label className="switch"><input type="checkbox" disabled={busy || !email} checked={reply} onChange={e=>setReply(e.target.checked)}/><span>{text.reply}</span></label>
        {reply && <p className="panel-note">{text.replyNotice}<br/>{email}</p>}
        {!email && <p className="panel-note">{text.noEmail}</p>}
      </>}
      <label className="switch"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>{text.consent}</span></label>
      {result && <p role="alert">{text.errors[result]}</p>}
      <button className="btn btn-primary" disabled={busy || !consent || !message.trim() || account.userId !== owner}>{busy ? text.sending : text.send}</button>
    </form>}
  </section>;
}
export const openFeedback = () => openModal(<Feedback/>);
