import { describe, expect, it } from 'vitest';
import { canSave, CHAT_MAX, chatsByDate, deleteChat, MIND_PLANTS, npcGreeting, npcReply, saveChat } from '../core/chat';
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
