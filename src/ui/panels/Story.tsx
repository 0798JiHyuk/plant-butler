// 이야기 장면 재생: data/story.json의 대사를 순서대로 보여 주고, 선택을 기억한다. 언제든 닫을 수 있다.
import { useState } from 'react';
import { todayKey } from '../../core/clock';
import { copy } from '../../core/copy';
import { applyChoice, enterNode, finishScene, rememberChoice, resolveNext, scenes, type StoryAfter } from '../../core/story';
import { store } from '../../core/store';
import { SproutImg } from '../icons';
import { closeModal, openModal } from '../modal';
import { NpcBadge } from './Talk';
import { PanelHead } from './PanelHead';

function Story({ sceneId, onAfter }: { sceneId: string; onAfter: (after?: StoryAfter) => void }) {
  const scene = scenes[sceneId];
  const [nodeId, setNodeId] = useState(scene.start);
  const node = scene.nodes[nodeId];
  const go = (next: string) => {
    store.update((d) => enterNode(d, scene.nodes[next], todayKey()));
    setNodeId(next);
  };
  const end = (after = node.after) => {
    onAfter(after);
    closeModal();
  };
  // 실제 상태(씨앗·열매·소품)에 맞는 다음 대사로 간다.
  const next = resolveNext(store.state, node, todayKey());
  const name = node.who === 'sprout' ? copy.talk.npc.sprout.name : copy.talk.npc[node.who].name;
  return (
    <section className={`panel talk${node.choices ? ' talk-compact' : ''}`} role="dialog" aria-label={name}>
      <PanelHead title={name} />
      <div className="talk-bubble">
        <span className="talk-avatar">{node.who === 'sprout' ? <SproutImg /> : <NpcBadge id={node.who} />}</span>
        <p>{node.text}</p>
      </div>
      {node.choices ? (
        <div className="story-choices">
          {node.choices.map((c, i) => (
            <button
              key={c.label}
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                store.update((d) => {
                  rememberChoice(d, sceneId, nodeId, i);
                  applyChoice(d, c, todayKey());
                });
                if (c.next) go(c.next);
                else end(c.after);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => (next ? go(next) : end())}>
          {next ? copy.talk.next : copy.talk.close}
        </button>
      )}
    </section>
  );
}

/** 장면을 연다. 닫히면(끝까지 봤든 중간에 닫았든) 본 것으로 치고 onDone을 부른다. */
export function openStory(sceneId: string, onDone: (after?: StoryAfter) => void): void {
  let after: StoryAfter | undefined;
  store.update((d) => enterNode(d, scenes[sceneId].nodes[scenes[sceneId].start], todayKey()));
  openModal(<Story sceneId={sceneId} onAfter={(a) => { after = a; }} />, true, () => {
    store.update((d) => finishScene(d, sceneId, todayKey()));
    onDone(after);
  });
}
