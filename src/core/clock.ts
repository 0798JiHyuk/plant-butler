// 실제 날짜만 사용한다. 이전 데모 설정이 저장되어 있어도 날짜를 이동하지 않는다.
export function now(): Date { return new Date(); }

function format(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 로컬 기준 YYYY-MM-DD */
export function todayKey(): string {
  return format(now());
}

/** 날짜 키를 며칠 앞뒤로 옮긴다. */
export function shiftDate(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return format(new Date(y, m - 1, d + days));
}

/** from에서 to까지 며칠 지났는지(같은 날이면 0). 시각과 시간대 영향 없이 날짜만 센다. */
export function daysBetween(from: string, to: string): number {
  const t = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(to) - t(from)) / 86400000);
}
