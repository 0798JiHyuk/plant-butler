/** Snapshot shape version, distinct from the CAS revision and game content version. */
export const SAVE_SCHEMA_VERSION = 1;
export function migrateSave(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid progress');
  const source = raw as Record<string, unknown>;
  if (source.version !== 1 || source.saveSchemaVersion !== undefined && source.saveSchemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new Error('Unsupported progress version');
  }
  // Legacy v1 -> explicit schema v1. Future shape changes add an ordered step here,
  // a matching server migration, fixture tests, and a new supported version.
  return { ...source, saveSchemaVersion: SAVE_SCHEMA_VERSION };
}
