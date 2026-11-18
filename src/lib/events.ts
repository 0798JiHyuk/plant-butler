import { auth } from './auth';
import { getSupabaseClient } from './supabase';
import { toLocalDate } from './date';
import { store } from '../core/store';
import { missionById } from '../core/missions';

export interface EventProps {
  app_opened:Record<string,never>;
  mission_viewed:{mission_id:string};
  activity_completed:{activity_id:string;mission_id:string|null;level:'large'|'medium'|'small';stage:number};
  rested:{activity_id:string;stage:number};
}
export interface Acquisition {source:string;medium:string;campaign:string}
export function readAcquisition(search:string):Acquisition {
  const params=new URLSearchParams(search),safe=(key:string)=>{const v=params.get(key)??'';return /^[A-Za-z0-9_-]{1,48}$/.test(v)?v:'';};
  return {source:safe('utm_source'),medium:safe('utm_medium'),campaign:safe('utm_campaign')};
}
let acquisition:Acquisition={source:'',medium:'',campaign:''};
export function captureAcquisition():void {
  try {
    const cached=sessionStorage.getItem('garden:acquisition');
    if(cached){const v:unknown=JSON.parse(cached);if(!v||typeof v!=='object'||!('source' in v)||!('medium' in v)||!('campaign' in v)||typeof v.source!=='string'||typeof v.medium!=='string'||typeof v.campaign!=='string')throw new Error('Invalid tags');acquisition=readAcquisition(`?utm_source=${encodeURIComponent(v.source)}&utm_medium=${encodeURIComponent(v.medium)}&utm_campaign=${encodeURIComponent(v.campaign)}`);return;}
    acquisition=readAcquisition(location.search);sessionStorage.setItem('garden:acquisition',JSON.stringify(acquisition));
  }catch{acquisition=readAcquisition(location.search);}
}
type Job={name:keyof EventProps;props:EventProps[keyof EventProps];key:string;owner:string};
let running=false,busy=false,epoch=0,timer:ReturnType<typeof setInterval>|undefined;
const queue:Job[]=[];
async function flush():Promise<void> {
  if(busy||!running||!queue.length)return;
  const job=queue[0],ticket=epoch;busy=true;
  try {
    if(auth.getSnapshot().userId!==job.owner){queue.shift();return;}
    const api=await getSupabaseClient();if(!api)return;
    const {data,error}=await api.auth.getSession();
    if(error||data.session?.user.id!==job.owner||!running||ticket!==epoch)return;
    // Pin this request to the captured account token, even during an account switch.
    const response=await fetch(`${import.meta.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/rpc/record_app_event`,{
      method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,apikey:import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY??'','Content-Type':'application/json'},
      body:JSON.stringify({p_name:job.name,p_props:job.props,p_event_key:job.key,p_source:acquisition.source,p_medium:acquisition.medium,p_campaign:acquisition.campaign}),signal:AbortSignal.timeout(12000),
    });
    if(ticket===epoch&&response.ok&&queue[0]===job)queue.shift();
  }catch{/* Analytics cannot interrupt gameplay; no payload or errors are logged. */}
  finally{busy=false;if(ticket===epoch&&running&&queue.length&&queue[0]!==job)void flush();}
}
export function logEvent<K extends keyof EventProps>(name:K,props:EventProps[K],key:string=crypto.randomUUID()):void {
  const owner=auth.getSnapshot().userId;if(!running||!owner)return;
  if(queue.some(j=>j.owner===owner&&j.key===key))return;
  if(queue.length>=100)return;
  // Constructed typed properties only; never accept a store snapshot or input text.
  queue.push({name,props:structuredClone(props),key,owner});void flush();
}
export function startAnalytics():()=>void {
  running=true;epoch++;queue.length=0;
  let previous=store.state;
  const open=()=>{if(document.visibilityState!=='hidden')logEvent('app_opened',{});};
  open();document.addEventListener('visibilitychange',open);
  const unsubscribe=store.subscribe(()=>{
    const next=store.state,before=previous;previous=next;
    if(store.restoring||store.owner!==auth.getSnapshot().userId)return;
    const ids=new Set(before.logs.map(l=>l.id));
    for(const log of next.logs)if(!ids.has(log.id)){
      const mission=missionById(log.activityId);
      logEvent('activity_completed',{activity_id:log.id,mission_id:log.source==='design'?null:log.activityId??null,level:log.mission?.variant==='small'?'small':'large',stage:mission?.stage??1},`completed:${log.id}`);
    }
    const date=toLocalDate();
    if(next.days[date]?.rested&&!before.days[date]?.rested)logEvent('rested',{activity_id:`rest-${date}`,stage:next.missions?.selectedCategory?next.missions.stages[next.missions.selectedCategory]:1},`rest:${date}`);
  });
  timer=setInterval(()=>void flush(),30000);
  return()=>{running=false;epoch++;queue.length=0;clearInterval(timer);unsubscribe();document.removeEventListener('visibilitychange',open);};
}
