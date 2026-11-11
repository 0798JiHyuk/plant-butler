import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import packageInfo from './package.json' with { type: 'json' };

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
  // 빌드 정보만 선택해서 넣는다. 환경 변수 전체나 계정 정보는 번들에 전달하지 않는다.
  let revision = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  if (!revision) {
    try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { /* Git 없는 소스 배포에서도 빌드는 가능하다. */ }
  }
  const commit = /^[0-9a-f]{7,40}$/i.test(revision) ? revision.slice(0, 7) : '';
  const environment = command === 'serve' ? 'development'
    : process.env.VERCEL_ENV === 'production' ? 'production'
      : process.env.VERCEL_ENV === 'preview' ? 'preview' : 'build';
  return {
    base: './',
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    // 접두사 전체를 공개하지 않고 이 두 이름만 전달한다.
    define: {
      __APP_BUILD__: JSON.stringify({ version: packageInfo.version, commit, environment }),
      'import.meta.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(env.EXPO_PUBLIC_SUPABASE_URL ?? ''),
      'import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''),
    },
    plugins: [react()],
    build: { chunkSizeWarningLimit: 1600 },
    test: { environment: 'node', include: ['src/tests/**/*.test.ts'] },
  };
});
