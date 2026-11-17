/**
 * 장소별 배경음악(BGM) 규칙. 재생은 ui/bgm.ts가 하고, 여기는 어떤 곡을 언제 틀지만 정한다.
 * 곡은 가사 없는 연주곡이고 public/assets/audio/ 에 있다(-20 LUFS로 맞춤).
 */
export type BgmTrack = 'garden' | 'home' | 'school' | 'work' | 'cafe' | 'rest';
export const BGM_TRACKS: readonly BgmTrack[] = ['garden', 'home', 'school', 'work', 'cafe', 'rest'];
export const bgmFile = (track: BgmTrack): string => `bgm_${track}.mp3`;

/** 곡 파일은 -20 LUFS로 맞춰 두었고, 효과음(작은 사인파)을 덮지 않게 은은하게 깐다. */
export const BGM_VOLUME = 0.35;
/** 장소가 바뀔 때 앞 곡이 사라지고 새 곡이 들어오는 시간(ms). */
export const CROSSFADE_MS = 1500;
/** 곡이 처음으로 돌아갈 때 이음새를 가리는 시간(초). 곡 끝은 원래 작아지고 처음은 바로 시작한다. */
export const LOOP_FADE_SECONDS = 2;

export interface BgmContext {
  /** 지금 있는 장면: 정원 밖·집 안은 garden, 카페·학교·직장은 각자, 다른 사람 정원 둘러보기는 visit. */
  location: 'garden' | 'cafe' | 'visit' | 'school' | 'work';
  /** 정원 장면 중 집 안일 때. */
  indoorHome: boolean;
  /** 오늘 "쉬기"를 골랐을 때. */
  resting: boolean;
}

export function trackFor(ctx: BgmContext): BgmTrack {
  if (ctx.location === 'school') return 'school';
  if (ctx.location === 'work') return 'work';
  if (ctx.location === 'cafe') return 'cafe';
  if (ctx.location === 'visit') return 'garden';
  if (ctx.resting) return 'rest';
  return ctx.indoorHome ? 'home' : 'garden';
}

/** 곡 위치(초)에서의 소리 배율 0~1. 처음 2초는 서서히 커지고 끝 2초는 서서히 줄어든다. */
export function loopGain(position: number, duration: number, fade: number = LOOP_FADE_SECONDS): number {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= fade * 2) return 1;
  const fadeIn = Math.min(1, Math.max(0, position / fade));
  const fadeOut = Math.min(1, Math.max(0, (duration - position) / fade));
  return Math.min(fadeIn, fadeOut);
}

export function shouldPlay(s: { allowed: boolean; soundOn: boolean; visible: boolean }): boolean {
  return s.allowed && s.soundOn && s.visible;
}

/** 설정의 배경음악 음량(0~1). 설정이 없거나 숫자가 아니면 1, 범위를 벗어나면 잘라서 쓴다. */
export function bgmGain(setting: number | undefined): number {
  if (typeof setting !== 'number' || !Number.isFinite(setting)) return 1;
  return Math.min(1, Math.max(0, setting));
}

/** 곡이 바뀔 때 앞 곡이 사라지고 새 곡이 들어오는 한 걸음. 목표를 넘지 않는다. */
export function stepLevel(current: number, goal: number, step: number): number {
  return current < goal ? Math.min(goal, current + step) : Math.max(goal, current - step);
}

export interface PlayerSlot { track: string | null; level: number }
/**
 * 재생 칸은 두 개다(아이폰·사파리는 처음 눌렀을 때 허락받은 칸만 나중에도 소리를 낼 수 있어서, 칸을 늘리지 않고 돌려 쓴다).
 * 이미 그 곡이 든 칸이 있으면 그 칸을, 없으면 소리가 더 작은 칸을 쓴다.
 */
export function slotFor(slots: readonly [PlayerSlot, PlayerSlot], track: string): 0 | 1 {
  const same = slots.findIndex(slot => slot.track === track);
  if (same >= 0) return same as 0 | 1;
  return slots[0].level <= slots[1].level ? 0 : 1;
}
