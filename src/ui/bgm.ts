import { BGM_VOLUME, CROSSFADE_MS, bgmFile, bgmGain, loopGain, shouldPlay, slotFor, stepLevel, trackFor, type BgmContext, type BgmTrack, type PlayerSlot } from '../core/bgm';
import { todayKey } from '../core/clock';
import { events } from '../core/events';
import { zoneAt } from '../core/exploration';
import { isResting } from '../core/rules';
import { store } from '../core/store';
import { auth } from '../lib/auth';

/**
 * 장소별 배경음악 재생. 어떤 곡을 틀지는 core/bgm.ts가 정하고, 여기서는 재생·부드러운 전환·이음새·음량을 맡는다.
 * 설정의 소리 끄기와 배경음악 음량을 따른다.
 *
 * 브라우저는 사용자가 누르기 전에는 소리를 막는다. 그래서
 * - 막히지 않는 브라우저에서는 들어오자마자 틀어 보고(막히면 조용히 기다림),
 * - 첫 입력(클릭·터치·키)이 오면 그 순간에 바로 재생을 시작한다(아이폰·사파리는 이 순간에만 허락한다).
 * 아이폰·사파리는 처음 허락받은 재생 칸만 나중에도 소리를 낼 수 있고 element.volume도 무시하므로,
 * 재생 칸을 두 개만 만들어 처음 입력 때 둘 다 허락받고, 음량은 Web Audio 게인으로 조절한다.
 */
const TICK_MS = 100;
const RETRY_MS = 400;
/** 아이폰·사파리에서 칸을 미리 허락받을 때 쓰는 1샘플짜리 무음 파일. */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const;

interface Player extends PlayerSlot { el: HTMLAudioElement; track: BgmTrack | null; gain: GainNode | null; tryAt: number; priming: boolean }
const makePlayer = (): Player => {
  const el = new Audio();
  el.loop = true;
  el.preload = 'auto';
  return { el, track: null, level: 0, gain: null, tryAt: 0, priming: false };
};
const players: [Player, Player] = [makePlayer(), makePlayer()];

let place: Pick<BgmContext, 'location' | 'indoorHome'> = { location: 'garden', indoorHome: false };
let ctx: AudioContext | null = null;
let started = false;
let unlocked = false;
let last = 0;

// 로그인한 상태에서만 틀고(효과음과 같은 기준), 개발 서버에서는 로그인 없이도 들을 수 있게 한다.
const allowed = (): boolean => auth.getSnapshot().status === 'connected' || import.meta.env.DEV;

function wantedTrack(): BgmTrack | null {
  const play = shouldPlay({ allowed: allowed(), soundOn: store.state.settings.sound, visible: document.visibilityState === 'visible' });
  return play ? trackFor({ ...place, resting: isResting(store.state, todayKey()) }) : null;
}

const urlOf = (track: BgmTrack): string => `${import.meta.env.BASE_URL}assets/audio/${bgmFile(track)}`;

function assign(player: Player, track: BgmTrack): void {
  player.track = track;
  player.level = 0;
  player.tryAt = 0;
  player.el.src = urlOf(track);
}

/** 이 곡이 들어 있는 칸을 돌려준다. 없으면 소리가 더 작은 칸에 곡을 넣는다(칸이 허락받는 중이면 null). */
function playerFor(track: BgmTrack): Player | null {
  const index = slotFor(players, track);
  const player = players[index];
  if (player.track === track) return player;
  if (player.priming) return null;
  assign(player, track);
  return player;
}

function setOutput(player: Player, volume: number): void {
  if (player.gain) player.gain.gain.value = volume;
  else player.el.volume = Math.min(1, volume);
}

/** 사용자 입력 안에서 부른다. 오디오 칸을 Web Audio 게인에 연결해 아이폰에서도 음량이 먹게 한다. */
function connectAudio(): void {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    for (const player of players) {
      if (player.gain) continue;
      const source = ctx.createMediaElementSource(player.el);
      player.gain = ctx.createGain();
      source.connect(player.gain).connect(ctx.destination);
      player.el.volume = 1;
    }
  } catch { /* Web Audio를 못 쓰면 element.volume으로 조절한다 */ }
}

/** 첫 입력: 그 자리에서 바로 재생을 시작해 브라우저의 허락을 받고, 다른 칸도 미리 허락받는다. */
function onGesture(): void {
  if (unlocked) return;
  connectAudio();
  const want = wantedTrack();
  if (!want) return; // 소리를 끈 상태 등: 다음 입력에서 다시 시도한다
  const main = playerFor(want);
  if (!main) return;
  void main.el.play().then(() => {
    unlocked = true;
    for (const type of GESTURES) document.removeEventListener(type, onGesture, true);
  }).catch(() => { /* 이 입력은 허락으로 인정되지 않았다. 다음 입력에서 다시 시도한다 */ });
  const other = players.find(p => p !== main);
  if (other && other.track === null && !other.priming) {
    other.priming = true;
    other.el.src = SILENT;
    void other.el.play().then(() => other.el.pause()).catch(() => { /* 허락을 못 받아도 곡 전환 때 다시 시도한다 */ }).finally(() => { other.priming = false; });
  }
}

function tick(): void {
  const now = performance.now();
  const step = Math.min(1, (now - last) / CROSSFADE_MS);
  last = now;
  const want = wantedTrack();
  if (want) playerFor(want);
  const master = BGM_VOLUME * bgmGain(store.state.settings.bgmVolume);
  for (const player of players) {
    if (player.track === null || player.priming) continue;
    const goal = player.track === want ? 1 : 0;
    player.level = stepLevel(player.level, goal, step);
    setOutput(player, master * player.level * loopGain(player.el.currentTime, player.el.duration));
    if (player.level > 0 && player.el.paused) {
      if (now - player.tryAt >= RETRY_MS) {
        player.tryAt = now;
        void player.el.play().catch(() => { /* 아직 허락되지 않았으면 다음에 다시 시도한다 */ });
      }
    } else if (player.level === 0 && !player.el.paused) player.el.pause();
  }
}

export function startBgm(): void {
  if (started) return; // 다시 불려도(개발 중 핫 리로드 등) 재생기를 하나만 둔다
  started = true;
  for (const type of GESTURES) document.addEventListener(type, onGesture, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') for (const player of players) player.el.pause(); });
  events.on('social-location', ({ location }) => { place = { ...place, location }; });
  events.on('world-position', p => { place = { ...place, indoorHome: zoneAt(p.x, p.y, p.indoor) === 'home' }; });
  last = performance.now();
  window.setInterval(tick, TICK_MS);
}
