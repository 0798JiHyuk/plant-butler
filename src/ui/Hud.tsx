// 정원 위에 겹쳐 보이는 화면: 이름판, 위쪽 버튼, 왼쪽 위 묶음(열매·주머니·선물), 말풍선, 오늘의 활동 카드, 대화 버튼.
// #ui 바로 아래에 이 요소들이 나란히 놓여야 CSS(위치)가 맞아서 Fragment로 내보낸다.
import { useEffect, useRef } from 'react';
import { activityById } from '../core/activities';
import { todayKey } from '../core/clock';
import { copy } from '../core/copy';
import { giftAvailable } from '../core/economy';
import { events, type HudAction } from '../core/events';
import { isResting, limitReached, pendingPacketCount } from '../core/rules';
import { ActivityImg, UiIconImg, type UiIcon } from './icons';
import { useAppState } from './useAppState';
import { activeMissionSession, missionPlan, missionProgress } from '../core/missions';

const emit = (id: HudAction) => () => events.emit('hud-action', { id });

function HudButton({ className, id, label, icon, hidden }: { className: string; id: HudAction; label: string; icon: UiIcon; hidden?: boolean }) {
  return (
    <button type="button" className={`${className} interactive`} hidden={hidden} onClick={emit(id)}>
      <UiIconImg name={icon} className="icon" />
      <span className="label">{label}</span>
    </button>
  );
}

/** 새싹이 머리 위를 따라다니는 말풍선 */
function Bubble({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      events.on('player-screen', ({ x, y, zoom }) => {
        const el = ref.current;
        if (!el) return;
        el.style.left = `${Math.min(Math.max(x, 80), 764)}px`;
        // 새싹이 키(72px)가 배율만큼 커지므로 머리 위로 그만큼 올린다
        el.style.top = `${Math.max(y - 72 * zoom - 10, 56)}px`;
      }),
    [],
  );
  return <div className="bubble" role="status" ref={ref}>{text}</div>;
}

function ActivityCard() {
  const s = useAppState();
  const date = todayKey();
  const plan = missionPlan(s) ?? s.days[date]?.plan;
  const sessionPending = !!activeMissionSession(s)?.reportedActions.length && !missionProgress(s).execution;
  let body;
  if (isResting(s, date)) {
    body = (
      <>
        <p className="card-message">{copy.card.resting}</p>
        <p className="card-sub">{copy.card.restingSub}</p>
        <button type="button" className="btn btn-secondary" onClick={emit('other-activity')}>{copy.card.unrest}</button>
      </>
    );
  } else if (sessionPending) {
    body = <><p className="card-message">{copy.missions.report}</p><button className="btn btn-primary" onClick={emit('other-activity')}>{copy.missions.resumeSession}</button></>;
  } else if (limitReached(s, date)) {
    body = (
      <>
        <p className="card-message">{copy.card.enough}</p>
        <p className="card-sub">{copy.card.enoughSub}</p>
        <button type="button" className="btn btn-secondary" onClick={emit('other-activity')}>{copy.card.pick}</button>
      </>
    );
  } else if (!plan) {
    body = (
      <>
        <p className="card-message">{copy.card.empty}</p>
        <p className="card-sub" />
        <button type="button" className="btn btn-primary" onClick={emit('other-activity')}>{copy.card.pick}</button>
      </>
    );
  } else {
    const a = activityById(plan.activityId);
    body = (
      <>
        <div className="card-activity">
          <ActivityImg id={plan.activityId} className="card-icon" />
          <div>
            <strong>{s.missions?.execution?.customId ? s.missions.custom.find(c => c.id === s.missions!.execution!.customId)?.name ?? a?.name : a?.name ?? plan.text ?? ''}</strong>
            <small>{[plan.info.when, plan.info.where || plan.info.criterion].filter(Boolean).join(' · ')}</small>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={emit('done')}>{copy.card.done}</button>
        <div className="btn-pair">
          <button type="button" className="btn btn-secondary" onClick={emit('plan-check')}>{copy.card.confirm}</button>
          <button type="button" className="btn btn-secondary" onClick={emit('other-activity')}>{copy.card.other}</button>
        </div>
      </>
    );
  }
  return (
    <section className="activity-card interactive" aria-label={copy.card.title}>
      <div className="card-title">
        <span>{copy.card.title}</span>
        <UiIconImg name="leaf" className="leaf" />
      </div>
      {body}
    </section>
  );
}

export function Hud() {
  const s = useAppState();
  const date = todayKey();
  const packets = pendingPacketCount(s);
  const bubble = isResting(s, date) ? copy.bubble.rest : limitReached(s, date) ? copy.bubble.enough : missionPlan(s) || s.days[date]?.plan ? copy.bubble.planned : copy.bubble.ask;
  return (
    <>
      <div className="garden-name">
        <strong>{copy.garden.name}</strong>
        <span>{copy.garden.tagline}</span>
      </div>
      <div className="top-buttons">
        <HudButton className="hud-btn" id="settings" label={copy.hud.settings} icon="settings" />
      </div>
      {/* 자주 쓰는 메뉴는 엄지가 닿는 아래쪽에 모은다. 할 일(활동 카드)은 오른쪽 아래에 그대로 둔다 */}
      <nav className="bottom-menu">
        <HudButton className="hud-btn" id="bag" label={copy.hud.bag} icon="packet" />
        <HudButton className="hud-btn" id="records" label={copy.hud.records} icon="records" />
        <HudButton className="hud-btn" id="decorate" label={copy.hud.decorate} icon="decorate" />
        <HudButton className="hud-btn" id="shop" label={copy.hud.shop} icon="shop" />
      </nav>
      {/* 왼쪽 위 묶음: 열매, 씨앗 주머니, 방문 선물(받을 게 있을 때만 보인다. 기한은 보여 주지 않는다) */}
      <div className="left-stack">
        <div className="fruit-badge">
          <UiIconImg name="fruit" className="fruit-icon" />
          <span>{copy.hud.fruit(s.fruit)}</span>
        </div>
        <HudButton className="packet-btn" id="packet" label={packets > 1 ? `${copy.packet.button} ${packets}` : copy.packet.button} icon="packet" hidden={packets === 0} />
        <HudButton className="packet-btn gift-btn" id="gift" label={copy.hud.gift} icon="gift" hidden={!giftAvailable(s, date)} />
      </div>
      <Bubble text={bubble} />
      <ActivityCard />
      <HudButton className="talk-btn" id="talk" label={copy.hud.talk} icon="talk" />
    </>
  );
}
