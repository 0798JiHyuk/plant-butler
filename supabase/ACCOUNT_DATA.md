# 계정별 정원 저장

## 문서와 적용 근거

읽은 문서: AGENTS.md, README.md, CLAUDE.md, docs/PRD.md,
docs/CONVENTIONS.md, docs/slices/S0.md, docs/spec.md, docs/team-parts.md,
docs/monday-plan.md, docs/notion-plan.md, docs/ux-research.md 및 나머지 Markdown 문서.

PRD/S0의 Expo 화면 명세와 현재 Vite/Phaser 코드는 다르다. 사용자 지시에 따라
현재 웹 구조를 유지한다. PRD의 5개 테이블에는 정원 전체 저장 구조가 없고,
다른 문서에도 정의가 없어 사용자가 새 테이블 생성을 승인했다.
기존 profiles/missions/activities/plans/events 정의와 게임 보상 규칙은 변경하지 않는다.

## 적용 순서

1. AUTH_SETUP.md의 익명 로그인·Google·manual linking·redirect 설정을 확인한다.
2. 팀의 다른 마이그레이션에 garden_saves 또는 save_garden_progress가 없는지 확인한다.
3. Supabase SQL Editor에서 migrations/20261105010000_create_garden_saves.sql 전체를 실행한다.
   CLI로 팀 마이그레이션을 관리한다면 이 파일을 기존 순서에 추가한다.
   동일 이름이 이미 있으면 SQL이 중단된다. 기존 객체를 삭제하거나 교체하지 말고 소유 담당자와 확인한다.
4. npm run dev 후 설정 → 계정 연결에서 서버 저장 상태를 확인한다.
5. 다른 브라우저에서 같은 Google 계정으로 로그인하여 복원 상태를 확인한다.

anon 키로는 DDL을 실행할 수 없다. 이 변경은 원격 SQL을 자동 적용하지 않는다.
테이블 미설정 시 로컬 진행을 유지하고 설정 확인 메시지를 보여준다.
기존 PRD 테이블을 새로 만들거나 운영 데이터를 수정할 필요는 없다.

## 저장 구조와 권한

새 garden_saves: user_id(auth.users FK/PK), state(jsonb), revision(integer),
request_id(uuid), updated_at(timestamptz). 계정당 한 행이다.
state는 현재 AppState v1에서 **주민과 나눈 대화 기록(chats)을 뺀** 전체(대화는 기기에만 두고 서버로 보내지 않으며, 서버 복원이 지우지도 않는다): 정원 위치·식물·창고·씨앗·열매·활동 완료·계획·회고·
봉투·방문 보상·이야기·설정이다. 분석 이벤트로 원문을 보내거나 로그로 출력하지 않는다.
이 snapshot은 PRD activities/plans/events의 분석·연구 데이터 매핑을 대신하지 않는다.
그 테이블의 연동은 해당 슬라이스와 담당자의 규격에 맞춰 별도로 진행한다.

RLS는 같은 마이그레이션에 있다. authenticated만 본인 행을 읽는다.
Supabase 익명 로그인 사용자도 authenticated 역할이지만, 미로그인 anon은 접근 불가다.
직접 insert/update/delete는 금지한다. 저장은 save_garden_progress RPC만 사용한다.
security definer 함수는 고정 search_path와 auth.uid()=p_user_id를 검증한다.
예상 revision이 일치할 때만 갱신한다. 같은 요청은 한 번 반영하고 오래된 버전은 빈 결과를 반환한다.
RPC는 전체 게임 규칙 검증이나 서버 재화 원장 기능이 아니다. 기존 로컬 게임 규칙을 유지하는 MVP 저장 기능이다.

## 계정·충돌 정책

- plantkeeper:v1 원본은 삭제하지 않는다. 첫 계정에 진행을 인계하고 legacy-owner를 기록한다.
- plantkeeper:user:<uid>:v1은 UID별 캐시. 로그아웃 시 기본 로컬 정원으로 전환한다.
- plantkeeper:local:v1은 미로그인 진행. 계정 캐시를 다음 계정에 자동 합치지 않는다.
- 게스트에 Google을 연결하면 같은 UID를 유지한다.
- 기존 Google 계정 로그인 전 prepareTransfer()로 게스트 진행을 보존한다.
- 처음 계정 저장이 없으면 현재 진행을 저장한다. 서버만 변경됐으면 서버를 복원한다.
- 두 기기가 모두 변경됐거나 기존 계정으로 게스트 진행을 가져오면 명시적으로 선택한다.
  자동 병합·재화 합산·클라이언트 시각을 이용한 최신 판단은 하지 않는다.
- 선택 전 양쪽을 UID 캐시 아래 :backup:<uuid>에 보존하고 :backups에 키를 기록한다.
  복구용 백업은 원본 JSON이며 사용자가 브라우저 사이트 데이터를 지우면 함께 사라진다.
- 모르는 저장 버전은 :unreadable-backup에 보존하고 자동으로 서버에 덮어쓰지 않는다.
- plantkeeper:import:<uid> keeps an unresolved guest import across reloads.
- plantkeeper:sync:<uid>는 마지막 승인 revision과 비교 기준이다.
- 계정 변경 전 요청의 늦은 응답은 무시한다. RPC도 요청 UID와 현재 인증 UID를 비교한다.
- 네트워크 오류에는 로컬 진행을 유지한다. 다시 확인/online/focus/화면 복귀로 재시도한다.
  변경은 600ms 후 자동 저장하고 화면 숨김·Google 연결·로그아웃 전 저장을 시도한다.
  브라우저 강제 종료 직전 요청은 보장할 수 없으므로 계정에 저장됨 표시를 확인한다.
- 게스트 세션을 잃으면 서버에 남은 진행도 다시 접근하지 못할 수 있어 Google 연결을 안내한다.

## 연결 지점

- startAccountData(): React effect 시작/정리. main.tsx는 변경하지 않고 게임은 인증·저장을 기다리지 않는다.
- gardenSync.subscribe/getSnapshot: local/loading/pending/saving/saved/conflict/error.
- gardenSync.refresh/flush/resolve('local'|'server'): 재조회·즉시 저장·충돌 선택.
- store.activateUser/restore/backup/prepareTransfer: 계정별 캐시와 복원.
- core events state-restored/garden-ready: Phaser 재생성 및 모달 잠금 복원용 내부 이벤트.
  PRD 분석 이벤트가 아니다. 복원은 완료·수확·방문 지급 함수를 재실행하지 않는다.
- 닫힌 이전 계정의 이야기 onClose나 예약된 봉투 팝업이 새 계정에서 실행되지 않게 취소한다.

## 검증

- Node.js 22.23.4 typecheck/lint/Vitest 113개/build 통과.
- 실제 로컬 PostgreSQL 17에 마이그레이션 적용 후 tests/garden_saves.sql 통과.
  본인 읽기, 타인 접근 차단, anon 차단, 직접 쓰기 차단, 중복·오래된 revision·버전 오류 검사.
- 별도 동시 PostgreSQL 연결 2개: 동일 요청은 revision 1회 증가,
  다른 요청은 같은 예상 revision에서 1개만 반영됨을 확인.
- Supabase CLI 3.0.0으로 로컬 적용 DB에서 database.types.ts 생성. 수기 타입 아님.
- Chrome 844×390의 실제 Phaser + 실제 Supabase SDK, 인증/REST 응답은 모의:
  네트워크 지연 중 정원 표시, 게스트 로그아웃 없음, 동일 UID Google 연결,
  빈 게임 캐시에서 텃밭·식물·씨앗·창고·열매와 Phaser 화면 복원,
  동시 변경 선택, 로그아웃 후 기본 텃밭/식물 초기화 확인.
- 실제 Google 제공자 왕복, 실제 휴대폰, 원격 DB 마이그레이션 적용 후 왕복, 원격 CI는 미검증.
- 저장/안내/권한 변경은 needs-all-approvals 및 A/B/C 확인 후 병합한다.
  병합·배포는 수행하지 않았다. docs/**와 기존 PRD 마이그레이션은 수정하지 않았다.

## 저장 모양(조원 버전과 서로 읽기)

기기와 서버에 저장하는 `missions`는 조원 모양(`selectedCategory`·`stages`·`sessions`·`bookmarks`·`packets` 등)으로 쓴다. 앱 안의 상태는 영역별 장면·"해당 없어요"·회차 번호처럼 조원 모양에 없는 값이 있어 별도 모양이고, 그 값은 `missions.baek`에 함께 저장한다. 조원 버전은 모르는 칸을 지우지 않으므로 거쳐 가도 남는다.
- 변환은 `core/state.ts`의 `encodeState`(저장)와 `decodeState`(불러오기)가 한다. 조원 버전의 저장 검사 코드를 복사한 `src/tests/fixtures/teammate_*.ts`로 우리 저장이 조원 검사를 통과하는지 테스트한다.
- 조원 버전이 올린 직접 만든 미션·하루 지도·5~6단계는 `missions.legacy`에 보관했다가 다시 저장할 때 원래 칸으로 되돌린다.
- 저장 버전은 그대로 1이고 `missions` 칸도 있어 서버 SQL(`save_garden_progress`)을 바꿀 필요가 없다.
- 같은 계정으로 두 버전을 번갈아 쓰면 조원 버전이 바꾼 값(영역·단계 등)이 우선한다. 하루 상한은 조원 버전이 "행동 3개", 이 버전이 "마친 회차 3개"로 계산한다.
