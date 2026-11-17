import { useState } from 'react';
import { copy } from '../../core/copy';
import { events } from '../../core/events';
import type { PlaceId } from '../../core/places';
import { PLACE_MEMO_MAX, clearMemoDraft, memoDraft, placeMemo, savePlaceMemo, setMemoDraft, validMemoText, workReaction } from '../../core/placeMemo';
import { store } from '../../core/store';
import { closeModal, openModal } from '../modal';
import { saveProgress } from '../saveProgress';
import { SpeakerPortrait } from '../SpeakerPortrait';
import { useAppState } from '../useAppState';
import { PanelHead } from './PanelHead';

type Mode = 'ask' | 'write' | 'done';
const text = copy.placeMemo;
const speakerOf = (place: PlaceId) => (place === 'school' ? '피오' : '모루');

/**
 * 장소 이야기에서 책상 자리를 고른 뒤의 "남기기 / 자리만 보기" 단계(r2-V02-C1-A1/A2, r2-V03-C1-A1/A2).
 * 남기기는 직접 한 줄을 적어 저장하는 선택이고, 자리만 보기는 아무것도 바꾸지 않는다.
 * 메모는 미션·기록·씨앗·복귀 상태·책갈피를 만들지 않는다(core/placeMemo.ts).
 */
function PlaceMemoPanel({ place }: { place: PlaceId }) {
  const s = useAppState(), memo = placeMemo(s, place);
  const [mode, setMode] = useState<Mode>('ask');
  const [value, setValue] = useState(memoDraft(place) ?? memo?.body ?? '');
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!validMemoText(value)) { setError(true); return; }
    // 저장이 실패하면 입력(초안)과 이전 메모를 그대로 두고 성공 문구도 띄우지 않는다.
    if (!saveProgress(draft => { savePlaceMemo(draft, place, value); })) return;
    clearMemoDraft(place);
    setSaved(true); setError(false); setMode('done');
  };
  const cancel = () => { clearMemoDraft(place); setValue(memo?.body ?? ''); setError(false); setMode('ask'); };

  return <section className="panel place-memo-panel" role="dialog" aria-label={text.title[place]}>
    <PanelHead title={text.title[place]} />
    {mode === 'ask' && <>
      <p className="panel-message">{text.ask[place]}</p>
      {memo && <p className="panel-note">{text.existing} · {memo.body}</p>}
      <div className="btn-pair">
        <button className="btn btn-primary" onClick={() => setMode('write')}>{memo ? text.edit : text.leave[place]}</button>
        <button className="btn btn-secondary" onClick={() => setMode('done')}>{text.look}</button>
      </div>
    </>}
    {mode === 'write' && <>
      <p className="panel-message">{text.ask[place]}</p>
      <input aria-label={text.field} value={value} maxLength={PLACE_MEMO_MAX} autoComplete="off"
        onChange={e => { setValue(e.target.value); setMemoDraft(place, e.target.value); setError(false); }} />
      <p className="panel-note">{text.hint}</p>
      {error && <p role="alert">{text.invalid}</p>}
      <div className="btn-pair">
        <button className="btn btn-primary" onClick={save}>{text.save}</button>
        <button className="btn btn-secondary" onClick={cancel}>{text.cancel}</button>
      </div>
    </>}
    {mode === 'done' && <>
      {saved && <p className="panel-message">{text.saved[place]}</p>}
      {saved && <><SpeakerPortrait name={speakerOf(place)} /><p className="narrative-text">{text.reaction[place]}</p></>}
      {place === 'work' && <><SpeakerPortrait name="모루" /><p className="narrative-text">{workReaction(store.state)}</p>
        <div className="btn-pair">
          <button className="btn btn-primary" onClick={() => { closeModal(); events.emit('place-travel', { place: null }); }}>{text.back}</button>
          <button className="btn btn-secondary" onClick={() => closeModal()}>{text.stay}</button>
        </div></>}
      {place === 'school' && <button className="btn btn-primary" onClick={() => closeModal()}>{text.close}</button>}
    </>}
    {mode !== 'done' && <button className="btn-chip" onClick={() => closeModal()}>{copy.map.later}</button>}
  </section>;
}

export const openPlaceMemo = (place: PlaceId): void => openModal(<PlaceMemoPanel place={place} />);
