import type { AppState } from '@/core/types';
import { createState, decodeState, hasProgress, stateKey } from '@/core/state';
import { store } from '@/core/store';
import { loadJson, saveJson } from '@/core/storage';
import { auth } from '@/lib/auth';
import { GardenError, gardenRepository, type GardenRecord, type GardenRepository } from '@/lib/gardenRepository';

export type SyncPhase = 'local' | 'loading' | 'pending' | 'saving' | 'saved' | 'conflict' | 'error';
export interface Summary { plants: number; seeds: number; stored: number; logs: number; fruit: number }
export const summarize = (v: AppState): Summary => ({ plants: v.garden.plants.length, seeds: v.seeds.length, stored: v.garden.storage.length, logs: v.logs.length, fruit: v.fruit });
export interface SyncState { phase: SyncPhase; updatedAt?: string; error?: GardenError['kind']; remote?: Summary }
export interface SyncMetadata { revision: number; baseline: string }
interface StorePort {
  readonly state: AppState;
  readonly restoring?: boolean;
  activateUser(userId: string | null): { imported: boolean; fallback: AppState };
  restore(state: AppState): void;
  backup(value: AppState): void;
  subscribe(fn: () => void): () => void;
}
interface Options {
  readMeta(owner: string): SyncMetadata | null;
  writeMeta(owner: string, meta: SyncMetadata): void;
  readImport?(owner: string): AppState | null;
  writeImport?(owner: string, fallback: AppState | null): void;
  delay?: number;
}

export function createGardenSync(repository: GardenRepository, local: StorePort, options: Options) {
  let state: SyncState = { phase: 'local' };
  let owner: string | null | undefined;
  let epoch = 0;
  let revision = 0;
  let remote: GardenRecord | null = null;
  let importing = false;
  let fallback = createState();
  let applying = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let operation: { epoch: number; promise: Promise<void> } | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: SyncState) => { state = next; listeners.forEach(fn => fn()); };
  const cancel = () => { clearTimeout(timer); timer = undefined; };
  const active = (ticket: number) => ticket === epoch;
  const schedule = () => { cancel(); timer = setTimeout(() => { void service.flush(); }, options.delay ?? 600); };
  const conflict = (value: GardenRecord) => { remote = value; publish({ phase: 'conflict', updatedAt: value.updatedAt, remote: summarize(value.state) }); };
  function acknowledge(value: GardenRecord) {
    revision = value.revision; importing = false;
    options.writeMeta(owner!, { revision, baseline: stateKey(value.state) });
    options.writeImport?.(owner!, null);
  }
  function restore(value: GardenRecord) {
    if (stateKey(local.state) !== stateKey(value.state)) local.backup(local.state);
    applying = true;
    try { local.restore(value.state); } finally { applying = false; }
    acknowledge(value);
    if (stateKey(local.state) === stateKey(value.state)) publish({ phase: 'saved', updatedAt: value.updatedAt });
    else { publish({ phase: 'pending', updatedAt: value.updatedAt }); schedule(); }
  }
  function exclusive(task: (ticket: number) => Promise<void>): Promise<void> {
    const ticket = epoch;
    if (operation?.epoch === ticket) return operation.promise;
    const promise = Promise.resolve().then(() => task(ticket)).catch(error => {
      if (active(ticket)) publish({ phase: 'error', updatedAt: state.updatedAt, error: error instanceof GardenError ? error.kind : 'connection' });
    }).finally(() => { if (operation?.promise === promise) operation = undefined; });
    operation = { epoch: ticket, promise };
    return promise;
  }
  async function save(expected: number, ticket: number) {
    const userId = owner;
    if (!userId || !active(ticket)) return;
    const snapshot = decodeState(local.state);
    publish({ phase: 'saving', updatedAt: state.updatedAt });
    const result = await repository.save(userId, snapshot, expected, crypto.randomUUID());
    if (!active(ticket)) return;
    if (!result) {
      const latest = await repository.load(userId);
      if (!active(ticket)) return;
      if (!latest) throw new GardenError('connection');
      conflict(latest); return;
    }
    acknowledge(result);
    if (stateKey(local.state) === stateKey(snapshot)) publish({ phase: 'saved', updatedAt: result.updatedAt });
    else { publish({ phase: 'pending', updatedAt: result.updatedAt }); schedule(); }
  }
  const unsubscribe = local.subscribe(() => {
    if (!owner || applying || local.restoring || state.phase === 'loading' || state.phase === 'error' || state.phase === 'conflict' || state.phase === 'saving') return;
    publish({ phase: 'pending', updatedAt: state.updatedAt }); schedule();
  });
  const service = {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    connect(userId: string | null): Promise<void> {
      if (owner === userId) return operation?.promise ?? Promise.resolve();
      epoch++; cancel(); owner = userId; revision = 0; remote = null;
      try {
        const selected = local.activateUser(userId);
        const savedImport = userId ? options.readImport?.(userId) : null;
        importing = selected.imported || !!savedImport;
        fallback = savedImport ? decodeState(savedImport) : selected.fallback;
        if (userId && selected.imported) options.writeImport?.(userId, fallback);
      } catch { publish({ phase: 'error', error: 'invalid' }); return Promise.resolve(); }
      if (!userId) { publish({ phase: 'local' }); return Promise.resolve(); }
      return service.refresh();
    },
    refresh(): Promise<void> {
      cancel();
      if (!owner) return Promise.resolve();
      const userId = owner;
      return exclusive(async ticket => {
        publish({ phase: 'loading', updatedAt: state.updatedAt });
        // GoTrue의 동기 인증 콜백이 끝난 뒤에만 DB 요청을 시작한다.
        await new Promise(resolve => setTimeout(resolve, 0));
        if (!active(ticket)) return;
        const value = await repository.load(userId);
        if (!active(ticket)) return;
        const current = stateKey(local.state);
        if (importing) { conflict(value ?? { state: fallback, revision: 0 }); return; }
        if (!value) { await save(0, ticket); return; }
        const server = stateKey(value.state);
        const meta = options.readMeta(userId);
        if (current === server || meta?.baseline === current || (!meta && !hasProgress(local.state))) restore(value);
        else if (meta?.revision === value.revision && meta.baseline === server) await save(value.revision, ticket);
        else conflict(value);
      });
    },
    flush(): Promise<void> {
      cancel();
      if (!owner) return Promise.resolve();
      if (operation?.epoch === epoch) return operation.promise.then(() => state.phase === 'pending' ? service.flush() : undefined);
      if (state.phase !== 'pending') return Promise.resolve();
      return exclusive(ticket => save(revision, ticket));
    },
    resolve(choice: 'local' | 'server'): Promise<void> {
      if (state.phase !== 'conflict' || !remote || !owner) return Promise.resolve();
      const selected = remote; const userId = owner;
      return exclusive(async ticket => {
        local.backup(local.state); local.backup(selected.state);
        if (choice === 'local') { await save(selected.revision, ticket); return; }
        publish({ phase: 'loading' });
        if (selected.revision === 0) {
          applying = true;
          try { local.restore(selected.state); } finally { applying = false; }
          await save(0, ticket); return;
        }
        const latest = await repository.load(userId);
        if (!active(ticket)) return;
        if (!latest) throw new GardenError('connection');
        if (latest.revision !== selected.revision) { conflict(latest); return; }
        restore(latest);
      });
    },
    pause() { epoch++; owner = undefined; cancel(); publish({ phase: 'local' }); },
    dispose() { service.pause(); unsubscribe(); listeners.clear(); },
  };
  return service;
}

export const gardenSync = createGardenSync(gardenRepository, store, {
  readMeta: owner => loadJson<SyncMetadata | null>(`plantkeeper:sync:${owner}`, null),
  writeMeta: (owner, meta) => saveJson(`plantkeeper:sync:${owner}`, meta),
  readImport: owner => loadJson<AppState | null>(`plantkeeper:import:${owner}`, null),
  writeImport: (owner, fallback) => saveJson(`plantkeeper:import:${owner}`, fallback),
});

export function startAccountData(): () => void {
  const changed = () => { const value = auth.getSnapshot(); if (value.status !== 'checking') void gardenSync.connect(value.userId); };
  const off = auth.subscribe(changed);
  const refresh = () => { void gardenSync.refresh(); };
  const visibility = () => { if (document.visibilityState === 'visible') refresh(); else void gardenSync.flush(); };
  window.addEventListener('online', refresh); window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', visibility);
  changed(); void auth.initialize();
  return () => {
    off(); gardenSync.pause();
    window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', visibility);
  };
}
if (import.meta.hot) import.meta.hot.dispose(() => gardenSync.dispose());
