import { createFeedbackHandler } from './handler.ts';

Deno.serve(createFeedbackHandler({
  apiKey: Deno.env.get('RESEND_API_KEY'),
  from: Deno.env.get('FEEDBACK_FROM_EMAIL'),
  to: Deno.env.get('FEEDBACK_TO_EMAIL'),
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  origins: (Deno.env.get('FEEDBACK_ALLOWED_ORIGINS') ?? '').split(',').map(s=>s.trim()).filter(Boolean),
}));
