# 웹 게스트·Google 인증

## 읽은 문서와 적용 범위

- AGENTS.md, docs/CONVENTIONS.md: strict·any 금지·공개 env 두 개·개인 기록 로그 금지·별도 브랜치.
- README.md, CLAUDE.md, docs/spec.md, 최근 Git 이력: 현재 Vite·React·Phaser 구조 유지.
- docs/PRD.md, docs/slices/S0.md: 익명 인증·세션 복원 참고. 프로필 생성은 S4 담당 범위.
- docs/team-parts.md, docs/ux-research.md, docs/monday-plan.md: 계정은 설정에서 열고 게임 규칙은 유지.

인증 SDK는 React effect에서 지연 로딩하며 인증 성공을 게임 시작 조건으로 사용하지 않는다.
계정별 진행 저장은 후속 작업으로 추가했다. 최신 저장 구조·SQL 적용·충돌 정책은
[ACCOUNT_DATA.md](ACCOUNT_DATA.md)를 따른다. PRD 5개 테이블은 변경하지 않는다.

## Supabase 프로젝트 설정

1. Anonymous Sign-ins를 켠다.
2. Google OAuth 제공자를 활성화하고 Google client ID·secret은 Supabase 대시보드에만 설정한다.
3. Google의 승인된 redirect URI에는 Supabase가 표시하는 Auth callback URL을 등록한다.
4. Supabase URL Configuration에는 앱 주소 `http://localhost:5173/`와 실제 배포 주소를 등록한다.
   localhost와 127.0.0.1은 별개 주소이므로 사용할 주소를 정확히 등록한다.
5. 익명 계정의 Google 연결을 위해 Allow manual linking을 켠다.
6. 루트 .env에는 EXPO_PUBLIC_SUPABASE_URL·EXPO_PUBLIC_SUPABASE_ANON_KEY만 설정하고 Vite를 재시작한다.
   service_role·Google client secret은 앱에 넣지 않는다.

Vite는 loadEnv로 읽은 위 두 이름만 define으로 전달한다. 접두사 전체 공개를 사용하지 않는다.
설정 값이나 인증 토큰·사용자 정보·계획·회고를 console에 출력하지 않는다.

## 동작과 연결 규격

- auth.initialize(): 기존 세션 복원. 없으면 백그라운드에서 게스트 인증. 중복 호출은 같은 작업을 공유한다.
- ensureSession(): 사용자 ID 또는 null. 인증 오류가 게임 시작으로 전파되지 않는다.
- auth.google(): 게스트면 같은 사용자에 linkIdentity, 세션이 없으면 Google 로그인.
- auth.google('existing'): 이미 Google에 연결된 기존 계정으로 로그인.
- auth.signOut(): 연결 계정만 이 브라우저에서 로그아웃. 게스트에는 버튼/API 로그아웃을 제공하지 않는다.
- auth.subscribe()·getSnapshot(): checking/local/signed-out/guest/connected, busy, 안전한 오류 코드 제공.
- getSupabaseClient(): 공식 SDK 단일 클라이언트를 비동기 생성. 설정 오류에는 null.

기존 plantkeeper:v1 원본을 보존하며 진행은 UID별 캐시로 분리한다.
계정 저장이 완료되면 같은 Google 계정으로 다른 브라우저에서 복원한다.
게스트 세션이 사라지면 서버 진행에 접근하지 못할 수 있음을 안내한다.

## 테스트

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
현재 TypeScript 7과 typescript-eslint의 peer 지원 범위가 달라 버전 강제 변경 없이
Oxlint로 TS 검사와 명시적 any 금지를 수행한다.

브라우저에서는 정원이 보이는 상태에서 설정 → 계정 연결을 연다. 게스트 상태와 Google 연결,
기존 계정 로그인, 새로고침 후 세션 유지, 연결 취소와 재시도, 연결 계정 로그아웃을 확인한다.
게스트에 로그아웃 버튼이 없어야 하고, 인증 지연·오류 중에도 정원 화면이 표시되어야 한다.

인증 단독 작업 당시 검증 결과(후속 저장 검증은 ACCOUNT_DATA.md 참고):

- Node.js 22.23.4: typecheck·lint·테스트 97개·build 통과.
- 개발/프로덕션의 두 env 전달과 유사 이름·비밀 테스트 변수 비노출 확인. 값은 출력하지 않음.
- Chrome 844×390: 실제 SDK에 인증 응답만 모사하여 정원 선행 표시·게스트 생성/복원·PKCE 콜백·로그아웃 검사.
- 새로고침 후 추가 게스트 생성 없음, Google 연결 전후 동일 ID.
- 게스트 로그아웃 없음, 패널 스크롤 없음, 테이블 요청 0회.
- 이미지: `.context/auth-smoke/browser/garden-before-auth.png`, `guest.png`, `connected.png`.
- 실제 프로젝트의 공개 Auth 설정에서 Google 활성 상태만 읽기 확인. 익명 로그인·manual linking·redirect 허용 목록은 별도 확인.
- 실제 Google 제공자 화면 왕복·실제 휴대폰·원격 CI·팀 승인은 미확인. 모사 검증을 이 항목의 통과로 간주하지 않음.

## 명세 질문·리뷰

과거 S0의 Expo·AsyncStorage·플레이스홀더는 현재 웹 및 최신 사용자 요청과 다르므로 적용하지 않는다.
새 분석 이벤트나 S0의 DB 스키마 전체를 인증 작업에 포함하지 않는다. 후속 정원 저장 테이블은 사용자가 별도 승인했다.
기존 PRD는 이메일 수집을 금지한다. 이메일 입력란·별도 수집 테이블은 추가하지 않았지만,
사용자가 요청한 Google 인증에서 제공자와 Supabase가 처리하는 계정 정보의 범위는 운영 전 검토해야 한다.
안내·인증 변경 PR은 CONVENTIONS.md의 needs-all-approvals 및 A·B·C 확인 절차를 따른다.
원본 docs/**·AGENTS.md·CLAUDE.md는 변경하지 않는다. 원격 CI·실제 휴대폰/OAuth 확인은 별도다.

공식 참고: https://supabase.com/docs/guides/auth/auth-anonymous
https://supabase.com/docs/guides/auth/auth-identity-linking
