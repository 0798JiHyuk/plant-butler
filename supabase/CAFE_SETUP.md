# 온라인 카페 적용 / 검증

현재 DB 적용·백업·복구 절차는 [MIGRATIONS.md](MIGRATIONS.md)를 우선한다.
아래 SQL 실행 안내는 해당 기능 최초 도입 기준이며, 적용한 과거 파일을 재실행하지 않는다.

## 적용 순서

1. 기존 정원 저장 마이그레이션 3개가 적용되어 있는지 확인한다. 특히 `20261114010000_require_google_for_garden.sql`의 `has_google_session()`이 필요하다.
2. Supabase Dashboard → SQL Editor → New query에서 `supabase/migrations/20261115010000_online_cafe.sql` 전체를 한 번 실행한다. 기존 저장 테이블을 삭제하거나 JSON을 교체하지 않는다. 이미 적용한 마이그레이션을 다시 실행하지 않는다.
3. Dashboard → Database → Publications에서 `supabase_realtime`에 **`public.cafe_members`만** 추가되었는지 확인한다. 마이그레이션이 자동 추가한다. `garden_saves`, `garden_sharing`, `cafe_sessions`는 공개용 Realtime 테이블로 추가하지 않는다.
4. 로컬 `npm run dev` 또는 새 프런트엔드 배포를 사용한다. 별도 서버, API 키, Edge Function 배포는 필요 없다. 기존 두 공개 Supabase 환경 변수와 Google 로그인 설정을 그대로 쓴다.

## 데이터와 권한

- `cafe_members`: UID, 정원 이름, 좌표, 좌석, 마지막 갱신 시각만 저장한다. Google 로그인 사용자가 최근 30초 이내 접속자를 조회한다. 직접 쓰기는 금지하고 `cafe_step`/`cafe_leave`가 `auth.uid()`로 본인 행만 변경한다.
- `cafe_sessions`: 동일 계정의 여러 창을 구분하는 토큰. RLS 활성화, 클라이언트 권한/공개 정책 없음. 새 창 입장 후 이전 창의 이동·퇴장이 새 창을 덮어쓰지 않는다.
- `garden_sharing`: 사용자별 공개 동의. 기본 미생성/false. 본인만 읽고 변경한다. 기존 PRD 테이블을 변경하지 않는다.
- `get_shared_garden`: 공개에 동의한 계정의 서버 저장본에서 이름·텃밭 위치·야외 가구·식물의 표시 상태만 서버에서 선별한다. 원본 저장 JSON, 식물의 내부 ID/심은 날짜, 회고·활동·씨앗·창고·재화·스토리·설정은 반환하지 않는다. `garden_saves`의 본인 전용 RLS는 그대로 둔다.
- 정원 방문 장면은 별도 Phaser Scene이며 원래 `store`, 전역 텃밭 위치, 저장 revision을 바꾸지 않는다. 가구/식물 조작이나 보상 지급은 없다. 실내는 공개하지 않는다.
- 공개를 끄면 이후 조회를 차단한다. 이미 받은 화면/캡처까지 회수하지 않는다. 입장 안내에 이를 표시한다.

## 동기화 방식 / MVP 범위

Supabase **Postgres Changes**로 위치 변경을 받고 보간해 표시한다. 움직일 때 최대 500ms마다 RPC, 정지 중 10초마다 heartbeat, 10초마다 명단을 재조회한다. 정상 퇴장은 즉시 삭제 요청, 비정상 종료는 30초 TTL로 숨기고 다음 RPC에서 만료 행을 정리한다. 접속 이력은 별도 수집하지 않는다.

Presence/Broadcast의 클라이언트가 보낸 UID를 신뢰하는 대신 DB에서 본인 UID를 지정한다. 이는 소규모 테스트용이며 방문자 N명이 계속 이동하면 약 2N회/초 DB 쓰기가 발생한다. 동시 접속 규모가 커지면 비용·지연을 측정하고 인증된 중계 방식으로 전환을 검토한다. 이동은 서버에서 방 경계/테이블 충돌을 확인하되 이동 속도까지 강제하는 경쟁 게임 서버는 아니다.

좌석은 서버의 고정 좌표와 240px 거리 검사, UNIQUE 제약으로 한 명만 사용한다. 동시 클릭도 한 요청만 확정한다. 네트워크 오류는 확정하지 않고 다시 연결 버튼을 표시한다. TTL 이후 자리는 반환된다. 대화/채팅/친구/방문 보상은 추가하지 않는다.

## 확인 절차

먼저 **테스트 Supabase 프로젝트**의 SQL Editor에서 `supabase/tests/online_cafe.sql`을 실행한다. 임시 계정/저장본을 만들고 마지막에 ROLLBACK한다. 운영 프로젝트에서 테스트 계정 데이터를 영구 생성하는 스크립트가 아니다. 두 계정의 동시 요청은 아래 실제 브라우저 테스트로 추가 확인한다.

1. 서로 다른 Google 계정 A/B로 서로 다른 브라우저에서 로그인한다. 같은 계정의 두 창은 대체 세션 테스트용이며 서로 다른 두 방문자로 표시하지 않는다.
2. A/B 모두 카페 건물 가까이에서 눌러 입장한다. 위치와 걷는 모습, 정원 이름이 서로 보이는지 확인한다.
3. 같은 의자에 가까이 가서 동시에 누른다. 한 명만 앉고 다른 쪽은 사용 중 안내가 나오는지 확인한다. 일어나기/퇴장/창 종료 후 자리가 반환되는지 확인한다.
4. A가 내 정원 방문 허용을 켠다. 서버 저장 완료 후 B가 A의 새싹이 → 정원 보러가기를 누른다. 배치가 맞고 B의 가방/재화/텃밭/스토리/저장 revision이 바뀌지 않는지 확인한다.
5. A가 공개를 끈 뒤 B가 새로 방문하면 차단되는지 확인한다. Network의 `get_shared_garden` 응답에 개인정보나 전체 저장본이 없는지 확인한다.
6. 인터넷 중단/복구, 다시 연결, 로그아웃, 다른 계정 로그인, 같은 계정 다른 창 입장을 확인한다. 30초 뒤 유령 캐릭터가 사라지는지 확인한다.

로컬 자동 검사: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. 브라우저 자동 검증은 운영 요청을 전부 모킹하며 실제 Supabase 권한/서로 다른 두 계정의 운영 연결 성공을 대신하지 않는다.

공식 참고: [Postgres Changes와 RLS](https://supabase.com/docs/guides/realtime/postgres-changes).

## 연결 지점

- `social-travel`: garden/cafe/visit 이동. `social-location`: HUD 표시 전환. `cafe-person`: 근처 방문자 메뉴. `cafe-state`: 연결 상태/접속 인원/앉기 UI. 분석 이벤트가 아닌 기존 내부 typed event bus만 사용한다.
- `CafeConnection`: Realtime 구독·입장/이동/퇴장 RPC. `gardenSharing()`: 본인 공개 설정. `sharedGarden(uid)`: 안전한 공개 표시 데이터 조회.
- 식물 종류 추가 시 `get_shared_garden`의 공개 식물 ID 목록도 새 마이그레이션으로 확장한다. 기존 배포 마이그레이션은 수정하지 않는다.

## 이번 로컬 검증 결과

- Node.js 22: 타입 검사·린트·Vitest 201개·프로덕션 빌드 통과. 기존 번들 크기 경고는 남아 있다.
- Chrome에서 Supabase REST/WebSocket을 모킹해 입장·공개 동의·좌석 중복 거절·앉기/일어나기·접속자 이동/퇴장·정원 방문·본인 상태 불변·카페/야외 복귀 확인.
- 임시 PGlite PostgreSQL에 기존 3개와 신규 마이그레이션을 순서대로 적용하고 `supabase/tests/online_cafe.sql` 실행 통과. RLS·RPC 인증·공개 철회·선별 반환·좌석 중복·만료·이전 세션·비정상 좌표를 검사하고 fixture 0개로 롤백 확인. Supabase auth 함수는 JWT 설정값을 읽는 로컬 대체 함수였다.
- 운영 Supabase에 SQL을 적용하거나 실제 두 Google 계정으로 Realtime을 검증한 것은 아니다. 배포 후 위 실제 계정 확인 절차가 필요하다. 임시 테스트 엔진은 `.context/`에만 설치했고 앱 package/lockfile은 변경하지 않았다.
