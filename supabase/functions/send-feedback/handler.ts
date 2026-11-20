import { isGoogleIdentity } from '../_shared/authPolicy.ts';
import { parseFeedback } from '../_shared/feedbackPolicy.ts';

interface Config { apiKey?: string; from?: string; to?: string; supabaseUrl?: string; anonKey?: string; origins: string[] }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const email = (v: unknown): v is string => typeof v === 'string' && v.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);

/** No payload/email/token logging. Limits are per instance, not a global quota. */
export function createFeedbackHandler(config: Config, request: typeof fetch = fetch) {
  const attempts = new Map<string, { until: number; count: number }>();
  let active = 0;
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('origin');
    const allowed = !!origin && config.origins.includes(origin);
    const headers: Record<string,string> = { 'Content-Type':'application/json', 'Cache-Control':'no-store', Vary:'Origin' };
    if (allowed) Object.assign(headers, { 'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Headers':'authorization,apikey,content-type', 'Access-Control-Allow-Methods':'POST,OPTIONS' });
    const reply = (status: number, error?: string) => new Response(JSON.stringify(error ? {error} : {ok:true}), {status,headers});
    if (!allowed) return reply(403,'origin');
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (req.method !== 'POST') return reply(405,'method');
    const authorization = req.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return reply(401,'auth');
    if (!config.apiKey || !config.from || !email(config.to) || !config.supabaseUrl || !config.anonKey) return reply(503,'setup');
    if (!req.headers.get('content-type')?.startsWith('application/json')) return reply(400,'input');
    try {
      const auth = await request(`${config.supabaseUrl}/auth/v1/user`, {headers:{Authorization:authorization,apikey:config.anonKey},signal:AbortSignal.timeout(8000)});
      if (!auth.ok) return reply(401,'auth');
      const user: unknown = await auth.json();
      if (!object(user) || typeof user.id !== 'string' || !isGoogleIdentity(user)) return reply(401,'auth');
      // Bound streamed bodies even when Content-Length is absent or forged.
      const reader = req.body?.getReader();
      if (!reader) return reply(400,'input');
      let raw = ''; let bytes = 0; const decoder = new TextDecoder();
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 16000) { await reader.cancel(); return reply(413,'input'); }
          raw += decoder.decode(part.value,{stream:true});
        }
        raw += decoder.decode();
      } finally { reader.releaseLock(); }
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return reply(400,'input'); }
      const input = parseFeedback(body);
      if (!input || input.reply && (!email(user.email) || !user.email_confirmed_at)) return reply(400,'input');
      const now = Date.now();
      for (const [key,value] of attempts) if (value.until <= now) attempts.delete(key);
      const entry = attempts.get(user.id) ?? {until:now+60000,count:0};
      if (entry.count >= 3 || active >= 4 || attempts.size >= 2000) return reply(429,'busy');
      entry.count++; attempts.set(user.id,entry); active++;
      try {
        const names = {bug:'오류 제보',question:'이용 문의',feedback:'후기·제안'};
        const sent = await request('https://api.resend.com/emails', {
          method:'POST',signal:AbortSignal.timeout(12000),
          headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json','Idempotency-Key':`feedback/${user.id}/${input.requestId}`},
          body:JSON.stringify({from:config.from,to:[config.to],subject:`[틈새정원] ${names[input.kind]}`,
            text:`${names[input.kind]}\n\n${input.message}`, ...(input.reply ? {reply_to:user.email} : {})}),
        });
        // Provider response bodies may contain personal information; never forward them.
        return sent.ok ? reply(200) : reply(502,'unavailable');
      } finally { active--; }
    } catch { return reply(502,'unavailable'); }
  };
}
