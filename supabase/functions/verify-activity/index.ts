import { createPhotoHandler } from './handler.ts';

Deno.serve(createPhotoHandler({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
  model: Deno.env.get('OPENAI_VISION_MODEL') || undefined,
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  origins: (Deno.env.get('PHOTO_ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean),
}));
