# 미션 1단계: 카드 루프 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팀 미션 90개 중 1~4단계 60개로 "영역 → 장면 → 카드 한 장 → 했어 → 여기까지 / 더 해 볼래 → 표지판" 루프를 만들고, 보상을 "회차마다 씨앗 1개(하루 3회차)"로 바꾼다. 지금의 활동 화면(탭 3개)은 이 흐름과 "내가 직접 만들래"로 바뀐다.

**Architecture:** 팀 원본 JSON을 `tools/import_missions.py`가 게임용 `src/core/data/missions.json`으로 옮긴다. 추천 규칙(거르기·첫 카드·더 해 볼래·다른 걸 할래·표지판)은 `src/core/missions.ts`, 회차·씨앗·하루 상한·쉬기는 `src/core/rules.ts`(둘 다 순수 함수, Vitest). 화면은 `src/ui/panels/Mission.tsx`(모달 하나 안에서 영역·장면·카드·다음 길·끝 화면을 바꿔 보여 준다)와 `Direct.tsx`(내가 직접 만들래), 정원 위 카드(`Hud.tsx`)와 회고(`Reflect.tsx`)를 넓히고, 화면 사이의 이어짐은 `flow.ts`가 맡는다.

**Tech Stack:** Vite + TypeScript(strict) + React 18 + Phaser 3.90 + Vitest, Python 3(가져오기 스크립트). 화면 확인은 `tools/screenshot.mjs`(헤드리스 Chrome).

**Spec:** `docs/superpowers/specs/2026-11-09-missions-card-loop-design.md` (원본: `docs/missions/틈새정원_미션최종안_2026-11-08.md`, `docs/missions/틈새정원_90개미션_게임적용데이터_2026-11-08_v2.json`)

## Global Constraints

- 작업 폴더: 저장소 루트(`식물집사/`, 브랜치 `chore/web-demo`). 명령: `npm test`, `npx vitest run <파일>`, `npm run build`(= `tsc --noEmit` + vite build).
- 화면 확인 사진은 저장소 밖 임시 폴더에 둔다. 아래 명령의 `$SHOTS`는 그 폴더(세션 스크래치패드 등)이고, 단계 파일(`task4.steps.json` 등)도 거기에 쓴다. 문서에 개인 경로를 적지 않는다.
- **커밋은 사용자가 요청할 때만.** 이 계획에는 커밋 단계가 없다. `docs/greentherapy/`는 커밋하지 않는다(공개 저장소, 협력 기관 실명).
- 설계 원칙: 스트릭·벌점·미완료 표시·시들기 없음. 안 한 일은 기록하지 않는다. 칭찬 대신 사실("이번 주 ○○ n번째예요"). 쉬기는 정상 선택이고 잃는 것이 없다. 앱은 마음 상태를 판정하지 않는다. 조건 키(36개)를 처음에 묻지 않는다.
- 씨앗: 회차를 닫을 때 해낸 행동이 1개 이상이면 1개(회차당 한 번). 쉬기·계획만 세우기·영역/장면 고르기는 0개. 하루에 마치는 회차는 최대 3개(`DAILY_LIMIT = 3`).
- 추천은 4단계까지(`MAX_STAGE = 4`). 추천 단계는 "다음 길을 볼래"를 고를 때만 오르고 내려가지 않는다. 5~6단계 데이터는 가져오되 추천하지 않는다.
- 문구는 `src/core/copy.ts`에만(주민 말은 반말·짧게, 앱 안내는 존댓말). 카드 내용은 데이터 파일. 둘 다 `FORBIDDEN_WORDS` 검사를 통과해야 하고, 함수형 문구는 `copy.test.ts`에 호출 예를 넣는다.
- 화면 844×390: 패널 안쪽 높이 약 358px(`.panel` max-height 388px, 테두리 14px), 모든 버튼 44px 이상(`--tap`). 패널끼리 직접 부르지 않는다(`missionLinks`·`directLinks`·`chatActions`를 `flow.ts`가 채운다).
- 날짜는 `src/core/clock.ts`의 `todayKey()`만. 저장 모양을 바꾸면 `loadState`가 예전 저장본을 기본값으로 채우는지 테스트한다.
- 예전 저장본: 옛 활동 계획(`days[오늘].plan.activityId`)은 그대로 끝낼 수 있고, 하루 봉투(`days[].packet === 'ready'`)는 그대로 열 수 있다. 옛 활동 16개는 기록 표시에만 남긴다.

## 설계에서 구체화한 점 (Task 6에서 설계 문서에 적는다)

1. 장면은 영역별로 기억한다: `intent: string | null` 대신 `intents: Partial<Record<CategoryId, string>>`. 영역을 바꿨다 돌아와도 음료 흐름이 이어진다.
2. "해당 없어요"는 그날만 적용한다: `notApplicable: string[]` 대신 `skip: { date, facts, cards }`. 조건(컵이 있는지 등)은 날마다 바뀌어서, 영구히 빼면 카드가 다시 나오지 않는다. 누른 카드 자체도 그날 뺀다(줄인 행동에 조건이 없는 카드도 뺄 수 있게).
3. `done` 칸은 가져오지 않는다. 일상은 "기본 / 축소" 짧은 말이지만 학업·업무는 설명 문장이라 버튼에 쓸 수 없다. 버튼은 `completion.buttonLabel`("했어").
4. 회차의 행동 목록에서 `missionId`는 선택이다(직접 적은 일과 예전 활동도 같은 회차 규칙).
5. "여기서 더 해 볼래"(단계 전환·4단계 끝)는 같은 카드를 다시 보여 준다. 같은 단계의 다른 카드는 그 카드의 [다른 걸 할래]로 간다.
6. 해낸 행동이 있는 회차가 열려 있으면 카드의 [오늘은 쉴래] 자리에 [여기까지]가 나온다. 정원 위 카드는 계획 없이 회차만 열려 있으면 "한 걸음 남겼어요 [더 해 볼래] [여기까지]".
7. 지난 날 열어 둔 회차는 앱을 열 때(또는 다음 계획을 세울 때) 그날 것으로 정산한다(해낸 행동이 있었으면 씨앗은 받는다).
8. 프롤로그 끝 영역 묻기: 첫 선물(봉투 열기·심기)과 여력 체크가 끝나 화면이 비었을 때 한 번. "정원 먼저 둘러보기"를 고르면 다시 묻지 않고, 처음 [미션 해보기]를 누를 때 묻는다.
9. 일상 장면을 건너뛰면(미리보기) 일상의 장면을 지운다(이전 장면이 미리보기를 거르지 않게).
10. 표지판 카드를 고르면 표지판은 쓴 것으로 지운다.

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `tools/import_missions.py` (새로) | 원본 JSON → `src/core/data/missions.json`(필요한 칸만, 주민 이름 → id) |
| `src/core/data/missions.json` (새로, 생성물) | 미션 90개 + 첫 미션 표 |
| `src/core/missions.ts` (새로) | 데이터(`MISSIONS`·`FIRST`·`missionById`), 거르기(`fits`·`eligibleVariants`·`preferred`), 다음 카드(`moreAfter`·`lastStep`), `alternatives`, `previewCards`, `startCard`, `bookmarkSuggestion`, 고르기(`chooseArea`·`chooseWorkStatus`·`chooseIntent`·`chooseMission`·`markNotApplicable`·`advanceStage`·`saveBookmark`), 문장(`actionText`·`recordText`) |
| `src/core/types.ts` (수정) | `CategoryId`·`Variant`·`WorkStatus`·`MissionStep`·`MissionSession`·`MissionState`, `Plan`·`LogEntry`·`DayInfo`·`AppState` 칸 추가 |
| `src/core/store.ts` (수정) | `createMissionState`, 기본값·예전 저장본 병합 |
| `src/core/rules.ts` (수정) | 회차(`closeSession`·`settleOldSession`·`sessionsDone`·`sessionHasActions`), `limitReached`·`chooseRest`·`setPlan` 새 규칙, `reportAction`(옛 `completePlan` 대신), `openSessionPacket`. Task 4에서 옛 제안 함수 삭제 |
| `src/core/economy.ts` (수정) | 나무 다시 맺기: 회차를 마친 날·쉬는 날·예전 주머니 받은 날을 센다 |
| `src/core/stats.ts` (수정) | `logName`, 카드 기록 기준 사실 문장 |
| `src/core/demo.ts` (수정) | 샘플을 미션 카드·회차로 |
| `src/core/copy.ts` (수정) | `mission` 묶음, 카드·회고 문구, 옛 탭 문구 삭제 |
| `src/core/events.ts` (수정) | `HudAction` 바꾸기 |
| `src/core/activities.ts` (수정) | `smallerOf` 삭제(옛 활동은 기록 표시용) |
| `src/ui/panels/Mission.tsx` (새로) | 카드 흐름 모달, `openMission`·`openMore`·`openBookmark`·`MissionFace`·`missionLinks` |
| `src/ui/panels/Direct.tsx` (새로) | 내가 직접 만들래, `openDirect`·`directLinks` |
| `src/ui/panels/ActivityPanel.tsx`, `PlanDetail.tsx` (지움) | 카드 흐름이 대신 |
| `src/ui/Hud.tsx` (수정) | 정원 위 카드: 고른 행동·[했어]·[다른 걸 할래]·회차 중 상태 |
| `src/ui/panels/Reflect.tsx` (수정) | 칩 + [여기까지]·[더 해 볼래] |
| `src/ui/panels/Records.tsx` (수정) | 카드 기록 표시(주민 얼굴·기록 문장) |
| `src/ui/panels/Packet.tsx` (수정) | 회차 주머니(`sessionPackets`) 열기 |
| `src/ui/panels/Decorate.tsx` (수정) | `isDecorating()` |
| `src/ui/flow.ts` (수정) | 카드 흐름 잇기, 회차 닫기·표지판, 이야기 뒤 이어짐, 프롤로그 끝 영역 묻기 |
| `src/styles/overlay.css`, `art.css` (수정) | 카드 모양, 쓰지 않게 된 활동 패널 스타일 삭제 |
| `src/tests/missions.test.ts` (새로), `rules`·`store`·`economy`·`stats`·`demo`·`copy` 테스트 (수정) | 규칙·저장본·문구 |
| `tools/screenshot.steps.example.json` (수정) | 새 흐름으로 |
| `CLAUDE.md`, 설계 문서 (수정) | 구조·원칙·구체화한 점 |

---

### Task 1: 미션 데이터 가져오기

**Files:**
- Create: `tools/import_missions.py`
- Create (생성): `src/core/data/missions.json`
- Modify: `src/core/types.ts` (맨 위 타입 3개)
- Create: `src/core/missions.ts` (데이터 부분)
- Create: `src/tests/missions.test.ts`

**Interfaces:**
- Produces: `type CategoryId = 'daily' | 'academic' | 'work'`, `type Variant = 'basic' | 'small'`, `type WorkStatus = 'pre_return' | 'returned' | 'unknown'`(types.ts), `interface Mission`, `interface SceneChoice`, `MISSIONS: Mission[]`, `FIRST`, `MAX_STAGE = 4`, `missionById(id: string | null | undefined): Mission | undefined`(missions.ts)

- [ ] **Step 1: 실패하는 데이터 검사 테스트를 쓴다** — `src/tests/missions.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_WORDS } from '../core/copy';
import { FIRST, MISSIONS, missionById, type Mission } from '../core/missions';

/** 화면에 나오는 글 */
const shown = (m: Mission) => [m.name, m.stageName, m.dialogue, m.basic, m.small, m.record, m.smallRecord, m.conditionSummary, m.buttonLabel];

describe('미션 데이터', () => {
  it('영역마다 30개, 단계마다 15개이고 ID가 겹치지 않는다', () => {
    expect(MISSIONS).toHaveLength(90);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(90);
    for (const c of ['daily', 'academic', 'work'] as const) expect(MISSIONS.filter((m) => m.categoryId === c)).toHaveLength(30);
    for (let st = 1; st <= 6; st++) expect(MISSIONS.filter((m) => m.stage === st)).toHaveLength(15);
  });

  it('다음 후보와 첫 미션 표의 ID가 모두 있다', () => {
    for (const m of MISSIONS) if (m.nextId) expect(missionById(m.nextId), m.id).toBeDefined();
    const firsts = [
      ...FIRST.daily.scenes.map((s) => s.missionId), ...FIRST.daily.previews, FIRST.academic.missionId,
      ...FIRST.work.pre_return.map((s) => s.missionId), ...FIRST.work.returned.map((s) => s.missionId),
    ];
    for (const id of firsts) expect(missionById(id), id).toBeDefined();
  });

  it('주민 이름은 게임 id로 바뀌어 있고, 1~4단계 카드는 느리·모루·피오가 말한다', () => {
    for (const m of MISSIONS) expect(['nuri', 'moru', 'pio', 'sprout']).toContain(m.npc);
    for (const m of MISSIONS.filter((x) => x.stage <= 4)) expect(['nuri', 'moru', 'pio']).toContain(m.npc);
  });

  it('화면에 나오는 글에 금지 표현이 없다', () => {
    const labels = [...FIRST.daily.scenes, ...FIRST.work.pre_return, ...FIRST.work.returned].map((s) => s.label);
    const texts = [...MISSIONS.flatMap(shown), ...labels, ...FIRST.academic.targets.map((t) => t.label)];
    for (const t of texts) for (const w of FORBIDDEN_WORDS) expect(t).not.toContain(w);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/tests/missions.test.ts`
Expected: FAIL — `Failed to resolve import "../core/missions"`

- [ ] **Step 3: 가져오기 스크립트를 쓴다** — `tools/import_missions.py`

```python
#!/usr/bin/env python3
"""팀 미션 원본(JSON, schemaVersion 2)에서 게임이 쓰는 칸만 골라 src/core/data/missions.json으로 쓴다.

사용: python3 -I tools/import_missions.py docs/missions/틈새정원_90개미션_게임적용데이터_2026-11-08_v2.json
팀이 원본을 고치면 다시 돌린다. 화면에 쓰지 않는 칸(evidenceCodes·why 등)은 원본에만 남는다.
done 칸은 영역마다 형식이 달라(일상은 '기본 / 축소', 학업·업무는 설명 문장) 가져오지 않는다. 버튼은 buttonLabel.
"""
import json
import sys
from pathlib import Path

NPC = {'느리': 'nuri', '모루': 'moru', '피오': 'pio', '새싹이': 'sprout'}
ACADEMIC_INTENT = {'수업 자료': 'course', '과제 자료': 'assignment', '시험 자료': 'exam'}
OUT = Path(__file__).resolve().parent.parent / 'src' / 'core' / 'data' / 'missions.json'


def mission(m):
    e = m['eligibility']
    return {
        'id': m['id'],
        'categoryId': m['categoryId'],
        'stage': m['stage'],
        'stageName': m['stageName'],
        'intentIds': m['intentIds'],
        'npc': NPC[m['npc']],
        'dialogue': m['dialogue'],
        'name': m['name'],
        'basic': m['basic'],
        'small': m['small'],
        'buttonLabel': m['completion']['buttonLabel'],
        'record': m['record'],
        'smallRecord': m['smallRecord'],
        'conditionSummary': m['conditionSummary'],
        'allowedWorkStatuses': e['allowedWorkStatuses'],
        'basicFacts': e['basicRequiredFacts'],
        'smallFacts': e['smallRequiredFacts'],
        'mode': m['mode'],
        'nextId': m['recommendation']['nominalNextId'],
    }


def first(f):
    daily, academic, work = f['일상'], f['학업'], f['업무복귀']
    return {
        'daily': {
            'scenes': [{'label': k, 'missionId': v} for k, v in daily['choices'].items()],
            'previews': daily['fallbackPreviews'],
        },
        'academic': {
            'missionId': academic['default'],
            'targets': [{'label': t, 'intent': ACADEMIC_INTENT[t]} for t in academic['targetChoices']],
        },
        'work': {
            'pre_return': [{'label': k, 'missionId': v} for k, v in work['beforeReturn'].items()],
            'returned': [{'label': k, 'missionId': v} for k, v in work['afterReturn'].items()],
        },
    }


def main(src):
    data = json.loads(Path(src).read_text(encoding='utf-8'))
    if data.get('schemaVersion') != 2:
        sys.exit(f"schemaVersion 2만 읽을 수 있어요: {data.get('schemaVersion')}")
    out = {
        'version': data['version'],
        'first': first(data['firstRecommendations']),
        'missions': [mission(m) for m in data['missions']],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f"{len(out['missions'])}개 미션 -> {OUT}")


if __name__ == '__main__':
    main(sys.argv[1])
```

Run: `python3 -I tools/import_missions.py docs/missions/틈새정원_90개미션_게임적용데이터_2026-11-08_v2.json`
Expected: `90개 미션 -> .../src/core/data/missions.json`

- [ ] **Step 4: 타입 3개를 `src/core/types.ts` 맨 위(import 다음 줄)에 더한다**

```ts
/** 미션 영역: 일상·학업·업무복귀 */
export type CategoryId = 'daily' | 'academic' | 'work';
/** 카드의 두 크기: 기본 행동·줄인 행동 */
export type Variant = 'basic' | 'small';
/** 업무복귀: 복귀 전·복귀 후·모름. W06~W20(실무)은 복귀 후에만 추천한다. */
export type WorkStatus = 'pre_return' | 'returned' | 'unknown';
```

- [ ] **Step 5: 데이터 모듈을 만든다** — `src/core/missions.ts`

```ts
// 팀 미션 90개(일상·학업·업무복귀 × 6단계)를 고르고 잇는 규칙. 원본은 docs/missions/,
// 게임용 데이터(data/missions.json)는 tools/import_missions.py가 만든다. 이번엔 1~4단계 카드만 추천한다.
import raw from './data/missions.json';
import type { Speaker } from './story';
import type { CategoryId, WorkStatus } from './types';

export interface Mission {
  id: string;
  categoryId: CategoryId;
  stage: number;
  stageName: string;
  /** 장면(drink·exam 등). all이면 그 영역의 모든 장면에 맞는다. */
  intentIds: string[];
  npc: Speaker;
  dialogue: string;
  name: string;
  /** 기본 행동과 줄인 행동 */
  basic: string;
  small: string;
  buttonLabel: string;
  /** 수첩에 남는 기록 문장 */
  record: string;
  smallRecord: string;
  conditionSummary: string;
  /** 비어 있으면 복귀 상태와 상관없다. W06~W20은 복귀 후(returned)만. */
  allowedWorkStatuses: WorkStatus[];
  /** 그 크기를 하는 데 필요한 조건 키. 처음엔 모두 모른다(묻지 않고 카드에 조건을 보여 준다). */
  basicFacts: string[];
  smallFacts: string[];
  mode: 'activity' | 'create_and_execute' | 'plan_and_execute' | 'day_and_execute';
  /** 정렬용 다음 번호. 바로 실행하지 않고, 거르기를 통과하는 다음 카드를 찾을 때만 쓴다. */
  nextId: string | null;
}

export interface SceneChoice {
  label: string;
  missionId: string;
}

interface MissionData {
  version: string;
  first: {
    daily: { scenes: SceneChoice[]; previews: string[] };
    academic: { missionId: string; targets: { label: string; intent: string }[] };
    work: { pre_return: SceneChoice[]; returned: SceneChoice[] };
  };
  missions: Mission[];
}

const data = raw as unknown as MissionData;
export const MISSIONS: Mission[] = data.missions;
/** 영역별 첫 미션 표(원본 firstRecommendations) */
export const FIRST = data.first;
/** 이번엔 4단계까지만 추천한다(5~6단계는 미션 편집기·내 하루 지도와 함께). */
export const MAX_STAGE = 4;

export function missionById(id: string | null | undefined): Mission | undefined {
  return id ? MISSIONS.find((m) => m.id === id) : undefined;
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/tests/missions.test.ts && npm run build`
Expected: 4 passed, 빌드 성공

---

### Task 2: 회차와 씨앗 (상태·규칙)

**Files:**
- Modify: `src/core/types.ts`, `src/core/store.ts`, `src/core/rules.ts`, `src/core/economy.ts`, `src/core/stats.ts`, `src/core/demo.ts`
- Modify: `src/ui/panels/Packet.tsx`, `src/ui/flow.ts`
- Test: `src/tests/rules.test.ts`(전체 다시 씀), `src/tests/store.test.ts`, `src/tests/economy.test.ts`, `src/tests/stats.test.ts`, `src/tests/demo.test.ts`

**Interfaces:**
- Consumes: `missionById` (Task 1)
- Produces (types.ts): `MissionStep { missionId: string; variant: Variant }`, `MissionSession { id; date; actions: { missionId?: string; variant?: Variant }[] }`, `MissionState`, `Plan.missionId?/variant?`, `LogEntry.missionId?/variant?/sessionId?`, `DayInfo.sessions?`, `AppState.missions`, `AppState.sessionPackets`
- Produces (store.ts): `createMissionState(): MissionState`
- Produces (rules.ts): `DAILY_LIMIT`(마치는 회차 수), `sessionsDone(state, date): number`, `sessionHasActions(state, date): boolean`, `limitReached(state, date): boolean`, `closeSession(draft): { seeded: boolean }`, `settleOldSession(draft, today): void`, `chooseRest(draft, date)`, `setPlan(draft, date, plan): boolean`, `reportAction(draft, date, chips): { log: LogEntry } | null`, `openSessionPacket(draft, rand?): SeedItem | null`. `completePlan`·`grantPacket`·`doneCount`는 지운다.
- Produces (stats.ts): `logName(log: LogEntry): string`

이 태스크가 끝나면 앱은 지금 화면(옛 활동 패널) 그대로 돌아가고, [했어요]마다 회차가 열리고 닫혀 씨앗 1개를 받는다(하루 3개까지). 카드 흐름은 Task 4~5.

- [ ] **Step 1: 저장본 테스트를 더한다** — `src/tests/store.test.ts`

import 줄을 `import { createMissionState, loadState, store } from '../core/store';`로 바꾸고, 마지막 `it` 뒤에 더한다:

```ts
  it('예전 저장본에 미션 상태가 없으면 기본값으로, 단계는 칸별로 채운다', () => {
    store.update((d) => {
      delete (d as { missions?: unknown }).missions;
      delete (d as { sessionPackets?: unknown }).sessionPackets;
    });
    expect(loadState().missions).toEqual(createMissionState());
    expect(loadState().sessionPackets).toBe(0);
    store.update((d) => {
      d.missions = { ...createMissionState(), stage: { daily: 3 } as never };
    });
    expect(loadState().missions.stage).toEqual({ daily: 3, academic: 1, work: 1 });
  });
```

- [ ] **Step 2: 규칙 테스트를 다시 쓴다** — `src/tests/rules.test.ts` 전체를 아래로 바꾼다(옛 활동 제안 테스트는 Task 4에서 지운다. 쉬기 대신 예전 하루 봉투로 씨앗을 만든다).

```ts
import { describe, expect, it } from 'vitest';
import { activities } from '../core/activities';
import {
  chooseRest, closeSession, DAILY_LIMIT, designPlan, flipDecor, limitReached, makeSmaller, openPacket, openSessionPacket, pastItems,
  pendingPacketCount, pendingPacketDates, plantSeed, reportAction, sessionHasActions, setEnergy, setPlan, settleOldSession, storeDecor,
  storePlant, suggest, swapCandidate, tabHints, takeFromStorage,
} from '../core/rules';
import { plants } from '../core/plants';
import { rng } from '../core/random';
import { createState } from '../core/store';
import type { Plan } from '../core/types';

const D = '2026-10-26';
/** 예전 활동으로 세운 계획(예전 저장본에 남아 있을 수 있다). 미션 카드는 missions.test.ts에서 본다. */
const plan: Plan = { activityId: 'walk5', info: { when: '지금', where: '집 근처', minutes: 5 }, source: 'mission' };
type S = ReturnType<typeof createState>;
/** 예전 저장본의 하루 봉투 */
const ready = (s: S, date: string) => {
  s.days[date] = { refresh: 0, packet: 'ready' };
};
/** 계획을 세우고 [했어]까지(회차는 열어 둔다) */
const doOne = (s: S, date = D) => {
  expect(setPlan(s, date, plan)).toBe(true);
  return reportAction(s, date, [])!;
};
const openAndPlant = (s: S, date: string, slot: { col: number; row: number }, r?: () => number) => {
  const seed = openPacket(s, date, r);
  return seed && plantSeed(s, seed.id, date, slot);
};

describe('rules', () => {
  it('쉬기는 기록을 남기지 않고 계획만 내려놓는다', () => {
    const s = createState();
    setPlan(s, D, plan);
    chooseRest(s, D);
    expect(s.days[D].rested).toBe(true);
    expect(s.days[D].plan).toBeUndefined();
    expect(s.logs).toHaveLength(0);
  });

  it('계획을 세우면 쉬기가 풀린다', () => {
    const s = createState();
    chooseRest(s, D);
    setPlan(s, D, plan);
    expect(s.days[D].rested).toBe(false);
  });

  it('계획 없이는 [했어]를 누를 수 없다', () => {
    expect(reportAction(createState(), D, [])).toBeNull();
  });

  it('무거운 날은 1~2분짜리만 제안한다', () => {
    const s = createState();
    setEnergy(s, D, 'heavy');
    const list = suggest(s, D);
    expect(list.length).toBeGreaterThan(0);
    for (const a of list) expect(a.minutes).toBeLessThanOrEqual(2);
  });

  it('보통인 날은 서로 다른 종류를 3개 제안한다', () => {
    const s = createState();
    const list = suggest(s, D);
    expect(list).toHaveLength(3);
    expect(new Set(list.map((a) => a.kind)).size).toBe(3);
  });

  it('바꾸기는 보이는 것과 겹치지 않는 후보를 준다', () => {
    const s = createState();
    const shown = suggest(s, D);
    expect(shown.some((a) => a.id === swapCandidate(s, D, shown)!.id)).toBe(false);
  });

  it('더 작게는 끝까지 줄어들고 순환하지 않는다', () => {
    for (const a of activities) {
      let cur = a;
      for (let steps = 0; steps < 10; steps++) {
        const next = makeSmaller(cur);
        if (!next) break;
        expect(next.minutes).toBeLessThan(cur.minutes);
        cur = next;
      }
      expect(makeSmaller(cur)).toBeUndefined();
    }
  });

  it('직접 계획은 글이 비어 있으면 만들 수 없다', () => {
    expect(designPlan('  ', '지금', '')).toBeNull();
    expect(designPlan('공원 다녀오기', '오후 3시', '입구까지')).toMatchObject({
      text: '공원 다녀오기', source: 'design', info: { when: '오후 3시', criterion: '입구까지' },
    });
  });

  it('해본 활동은 최근 순, 중복 없이 일상 연결에 나온다', () => {
    const s = createState();
    for (const [date, p] of [['2026-10-20', plan], ['2026-10-21', designPlan('공원', '지금', '')!], ['2026-10-22', plan]] as const) {
      setPlan(s, date, p);
      reportAction(s, date, []);
    }
    expect(pastItems(s).map((i) => i.label)).toEqual(['집 앞 5분 걷기', '공원']);
  });

  it('탭은 잠기지 않고 기록이 쌓이면 힌트만 켜진다', () => {
    const s = createState();
    expect(tabHints(s)).toEqual({ daily: false, design: false });
    for (let i = 0; i < 3; i++) {
      setPlan(s, `2026-10-2${i}`, plan);
      reportAction(s, `2026-10-2${i}`, []);
    }
    expect(tabHints(s)).toEqual({ daily: true, design: false });
  });

  it('주머니를 열면 랜덤 씨앗 하나가 심기고, 같은 식물이 또 나와도 정상이다', () => {
    const s = createState();
    const r = rng(7);
    const ids: string[] = [];
    for (let i = 0; i < 60; i++) {
      const date = `2026-11-${String((i % 28) + 1).padStart(2, '0')}-${i}`;
      s.days[date] = { refresh: 0, packet: 'ready' };
      const planted = openAndPlant(s, date, { col: i % 40, row: 3 }, r)!;
      expect(plants.some((p) => p.id === planted.plantId)).toBe(true);
      ids.push(planted.plantId);
    }
    expect(new Set(ids).size).toBeLessThan(ids.length); // 60번 뽑으면 반드시 중복이 있다
    expect(s.garden.plants).toHaveLength(60);
  });

  it('주머니를 열면 씨앗은 씨앗함에 들어가고, 심기 전에는 정원에 없다', () => {
    const s = createState();
    ready(s, D);
    const seed = openPacket(s, D)!;
    expect(s.seeds).toEqual([seed]);
    expect(s.garden.plants).toHaveLength(0);
    expect(pendingPacketDates(s)).toEqual([]);
  });

  it('심으면 씨앗함에서 빠지고, 성장은 주머니를 받은 날이 아니라 심은 날부터다', () => {
    const s = createState();
    ready(s, D);
    const seed = openPacket(s, D)!;
    const planted = plantSeed(s, seed.id, '2026-11-10', { col: 101, row: 100 })!;
    expect(planted).toMatchObject({ plantId: seed.plantId, date: '2026-11-10', col: 101, row: 100 });
    expect(s.seeds).toHaveLength(0);
    expect(s.garden.plants).toEqual([planted]);
  });

  it('자리가 없거나 없는 씨앗이면 심지 않고 씨앗은 그대로 남는다', () => {
    const s = createState();
    ready(s, D);
    const seed = openPacket(s, D)!;
    expect(plantSeed(s, seed.id, D, null)).toBeNull();
    expect(plantSeed(s, 'nope', D, { col: 100, row: 100 })).toBeNull();
    expect(s.seeds).toEqual([seed]);
    expect(s.garden.plants).toHaveLength(0);
  });

  it('씨앗함의 씨앗은 며칠이 지나도 사라지지 않고 서로 구분된다', () => {
    const s = createState();
    for (const d of ['2026-11-01', '2026-11-02']) {
      ready(s, d);
      openPacket(s, d);
    }
    expect(s.seeds).toHaveLength(2);
    expect(new Set(s.seeds.map((x) => x.id)).size).toBe(2);
    plantSeed(s, s.seeds[0].id, '2026-12-01', { col: 100, row: 100 });
    ready(s, '2026-12-01');
    openPacket(s, '2026-12-01');
    expect(new Set(s.seeds.map((x) => x.id)).size).toBe(2);
  });

  it('이미 연 봉투는 다시 열 수 없다', () => {
    const s = createState();
    ready(s, D);
    expect(openPacket(s, D)).not.toBeNull();
    expect(openPacket(s, D)).toBeNull();
    expect(s.seeds).toHaveLength(1);
  });

  it('소품을 창고로 치우면 정원에서는 사라지고 창고에 쌓인다', () => {
    const s = createState();
    const item = { id: 'decor-1', kind: 'bench' as const, variant: 0, col: 4, row: 4 };
    s.garden.items.push(item);
    storeDecor(s, item.id);
    expect(s.garden.items).toHaveLength(0);
    expect(s.garden.storage).toEqual([{ id: item.id, type: 'decor', decorKind: item.kind, variant: item.variant }]);
  });

  it('없는 소품을 치우려 하면 아무 일도 없다', () => {
    const s = createState();
    storeDecor(s, 'nope');
    expect(s.garden.items).toHaveLength(0);
    expect(s.garden.storage).toHaveLength(0);
  });

  it('창고에서 소품을 꺼내면 정원으로 돌아가고 창고에서는 빠진다', () => {
    const s = createState();
    const item = { id: 'decor-1', kind: 'bench' as const, variant: 0, col: 4, row: 4 };
    s.garden.items.push(item);
    storeDecor(s, item.id);
    const placed = takeFromStorage(s, item.id, { col: 9, row: 9 });
    expect(placed).toMatchObject({ id: item.id, kind: item.kind, variant: item.variant, col: 9, row: 9 });
    expect(s.garden.storage).toHaveLength(0);
    expect(s.garden.items).toEqual([placed]);
  });

  it('창고에 없는 걸 꺼내려 하면 null', () => {
    expect(takeFromStorage(createState(), 'nope', { col: 1, row: 1 })).toBeNull();
  });

  it('소품의 방향(좌우)을 바꾸고, 다시 누르면 처음 방향으로 돌아온다', () => {
    const s = createState();
    s.garden.items.push({ id: 'decor-1', kind: 'bench', variant: 0, col: 4, row: 4 });
    expect(flipDecor(s, 'decor-1')).toBe(true);
    expect(s.garden.items[0].flip).toBe(true);
    flipDecor(s, 'decor-1');
    expect(s.garden.items[0].flip).toBeFalsy();
    expect(flipDecor(s, 'nope')).toBe(false);
  });

  it('바꾼 방향은 창고에 넣었다 꺼내도 그대로다', () => {
    const s = createState();
    s.garden.items.push({ id: 'decor-1', kind: 'bench', variant: 0, col: 4, row: 4, flip: true });
    storeDecor(s, 'decor-1');
    expect(s.garden.storage[0]).toMatchObject({ id: 'decor-1', flip: true });
    expect(takeFromStorage(s, 'decor-1', { col: 9, row: 9 })).toMatchObject({ flip: true, col: 9, row: 9 });
  });

  it('심은 식물도 창고로 치우고 꺼낼 수 있다(처음 만난 날짜는 그대로)', () => {
    const s = createState();
    ready(s, D);
    const planted = openAndPlant(s, D, { col: 14, row: 15 })!;
    storePlant(s, planted.id);
    expect(s.garden.plants).toHaveLength(0);
    expect(s.garden.storage).toEqual([{ id: planted.id, type: 'plant', plantId: planted.plantId, date: planted.date }]);

    const placed = takeFromStorage(s, planted.id, { col: 36, row: 14 });
    expect(placed).toMatchObject({ id: planted.id, plantId: planted.plantId, date: planted.date, col: 36, row: 14 });
    expect(s.garden.storage).toHaveLength(0);
    expect(s.garden.plants).toEqual([placed]);
  });

  it('없는 식물을 치우려 하면 아무 일도 없다', () => {
    const s = createState();
    storePlant(s, 'nope');
    expect(s.garden.plants).toHaveLength(0);
    expect(s.garden.storage).toHaveLength(0);
  });
});

describe('회차와 씨앗', () => {
  it('계획을 세우면 회차가 열리고, [했어]마다 기록이 남지만 씨앗은 회차를 닫을 때 한 번', () => {
    const s = createState();
    const { log } = doOne(s);
    expect(s.logs).toEqual([log]);
    expect(log.sessionId).toBe(s.missions.session!.id);
    expect(s.days[D].plan).toBeUndefined();
    expect(s.sessionPackets).toBe(0);
    expect(sessionHasActions(s, D)).toBe(true);
    doOne(s); // 같은 회차에 하나 더
    expect(s.missions.session!.actions).toHaveLength(2);
    expect(closeSession(s)).toEqual({ seeded: true });
    expect(s.sessionPackets).toBe(1);
    expect(s.days[D].sessions).toBe(1);
  });

  it('닫기를 두 번 눌러도 씨앗은 한 번', () => {
    const s = createState();
    doOne(s);
    closeSession(s);
    expect(closeSession(s)).toEqual({ seeded: false });
    expect(s.sessionPackets).toBe(1);
  });

  it('행동 없이 닫으면 씨앗 없이 건너뛴 것으로 끝난다', () => {
    const s = createState();
    setPlan(s, D, plan);
    expect(closeSession(s)).toEqual({ seeded: false });
    expect(s.sessionPackets).toBe(0);
    expect(s.days[D].sessions).toBeUndefined();
  });

  it('행동 뒤에 쉬면 그 회차를 정상으로 닫고(씨앗 1개) 쉰다', () => {
    const s = createState();
    doOne(s);
    chooseRest(s, D);
    expect(s.sessionPackets).toBe(1);
    expect(s.missions.session).toBeNull();
    expect(s.days[D].rested).toBe(true);
  });

  it('행동 없이 쉬면 씨앗은 없고 잃는 것도 없다', () => {
    const s = createState();
    s.fruit = 5;
    setPlan(s, D, plan);
    chooseRest(s, D);
    expect(s.sessionPackets).toBe(0);
    expect(s.fruit).toBe(5);
    expect(s.days[D].plan).toBeUndefined();
  });

  it('마친 회차가 3개면 새 회차를 열지 않는다(열린 회차 안에서는 계속할 수 있다)', () => {
    const s = createState();
    for (let i = 0; i < DAILY_LIMIT; i++) {
      doOne(s);
      expect(limitReached(s, D)).toBe(false);
      closeSession(s);
    }
    expect(limitReached(s, D)).toBe(true);
    expect(setPlan(s, D, plan)).toBe(false);
    expect(s.sessionPackets).toBe(DAILY_LIMIT);
  });

  it('지난 날에 열어 둔 회차는 그날 것으로 정산한다', () => {
    const s = createState();
    doOne(s, '2026-11-01');
    settleOldSession(s, '2026-11-01'); // 같은 날이면 그대로
    expect(s.missions.session).not.toBeNull();
    settleOldSession(s, '2026-11-02');
    expect(s.missions.session).toBeNull();
    expect(s.days['2026-11-01'].sessions).toBe(1);
    expect(s.sessionPackets).toBe(1);
  });

  it('다음 날 계획을 세우면 어제 회차를 먼저 정산한다', () => {
    const s = createState();
    doOne(s, '2026-11-01');
    setPlan(s, '2026-11-02', plan);
    expect(s.days['2026-11-01'].sessions).toBe(1);
    expect(s.missions.session!.date).toBe('2026-11-02');
  });

  it('회차 주머니를 열면 씨앗함에 씨앗이 들어간다', () => {
    const s = createState();
    doOne(s);
    closeSession(s);
    expect(pendingPacketCount(s)).toBe(1);
    const seed = openSessionPacket(s, rng(3))!;
    expect(s.seeds).toEqual([seed]);
    expect(s.sessionPackets).toBe(0);
    expect(openSessionPacket(s)).toBeNull();
  });
});
```

- [ ] **Step 3: 나무·통계 테스트를 더한다**

`src/tests/economy.test.ts`의 `'수확 뒤 주머니를 받은 날이 3번 쌓이면 다시 열리고 1개를 받는다'` 테스트 바로 뒤에 더한다:

```ts
  it('회차를 마친 날도 다시 맺기에 센다', () => {
    const s = createState();
    const t = plantTree(s, D);
    harvest(s, t.id, '2026-11-08');
    for (const date of ['2026-11-09', '2026-11-10', '2026-11-11']) s.days[date] = { refresh: 0, sessions: 1 };
    expect(canHarvest(s.garden.plants[0], '2026-11-20', s.days)).toBe(true);
  });
```

`src/tests/stats.test.ts`의 마지막 `it` 뒤에 더한다:

```ts
  it('카드 기록은 미션 이름으로 말하고 같은 카드를 센다', () => {
    const card = (date: string, missionId: string): LogEntry => ({
      id: date + missionId, date, missionId, variant: 'basic', plan: { when: '지금', where: '', minutes: 0 }, chips: [], source: 'mission',
    });
    const logs = [card('2026-10-26', 'D01'), card('2026-10-27', 'D06'), card('2026-10-28', 'D01')];
    expect(factLineFor(logs, logs[2], '2026-10-28')).toBe('이번 주 쓸 컵 준비하기 2번째예요.');
    expect(weekKindsCount(logs, '2026-10-28')).toBe(2);
  });
```

`src/tests/demo.test.ts`: import에 `pendingPacketDates`를 더하고(`import { DAILY_LIMIT, pendingPacketDates } from '../core/rules';`), 두 테스트를 바꾼다:

```ts
  it('하루 3회차 상한을 지키고, 쉰 날에는 기록이 없다', () => {
    const s = sample();
    for (const d of Object.values(s.days)) expect(d.sessions ?? 0).toBeLessThanOrEqual(DAILY_LIMIT);
    const logDays = new Set(s.logs.map((l) => l.date));
    for (const [date, d] of Object.entries(s.days)) if (d.rested) expect(logDays.has(date)).toBe(false);
  });

  it('식물이 심겨 있고, 최근 이틀에 받은 주머니는 열지 않은 채 남는다', () => {
    const s = sample();
    expect(s.garden.plants.length).toBeGreaterThan(3);
    expect(s.sessionPackets).toBeGreaterThan(0);
    expect(pendingPacketDates(s)).toEqual([]);
  });
```

- [ ] **Step 4: 실패를 확인한다**

Run: `npm test`
Expected: FAIL — `createMissionState`·`reportAction`·`closeSession` 등이 없다는 오류

- [ ] **Step 5: 타입을 더한다** — `src/core/types.ts`

`Plan`을 바꾼다:

```ts
export interface Plan {
  activityId?: string;
  /** 미션 카드와 고른 크기 */
  missionId?: string;
  variant?: Variant;
  text?: string;
  info: PlanInfo;
  source: LogSource;
}
```

`LogEntry`를 바꾼다:

```ts
export interface LogEntry {
  id: string;
  date: string;
  activityId?: string;
  missionId?: string;
  variant?: Variant;
  /** 이 행동이 들어간 회차 */
  sessionId?: string;
  text?: string;
  plan: PlanInfo;
  chips: ReflectChip[];
  source: LogSource;
}
```

`DayInfo`의 `packet` 줄을 바꾸고 `sessions`를 더한다:

```ts
  /** 예전 저장본의 하루 봉투(지금은 회차를 마치면 sessionPackets를 받는다) */
  packet?: 'ready' | 'opened';
  /** 그날 마친 회차 수(하루 상한, 나무 다시 맺기) */
  sessions?: number;
```

`DayInfo` 바로 앞에 더한다:

```ts
/** 카드 한 장과 고른 크기 */
export interface MissionStep {
  missionId: string;
  variant: Variant;
}

/** 회차: 계획을 세우면 열리고 [여기까지]·쉬기로 닫힌다. 닫을 때 해낸 행동이 있으면 씨앗 1개(한 번만). */
export interface MissionSession {
  id: string;
  date: string;
  /** 해낸 행동(직접 적은 일·예전 활동은 missionId가 없다) */
  actions: { missionId?: string; variant?: Variant }[];
}

export interface MissionState {
  /** 오늘의 영역(언제든 바꿀 수 있다). 없으면 처음 미션을 열 때 묻는다. */
  category: CategoryId | null;
  /** 영역별로 지금 하려는 장면(drink·exam 등). 없으면 그 영역의 모든 장면 */
  intents: Partial<Record<CategoryId, string>>;
  workStatus: WorkStatus;
  /** 영역별 추천 단계(1~4). "다음 길을 볼래"를 고를 때만 오르고, 쉬거나 작게 해도 내려가지 않는다. */
  stage: Record<CategoryId, number>;
  /** "해당 없어요"라고 한 카드와 그 조건. 조건은 날마다 바뀌어서 그날만 적용한다. */
  skip: { date: string; facts: string[]; cards: string[] };
  session: MissionSession | null;
  /** 회차 번호(id 만들기용) */
  seq: number;
  /** 표지판: 영역별로 다음에 이어갈 작은 행동 */
  bookmarks: Partial<Record<CategoryId, MissionStep>>;
  /** 영역별 마지막으로 고른 카드 */
  last: Partial<Record<CategoryId, string>>;
}
```

`AppState`의 `chats` 줄 뒤에 더한다:

```ts
  /** 미션 카드 흐름(영역·장면·추천 단계·회차·표지판) */
  missions: MissionState;
  /** 회차를 마치고 받은, 아직 안 연 씨앗 주머니 */
  sessionPackets: number;
```

- [ ] **Step 6: 기본값과 예전 저장본 병합** — `src/core/store.ts`

import를 `import type { AppState, MissionState } from './types';`로 바꾸고, `createState` 위에 더한다:

```ts
export function createMissionState(): MissionState {
  return {
    category: null, intents: {}, workStatus: 'unknown', stage: { daily: 1, academic: 1, work: 1 },
    skip: { date: '', facts: [], cards: [] }, session: null, seq: 0, bookmarks: {}, last: {},
  };
}
```

`createState`의 `chats: [],` 뒤에 `missions: createMissionState(), sessionPackets: 0,`를 넣고, `loadState`의 반환을 바꾼다:

```ts
  return {
    ...base,
    ...saved,
    garden: { ...base.garden, ...saved.garden },
    settings: { ...base.settings, ...saved.settings },
    missions: { ...base.missions, ...saved.missions, stage: { ...base.missions.stage, ...saved.missions?.stage } },
  };
```

- [ ] **Step 7: 회차 규칙** — `src/core/rules.ts`

(a) 맨 위 주석·import·상한 부분(`// 설계 원칙…`부터 `limitReached` 함수 끝까지)을 바꾼다:

```ts
// 설계 원칙을 코드로 강제하는 곳: 하루 상한, 쉬기, 회차와 씨앗, 더 작게, 안 한 일은 기록하지 않음.
import { activities, activityById, smallerOf } from './activities';
import { hashSeed, shuffle } from './random';
import { drawPlant } from './plants';
import type {
  Activity, AppState, DayInfo, DecorItem, Energy, LogEntry, MissionSession, Plan, PlanInfo, PlantedItem, ReflectChip, SeedItem,
} from './types';

/** 하루에 마치는 회차 수(원칙 "하루 활동 최대 3개"). 씨앗도 하루 최대 3개다. */
export const DAILY_LIMIT = 3;
export const PLACE_OPTIONS = ['집 안', '집 근처', '집 밖'] as const;
export const WHEN_OPTIONS = ['지금', '오전', '오후 3시', '저녁'] as const;

export function dayOf(draft: AppState, date: string): DayInfo {
  return (draft.days[date] ??= { refresh: 0 });
}

/** 그날 마친 회차 수 */
export function sessionsDone(state: AppState, date: string): number {
  return state.days[date]?.sessions ?? 0;
}

/** 오늘 열린 회차에 해낸 행동이 있는지([더 해 볼래]·[여기까지]를 보여 줄 때) */
export function sessionHasActions(state: AppState, date: string): boolean {
  const s = state.missions.session;
  return !!s && s.date === date && s.actions.length > 0;
}

/** 오늘 마친 회차가 3개이고 열린 회차가 없으면 새로 시작하지 않는다. 열린 회차 안에서는 이어서 할 수 있다. */
export function limitReached(state: AppState, date: string): boolean {
  return sessionsDone(state, date) >= DAILY_LIMIT && state.missions.session?.date !== date;
}
```

(b) `chooseRest`와 `grantPacket` 두 함수를 통째로 바꾼다:

```ts
// ---------- 회차 ----------
/** 회차를 닫는다(원본 0.7). 해낸 행동이 있으면 씨앗 주머니 1개, 없으면 건너뛴 것으로 끝난다. 닫힌 회차는 사라지므로 두 번 닫아도 씨앗은 한 번이다. */
export function closeSession(draft: AppState): { seeded: boolean } {
  const s = draft.missions.session;
  if (!s) return { seeded: false };
  draft.missions.session = null;
  if (s.actions.length === 0) return { seeded: false };
  draft.sessionPackets += 1;
  const day = dayOf(draft, s.date);
  day.sessions = (day.sessions ?? 0) + 1;
  return { seeded: true };
}

/** 열린 회차. 없으면 연다(하루 상한이면 null). 지난 날의 회차는 그날 것으로 먼저 정산한다. */
function ensureSession(draft: AppState, date: string): MissionSession | null {
  const ms = draft.missions;
  if (ms.session && ms.session.date !== date) closeSession(draft);
  if (ms.session) return ms.session;
  if (sessionsDone(draft, date) >= DAILY_LIMIT) return null;
  ms.seq += 1;
  ms.session = { id: `${date}-s${ms.seq}`, date, actions: [] };
  return ms.session;
}

/** 앱을 열 때: 지난 날에 열어 둔 회차를 그날 것으로 정산한다(해낸 행동이 있었으면 씨앗은 그대로 받는다). */
export function settleOldSession(draft: AppState, today: string): void {
  if (draft.missions.session && draft.missions.session.date < today) closeSession(draft);
}

/** 쉬기도 정상적인 선택. 해낸 행동이 있는 회차는 먼저 정상으로 닫고(씨앗 1개), 없으면 씨앗 없이 쉰다. 잃는 것은 없다. */
export function chooseRest(draft: AppState, date: string): void {
  const day = dayOf(draft, date);
  day.rested = true;
  delete day.plan;
  closeSession(draft);
}
```

(c) `pendingPacketCount`를 바꾼다:

```ts
/** 열지 않은 씨앗 주머니 수(예전 하루 주머니 + 이야기 + 회차 + 방문 선물의 특별 주머니) */
export function pendingPacketCount(state: AppState): number {
  return pendingPacketDates(state).length + state.freePackets + state.sessionPackets + state.bonusPackets;
}
```

(d) `openPacket`의 주석을 `/** 예전 저장본의 하루 주머니를 연다. 랜덤 씨앗 하나가 씨앗함에 들어가고, 심는 건 따로다. */`로 바꾸고, `openFreePacket` 함수 뒤에 더한다:

```ts
/** 회차를 마치고 받은 주머니를 연다. 하루 주머니와 같은 확률이다. */
export function openSessionPacket(draft: AppState, rand: () => number = Math.random): SeedItem | null {
  if (draft.sessionPackets <= 0) return null;
  draft.sessionPackets -= 1;
  return addSeed(draft, drawPlant(rand).id);
}
```

(e) `setPlan`과 `completePlan`을 통째로 바꾼다:

```ts
/** 계획을 세운다. 회차가 없으면 열고, 하루 상한이면 false. */
export function setPlan(draft: AppState, date: string, plan: Plan): boolean {
  if (!ensureSession(draft, date)) return false;
  const day = dayOf(draft, date);
  day.rested = false;
  day.plan = plan;
  return true;
}

/** [했어]: 고른 행동을 기록하고 회차에 더한다. 씨앗은 회차를 닫을 때 준다. */
export function reportAction(draft: AppState, date: string, chips: ReflectChip[]): { log: LogEntry } | null {
  const day = draft.days[date];
  const plan = day?.plan;
  if (!day || !plan) return null;
  const session = ensureSession(draft, date);
  if (!session) return null;
  const log: LogEntry = {
    id: `${date}-${draft.logs.length + 1}`,
    date,
    activityId: plan.activityId,
    missionId: plan.missionId,
    variant: plan.variant,
    sessionId: session.id,
    text: plan.text,
    plan: plan.info,
    chips,
    source: plan.source,
  };
  draft.logs.push(log);
  session.actions.push({ missionId: plan.missionId, variant: plan.variant });
  delete day.plan;
  return { log };
}
```

- [ ] **Step 8: 나무 다시 맺기** — `src/core/economy.ts`의 `REGROW_DAYS` 주석부터 `canHarvest` 끝까지 바꾼다:

```ts
/** 나무는 수확 뒤 정원에 참여한 날(회차를 마친 날·쉬기를 고른 날)이 이만큼 쌓이면 다시 열린다. 날짜만 지나서는 열리지 않는다(보상은 현실 활동에서만). */
export const REGROW_DAYS = 3;

/** 그 날짜 뒤로 참여한 날 수: 회차를 마친 날, 쉬기를 고른 날, 예전 저장본에서 하루 주머니를 받은 날. 연속 여부는 보지 않는다. */
function activeDaysSince(days: AppState['days'], since: string): number {
  return Object.entries(days).filter(([date, d]) => date > since && (d.packet || d.rested || (d.sessions ?? 0) > 0)).length;
}

export function canHarvest(plant: PlantedItem, today: string, days: AppState['days']): boolean {
  if (growthStage(plant.date, today, plant.plantId) !== 'bloom') return false;
  if (!plant.harvested) return true;
  return isTree(plant.plantId) && activeDaysSince(days, plant.harvestedOn ?? plant.date) >= REGROW_DAYS;
}
```

- [ ] **Step 9: 사실 문장** — `src/core/stats.ts`

import에 `import { missionById } from './missions';`를 더하고, `factLineFor`·`activityName`·`weekKindsCount`를 바꾼다:

```ts
/** 기록의 이름: 미션 카드면 미션 이름, 예전 활동이면 활동 이름, 직접 적은 일이면 그 글 */
export function logName(log: LogEntry): string {
  return missionById(log.missionId)?.name ?? activityById(log.activityId)?.name ?? log.text ?? '';
}

/** 같은 일인지: 같은 카드, 같은 예전 활동, 같은 글 */
function sameThing(a: LogEntry, b: LogEntry): boolean {
  if (b.missionId) return a.missionId === b.missionId;
  if (b.activityId) return a.activityId === b.activityId;
  return !a.missionId && !a.activityId && a.text === b.text;
}

/** 카드든 직접 적은 일이든, 같은 것을 이번 주에 몇 번 했는지로 말한다. */
export function factLineFor(logs: LogEntry[], log: LogEntry, date: string): string {
  return copy.fact.weekNth(logName(log), thisWeek(logs, date).filter((l) => sameThing(l, log)).length);
}

/** 이번 주에 해본 서로 다른 일의 수 */
export function weekKindsCount(logs: LogEntry[], date: string): number {
  return new Set(thisWeek(logs, date).map((l) => l.missionId ?? l.activityId ?? `text:${l.text}`)).size;
}
```

- [ ] **Step 10: 샘플 데이터** — `src/core/demo.ts`

import를 바꾼다:

```ts
import { addSeed, chooseRest, closeSession, defaultPlanInfo, designPlan, openSessionPacket, pastItems, plantSeed, reportAction, setEnergy, setPlan, WHEN_OPTIONS } from './rules';
import { createMissionState } from './store';
```

`fillSample` 위에 더한다:

```ts
/** 그날 받은 주머니를 열어 심는다. 오래전에 핀 꽃 일부는 열매를 이미 따서 창고에 있고, 최근에 핀 꽃은 시연 때 직접 딸 수 있게 남긴다. */
function plantPackets(draft: AppState, r: Rand, date: string, ago: number, today: string, slots: SampleSlots): void {
  while (draft.sessionPackets > 0) {
    const seed = openSessionPacket(draft, r)!;
    const used = [...draft.garden.plants, ...draft.garden.items];
    const planted = plantSeed(draft, seed.id, date, isTree(seed.plantId) ? slots.decor(used) : slots.plant(used));
    if (planted && ago >= 8 && r() < 0.6) harvest(draft, planted.id, today);
  }
}
```

`fillSample`의 초기화에 `draft.sessionPackets = 0;`과 `draft.missions = { ...createMissionState(), category: 'daily' };`를 더하고, 날짜 반복문을 바꾼다:

```ts
  for (let ago = 14; ago >= 1; ago--) {
    const date = shiftDate(today, -ago);
    const roll = r();
    // 최근 이틀은 늘 무언가 한 날로 두고, 그 주머니는 열지 않고 남긴다(시연 때 직접 열어 보게).
    if (ago > 2 && roll < 0.15) {
      setEnergy(draft, date, 'heavy');
      chooseRest(draft, date);
    } else if (ago > 2 && roll < 0.32) {
      continue; // 아무것도 안 한 날: 기록도 표시도 남기지 않는다.
    } else {
      setEnergy(draft, date, pick(r, ['heavy', 'normal', 'normal', 'good'] as const));
      const count = 1 + Math.floor(r() * (ago <= 7 ? 3 : 2));
      const used = new Set<string>();
      for (let i = 0; i < count; i++) {
        const plan = samplePlan(draft, r, ago, used);
        if (!plan || !setPlan(draft, date, plan)) continue;
        const chips = CHIPS.filter(() => r() < 0.4);
        if (reportAction(draft, date, chips)) closeSession(draft);
      }
    }
    if (ago > 2) plantPackets(draft, r, date, ago, today, slots);
  }
```

(`openPacket` import와 옛 "최근 이틀의 봉투는…" 블록은 지운다.)

- [ ] **Step 11: 회차 주머니 열기** — `src/ui/panels/Packet.tsx`

import를 `import { openBonusPacket, openFreePacket, openPacket, openSessionPacket, pendingPacketDates } from '../../core/rules';`로 바꾸고:

```tsx
function Packet({ source, date }: { source: 'day' | 'free' | 'session' | 'bonus'; date?: string }) {
```

```tsx
    store.update((d) => {
      seed = source === 'day' ? openPacket(d, date!) : source === 'free' ? openFreePacket(d) : source === 'session' ? openSessionPacket(d) : openBonusPacket(d);
    });
```

`openPacketModal`을 바꾼다:

```tsx
export function openPacketModal(): void {
  if (isModalOpen()) return;
  const { freePackets, sessionPackets, bonusPackets } = store.state;
  const date = pendingPacketDates(store.state)[0];
  // 이야기가 준 주머니, 예전에 날마다 받은 주머니, 회차를 마치고 받은 주머니, 방문 선물의 특별 주머니 순서로 연다.
  if (freePackets > 0) openModal(<Packet source="free" />);
  else if (date) openModal(<Packet source="day" date={date} />);
  else if (sessionPackets > 0) openModal(<Packet source="session" />);
  else if (bonusPackets > 0) openModal(<Packet source="bonus" />);
}
```

`SeedBoxBody`의 `const pouches = pendingPacketDates(s).length + s.freePackets;`를 `const pouches = pendingPacketDates(s).length + s.freePackets + s.sessionPackets;`로 바꾼다.

- [ ] **Step 12: 지금 화면에 잇기(임시: 한 행동마다 회차를 닫는다)** — `src/ui/flow.ts`

import의 `completePlan`을 `closeSession, reportAction`으로 바꾼다:

```ts
import { closeSession, isResting, limitReached, pendingPacketCount, pendingPacketDates, reportAction } from '../core/rules';
```

`complete` 안의 두 줄을 바꾼다:

```ts
  let result = null as ReturnType<typeof reportAction>;
  store.update((d) => {
    result = reportAction(d, date, chips);
    if (result) closeSession(d); // [더 해 볼래]가 생기기 전(Task 5)까지는 한 행동마다 회차를 닫는다.
  });
```

봉투 구독을 바꾼다:

```ts
  // 주머니가 새로 도착하면(회차를 마친 직후) 잠시 뒤에 알려준다. 못 열어도 왼쪽 위 버튼에 남는다.
  const arrived = () => pendingPacketDates(store.state).length + store.state.sessionPackets;
  let pending = arrived();
  store.subscribe(() => {
    const n = arrived();
    if (n > pending) {
      window.setTimeout(openPacketModal, justCompleted ? 3400 : 800);
      justCompleted = false;
    }
    pending = n;
  });
```

- [ ] **Step 13: 통과를 확인한다**

Run: `npm test && npm run build`
Expected: 모든 테스트 통과(새 회차 테스트 포함), 빌드 성공. 실패하는 테스트가 있으면 규칙을 고치고 테스트 기대값은 바꾸지 않는다(설계와 다르면 멈추고 묻는다).

---

### Task 3: 추천 규칙과 샘플 데이터

**Files:**
- Modify: `src/core/missions.ts` (규칙 부분 추가)
- Modify: `src/core/demo.ts` (샘플을 미션 카드로)
- Test: `src/tests/missions.test.ts`, `src/tests/demo.test.ts`

**Interfaces:**
- Consumes: `setPlan`·`reportAction`·`closeSession`·`setEnergy`(rules), `MissionStep`·`Variant`·`CategoryId`·`WorkStatus`(types), `createMissionState`(store)
- Produces (missions.ts):
  - `eligibleVariants(state, date, m): Variant[]`, `fits(state, date, m, category): boolean`, `preferred(state, date, m): Variant`
  - `interface Suggestion extends MissionStep { crosses: boolean }`, `lastStep(state): MissionStep | null`, `moreAfter(state, date, step): Suggestion | null`
  - `alternatives(state, date, fromId): Mission[]`, `previewCards(state, date): Mission[]`
  - `startCard(state, date): (MissionStep & { bookmark: boolean }) | null`, `bookmarkSuggestion(state, date): MissionStep | null`
  - `chooseArea(draft, c)`, `chooseWorkStatus(draft, w)`, `chooseIntent(draft, c, intent | null)`, `markNotApplicable(draft, date, id)`, `advanceStage(draft, id)`, `saveBookmark(draft, step)`, `chooseMission(draft, date, step): boolean`
  - `actionText(m, v): string`, `recordText(m, v): string`

- [ ] **Step 1: 실패하는 규칙 테스트를 쓴다** — `src/tests/missions.test.ts` import를 바꾸고 아래 묶음을 끝에 더한다

```ts
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_WORDS } from '../core/copy';
import {
  advanceStage, alternatives, bookmarkSuggestion, chooseArea, chooseIntent, chooseMission, chooseWorkStatus, eligibleVariants, FIRST, fits,
  lastStep, markNotApplicable, missionById, MISSIONS, moreAfter, preferred, previewCards, saveBookmark, startCard, type Mission,
} from '../core/missions';
import { closeSession, reportAction, setEnergy } from '../core/rules';
import { createState } from '../core/store';
import type { Variant } from '../core/types';
```

```ts
const D = '2026-11-09';
type S = ReturnType<typeof createState>;
const card = (id: string) => missionById(id)!;
/** 일상 영역(장면을 주면 그 장면) */
const daily = (intent?: string) => {
  const s = createState();
  chooseArea(s, 'daily');
  if (intent) chooseIntent(s, 'daily', intent);
  return s;
};
/** 카드를 고르고 [했어]까지 */
const act = (s: S, missionId: string, variant: Variant) => {
  expect(chooseMission(s, D, { missionId, variant })).toBe(true);
  expect(reportAction(s, D, [])).not.toBeNull();
};

describe('후보 거르기', () => {
  it('일상에서 장면을 건너뛰면 D01·D03·D05를 미리 보여 준다(D05를 강제하지 않는다)', () => {
    expect(previewCards(daily(), D).map((m) => m.id)).toEqual(['D01', 'D03', 'D05']);
  });

  it('장면이 다른 카드는 빼고 all 카드는 남긴다', () => {
    const s = daily('drink');
    expect(fits(s, D, card('D02'), 'daily')).toBe(false);
    expect(fits(s, D, card('D06'), 'daily')).toBe(true);
    expect(fits(s, D, card('D16'), 'daily')).toBe(true);
  });

  it('5~6단계는 추천하지 않는다', () => {
    expect(fits(daily(), D, card('D21'), 'daily')).toBe(false);
  });

  it('복귀 전·모를 때는 W06~W20(실무)을 빼고, 복귀 후에는 넣는다', () => {
    const s = createState();
    chooseArea(s, 'work');
    expect(fits(s, D, card('W06'), 'work')).toBe(false);
    chooseWorkStatus(s, 'pre_return');
    expect(fits(s, D, card('W03'), 'work')).toBe(true);
    expect(fits(s, D, card('W06'), 'work')).toBe(false);
    chooseWorkStatus(s, 'returned');
    expect(fits(s, D, card('W06'), 'work')).toBe(true);
  });

  it('해당 없어요: 그 카드와 같은 조건이 걸린 카드를 그날만 뺀다', () => {
    const s = daily('drink');
    markNotApplicable(s, D, 'D01'); // 컵(hasCup)
    expect(fits(s, D, card('D01'), 'daily')).toBe(false);
    expect(fits(s, D, card('D06'), 'daily')).toBe(false); // 컵이 필요한 카드
    expect(fits(s, D, card('D11'), 'daily')).toBe(true);
    expect(fits(s, '2026-11-10', card('D01'), 'daily')).toBe(true); // 다음 날엔 다시 나온다
  });

  it('기본 행동에만 걸리는 조건이면 줄인 행동만 남는다', () => {
    const s = createState();
    chooseArea(s, 'work');
    chooseWorkStatus(s, 'returned');
    markNotApplicable(s, D, 'W08'); // 작성할 과제(hasWritingTask)
    expect(eligibleVariants(s, D, card('W12'))).toEqual(['small']); // 기본은 예시+작성, 줄인 행동은 예시만
  });

  it('조금 무거운 날은 줄인 행동을 먼저 보여 준다', () => {
    const s = daily('drink');
    expect(preferred(s, D, card('D01'))).toBe('basic');
    setEnergy(s, D, 'heavy');
    expect(preferred(s, D, card('D01'))).toBe('small');
  });
});

describe('더 해 볼래', () => {
  it('음료(D01) 기본 뒤에는 D02가 아니라 D06이고, 단계가 바뀌어 먼저 묻는다', () => {
    const s = daily('drink');
    act(s, 'D01', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)).toEqual({ missionId: 'D06', variant: 'basic', crosses: true });
    advanceStage(s, 'D06');
    expect(moreAfter(s, D, lastStep(s)!)?.crosses).toBe(false);
  });

  it('줄인 행동만 했으면 같은 카드의 기본 행동', () => {
    const s = daily('drink');
    act(s, 'D01', 'small');
    expect(moreAfter(s, D, lastStep(s)!)).toEqual({ missionId: 'D01', variant: 'basic', crosses: false });
    act(s, 'D01', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)?.missionId).toBe('D06');
  });

  it('시험 준비 흐름에서는 과제 전용 카드(A11)를 건너뛴다', () => {
    const s = createState();
    chooseArea(s, 'academic');
    chooseIntent(s, 'academic', 'exam');
    act(s, 'A10', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)?.missionId).toBe('A12');
  });

  it('복귀 전에는 준비 카드 안에서만 잇고, 끝나면 null', () => {
    const s = createState();
    chooseArea(s, 'work');
    chooseWorkStatus(s, 'pre_return');
    act(s, 'W03', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)?.missionId).toBe('W04');
    act(s, 'W05', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)).toBeNull();
  });

  it('4단계 마지막 카드 뒤에는 null(5단계는 추천하지 않는다)', () => {
    const s = daily();
    act(s, 'D20', 'basic');
    expect(moreAfter(s, D, lastStep(s)!)).toBeNull();
  });

  it('하루 상한이면 카드를 고를 수 없다', () => {
    const s = daily('drink');
    for (let i = 0; i < 3; i++) {
      act(s, 'D01', 'small');
      closeSession(s);
    }
    expect(chooseMission(s, D, { missionId: 'D01', variant: 'small' })).toBe(false);
  });
});

describe('다른 걸 할래', () => {
  it('같은 단계에서 맞는 다른 카드 최대 2개(지금 카드 다음 번호부터)', () => {
    const s = createState();
    chooseArea(s, 'academic');
    expect(alternatives(s, D, 'A02').map((m) => m.id)).toEqual(['A03', 'A04']);
  });

  it('같은 단계에 없으면 이전 단계에서 고른다', () => {
    expect(alternatives(daily('drink'), D, 'D06').map((m) => m.id)).toEqual(['D01']);
  });
});

describe('표지판과 다시 열기', () => {
  it('줄인 행동만 했으면 같은 카드의 기본을, 기본을 했으면 다음 카드의 줄인 행동을 제안한다', () => {
    const s = daily('drink');
    act(s, 'D01', 'small');
    expect(bookmarkSuggestion(s, D)).toEqual({ missionId: 'D01', variant: 'basic' });
    act(s, 'D01', 'basic');
    expect(bookmarkSuggestion(s, D)).toEqual({ missionId: 'D06', variant: 'small' });
  });

  it('카드 행동이 없으면 제안하지 않는다', () => {
    expect(bookmarkSuggestion(daily(), D)).toBeNull();
  });

  it('다시 열면 표지판 카드부터, 없으면 마지막 카드부터(조건을 다시 거른다)', () => {
    const s = daily('drink');
    act(s, 'D01', 'basic');
    closeSession(s);
    expect(startCard(s, D)).toEqual({ missionId: 'D01', variant: 'basic', bookmark: false });
    saveBookmark(s, { missionId: 'D06', variant: 'small' });
    expect(startCard(s, D)).toEqual({ missionId: 'D06', variant: 'small', bookmark: true });
    markNotApplicable(s, D, 'D06'); // 컵·음료가 없다 → D06도 D01도 오늘은 안 맞는다
    expect(startCard(s, D)).toBeNull();
  });

  it('표지판 카드를 고르면 표지판을 쓴 것으로 지우고 마지막 카드로 기억한다', () => {
    const s = daily('drink');
    saveBookmark(s, { missionId: 'D06', variant: 'small' });
    chooseMission(s, D, { missionId: 'D06', variant: 'small' });
    expect(s.missions.bookmarks.daily).toBeUndefined();
    expect(s.missions.last.daily).toBe('D06');
    expect(s.days[D].plan).toMatchObject({ missionId: 'D06', variant: 'small', source: 'mission' });
  });

  it('미리보기에서 고른 카드의 장면을 기억한다', () => {
    const s = daily();
    chooseMission(s, D, { missionId: 'D03', variant: 'small' });
    expect(s.missions.intents.daily).toBe('wash');
  });

  it('추천 단계는 다음 길을 고를 때만 오르고 내려가지 않는다(4단계까지)', () => {
    const s = daily();
    advanceStage(s, 'D11');
    expect(s.missions.stage.daily).toBe(3);
    advanceStage(s, 'D01');
    expect(s.missions.stage.daily).toBe(3);
    advanceStage(s, 'D21');
    expect(s.missions.stage.daily).toBe(4);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/tests/missions.test.ts`
Expected: FAIL — `chooseArea is not a function` 등

- [ ] **Step 3: 규칙을 쓴다** — `src/core/missions.ts`

import를 바꾼다:

```ts
import raw from './data/missions.json';
import { setPlan } from './rules';
import type { Speaker } from './story';
import type { AppState, CategoryId, MissionStep, Variant, WorkStatus } from './types';
```

파일 끝에 더한다:

```ts
// ---------- 거르기 ----------
function skipOf(state: AppState, date: string): AppState['missions']['skip'] {
  return state.missions.skip.date === date ? state.missions.skip : { date, facts: [], cards: [] };
}

/** 그날 "해당 없어요"에 걸리지 않는 크기. 조건을 모르면(처음엔 모두 모른다) 맞는 것으로 보고 카드에 조건을 보여 준다. */
export function eligibleVariants(state: AppState, date: string, m: Mission): Variant[] {
  const skip = skipOf(state, date);
  if (skip.cards.includes(m.id)) return [];
  const ok = (facts: string[]) => !facts.some((f) => skip.facts.includes(f));
  return (['basic', 'small'] as const).filter((v) => ok(v === 'basic' ? m.basicFacts : m.smallFacts));
}

/** 후보 거르기(원본 0.6 순서): 같은 영역 → 장면이 맞거나 all → 업무 복귀 상태 → 조건 → 4단계까지 */
export function fits(state: AppState, date: string, m: Mission, category: CategoryId): boolean {
  const ms = state.missions;
  if (m.categoryId !== category || m.stage > MAX_STAGE) return false;
  const intent = ms.intents[category];
  if (intent && !m.intentIds.includes('all') && !m.intentIds.includes(intent)) return false;
  if (m.allowedWorkStatuses.length > 0 && !m.allowedWorkStatuses.includes(ms.workStatus)) return false;
  return eligibleVariants(state, date, m).length > 0;
}

/** 먼저 보여 줄 크기: 오늘 "조금 무거워요"면 줄인 행동, 아니면 기본(안 맞는 크기는 건너뛴다). 고르는 건 사용자다. */
export function preferred(state: AppState, date: string, m: Mission): Variant {
  const vs = eligibleVariants(state, date, m);
  const heavy = state.days[date]?.energy === 'heavy';
  return (heavy && vs.includes('small')) || !vs.includes('basic') ? 'small' : 'basic';
}

// ---------- 다음 카드 ----------
export interface Suggestion extends MissionStep {
  /** 지금 추천 단계보다 높은 단계라 "다음 길을 볼래?"를 먼저 묻는다 */
  crosses: boolean;
}

/** 이번 회차에 마지막으로 해낸 카드 행동(직접 적은 일은 건너뛴다) */
export function lastStep(state: AppState): MissionStep | null {
  const acts = state.missions.session?.actions ?? [];
  for (let i = acts.length - 1; i >= 0; i--) {
    const { missionId, variant } = acts[i];
    if (missionId && variant) return { missionId, variant };
  }
  return null;
}

/** 다음 번호를 따라가며 거르기를 통과하는 첫 카드. 4단계를 넘으면 멈춘다(번호는 정렬용일 뿐 그대로 실행하지 않는다). */
function nextFitting(state: AppState, date: string, cur: Mission): Mission | null {
  const seen = new Set([cur.id]);
  for (let m = missionById(cur.nextId); m && m.stage <= MAX_STAGE && !seen.has(m.id); m = missionById(m.nextId)) {
    seen.add(m.id);
    if (fits(state, date, m, cur.categoryId)) return m;
  }
  return null;
}

/** [더 해 볼래]: 줄인 행동만 했으면 같은 카드의 기본, 기본을 했으면 조건에 맞는 다음 카드. 4단계 안에 없으면 null. */
export function moreAfter(state: AppState, date: string, step: MissionStep): Suggestion | null {
  const cur = missionById(step.missionId);
  if (!cur) return null;
  const didBasic = (state.missions.session?.actions ?? []).some((a) => a.missionId === cur.id && a.variant === 'basic');
  if (step.variant === 'small' && !didBasic && eligibleVariants(state, date, cur).includes('basic')) {
    return { missionId: cur.id, variant: 'basic', crosses: false };
  }
  const next = nextFitting(state, date, cur);
  if (!next) return null;
  return { missionId: next.id, variant: preferred(state, date, next), crosses: next.stage > state.missions.stage[cur.categoryId] };
}

/** [다른 걸 할래]: 같은 영역·장면·단계에서 맞는 다른 카드 최대 2개(지금 카드 다음 번호부터). 없으면 이전 단계에서 가까운 것부터. */
export function alternatives(state: AppState, date: string, fromId: string): Mission[] {
  const cur = missionById(fromId);
  if (!cur) return [];
  const pool = MISSIONS.filter((m) => m.id !== cur.id && fits(state, date, m, cur.categoryId));
  const same = pool.filter((m) => m.stage === cur.stage);
  const ordered = [...same.filter((m) => m.id > cur.id), ...same.filter((m) => m.id < cur.id)];
  if (ordered.length > 0) return ordered.slice(0, 2);
  return pool.filter((m) => m.stage < cur.stage).sort((a, b) => b.stage - a.stage || a.id.localeCompare(b.id)).slice(0, 2);
}

/** 일상에서 장면을 건너뛰면: D01·D03·D05 미리보기 중 지금 맞는 것 */
export function previewCards(state: AppState, date: string): Mission[] {
  return FIRST.daily.previews.map((id) => missionById(id)).filter((m): m is Mission => !!m && fits(state, date, m, 'daily'));
}

/** 카드 흐름을 다시 열 때의 첫 카드: 표지판 → 마지막으로 고른 카드(둘 다 조건을 다시 거른다). 없으면 null(장면 고르기). */
export function startCard(state: AppState, date: string): (MissionStep & { bookmark: boolean }) | null {
  const cat = state.missions.category;
  if (!cat) return null;
  const bm = state.missions.bookmarks[cat];
  const bmCard = missionById(bm?.missionId);
  if (bm && bmCard && fits(state, date, bmCard, cat)) {
    const vs = eligibleVariants(state, date, bmCard);
    return { missionId: bmCard.id, variant: vs.includes(bm.variant) ? bm.variant : vs[0], bookmark: true };
  }
  const last = missionById(state.missions.last[cat]);
  if (last && fits(state, date, last, cat)) return { missionId: last.id, variant: preferred(state, date, last), bookmark: false };
  return null;
}

/** [여기까지] 뒤 표지판 제안: 줄인 행동만 했으면 같은 카드의 기본, 기본을 했으면 다음 카드의 줄인 행동. 번호만 보고 정하지 않는다. */
export function bookmarkSuggestion(state: AppState, date: string): MissionStep | null {
  const step = lastStep(state);
  if (!step) return null;
  const next = moreAfter(state, date, step);
  if (!next) return null;
  if (next.missionId === step.missionId) return { missionId: step.missionId, variant: 'basic' };
  const m = missionById(next.missionId)!;
  return { missionId: m.id, variant: eligibleVariants(state, date, m).includes('small') ? 'small' : 'basic' };
}

// ---------- 고르기 ----------
export function chooseArea(draft: AppState, category: CategoryId): void {
  draft.missions.category = category;
}

export function chooseWorkStatus(draft: AppState, status: WorkStatus): void {
  draft.missions.workStatus = status;
}

/** 장면 고르기. null이면 그 영역의 모든 장면(미리보기에서 고를 때) */
export function chooseIntent(draft: AppState, category: CategoryId, intent: string | null): void {
  if (intent) draft.missions.intents[category] = intent;
  else delete draft.missions.intents[category];
}

/** "해당 없어요": 이 카드와, 같은 조건이 걸린 카드를 그날만 뺀다. */
export function markNotApplicable(draft: AppState, date: string, id: string): void {
  const m = missionById(id);
  if (!m) return;
  const cur = skipOf(draft, date);
  draft.missions.skip = {
    date,
    facts: [...new Set([...cur.facts, ...m.basicFacts, ...m.smallFacts])],
    cards: [...new Set([...cur.cards, m.id])],
  };
}

/** "다음 길을 볼래": 추천 단계를 그 카드의 단계로 올린다(내려가지 않고 4단계까지). */
export function advanceStage(draft: AppState, id: string): void {
  const m = missionById(id);
  if (!m) return;
  const st = draft.missions.stage;
  st[m.categoryId] = Math.min(MAX_STAGE, Math.max(st[m.categoryId], m.stage));
}

/** 표지판에 남긴다(영역마다 하나). */
export function saveBookmark(draft: AppState, step: MissionStep): void {
  const m = missionById(step.missionId);
  if (m) draft.missions.bookmarks[m.categoryId] = step;
}

/** 카드의 한 크기를 고른다: 오늘 계획이 되고(회차가 없으면 열린다) 마지막 카드·장면을 기억한다. 표지판 카드면 표지판을 쓴 것으로 지운다. 하루 상한이면 false. */
export function chooseMission(draft: AppState, date: string, step: MissionStep): boolean {
  const m = missionById(step.missionId);
  if (!m || !eligibleVariants(draft, date, m).includes(step.variant)) return false;
  const plan = { missionId: m.id, variant: step.variant, info: { when: '지금', where: '', minutes: 0 }, source: 'mission' as const };
  if (!setPlan(draft, date, plan)) return false;
  const ms = draft.missions;
  ms.category = m.categoryId;
  const intent = ms.intents[m.categoryId];
  if (!m.intentIds.includes('all') && !(intent && m.intentIds.includes(intent))) ms.intents[m.categoryId] = m.intentIds[0];
  ms.last[m.categoryId] = m.id;
  if (ms.bookmarks[m.categoryId]?.missionId === m.id) delete ms.bookmarks[m.categoryId];
  return true;
}

// ---------- 문장 ----------
/** 고른 크기의 행동 문장 */
export function actionText(m: Mission, v: Variant): string {
  return v === 'basic' ? m.basic : m.small;
}

/** 수첩에 남는 기록 문장 */
export function recordText(m: Mission, v: Variant): string {
  return v === 'basic' ? m.record : m.smallRecord;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/tests/missions.test.ts`
Expected: 데이터 4개 + 규칙 테스트 모두 통과

- [ ] **Step 5: 샘플 테스트를 고친다** — `src/tests/demo.test.ts`

`'방문 선물은 오늘 것을 아직 받지 않은 상태이고, 직접 계획도 일부 섞인다'`의 `expect(s.logs.some((l) => l.source === 'daily')).toBe(true);` 줄을 지우고, 마지막 `it` 뒤에 더한다:

```ts
  it('샘플 기록은 미션 카드와 직접 적은 일이고, 회차로 묶인다', () => {
    const s = sample();
    expect(s.logs.some((l) => l.missionId)).toBe(true);
    expect(s.logs.every((l) => l.sessionId)).toBe(true);
    const sessions = Object.values(s.days).reduce((n, d) => n + (d.sessions ?? 0), 0);
    expect(new Set(s.logs.map((l) => l.sessionId)).size).toBe(sessions);
    expect(s.missions.session).toBeNull();
    expect(s.missions.category).toBe('daily');
  });
```

Run: `npx vitest run src/tests/demo.test.ts`
Expected: FAIL — 미션 카드 기록이 없다

- [ ] **Step 6: 샘플을 미션 카드로** — `src/core/demo.ts`

import를 바꾼다:

```ts
import { shiftDate } from './clock';
import { harvest } from './economy';
import { advanceStage, chooseIntent, chooseMission, FIRST, missionById, moreAfter } from './missions';
import { isTree, plants } from './plants';
import { rng } from './random';
import { addSeed, chooseRest, closeSession, designPlan, openSessionPacket, plantSeed, reportAction, setEnergy, setPlan, WHEN_OPTIONS } from './rules';
import { createMissionState } from './store';
import type { AppState, MissionStep, ReflectChip } from './types';
```

`samplePlan` 함수를 지우고 그 자리에 쓴다:

```ts
/** 회차 하나: 일상 장면의 첫 카드를 하고, 절반쯤은 [더 해 볼래]로 한두 번 더 한 뒤 닫는다. 지난 일주일엔 가끔 직접 적은 일. */
function sampleSession(draft: AppState, r: Rand, date: string, ago: number): void {
  const chips = () => CHIPS.filter(() => r() < 0.4);
  if (ago <= 7 && r() < 0.25) {
    const [text, criterion] = pick(r, WISHES);
    if (setPlan(draft, date, designPlan(text, pick(r, WHEN_OPTIONS), criterion)!)) reportAction(draft, date, chips());
  } else {
    const scene = pick(r, FIRST.daily.scenes);
    chooseIntent(draft, 'daily', missionById(scene.missionId)?.intentIds[0] ?? null);
    let step: MissionStep | null = { missionId: scene.missionId, variant: r() < 0.5 ? 'small' : 'basic' };
    for (let i = 0; i < 3 && step; i++) {
      if (!chooseMission(draft, date, step)) break;
      reportAction(draft, date, chips());
      const next = r() < 0.5 ? moreAfter(draft, date, step) : null;
      if (next?.crosses) advanceStage(draft, next.missionId); // 시연 데이터에서는 다음 길을 골랐다고 본다
      step = next;
    }
  }
  closeSession(draft);
}
```

`fillSample`의 활동한 날 부분(`setEnergy(… pick(r, ['heavy', …]))` 다음부터 `else` 블록 끝까지)을 바꾼다:

```ts
      setEnergy(draft, date, pick(r, ['heavy', 'normal', 'normal', 'good'] as const));
      const count = ago <= 7 ? 1 + Math.floor(r() * 2) : 1; // 회차는 하루 한두 개(씨앗도 그만큼)
      for (let i = 0; i < count; i++) sampleSession(draft, r, date, ago);
    }
```

- [ ] **Step 7: 통과를 확인한다**

Run: `npm test && npm run build`
Expected: 모두 통과, 빌드 성공. `'열매 12개…딸 수 있는 꽃이 하나 이상 남는다'`가 실패하면 시드(`rng(20261026)`)를 바꾸지 말고 `count`·`0.25` 같은 비율을 먼저 확인한다(설계 수치가 아니라 샘플 수치라 조정 가능).

---

### Task 4: 카드 고르기 화면

**Files:**
- Create: `src/ui/panels/Mission.tsx`, `src/ui/panels/Direct.tsx`
- Delete: `src/ui/panels/ActivityPanel.tsx`, `src/ui/panels/PlanDetail.tsx`
- Modify: `src/ui/Hud.tsx`, `src/ui/flow.ts`, `src/ui/panels/Records.tsx`, `src/ui/panels/Reflect.tsx`, `src/core/events.ts`, `src/core/copy.ts`, `src/core/rules.ts`, `src/core/activities.ts`, `src/styles/overlay.css`, `src/styles/art.css`
- Test: `src/tests/rules.test.ts`, `src/tests/copy.test.ts`

**Interfaces:**
- Consumes: Task 3의 missions.ts 함수 전부, `chooseRest`·`isResting`·`limitReached`·`undoRest`·`designPlan`·`setPlan`·`WHEN_OPTIONS`(rules), `logName`(stats)
- Produces (Mission.tsx): `type MissionView`, `missionLinks: { direct?: () => void }`, `MissionFace({ who: Speaker })`, `openMission(view?: MissionView): void`
- Produces (Direct.tsx): `directLinks: { cards?: () => void }`, `openDirect(): void`
- Produces (events.ts): `HudAction`에서 `'plan-check' | 'other-activity'`를 빼고 `'mission' | 'mission-other'`

이 태스크가 끝나면: 영역 → 장면 → 카드 → 크기 고르기 → 정원 위 카드 → [했어] → 회고(지금의 [남기기]/[건너뛰기]) → 한 행동마다 회차가 닫혀 씨앗 1개. [더 해 볼래]·표지판은 Task 5.

- [ ] **Step 1: 문구 테스트를 먼저 고친다** — `src/tests/copy.test.ts`의 `texts`를 바꾼다

```ts
    const texts = [
      copy.fact.weekNth('집 앞 5분 걷기', 3),
      copy.decorate.count(3), copy.decorate.storage(2), copy.decorate.moving('벤치'),
      copy.chat.placeholder('느리'),
      copy.mission.when('지금 컵이 필요할 때.'), copy.mission.stage(1, '첫발 떼기'), copy.mission.bookmarkAsk('쓸 컵 준비하기'),
    ];
```

Run: `npx vitest run src/tests/copy.test.ts`
Expected: FAIL — `copy.mission`이 없다

- [ ] **Step 2: 문구** — `src/core/copy.ts`

`card` 묶음을 바꾼다(`confirm` 삭제, `other`·`pick` 변경):

```ts
  card: {
    title: '내가 고른 오늘의 활동',
    done: '했어요',
    other: '다른 걸 할래',
    empty: '오늘 해볼 일을 골라볼까요?',
    pick: '미션 해보기',
    resting: '오늘은 쉬는 날이에요',
    restingSub: '정원은 그대로 있어요.',
    unrest: '마음이 바뀌었어요',
    enough: '오늘은 여기까지 해도 충분해요',
    enoughSub: '정원이 천천히 자라고 있어요.',
  },
```

`panel` 묶음을 `panel: { back: '뒤로', close: '닫기' },`로 줄이고, `tabs`·`daily` 묶음을 지우고, `design.again`을 `'미션 카드 보기'`로 바꾼다. `design` 묶음 뒤에 더한다:

```ts
  // 미션 카드 흐름. 주민 말(반말)은 스토리 바이블 말투, 버튼 이름은 미션 최종안 그대로.
  mission: {
    title: '오늘의 미션',
    areaAsk: '오늘은 어떤 쪽에 한 걸음 남겨 볼까?',
    area: { daily: '일상', academic: '학업', work: '업무복귀' },
    areaNote: { daily: '먹기·씻기·내 공간·전환·연락', academic: '수업·공부·과제·시험 준비', work: '돌아갈 준비와 돌아온 뒤의 시작' },
    gardenFirst: '정원 먼저 둘러보기',
    workAsk: '지금은 돌아가기 전이야, 돌아온 뒤야?',
    work: { pre_return: '복귀 전', returned: '복귀 후' },
    sceneAsk: { daily: '지금 하고 싶은 쪽을 골라 볼래?', academic: '어떤 자료부터 볼까?', work: '지금은 어떤 상황이야?' },
    previews: '카드 보고 고르기',
    previewsAsk: '이 중에 지금 맞는 게 있으면 골라 봐.',
    noneFit: '지금은 다 안 맞아요',
    pick: '이걸로',
    basic: '이만큼 할래',
    small: '더 작게 할래',
    other: '다른 걸 할래',
    rest: '오늘은 쉴래',
    end: '여기까지',
    notApplicable: '해당 없어요',
    changeArea: '영역 바꾸기',
    direct: '내가 직접 만들래',
    when: (s: string) => `이럴 때: ${s}`,
    stage: (n: number, name: string) => `${n}단계 · ${name}`,
    fromBookmark: '지난번 표지판',
    otherAsk: '이건 어때? 지금 맞는 걸로 골라 봐.',
    emptyAsk: '지금 맞는 카드가 없네. 다른 걸 골라 볼까?',
    otherScene: '다른 장면 고르기',
    toGarden: '정원으로',
    crossTitle: '다음 길',
    crossAsk: '다음 길을 볼래? 여기서 더 해 봐도 돼.',
    crossNext: '다음 길을 볼래',
    crossStay: '여기서 더 해 볼래',
    endAsk: '여기까지 이어 왔네. 다음은 어떻게 할까?',
    endStay: '여기서 더 해 볼래',
    endArea: '다른 영역',
    bookmarkTag: '표지판',
    bookmarkAsk: (name: string) => `다음엔 ‘${name}’부터 이어 볼까?`,
    bookmarkSave: '남기기',
    bookmarkSkip: '건너뛰기',
  },
```

Run: `npx vitest run src/tests/copy.test.ts`
Expected: PASS (build는 아직 실패해도 된다: ActivityPanel이 지운 문구를 쓴다)

- [ ] **Step 3: HUD 행동 이름** — `src/core/events.ts`

```ts
export type HudAction = 'records' | 'decorate' | 'settings' | 'talk' | 'mission' | 'mission-other' | 'done' | 'packet' | 'shop' | 'bag' | 'book' | 'gift';
```

- [ ] **Step 4: 카드 흐름 화면** — `src/ui/panels/Mission.tsx` (새로)

```tsx
// 미션 카드 흐름: 영역 → 장면 → 카드 한 장. 고르는 건 언제나 사용자이고, 쉬기·직접 만들기·영역 바꾸기는 어느 화면에서든 갈 수 있다.
// 규칙(거르기·다른 카드·표지판)은 core/missions.ts, 회차·씨앗은 core/rules.ts. 이 화면은 보여 주고 고른 것을 넘기기만 한다.
import { useState, type ReactNode } from 'react';
import { todayKey } from '../../core/clock';
import { copy } from '../../core/copy';
import {
  actionText, alternatives, chooseArea, chooseIntent, chooseMission, chooseWorkStatus, eligibleVariants, FIRST, fits, markNotApplicable,
  missionById, preferred, previewCards, startCard, type Mission,
} from '../../core/missions';
import { chooseRest, isResting, limitReached, undoRest } from '../../core/rules';
import type { Speaker } from '../../core/story';
import { store } from '../../core/store';
import type { CategoryId, Variant } from '../../core/types';
import { IconBtn, SproutImg } from '../icons';
import { closeModal, openModal } from '../modal';
import { useAppState } from '../useAppState';
import { NpcBadge } from './Chat';
import { PanelHead } from './PanelHead';

export type MissionView =
  | { v: 'area' }
  | { v: 'work' }
  | { v: 'scene' }
  | { v: 'previews' }
  | { v: 'card'; id: string; prefer?: Variant; bookmark?: boolean }
  | { v: 'other'; from: string }
  | { v: 'empty' };

/** 이 화면 밖으로 이어지는 일. flow.ts가 채운다(화면끼리 직접 부르지 않으려고). */
export const missionLinks: { direct?: () => void } = {};

const AREAS: CategoryId[] = ['daily', 'academic', 'work'];
type Choice = { label: string; run: () => void };

/** 카드의 주민 얼굴(새싹이는 새싹이 그림) */
export function MissionFace({ who }: { who: Speaker }) {
  return who === 'sprout' ? <SproutImg /> : <NpcBadge id={who} />;
}

/** 주민 한마디. 아래 작은 글은 단계·조건 같은 덧붙임 */
function Say({ who, text, sub }: { who: Speaker; text: string; sub?: string }) {
  return (
    <div className="mission-say">
      <MissionFace who={who} />
      <p>
        {text}
        {sub && <small>{sub}</small>}
      </p>
    </div>
  );
}

function Links({ items }: { items: Choice[] }) {
  return (
    <div className="mission-links">
      {items.map((c) => (
        <button key={c.label} type="button" className="link-btn" onClick={c.run}>{c.label}</button>
      ))}
    </div>
  );
}

/** 카드 목록(미리보기·다른 걸 할래) */
function Rows({ list, detail, onPick }: { list: Mission[]; detail: (m: Mission) => string; onPick: (m: Mission) => void }) {
  return (
    <ul className="mission-list">
      {list.map((m) => (
        <li className="mission-row" key={m.id}>
          <div className="mission-info">
            <strong>{m.name}</strong>
            <small>{detail(m)}</small>
          </div>
          <button type="button" className="btn-chip btn-chip-primary" onClick={() => onPick(m)}>{copy.mission.pick}</button>
        </li>
      ))}
    </ul>
  );
}

/** 처음 보여 줄 화면: 영역이 없으면 영역, 업무복귀인데 복귀 상태를 모르면 묻고, 표지판·마지막 카드가 있으면 그 카드, 없으면 장면. */
function firstView(): MissionView {
  const s = store.state;
  const cat = s.missions.category;
  if (!cat) return { v: 'area' };
  if (cat === 'work' && s.missions.workStatus === 'unknown') return { v: 'work' };
  const st = startCard(s, todayKey());
  return st ? { v: 'card', id: st.missionId, prefer: st.variant, bookmark: st.bookmark } : { v: 'scene' };
}

function MissionFlow({ start }: { start: MissionView }) {
  const s = useAppState();
  const date = todayKey();
  const [view, setView] = useState<MissionView>(start);
  const [trail, setTrail] = useState<MissionView[]>([]);
  const go = (next: MissionView) => {
    setTrail((t) => [...t, view]);
    setView(next);
  };
  const back = trail.length > 0
    ? () => {
        setView(trail[trail.length - 1]);
        setTrail(trail.slice(0, -1));
      }
    : undefined;
  const shell = (title: string, body: ReactNode) => (
    <section className="panel mission" role="dialog" aria-label={title}>
      <PanelHead title={title} left={back ? <IconBtn name="back" label={copy.panel.back} onClick={back} /> : undefined} />
      {body}
    </section>
  );

  // 쉬는 날·하루 상한: 카드 대신 안내만 보여 준다.
  if (isResting(s, date)) {
    return shell(copy.mission.title, (
      <>
        <p className="panel-message">{copy.card.resting}</p>
        <button type="button" className="btn btn-primary" onClick={() => store.update((d) => undoRest(d, date))}>{copy.card.unrest}</button>
      </>
    ));
  }
  if (limitReached(s, date)) {
    return shell(copy.mission.title, (
      <>
        <p className="panel-message">{copy.card.enough}</p>
        <p className="panel-note">{copy.card.enoughSub}</p>
      </>
    ));
  }

  const rest = () => {
    store.update((d) => chooseRest(d, date));
    closeModal();
  };
  const direct = () => missionLinks.direct?.();
  /** 카드를 연다. 지금 조건에 안 맞으면 다른 카드로(방금 바꾼 영역·장면이 반영되게 store.state를 읽는다). */
  const openCard = (id: string, prefer?: Variant) => {
    const m = missionById(id);
    const cat = store.state.missions.category;
    go(m && cat && fits(store.state, date, m, cat) ? { v: 'card', id, prefer } : { v: 'other', from: id });
  };
  const empty = () => shell(copy.mission.title, (
    <>
      <Say who="nuri" text={copy.mission.emptyAsk} />
      <button type="button" className="btn btn-secondary" onClick={() => go({ v: 'scene' })}>{copy.mission.otherScene}</button>
      <button type="button" className="btn btn-secondary" onClick={direct}>{copy.mission.direct}</button>
      <button type="button" className="btn btn-secondary" onClick={closeModal}>{copy.mission.toGarden}</button>
    </>
  ));

  switch (view.v) {
    case 'area':
      return shell(copy.mission.title, (
        <>
          <Say who="nuri" text={copy.mission.areaAsk} />
          <div className="mission-grid">
            {AREAS.map((c) => (
              <button
                key={c}
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  store.update((d) => chooseArea(d, c));
                  go(c === 'work' ? { v: 'work' } : firstView());
                }}
              >
                <strong>{copy.mission.area[c]}</strong>
                <small>{copy.mission.areaNote[c]}</small>
              </button>
            ))}
          </div>
          <Links items={[{ label: copy.mission.gardenFirst, run: closeModal }]} />
        </>
      ));
    case 'work':
      return shell(copy.mission.area.work, (
        <>
          <Say who="nuri" text={copy.mission.workAsk} />
          <div className="mission-grid">
            {(['pre_return', 'returned'] as const).map((w) => (
              <button
                key={w}
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  store.update((d) => chooseWorkStatus(d, w));
                  go(firstView());
                }}
              >
                <strong>{copy.mission.work[w]}</strong>
              </button>
            ))}
          </div>
        </>
      ));
    case 'scene': {
      const cat = s.missions.category ?? 'daily';
      const choices: Choice[] =
        cat === 'daily'
          ? FIRST.daily.scenes.map((sc) => ({
              label: sc.label,
              run: () => {
                store.update((d) => chooseIntent(d, 'daily', missionById(sc.missionId)?.intentIds[0] ?? null));
                openCard(sc.missionId);
              },
            }))
          : cat === 'academic'
            ? FIRST.academic.targets.map((t) => ({
                label: t.label,
                run: () => {
                  store.update((d) => chooseIntent(d, 'academic', t.intent));
                  openCard(FIRST.academic.missionId);
                },
              }))
            : FIRST.work[s.missions.workStatus === 'returned' ? 'returned' : 'pre_return'].map((sc) => ({ label: sc.label, run: () => openCard(sc.missionId) }));
      const previews: Choice[] = cat === 'daily'
        ? [{ label: copy.mission.previews, run: () => { store.update((d) => chooseIntent(d, 'daily', null)); go({ v: 'previews' }); } }]
        : [];
      return shell(copy.mission.area[cat], (
        <>
          <Say who="nuri" text={copy.mission.sceneAsk[cat]} />
          <div className="mission-scenes">
            {choices.map((c) => <button key={c.label} type="button" className="btn btn-secondary" onClick={c.run}>{c.label}</button>)}
          </div>
          <Links items={[...previews, { label: copy.mission.changeArea, run: () => go({ v: 'area' }) }, { label: copy.mission.direct, run: direct }]} />
        </>
      ));
    }
    case 'previews':
      return shell(copy.mission.area.daily, (
        <>
          <Say who="nuri" text={copy.mission.previewsAsk} />
          <Rows list={previewCards(s, date)} detail={(m) => copy.mission.when(m.conditionSummary)} onPick={(m) => openCard(m.id)} />
          <Links items={[{ label: copy.mission.noneFit, run: () => go({ v: 'empty' }) }]} />
        </>
      ));
    case 'card': {
      const m = missionById(view.id);
      if (!m) return empty();
      const vs = eligibleVariants(s, date, m);
      const prefer = view.prefer && vs.includes(view.prefer) ? view.prefer : preferred(s, date, m);
      const order: Variant[] = prefer === 'small' ? ['small', 'basic'] : ['basic', 'small'];
      const pick = (v: Variant) => {
        let ok = false as boolean;
        store.update((d) => {
          ok = chooseMission(d, date, { missionId: m.id, variant: v });
        });
        if (ok) closeModal();
      };
      const sub = [view.bookmark ? copy.mission.fromBookmark : '', copy.mission.stage(m.stage, m.stageName), copy.mission.when(m.conditionSummary)]
        .filter(Boolean)
        .join(' · ');
      return shell(m.name, (
        <>
          <Say who={m.npc} text={m.dialogue} sub={sub} />
          <div className="mission-variants">
            {order.filter((v) => vs.includes(v)).map((v) => (
              <button key={v} type="button" className={`btn ${v === prefer ? 'btn-primary' : 'btn-secondary'}`} onClick={() => pick(v)}>
                <strong>{v === 'basic' ? copy.mission.basic : copy.mission.small}</strong>
                <small>{actionText(m, v)}</small>
              </button>
            ))}
          </div>
          <div className="btn-pair">
            <button type="button" className="btn btn-secondary" onClick={() => go({ v: 'other', from: m.id })}>{copy.mission.other}</button>
            <button type="button" className="btn btn-secondary" onClick={rest}>{copy.mission.rest}</button>
          </div>
          <Links
            items={[
              { label: copy.mission.notApplicable, run: () => { store.update((d) => markNotApplicable(d, date, m.id)); go({ v: 'other', from: m.id }); } },
              { label: copy.mission.changeArea, run: () => go({ v: 'area' }) },
              { label: copy.mission.direct, run: direct },
            ]}
          />
        </>
      ));
    }
    case 'other': {
      const list = alternatives(s, date, view.from);
      if (list.length === 0) return empty();
      return shell(copy.mission.other, (
        <>
          <Say who="nuri" text={copy.mission.otherAsk} />
          <Rows list={list} detail={(m) => actionText(m, preferred(s, date, m))} onPick={(m) => openCard(m.id)} />
          <Links
            items={[
              { label: copy.mission.otherScene, run: () => go({ v: 'scene' }) },
              { label: copy.mission.direct, run: direct },
              { label: copy.mission.rest, run: rest },
            ]}
          />
        </>
      ));
    }
    default:
      return empty();
  }
}

/** 카드 흐름을 연다. view가 없으면 처음 화면(영역 → 표지판·마지막 카드 → 장면). */
export function openMission(view?: MissionView): void {
  openModal(<MissionFlow start={view ?? firstView()} />);
}
```

- [ ] **Step 5: 내가 직접 만들래** — `src/ui/panels/Direct.tsx` (새로)

```tsx
// 내가 직접 만들래: 하고 싶은 일·언제·내 기준을 적어 오늘 계획으로 남긴다. 해내면 미션 카드와 같은 회차 규칙(씨앗 1개)을 따른다.
import { useState } from 'react';
import { todayKey } from '../../core/clock';
import { copy } from '../../core/copy';
import { designPlan, limitReached, setPlan, WHEN_OPTIONS } from '../../core/rules';
import { store } from '../../core/store';
import { closeModal, openModal } from '../modal';
import { useAppState } from '../useAppState';
import { PanelHead } from './PanelHead';

/** [미션 카드 보기]로 돌아가기. flow.ts가 채운다(화면끼리 직접 부르지 않으려고). */
export const directLinks: { cards?: () => void } = {};

function Direct() {
  const s = useAppState();
  const date = todayKey();
  // 이미 직접 세운 계획이 있으면 그 값으로 시작한다.
  const [mine] = useState(() => {
    const plan = store.state.days[date]?.plan;
    return plan?.source === 'design' ? plan : undefined;
  });
  const [wish, setWish] = useState(mine?.text ?? '');
  const [when, setWhen] = useState<string>(mine?.info.when ?? WHEN_OPTIONS[0]);
  const [criterion, setCriterion] = useState(mine?.info.criterion ?? '');
  if (limitReached(s, date)) {
    return (
      <section className="panel direct" role="dialog" aria-label={copy.mission.direct}>
        <PanelHead title={copy.mission.direct} />
        <p className="panel-message">{copy.card.enough}</p>
        <p className="panel-note">{copy.card.enoughSub}</p>
      </section>
    );
  }
  const save = () => {
    const p = designPlan(wish, when, criterion);
    if (!p) return;
    let ok = false as boolean;
    store.update((d) => {
      ok = setPlan(d, date, p);
    });
    if (ok) closeModal();
  };
  return (
    <section className="panel direct" role="dialog" aria-label={copy.mission.direct}>
      <PanelHead title={copy.mission.direct} />
      <label className="field">
        <span>{copy.design.wish}</span>
        <input
          id="design-wish"
          className="text-input"
          type="text"
          maxLength={40}
          value={wish}
          placeholder={copy.design.wishPlaceholder}
          aria-label={copy.design.wish}
          onChange={(e) => setWish(e.target.value)}
        />
      </label>
      <div className="field-row">
        <label className="field narrow">
          <span>{copy.design.when}</span>
          <select id="design-when" className="text-input" aria-label={copy.design.when} value={when} onChange={(e) => setWhen(e.target.value)}>
            {WHEN_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{copy.design.criterion}</span>
          <input
            id="design-criterion"
            className="text-input"
            type="text"
            maxLength={40}
            value={criterion}
            placeholder={copy.design.criterionPlaceholder}
            aria-label={copy.design.criterion}
            onChange={(e) => setCriterion(e.target.value)}
          />
        </label>
      </div>
      <p className="panel-note">{copy.design.note}</p>
      <div className="btn-pair">
        <button type="button" className="btn btn-primary" disabled={wish.trim() === ''} onClick={save}>{copy.design.save}</button>
        <button type="button" className="btn btn-secondary" onClick={() => directLinks.cards?.()}>{copy.design.again}</button>
      </div>
    </section>
  );
}

export const openDirect = () => openModal(<Direct />);
```

- [ ] **Step 6: 정원 위 카드** — `src/ui/Hud.tsx`

import에 더한다: `import { actionText, missionById } from '../core/missions';`, `import { MissionFace } from './panels/Mission';`. `ActivityCard`의 `body` 계산 전체를 바꾼다:

```tsx
  let body;
  if (isResting(s, date)) {
    body = (
      <>
        <p className="card-message">{copy.card.resting}</p>
        <p className="card-sub">{copy.card.restingSub}</p>
        <button type="button" className="btn btn-secondary" onClick={emit('mission')}>{copy.card.unrest}</button>
      </>
    );
  } else if (limitReached(s, date)) {
    body = (
      <>
        <p className="card-message">{copy.card.enough}</p>
        <p className="card-sub">{copy.card.enoughSub}</p>
      </>
    );
  } else if (plan) {
    // 미션 카드면 주민 얼굴·고른 행동·[했어], 직접 적은 일·예전 활동이면 언제·기준
    const m = missionById(plan.missionId);
    body = (
      <>
        <div className="card-activity">
          {m ? <MissionFace who={m.npc} /> : <ActivityImg id={plan.activityId} className="card-icon" />}
          <div>
            <strong>{m?.name ?? activityById(plan.activityId)?.name ?? plan.text ?? ''}</strong>
            <small className="card-action">
              {m && plan.variant ? actionText(m, plan.variant) : [plan.info.when, plan.info.where || plan.info.criterion].filter(Boolean).join(' · ')}
            </small>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={emit('done')}>{m?.buttonLabel ?? copy.card.done}</button>
        <button type="button" className="btn btn-secondary" onClick={emit('mission-other')}>{copy.card.other}</button>
      </>
    );
  } else {
    body = (
      <>
        <p className="card-message">{copy.card.empty}</p>
        <p className="card-sub" />
        <button type="button" className="btn btn-primary" onClick={emit('mission')}>{copy.card.pick}</button>
      </>
    );
  }
```

- [ ] **Step 7: 기록·회고에 카드 표시** — `src/ui/panels/Records.tsx`, `src/ui/panels/Reflect.tsx`

Records: `import { activityById } from '../../core/activities';`를 지우고, `import { missionById, recordText } from '../../core/missions';`, `import { MissionFace } from './Mission';`를 더하고, stats import를 `import { groupByDate, logName, weekKindsCount } from '../../core/stats';`로 바꾼 뒤 `LogRow`를 바꾼다:

```tsx
function LogRow({ l }: { l: LogEntry }) {
  const m = missionById(l.missionId);
  const sub = m && l.variant ? recordText(m, l.variant) : [l.plan.when, l.plan.where || l.plan.criterion].filter(Boolean).join(' · ');
  return (
    <li className="rec-item">
      <span className="mission-icon">{m ? <MissionFace who={m.npc} /> : <ActivityImg id={l.activityId} />}</span>
      <div className="mission-info">
        <strong>{logName(l)}</strong>
        <small>{sub}</small>
        {l.chips.length > 0 && <small className="rec-chips">{l.chips.map((c) => copy.records.chip[c]).join(' · ')}</small>}
      </div>
    </li>
  );
}
```

Reflect: import에 `import { missionById } from '../../core/missions';`, `import { MissionFace } from './Mission';`를 더하고, `const activity = activityById(plan.activityId);`를 `const m = missionById(plan.missionId);`로, `<p className="reflect-activity">` 안을 바꾼다:

```tsx
      <p className="reflect-activity">
        {m ? <MissionFace who={m.npc} /> : <ActivityImg id={plan.activityId} />}
        <span>{m?.name ?? activityById(plan.activityId)?.name ?? plan.text ?? ''}</span>
      </p>
```

- [ ] **Step 8: 흐름 잇기** — `src/ui/flow.ts` 전체를 바꾼다

```ts
// 화면 사이의 흐름: 하루 첫 여력 체크 → 미션 카드 고르기 → 했어 → 회고 → 정원 변화.
import { todayKey } from '../core/clock';
import { copy } from '../core/copy';
import { events } from '../core/events';
import { canHarvest, harvest } from '../core/economy';
import { closeSession, isResting, limitReached, pendingPacketCount, pendingPacketDates, reportAction } from '../core/rules';
import { factLineFor } from '../core/stats';
import { markReturnSeen, needsIntro, nextSceneFor, returnScene, type NpcSpeaker, type StoryAfter } from '../core/story';
import { store } from '../core/store';
import type { ReflectChip } from '../core/types';
import { openBag } from './panels/Bag';
import { chatActions, openChat } from './panels/Chat';
import { showCheckin } from './panels/Checkin';
import { enterDecorate } from './panels/Decorate';
import { directLinks, openDirect } from './panels/Direct';
import { missionLinks, openMission } from './panels/Mission';
import { openPacketModal } from './panels/Packet';
import { openRecords } from './panels/Records';
import { openReflect } from './panels/Reflect';
import { openSettings } from './panels/Settings';
import { openShop } from './panels/Shop';
import { openStory } from './panels/Story';
import { startSound } from './sound';
import { showToast } from './toast';

let justCompleted = false;

function complete(chips: ReflectChip[]): void {
  const date = todayKey();
  justCompleted = true; // 정원 변화 연출이 끝난 뒤에 주머니를 보여준다
  let result = null as ReturnType<typeof reportAction>;
  store.update((d) => {
    result = reportAction(d, date, chips);
    if (result) closeSession(d); // [더 해 볼래]가 생기기 전(Task 5)까지는 한 행동마다 회차를 닫는다.
  });
  if (!result) return;
  const { log } = result;
  const lines = [factLineFor(store.state.logs, log, date)];
  if (limitReached(store.state, date)) lines.push(copy.card.enough + '.');
  if (chips.length === 0) lines.push(copy.speak(copy.talk.npc.nuri.name, copy.lines.skipReflect));
  showToast(lines.filter(Boolean));
  events.emit('celebrate', { item: null });
}

function checkinIfNeeded(): void {
  if (!store.state.days[todayKey()]?.energy) showCheckin();
}

/** 꽃이 핀 식물에서 열매를 딴다. 나무는 자리에 남고, 꽃은 창고로 간다. */
function harvestPlant(id: string): void {
  let got = 0;
  store.update((d) => {
    got = harvest(d, id, todayKey());
  });
  if (got > 0) {
    const stayed = store.state.garden.plants.some((p) => p.id === id); // 나무는 자리에 남는다
    showToast([stayed ? copy.harvest.doneTree(got) : copy.harvest.done(got), copy.speak(copy.talk.npc.moru.name, copy.lines.harvested)]);
    events.emit('harvested', { id });
  }
}

/** 지금 세운 계획을 다시 본다: 카드면 그 카드, 직접 적은 일이면 직접 만들기 창, 없으면 카드 흐름 처음. */
function openPlan(): void {
  const plan = store.state.days[todayKey()]?.plan;
  if (plan?.missionId) openMission({ v: 'card', id: plan.missionId, prefer: plan.variant });
  else if (plan?.source === 'design') openDirect();
  else openMission();
}

/** 정원 위 카드의 [다른 걸 할래]: 고른 카드가 있으면 같은 단계의 다른 카드, 아니면 카드 흐름 처음. */
function otherMission(): void {
  const id = store.state.days[todayKey()]?.plan?.missionId;
  openMission(id ? { v: 'other', from: id } : undefined);
}

/** 이야기 장면이 끝난 뒤 이어지는 화면. 패널끼리 직접 부르지 않도록 여기서만 연다. */
function runAfter(after: StoryAfter): void {
  const today = todayKey();
  if (after === 'packet') openPacketModal();
  else if (after === 'seeds') pendingPacketCount(store.state) > 0 ? openPacketModal() : openBag('seeds');
  else if (after === 'activity' || after === 'daily') openMission(); // 지난 활동 다시 = 표지판 또는 그 영역의 마지막 카드
  else if (after === 'design') openDirect();
  else if (after === 'plan') openPlan();
  else if (after === 'shop') openShop();
  else if (after === 'book') openRecords('book');
  else if (after === 'gift') openRecords('stamps');
  else if (after === 'harvest') {
    store.state.garden.plants.filter((p) => canHarvest(p, today, store.state.days)).forEach((p) => harvestPlant(p.id));
  }
}

/** 주민을 누르면: 열린 이야기 장면이 있으면 그 장면, 없으면 평소 대사(끝에 그 주민의 일로 이어짐). */
function meetNpc(id: NpcSpeaker): void {
  const scene = nextSceneFor(store.state, id, todayKey());
  if (scene) openStory(scene, (after) => after && runAfter(after));
  else openChat(id);
}

/** 새 하루의 첫 진입(데모 모드의 [다음 날로] 뒤에도). 오랜만이면 복귀 장면을 먼저, 그다음 여력 체크. */
export function afterDayChange(): void {
  const today = todayKey();
  const scene = returnScene(store.state, today);
  if (!scene) return checkinIfNeeded();
  store.update((d) => markReturnSeen(d, today));
  openStory(scene, (after) => (after ? runAfter(after) : checkinIfNeeded()));
}

export function startFlow(): void {
  events.on('hud-action', ({ id }) => {
    if (id === 'talk') meetNpc('nuri');
    else if (id === 'shop') openShop();
    else if (id === 'gift') openRecords('stamps');
    else if (id === 'mission') openMission();
    else if (id === 'mission-other') otherMission();
    else if (id === 'records') openRecords();
    else if (id === 'decorate') enterDecorate();
    else if (id === 'settings') openSettings();
    else if (id === 'packet') openPacketModal();
    else if (id === 'bag') openBag('seeds');
    else if (id === 'book') openRecords('book');
    else if (id === 'done') openReflect(complete);
  });
  // 주민을 누르면 그 주민과 이야기하고, 대화창의 버튼으로 그 주민의 일로 이어진다.
  chatActions.nuri = () => openBag('seeds');
  chatActions.moru = openShop;
  chatActions.pio = () => openRecords('book');
  // 카드 흐름 ↔ 직접 만들기
  missionLinks.direct = openDirect;
  directLinks.cards = () => openMission();
  events.on('npc-talk', ({ id }) => meetNpc(id));
  // 꽃이 핀 식물을 누르면 열매를 한 번 딴다.
  events.on('plant-tap', ({ id }) => harvestPlant(id));
  // 쉬는 날이면 새싹이도 같이 쉰다. 마음이 바뀌면 다시 일어난다.
  let wasResting = isResting(store.state, todayKey());
  store.subscribe(() => {
    const resting = isResting(store.state, todayKey());
    if (resting !== wasResting) events.emit('sprout-pose', { pose: resting ? 'rest' : 'idle' });
    wasResting = resting;
  });
  // 주머니가 새로 도착하면(회차를 마친 직후) 잠시 뒤에 알려준다. 못 열어도 왼쪽 위 버튼에 남는다.
  const arrived = () => pendingPacketDates(store.state).length + store.state.sessionPackets;
  let pending = arrived();
  store.subscribe(() => {
    const n = arrived();
    if (n > pending) {
      window.setTimeout(openPacketModal, justCompleted ? 3400 : 800);
      justCompleted = false;
    }
    pending = n;
  });
  startSound();
  const begin = () => afterDayChange();
  if (needsIntro(store.state)) openStory('intro', (after) => (after === 'packet' ? openPacketModal() : begin()));
  else begin();
}
```

- [ ] **Step 9: 옛 활동 화면과 제안 규칙 지우기**

Run: `rm src/ui/panels/ActivityPanel.tsx src/ui/panels/PlanDetail.tsx` (git 색인은 건드리지 않는다. 커밋은 사용자가 요청할 때만)

`src/core/rules.ts`: `candidates`·`suggest`·`swapCandidate`·`makeSmaller`·`PastItem`·`pastItems`·`tabHints`·`defaultPlanInfo` 함수와 `PLACE_OPTIONS` 상수를 지우고, 맨 위 import 네 줄(`activities`·`random`·`plants`·`types`)을 아래 두 줄로 바꾼다:

```ts
import { drawPlant } from './plants';
import type { AppState, DayInfo, DecorItem, Energy, LogEntry, MissionSession, Plan, PlantedItem, ReflectChip, SeedItem } from './types';
```

맨 위 주석의 "더 작게, "를 지운다. `src/core/activities.ts`의 `smallerOf` 함수를 지운다(주석: `// 옛 활동 16개. 지금은 예전 기록과 예전 계획을 보여 줄 때만 쓴다.`를 import 위에 더한다).

`src/tests/rules.test.ts`: `'무거운 날은…'`, `'보통인 날은…'`, `'바꾸기는…'`, `'더 작게는…'`, `'해본 활동은…'`, `'탭은 잠기지 않고…'` 테스트 6개를 지우고, `import { activities } from '../core/activities';` 줄을 지우고, 맨 위 두 import를 바꾼다(`plants`·`rng`·`createState`·`Plan` import는 그대로):

```ts
import { describe, expect, it } from 'vitest';
import {
  chooseRest, closeSession, DAILY_LIMIT, designPlan, flipDecor, limitReached, openPacket, openSessionPacket, pendingPacketCount,
  pendingPacketDates, plantSeed, reportAction, sessionHasActions, setPlan, settleOldSession, storeDecor, storePlant, takeFromStorage,
} from '../core/rules';
```

- [ ] **Step 10: 모양** — `src/styles/overlay.css`

지운다: `.mission-actions { … }` 한 줄, `.detail`부터 `.detail-alt`까지 10줄(`.chip-select` 포함), `.tab .hint { … }` 4줄, `.mission-list.scrolling { … }` 한 줄. 파일 끝에 더한다:

```css
/* ---- 미션 카드 ---- */
.mission-say { display: flex; align-items: center; gap: 10px; margin: 8px 2px 6px; }
.mission-say .npc-face, .mission-say .sprout-icon { width: 44px; height: 44px; flex: none; }
.mission-say p { margin: 0; font-size: 14px; line-height: 1.4; word-break: keep-all; }
.mission-say small { display: block; margin-top: 2px; font-size: 11px; color: var(--ink-soft); }
.mission-grid, .mission-variants { display: flex; gap: 6px; }
.mission-grid .btn, .mission-variants .btn { flex: 1 1 0; flex-direction: column; gap: 2px; min-height: 64px; margin-top: 0; }
.mission-grid .btn small, .mission-variants .btn small { font-size: 11px; font-weight: 400; line-height: 1.3; word-break: keep-all; }
.mission-scenes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.mission-scenes .btn { margin-top: 0; font-size: 13px; }
.mission .btn-pair { margin-top: 6px; }
.mission-links { display: flex; justify-content: center; flex-wrap: wrap; gap: 0 10px; }
.mission-links .link-btn { font-size: 12px; padding: 0 4px; }
.card-activity .card-action { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.card-activity .npc-face, .card-activity .sprout-icon { width: 36px; height: 36px; flex: none; }
.reflect-activity .npc-face, .reflect-activity .sprout-icon { width: 40px; height: 40px; }
```

`src/styles/art.css`: `.detail-art { font-size: 0; }`, `.detail-img { … }`, `.mission-actions .btn-chip { … }` 세 줄을 지운다.

- [ ] **Step 11: 테스트·빌드**

Run: `npm test && npm run build`
Expected: 모두 통과(옛 제안 테스트 6개가 빠진 수), 빌드 성공. `grep -rn "ActivityPanel\|PlanDetail\|openActivityPanel\|copy\.tabs\|copy\.daily\|other-activity\|plan-check" src`가 아무것도 찾지 않아야 한다.

- [ ] **Step 12: 화면 확인** — `$SHOTS/task4.steps.json`에 쓰고 헤드리스로 찍는다

```json
[
  {"js": "(()=>{localStorage.clear();location.href=location.pathname+'?nostory';})()", "wait": 3000},
  {"click": "보통이에요", "wait": 600, "shot": "01_home"},
  {"click": "미션 해보기", "sel": ".activity-card button", "wait": 500, "shot": "02_area"},
  {"click": "일상", "wait": 400, "shot": "03_scene_daily"},
  {"click": "마실 것", "wait": 400, "shot": "04_card_d01"},
  {"click": "다른 걸 할래", "sel": ".panel button", "wait": 400, "shot": "05_other_empty"},
  {"js": "document.querySelector('.icon-btn[aria-label=\"뒤로\"]').click()", "wait": 300},
  {"click": "이만큼 할래", "wait": 600, "shot": "06_hud_planned"},
  {"click": "했어", "sel": ".activity-card button", "wait": 500, "shot": "07_reflect"},
  {"click": "남기기", "wait": 900, "shot": "08_toast"},
  {"wait": 4200, "shot": "09_packet"},
  {"click": "씨앗함에 보관", "wait": 600},
  {"click": "수첩", "sel": ".hud-btn", "wait": 400, "shot": "10_records"},
  {"js": "document.querySelector('.icon-btn[aria-label=\"닫기\"]').click()", "wait": 300},
  {"click": "미션 해보기", "sel": ".activity-card button", "wait": 500, "shot": "11_card_again"},
  {"click": "해당 없어요", "wait": 400, "shot": "12_not_applicable"},
  {"click": "다른 장면 고르기", "wait": 400},
  {"click": "영역 바꾸기", "wait": 400},
  {"click": "업무복귀", "wait": 400, "shot": "13_work_status"},
  {"click": "복귀 전", "wait": 400, "shot": "14_scene_work"},
  {"click": "안내 없음", "wait": 400, "shot": "15_card_w03"},
  {"click": "내가 직접 만들래", "wait": 400, "shot": "16_direct"},
  {"js": "(()=>{localStorage.clear();location.href=location.pathname+'?nostory';})()", "wait": 3000},
  {"click": "조금 무거워요", "wait": 600},
  {"click": "미션 해보기", "sel": ".activity-card button", "wait": 500},
  {"click": "학업", "wait": 400, "shot": "17_scene_academic"},
  {"click": "시험 자료", "wait": 400, "shot": "18_card_a01_heavy"}
]
```

Run: `npm run build && node tools/screenshot.mjs $SHOTS/shots-task4 $SHOTS/task4.steps.json "file://$PWD/dist/index.html"`
Expected: `NOT FOUND` 줄이 없고, 사진에서 — 02 영역 3개 + "정원 먼저 둘러보기", 03 장면 9개(3열) + 링크, 04 D01 카드(느리 얼굴·조건·두 크기·버튼이 패널 안), 05 "지금 맞는 카드가 없네", 06 정원 위 카드에 "쓸 컵 준비하기"와 고른 행동, 07 회고에 느리 얼굴, 08 "이번 주 쓸 컵 준비하기 1번째예요.", 09 씨앗 봉투, 10 수첩에 기록 문장, 11 D01 카드가 바로, 12 해당 없어요 뒤 빈 화면, 15 W03 카드, 16 직접 만들기, 18 A01 카드에서 "더 작게 할래"가 먼저(초록). 패널 아래가 잘리면 CSS 간격을 줄인다.

---

### Task 5: 더 해 볼래 · 여기까지 · 다음 길 · 표지판

**Files:**
- Modify: `src/ui/panels/Mission.tsx`, `src/ui/panels/Reflect.tsx`, `src/ui/flow.ts`, `src/ui/Hud.tsx`, `src/core/events.ts`, `src/core/copy.ts`
- Modify: `tools/screenshot.steps.example.json`

**Interfaces:**
- Consumes: `lastStep`·`moreAfter`·`advanceStage`·`bookmarkSuggestion`·`saveBookmark`(missions), `sessionHasActions`·`settleOldSession`·`closeSession`(rules)
- Produces (Mission.tsx): `MissionView`에 `{ v: 'cross'; from; to }`·`{ v: 'end'; from }`, `missionLinks.end?: () => void`, `openMore(): void`, `openBookmark(step: MissionStep, onDone: (save: boolean) => void): void`
- Produces (Reflect.tsx): `type AfterReflect = 'end' | 'more'`, `openReflect(onDone: (chips, then: AfterReflect) => void)`
- Produces (events.ts): `HudAction`에 `'session-more' | 'session-end'`

- [ ] **Step 1: 문구** — `src/core/copy.ts`

`reflect`의 `save`·`skip`을 지우고 `end: '여기까지',`·`more: '더 해 볼래',`를 더한다. `card`에 더한다:

```ts
    between: '한 걸음 남겼어요',
    betweenSub: '더 해도 되고, 여기서 마쳐도 돼요.',
    more: '더 해 볼래',
    end: '여기까지',
```

- [ ] **Step 2: HUD 행동** — `src/core/events.ts`

```ts
export type HudAction =
  | 'records' | 'decorate' | 'settings' | 'talk' | 'mission' | 'mission-other' | 'done' | 'session-more' | 'session-end'
  | 'packet' | 'shop' | 'bag' | 'book' | 'gift';
```

- [ ] **Step 3: 회고** — `src/ui/panels/Reflect.tsx` 전체를 바꾼다

```tsx
// [했어] 다음: 해보니 어땠는지(칩, 안 골라도 된다) + [여기까지](회차를 닫는다) / [더 해 볼래](같은 회차에서 다음 카드).
import { useState } from 'react';
import { activityById } from '../../core/activities';
import { todayKey } from '../../core/clock';
import { copy } from '../../core/copy';
import { missionById } from '../../core/missions';
import { store } from '../../core/store';
import type { ReflectChip } from '../../core/types';
import { ActivityImg } from '../icons';
import { closeModal, openModal } from '../modal';
import { MissionFace } from './Mission';

export type AfterReflect = 'end' | 'more';

const CHIPS: { id: ReflectChip; label: string }[] = [
  { id: 'achieved', label: copy.reflect.achieved },
  { id: 'easier', label: copy.reflect.easier },
  { id: 'again', label: copy.reflect.again },
];

function Reflect({ onDone }: { onDone: (chips: ReflectChip[], then: AfterReflect) => void }) {
  const plan = store.state.days[todayKey()]?.plan;
  const [picked, setPicked] = useState<ReflectChip[]>([]);
  if (!plan) return null;
  const m = missionById(plan.missionId);
  const finish = (then: AfterReflect) => {
    closeModal();
    onDone(picked, then);
  };
  const toggle = (id: ReflectChip) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <section className="panel reflect" role="dialog" aria-label={copy.reflect.heading}>
      <h2 className="panel-title">{copy.reflect.heading}</h2>
      <p className="reflect-activity">
        {m ? <MissionFace who={m.npc} /> : <ActivityImg id={plan.activityId} />}
        <span>{m?.name ?? activityById(plan.activityId)?.name ?? plan.text ?? ''}</span>
      </p>
      <p className="panel-note">{copy.reflect.title}</p>
      <div className="chips">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip${picked.includes(c.id) ? ' chip-on' : ''}`}
            aria-pressed={picked.includes(c.id)}
            onClick={() => toggle(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="btn-pair">
        <button type="button" className="btn btn-primary" onClick={() => finish('end')}>{copy.reflect.end}</button>
        <button type="button" className="btn btn-secondary" onClick={() => finish('more')}>{copy.reflect.more}</button>
      </div>
    </section>
  );
}

/** [했어] 다음 단계. 칩은 고르지 않아도 된다. 답을 받아야 닫힌다. */
export function openReflect(onDone: (chips: ReflectChip[], then: AfterReflect) => void): void {
  if (!store.state.days[todayKey()]?.plan) return;
  openModal(<Reflect onDone={onDone} />, false);
}
```

- [ ] **Step 4: 다음 길·끝·표지판 화면** — `src/ui/panels/Mission.tsx`

missions import에 `advanceStage, lastStep, moreAfter`를, rules import에 `sessionHasActions`를, types import에 `MissionStep`을 더한다. `MissionView`에 두 줄을 더한다:

```ts
  | { v: 'cross'; from: string; to: string }
  | { v: 'end'; from: string }
```

`missionLinks`를 바꾼다:

```ts
/** 이 화면 밖으로 이어지는 일(직접 만들기 창, 회차 닫기). flow.ts가 채운다(화면끼리 직접 부르지 않으려고). */
export const missionLinks: { direct?: () => void; end?: () => void } = {};
```

카드 화면의 `[오늘은 쉴래]` 버튼을 바꾼다(해낸 행동이 있는 회차면 [여기까지]):

```tsx
            {sessionHasActions(s, date) ? (
              <button type="button" className="btn btn-secondary" onClick={() => { closeModal(); missionLinks.end?.(); }}>{copy.mission.end}</button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={rest}>{copy.mission.rest}</button>
            )}
```

`switch`의 `default:` 앞에 더한다:

```tsx
    case 'cross': {
      // 단계가 바뀌는 추천: 다음 길(추천 단계를 올린다) 또는 같은 카드를 한 번 더
      const to = missionById(view.to);
      if (!to) return empty();
      return shell(copy.mission.crossTitle, (
        <>
          <Say who="moru" text={copy.mission.crossAsk} sub={`${copy.mission.stage(to.stage, to.stageName)} · ${to.name}`} />
          <button type="button" className="btn btn-primary" onClick={() => { store.update((d) => advanceStage(d, to.id)); openCard(to.id); }}>
            {copy.mission.crossNext}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => openCard(view.from)}>{copy.mission.crossStay}</button>
        </>
      ));
    }
    case 'end':
      // 4단계 안에 이어갈 카드가 없다(5~6단계는 아직 추천하지 않는다)
      return shell(copy.mission.title, (
        <>
          <Say who="moru" text={copy.mission.endAsk} />
          <button type="button" className="btn btn-secondary" onClick={() => openCard(view.from)}>{copy.mission.endStay}</button>
          <button type="button" className="btn btn-secondary" onClick={() => go({ v: 'area' })}>{copy.mission.endArea}</button>
          <button type="button" className="btn btn-secondary" onClick={direct}>{copy.mission.direct}</button>
        </>
      ));
```

파일 끝에 더한다:

```tsx
/** [더 해 볼래]: 줄인 행동만 했으면 같은 카드의 기본, 아니면 다음 카드. 단계가 바뀌면 먼저 묻고, 4단계 끝이면 고르게 한다. */
export function openMore(): void {
  const step = lastStep(store.state);
  if (!step) return openMission(); // 직접 적은 일만 했으면 카드 흐름 처음
  const next = moreAfter(store.state, todayKey(), step);
  if (!next) openMission({ v: 'end', from: step.missionId });
  else if (next.crosses) openMission({ v: 'cross', from: step.missionId, to: next.missionId });
  else openMission({ v: 'card', id: next.missionId, prefer: next.variant });
}

function Bookmark({ step, onDone }: { step: MissionStep; onDone: (save: boolean) => void }) {
  const m = missionById(step.missionId)!;
  const done = (save: boolean) => {
    closeModal();
    onDone(save);
  };
  return (
    <section className="panel mission" role="dialog" aria-label={copy.mission.bookmarkTag}>
      <h2 className="panel-title">{copy.mission.bookmarkTag}</h2>
      <Say who="pio" text={copy.mission.bookmarkAsk(m.name)} sub={actionText(m, step.variant)} />
      <div className="btn-pair">
        <button type="button" className="btn btn-primary" onClick={() => done(true)}>{copy.mission.bookmarkSave}</button>
        <button type="button" className="btn btn-secondary" onClick={() => done(false)}>{copy.mission.bookmarkSkip}</button>
      </div>
    </section>
  );
}

/** [여기까지] 뒤: 다음에 이어갈 작은 행동을 표지판으로 남길지 묻는다(답을 받아야 닫힌다). */
export function openBookmark(step: MissionStep, onDone: (save: boolean) => void): void {
  if (!missionById(step.missionId)) return onDone(false);
  openModal(<Bookmark step={step} onDone={onDone} />, false);
}
```

- [ ] **Step 5: 흐름** — `src/ui/flow.ts`

import를 바꾼다:

```ts
import { bookmarkSuggestion, saveBookmark } from '../core/missions';
import { closeSession, isResting, limitReached, pendingPacketCount, pendingPacketDates, reportAction, settleOldSession } from '../core/rules';
import { missionLinks, openBookmark, openMission, openMore } from './panels/Mission';
import { openReflect, type AfterReflect } from './panels/Reflect';
```

`complete`를 바꾸고 `endSession`을 더한다:

```ts
/** [했어] 다음: 행동을 기록하고, [여기까지]면 회차를 닫고 [더 해 볼래]면 같은 회차에서 다음 카드로. */
function complete(chips: ReflectChip[], then: AfterReflect): void {
  const date = todayKey();
  let result = null as ReturnType<typeof reportAction>;
  store.update((d) => {
    result = reportAction(d, date, chips);
  });
  if (!result) return;
  const lines = [factLineFor(store.state.logs, result.log, date)];
  if (then === 'end' && chips.length === 0) lines.push(copy.speak(copy.talk.npc.nuri.name, copy.lines.skipReflect));
  showToast(lines.filter(Boolean));
  if (then === 'more') openMore();
  else endSession();
}

/** 회차를 닫는다. 이어갈 작은 행동이 있으면 표지판으로 남길지 먼저 묻는다. 씨앗 주머니는 정원 변화 뒤에 뜬다. */
function endSession(): void {
  const date = todayKey();
  const step = bookmarkSuggestion(store.state, date);
  const close = (save: boolean) => {
    justCompleted = true; // 정원 변화 연출이 끝난 뒤에 주머니를 보여준다
    store.update((d) => {
      if (save && step) saveBookmark(d, step);
      closeSession(d);
    });
    if (limitReached(store.state, date)) showToast([copy.card.enough + '.']);
    events.emit('celebrate', { item: null });
  };
  if (step) openBookmark(step, close);
  else close(false);
}
```

`afterDayChange`의 `const today = todayKey();` 다음 줄에 더한다:

```ts
  store.update((d) => settleOldSession(d, today)); // 지난 날 열어 둔 회차는 그날 것으로 정산(씨앗은 받는다)
```

`hud-action` 처리에 두 줄을 더하고 `missionLinks.end`를 채운다:

```ts
    else if (id === 'session-more') openMore();
    else if (id === 'session-end') endSession();
```

```ts
  missionLinks.end = endSession;
```

- [ ] **Step 6: 정원 위 카드의 회차 중 상태** — `src/ui/Hud.tsx`

rules import에 `sessionHasActions`를 더한다. `ActivityCard`의 마지막 `else` 앞에 더한다:

```tsx
  } else if (sessionHasActions(s, date)) {
    // 계획 없이 회차만 열려 있다([더 해 볼래] 뒤 카드를 닫은 경우): 이어 하거나 여기서 마친다.
    body = (
      <>
        <p className="card-message">{copy.card.between}</p>
        <p className="card-sub">{copy.card.betweenSub}</p>
        <div className="btn-pair">
          <button type="button" className="btn btn-primary" onClick={emit('session-more')}>{copy.card.more}</button>
          <button type="button" className="btn btn-secondary" onClick={emit('session-end')}>{copy.card.end}</button>
        </div>
      </>
    );
```

`Hud`의 말풍선 줄을 바꾼다:

```tsx
  const busy = !!s.days[date]?.plan || sessionHasActions(s, date);
  const bubble = isResting(s, date) ? copy.bubble.rest : limitReached(s, date) ? copy.bubble.enough : busy ? copy.bubble.planned : copy.bubble.ask;
```

- [ ] **Step 7: 테스트·빌드**

Run: `npm test && npm run build`
Expected: 모두 통과, 빌드 성공. `grep -rn "reflect\.save\|reflect\.skip" src`가 아무것도 찾지 않아야 한다.

- [ ] **Step 8: 화면 확인** — `$SHOTS/task5.steps.json`에 쓴다

```json
[
  {"js": "(()=>{localStorage.clear();location.href=location.pathname+'?nostory';})()", "wait": 3000},
  {"click": "보통이에요", "wait": 600},
  {"click": "미션 해보기", "sel": ".activity-card button", "wait": 500},
  {"click": "일상", "wait": 400},
  {"click": "마실 것", "wait": 400},
  {"click": "이만큼 할래", "wait": 600},
  {"click": "했어", "sel": ".activity-card button", "wait": 500, "shot": "01_reflect"},
  {"click": "더 해 볼래", "sel": ".reflect button", "wait": 600, "shot": "02_cross"},
  {"click": "다음 길을 볼래", "wait": 400, "shot": "03_card_d06"},
  {"click": "더 작게 할래", "wait": 600, "shot": "04_hud_d06_small"},
  {"click": "했어", "sel": ".activity-card button", "wait": 500},
  {"click": "여기까지", "sel": ".reflect button", "wait": 600, "shot": "05_bookmark"},
  {"click": "남기기", "wait": 900, "shot": "06_after_end"},
  {"wait": 4000, "shot": "07_packet"},
  {"click": "씨앗함에 보관", "wait": 600, "shot": "08_hud_after"},
  {"click": "미션 해보기", "sel": ".activity-card button", "wait": 500, "shot": "09_bookmark_card"},
  {"click": "이만큼 할래", "wait": 600},
  {"click": "했어", "sel": ".activity-card button", "wait": 500},
  {"click": "더 해 볼래", "sel": ".reflect button", "wait": 600, "shot": "10_cross_d11"},
  {"js": "document.querySelector('.icon-btn[aria-label=\"닫기\"]').click()", "wait": 400, "shot": "11_hud_between"},
  {"click": "여기까지", "sel": ".activity-card button", "wait": 600, "shot": "12_bookmark_again"},
  {"click": "건너뛰기", "wait": 900},
  {"js": "(()=>{const s=JSON.parse(localStorage.getItem('plantkeeper:v1'));return {packets:s.sessionPackets,sessions:Object.values(s.days).map(d=>d.sessions),bookmark:s.missions.bookmarks,stage:s.missions.stage};})()"}
]
```

Run: `npm run build && node tools/screenshot.mjs $SHOTS/shots-task5 $SHOTS/task5.steps.json "file://$PWD/dist/index.html"`
Expected: `NOT FOUND` 없음. 02 모루 "다음 길을 볼래?"(2단계 · D06 이름), 03 D06 카드, 05 피오 "다음엔 ‘…’부터 이어 볼까?"(D06의 기본 행동), 07 씨앗 봉투, 09 "지난번 표지판" D06 카드(기본이 먼저), 10 D11로 가는 다음 길 물음(3단계), 11 정원 위 카드 "한 걸음 남겼어요 [더 해 볼래][여기까지]", 12 표지판 물음(D11의 줄인 행동). 마지막 줄은 `js -> {"packets":2,"sessions":[2],"bookmark":{},"stage":{"daily":2,"academic":1,"work":1}}` — 회차 2개에 씨앗 2개, 첫 표지판(D06)은 09에서 골라 쓴 것으로 지워졌고 두 번째는 건너뛰었다. 값이 다르면 흐름을 다시 본다.

- [ ] **Step 9: 예시 단계 파일 갱신** — `tools/screenshot.steps.example.json` 전체를 바꾼다

```json
[{"js": "(()=>{localStorage.clear();location.href=location.pathname+'?nostory&decor&packet=2';})()", "wait": 3000}, {"shot": "00_checkin"}, {"click": "보통이에요", "wait": 600}, {"shot": "01_home"}, {"click": "미션 해보기", "sel": ".activity-card button", "wait": 500, "shot": "02_area"}, {"click": "일상", "wait": 400, "shot": "03_scene"}, {"click": "마실 것", "wait": 400, "shot": "04_card"}, {"click": "이만큼 할래", "wait": 500, "shot": "05_card_planned"}, {"click": "했어", "sel": ".activity-card button", "wait": 500, "shot": "06_reflect"}, {"click": "해냈다는 느낌", "wait": 200}, {"click": "더 해 볼래", "sel": ".reflect button", "wait": 600, "shot": "07_cross"}, {"click": "다음 길을 볼래", "wait": 400, "shot": "08_next_card"}, {"click": "더 작게 할래", "wait": 500}, {"click": "했어", "sel": ".activity-card button", "wait": 500}, {"click": "여기까지", "sel": ".reflect button", "wait": 600, "shot": "09_bookmark"}, {"click": "남기기", "wait": 900, "shot": "10_toast"}, {"wait": 4200, "shot": "11_packet"}, {"click": "열어보기", "wait": 500, "shot": "12_packet_open"}, {"click": "닫기", "sel": ".panel button", "wait": 2500}, {"click": "수첩", "sel": ".hud-btn", "wait": 400, "shot": "13_records"}, {"click": "도감", "sel": ".tab", "wait": 300, "shot": "14_book"}, {"js": "document.querySelector('.icon-btn[aria-label=\"닫기\"]').click()", "wait": 300}, {"click": "설정", "sel": ".hud-btn", "wait": 400, "shot": "15_settings"}, {"js": "document.querySelector('.icon-btn[aria-label=\"닫기\"]').click()", "wait": 300}, {"click": "대화", "sel": ".talk-btn", "wait": 400, "shot": "16_talk"}, {"js": "document.querySelector('.icon-btn[aria-label=\"닫기\"]').click()", "wait": 300}, {"click": "꾸미기", "sel": ".hud-btn", "wait": 900, "shot": "17_decorate"}]
```

---

### Task 6: 프롤로그 끝 영역 묻기 · 문서 · 최종 확인

**Files:**
- Modify: `src/ui/panels/Decorate.tsx`, `src/ui/flow.ts`
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-11-09-missions-card-loop-design.md`

**Interfaces:**
- Produces (Decorate.tsx): `isDecorating(): boolean`

- [ ] **Step 1: 꾸미는 중인지** — `src/ui/panels/Decorate.tsx`의 `exitDecorate` 위에 더한다

```ts
/** 꾸미거나 심을 곳을 고르는 중인지(flow.ts가 화면이 비었는지 볼 때) */
export const isDecorating = (): boolean => on;
```

- [ ] **Step 2: 프롤로그 끝에 영역 묻기** — `src/ui/flow.ts`

import를 더한다: `import { isModalOpen } from './modal';`, Decorate import를 `import { enterDecorate, isDecorating } from './panels/Decorate';`로. `let justCompleted = false;` 아래에 더한다:

```ts
/** 프롤로그 뒤 한 번: 첫 선물(봉투 열기·심기)과 여력 체크가 끝나 화면이 비면 오늘의 영역을 묻는다. "정원 먼저"면 다시 묻지 않는다. */
let askArea = false;
function askAreaWhenIdle(): void {
  window.setTimeout(() => {
    if (!askArea || isModalOpen() || isDecorating()) return;
    if (!store.state.days[todayKey()]?.energy) return showCheckin();
    askArea = false;
    if (!store.state.missions.category) openMission();
  }, 0);
}
```

`startFlow`의 `startSound();` 위에 더한다:

```ts
  // 창이 닫히거나 꾸미기가 끝날 때마다 화면이 비었는지 본다(프롤로그 뒤 영역 묻기).
  events.on('ui-lock', ({ locked }) => {
    if (!locked) askAreaWhenIdle();
  });
```

마지막 줄을 바꾼다:

```ts
  if (needsIntro(store.state)) {
    askArea = true;
    openStory('intro', (after) => (after === 'packet' ? openPacketModal() : begin()));
  } else begin();
```

- [ ] **Step 3: 테스트·빌드**

Run: `npm test && npm run build`
Expected: 모두 통과, 빌드 성공

- [ ] **Step 4: 처음 온 사람 화면 확인** — `$SHOTS/task6.steps.json`에 쓴다

```json
[
  {"js": "(()=>{localStorage.clear();location.href=location.pathname;})()", "wait": 3000, "shot": "01_intro"},
  {"click": "다음", "wait": 300}, {"click": "다음", "wait": 300},
  {"click": "여긴 어떤 곳이야?", "wait": 300},
  {"click": "다음", "wait": 300},
  {"click": "그냥 비워둘래.", "wait": 300},
  {"click": "다음", "wait": 300}, {"click": "다음", "wait": 300},
  {"click": "열어보기", "wait": 300},
  {"click": "닫기", "sel": ".panel .btn", "wait": 900, "shot": "02_packet"},
  {"click": "씨앗 열어보기", "wait": 600},
  {"click": "나중에 심기", "wait": 900, "shot": "03_checkin"},
  {"click": "보통이에요", "wait": 900, "shot": "04_area_after_prologue"},
  {"click": "정원 먼저 둘러보기", "wait": 900, "shot": "05_garden_first"},
  {"click": "미션 해보기", "sel": ".activity-card button", "wait": 500, "shot": "06_area_on_open"}
]
```

Run: `npm run build && node tools/screenshot.mjs $SHOTS/shots-task6 $SHOTS/task6.steps.json "file://$PWD/dist/index.html"`
Expected: 03 여력 체크, 04 느리 "오늘은 어떤 쪽에 한 걸음 남겨 볼까?", 05 창이 다시 뜨지 않은 정원, 06 영역 고르기. "심기"로 두둑을 고르는 길은 헤드리스로 누르기 어려워 사람이 확인한다(심은 뒤 여력 체크 → 영역).

- [ ] **Step 5: CLAUDE.md** — 아래 줄을 바꾼다

17줄:

```md
- 하루에 마치는 회차는 최대 3개(`DAILY_LIMIT`, 씨앗도 하루 최대 3개). 회차는 카드(또는 직접 적은 일)를 고르면 열리고 [여기까지]·쉬기로 닫히며, 해낸 행동이 있으면 씨앗 주머니 1개(몇 개를 했든, 두 번 닫아도 한 번). "오늘은 쉬기"도 정상 선택이고(새싹이도 같이 쉼) 잃는 것이 없다.
```

25줄의 `` `rules.ts`(상한·쉬기·제안·주머니·씨앗함) ``을 `` `rules.ts`(상한·쉬기·회차와 씨앗·주머니·씨앗함) ``으로 바꾸고, 26줄 끝에 이어 쓴다:

```md
  `missions.ts`+`data/missions.json`(팀 미션 90개. 거르기·첫 카드·더 해 볼래·다른 걸 할래·표지판. 1~4단계만 추천하고 추천 단계는 "다음 길을 볼래"로만 오른다. "해당 없어요"는 그날만. 원본은 `docs/missions/`, 데이터는 `python3 -I tools/import_missions.py <원본.json>`으로 다시 만든다. 설계는 `docs/superpowers/specs/2026-11-09-missions-card-loop-design.md`).
```

32줄의 `panels/`(활동·기록·…) 설명 앞에 더한다:

```md
  미션 카드 흐름은 `Mission.tsx` 모달 하나가 영역 → 장면 → 카드 → 다음 길·끝 화면을 바꿔 보여 주고, "내가 직접 만들래"는 `Direct.tsx`. [했어] 뒤 `Reflect.tsx`의 [여기까지]가 회차를 닫고(표지판 물음 → 정원 변화 → 씨앗 주머니), [더 해 볼래]가 같은 회차에서 다음 카드로 간다(`flow.ts`의 `complete`·`endSession`).
```

51줄의 `(대화 끝의 이어짐은 `talkActions`처럼 flow가 채운다)`를 `(이어짐은 `chatActions`·`missionLinks`·`directLinks`처럼 flow가 채운다)`로, 52줄의 `(활동 패널이 가장 빠듯함)`을 `(미션 카드가 가장 빠듯함)`으로 바꾼다.

- [ ] **Step 6: 설계 문서에 구체화한 점** — `docs/superpowers/specs/2026-11-09-missions-card-loop-design.md`의 `## 위험` 앞에 이 계획의 "설계에서 구체화한 점" 10개를 `## 구현하며 구체화한 점(2026-11-09 계획)` 제목으로 옮겨 적고, `## 상태`의 `intent`·`notApplicable` 두 줄을 `intents: Partial<Record<CategoryId, string>>; // 영역별 장면`, `skip: { date: string; facts: string[]; cards: string[] }; // "해당 없어요"(그날만)`로 바꾼다. "가져오는 칸"에서 `done,`을 지우고 이유를 괄호로 단다.

- [ ] **Step 7: 최종 확인**

Run: `npm test && npm run build && node tools/screenshot.mjs $SHOTS/shots-final tools/screenshot.steps.example.json "file://$PWD/dist/index.html"`
Expected: 모두 통과, `NOT FOUND` 없음. 사용자에게 알릴 것: 실제 폰(844×390 가로)에서 카드 화면 높이·버튼 크기, "심기" 뒤 영역 묻기, 씨앗이 하루 3개까지 늘어 밭(16칸)이 빨리 차는지는 사람이 확인해야 한다. 커밋은 사용자가 요청할 때만.
