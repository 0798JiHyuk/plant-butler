import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { auth } from './auth';
import { getSupabaseClient } from './supabase';
import { CAFE, cafeMemberFresh, readCafeMember, type CafeMember } from '../core/cafe';
import { readSharedGarden } from '../core/sharedGarden';

export type CafeStatus='connecting'|'online'|'error'|'replaced';
const columns='user_id,garden_name,x,y,seat_id,updated_at';
export class CafeConnection {
  private api:SupabaseClient<Database>|null=null;
  private channel:RealtimeChannel|null=null;
  private timer:ReturnType<typeof setInterval>|undefined;
  private stopped=false;
  private busy=false;
  private joined=false;
  private subscribed=false;
  private idleWaiters=new Set<()=>void>();
  private lastWrite=0;
  private lastList=0;
  private sent='';
  private position:{x:number;y:number;seat:string|null}={...CAFE.spawn,seat:null};
  private session=crypto.randomUUID();
  private members=new Map<string,CafeMember>();
  private status:CafeStatus='connecting';
  constructor(private changed:(members:CafeMember[],status:CafeStatus)=>void){}
  private publish():void {
    for(const [id,row] of this.members)if(!cafeMemberFresh(row))this.members.delete(id);
    if(!this.stopped)this.changed([...this.members.values()],this.status);
  }
  async start():Promise<void> {
    try {
      this.api=await getSupabaseClient();
      if(this.stopped)return;
      if(!this.api||!auth.getSnapshot().userId)throw new Error('auth');
      this.channel=this.api.channel(`cafe-positions-${this.session}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'cafe_members'},payload=>{
          if(this.stopped)return;
          if(payload.eventType==='DELETE')this.members.delete(String(payload.old.user_id));
          else {const row=readCafeMember(payload.new);if(row)this.members.set(row.user_id,row);}
          this.publish();
        }).subscribe(status=>{
          if(this.stopped)return;
          if(status==='SUBSCRIBED'){this.subscribed=true;this.joined=false;this.status='connecting';void this.tick();}
          else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){this.subscribed=false;this.status='error';this.members.clear();this.publish();}
        });
      this.timer=setInterval(()=>{this.publish();void this.tick();},500);
    }catch {this.status='error';this.publish();}
  }
  move(x:number,y:number):void {if(!this.position.seat)this.position={x,y,seat:null};}
  async seat(seat:string|null,x:number,y:number):Promise<'ok'|'occupied'|'error'> {
    if(this.busy)await new Promise<void>(resolve=>{this.idleWaiters.add(resolve);});
    if(!this.api||this.stopped||this.status!=='online')return 'error';
    this.busy=true;
    try {
      const result=await this.write({x,y,seat},false);
      if(result==='ok'){this.position={x,y,seat};this.sent=JSON.stringify(this.position);this.lastWrite=Date.now();return 'ok';}
      return result==='occupied'?'occupied':'error';
    }catch {this.status='error';this.publish();return 'error';}
    finally{this.finishRequest();}
  }
  private async write(p:{x:number;y:number;seat:string|null},join:boolean):Promise<string> {
    type Args=Database['public']['Functions']['cafe_step']['Args'];
    const args={p_session:this.session,p_x:p.x,p_y:p.y,p_seat:p.seat,p_join:join} satisfies Omit<Args,'p_seat'>&{p_seat:string|null};
    // PostgreSQL accepts NULL for an unseated player; generated RPC Args omit argument nullability.
    // Keep the wire payload unchanged. supabase/tests/online_cafe.sql exercises this NULL contract.
    const {data,error}=await this.api!.rpc('cafe_step',args as Args);
    if(error)throw new Error('request');
    if(this.stopped){void this.api!.rpc('cafe_leave',{p_session:this.session}).then(()=>undefined,()=>undefined);return 'error';}
    const status=data&&typeof data==='object'&&!Array.isArray(data)?data.status:null;
    if(status==='replaced'){this.status='replaced';this.members.clear();this.publish();}
    return typeof status==='string'?status:'error';
  }
  private async tick():Promise<void> {
    if(!this.api||!this.subscribed||this.stopped||this.busy||this.status==='error'||this.status==='replaced')return;
    this.busy=true;
    try {
      const serialized=JSON.stringify(this.position),now=Date.now();
      if(!this.joined||this.sent!==serialized||now-this.lastWrite>=10000){
        const status=await this.write(this.position,!this.joined);
        if(this.stopped||!this.subscribed)return;
        if(status!=='ok'){if(status!=='replaced')throw new Error('request');return;}
        this.joined=true;this.sent=serialized;this.lastWrite=now;this.status='online';
      }
      if(now-this.lastList>=10000){
        const {data,error}=await this.api.from('cafe_members').select(columns);
        if(error)throw new Error('list');
        if(this.stopped)return;
        this.members.clear();for(const value of data??[]){const row=readCafeMember(value);if(row)this.members.set(row.user_id,row);}
        this.lastList=now;
      }
      this.publish();
    }catch {if(!this.stopped){this.status='error';this.members.clear();this.publish();}}
    finally {this.finishRequest();}
  }
  private finishRequest():void {this.busy=false;this.idleWaiters.forEach(resolve=>resolve());this.idleWaiters.clear();}
  stop():void {
    if(this.stopped)return;this.stopped=true;
    clearInterval(this.timer);this.finishRequest();
    if(this.api){if(this.channel)void this.api.removeChannel(this.channel);void this.api.rpc('cafe_leave',{p_session:this.session}).then(()=>undefined,()=>undefined);}
  }
}
export async function gardenSharing(enabled?:boolean):Promise<boolean> {
  const api=await getSupabaseClient(),uid=auth.getSnapshot().userId;
  if(!api||!uid)throw new Error('auth');
  if(enabled!==undefined){const {error}=await api.from('garden_sharing').upsert({user_id:uid,enabled});if(error)throw new Error('sharing');return enabled;}
  const {data,error}=await api.from('garden_sharing').select('enabled').eq('user_id',uid).maybeSingle();
  if(error)throw new Error('sharing');return data?.enabled??false;
}
export async function sharedGarden(uid:string) {
  const api=await getSupabaseClient();if(!api)throw new Error('auth');
  const {data,error}=await api.rpc('get_shared_garden',{p_user_id:uid});
  if(error)throw new Error('visit');return readSharedGarden(data);
}
