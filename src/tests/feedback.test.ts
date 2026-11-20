import { describe, expect, it, vi } from 'vitest';
import { createFeedbackHandler } from '../../supabase/functions/send-feedback/handler';
import { parseFeedback } from '../../supabase/functions/_shared/feedbackPolicy';

const origin = 'https://game.example';
const input = {kind:'question',message:'문의 내용',reply:false,consent:true,requestId:'90000000-0000-4000-8000-000000000001'};
const user = {id:'user-a',is_anonymous:false,app_metadata:{provider:'google'},email:'player@example.com',email_confirmed_at:'2026-11-20'};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body),{status});
const req = (body: unknown = input, headers: Record<string,string> = {}) => new Request(origin,{method:'POST',headers:{origin,authorization:'Bearer test-token','content-type':'application/json',...headers},body:JSON.stringify(body)});
function fixture() {
  const api = vi.fn<typeof fetch>().mockImplementation(async url=>String(url).includes('/auth/v1/user') ? json(user) : json({id:'mail'}));
  const config = {apiKey:'test-key',from:'Garden <mail@example.com>',to:'team@example.com',supabaseUrl:'https://auth.example',anonKey:'public-key',origins:[origin]};
  return {api,config,handler:createFeedbackHandler(config,api)};
}
describe('문의·후기 전송',()=>{
  it('동의·길이·유형·추가 필드·요청 ID를 검증하고 후기에 답장 주소를 붙이지 않는다',()=>{
    for (const patch of [{consent:false},{message:' '},{message:'가'.repeat(2001)},{kind:'other'},{to:'attacker@example.com'},{requestId:'bad'},{kind:'feedback',reply:true}]) expect(parseFeedback({...input,...patch})).toBeNull();
    expect(parseFeedback(input)?.message).toBe('문의 내용');
  });
  it('고정된 수신자로 텍스트만 보내고 계정 이메일·UID·저장본은 기본 첨부하지 않는다',async()=>{
    const f=fixture(); expect((await f.handler(req())).status).toBe(200);
    const options=f.api.mock.calls[1][1]!; const body=JSON.parse(String(options.body));
    expect(body.to).toEqual(['team@example.com']);expect(body.reply_to).toBeUndefined();expect(body.html).toBeUndefined();
    expect(options.body).not.toContain(user.email);expect(options.body).not.toContain(user.id);
    expect(new Headers(options.headers).get('Idempotency-Key')).toBe(`feedback/${user.id}/${input.requestId}`);
  });
  it('답변 요청에만 Auth 서버에서 확인한 주소를 사용한다',async()=>{
    const f=fixture();await f.handler(req({...input,reply:true}));
    expect(JSON.parse(String(f.api.mock.calls[1][1]?.body)).reply_to).toBe(user.email);
    const g=fixture();g.api.mockResolvedValueOnce(json({...user,email_confirmed_at:null}));expect((await g.handler(req({...input,reply:true}))).status).toBe(400);expect(g.api).toHaveBeenCalledTimes(1);
  });
  it('미로그인·익명·다른 출처는 이메일 발송을 하지 않는다',async()=>{
    const f=fixture();expect((await f.handler(req(input,{authorization:''}))).status).toBe(401);expect(f.api).not.toHaveBeenCalled();
    expect((await f.handler(req(input,{origin:'https://other.example'}))).status).toBe(403);
    f.api.mockResolvedValueOnce(json({...user,is_anonymous:true}));expect((await f.handler(req())).status).toBe(401);expect(f.api).toHaveBeenCalledTimes(1);
  });
  it('설정 누락·큰 본문·잘못된 입력을 차단한다',async()=>{
    const f=fixture();expect((await createFeedbackHandler({...f.config,apiKey:undefined},f.api)(req())).status).toBe(503);
    expect((await f.handler(req({message:'a'.repeat(17000)}))).status).toBe(413);
    expect((await f.handler(req({...input,email:'fake@example.com'}))).status).toBe(400);
    expect(f.api.mock.calls.every(([url])=>String(url).includes('/auth/v1/user'))).toBe(true);
  });
  it('반복 요청을 제한하고 발송 서비스 오류 내용을 브라우저에 전달하지 않는다',async()=>{
    const f=fixture();f.api.mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json({private:'민감 내용'},400));
    const failed=await f.handler(req());expect(failed.status).toBe(502);expect(await failed.text()).not.toContain('민감');
    await f.handler(req());await f.handler(req());expect((await f.handler(req())).status).toBe(429);
  });
  it('발송 예외 후 슬롯을 반환해 다음 재시도를 처리한다',async()=>{
    const f=fixture();f.api.mockImplementation(async url=>{if(String(url).includes('/auth/v1/user'))return json(user);throw new Error('private');});
    for(let i=0;i<3;i++)expect((await f.handler(req())).status).toBe(502);
  });
});
