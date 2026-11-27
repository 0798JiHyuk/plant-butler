# 문의·후기 이메일 전송

현재 DB 적용·백업·복구 절차는 [MIGRATIONS.md](MIGRATIONS.md)를 우선한다.
아래 SQL 실행 안내는 해당 기능 최초 도입 기준이며, 적용한 과거 파일을 재실행하지 않는다.

설정 → 문의·후기 남기기에서 오류 제보 / 이용 문의 / 후기·제안을 보낸다.
사용자 입력 이메일은 수집하지 않는다. 문의에서 답변받기를 명시적으로 선택한 경우에만
Auth 서버가 확인한 Google 이메일을 Reply-To로 사용한다. 후기에는 붙이지 않는다.
내용 전달 동의를 필수로 받고, 회고·게임 저장본·정원 이름·사용자 UID는 이메일에 자동 첨부하지 않는다.
개인 내용은 console / 분석 이벤트 / 오류 응답에 남기지 않는다.

## 설정 순서

1. Resend 계정에서 발신 도메인을 인증하고 발송 권한 API 키를 만든다.
   테스트 발신 주소는 Resend 계정 소유자 수신 등 제한이 있으므로 실제 운영 전에 도메인을 인증한다.
2. Supabase Dashboard → Edge Functions → Secrets에 아래 값을 등록한다.
   프런트엔드 .env / Vercel 공개 변수에는 추가하지 않는다.
   - `RESEND_API_KEY`: Resend API 키
   - `FEEDBACK_FROM_EMAIL`: 인증한 도메인의 발신 주소 (예: `틈새정원 <support@your-domain>`)
   - `FEEDBACK_TO_EMAIL`: 문의를 받을 팀 운영 이메일 한 개
   - `FEEDBACK_ALLOWED_ORIGINS`: 실제 게임 주소와 개발 주소를 쉼표로 구분
     예: `https://plant-butler-seven.vercel.app,http://localhost:5173,http://127.0.0.1:5173`
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`는 Edge Function 기본 제공 값을 사용한다.
3. 저장소 루트에서 실행한다.

   ```powershell
   npx supabase functions deploy send-feedback --project-ref sghnomkwebnmkwoyzazq
   ```

4. 프런트엔드 변경을 배포한다. SQL 실행·신규 테이블·라이브러리 설치는 필요 없다.
5. Google 로그인 → 설정 → 문의·후기를 열어 다음을 확인한다.
   - 동의 전/빈 내용은 전송 불가, 2000자 제한, 전송 중 중복 클릭 불가
   - 후기 수신 메일에 사용자 이메일이 없음
   - 문의의 답변받기 선택 시 안내한 Google 이메일로 답장 가능
   - 네트워크 오류 후 내용 유지·재전송, 닫기/계정 변경 시 요청 중단
   - 모바일 가로 화면에서 스크롤 및 입력·보내기 조작 가능
   - 스팸함 포함 실제 도착 확인 (API 접수 성공은 최종 배달 보장이 아님)

## 중복과 제한

같은 화면에서 같은 내용을 재시도하면 같은 요청 ID를 보낸다. Resend의 사용자별
Idempotency-Key로 24시간 내 같은 요청의 중복 발송을 방지한다. 내용을 바꾸거나 화면을
다시 열어 새로 보내는 경우에는 새 요청이다. 이메일이 확정된 뒤 취소할 수는 없다.
서버 인스턴스별 UID당 분당 3회 / 동시 4회 제한은 전역 제한이 아니다.
공개 운영 전 Resend 계정 한도·알림을 설정하고 트래픽에 따라 전역 제한을 검토한다.

## 개인정보와 운영 결정

앱 DB와 localStorage에는 문의 원문을 저장하지 않는다. 작성 중 내용은 화면 메모리에만
있으므로 화면을 닫으면 사라진다. 발송 서비스와 운영 메일함에는 전송 내용이 남을 수 있다.
수신자·메일함 접근 담당자·보관/삭제 기간·외부 발송 서비스 사용에 대한 개인정보 안내는
팀에서 확정해 공개 운영 전에 반영한다. 과거 PRD의 연락처 미수집 원칙에 대한 예외는
이번 요청의 선택형 답변 주소 전달 범위로만 적용했다. docs 원문은 변경하지 않았다.

검증: 자동 테스트는 Auth/Resend를 모킹한다. 실제 비밀 값 등록, 함수 배포, 실제 수신 및
도메인 인증 확인은 별도이며 자동 테스트 통과가 이를 대신하지 않는다.

참고: https://resend.com/docs/api-reference/emails/send-email
https://resend.com/docs/dashboard/emails/idempotency-keys
