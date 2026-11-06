import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppState } from '@/core/types';
import { decodeState } from '@/core/state';
import type { Database, Json } from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

export interface GardenRecord { state: AppState; revision: number; updatedAt?: string }
export interface GardenRepository {
  load(userId: string): Promise<GardenRecord | null>;
  save(userId: string, state: AppState, revision: number, requestId: string): Promise<GardenRecord | null>;
}
export class GardenError extends Error {
  constructor(readonly kind: 'setup' | 'connection' | 'invalid') { super(kind); }
}
function failure(error: { code?: string }) {
  return new GardenError(error.code === 'PGRST205' || error.code === 'PGRST202' ? 'setup' : 'connection');
}
function record(raw: unknown, owner: string): GardenRecord {
  if (!raw || typeof raw !== 'object' || !('user_id' in raw) || raw.user_id !== owner
    || !('revision' in raw) || typeof raw.revision !== 'number' || !Number.isSafeInteger(raw.revision) || raw.revision < 1
    || !('updated_at' in raw) || typeof raw.updated_at !== 'string' || !Number.isFinite(Date.parse(raw.updated_at))
    || !('state' in raw)) throw new GardenError('invalid');
  try { return { state: decodeState(raw.state), revision: raw.revision, updatedAt: raw.updated_at }; }
  catch { throw new GardenError('invalid'); }
}
export function createGardenRepository(api: SupabaseClient<Database>): GardenRepository {
  return {
    async load(userId) {
      const { data, error } = await api.from('garden_saves').select('user_id,state,revision,updated_at')
        .eq('user_id', userId).abortSignal(AbortSignal.timeout(12000)).maybeSingle();
      if (error) throw failure(error);
      return data ? record(data, userId) : null;
    },
    async save(userId, state, revision, requestId) {
      const { data, error } = await api.rpc('save_garden_progress', {
        p_user_id: userId, p_state: JSON.parse(JSON.stringify(decodeState(state))) as Json,
        p_expected_revision: revision, p_request_id: requestId,
      }).abortSignal(AbortSignal.timeout(12000));
      if (error) throw failure(error);
      if (!Array.isArray(data)) throw new GardenError('invalid');
      return data.length ? record(data[0], userId) : null;
    },
  };
}
export const gardenRepository: GardenRepository = {
  async load(owner) {
    const api = await getSupabaseClient();
    if (!api) throw new GardenError('setup');
    return createGardenRepository(api).load(owner);
  },
  async save(owner, state, revision, request) {
    const api = await getSupabaseClient();
    if (!api) throw new GardenError('setup');
    return createGardenRepository(api).save(owner, state, revision, request);
  },
};
