// 모달 한 개를 화면 가운데에 띄우는 곳. openModal(<패널/>)로 열고 closeModal()로 닫는다. 한 번에 하나만 열린다.
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { events } from '../core/events';

interface ModalState {
  id: number;
  node: ReactNode;
  dismissable: boolean;
  onClose?: () => void;
}

let current: ModalState | null = null;
let seq = 0;
const subs = new Set<() => void>();
const notify = () => subs.forEach((fn) => fn());

export function closeModal(runHook = true): void {
  if (!current) return;
  const hook = current.onClose;
  current = null;
  events.emit('ui-lock', { locked: false });
  notify();
  if (runHook) hook?.();
}

/** dismissable=false면 바깥을 눌러도 Esc로도 닫히지 않는다(여력 체크·회고처럼 답을 받아야 하는 창). */
export function openModal(node: ReactNode, dismissable = true, onClose?: () => void): void {
  if (current) {
    const hook = current.onClose;
    current = null;
    hook?.();
  }
  current = { id: ++seq, node, dismissable, onClose };
  events.emit('ui-lock', { locked: true });
  notify();
}

export function isModalOpen(): boolean {
  return current !== null;
}

export function ModalHost() {
  const modal = useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => current,
  );
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modal) return;
    layer.current?.querySelector<HTMLElement>('button, select, input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal.dismissable) closeModal();
      if (e.key !== 'Tab' || !layer.current) return;
      // 모달 밖(정원 뒤쪽 버튼)으로 포커스가 새지 않게 안에서만 돌린다.
      const items = [...layer.current.querySelectorAll<HTMLElement>('button:not([disabled]), select, input')];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal?.id]);

  if (!modal) return null;
  return (
    <div
      className="modal-layer interactive"
      ref={layer}
      onPointerDown={(e) => {
        if (modal.dismissable && e.target === layer.current) closeModal();
      }}
    >
      <div key={modal.id} style={{ display: 'contents' }}>
        {modal.node}
      </div>
    </div>
  );
}
