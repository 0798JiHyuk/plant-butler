# 식물집사 (발표용 데모)

우울증 관련 상담·치료를 마친 뒤 일상 복귀가 어려운 성인을 위한 정원 게임형 행동활성화 앱 데모.
작은 현실 행동을 고르고 해내면 그 기록이 정원에 쌓인다. 서비스 맥락과 전체 스펙은 `docs/spec.md`, 화면 참고는 `docs/reference/`.

## 명령
```bash
npm run dev     # http://localhost:5173
npm test        # Vitest, src/core 규칙·문구·통계·저장·샘플 데이터
npm run build   # tsc --noEmit + vite build
```
테스트용 주소: `/?decor`(소품 6개), `/?packet=3`(지난 3일치 씨앗 주머니), `/?fruit=20`(열매 20개), `/?seeds=5`(씨앗함에 씨앗 5개), `/?nostory`(프롤로그 건너뛰기), `/?hitbox`(소품·텃밭의 발자국과 새싹이 발을 빨강·파랑 선으로 보기). 데모 모드의 [씨앗 5개]도 같다. 데모 모드의 [샘플 채우기]가 시연용 정원을 만든다. 발표 전 `src/main.ts`에서 제거해도 된다.

## 절대 어기지 말 것 (이 앱의 설계 원칙)
- 스트릭·벌점·미완료 표시·정원 시들기/초기화 **없음**. 안 한 일은 기록하지 않는다. 해낸 것만 쌓인다.
- 칭찬 금지, **사실 피드백만**: "이번 주 집 앞 걷기 3번째예요."
- 하루 활동 최대 3개(`DAILY_LIMIT`), "오늘은 쉬기"도 정상 선택(새싹이도 같이 쉼).
- 재촉 알림·유료 요소 없음. 씨앗 주머니는 랜덤이지만(일반 꽃 55%·나무 30%·특별 15%) 꽝·재뽑기·확률 표시가 없고, 중복도 정상이며 특별 씨앗도 열매는 같다. 결정은 `docs/monday-plan.md`.
- UI 문구에 "우울/증상/치료/진단/상담" 같은 단어 금지. 말투는 존댓말, 부드럽고 짧게. 효과를 단정하는 표현도 쓰지 않는다(효과는 검증 전, 재발 예방은 주장하지 않음).
- 상담·진단·치료를 제공하지 않고, AI로 마음 상태를 판정하는 기능도 만들지 않는다. 이웃 방문·식물 나눔·하드웨어는 후속 기능이라 이번 범위 밖.
- 직접 계획 비율은 설정의 디버그 줄에서만 보여준다.

## 구조
- `src/core` — 순수 TS(규칙·데이터·저장). Phaser·DOM을 모른다. **테스트는 여기에.**
  `rules.ts`(상한·쉬기·제안·주머니·씨앗함), `economy.ts`(성장·수확·열매·상점·방문 선물함·도장판), `stats.ts`(사실 피드백), `store.ts`(단일 상태+localStorage), `demo.ts`(샘플 데이터),
  `story.ts`+`data/story.json`(이야기 장면: 프롤로그·주민 본편·서브·복귀. 열리는 순서와 하루 한 장면 규칙은 `story.ts`, 대본에서 바꾸거나 뺀 부분은 `docs/story-scenes.md`), `clock.ts`(날짜는 항상 여기서), `copy.ts`(**모든 UI 문구**).
- `src/scene` — Phaser 정원(`GardenScene`, `Player`, `map`, `assets`, `sprites`). 그래픽은 `assets.ts` 한 곳이 출입구.
  배경은 그림 한 장(1266×712), 걸을 수 있는 곳은 `map.ts`의 다각형, 소품은 32px 칸에 스냅하고, 키우는 식물은 밭 그림(`public/assets/garden/field.png`, 원본 `art/source/field-bed2.webp`)의 두둑 16곳에만 심긴다(수확한 꽃은 창고로 가고, 꺼내면 소품처럼 마당 칸에 놓는다. 열매나무는 마당 칸에 심고 남아서 다시 맺는다. `economy.placeZone`. 나무 그림은 임시이고 `tools/make_tree_placeholders.py`가 만든다). 식물 칸 번호는 (100+열, 100+행)이고 위치는 `map.ts`의 `MOUNDS`가 정한다. 밭 그림을 바꾸면 `MOUNDS`(그림 속 두둑 좌표)와 `DEFAULT_BED`(처음 자리·크기)를 다시 맞춰야 한다. 텃밭은 꾸미기에서 끌어 옮길 수 있고(`bedFits`가 놓을 수 있는 곳을 판단, 자리는 `garden.bed`에 저장) 식물은 두둑 번호로 저장되어 텃밭을 따라 움직인다. 코드에서 텃밭 위치는 상수가 아니라 `BED`(바뀌는 값)를 쓸 것.
  못 지나가는 곳과 앞뒤(그리는 순서)는 `footprints.ts`의 **발자국**(소품·텃밭이 땅에 닿은 자리)이 정한다. 소품 그림을 바꾸면 `FOOTPRINTS`를 그림에 맞춰 다시 재고 `?hitbox`로 겹쳐 확인한다. 새싹이·주민의 앞뒤는 `GardenScene.standDepth`가 발자국 기준으로 매 프레임 정하고, 소품이 새싹이 위에 놓이면 앞쪽 빈자리로 폴짝 비켜선다(`Player.hopOutIfStuck`).
  꾸미기: 소품·식물을 짚으면 아래쪽 메뉴([옮기기]·[방향 바꾸기]·[창고에 넣기], `Decorate.tsx`의 `SelectBar` ↔ 씬은 `decor-select`·`decor-action` 이벤트)가 뜨고, 끌어서 바로 옮길 수도 있다. 마당에서는 놓일 발자국이 텃밭·다른 소품·나무 줄기·장식 꽃과 겹치면 놓지 않는다(`canPlace`, 끄는 동안 초록·빨강 발자국으로 미리 보여 줌). 좌우 방향은 `DecorItem.flip`(창고에 넣었다 꺼내도 유지).
- `src/ui` — **React** 오버레이. `App.tsx`가 뿌리, `Hud.tsx`(정원 위 화면), `modal.tsx`(`openModal(<패널/>)`·`closeModal()`), `toast.tsx`, `panels/`(활동·기록·설정·상점·선물·대화·주머니·꾸미기 등 패널 하나가 파일 하나, `Bag.tsx`는 가진 것(씨앗·소품·식물), `Records.tsx`는 쌓아 온 것(기록·도감·출석). 분류 기준은 `docs/ux-research.md`). 화면 사이의 흐름은 `flow.ts`. 상태는 `useAppState()`로 읽고 `store.update()`로 바꾼다.
- core·scene·ui는 서로 직접 부르지 않고 `core/events.ts` 이벤트로 대화한다.

## 그림(아트) 규칙
- 그림체의 기준은 팀 가이드 **`art/guide/`** (STYLE_GUIDE.md, production_rules.json, 기준 PNG). 기본 테마는 **A 나무 그늘 마당**이고, A/B/C 건축을 섞지 않는다.
  새 그림을 만들 땐 가이드의 기준 원본을 함께 쓰고, 원본(`art/guide/*.png`)은 덮어쓰지 않는다. 새싹이는 잎 2장·짧은 팔·초록 발 등 가이드의 고정 규칙을 따른다.
- 게임이 쓰는 이미지는 `public/assets/` 에 있고, **직접 고치지 말고** `python3 tools/slice_art.py` 로 `art/` 원본에서 다시 만든다.
- 걸을 수 있는 영역(`map.ts`의 `WALK`)은 손으로 그린 다각형이다. 배경을 바꾸면 다시 그려 겹쳐 확인해야 한다.
- 화면 확인: `npm run build` 후 `node tools/screenshot.mjs <출력폴더> tools/screenshot.steps.example.json file://$PWD/dist/index.html` — 헤드리스 Chrome이 버튼을 눌러 가며 화면별 PNG를 만든다(브라우저 패널은 localhost를 못 열었다).
- 아이콘·프레임 스킨은 `src/styles/art.css`(뼈대는 `overlay.css`). 프레임 이미지는 `src/assets/ui/`, 아이콘은 `public/assets/{icons-ui,activities,plants}`.
- `legacy/tilemap-scene/` 은 이전 타일맵 방식의 장면 코드 백업이다(빌드 대상 아님).

## 작업 규칙
- 문구를 바꾸거나 더할 땐 `core/copy.ts`에만. `FORBIDDEN_WORDS` 테스트(`tests/copy.test.ts`)를 통과해야 한다.
  함수형 문구(`weekNth` 등)는 테스트에 호출 예를 추가해 검사한다.
- 규칙을 바꾸면 `src/tests/`에 먼저 테스트를 쓴다. 날짜 계산은 `clock.ts`(데모 모드의 날짜 넘기기가 거기에 의존).
- 저장된 상태 모양을 바꾸면 `store.ts`의 `loadState`가 이전 저장본을 기본값으로 채우는지 확인한다.
- 화면은 가로 844 고정, 세로는 창 비율에 맞춰 390~563으로 늘어난다(`main.ts`의 `layout()`, CSS 변수 `--stage-h`). 고정 높이 390을 가정하는 코드를 쓰지 말고 `cam.height`·`game.scale.height`를 쓸 것.
- 새 패널은 `panels/`에 컴포넌트와 `openXxx()`를 함께 만들고 `flow.ts`에서 부른다. 패널끼리 직접 부르지 않는다(대화 끝의 이어짐은 `talkActions`처럼 flow가 채운다).
- 모든 버튼은 44px 이상, 844×390에서 스크롤 없이 한 화면. 패널 높이는 372px 안(활동 패널이 가장 빠듯함).
- 텍스트 입력 중에는 Phaser 키보드 가로채기를 끈다(`GardenScene.setLocked`). 새 입력창을 만들면 같은 모달 경로를 쓸 것.

## 알려진 한계
- 정원 배경·새싹이·소품은 팀 가이드(A 테마) 그림이다. 새싹이는 팀 가이드 그림이 아니라 새로 올린 기준 그림(`art/source/sprout2-*`, 굵은 갈색 윤곽)이다. 앞·뒤·옆 걷기 4프레임과 점프 4프레임이 있고 왼쪽은 옆모습을 뒤집어 쓴다. 쉬는 모습만 다른 그림체(가는 윤곽)라 다시 뽑아야 한다. 주민 3종(`art/source/npc-*.webp`)과 정원 아이콘(`icons-garden.webp`)은 ChatGPT로 만든 임시 그림이다. 도감 식물 12종과 UI 아이콘·프레임(`public/assets/plants|icons-ui|activities|ui`)은 ChatGPT로 만든 별도 그림이라 가이드 그림체와 완전히 같지 않다. UI 아이콘·프레임은 화면에 적용되어 있다. 효과음은 파일 없이 합성한다(`ui/sound.ts`).
- "실제 식물 관찰" 기능, 오프라인 캐시는 만들지 않았다.
- 이 프로젝트는 홈 폴더 git 저장소 안에 있다. 커밋은 사용자가 요청할 때만.
- 개발 중 브라우저 패널로 localhost를 열 수 없어 화면은 사용자가 직접 확인했다. 레이아웃·드래그를 건드렸다면 사람 확인이 필요하다고 말할 것.
