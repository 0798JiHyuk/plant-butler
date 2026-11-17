import { BGM_TRACKS, BGM_VOLUME, CROSSFADE_MS, bgmFile, loopGain, shouldPlay, trackFor, type BgmContext, type BgmTrack } from '../core/bgm';
import { todayKey } from '../core/clock';
import { events } from '../core/events';
import { zoneAt } from '../core/exploration';
import { isResting } from '../core/rules';
import { store } from '../core/store';
import { auth } from '../lib/auth';

/**
 * 장소별 배경음악 재생. 어떤 곡을 틀지는 core/bgm.ts가 정하고, 여기서는 재생·부드러운 전환·이음새만 맡는다.
 * 설정의 소리 끄기와 같은 스위치를 따른다. 브라우저는 사용자가 한 번 누른 뒤에만 소리를 허락하므로 첫 터치·키 입력 뒤에 시작한다.
 */
const TICK_MS = 100;
const audios = new Map<BgmTrack, HTMLAudioElement>();
const level = new Map<BgmTrack, number>(); // 곡별 전환 단계 0~1(1이면 이 곡이 틀어지는 중)
let place: Pick<BgmContext, 'location' | 'indoorHome'> = { location: 'garden', indoorHome: false };
let unlocked = false;
let started = false;
let last = 0;

// 로그인한 상태에서만 틀고(효과음과 같은 기준), 개발 서버에서는 로그인 없이도 들을 수 있게 한다.
const allowed = (): boolean => auth.getSnapshot().status === 'connected' || import.meta.env.DEV;

function wantedTrack(): BgmTrack | null {
  const play = shouldPlay({ allowed: allowed(), soundOn: store.state.settings.sound, visible: document.visibilityState === 'visible' });
  if (!play || !unlocked) return null;
  return trackFor({ ...place, resting: isResting(store.state, todayKey()) });
}

function audioFor(track: BgmTrack): HTMLAudioElement {
  let audio = audios.get(track);
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}assets/audio/${bgmFile(track)}`);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    audios.set(track, audio);
    level.set(track, 0);
  }
  return audio;
}

function tick(): void {
  const now = performance.now();
  const step = Math.min(1, (now - last) / CROSSFADE_MS);
  last = now;
  const want = wantedTrack();
  if (want) audioFor(want);
  for (const track of BGM_TRACKS) {
    const audio = audios.get(track);
    if (!audio) continue;
    const goal = track === want ? 1 : 0;
    const current = level.get(track) ?? 0;
    const next = current < goal ? Math.min(goal, current + step) : Math.max(goal, current - step);
    level.set(track, next);
    audio.volume = Math.min(1, BGM_VOLUME * next * loopGain(audio.currentTime, audio.duration));
    if (next > 0 && audio.paused) void audio.play().catch(() => { /* 브라우저가 아직 허락하지 않았으면 다음 입력 때 다시 시도한다 */ });
    else if (next === 0 && !audio.paused) audio.pause();
  }
}

export function startBgm(): void {
  if (started) return; // 다시 불려도(개발 중 핫 리로드 등) 재생기를 하나만 둔다
  started = true;
  const unlock = () => { unlocked = true; };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') for (const audio of audios.values()) audio.pause(); });
  events.on('social-location', ({ location }) => { place = { ...place, location }; });
  events.on('world-position', p => { place = { ...place, indoorHome: zoneAt(p.x, p.y, p.indoor) === 'home' }; });
  last = performance.now();
  window.setInterval(tick, TICK_MS);
}
