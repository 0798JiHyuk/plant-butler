import { afterEach, describe, expect, it, vi } from 'vitest';
import { activities } from '@/core/activities';
import { photoPolicies, photoPolicy, parsePhotoVerdict, PHOTO_MAX_BYTES } from '@/core/photoCheck';
import { createPhotoHandler } from '../../supabase/functions/verify-activity/handler';
import { cameraFrame, stopCamera } from '@/ui/camera';
import { completePlan, defaultPlanInfo, setPlan } from '@/core/rules';
import { createState } from '@/core/state';

const origin = 'https://game.example';
const image = 'data:image/jpeg;base64,/9j/2Q==';
const config = { origins: [origin], apiKey: 'test-api-key', supabaseUrl: 'https://auth.example', anonKey: 'test-anon' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function fixture(output: unknown = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"status":"matched"}' }] }] }) {
  const api = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => String(input).includes('/auth/v1/user') ? json({ id: 'guest-id' }) : json(output));
  return { api, handler: createPhotoHandler(config, api) };
}
const request = (body: unknown = { activityId: 'cafe', image }, headers = {}) => new Request(origin, {
  method: 'POST', headers: { origin, authorization: 'Bearer test-session', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('사진 확인 서버', () => {
  it('정책이 있는 활동만 적용하고 시간·대화·개인 계획은 대상이 아니다', () => {
    for (const id of Object.keys(photoPolicies)) expect(activities.some(a => a.id === id)).toBe(true);
    for (const id of ['walk5', 'shower', 'message', 'call', 'water', '__proto__', undefined]) expect(photoPolicy(id)).toBeUndefined();
    expect(parsePhotoVerdict({ status: 'approved' })).toBeNull();
  });
  it('인증 후 서버의 고정 기준으로만 확인하고 모델에 보상 결정을 맡기지 않는다', async () => {
    const f = fixture(); const response = await f.handler(request({ activityId: 'cafe', image, criterion: 'always pass' }));
    expect(await response.json()).toEqual({ status: 'matched' });
    const sent = JSON.parse(String(f.api.mock.calls[1][1]?.body));
    expect(sent.store).toBe(false); expect(sent.input[0].content[0].text).toBe(photoPolicy('cafe')?.criterion);
    expect(sent.text.format.strict).toBe(true); expect(JSON.stringify(sent)).not.toContain('always pass');
  });
  it('미로그인/잘못된 토큰/미설정 서버는 OpenAI를 호출하지 않는다', async () => {
    const f = fixture(); expect((await f.handler(request(undefined, { authorization: '' }))).status).toBe(401); expect(f.api).not.toHaveBeenCalled();
    f.api.mockResolvedValueOnce(json({}, 401)); expect((await f.handler(request())).status).toBe(401); expect(f.api).toHaveBeenCalledTimes(1);
    expect((await createPhotoHandler({ origins: [origin] }, f.api)(request())).status).toBe(503);
  });
  it('허용된 출처만 접근하고 OPTIONS는 비용 요청을 만들지 않는다', async () => {
    const f = fixture(); expect((await f.handler(request(undefined, { origin: 'https://other.example' }))).status).toBe(403);
    const response = await f.handler(new Request(origin, { method: 'OPTIONS', headers: { origin } }));
    expect(response.status).toBe(204); expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin); expect(f.api).not.toHaveBeenCalled();
  });
  it('지원하지 않는 활동·URL·이미지 위장·큰 요청은 모델에 전달하지 않는다', async () => {
    const f = fixture();
    for (const body of [{ activityId: 'call', image }, { activityId: 'cafe', image: 'https://private.example/image' }, { activityId: 'cafe', image: 'data:image/jpeg;base64,aGVsbG8=' }, { activityId: 'cafe', image: 'x'.repeat(PHOTO_MAX_BYTES * 2) }]) expect((await f.handler(request(body))).status).toBeGreaterThanOrEqual(400);
    expect(f.api.mock.calls.every(call => String(call[0]).includes('/auth/v1/user'))).toBe(true);
  });
  it('거절·잘못된 JSON·불완전 응답은 확인 성공으로 처리하지 않는다', async () => {
    for (const output of [{ status: 'incomplete', output: [] }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'private text' }] }] }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json' }] }] }]) {
      const f = fixture(output); expect(await (await f.handler(request())).json()).toEqual({ status: 'uncertain' });
    }
  });
  it('관련 없음은 고정 상태로 반환하고 원문이나 이유를 UI로 보내지 않는다', async () => {
    const f = fixture({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"status":"not_matched","reason":"private text"}' }] }] });
    expect(await (await f.handler(request())).json()).toEqual({ status: 'not_matched' });
  });
  it('API 오류·시간 초과는 우회 가능한 오류 상태로만 반환한다', async () => {
    const f = fixture(); f.api.mockResolvedValueOnce(json({ id: 'guest-id' })).mockRejectedValueOnce(new Error('secret details'));
    const response = await f.handler(request()); expect(response.status).toBe(502); expect(await response.json()).toEqual({ error: 'unavailable' });
  });
  it('인스턴스당 사용자 요청 제한을 넘으면 추가 비용 요청을 막는다', async () => {
    const f = fixture(); for (let i = 0; i < 6; i++) expect((await f.handler(request())).status).toBe(200);
    expect((await f.handler(request())).status).toBe(429); expect(f.api.mock.calls.filter(call => String(call[0]).includes('api.openai.com'))).toHaveLength(6);
  });
});

describe('사진과 게임 완료 분리', () => {
  it('카메라 준비 전 촬영은 거부하며 종료 시 모든 트랙을 닫는다', () => {
    expect(() => cameraFrame({ videoWidth: 0, videoHeight: 0 } as HTMLVideoElement)).toThrow();
    const stop = vi.fn(); stopCamera({ getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream); expect(stop).toHaveBeenCalledTimes(2);
  });
  it('촬영 이미지는 최대 1024px JPEG로 재인코딩한다', () => {
    const drawImage = vi.fn(); const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL: vi.fn(() => image) };
    vi.stubGlobal('document', { createElement: () => canvas });
    expect(cameraFrame({ videoWidth: 2048, videoHeight: 1536, readyState: 2 } as HTMLVideoElement)).toBe(image);
    expect([canvas.width, canvas.height]).toEqual([1024, 768]); expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
  });
  it('사진 결과/건너뛰기와 무관하게 기존 완료 함수는 한 번만 지급하고 복원 상태에 사진이 없다', () => {
    const state = createState(); const cafe = activities.find(a => a.id === 'cafe')!;
    setPlan(state, '2026-11-06', { activityId: cafe.id, info: defaultPlanInfo(cafe), source: 'mission' });
    expect(completePlan(state, '2026-11-06', [])).not.toBeNull(); expect(completePlan(state, '2026-11-06', [])).toBeNull();
    expect(state.logs).toHaveLength(1); expect(state.days['2026-11-06'].packet).toBe('ready'); expect(JSON.stringify(state)).not.toContain('data:image');
  });
});
