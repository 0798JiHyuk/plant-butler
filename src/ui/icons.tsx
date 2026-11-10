// 아이콘·삽화 이미지. 그림 파일은 tools/slice_art.py가 art/source 에서 잘라 public/assets 에 둔다.
const base = import.meta.env.BASE_URL;

export type UiIcon = 'records' | 'decorate' | 'settings' | 'talk' | 'packet' | 'leaf' | 'back' | 'close' | 'check' | 'clock' | 'flag' | 'sprout' | 'fruit' | 'gift' | 'shop';

/** 뜻은 옆의 글자가 말해 주므로 스크린리더에는 숨긴다. */
function Img({ src, className }: { src: string; className: string }) {
  return <img src={src} className={className} alt="" draggable={false} aria-hidden="true" />;
}

export const UiIconImg = ({ name, className = 'ui-icon' }: { name: UiIcon; className?: string }) => (
  <Img src={`${base}assets/icons-ui/${name}.png`} className={className} />
);

/** 활동 아이콘. 직접 적은 일(활동 id 없음)은 연필 아이콘. */
export const ActivityImg = ({ id, className = 'act-icon' }: { id?: string; className?: string }) => (
  <Img src={`${base}assets/activities/${id ?? 'draw'}.png`} className={className} />
);

export const PlantImg = ({ id, className = 'plant-icon' }: { id: string; className?: string }) => (
  <Img src={`${base}assets/plants/${id}.png`} className={className} />
);

/** 정원 소품 그림. 이전 그림의 저장본(꽃·화분·등불)은 새 소품으로 바꿔 보여준다. */
const LEGACY_PROP: Record<string, string> = { flower: 'flowerpot', pot: 'flowerpot', lamp: 'table' };
export const PropImg = ({ kind, className = 'prop-icon' }: { kind: string; className?: string }) => (
  <Img src={`${base}assets/garden/props/${LEGACY_PROP[kind] ?? kind}.png`} className={className} />
);

export const SproutImg = ({ className = 'sprout-icon' }: { className?: string }) => (
  <Img src={`${base}assets/garden/sprout2/idle.png`} className={className} />
);

/** 머리말의 뒤로·닫기처럼 아이콘만 있는 버튼 */
export function IconBtn({ name, label, onClick }: { name: UiIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={onClick}>
      <UiIconImg name={name} />
    </button>
  );
}
