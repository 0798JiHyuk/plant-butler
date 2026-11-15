import type { AppState } from '../core/types';
import { store } from '../core/store';
import { copy } from '../core/copy';
import { showToast } from './toast';
export function saveProgress(change: (s: AppState) => void): boolean {
  const ok = store.tryUpdate(change);
  if (!ok) showToast([copy.map.saveError]);
  return ok;
}
