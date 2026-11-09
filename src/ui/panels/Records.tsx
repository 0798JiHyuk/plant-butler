// 수첩: 내가 쌓아 온 것을 모은다. 기록은 해낸 활동만, 도감은 만난 식물만, 출석은 찾아온 횟수만. 빈 날은 보이지 않는다.
import { useState } from 'react';
import { activityById } from '../../core/activities';
import { todayKey } from '../../core/clock';
import { copy } from '../../core/copy';
import { plantById } from '../../core/plants';
import { groupByDate, weekKindsCount } from '../../core/stats';
import type { LogEntry } from '../../core/types';
import { ActivityImg, PlantImg, UiIconImg } from '../icons';
import { openModal } from '../modal';
import { useAppState } from '../useAppState';
import { GiftBody } from './Gift';
import { PanelHead } from './PanelHead';

type RecordsTab = 'log' | 'book' | 'stamps';

function formatDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일`;
}

function LogRow({ l }: { l: LogEntry }) {
  const a = activityById(l.activityId);
  const place = [l.plan.when, l.plan.where || l.plan.criterion].filter(Boolean).join(' · ');
  return (
    <li className="rec-item">
      <span className="mission-icon"><ActivityImg id={l.activityId} /></span>
      <div className="mission-info">
        <strong>{l.mission?.record ?? a?.name ?? l.text ?? ''}</strong>
        <small>{place}</small>
        {l.chips.length > 0 && <small className="rec-chips">{l.chips.map((c) => copy.records.chip[c]).join(' · ')}</small>}
      </div>
    </li>
  );
}

function LogBody() {
  const { logs } = useAppState();
  if (logs.length === 0) return <p className="panel-message">{copy.records.empty}</p>;
  return (
    <>
      <p className="week-summary">{copy.records.weekSummary(weekKindsCount(logs, todayKey()))}</p>
      <div className="records-scroll">
        {groupByDate(logs).map((g) => (
          <div key={g.date}>
            <h3 className="rec-date">{formatDate(g.date)}</h3>
            <ul className="mission-list">{g.logs.map((l) => <LogRow key={l.id} l={l} />)}</ul>
          </div>
        ))}
      </div>
    </>
  );
}

function BookBody() {
  const { garden, seeds } = useAppState();
  // 도감은 종류별로 한 장. 창고의 식물과 씨앗함의 씨앗도 만난 걸로 센다. 심은 식물은 처음 만난 날을 보여 준다.
  const first = new Map<string, string>();
  for (const p of [...garden.plants, ...garden.storage.filter((s) => s.type === 'plant')]) {
    const id = 'plantId' in p ? p.plantId : '';
    const date = 'date' in p ? p.date : '';
    if (id && (!first.has(id) || date < (first.get(id) ?? ''))) first.set(id, date);
  }
  for (const seed of seeds) if (!first.has(seed.plantId)) first.set(seed.plantId, '');
  if (first.size === 0) return <p className="panel-message">{copy.book.empty}</p>;
  return (
    <>
      <p className="week-summary">{copy.book.count(first.size)}</p>
      <ul className="book-grid">
        {[...first].map(([id, date]) => {
          const plant = plantById(id);
          return (
            <li className="book-card" key={id}>
              <span className="book-icon">{plant ? <PlantImg id={plant.id} /> : <UiIconImg name="sprout" />}</span>
              <strong>{plant?.name ?? ''}</strong>
              {date && <small>{formatDate(date)}</small>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Records({ initial }: { initial: RecordsTab }) {
  const [tab, setTab] = useState<RecordsTab>(initial);
  const tabs = (
    <div className="tabs" role="tablist">
      {([['log', copy.book.logTab], ['book', copy.book.tab], ['stamps', copy.records.stampsTab]] as const).map(([id, label]) => (
        <button key={id} type="button" className="tab" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
          {label}
        </button>
      ))}
    </div>
  );
  return (
    <section className="panel records" role="dialog" aria-label={copy.records.title}>
      <PanelHead center={tabs} />
      {tab === 'log' ? <LogBody /> : tab === 'book' ? <BookBody /> : <GiftBody />}
    </section>
  );
}

export const openRecords = (initial: RecordsTab = 'log') => openModal(<Records initial={initial} />);
