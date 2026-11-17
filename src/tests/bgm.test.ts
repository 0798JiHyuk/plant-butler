import { describe, expect, it } from 'vitest';
import { BGM_TRACKS, BGM_VOLUME, bgmFile, bgmGain, loopGain, shouldPlay, slotFor, stepLevel, trackFor } from '../core/bgm';
import { createState, decodeState, stateKey } from '../core/state';

describe('장소별 BGM 고르기', () => {
  const at = (location: 'garden' | 'cafe' | 'visit' | 'school' | 'work', indoorHome = false, resting = false) => trackFor({ location, indoorHome, resting });

  it('정원·마을 길·상점 앞(야외 전체)은 정원 곡이다', () => {
    expect(at('garden')).toBe('garden');
  });
  it('집 안은 집 곡이다', () => {
    expect(at('garden', true)).toBe('home');
  });
  it('학교·직장·카페는 각자의 곡이다', () => {
    expect(at('school')).toBe('school');
    expect(at('work')).toBe('work');
    expect(at('cafe')).toBe('cafe');
  });
  it('다른 사람 정원을 둘러볼 때는 정원 곡이다', () => {
    expect(at('visit')).toBe('garden');
  });
  it('쉬는 날은 정원과 집 안에서 쉬는 날 곡으로 바뀐다', () => {
    expect(at('garden', false, true)).toBe('rest');
    expect(at('garden', true, true)).toBe('rest');
  });
  it('쉬는 날이어도 학교·직장·카페·방문 중에는 그 장소의 곡이다', () => {
    expect(at('school', false, true)).toBe('school');
    expect(at('work', false, true)).toBe('work');
    expect(at('cafe', false, true)).toBe('cafe');
    expect(at('visit', false, true)).toBe('garden');
  });
});

// 프로젝트의 곡 파일 목록(Vite가 빌드 때 읽는 public 폴더 기준).
const audioFiles = Object.keys(import.meta.glob('/public/assets/audio/*.mp3')).map(path => path.split('/').pop());

describe('BGM 파일', () => {
  it('곡 6개가 모두 정해진 이름으로 프로젝트에 있다', () => {
    expect([...BGM_TRACKS].sort()).toEqual(['cafe', 'garden', 'home', 'rest', 'school', 'work']);
    for (const track of BGM_TRACKS) {
      expect(bgmFile(track)).toBe(`bgm_${track}.mp3`);
      expect(audioFiles, track).toContain(bgmFile(track));
    }
  });
  it('기본 음량은 효과음을 덮지 않게 작다', () => {
    expect(BGM_VOLUME).toBeGreaterThan(0);
    expect(BGM_VOLUME).toBeLessThanOrEqual(0.5);
  });
});

describe('반복할 때 처음과 끝을 부드럽게 잇기', () => {
  it('처음에는 소리가 0에서 시작해 2초 동안 서서히 커진다', () => {
    expect(loopGain(0, 180)).toBe(0);
    expect(loopGain(1, 180)).toBeCloseTo(0.5, 5);
    expect(loopGain(2, 180)).toBe(1);
  });
  it('가운데는 그대로이고 끝 2초에서 서서히 줄어든다', () => {
    expect(loopGain(90, 180)).toBe(1);
    expect(loopGain(179, 180)).toBeCloseTo(0.5, 5);
    expect(loopGain(180, 180)).toBe(0);
  });
  it('길이를 모르거나 곡이 너무 짧으면 소리를 건드리지 않는다', () => {
    expect(loopGain(5, Number.NaN)).toBe(1);
    expect(loopGain(5, 0)).toBe(1);
    expect(loopGain(1, 3)).toBe(1);
  });
});

describe('언제 틀지', () => {
  it('소리가 켜져 있고 화면이 보이며 들어와도 되는 상태일 때만 튼다', () => {
    expect(shouldPlay({ allowed: true, soundOn: true, visible: true })).toBe(true);
    expect(shouldPlay({ allowed: false, soundOn: true, visible: true })).toBe(false);
    expect(shouldPlay({ allowed: true, soundOn: false, visible: true })).toBe(false);
    expect(shouldPlay({ allowed: true, soundOn: true, visible: false })).toBe(false);
  });
});

describe('설정의 배경음악 음량', () => {
  it('설정이 없으면 기본(1)이고 0~1 밖의 값은 잘라서 쓴다', () => {
    expect(bgmGain(undefined)).toBe(1);
    expect(bgmGain(0)).toBe(0);
    expect(bgmGain(0.5)).toBe(0.5);
    expect(bgmGain(1.7)).toBe(1);
    expect(bgmGain(-0.2)).toBe(0);
    expect(bgmGain(Number.NaN)).toBe(1);
  });
  it('이전 저장본에는 음량 항목이 없어도 읽힌다', () => {
    const s = createState();
    expect(s.settings.bgmVolume).toBeUndefined();
    expect(decodeState(JSON.parse(JSON.stringify(s))).settings.bgmVolume).toBeUndefined();
  });
  it('음량을 저장하면 껐다 켜도 남고, 올바르지 않은 값은 받아들이지 않는다', () => {
    const s = createState();
    s.settings.bgmVolume = 0.4;
    expect(decodeState(JSON.parse(stateKey(s))).settings.bgmVolume).toBe(0.4);
    for (const bad of [-0.1, 1.5, 'loud', null]) {
      const broken = JSON.parse(JSON.stringify(createState()));
      broken.settings.bgmVolume = bad;
      expect(() => decodeState(broken), String(bad)).toThrow();
    }
  });
});

describe('곡 전환(두 개의 재생 칸)', () => {
  const slots = (a: [string | null, number], b: [string | null, number]) => [{ track: a[0], level: a[1] }, { track: b[0], level: b[1] }] as const;
  it('이미 그 곡이 든 칸이 있으면 그 칸을 쓴다', () => {
    expect(slotFor(slots(['garden', 1], ['school', 0.3]), 'school')).toBe(1);
    expect(slotFor(slots(['garden', 1], [null, 0]), 'garden')).toBe(0);
  });
  it('새 곡은 소리가 더 작은 칸에 넣어 지금 들리는 곡을 끊지 않는다', () => {
    expect(slotFor(slots(['garden', 1], [null, 0]), 'school')).toBe(1);
    expect(slotFor(slots(['garden', 0.2], ['school', 0.8]), 'work')).toBe(0);
  });
  it('전환 단계는 목표를 넘지 않고 한 걸음씩 다가간다', () => {
    expect(stepLevel(0, 1, 0.1)).toBeCloseTo(0.1, 5);
    expect(stepLevel(0.95, 1, 0.1)).toBe(1);
    expect(stepLevel(1, 0, 0.25)).toBe(0.75);
    expect(stepLevel(0.1, 0, 0.5)).toBe(0);
  });
});
