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
