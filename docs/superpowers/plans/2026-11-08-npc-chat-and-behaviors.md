# 주민 고도화(대화·기록 + 정원 안 행동) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주민(느리·모루·피오)과 채팅형으로 이야기하고 그 대화를 판단 없이 기기 안 수첩에 남기며(A), 정원에서 주민이 새 이야기 표시·다가가면 인사·버릇·쉬는 날 함께 쉬기를 보이게 한다(B).

**Architecture:** 규칙은 `src/core/chat.ts`(순수 함수, Vitest), 문구는 `src/core/copy.ts`, 대화창은 `src/ui/panels/Chat.tsx`(지금의 `Talk.tsx`를 대신), 수첩은 `Records.tsx`에 "이야기" 탭. 정원 행동은 `src/scene/Npc.ts`에 표시·말풍선·버릇·쉬기를 넣고 `GardenScene`이 상태(이야기 장면·쉬는 날)를 읽어 알려 준다. core·scene·ui는 지금처럼 이벤트·store로만 연결한다.

**Tech Stack:** Vite + TypeScript(strict) + React 18 + Phaser 3.90 + Vitest. 화면 확인은 `tools/screenshot.mjs`(헤드리스 Chrome).

**Spec:** `docs/superpowers/specs/2026-11-08-npc-chat-and-behaviors-design.md`

## Global Constraints

- 작업 폴더: 저장소 루트(`식물집사/`). 명령: `npm test`, `npm run build`(= `tsc --noEmit` + vite build).
- **커밋은 사용자가 요청할 때만 한다.** 이 계획의 Task에는 커밋 단계가 없다.
- 문구는 `src/core/copy.ts`에만. `src/tests/copy.test.ts`의 `FORBIDDEN_WORDS` 검사를 통과해야 하고, 함수형 문구는 테스트에 호출 예를 넣는다.
- 주민 말은 반말·짧게(스토리 바이블 말투), 앱 안내 문구는 존댓말. 칭찬("대단해")·마음 추측("힘들었겠다")·모든 말을 "괜찮아"로 끝내기 금지.
- 앱은 대화 내용을 해석·판정하지 않는다: 주민 대답 함수는 사용자의 글을 인자로 받지 않는다.
- 대화 기록(`chats`)은 기기 안 localStorage에만. 통계(`stats.ts`)·디버그 줄에 넣지 않는다. 도움 문구(109·1577-0199)는 이번에 넣지 않는다.
- 화면 844×390에서 패널은 스킨 기준 안쪽 높이 약 358px(`.panel` max-height 388px, 테두리 14px, 간격 8px) 안, 모든 버튼 44px 이상(`--tap`).
- 패널끼리 직접 부르지 않는다. 화면 사이 이어짐은 `src/ui/flow.ts`가 채운다.
- 날짜는 `src/core/clock.ts`의 `todayKey()`만 쓴다.
- 저장 모양을 바꾸면 `src/core/store.ts`의 `loadState`가 예전 저장본을 기본값으로 채우는지 테스트한다.

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `src/core/types.ts` (수정) | `MindPlant`, `ChatLine`, `ChatLog`, `AppState.chats` |
| `src/core/store.ts` (수정) | `createState`에 `chats: []` |
| `src/core/chat.ts` (새로) | `CHAT_MAX`, `MIND_PLANTS`, `npcReply`, `canSave`, `saveChat`, `deleteChat`, `chatsByDate`, `npcGreeting` |
| `src/core/copy.ts` (수정) | `chat` 묶음, `npcGreet`, `npcRest` |
| `src/ui/panels/Chat.tsx` (새로) | 대화창·남기기 화면, `openChat`, `chatActions`, `NpcBadge` |
| `src/ui/panels/Talk.tsx` (지움) | `Chat.tsx`가 대신 |
| `src/ui/panels/PanelHead.tsx` (수정) | 닫기 버튼 동작을 바꿀 수 있게 `onClose` |
| `src/ui/panels/Story.tsx` (수정) | `NpcBadge`를 `./Chat`에서 가져온다 |
| `src/ui/flow.ts` (수정) | 주민 누르면 대화창, `chatActions` 채우기 |
| `src/ui/panels/Records.tsx` (수정) | "이야기" 탭 |
| `src/styles/overlay.css` (수정) | 대화창·이야기 카드 모양 |
| `src/scene/assets.ts` (수정) | 표시 아이콘(`npc_mark`) 불러오기 |
| `src/scene/Npc.ts` (수정) | 표시·말풍선·돌아보기·버릇·쉬기 |
| `src/scene/GardenScene.ts` (수정) | 표시 계산, 인사 시키기, 쉬는 날 알려 주기 |
| `src/tests/chat.test.ts` (새로), `src/tests/store.test.ts`, `src/tests/copy.test.ts` (수정) | 규칙·저장본·문구 |
| `CLAUDE.md` (수정) | 구조 설명에 대화·기록·주민 행동 |

---

## A. 대화 + 기록

### Task 1: 대화 데이터·규칙·문구

**Files:**
- Modify: `src/core/types.ts` (맨 위 import, `AppState`)
- Modify: `src/core/store.ts:7` (`createState`)
- Create: `src/core/chat.ts`
- Modify: `src/core/copy.ts` (`decorate` 묶음 뒤에 `chat` 묶음)
- Create: `src/tests/chat.test.ts`
- Modify: `src/tests/store.test.ts`, `src/tests/copy.test.ts`

**Interfaces:**
- Produces: `type MindPlant`, `interface ChatLine { from: 'me' | NpcId; text: string; keep?: boolean }`, `interface ChatLog { id; date; npc: NpcId; lines: ChatLine[]; note?: string; mind?: MindPlant }`, `AppState.chats: ChatLog[]`; `CHAT_MAX = 200`, `MIND_PLANTS: MindPlant[]`, `npcReply(npc: NpcId, turn: number): string`, `canSave(lines: ChatLine[]): boolean`, `saveChat(draft: AppState, chat: Omit<ChatLog, 'id'>): ChatLog | null`, `deleteChat(draft: AppState, id: string): void`; `copy.chat.*`

- [ ] **Step 1: 실패하는 테스트 쓰기** — `src/tests/chat.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { canSave, CHAT_MAX, deleteChat, MIND_PLANTS, npcReply, saveChat } from '../core/chat';
import { copy, FORBIDDEN_WORDS } from '../core/copy';
import { createState } from '../core/store';
import type { ChatLine } from '../core/types';

const D = '2026-11-08';
const me = (text: string, keep = false): ChatLine => ({ from: 'me', text, ...(keep ? { keep: true } : {}) });

describe('주민의 대답', () => {
  it('주민마다 받아 주는 말을 돌아가며 하고, 같은 말이 연달아 나오지 않는다', () => {
    for (const npc of ['nuri', 'moru', 'pio'] as const) {
      const pool = copy.chat.replies[npc];
      expect(pool.length).toBeGreaterThanOrEqual(4);
      expect(npcReply(npc, 0)).toBe(pool[0]);
      expect(npcReply(npc, pool.length)).toBe(pool[0]);
      for (let t = 1; t < pool.length * 2; t++) {
        expect(npcReply(npc, t).trim()).not.toBe('');
        expect(npcReply(npc, t)).not.toBe(npcReply(npc, t - 1));
      }
    }
  });

  it('대답에 칭찬·마음 추측·금지 표현이 없다', () => {
    const banned = [...FORBIDDEN_WORDS, '대단', '힘들었겠', '잘했'];
    for (const pool of Object.values(copy.chat.replies)) {
      for (const line of pool) for (const w of banned) expect(line).not.toContain(w);
    }
  });

  it('대답은 사용자의 글을 받지 않는다(내용으로 판정하지 않는다)', () => {
    expect(npcReply.length).toBe(2);
  });
});

describe('대화 남기기', () => {
  it('내 말이 없으면 남기지 않는다', () => {
    const s = createState();
    expect(canSave([{ from: 'nuri', text: '안녕' }])).toBe(false);
    expect(saveChat(s, { date: D, npc: 'nuri', lines: [{ from: 'nuri', text: '안녕' }, me('   ')] })).toBeNull();
    expect(s.chats).toEqual([]);
  });

  it('원문 그대로 남기고, 굵게는 내 말에만, 앞뒤 공백·빈 줄은 정리한다', () => {
    const s = createState();
    const log = saveChat(s, {
      date: D, npc: 'pio',
      lines: [{ from: 'pio', text: '안녕!', keep: true }, me('  오늘 산책했어  ', true), me(''), me('조금 피곤해')],
      note: ' 처음으로 공원 ', mind: 'sprouting',
    })!;
    expect(log.lines).toEqual([{ from: 'pio', text: '안녕!' }, { from: 'me', text: '오늘 산책했어', keep: true }, { from: 'me', text: '조금 피곤해' }]);
    expect(log.note).toBe('처음으로 공원');
    expect(log.mind).toBe('sprouting');
    expect(s.chats).toEqual([log]);
  });

  it('한 줄도 마음 식물도 고르지 않으면 그 칸은 비워 둔다', () => {
    const s = createState();
    const log = saveChat(s, { date: D, npc: 'moru', lines: [me('그냥')], note: '   ' })!;
    expect(log).not.toHaveProperty('note');
    expect(log).not.toHaveProperty('mind');
  });

  it('긴 글은 CHAT_MAX자까지만', () => {
    const s = createState();
    const log = saveChat(s, { date: D, npc: 'moru', lines: [me('가'.repeat(CHAT_MAX + 50))] })!;
    expect(log.lines[0].text).toHaveLength(CHAT_MAX);
  });

  it('지워도 다음 대화의 id가 겹치지 않고, 없는 id를 지우면 아무 일 없다', () => {
    const s = createState();
    const a = saveChat(s, { date: D, npc: 'nuri', lines: [me('하나')] })!;
    const b = saveChat(s, { date: D, npc: 'nuri', lines: [me('둘')] })!;
    deleteChat(s, a.id);
    const c = saveChat(s, { date: D, npc: 'nuri', lines: [me('셋')] })!;
    expect(new Set([b.id, c.id]).size).toBe(2);
    expect(s.chats.map((x) => x.id)).toEqual([b.id, c.id]);
    deleteChat(s, 'nope');
    expect(s.chats).toHaveLength(2);
  });

  it('마음 식물은 다섯 가지이고 이름·짧은 이름·아이콘이 있다', () => {
    expect(MIND_PLANTS).toEqual(['sprouting', 'dry', 'prune', 'sideways', 'steady']);
    for (const m of MIND_PLANTS) {
      expect(copy.chat.mind[m]).toBeTruthy();
      expect(copy.chat.mindShort[m]).toBeTruthy();
      expect(copy.chat.mindIcon[m]).toBeTruthy();
    }
  });
});
```

`src/tests/store.test.ts`의 `describe('store', …)` 안 맨 끝에 추가(맨 위 import에 `type AppState`는 필요 없다):

```ts
  it('예전 저장본에 대화 기록이 없으면 빈 목록으로 채운다', () => {
    store.update((d) => {
      delete (d as { chats?: unknown }).chats;
    });
    expect(loadState().chats).toEqual([]);
  });
```

`src/tests/copy.test.ts`의 함수형 문구 목록(`copy.decorate.moving('벤치'),` 뒤)에 추가:

```ts
      copy.chat.placeholder('느리'),
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/tests/chat.test.ts src/tests/store.test.ts src/tests/copy.test.ts`
Expected: FAIL — `Failed to resolve import "../core/chat"`, `copy.chat` 없음, store 테스트는 `chats`가 undefined.

- [ ] **Step 3: 타입과 기본값**

`src/core/types.ts` 맨 위(첫 줄 `export type Energy` 앞)에:

```ts
import type { NpcId } from './events';
```

`StoredThing` 정의 바로 아래에:

```ts
/** 마음 식물: 대화를 끝낼 때 사용자가 고르는 "오늘 내 마음과 닮은 식물". 앱이 판정하지 않는다. */
export type MindPlant = 'sprouting' | 'dry' | 'prune' | 'sideways' | 'steady';

/** 대화 한 줄. keep은 사용자가 굵게 남긴 문장(자기 말에만). */
export interface ChatLine {
  from: 'me' | NpcId;
  text: string;
  keep?: boolean;
}

/** 주민과 나눈 대화 하나. 기기 안에만 있고 집계에 쓰지 않는다. */
export interface ChatLog {
  id: string;
  date: string;
  npc: NpcId;
  lines: ChatLine[];
  /** 한 줄 더 적은 것 */
  note?: string;
  mind?: MindPlant;
}
```

`AppState`의 `days: Record<string, DayInfo>;` 바로 위에:

```ts
  /** 주민과 나눈 대화(사용자가 남기기로 한 것만). 기기 안에만 저장한다. */
  chats: ChatLog[];
```

`src/core/store.ts`의 `createState` 반환 객체에서 `days: {},` 앞에 `chats: [],`를 넣는다:

```ts
  return { version: 1, logs: [], garden: { items: [], plants: [], storage: [] }, seeds: [], fruit: 0, freePackets: 0, story: { seen: [], choices: {} }, bonusPackets: 0, visits: { count: 0 }, purchases: 0, chats: [], days: {}, settings: { sound: true, demo: false, dayOffset: 0 } };
```

(`loadState`는 `{ ...base, ...saved }`라서 `chats`가 없는 예전 저장본에는 `base.chats`가 남는다. 따로 고칠 것 없음.)

- [ ] **Step 4: 문구** — `src/core/copy.ts`의 `decorate: { … },` 묶음 바로 뒤에:

```ts
  chat: {
    placeholder: (name: string) => `${name}에게 한마디…`,
    send: '보내기',
    done: '끝내기',
    typing: '…',
    keepAsk: '오늘 이야기 중에 따로 남겨 두고 싶은 거 있어?',
    keepTip: '남기고 싶은 내 말을 누르면 굵게 표시돼요.',
    note: '한 줄 더 적기',
    notePlaceholder: '한 줄 더 적기(안 적어도 돼요)',
    mindTitle: '오늘 내 마음과 닮은 식물',
    mind: { sprouting: '싹이 나는 식물', dry: '잎이 조금 마른 식물', prune: '가지치기가 필요한 식물', sideways: '옆으로 뻗는 식물', steady: '그대로인 식물' },
    mindShort: { sprouting: '싹이 나는', dry: '잎이 조금 마른', prune: '가지치기 필요', sideways: '옆으로 뻗는', steady: '그대로인' },
    mindIcon: { sprouting: '🌱', dry: '🍂', prune: '✂️', sideways: '🌿', steady: '🪴' },
    save: '수첩에 남기기',
    skip: '이번엔 남기지 않기',
    saved: '수첩의 이야기에 남겼어요.',
    // 주민의 받아 주는 말: 사용자가 쓴 내용과 상관없이 차례로 한다(해석·판정하지 않기 위해).
    replies: {
      nuri: ['그렇구나. 천천히 들었어.', '응, 여기 적어둘게.', '더 말해도 돼. 나는 원래 느리거든.', '응, 듣고 있어.', '그 얘기, 돌 옆에 잘 놓아둘게.'],
      moru: ['알겠어. 수첩에 적어둘게.', '그랬구나. 잘 읽히게 적어둘게.', '응, 들었어.', '그 얘기는 표지판 옆에 걸어둘게.', '말해줘서 알게 됐네.'],
      pio: ['오, 그랬구나!', '그 얘기 소리 지도에 적어둘까?', '응응, 듣고 있어.', '새로운 이야기다. 적어둘게.', '그렇구나. 오늘 이야기는 이런 소리네.'],
    },
    tab: '이야기',
    empty: '주민과 나눈 이야기가 여기에 남아요.',
    me: '나',
    show: '대화 보기',
    hide: '접기',
    remove: '지우기',
    removeAsk: '이 이야기를 지울까요? 지우면 되돌릴 수 없어요.',
    removeYes: '지우기',
    removeNo: '그대로 두기',
  },
```

- [ ] **Step 5: 규칙** — `src/core/chat.ts`

```ts
// 주민과의 대화 규칙. 주민의 대답은 사용자가 쓴 글을 읽지 않는다(내용을 해석·판정하지 않으려고 글을 인자로 받지 않는다).
// 대화는 사용자가 남기기로 한 것만 기기 안에 저장한다(집계에 쓰지 않는다).
import { copy } from './copy';
import type { NpcId } from './events';
import type { AppState, ChatLine, ChatLog, MindPlant } from './types';

/** 한 번에 쓸 수 있는 글자 수(입력칸과 저장 모두) */
export const CHAT_MAX = 200;

export const MIND_PLANTS: MindPlant[] = ['sprouting', 'dry', 'prune', 'sideways', 'steady'];

function nth<T>(pool: readonly T[], turn: number): T {
  return pool[((turn % pool.length) + pool.length) % pool.length];
}

/** 주민의 받아 주는 말: 그 주민의 말 중 turn번째(돌아가며). */
export function npcReply(npc: NpcId, turn: number): string {
  return nth(copy.chat.replies[npc], turn);
}

/** 내 말이 한 줄이라도 있어야 남길 수 있다. */
export function canSave(lines: ChatLine[]): boolean {
  return lines.some((l) => l.from === 'me' && l.text.trim() !== '');
}

const clean = (text: string) => text.trim().slice(0, CHAT_MAX);

/** 대화를 수첩에 남긴다. 앞뒤 공백·빈 줄을 정리하고, 굵게는 내 말에만 남긴다. 내 말이 없으면 null. */
export function saveChat(draft: AppState, chat: Omit<ChatLog, 'id'>): ChatLog | null {
  const lines: ChatLine[] = [];
  for (const l of chat.lines) {
    const text = clean(l.text);
    if (text) lines.push({ from: l.from, text, ...(l.from === 'me' && l.keep ? { keep: true } : {}) });
  }
  if (!canSave(lines)) return null;
  const used = draft.chats.map((c) => Number(/-chat-(\d+)$/.exec(c.id)?.[1] ?? 0));
  const note = chat.note ? clean(chat.note) : '';
  const log: ChatLog = {
    id: `${chat.date}-chat-${Math.max(0, ...used) + 1}`,
    date: chat.date,
    npc: chat.npc,
    lines,
    ...(note ? { note } : {}),
    ...(chat.mind ? { mind: chat.mind } : {}),
  };
  draft.chats.push(log);
  return log;
}

export function deleteChat(draft: AppState, id: string): void {
  draft.chats = draft.chats.filter((c) => c.id !== id);
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/tests/chat.test.ts src/tests/store.test.ts src/tests/copy.test.ts`
Expected: PASS (chat 10개 안팎, store 3개, copy 전부)

Run: `npm test && npx tsc --noEmit`
Expected: 모두 PASS, 타입 오류 없음.

---

### Task 2: 대화창(주민을 누르면)

**Files:**
- Create: `src/ui/panels/Chat.tsx`
- Delete: `src/ui/panels/Talk.tsx`
- Modify: `src/ui/panels/PanelHead.tsx`
- Modify: `src/ui/panels/Story.tsx:9` (import)
- Modify: `src/ui/flow.ts:22, 82, 110-112`
- Modify: `src/styles/overlay.css` (`/* ---- 대화(목업) ---- */` 묶음 아래)

**Interfaces:**
- Consumes: Task 1의 `CHAT_MAX`, `MIND_PLANTS`, `npcReply`, `canSave`, `saveChat`, `copy.chat.*`, `ChatLine`, `MindPlant`
- Produces: `openChat(npc: NpcId): void`, `chatActions: Partial<Record<NpcId, () => void>>`, `NpcBadge({ id })`, `PanelHead`의 `onClose?: () => void`

- [ ] **Step 1: `PanelHead`가 닫기 동작을 받게** — `src/ui/panels/PanelHead.tsx`

```tsx
import type { ReactNode } from 'react';
import { copy } from '../../core/copy';
import { IconBtn } from '../icons';
import { closeModal } from '../modal';

/** 패널 머리말: 왼쪽 빈칸(또는 뒤로) · 가운데 제목(또는 탭) · 오른쪽 닫기(onClose가 없으면 창을 닫는다) */
export function PanelHead({ title, center, left, onClose }: { title?: string; center?: ReactNode; left?: ReactNode; onClose?: () => void }) {
  return (
    <div className="panel-head">
      {left ?? <span className="icon-spacer" />}
      {center ?? <h2 className="panel-title">{title}</h2>}
      <IconBtn name="close" label={copy.panel.close} onClick={onClose ?? closeModal} />
    </div>
  );
}
```

- [ ] **Step 2: 대화창** — `src/ui/panels/Chat.tsx`

```tsx
// 주민과의 대화: 말풍선이 쌓이는 대화창. 주민은 받아 주는 말을 차례로 할 뿐 내 글을 읽고 판단하지 않는다(core/chat.ts).
// 끝낼 때 내가 쓴 말이 있으면 남길 문장(굵게)·마음 식물·한 줄을 고르고 수첩에 남긴다. 기기 안에만 저장한다.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { canSave, CHAT_MAX, MIND_PLANTS, npcReply, saveChat } from '../../core/chat';
import { todayKey } from '../../core/clock';
import { copy } from '../../core/copy';
import { canHarvest } from '../../core/economy';
import type { NpcId } from '../../core/events';
import { pendingPacketCount } from '../../core/rules';
import { store } from '../../core/store';
import type { ChatLine, MindPlant } from '../../core/types';
import { npcUrl } from '../../scene/assets';
import { closeModal, openModal } from '../modal';
import { showToast } from '../toast';
import { PanelHead } from './PanelHead';

/** 대화창의 [그 주민의 일] 버튼(씨앗함·작업대·도감). flow.ts가 채운다(화면끼리 직접 부르지 않으려고). */
export const chatActions: Partial<Record<NpcId, () => void>> = {};

export function NpcBadge({ id }: { id: NpcId }) {
  return <img className="npc-face" src={npcUrl(id, 'front')} alt="" draggable={false} aria-hidden="true" />;
}

/** 첫인사: 지금 상황에 맞는 말이 있으면 그것, 없으면 그 주민의 평소 말 하나(날마다 바뀐다). */
function greeting(npc: NpcId): string {
  const s = store.state;
  const today = todayKey();
  if (npc === 'nuri' && pendingPacketCount(s) + s.seeds.length > 0) return copy.lines.seedWaiting;
  if (npc === 'moru' && s.garden.plants.some((p) => canHarvest(p, today, s.days))) return copy.lines.fruitReady;
  const lines = copy.talk.npc[npc].lines;
  return lines[Number(today.slice(-2)) % lines.length];
}

function Chat({ npc }: { npc: NpcId }) {
  const name = copy.talk.npc[npc].name;
  const [lines, setLines] = useState<ChatLine[]>(() => [{ from: npc, text: greeting(npc) }]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [note, setNote] = useState('');
  const [mind, setMind] = useState<MindPlant | undefined>();
  const turn = useRef(0);
  const timer = useRef(0);
  const log = useRef<HTMLUListElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines, typing]);

  const wrote = canSave(lines);
  const send = () => {
    const text = draft.trim().slice(0, CHAT_MAX);
    if (!text || typing) return;
    setLines((ls) => [...ls, { from: 'me', text }]);
    setDraft('');
    setTyping(true);
    timer.current = window.setTimeout(() => {
      setLines((ls) => [...ls, { from: npc, text: npcReply(npc, turn.current++) }]);
      setTyping(false);
    }, 600);
  };
  // 한글 조합 중의 Enter는 글자를 확정할 뿐이라 보내지 않는다.
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) send();
  };
  const finish = () => (wrote ? setKeeping(true) : closeModal());
  const toggleKeep = (i: number) => setLines((ls) => ls.map((l, j) => (j === i && l.from === 'me' ? { ...l, keep: !l.keep } : l)));
  const save = () => {
    store.update((d) => {
      saveChat(d, { date: todayKey(), npc, lines, note, mind });
    });
    closeModal();
    showToast([copy.chat.saved]);
  };
  const run = chatActions[npc];
  const action = copy.talk.npc[npc].action;

  if (keeping) {
    return (
      <section className="panel chat" role="dialog" aria-label={name}>
        {/* 닫기(X)는 기본값인 [수첩에 남기기]와 같다 */}
        <PanelHead title={name} onClose={save} />
        <div className="chat-ask">
          <NpcBadge id={npc} />
          <p>
            {copy.chat.keepAsk}
            <small>{copy.chat.keepTip}</small>
          </p>
        </div>
        <ul className="chat-keep">
          {lines.map((l, i) =>
            l.from === 'me' ? (
              <li key={i}>
                <button type="button" className={`chat-pick${l.keep ? ' on' : ''}`} aria-pressed={!!l.keep} onClick={() => toggleKeep(i)}>
                  {l.text}
                </button>
              </li>
            ) : null,
          )}
        </ul>
        <div className="chat-mind" role="group" aria-label={copy.chat.mindTitle}>
          <small>{copy.chat.mindTitle}</small>
          {MIND_PLANTS.map((m) => (
            <button
              key={m}
              type="button"
              className={`chip${mind === m ? ' chip-on' : ''}`}
              aria-pressed={mind === m}
              aria-label={copy.chat.mind[m]}
              onClick={() => setMind(mind === m ? undefined : m)}
            >
              {copy.chat.mindIcon[m]} {copy.chat.mindShort[m]}
            </button>
          ))}
        </div>
        <div className="chat-save">
          <input className="text-input" maxLength={CHAT_MAX} value={note} placeholder={copy.chat.notePlaceholder} aria-label={copy.chat.note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={save}>{copy.chat.save}</button>
          <button type="button" className="btn btn-secondary" onClick={closeModal}>{copy.chat.skip}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel chat" role="dialog" aria-label={name}>
      <PanelHead title={name} onClose={finish} />
      <ul className="chat-log" ref={log}>
        {lines.map((l, i) => (
          <li key={i} className={l.from === 'me' ? 'me' : 'npc'}>
            {l.from !== 'me' && <NpcBadge id={l.from} />}
            <p className="chat-bubble">{l.text}</p>
          </li>
        ))}
        {typing && (
          <li className="npc">
            <NpcBadge id={npc} />
            <p className="chat-bubble">{copy.chat.typing}</p>
          </li>
        )}
      </ul>
      <div className="chat-input">
        <input
          className="text-input"
          maxLength={CHAT_MAX}
          value={draft}
          placeholder={copy.chat.placeholder(name)}
          aria-label={copy.chat.placeholder(name)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <button type="button" className="btn btn-primary" onClick={send} disabled={!draft.trim() || typing}>{copy.chat.send}</button>
      </div>
      <div className="chat-actions">
        {/* 내가 글을 쓴 뒤에는 [끝내기]로만 나간다(남기기 단계를 건너뛰어 대화를 잃지 않게) */}
        {!wrote && action && run && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              closeModal();
              run();
            }}
          >
            {action}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={finish}>{copy.chat.done}</button>
      </div>
    </section>
  );
}

/** 대화창을 연다. 바깥을 누르거나 Esc로는 닫히지 않는다(쓰던 대화를 실수로 잃지 않게). */
export const openChat = (npc: NpcId) => openModal(<Chat npc={npc} />, false);
```

- [ ] **Step 3: 이어 붙이기**

`src/ui/panels/Story.tsx` 9번째 줄:

```tsx
import { NpcBadge } from './Chat';
```

`src/ui/flow.ts`:
- 22번째 줄 `import { openTalk, talkActions } from './panels/Talk';`를 아래로 바꾼다.

```ts
import { chatActions, openChat } from './panels/Chat';
```

- `meetNpc` 안의 `else openTalk(id);`를 `else openChat(id);`로.
- 주석과 함께 있는 세 줄을 바꾼다.

```ts
  // 주민을 누르면 그 주민과 이야기하고, 대화창의 버튼으로 그 주민의 일로 이어진다.
  chatActions.nuri = () => openBag('seeds');
  chatActions.moru = openShop;
  chatActions.pio = () => openRecords('book');
```

`src/ui/panels/Talk.tsx`를 지운다: `rm src/ui/panels/Talk.tsx`(커밋은 하지 않는다). 다른 곳에서 `./Talk`를 가져오는지 `git grep -n "panels/Talk\|from './Talk'" -- src`로 확인해 아무것도 나오지 않아야 한다.

- [ ] **Step 4: 모양** — `src/styles/overlay.css`의 `.talk-bubble p { … }` 줄 바로 아래에:

```css
/* ---- 주민과의 대화 ---- */
.chat-log { list-style: none; margin: 0; padding: 0 4px 0 0; height: 176px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.chat-log li { display: flex; align-items: flex-end; gap: 6px; }
.chat-log li.me { justify-content: flex-end; }
.chat-log .npc-face, .chat-ask .npc-face { width: 32px; height: 32px; flex: none; }
.chat-bubble { max-width: 75%; margin: 0; padding: 6px 10px; border-radius: 12px; border: 2px solid var(--sand); background: #fff; font-size: 14px; line-height: 1.45; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; }
.chat-log li.me .chat-bubble { background: #e9f5dc; border-color: #9cc97a; }
.chat-input, .chat-actions, .chat-save { display: flex; gap: 6px; }
.chat-actions { justify-content: flex-end; }
.chat-input .text-input, .chat-save .text-input { flex: 1; min-width: 0; }
.chat-input .btn, .chat-actions .btn, .chat-save .btn { width: auto; flex: none; margin-top: 0; padding: 0 16px; white-space: nowrap; }
.chat-ask { display: flex; align-items: center; gap: 8px; }
.chat-ask p { margin: 0; font-size: 14px; }
.chat-ask small { display: block; font-size: 12px; color: var(--ink-soft); }
.chat-keep { list-style: none; margin: 0; padding: 0 4px 0 0; height: 92px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.chat-pick { width: 100%; min-height: var(--tap); padding: 4px 10px; border-radius: 8px; border: 2px solid var(--sand); background: #fff; color: var(--ink); font: inherit; font-size: 13px; text-align: left; }
.chat-pick.on { font-weight: 800; border-color: var(--green); background: #e9f5dc; }
.chat-mind { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.chat-mind small { width: 100%; font-size: 12px; color: var(--ink-soft); }
.chat-mind .chip { flex: 1 1 0; min-width: 0; padding: 0 2px; font-size: 11px; white-space: nowrap; }
```

- [ ] **Step 5: 타입·테스트·빌드**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: 오류 없음, 테스트 전부 PASS, `✓ built`.

- [ ] **Step 6: 화면 확인(헤드리스)** — 스크래치에 단계 파일을 만들어 돌린다(프로젝트에 넣지 않는다).

`$SP/chat-steps.json` (`$SP`는 세션 스크래치 폴더):

```json
[
 {"js": "(()=>{localStorage.clear();location.href=location.pathname+'?nostory';})()", "wait": 3000},
 {"click": "보통이에요", "wait": 700},
 {"click": "대화", "sel": ".talk-btn", "wait": 600, "shot": "c1_open"},
 {"js": "document.querySelector('.chat-input input').focus()"},
 {"insertText": "오늘 집 앞까지 걸어갔어"},
 {"click": "보내기", "wait": 900, "shot": "c2_reply"},
 {"js": "document.querySelector('.chat-input input').focus()"},
 {"insertText": "조금 피곤했어"},
 {"click": "보내기", "wait": 900},
 {"click": "끝내기", "sel": ".chat-actions button", "wait": 400, "shot": "c3_keep"},
 {"click": "오늘 집 앞까지", "sel": ".chat-pick", "wait": 200},
 {"js": "document.querySelector('.chat-mind .chip').click()"},
 {"js": "document.querySelector('.chat-save input').focus()"},
 {"insertText": "처음으로 끝까지 걸었다"},
 {"wait": 200, "shot": "c4_keep_filled"},
 {"click": "수첩에 남기기", "wait": 600, "shot": "c5_saved"},
 {"js": "JSON.stringify(JSON.parse(localStorage.getItem('plantkeeper:v1')).chats)"}
]
```

Run: `npm run build && node tools/screenshot.mjs $SP/out-chat $SP/chat-steps.json file://$PWD/dist/index.html`
Expected: 마지막 줄 `js ->`에 `"npc":"nuri"`, `"keep":true`가 붙은 "오늘 집 앞까지 걸어갔어", `"mind":"sprouting"`, `"note":"처음으로 끝까지 걸었다"`가 보인다. `c1~c5` PNG를 열어 확인: 말풍선이 쌓이고(c2), 남기기 화면이 한 화면에 들어오며(c3·c4, 버튼이 잘리지 않음), 저장 알림이 뜬다(c5). 화면이 넘치면 `.chat-log`·`.chat-keep`의 높이를 줄인다.

---

### Task 3: 수첩의 "이야기" 탭

**Files:**
- Modify: `src/core/chat.ts` (`chatsByDate` 추가)
- Modify: `src/tests/chat.test.ts`
- Modify: `src/ui/panels/Records.tsx`
- Modify: `src/styles/overlay.css`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Task 1의 `ChatLog`, `deleteChat`, `copy.chat.*`; Task 2의 `NpcBadge`
- Produces: `chatsByDate(chats: ChatLog[]): { date: string; chats: ChatLog[] }[]`(최근 날짜 먼저, 같은 날은 나중에 남긴 것 먼저), `openRecords('chat')`

- [ ] **Step 1: 실패하는 테스트** — `src/tests/chat.test.ts` 맨 위 import에 `chatsByDate`를 더하고 맨 끝에:

```ts
describe('수첩의 이야기', () => {
  it('최근 날짜 먼저, 같은 날은 나중에 남긴 것 먼저', () => {
    const s = createState();
    const a = saveChat(s, { date: '2026-11-07', npc: 'nuri', lines: [me('어제')] })!;
    const b = saveChat(s, { date: '2026-11-08', npc: 'pio', lines: [me('아침')] })!;
    const c = saveChat(s, { date: '2026-11-08', npc: 'moru', lines: [me('저녁')] })!;
    expect(chatsByDate(s.chats)).toEqual([
      { date: '2026-11-08', chats: [c, b] },
      { date: '2026-11-07', chats: [a] },
    ]);
    expect(chatsByDate([])).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/tests/chat.test.ts`
Expected: FAIL — `chatsByDate is not a function`(또는 import 오류)

- [ ] **Step 3: 구현** — `src/core/chat.ts` 맨 끝에:

```ts
/** 수첩의 이야기: 최근 날짜 먼저, 같은 날은 나중에 남긴 것 먼저. */
export function chatsByDate(chats: ChatLog[]): { date: string; chats: ChatLog[] }[] {
  const byDate = new Map<string, ChatLog[]>();
  for (const c of [...chats].reverse()) byDate.set(c.date, [...(byDate.get(c.date) ?? []), c]);
  return [...byDate].sort((x, y) => y[0].localeCompare(x[0])).map(([date, list]) => ({ date, chats: list }));
}
```

Run: `npx vitest run src/tests/chat.test.ts`
Expected: PASS

- [ ] **Step 4: 탭과 카드** — `src/ui/panels/Records.tsx`

import 바꾸기·더하기:

```tsx
import { useState } from 'react';
import { activityById } from '../../core/activities';
import { chatsByDate, deleteChat } from '../../core/chat';
import { todayKey } from '../../core/clock';
import { copy } from '../../core/copy';
import { plantById } from '../../core/plants';
import { groupByDate, weekKindsCount } from '../../core/stats';
import { store } from '../../core/store';
import type { ChatLog, LogEntry } from '../../core/types';
import { ActivityImg, PlantImg, UiIconImg } from '../icons';
import { openModal } from '../modal';
import { useAppState } from '../useAppState';
import { NpcBadge } from './Chat';
import { GiftBody } from './Gift';
import { PanelHead } from './PanelHead';

type RecordsTab = 'log' | 'chat' | 'book' | 'stamps';
```

`BookBody` 함수 앞에 추가:

```tsx
/** 이야기 카드: 굵게 남긴 말·마음 식물·한 줄을 먼저, 대화 원문은 접어 둔다(옆 사람에게 보일 수 있어서). */
function ChatCard({ c }: { c: ChatLog }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const kept = c.lines.filter((l) => l.keep);
  return (
    <li className="chat-card">
      <div className="chat-card-head">
        <NpcBadge id={c.npc} />
        <strong>{copy.talk.npc[c.npc].name}</strong>
        {c.mind && <span className="chat-mind-tag">{copy.chat.mindIcon[c.mind]} {copy.chat.mind[c.mind]}</span>}
      </div>
      {kept.map((l, i) => <p key={i} className="chat-kept">{l.text}</p>)}
      {c.note && <p className="chat-note">{c.note}</p>}
      {open && (
        <ul className="chat-full">
          {c.lines.map((l, i) => (
            <li key={i}>
              <small>{l.from === 'me' ? copy.chat.me : copy.talk.npc[l.from].name}</small>
              {l.keep ? <strong>{l.text}</strong> : l.text}
            </li>
          ))}
        </ul>
      )}
      {asking ? (
        <div className="chat-card-ask">
          <p className="panel-note">{copy.chat.removeAsk}</p>
          <div className="chat-card-actions">
            <button type="button" className="btn-chip" onClick={() => store.update((d) => deleteChat(d, c.id))}>{copy.chat.removeYes}</button>
            <button type="button" className="btn-chip" onClick={() => setAsking(false)}>{copy.chat.removeNo}</button>
          </div>
        </div>
      ) : (
        <div className="chat-card-actions">
          <button type="button" className="btn-chip" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? copy.chat.hide : copy.chat.show}</button>
          <button type="button" className="btn-chip" onClick={() => setAsking(true)}>{copy.chat.remove}</button>
        </div>
      )}
    </li>
  );
}

function ChatBody() {
  const { chats } = useAppState();
  if (chats.length === 0) return <p className="panel-message">{copy.chat.empty}</p>;
  return (
    <div className="records-scroll">
      {chatsByDate(chats).map((g) => (
        <div key={g.date}>
          <h3 className="rec-date">{formatDate(g.date)}</h3>
          <ul className="chat-cards">{g.chats.map((c) => <ChatCard key={c.id} c={c} />)}</ul>
        </div>
      ))}
    </div>
  );
}
```

`Records`의 탭 목록과 본문을 바꾼다:

```tsx
      {([['log', copy.book.logTab], ['chat', copy.chat.tab], ['book', copy.book.tab], ['stamps', copy.records.stampsTab]] as const).map(([id, label]) => (
```

```tsx
      {tab === 'log' ? <LogBody /> : tab === 'chat' ? <ChatBody /> : tab === 'book' ? <BookBody /> : <GiftBody />}
```

- [ ] **Step 5: 모양** — `src/styles/overlay.css`의 `.book-card .btn-chip { … }` 줄 아래에:

```css
.chat-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.chat-card { padding: 8px 10px; background: #fff; border: 2px solid var(--sand); border-radius: 10px; display: flex; flex-direction: column; gap: 4px; }
.chat-card-head { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.chat-card-head .npc-face { width: 28px; height: 28px; }
.chat-mind-tag { margin-left: auto; font-size: 12px; color: var(--ink-soft); }
.chat-kept { margin: 0; font-size: 14px; font-weight: 800; }
.chat-note { margin: 0; font-size: 13px; }
.chat-full { list-style: none; margin: 0; padding: 6px 0 0; border-top: 1px dashed var(--sand); display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.chat-full small { margin-right: 6px; color: var(--ink-soft); }
.chat-card-actions { display: flex; gap: 6px; justify-content: flex-end; }
```

- [ ] **Step 6: 문서** — `CLAUDE.md`의 `src/ui` 설명에서 `panels/`(활동·기록·설정·상점·선물·대화·…) 문장 뒤에 덧붙인다:

```markdown
  주민을 누르면(그날 열린 이야기 장면이 없을 때) `Chat.tsx` 대화창이 열린다. 주민 대답은 `core/chat.ts`의 `npcReply`가 받아 주는 말을 차례로 고를 뿐 사용자의 글을 읽지 않는다(해석·판정 금지). 내가 쓴 말이 있으면 끝낼 때 남길 말(굵게)·마음 식물·한 줄을 골라 `chats`에 기기 안에만 남기고, 수첩의 "이야기" 탭에서 보고 지운다. 대화는 통계에 넣지 않는다.
```

- [ ] **Step 7: 테스트·빌드·화면 확인**

Run: `npm test && npm run build`
Expected: 전부 PASS, `✓ built`

Task 2의 `$SP/chat-steps.json` 끝에 이어 붙여 다시 돌린다:

```json
 {"click": "수첩", "sel": ".hud-btn", "wait": 500},
 {"click": "이야기", "sel": ".tab", "wait": 300, "shot": "c6_records"},
 {"click": "대화 보기", "sel": ".btn-chip", "wait": 300, "shot": "c7_full"},
 {"click": "지우기", "sel": ".chat-card-actions .btn-chip", "wait": 300, "shot": "c8_ask"},
 {"click": "지우기", "sel": ".chat-card-ask .btn-chip", "wait": 400, "shot": "c9_empty"},
 {"js": "JSON.parse(localStorage.getItem('plantkeeper:v1')).chats.length"}
```

Expected: 마지막 `js -> 0`. c6에 굵은 "오늘 집 앞까지 걸어갔어", 🌱 싹이 나는 식물, 한 줄이 보이고 원문은 접혀 있음. c7에 원문 펼침, c8에 지우기 확인, c9에 빈 안내 문구.

---

## B. 정원 안 행동

### Task 4: 새 이야기 표시 · 다가가면 돌아보고 인사

**Files:**
- Modify: `src/core/copy.ts` (`npcGreet`, `npcRest`)
- Modify: `src/core/chat.ts` (`npcGreeting`)
- Modify: `src/tests/chat.test.ts`
- Modify: `src/scene/assets.ts`
- Modify: `src/scene/Npc.ts`
- Modify: `src/scene/GardenScene.ts`

**Interfaces:**
- Consumes: `nextSceneFor(state, npc, today)`(`src/core/story.ts`), `isResting(state, date)`(`src/core/rules.ts`)
- Produces: `npcGreeting(npc: NpcId, resting: boolean, turn: number): string`; `Npc.setMark(on: boolean)`, `Npc.takeMet(): boolean`, `Npc.say(text: string, now: number): boolean`, `Npc.hush(): void`

- [ ] **Step 1: 실패하는 테스트** — `src/tests/chat.test.ts`의 import에 `npcGreeting`을 더하고 맨 끝에:

```ts
describe('다가갔을 때 주민의 말', () => {
  it('평소엔 인사를 돌아가며, 쉬는 날엔 쉬는 말', () => {
    for (const npc of ['nuri', 'moru', 'pio'] as const) {
      const pool = copy.npcGreet[npc];
      expect(pool.length).toBeGreaterThanOrEqual(3);
      expect(npcGreeting(npc, false, 0)).toBe(pool[0]);
      expect(npcGreeting(npc, false, pool.length + 1)).toBe(pool[1]);
      expect(npcGreeting(npc, true, 5)).toBe(copy.npcRest[npc]);
    }
  });
});
```

Run: `npx vitest run src/tests/chat.test.ts`
Expected: FAIL — `npcGreeting` 없음

- [ ] **Step 2: 문구와 규칙**

`src/core/copy.ts`의 `chat: { … },` 뒤에(대사는 스토리 바이블 10장 상황 대사·"활동 미실행"·C02 그대로):

```ts
  /** 다가가면 주민이 건네는 짧은 말(스토리 바이블 10장 상황 대사) */
  npcGreet: {
    nuri: ['저 나무는 여전히 그 자리에 있네.', '천천히 골라도 돼. 나는 원래 느리거든.', '나는 저 돌 네 개나 다시 세어봐야겠어.'],
    moru: ['길 옆에 벤치를 두면 지나가기 편할까?', '원하면 활동을 작은 칸으로 나눠볼게.', '전에 그린 길을 다시 볼래?'],
    pio: ['방금 나뭇잎이 두 번 흔들렸어.', '익숙한 일이나 새로운 일, 둘 다 궁금해.', '내일은 또 다른 소리를 찾을지도 모르지.'],
  },
  /** 쉬는 날 다가가면 하는 말(스토리 바이블 "활동 미실행"·쉬기 대사) */
  npcRest: { nuri: '그럼 나는 여기서 돌을 좀 보겠어.', moru: '계획은 보류해둘게.', pio: '그럼 나도 잠깐 조용히 있어볼래.' },
```

`src/core/chat.ts` 맨 끝에:

```ts
/** 다가갔을 때 주민의 짧은 말: 쉬는 날이면 쉬는 말, 아니면 인사를 돌아가며. */
export function npcGreeting(npc: NpcId, resting: boolean, turn: number): string {
  return resting ? copy.npcRest[npc] : nth(copy.npcGreet[npc], turn);
}
```

Run: `npx vitest run src/tests/chat.test.ts src/tests/copy.test.ts`
Expected: PASS

- [ ] **Step 3: 표시 아이콘 불러오기** — `src/scene/assets.ts`의 `scene.load.image('fruit_mark', …);` 아래에:

```ts
  scene.load.image('npc_mark', `${base}assets/icons-ui/talk.png`); // 그날 열린 이야기가 있는 주민 머리 위
```

- [ ] **Step 4: `Npc`에 표시·말풍선·돌아보기** — `src/scene/Npc.ts`

상수 묶음을 바꾼다(`SPEED`·`LABEL_DEPTH`·`ROAM`은 그대로):

```ts
const SIZE = 60; // 화면에서 보이는 크기(px)
const SPEED = 20; // px/초
const LABEL_DEPTH = 8000; // 이름표는 소품에 가려지지 않게 항상 위에
const ROAM = 60; // 자기 자리에서 이만큼 안쪽만 서성인다
const NEAR = 90; // 새싹이가 이 안에 오면 멈춰서 돌아본다
const SAY_MS = 2600; // 말풍선이 떠 있는 시간
const SAY_GAP = 60000; // 같은 주민은 1분 동안 다시 말을 걸지 않는다
const TEXT_STYLE = {
  fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif",
  fontSize: '13px',
  color: '#2b1f17',
  backgroundColor: '#fffaf0', // 반투명이면 배경 그림이 비쳐서 흐려 보인다. 꽉 찬 색으로.
  padding: { x: 6, y: 2 },
};
```

필드에 추가(`private clock = …` 아래):

```ts
  private readonly mark: Phaser.GameObjects.Image;
  private bubble?: Phaser.GameObjects.Text;
  private bubbleTimer?: Phaser.Time.TimerEvent;
  private wasNear = false;
  private met = false;
  private lastSaid = -Infinity;
```

생성자의 `this.label = scene.add.text(…)` 문을 `TEXT_STYLE`을 쓰게 바꾸고, 그 뒤 `this.place();` 앞에 표시를 만든다:

```ts
    this.label = scene.add
      .text(home.x, home.y, name, { ...TEXT_STYLE, fontStyle: 'bold' })
      .setOrigin(0.5, 1)
      .setResolution(2);
    this.mark = scene.add.image(home.x, home.y, 'npc_mark').setOrigin(0.5, 1).setDisplaySize(22, 22).setVisible(false);
    this.place();
```

`place()`를 바꾼다(이름표 위에 표시, 그 위에 말풍선):

```ts
  private place(): void {
    this.sprite.setDepth(this.sprite.y);
    const top = this.sprite.y - SIZE + 2;
    this.label.setPosition(this.sprite.x, top).setDepth(LABEL_DEPTH);
    const above = top - this.label.height - 2;
    this.mark.setPosition(this.sprite.x, above).setDepth(LABEL_DEPTH);
    this.bubble?.setPosition(this.sprite.x, this.mark.visible ? above - 24 : above).setDepth(LABEL_DEPTH + 1);
  }
```

`pose()` 아래에 메서드 추가:

```ts
  /** 그날 열린 이야기가 있으면 머리 위에 작은 말풍선 표시 */
  setMark(on: boolean): void {
    if (this.mark.visible === on) return;
    this.mark.setVisible(on);
    this.place();
  }

  /** 새싹이가 막 다가왔는지(한 번 읽으면 지워진다). 무슨 말을 할지는 GardenScene이 정해 say로 시킨다. */
  takeMet(): boolean {
    const m = this.met;
    this.met = false;
    return m;
  }

  /** 짧은 말풍선(SAY_MS). 같은 주민은 SAY_GAP 동안 다시 말하지 않는다. 말했으면 true. */
  say(text: string, now: number): boolean {
    if (now - this.lastSaid < SAY_GAP) return false;
    this.lastSaid = now;
    this.hush();
    this.bubble = this.scene.add
      .text(this.sprite.x, this.sprite.y, text, { ...TEXT_STYLE, wordWrap: { width: 170 } })
      .setOrigin(0.5, 1)
      .setResolution(2);
    this.place();
    this.bubbleTimer = this.scene.time.delayedCall(SAY_MS, () => this.hush());
    return true;
  }

  /** 말풍선을 바로 지운다(창이 열리거나 꾸미기에 들어갈 때). */
  hush(): void {
    this.bubbleTimer?.remove();
    this.bubbleTimer = undefined;
    this.bubble?.destroy();
    this.bubble = undefined;
  }
```

`update()`의 앞부분(`this.clock += dtMs;`부터 `if (frozen || near) { … return; }`까지)을 바꾼다:

```ts
    this.clock += dtMs;
    const dx = player.x - this.x;
    const near = Math.hypot(dx, player.y - this.y) < NEAR;
    if (near && !this.wasNear) this.met = true;
    this.wasNear = near;
    if (frozen || near) {
      // 가까이 온 새싹이 쪽을 돌아본다(옆모습은 오른쪽을 보는 그림이라 왼쪽이면 뒤집는다).
      if (!frozen && Math.abs(dx) > 12) {
        this.pose('side');
        this.sprite.setFlipX(dx < 0);
      } else {
        this.pose('front');
        this.sprite.setFlipX(false);
      }
      return;
    }
```

(`update` 뒷부분의 `const dx = this.target.x - this.x;`는 이름이 겹치니 `const tx = this.target.x - this.x; const ty = this.target.y - this.y;`로 바꾸고, 그 아래 `dx`·`dy`를 `tx`·`ty`로 바꾼다.)

- [ ] **Step 5: `GardenScene`이 표시를 정하고 인사를 시키기** — `src/scene/GardenScene.ts`

import 추가:

```ts
import { npcGreeting } from '../core/chat';
import { nextSceneFor } from '../core/story';
```

필드 추가(`private hitbox?` 아래):

```ts
  /** 다가갔을 때 인사 차례(주민마다 돌아가며 다른 말) */
  private greetTurn = 0;
```

메서드 추가(`standDepth` 앞):

```ts
  /** 그날 열린 이야기가 있는 주민 머리 위에 표시. 꾸미는 중에는 숨긴다. */
  private refreshMarks(): void {
    const today = todayKey();
    for (const npc of this.npcs) npc.setMark(!this.decorating && nextSceneFor(store.state, npc.id, today) !== null);
  }
```

`create()`에서 주민들을 만든 `this.npcs = defs.map(…);` 바로 뒤에:

```ts
    this.refreshMarks();
```

`create()`의 `offs` 목록에 추가(`store.subscribe(() => this.refreshPlants()),` 아래):

```ts
      store.subscribe(() => this.refreshMarks()),
```

날짜 바뀜을 보는 타이머의 콜백을 바꾼다:

```ts
    this.time.addEvent({ delay: 30000, loop: true, callback: () => { this.refreshPlants(); this.refreshMarks(); } });
```

`update()`의 주민 반복을 바꾼다:

```ts
    for (const npc of this.npcs) {
      npc.update(delta, this.player, this.locked || this.decorating);
      npc.sprite.setDepth(this.standDepth(npc.x, npc.y));
      // 막 다가왔으면 짧게 말을 건다(창이 열려 있거나 꾸미는 중에는 하지 않는다).
      if (npc.takeMet() && !this.locked && !this.decorating) {
        if (npc.say(npcGreeting(npc.id, isResting(store.state, todayKey()), this.greetTurn), this.time.now)) this.greetTurn++;
      }
    }
```

`setLocked`의 맨 끝, `enterDecorate`의 맨 끝에 말풍선을 지우고 표시를 다시 정한다:

```ts
    if (locked) this.npcs.forEach((n) => n.hush());
```

```ts
    this.npcs.forEach((n) => n.hush());
    this.refreshMarks();
```

`exitDecorate`의 맨 끝에:

```ts
    this.refreshMarks();
```

- [ ] **Step 6: 테스트·빌드·화면 확인**

Run: `npm test && npm run build`
Expected: 전부 PASS, `✓ built`

`$SP/npc-steps.json` — 프롤로그만 본 상태(느리의 이야기 A01이 열림)에서 정원을 넓게 보고, 피오에게 걸어간다:

```json
[
 {"js": "(()=>{const s={version:1,logs:[],garden:{items:[],plants:[],storage:[]},seeds:[],fruit:0,freePackets:0,story:{seen:['intro','free-packet'],choices:{}},bonusPackets:0,visits:{count:0},purchases:0,chats:[],days:{},settings:{sound:false,demo:false,dayOffset:0}};localStorage.clear();localStorage.setItem('plantkeeper:v1',JSON.stringify(s));location.href=location.pathname;})()", "wait": 3000},
 {"click": "보통이에요", "wait": 700},
 {"js": "for(let i=0;i<8;i++)document.querySelector('[aria-label=\"넓게 보기\"]')?.click()", "wait": 600, "shot": "n1_marks"},
 {"keyDown": "ArrowRight", "wait": 3100}, {"keyUp": "ArrowRight", "wait": 50},
 {"keyDown": "ArrowUp", "wait": 1500}, {"keyUp": "ArrowUp", "wait": 500, "shot": "n2_greet"}
]
```

Run: `node $SP/repro/run.mjs $SP/out-npc $SP/npc-steps.json file://$PWD/dist/index.html`
(`$SP/repro/run.mjs`는 `tools/screenshot.mjs`에 `{keyDown:키}`·`{keyUp:키}` 단계를 더한 재현용 실행기로, 이 세션의 스크래치에 이미 있다. 없으면 `tools/screenshot.mjs`를 `$SP/repro/run.mjs`로 복사하고 `if (s.wait) await sleep(s.wait);` 바로 앞에 아래를 넣는다.)

```js
  if (s.keyDown || s.keyUp) {
    const k = s.keyDown || s.keyUp;
    const code = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 }[k];
    await send('Input.dispatchKeyEvent', { type: s.keyDown ? 'rawKeyDown' : 'keyUp', key: k, code: k, windowsVirtualKeyCode: code });
  }
```
Expected: n1에서 느리 이름표 위에만 말풍선 표시. n2에서 피오가 새싹이 쪽을 보고 인사 말풍선을 띄운다. 새싹이가 피오에게 닿지 않았으면 이동 시간을 조절한다.

---

### Task 5: 주민마다 다른 버릇 · 쉬는 날엔 같이 쉬기

**Files:**
- Modify: `src/scene/Npc.ts`
- Modify: `src/scene/GardenScene.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Task 4의 `Npc` 구조, `events`의 `'sprout-pose'`(쉬는 날 바뀜)
- Produces: `Npc.setResting(on: boolean): void`

- [ ] **Step 1: 버릇 설정과 쉬기** — `src/scene/Npc.ts`

import에 `NpcId`는 이미 있다. 상수 묶음 아래에:

```ts
const ORIGIN_Y = 0.96; // 발 위치(그림 아래쪽)
const CALM = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

type Habit = { speed: number; pause: [number, number]; idle: 'tilt' | 'tap' | null; hop: boolean };
/** 주민마다 다른 버릇(그림 없이 움직임으로). 위치(x, y)는 그대로 두고 기울기·크기·그리는 기준점만 움직인다(충돌·앞뒤 판단에 영향 없음). */
const HABITS: Record<NpcId, Habit> = {
  nuri: { speed: 12, pause: [3500, 7000], idle: 'tilt', hop: false }, // 달팽이: 더 느리고, 오래 멈춰 고개를 기울인다
  moru: { speed: 20, pause: [2000, 5500], idle: 'tap', hop: false }, // 두더지: 멈춰 있으면 망치질하듯 들썩인다
  pio: { speed: 26, pause: [1500, 4000], idle: null, hop: true }, // 참새: 통통 뛰며 다닌다
};
```

`SPEED` 상수는 지운다(이제 `HABITS`가 정한다).

필드 추가:

```ts
  private readonly habit: Habit;
  private readonly baseScaleY: number;
  private idleIn = 3000;
  private resting = false;
  private breath?: Phaser.Tweens.Tween;
```

생성자의 `this.sprite = …setDisplaySize(SIZE, SIZE);` 바로 뒤에:

```ts
    this.habit = HABITS[id];
    this.baseScaleY = this.sprite.scaleY;
```

`hush()` 아래에 추가:

```ts
  /** 쉬는 날: 자기 자리 근처에서 거의 움직이지 않고 천천히 숨쉰다. */
  setResting(on: boolean): void {
    if (this.resting === on) return;
    this.resting = on;
    this.target = null;
    this.breath?.remove();
    this.breath = undefined;
    this.sprite.setScale(this.sprite.scaleX, this.baseScaleY).setAngle(0);
    if (on && !CALM) {
      this.breath = this.scene.tweens.add({ targets: this.sprite, scaleY: this.baseScaleY * 1.03, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** 멈춰 있을 때의 버릇 한 번(이미 움직이는 중이면 건너뛴다). */
  private idleHabit(): void {
    if (CALM || this.resting || this.scene.tweens.isTweening(this.sprite)) return;
    if (this.habit.idle === 'tilt') {
      this.scene.tweens.add({ targets: this.sprite, angle: -7, duration: 500, yoyo: true, hold: 500, ease: 'Sine.easeInOut' });
    } else if (this.habit.idle === 'tap') {
      this.scene.tweens.add({ targets: this.sprite, scaleY: this.baseScaleY * 0.9, duration: 110, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
    }
  }
```

`update()`에서 멈춰 있는 동안(타깃 없음) 부분을 바꾼다:

```ts
    if (!this.target) {
      this.pause -= dtMs;
      this.pose('front');
      this.sprite.setFlipX(false);
      this.sprite.setOrigin(0.5, ORIGIN_Y);
      this.idleIn -= dtMs;
      if (this.idleIn <= 0) {
        this.idleHabit();
        this.idleIn = 2500 + Math.random() * 2500;
      }
      if (this.pause > 0 || this.resting) return; // 쉬는 날엔 서성이지 않는다
      // 자기 자리 근처에서 설 수 있는 곳을 골라 천천히 걸어간다. 못 찾으면 잠시 더 쉰다.
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * (ROAM - 20);
        const t = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r * 0.6 };
        if (this.canStand(t.x, t.y)) {
          this.target = t;
          break;
        }
      }
      const [lo, hi] = this.habit.pause;
      this.pause = lo + Math.random() * (hi - lo);
      return;
    }
```

이동 중 속도·통통 뛰기(`const step = (SPEED * dtMs) / 1000;` 줄과 위치를 옮긴 뒤):

```ts
    const step = (this.habit.speed * dtMs) / 1000;
```

```ts
        this.sprite.setPosition(nx, ny);
        // 피오는 통통 뛰듯: 위치는 그대로, 그리는 기준점만 올렸다 내린다.
        if (this.habit.hop && !CALM) this.sprite.setOrigin(0.5, ORIGIN_Y + (Math.abs(Math.sin(this.clock / 110)) * 6) / SIZE);
```

생성자의 `setOrigin(0.5, 0.96)`을 `setOrigin(0.5, ORIGIN_Y)`로 바꾼다.

- [ ] **Step 2: 쉬는 날을 주민에게 알려 주기** — `src/scene/GardenScene.ts`

`create()`의 `offs` 목록에서 `events.on('sprout-pose', …)`를 바꾼다:

```ts
      events.on('sprout-pose', ({ pose }) => {
        this.player.setPose(pose);
        this.npcs.forEach((n) => n.setResting(pose === 'rest')); // 쉬는 날엔 주민도 같이 쉰다
      }),
```

`create()`에서 주민들을 만든 뒤(`this.refreshMarks();` 다음 줄):

```ts
    if (isResting(store.state, todayKey())) this.npcs.forEach((n) => n.setResting(true));
```

- [ ] **Step 3: 문서** — `CLAUDE.md`의 `src/scene` 설명 끝에 덧붙인다:

```markdown
  주민(`Npc.ts`)은 버릇(`HABITS`: 느리는 느리고 고개를 기울이고, 모루는 망치질하듯 들썩이고, 피오는 통통 뛴다)으로 움직이고, 그날 열린 이야기가 있으면 머리 위에 표시가 뜬다(`GardenScene.refreshMarks`). 새싹이가 다가가면 돌아보고 짧게 말을 건다(같은 주민은 1분 간격, 쉬는 날엔 쉬는 말). 쉬는 날엔 서성이지 않는다. 버릇은 위치를 바꾸지 않고 기울기·크기·기준점만 움직인다.
```

- [ ] **Step 4: 테스트·빌드·화면 확인**

Run: `npm test && npm run build`
Expected: 전부 PASS, `✓ built`

쉬는 날 확인: Task 4의 `npc-steps.json`에서 저장본의 `days`를 오늘 날짜로 `{"refresh":0,"rested":true,"energy":"normal"}`을 넣어(js에서 `todayKey`와 같은 형식으로 계산) 다시 돌리고, 넓게 본 화면을 1.5초 간격으로 두 번 찍어 주민 자리가 거의 그대로인지, 피오에게 다가가면 "그럼 나도 잠깐 조용히 있어볼래."가 뜨는지 본다.

```json
[
 {"js": "(()=>{const d=new Date();const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const s={version:1,logs:[],garden:{items:[],plants:[],storage:[]},seeds:[],fruit:0,freePackets:0,story:{seen:['intro','free-packet'],choices:{}},bonusPackets:0,visits:{count:0},purchases:0,chats:[],days:{[k]:{refresh:0,rested:true,energy:'normal'}},settings:{sound:false,demo:false,dayOffset:0}};localStorage.clear();localStorage.setItem('plantkeeper:v1',JSON.stringify(s));location.href=location.pathname;})()", "wait": 3000},
 {"js": "for(let i=0;i<8;i++)document.querySelector('[aria-label=\"넓게 보기\"]')?.click()", "wait": 600, "shot": "r1"},
 {"wait": 1500, "shot": "r2"},
 {"keyDown": "ArrowRight", "wait": 3100}, {"keyUp": "ArrowRight", "wait": 50},
 {"keyDown": "ArrowUp", "wait": 1500}, {"keyUp": "ArrowUp", "wait": 500, "shot": "r3_rest_line"}
]
```

Expected: r1·r2에서 주민 위치가 같다(쉬는 날이라 서성이지 않음). r3에서 피오 말풍선이 쉬는 말. 평소 날(Task 4 화면)에는 피오가 통통 뛰며 다니는지, 느리가 멈춰 고개를 기울이는지는 연속 캡처로 대략 보고, 정확한 느낌은 사람이 실제 화면에서 확인한다.
