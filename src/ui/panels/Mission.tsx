// 미션 카드 흐름: 영역 → 장면 → 카드 한 장. 고르는 건 언제나 사용자이고, 쉬기·직접 만들기·영역 바꾸기는 어느 화면에서든 갈 수 있다.
// 규칙(거르기·다른 카드·표지판)은 core/missions.ts, 회차·씨앗은 core/rules.ts. 이 화면은 보여 주고 고른 것을 넘기기만 한다.
import { useState, type ReactNode } from 'react';
import { todayKey } from '../../core/clock';
import { copy } from '../../core/copy';
import {
  actionText, advanceStage, alternatives, chooseArea, chooseIntent, chooseMission, chooseWorkStatus, eligibleVariants, FIRST, fits, lastStep,
  markNotApplicable, missionById, moreAfter, preferred, previewCards, startCard, type Mission,
} from '../../core/missions';
import { chooseRest, isResting, limitReached, sessionHasActions, undoRest } from '../../core/rules';
import type { Speaker } from '../../core/story';
import { store } from '../../core/store';
import type { CategoryId, MissionStep, Variant } from '../../core/types';
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
  | { v: 'empty' }
  | { v: 'cross'; from: string; to: string }
  | { v: 'end'; from: string };

/** 이 화면 밖으로 이어지는 일(직접 만들기 창, 회차 닫기). flow.ts가 채운다(화면끼리 직접 부르지 않으려고). */
export const missionLinks: { direct?: () => void; end?: () => void } = {};

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
            {sessionHasActions(s, date) ? (
              <button type="button" className="btn btn-secondary" onClick={() => { closeModal(); missionLinks.end?.(); }}>{copy.mission.end}</button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={rest}>{copy.mission.rest}</button>
            )}
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
    default:
      return empty();
  }
}

/** 카드 흐름을 연다. view가 없으면 처음 화면(영역 → 표지판·마지막 카드 → 장면). */
export function openMission(view?: MissionView): void {
  openModal(<MissionFlow start={view ?? firstView()} />);
}

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
