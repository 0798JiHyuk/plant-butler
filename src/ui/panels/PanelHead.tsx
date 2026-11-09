import type { ReactNode } from 'react';
import { copy } from '../../core/copy';
import { IconBtn } from '../icons';
import { closeModal } from '../modal';

/** 패널 머리말: 왼쪽 빈칸(또는 뒤로) · 가운데 제목(또는 탭) · 오른쪽 닫기(onClose가 없으면 창을 닫는다) */
export function PanelHead({ title, center, left, onClose }: { title?: string; center?: ReactNode; left?: ReactNode; onClose?: () => void }) {
  return (
    <div className="panel-head">
      {left ?? <span className="icon-spacer" />}
      {center ?? <h2 className="panel-title">{title}</h2>}
      <IconBtn name="close" label={copy.panel.close} onClick={onClose ?? closeModal} />
    </div>
  );
}
