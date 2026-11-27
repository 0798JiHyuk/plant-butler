# DB 변경·이관·복구 운영 기준

이 문서가 현재 적용 순서의 기준이다. 과거 기능별 문서의 SQL Editor 절차는 도입 당시 기록이다.
기존 DB에 과거 SQL을 처음부터 다시 실행하지 않는다. 마이그레이션은 게임 상태 데이터나
Google OAuth/Edge Function 비밀 값까지 자동으로 이관하는 기능이 아니다.

## 1. 현재 파일과 로컬 검증

필수: Node.js 22, Docker Desktop 실행, Supabase CLI **3.0.0**.
CLI 실행은 `npx --yes supabase@3.0.0`으로 대체할 수 있다. npm 앱 의존성은 추가하지 않는다.

```powershell
supabase start -x studio,imgproxy,edge-runtime,logflare,vector
npm run db:check
node tools/db-upgrade-check.mjs
npm run db:test
npm run db:types:check
node tools/db-restore-check.mjs
npm run typecheck
npm run lint
npm test
npm run build
```

`supabase start`는 로컬 스택에 아직 없는 마이그레이션을 순서대로 적용한다.
이미 로컬 스택을 사용 중이고 깨끗한 재현을 하려면 필요한 로컬 데이터를 먼저 별도 보존한 후
`supabase db reset`을 실행한다. 이 명령은 **로컬 데이터도 삭제**한다. 운영 대상으로 실행하지 않는다.
복구 연습은 빈 로컬 `garden_saves`만 허용한다. 실제 사용 중인 로컬 데이터가 있으면 중단한다.
업그레이드 연습은 빈 Auth/앱 테이블을 확인한 뒤 로컬을 이전 6개 버전으로 초기화하고,
합성 저장본을 넣어 신규 마이그레이션 후 JSON과 revision이 보존되는지 검사한다.

순서:

1. 20261105010000 정원 저장
2. 20261109010000 미션 진행 보존
3. 20261114010000 Google 접근 제한
4. 20261115010000 온라인 카페
5. 20261118010000 팀 통계
6. 20261118020000 공개 가구 방향
7. **20261127010000 저장 스키마 계약** (이번 신규 변경)

CI `database` 작업은 빈 로컬 Supabase 구축, 모든 SQL 테스트, 타입 일치, 합성 저장본의
pg_dump/복원 연습을 실행한다. 운영 Secrets/프로젝트 연결 없이 실행한다.
`migration-baseline.json`은 이미 병합된 6개 파일의 체크섬이다. 줄바꿈/빈 줄 외 수정·삭제를 검출한다.
PR에서는 기본 브랜치, push에서는 직전 커밋의 전체 마이그레이션도 대조해 이후 병합된 파일까지
수정·삭제·과거 시점 끼워넣기를 막는다. 오류를 숨기기 위해 과거 체크섬을 갱신하지 않는다.
저장소 관리자는 브랜치 보호에 **database**도 필수 검사로 등록한다. 워크플로 파일만으로 보호 설정이 바뀌지는 않는다.

## 2. 이미 SQL Editor로 적용한 운영 DB

1. `checks/readiness.sql`로 객체·RLS·함수 해시·공개 테이블·저장 버전을 확인한다. 읽기 전용이다.
2. CLI 이력 테이블이 있으면 마지막 주석의 조회문으로 버전을 확인한다.
3. 운영 프로젝트에 명시적으로 연결한 뒤 `supabase migration list --remote`로 대조한다.
4. 테이블 존재만으로 적용 완료로 판단하지 않는다. 정책·권한·현재 함수 정의를 마지막 마이그레이션과 비교한다.
5. 실제로 적용된 것으로 확인된 파일만 담당자가 `supabase migration repair <버전> --status applied --remote`로 이력에 등록한다.
   이 명령은 **SQL을 실행하거나 빠진 기능을 복구하지 않는다.** 존재하지 않는 변경을 applied로 표시하면 안 된다.
6. 이력/스키마가 다르면 작업을 중단하고 차이를 보완할 새 마이그레이션을 만든다.

이력 repair / 운영 db push는 자동 스크립트나 CI에서 실행하지 않는다.

## 3. 이번 저장 계약 배포 순서

운영 백업 확인 → 테스트 프로젝트에서 신규 SQL 검증 → 신규 SQL 한 개 적용 → 웹 배포 → 계정 저장 왕복 확인.
기존 6개가 이미 있다면 **20261127010000_save_schema_contract.sql만 새로 적용**한다.
CLI 이력 정리가 끝났다면 `supabase db push --dry-run --remote`로 예정 파일을 검토한 뒤 담당자가 적용한다.

`saveSchemaVersion=1`을 도입한다. 기존 행은 일괄 수정하지 않는다. 새 웹이 기존 v1을 읽으면
메모리에서 명시적 버전을 보완하고 다음 저장에 함께 보낸다. 최신 마커가 저장된 계정은 이를
누락하는 구형 클라이언트의 덮어쓰기를 거절한다. 구형 화면은 갱신이 필요할 수 있다.
새 웹을 먼저 배포하면 신규 필드의 DB 보호가 적용되기 전이므로 순서를 지킨다.

`revision`은 동시 저장 번호, `saveSchemaVersion`은 저장 모양, `missions-v2.json.version`은 콘텐츠 버전이다.
앞으로 필드 삭제·이름 변경·필수화 등 구조 변경 시 migrateSave에 명시적인 변환 단계를 추가하고
서버가 지원하는 버전도 새 SQL로 갱신한다. 모르는 미래 버전을 낮추거나 초기화하지 않는다.
변환은 원본을 변경하지 않고 반복 실행에 안전해야 하며 이전 버전 fixture로 검증한다.
회고/메모 원문은 로그·분석 이벤트에 출력하지 않는다.

## 4. 백업·장애 복구

변경 전 운영 담당자가 확인하고 기록할 항목:

- Supabase Dashboard의 백업/PITR 사용 가능 여부, 마지막 성공 시각, 복구 범위.
- 백업 파일 또는 스냅샷의 접근 담당자, 암호화 보관 장소, 보관 기간, 복구할 버전.
- 게임 배포 커밋, DB 적용 버전, Edge Function 배포 버전과 환경 설정 목록.

CLI 공식 백업 명령은 `supabase db dump --remote --file backups/schema.sql` 및
`supabase db dump --remote --data-only --use-copy --file backups/data.sql`이다.
기본 덤프의 관리 스키마 제외 규칙을 확인한다. **이 두 파일만으로 Auth 계정 전체까지 복원된다고 가정하지 않는다.**
다른 프로젝트로 옮길 때는 공식 프로젝트 이관 절차로 Auth 사용자/identities, public 데이터,
필요한 역할/확장/시퀀스/마이그레이션 이력을 포함해 테스트 프로젝트에 복원한다.
이메일·회고가 담긴 백업은 Git/공유 노션/CI artifact에 올리지 않는다. `backups/`는 gitignore한다.

검증: 행 수·사용자 참조 무결성·재화/배치/미션 보존·RLS·실제 Google 로그인·다른 계정 격리·카페를 확인한다.
운영 복원은 해당 백업의 Auth 범위 및 대상 프로젝트를 확인한 담당자가 수행한다.
앱의 localStorage 백업과 revision은 운영 DB 백업이 아니다.

문제 발생 시 신규 쓰기 중단 → 백업/오류 범위 확인 → 테스트 환경 복원 확인 → 담당자 결정으로
복원 또는 새 수정 마이그레이션을 적용한다. 과거 SQL 재실행이나 Git revert만으로 DB가 복구되지는 않는다.
새 저장 버전을 이해하지 못하는 예전 웹 버전으로 단순 롤백하지 않는다.

## 5. 타입 / 새 프로젝트 설정

로컬에 신규 SQL을 적용한 다음 `npm run db:types`로 **공식 CLI가 전체 public 타입을 생성**한다.
생성 도구는 결과의 줄바꿈과 줄 끝 공백만 정규화한다.
임시 파일로 생성 성공을 확인한 뒤 교체하므로 생성 오류로 기존 타입이 빈 파일이 되지 않는다.
CI는 같은 CLI 버전으로 재생성한 결과와 비교한다. 타입 정의를 직접 손으로 보완하지 않는다.
카페의 `p_seat=NULL`은 실제 SQL 계약이지만 생성기는 RPC 인자의 NULL 허용을 표현하지 않는다.
`src/lib/cafe.ts` 호출 경계에서만 이 차이를 명시하며, NULL 입장은 SQL 테스트로 검증한다.
Windows에서 npm 패키지로만 CLI를 사용하는 경우에는
`npx --yes --package=supabase@3.0.0 -- node tools/db-local.mjs types`로 실행할 수 있다.
독립 실행 파일 또는 JS 진입점이 PATH 밖에 있다면 도구 전용 `SUPABASE_CLI` 환경 변수로 경로를 지정한다.

데이터를 다른 Supabase 프로젝트로 옮길 때 사용자 UID가 바뀌면 저장·공유·팀 권한 연결도 달라진다.
Auth 이관 정책을 먼저 정하고 UID 연결을 검증한다. CLI migration 파일만 새 DB에 적용하면
**빈 구조만** 생기며 기존 사용자 진행은 넘어오지 않는다.

추가 설정: Google 공급자/콜백 및 Redirect URLs, 두 공개 환경 변수, 두 Edge Functions와 Secrets,
Realtime publication(cafe_members만), 팀 UUID 권한, 정원 공개 동의 데이터.
카페 접속/좌석은 일시 데이터라 이전 연결을 유지하는 대신 새 환경에서 다시 접속하게 한다.
이전 프로젝트와 새 프로젝트에 동시에 쓰는 상태로 전환하지 않는다.

공식 참고:
- https://supabase.com/docs/guides/local-development/cli-workflows
- https://supabase.com/docs/guides/local-development/cli/migrating-to-v3
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

운영 프로젝트의 적용 이력 정합화, 실제 백업 범위 확인, 실제 계정 복구 연습은 이 코드 변경만으로
완료되지 않는다. 담당자의 운영 접근과 테스트 프로젝트 검증 후 체크해야 한다.

## 이번 로컬 검증 결과

- Node.js 22: 타입 검사·린트·Vitest 297개·빌드 통과 (기존 번들 크기 경고 유지).
- Supabase CLI 3.0.0 / 실제 Docker Supabase PostgreSQL 17: 7개 순차 적용과 SQL 테스트 6개 통과.
- 기존 6개까지 로컬 재구축 → 합성 저장본 삽입 → 신규 SQL 적용 후 JSON/revision 보존 확인.
- 전체 public 타입 공식 재생성 후 동일 결과 확인.
- 합성 garden_saves 1건의 스키마/데이터 pg_dump → 별도 빈 DB 복원 → JSON/revision/request_id 확인 및 정리.
  이 연습은 Auth·모든 테이블·운영 백업의 복구 성공을 대신하지 않는다.
- 과거 SQL 변경 감지 및 생성 실패 시 기존 타입 보존 도구 테스트 2개 통과.
- GitHub Actions 원격 실행, 운영 DB 이력 repair/적용, 운영 백업 복원, 실제 Google 인증 이관은 수행하지 않았다.
