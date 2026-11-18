import { afterEach,expect,it,vi } from 'vitest';
const mock=vi.hoisted(()=>({uid:'analytics-user',token:'fixture-token'}));
vi.mock('../lib/auth',()=>({auth:{getSnapshot:()=>({userId:mock.uid})}}));
vi.mock('../lib/supabase',()=>({getSupabaseClient:async()=>({auth:{getSession:async()=>({data:{session:{user:{id:mock.uid},access_token:mock.token}},error:null})}})}));
import { startAnalytics } from '../lib/events';
import { store } from '../core/store';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('완료 기록에서는 ID만 전송하고 개인 원문과 복원 기록은 전송하지 않는다',async()=>{
  vi.useFakeTimers();const doc=new EventTarget();Object.assign(doc,{visibilityState:'visible'});vi.stubGlobal('document',doc);
  const fetcher=vi.fn(async(_input:RequestInfo|URL,_init?:RequestInit)=>({ok:true}));vi.stubGlobal('fetch',fetcher);
  store.activateUser(mock.uid);const stop=startAnalytics();
  try {
    await vi.advanceTimersByTimeAsync(0);expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).p_name).toBe('app_opened');
    store.update(s=>{s.logs.push({id:'safe-log-1',date:'2026-11-18',activityId:'D01',text:'PRIVATE_REFLECTION',plan:{when:'PRIVATE_PLAN',where:'PRIVATE_PLACE',minutes:0},source:'mission',chips:[]});});
    await vi.advanceTimersByTimeAsync(0);
    const requests=fetcher.mock.calls.map(call=>JSON.parse(call[1]!.body as string));
    expect(requests.some(r=>r.p_name==='activity_completed')).toBe(true);expect(JSON.stringify(requests)).not.toContain('PRIVATE');
    const count=fetcher.mock.calls.length;store.restore(store.state);await vi.advanceTimersByTimeAsync(0);expect(fetcher).toHaveBeenCalledTimes(count);
    stop();doc.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(30000);expect(fetcher).toHaveBeenCalledTimes(count);
  }finally{stop();}
});
