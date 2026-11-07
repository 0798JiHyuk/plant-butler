# 퀘스트 사진 확인

## 적용 근거와 범위

AGENTS.md, README.md, CLAUDE.md, docs/CONVENTIONS.md, docs/PRD.md,
docs/spec.md, docs/monday-plan.md, docs/team-parts.md와 기존 인증/저장 구현을 확인했다.
과거 문서의 Expo·서버 없음과 현재 웹/계정 저장은 다르므로 최신 코드와 사용자 요청을 따른다.
사용자가 사진 촬영 + GPT 확인 및 확인 어려울 때 재촬영/건너뛰기를 명시 요청했다.
문서에 없는 AI 판정·사진 강제를 임의 추가한 것이 아니며, 사진 없이 기존 자기보고 완료도 유지한다.
docs/**·AGENTS.md·CLAUDE.md와 기존 PRD 테이블/저장 스키마는 수정하지 않는다.

## 사용자 흐름

- 카페(cafe), 식사(meal), 낙서(draw), 화분 물 주기(water-plant), 햇빛 배치(sunlight)에 적용한다.
- 했어요 → 사진 확인 안내 → 카메라 권한 → 촬영 → 미리보기 → 제출 → 결과 → 기존 회고 → 기존 보상.
- 파일 선택/갤러리 입력은 제공하지 않는다. getUserMedia로 실시간 카메라를 캔버스에 촬영한다.
- 확인됨/관련 장면을 찾기 어려움/판단 어려움으로 표시한다. 실제 수행 시간·방문·섭취 사실을 증명하지 않는다.
- 확인이 어려움·관련 없음·API 오류에서는 다시 찍기/사진 없이 계속하기를 제공한다.
- 카메라 미지원·권한 거절·준비 지연·통신 지연 중에도 건너뛸 수 있다.
- 사진 없이 계속하기는 같은 회고/완료 규칙을 사용하며 보상을 줄이거나 지급 후 회수하지 않는다.
- 사진 결과만으로 완료 기록이나 보상을 만들지 않는다. 기존 completePlan이 중복 완료와 하루 상한을 처리한다.
- AI에 마음 상태/인격/성실성 평가, 얼굴 식별, 사진의 개인 문자 전사를 요청하지 않는다.
- 적용하지 않는 활동(산책 시간·연락·샤워 등)과 직접 계획은 기존 회고로 바로 이어진다.
- 사진 확인 중 닫기·계정 변경·진행 복원 시 요청과 카메라를 정리한다. 늦은 결과는 무시한다.
- 날짜나 계정/계획이 바뀌면 예전 촬영의 결과로 새로운 계획을 완료하지 않는다.

## 실제 서버 설정

웹 클라이언트에는 기존 공개 Supabase URL/anon 키 두 개만 둔다.
OPENAI_API_KEY를 .env의 VITE_/EXPO_PUBLIC_ 변수나 브라우저 코드에 넣지 않는다.
Supabase Dashboard의 Edge Functions Secrets에 다음을 설정한다.

- OPENAI_API_KEY: OpenAI API 프로젝트 키
- PHOTO_ALLOWED_ORIGINS: 사용할 웹 origin을 쉼표로 구분. 예: http://localhost:5173,http://127.0.0.1:5180
- OPENAI_VISION_MODEL: 선택 사항. 생략하면 gpt-4.1-mini. 공백이면 삭제해서 기본값 사용.

허용 origin은 경로와 마지막 / 없이 적는다. 실제 배포 주소도 등록한다.
SUPABASE_URL/SUPABASE_ANON_KEY는 호스팅 Edge Function의 서버 환경 값을 사용한다.
프로젝트를 확인한 뒤 로컬에서 아래 명령으로 함수만 배포한다(이번 작업에서 원격 배포는 하지 않음).

```sh
npx supabase login
npx supabase functions deploy verify-activity --project-ref YOUR_PROJECT_REF
```

supabase/config.toml의 verify_jwt=false는 gateway의 레거시 JWT 검사에 의존하지 않기 위함이다.
공개 무인증 AI 엔드포인트가 아니다. handler가 Authorization Bearer 세션을 Auth /user로
매번 검증한 뒤 OpenAI를 호출한다. 익명 인증도 유효 세션이어야 한다. 새 SQL/Storage 버킷은 필요 없다.
키나 프로젝트 권한이 없는 환경에서는 사진 확인 불가 안내 후 기존 흐름으로 계속할 수 있다.

휴대폰 카메라는 HTTPS 개발 주소 또는 배포 주소에서 확인한다.
PC localhost는 가능하지만 일반 LAN HTTP 주소에서는 브라우저 보안 정책으로 카메라가 제한될 수 있다.

## 데이터·비용·제약

- 사진은 최대 1024px JPEG로 재인코딩해 EXIF 등 원본 메타데이터를 전달하지 않는다. 최대 약 600KB.
- 사진은 React 메모리와 서버 요청 처리 중에만 사용한다. localStorage·정원 JSON·DB·Storage·분석 이벤트에 저장하지 않는다.
- 모델 요청은 Responses API의 input_image와 strict JSON schema를 사용한다. store:false.
- store:false는 OpenAI 측 모든 보관이 없다는 뜻이 아니다. 외부 전송/공급자 보관 정책은 운영 전에 검토한다.
- 사진·JWT·모델 원문·개인 계획·회고를 console/오류 로그로 남기지 않는다. UI에는 고정된 문구만 표시한다.
- 서버 고정 criterion을 사용한다. 클라이언트가 보낸 기준/지급량은 사용하지 않는다. 외부 이미지 URL도 받지 않는다.
- 입력/출력 크기 제한, 모델 응답 시간 제한, 클라이언트 중복 제출 방지가 있다.
- 서버 인스턴스당 사용자 6회/분·동시 모델 요청 4개 제한은 가벼운 MVP 보호다.
  여러 인스턴스/재시작 전체에 걸친 영구 한도는 아니며, 운영 전 공급자 예산과 공통 rate limit을 별도로 설정한다.
- 사진 속 지시문은 신뢰하지 않는다. 분류 결과는 matched/not_matched/uncertain만 허용한다.
- 현재 게임은 클라이언트 규칙/계정 snapshot 저장 방식이다. 사진 확인은 서버 재화 원장이나 부정행위 방지 기능을 대체하지 않는다.
- 카메라만 허용해도 다른 화면을 재촬영하거나 API를 직접 호출할 수 있어 실제 방문/본인 촬영을 보장하지 않는다.

## 파일과 확장 지점

- supabase/functions/_shared/photoPolicy.ts: 대상 activityId와 서버 확인 기준, 공유 응답 계약.
- src/core/photoCheck.ts: 게임에서 사용하는 공유 계약. 새 활동은 활동 데이터와 이 정책을 함께 등록한다.
- src/core/copy.ts의 photo.hints: 활동별 촬영 안내. 나머지 화면 문구도 여기서 관리한다.
- src/ui/panels/PhotoCheck.tsx, src/ui/camera.ts: 촬영·미리보기·요청 취소·재촬영·건너뛰기.
- src/lib/photoCheck.ts: 현재 세션으로 서버 함수를 호출한다. OpenAI 키/직접 호출 없음.
- supabase/functions/verify-activity: 인증·입력/출처 제한·AI 호출·응답 검증.
- src/ui/flow.ts: 사진 대상만 중간 패널을 거쳐 기존 openReflect로 연결한다.

정책은 클라이언트와 Edge Function 양쪽에서 쓰므로 기준 변경 시 웹과 함수를 함께 배포한다.
공유 TypeScript 파일의 Deno import를 검사할 수 있도록 allowImportingTsExtensions를 켰으며 noEmit은 유지한다.
새 패키지는 추가하지 않았다. 기존 package의 lint는 Edge Function도 포함한다.

## 검증과 운영 전 결정

- Vitest: 정책 대상·서버 고정 기준·인증 거부·출처 제한·이미지/크기 제한·잘못된 모델 응답·오류·요청 제한·카메라 정리·재인코딩·기존 중복 완료 규칙 검사.
- Node.js 22.23.4에서 typecheck / lint / Vitest 125개 / build 통과. Edge Function Deno check 통과.
- Chrome 844×390 모의 카메라/모의 Auth·함수 응답으로 촬영·미리보기·재촬영·확인됨/관련 없음/판단 어려움·권한 거절·서버 오류·요청 중 건너뛰기·닫기 후 트랙 종료를 검사했다.
- 화면 높이 372px 이하·44px 버튼·콘텐츠 넘침 없음, 원래 회고 뒤 완료 1회와 게임 저장에 사진 미포함을 확인했다.
- 브라우저 번들에 OPENAI_API_KEY 설정이나 OpenAI 직접 호출 엔드포인트가 없는 것을 확인했다.
- 위 모의 검증은 실제 카페 사진의 정확도·지연·비용 검증과 구분한다. 검사 스크립트/이미지는 .context/photo-smoke에 있으며 업로드 대상이 아니다.
- 실제 OpenAI 키 설정·원격 함수 배포·모델 호출, 실제 휴대폰 권한/카메라는 운영 환경에서 별도 확인해야 한다.
- 퀘스트별 인정 장면과 외부 사진 전송 문구, 공급자 보관 정책, 대상 확대는 팀 검토 대상이다.
- 기존 문서의 needs-all-approvals 및 안내 문구 검수 절차를 유지한다. 이번 작업은 커밋·병합·원격 배포하지 않는다.

공식 참고:
https://developers.openai.com/api/docs/guides/images-vision
https://developers.openai.com/api/docs/guides/structured-outputs
https://supabase.com/docs/guides/functions/auth
https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
