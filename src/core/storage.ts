// localStorage는 막혀 있거나 가득 찰 수 있다. 실패해도 앱은 메모리로 계속 동작한다.

const memory = new Map<string, string>();

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key) ?? memory.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    const raw = memory.get(key);
    try {
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
}

export function saveJson(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    localStorage.setItem(key, raw);
  } catch {
    // 저장 실패는 조용히 넘어간다.
  }
}

/** Transactional edits must not announce success after quota/permission errors. */
export function persistJson(key: string, value: unknown): boolean {
  const raw = JSON.stringify(value);
  try { localStorage.setItem(key, raw); memory.set(key, raw); return true; } catch { return false; }
}
