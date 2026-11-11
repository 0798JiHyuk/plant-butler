/// <reference types="vite/client" />

declare const __APP_BUILD__: Readonly<{
  version: string;
  commit: string;
  environment: 'development' | 'production' | 'preview' | 'build';
}>;

interface ImportMetaEnv {
  readonly EXPO_PUBLIC_SUPABASE_URL?: string;
  readonly EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
}
