# 웹 Google 로그인 필수

현재 정책은 Google 로그인 후에만 게임에 들어가는 방식이다. 이전 익명 시작·게스트 연결·로컬 플레이는 사용하지 않는다. 기존 계정과 저장 행은 삭제하지 않는다.

## 환경 설정

Vite는 기존 두 공개 환경 변수만 전달한다: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY. Google client secret / service_role / OpenAI 키를 브라우저에 넣지 않는다.

Supabase Authentication에서 Google 공급자를 유지하고 Anonymous 로그인을 끈다. Google 제공자의 redirect URI는 기존 Supabase callback URL이다. Supabase Redirect URLs에는 실제 접속 주소(현재 로컬 테스트 http://localhost:5185/ 및 http://127.0.0.1:5185/, 운영 도메인)를 허용한다. 기존 localhost:5173 개발을 사용한다면 그 주소도 별도로 유지한다. 이 문서가 대시보드 설정을 자동 변경하지는 않는다.

## 운영 반영

1. 기존 마이그레이션 뒤에 migrations/20261114010000_require_google_for_garden.sql을 적용한다. SQL Editor에서는 이 파일 전체를 실행한다. 새 테이블이나 컬럼은 없고, 현재 저장 RPC 및 본인 조회 정책에 Google 세션 검사를 추가한다.
2. Anonymous 인증을 끈다. 기존 익명 계정/저장은 보존하되 게임 접근은 차단한다.
3. 사진 확인 함수를 사용 중이면 verify-activity도 재배포한다. Auth /user로 확인된 Google 사용자만 모델 호출로 넘어간다.
4. 프런트 변경을 검토 후 배포하고 실제 Google OAuth 왕복·계정 저장·휴대폰을 확인한다. 코드 작성/모사 테스트가 운영 반영을 뜻하지 않는다.

## 진입·복원

SessionGate는 auth와 gardenSync를 시작한다. 로그인 전 Phaser와 HUD/미션은 시작하지 않는다. 예전 익명 세션, 설정 없음, 인증 오류도 게임으로 우회하지 않는다. Google 사용자라도 첫 저장 불러오기 완료 전에는 진입을 기다린다. 충돌은 기존 로컬/서버 선택을 사용하고, 오류는 재시도하거나 다른 계정으로 로그인할 수 있다.

로그아웃하면 화면·입력·게임 루프와 환경음을 중지하고 로그인 화면으로 돌아간다. 저장본·계정 캐시를 삭제하지 않는다. 기존 Google 계정은 같은 UID로 이어간다.

인증 API: initialize(), retry(), google(), signOut(), subscribe(), getSnapshot(). startGuest/linkIdentity 경로는 없다. ensureSession()은 Google UID 또는 null만 반환한다.

## 확인 범위

Vitest는 익명 생성 미호출, 이전 익명 세션 거부, Google 세션 복원, 다른 공급자 거부, OAuth 중복 클릭, 로그아웃과 오류 재시도를 검사한다. 브라우저 CDP는 가짜 Supabase 응답으로 로그인 전 게임 미생성, OAuth 이후 로드 대기, 실제 게임 시작, 로그아웃 차단 및 지도 저장 복원을 검사한다.

서버 SQL 검사는 tests/google_access.sql, garden_saves.sql, mission_progress.sql이다. 로컬/테스트 DB에서만 실행하며 rollback한다. 현재 환경에서 실제 DB 실행은 별도다. 실제 Google 계정 OAuth와 원격 DB/Edge Function 배포는 모사 검증과 구분한다.
