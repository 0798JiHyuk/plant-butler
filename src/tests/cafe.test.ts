import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAFE, CAFE_SEATS, CAFE_TABLES, cafeMemberFresh, cafeWalkable, readCafeMember } from '../core/cafe';
import { readSharedGarden } from '../core/sharedGarden';
const uid='10000000-0000-4000-8000-000000000001';
const fixture=()=>({user_id:uid,garden_name:'작은 정원',x:1024,y:1280,seat_id:null,updated_at:new Date().toISOString()});
describe('온라인 카페 경계와 공개 데이터',()=>{
  it('2048×1536, 출입구와 열 개 좌석이 유효하고 테이블을 통과하지 않는다',()=>{
    expect(CAFE.width).toBe(2048);expect(CAFE.height).toBe(1536);expect(cafeWalkable(CAFE.spawn.x,CAFE.spawn.y)).toBe(true);
    expect(new Set(CAFE_SEATS.map(s=>s.id)).size).toBe(10);
    for(const s of CAFE_SEATS)expect(cafeWalkable(s.x,s.y+45)).toBe(true);
    for(const t of CAFE_TABLES)expect(cafeWalkable(t.x,t.y)).toBe(false);
    for(const x of [NaN,Infinity,-1,2048])expect(cafeWalkable(x,1000)).toBe(false);
  });
  it('이상 좌표·위조된 좌석 좌표·잘못된 식별자와 오래된 접속은 표시하지 않는다',()=>{
    const member=readCafeMember(fixture())!;expect(member).not.toBeNull();expect(cafeMemberFresh(member)).toBe(true);
    expect(cafeMemberFresh(member,Date.now()+30001)).toBe(false);
    expect(readCafeMember({...fixture(),x:NaN})).toBeNull();
    expect(readCafeMember({...fixture(),user_id:'bad'})).toBeNull();
    expect(readCafeMember({...fixture(),seat_id:'chair-1'})).toBeNull();
    const seat=CAFE_SEATS[0];expect(readCafeMember({...fixture(),seat_id:seat.id,x:seat.x,y:seat.y})).not.toBeNull();
  });
  it('방문 데이터에 회고·열매·가방·식별자를 복사하지 않고 원본도 변경하지 않는다',()=>{
    const raw={name:'방문할 정원',bed:{x:560,y:2512},items:[{id:'private',kind:'bench',col:20,row:80}],plants:[{id:'secret',plantId:'apple_tree',col:10,row:81,stage:'young',date:'private'}],logs:['private memo'],fruit:999,storage:['private']};
    const before=JSON.stringify(raw),garden=readSharedGarden(raw)!;
    expect(Object.keys(garden).sort()).toEqual(['bed','items','name','plants']);
    expect(JSON.stringify(garden)).not.toMatch(/private|secret|999/);expect(JSON.stringify(raw)).toBe(before);
    expect(readSharedGarden({...raw,bed:{x:Infinity,y:0}})).toBeNull();
    expect(readSharedGarden(null)).toBeNull();
    expect(readSharedGarden({...raw,items:[{kind:'unknown',col:0,row:0}]} )?.items).toEqual([]);
  });
});

const mock=vi.hoisted(()=>({rpc:vi.fn(),select:vi.fn(),remove:vi.fn(),subscribe:null as null|((status:string)=>void),change:null as null|((payload:unknown)=>void)}));
vi.mock('../lib/auth',()=>({auth:{getSnapshot:()=>({userId:'10000000-0000-4000-8000-000000000001'})}}));
vi.mock('../lib/supabase',()=>({getSupabaseClient:async()=>({
  rpc:mock.rpc,from:()=>({select:mock.select}),removeChannel:mock.remove,
  channel:()=>{const c={on:(_event:string,_filter:unknown,cb:(payload:unknown)=>void)=>{mock.change=cb;return c;},subscribe:(cb:(status:string)=>void)=>{mock.subscribe=cb;return c;}};return c;},
})}));
import { CafeConnection } from '../lib/cafe';
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
describe('카페 연결 수명과 이동',()=>{
  const setup=async()=>{
    vi.useFakeTimers();mock.rpc.mockResolvedValue({data:{status:'ok'},error:null});mock.select.mockResolvedValue({data:[fixture()],error:null});
    const changed=vi.fn(),connection=new CafeConnection(changed);await connection.start();mock.subscribe?.('SUBSCRIBED');await vi.advanceTimersByTimeAsync(1);return {connection,changed};
  };
  it('이동을 최대 초당 두 번 보내고 종료 시 구독과 자신의 세션만 정리한다',async()=>{
    const {connection,changed}=await setup();expect(changed.mock.lastCall?.[1]).toBe('online');
    const session=mock.rpc.mock.calls[0][1].p_session;
    for(let i=0;i<100;i++)connection.move(1000+i,1200);
    await vi.advanceTimersByTimeAsync(500);expect(mock.rpc.mock.calls.filter(c=>c[0]==='cafe_step')).toHaveLength(2);
    connection.stop();expect(mock.remove).toHaveBeenCalledTimes(1);expect(mock.rpc).toHaveBeenCalledWith('cafe_leave',{p_session:session});
    const calls=mock.rpc.mock.calls.length;await vi.advanceTimersByTimeAsync(20000);expect(mock.rpc.mock.calls.length).toBe(calls);
  });
  it('좌석 중복을 거절하고 끊긴 연결에서는 새 좌석을 확정하지 않는다',async()=>{
    const {connection,changed}=await setup();mock.rpc.mockResolvedValueOnce({data:{status:'occupied'},error:null});
    expect(await connection.seat('chair-1',340,810)).toBe('occupied');
    mock.subscribe?.('CHANNEL_ERROR');expect(changed.mock.lastCall?.[1]).toBe('error');expect(changed.mock.lastCall?.[0]).toEqual([]);
    expect(await connection.seat('chair-1',340,810)).toBe('error');connection.stop();
  });
  it('다른 창으로 세션이 바뀌면 재가입으로 빼앗지 않고 중단한다',async()=>{
    const {connection,changed}=await setup();mock.rpc.mockResolvedValueOnce({data:{status:'replaced'},error:null});connection.move(1200,1200);
    await vi.advanceTimersByTimeAsync(500);expect(changed.mock.lastCall?.[1]).toBe('replaced');
    const count=mock.rpc.mock.calls.length;await vi.advanceTimersByTimeAsync(15000);expect(mock.rpc.mock.calls.length).toBe(count);connection.stop();
  });
  it('구독 변경은 검증한 접속자만 표시하고 종료 뒤 지연 응답을 버린다',async()=>{
    const {connection,changed}=await setup();mock.change?.({eventType:'UPDATE',new:{...fixture(),user_id:'20000000-0000-4000-8000-000000000002'}});
    expect(changed.mock.lastCall?.[0]).toHaveLength(2);connection.stop();const calls=changed.mock.calls.length;
    mock.change?.({eventType:'UPDATE',new:fixture()});expect(changed.mock.calls.length).toBe(calls);
  });
});
