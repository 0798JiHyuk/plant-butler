import { useSyncExternalStore } from 'react';
import { events } from '../core/events';

let indoor = false;
const listeners = new Set<() => void>();
export const isIndoors = () => indoor;
export function setIndoors(value: boolean): void { indoor = value; listeners.forEach(fn => fn()); }
events.on('location-changed', ({ indoor }) => setIndoors(indoor));
export const useIndoors = () => useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, isIndoors);
