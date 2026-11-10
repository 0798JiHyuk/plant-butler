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

/** 다가갔을 때 주민의 짧은 말: 쉬는 날이면 쉬는 말, 아니면 인사를 돌아가며. */
export function npcGreeting(npc: NpcId, resting: boolean, turn: number): string {
  return resting ? copy.npcRest[npc] : nth(copy.npcGreet[npc], turn);
}

/** 수첩의 이야기: 최근 날짜 먼저, 같은 날은 나중에 남긴 것 먼저. */
export function chatsByDate(chats: ChatLog[]): { date: string; chats: ChatLog[] }[] {
  const byDate = new Map<string, ChatLog[]>();
  for (const c of [...chats].reverse()) byDate.set(c.date, [...(byDate.get(c.date) ?? []), c]);
  return [...byDate].sort((x, y) => y[0].localeCompare(x[0])).map(([date, list]) => ({ date, chats: list }));
}
