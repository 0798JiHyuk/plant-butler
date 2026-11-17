import { copy } from '../core/copy';
import { events } from '../core/events';
import { PLACES, type PlaceId } from '../core/places';
import { narrative } from '../core/exploration';
import { closeModal } from './modal';
import { useAppState } from './useAppState';

/** 학교·직장 실내에서 정원 위 화면 대신 보이는 작은 조작줄. 카페의 CafeControls와 같은 자리·모양을 쓴다. */
export function PlaceControls({ place }: { place: PlaceId }) {
  const done = narrative(useAppState()).completed.includes(PLACES[place].sceneId);
  return <div className="social-controls interactive">
    <div className="social-status" role="status">{copy.map[place]} · {copy.map.purpose[place]}</div>
    <div className="social-actions">
      <button className="btn-chip" onClick={() => events.emit('place-memo', { place })}>{done ? copy.places.replay : copy.places.guide}</button>
      <button className="btn-chip" onClick={() => { closeModal(); events.emit('place-travel', { place: null }); }}>{copy.places.leave}</button>
    </div>
  </div>;
}
