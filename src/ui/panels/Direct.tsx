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
