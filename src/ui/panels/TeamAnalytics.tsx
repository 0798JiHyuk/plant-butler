import {clearToast} from '../toast';
import { useEffect, useState } from 'react';
import { readAnalytics, retentionRate, type AnalyticsReport } from '../../core/analytics';
import { copy } from '../../core/copy';
import { auth } from '../../lib/auth';
import { getSupabaseClient } from '../../lib/supabase';
import { openModal } from '../modal';
import { PanelHead } from './PanelHead';
import '../../styles/analytics.css';

export async function canViewAnalytics():Promise<boolean>{
  const api=await getSupabaseClient(),uid=auth.getSnapshot().userId;if(!api||!uid)return false;
  try{const {data,error}=await api.from('analytics_team').select('user_id').eq('user_id',uid).maybeSingle();return !error&&data?.user_id===uid;}catch{return false;}
}
function TeamAnalytics(){
  const [days,setDays]=useState(28),[attempt,setAttempt]=useState(0),[report,setReport]=useState<AnalyticsReport|null>(null),[error,setError]=useState(false);
  const t=copy.analytics;
  useEffect(()=>{
    let alive=true;const uid=auth.getSnapshot().userId;setReport(null);setError(false);
    void (async()=>{try{const api=await getSupabaseClient();if(!api)throw new Error('setup');const {data,error}=await api.rpc('team_analytics',{p_days:days});if(error)throw new Error('request');const parsed=readAnalytics(data);if(alive&&uid===auth.getSnapshot().userId)setReport(parsed);}catch{if(alive)setError(true);}})();
    return()=>{alive=false;};
  },[days,attempt]);
  return <section className="panel analytics-panel" role="dialog" aria-label={t.title}>
    <PanelHead title={t.title}/>
    <div className="analytics-toolbar">{[7,28,90].map(d=><button className="btn-chip" key={d} aria-pressed={days===d} onClick={()=>setDays(d)}>{d}{t.days}</button>)}<button className="btn-chip" onClick={()=>setAttempt(n=>n+1)}>{t.refresh}</button></div>
    <div className="analytics-body">
      <p className="panel-note">{t.scope}</p>
      {error?<p role="alert">{t.error}</p>:!report?<p role="status">{t.loading}</p>:<>
        <p className="panel-note">{report.asOf} · {t.timezone}</p>
        <div className="analytics-cards">{(['visitors','newUsers','activeToday','completionUsers'] as const).map(k=><div key={k}><span>{t[k]}</span><strong>{report[k]}</strong></div>)}</div>
        <h3>{t.retention}</h3><p className="panel-note">{t.retentionNote}</p>
        <table><thead><tr><th>{t.day}</th><th>{t.eligible}</th><th>{t.returned}</th><th>{t.rate}</th></tr></thead><tbody>{report.retention.map(r=><tr key={r.day}><td>D{r.day}</td><td>{r.eligible}</td><td>{r.returned}</td><td>{retentionRate(r)===null?t.waiting:`${retentionRate(r)}%`}</td></tr>)}</tbody></table>
        <h3>{t.daily}</h3><table><thead><tr><th>{t.date}</th><th>{t.active}</th><th>{t.newUsers}</th><th>{t.completionUsers}</th></tr></thead><tbody>{report.daily.slice().reverse().map(r=><tr key={r.date}><td>{r.date}</td><td>{r.active}</td><td>{r.newUsers}</td><td>{r.completed}</td></tr>)}</tbody></table>
        <h3>{t.sources}</h3><table><thead><tr><th>source</th><th>medium</th><th>campaign</th><th>{t.users}</th></tr></thead><tbody>{report.sources.map((r,i)=><tr key={i}><td>{r.source}</td><td>{r.medium||'—'}</td><td>{r.campaign||'—'}</td><td>{r.users}</td></tr>)}</tbody></table>
      </>}
    </div>
  </section>;
}
export const openTeamAnalytics=()=>{clearToast();openModal(<TeamAnalytics/>);};
