import { useEffect, useSyncExternalStore } from 'react';

let lines: string[] | null = null;
let seq = 0;
let timer: number | undefined;
const subs = new Set<() => void>();
const notify = () => subs.forEach((fn) => fn());

export function clearToast():void {
  window.clearTimeout(timer);lines=null;notify();
}

export function showToast(next: string[], ms = 5000): void {
  window.clearTimeout(timer);
  lines = next;
  seq++;
  notify();
  timer = window.setTimeout(() => {
    lines = null;
    notify();
  }, ms);
}

export function ToastHost() {
  const current = useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => lines,
  );
  useEffect(() => () => window.clearTimeout(timer), []);
  if (!current) return null;
  return (
    <div className="toast" role="status" key={seq}>
      {current.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}
