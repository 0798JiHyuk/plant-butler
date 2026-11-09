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
