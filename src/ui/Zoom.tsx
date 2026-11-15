// 시야(배율) 조절: 화면 아래 가운데 슬라이더, [−][+] 버튼, 마우스 휠. 폰은 손가락으로 보면 되지만 컴퓨터에서 쓰기 위한 것.
import { useEffect, useRef, useState } from 'react';
import { copy } from '../core/copy';
import { events } from '../core/events';
import { store } from '../core/store';
import { coverZoom, defaultViewZoom, GARDEN_H, MAP_H } from '../scene/map';
import { useIndoors } from './worldLocation';

const W = 844;
const MAX = 2;

export function Zoom({ stage }: { stage: HTMLElement }) {
  const indoor = useIndoors();
  const mapHeight = indoor ? GARDEN_H : MAP_H;
  const stageH = () => parseFloat(stage.style.getPropertyValue('--stage-h')) || 390;
  const minimum = () => indoor ? Math.min(W / 1266, stageH() / mapHeight) : coverZoom(W, stageH(), mapHeight);
  const clamp = (z: number) => Math.min(MAX, Math.max(minimum(), z));
  const read = () => indoor ? minimum() : clamp(store.state.settings.viewZoom ?? defaultViewZoom(stageH()));
  const [zoom, setZoom] = useState(read);
  const [min, setMin] = useState(() => Math.ceil(minimum() * 100));
  const currentZoom = useRef(zoom);
  currentZoom.current = zoom;
  const saveTimer = useRef<number>();

  const apply = (z: number, persist: boolean) => {
    const next = clamp(z);
    setZoom(next);
    events.emit('view-zoom', { zoom: next });
    if (persist) store.update((d) => { d.settings.viewZoom = next; });
  };

  useEffect(() => {
    const onResize = () => {
      setMin(Math.ceil(minimum() * 100));
      setZoom(read());
    };
    // 마우스 휠: 위로 굴리면 가까이, 아래로 굴리면 넓게. 창이 열려 있거나 꾸미는 중에는 쓰지 않는다.
    const onWheel = (e: WheelEvent) => {
      if (document.querySelector('.modal-layer') || document.getElementById('ui')?.classList.contains('decorating')) return;
      e.preventDefault();
      const next = clamp(currentZoom.current - Math.sign(e.deltaY) * 0.05);
      setZoom(next);
      events.emit('view-zoom', { zoom: next });
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => store.update((d) => { d.settings.viewZoom = next; }), 300);
    };
    window.addEventListener('resize', onResize);
    stage.addEventListener('wheel', onWheel, { passive: false });
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      stage.removeEventListener('wheel', onWheel);
    };
  }, [indoor]);

  return (
    <div className="zoom-ctl interactive" role="group" aria-label={copy.zoom.label}>
      <button type="button" className="zoom-btn" aria-label={copy.zoom.wider} onClick={() => apply(zoom - 0.1, true)}>−</button>
      <input
        className="zoom-range"
        type="range"
        step={5}
        min={min}
        max={MAX * 100}
        value={Math.round(zoom * 100)}
        aria-label={copy.zoom.label}
        onChange={(e) => apply(Number(e.target.value) / 100, false)}
        onPointerUp={(e) => apply(Number((e.target as HTMLInputElement).value) / 100, true)}
        onKeyUp={(e) => apply(Number((e.target as HTMLInputElement).value) / 100, true)}
      />
      <button type="button" className="zoom-btn" aria-label={copy.zoom.closer} onClick={() => apply(zoom + 0.1, true)}>+</button>
      <span className="zoom-label">{Math.round(zoom * 100)}%</span>
    </div>
  );
}
