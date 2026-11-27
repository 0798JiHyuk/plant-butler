# 식물집사 — 일상 회복 앱 데모

작은 현실 행동을 고르고 기록하면 정원에 쌓이는 React/Vite/Phaser 웹게임입니다. Google 로그인이 필요하며 Supabase에 계정별 진행을 저장합니다.

DB 변경·새 환경 구축·백업·복구 절차는 [supabase/MIGRATIONS.md](supabase/MIGRATIONS.md)를 기준으로 합니다.
아래 일부 데모 모드·로컬 저장 설명은 초기 개발 기록이며 현재 운영 기능이 아닙니다.

## 실행
```bash
npm install
npm run dev     # http://localhost:5173 (가로 화면 844×390 기준)
npm test        # core 단위 테스트
npm run build
```
조작: 방향키 / WASD / 화면 조이스틱.

## 그래픽
배경·새싹이·소품은 팀 가이드(`art/guide`, A 테마) 그림이고 `python3 tools/slice_art.py`가 `public/assets`를 만든다. 아래는 이전(플레이스홀더) 시절 설명이다.

현재는 코드로 그린 플레이스홀더(`src/scene/assets.ts`, 새싹이는 `src/scene/sprites.ts`).
Kenney 등 CC0 PNG로 바꿀 때는 `assets.ts`의 텍스처 키(`prop_*`, `terrain`)만 교체한다.

### 출처
- (에셋 교체 시 여기에 적는다. 예: Kenney "Tiny Town", CC0, https://kenney.nl)

## 데모 모드 (발표용)
설정 → 데모 모드를 켜면 [다음 날로]와 [샘플 데이터 채우기]가 나온다.
- 샘플 데이터: 지난 14일치 기록·소품·식물. 오늘은 비워 두고, 최근 이틀의 씨앗 봉투는 열지 않은 채 남는다.
- 디버그 줄에 "직접 계획 비율"이 나온다(일반 화면에는 노출하지 않음).
- 테스트용 주소: `/?decor`(소품 7개), `/?packet=3`(지난 3일치 씨앗 봉투).

## 문서
서비스 맥락·스펙·결정 사항은 `docs/spec.md`, Claude Code용 작업 규칙은 `CLAUDE.md`, 화면 참고 이미지는 `docs/reference/`.

## 기술 스택
Vite 8 · TypeScript · React 18(화면) · Phaser 3(정원) · Vitest. 서버 없음, 저장은 브라우저 localStorage. 이전 순수 HTML 화면 코드는 `legacy/dom-ui/`에 남겨 두었다(빌드 대상 아님).

## 구조
`src/core`(규칙·데이터·저장, Phaser·DOM 모름) / `src/scene`(Phaser 정원) / `src/ui`(HTML 오버레이). 서로는 `core/events.ts`로만 대화한다.
문구는 모두 `core/copy.ts`에 있고, 금지 표현은 `npm test`가 검사한다.

## 진행 상황
M1~M5 구현 완료. 소리 파일은 없고 "소리 끄기" 설정 값만 저장한다.
이후 UX 보완(꽃 시각 구분, 바꾸기/더 작게, 소품 창고) 진행 중 — 자세한 내용과 사람 확인 필요 항목은 `docs/spec.md` 5절 참고.
