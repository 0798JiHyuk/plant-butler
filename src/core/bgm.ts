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
