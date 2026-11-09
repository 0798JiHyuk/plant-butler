import Phaser from 'phaser';
import type { NpcId } from '../core/events';

const SIZE = 60; // 화면에서 보이는 크기(px)
const LABEL_DEPTH = 8000; // 이름표는 소품에 가려지지 않게 항상 위에
const ROAM = 60; // 자기 자리에서 이만큼 안쪽만 서성인다
const NEAR = 90; // 새싹이가 이 안에 오면 멈춰서 돌아본다
const SAY_MS = 2600; // 말풍선이 떠 있는 시간
const SAY_GAP = 60000; // 같은 주민은 1분 동안 다시 말을 걸지 않는다
const TEXT_STYLE = {
  fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif",
  fontSize: '13px',
  color: '#2b1f17',
  backgroundColor: '#fffaf0', // 반투명이면 배경 그림이 비쳐서 흐려 보인다. 꽉 찬 색으로.
  padding: { x: 6, y: 2 },
};
const ORIGIN_Y = 0.96; // 발 위치(그림 아래쪽)
const CALM = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

type Habit = { speed: number; pause: [number, number]; idle: 'tilt' | 'tap' | null; hop: boolean };
/** 주민마다 다른 버릇(그림 없이 움직임으로). 위치(x, y)는 그대로 두고 기울기·크기·그리는 기준점만 움직인다(충돌·앞뒤 판단에 영향 없음). */
const HABITS: Record<NpcId, Habit> = {
  nuri: { speed: 12, pause: [3500, 7000], idle: 'tilt', hop: false }, // 달팽이: 더 느리고, 오래 멈춰 고개를 기울인다
  moru: { speed: 20, pause: [2000, 5500], idle: 'tap', hop: false }, // 두더지: 멈춰 있으면 망치질하듯 들썩인다
  pio: { speed: 26, pause: [1500, 4000], idle: null, hop: true }, // 참새: 통통 뛰며 다닌다
};

/** 정원에 사는 주민. 자기 자리 근처를 천천히 서성이다가, 새싹이가 가까이 오면 그쪽을 돌아보고 멈춘다. 창이 열려 있으면 가만히 있는다. */
export class Npc {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly mark: Phaser.GameObjects.Image;
  private bubble?: Phaser.GameObjects.Text;
  private bubbleTimer?: Phaser.Time.TimerEvent;
  private target: { x: number; y: number } | null = null;
  private pause = 800 + Math.random() * 2000;
  private clock = Math.random() * 1000;
  private wasNear = false;
  private met = false;
  private lastSaid = -Infinity;
  private readonly habit: Habit;
  private readonly baseScaleY: number;
  private idleIn = 3000;
  private resting = false;
  private breath?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    readonly id: NpcId,
    name: string,
    private home: { x: number; y: number },
    private canStand: (x: number, y: number) => boolean,
    onTap: () => void,
  ) {
    this.sprite = scene.add.image(home.x, home.y, `npc_${id}_front`).setOrigin(0.5, ORIGIN_Y).setDisplaySize(SIZE, SIZE);
    this.habit = HABITS[id];
    this.baseScaleY = this.sprite.scaleY;
    this.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', onTap);
    this.label = scene.add
      .text(home.x, home.y, name, { ...TEXT_STYLE, fontStyle: 'bold' })
      .setOrigin(0.5, 1)
      .setResolution(2);
    this.mark = scene.add.image(home.x, home.y, 'npc_mark').setOrigin(0.5, 1).setDisplaySize(22, 22).setVisible(false);
    this.place();
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  /** 이름표는 머리 위, 그 위에 새 이야기 표시, 그 위에 말풍선 */
  private place(): void {
    this.sprite.setDepth(this.sprite.y);
    const top = this.sprite.y - SIZE + 2;
    this.label.setPosition(this.sprite.x, top).setDepth(LABEL_DEPTH);
    const above = top - this.label.height - 2;
    this.mark.setPosition(this.sprite.x, above).setDepth(LABEL_DEPTH);
    this.bubble?.setPosition(this.sprite.x, this.mark.visible ? above - 24 : above).setDepth(LABEL_DEPTH + 1);
  }

  private pose(p: 'front' | 'side' | 'walk' | 'back'): void {
    this.sprite.setTexture(`npc_${this.id}_${p}`);
  }

  /** 그날 열린 이야기가 있으면 머리 위에 작은 말풍선 표시 */
  setMark(on: boolean): void {
    if (this.mark.visible === on) return;
    this.mark.setVisible(on);
    this.place();
  }

  /** 새싹이가 막 다가왔는지(한 번 읽으면 지워진다). 무슨 말을 할지는 GardenScene이 정해 say로 시킨다. */
  takeMet(): boolean {
    const m = this.met;
    this.met = false;
    return m;
  }

  /** 짧은 말풍선(SAY_MS). 같은 주민은 SAY_GAP 동안 다시 말하지 않는다. 말했으면 true. */
  say(text: string, now: number): boolean {
    if (now - this.lastSaid < SAY_GAP) return false;
    this.lastSaid = now;
    this.hush();
    this.bubble = this.scene.add
      .text(this.sprite.x, this.sprite.y, text, { ...TEXT_STYLE, wordWrap: { width: 170 } })
      .setOrigin(0.5, 1)
      .setResolution(2);
    this.place();
    this.bubbleTimer = this.scene.time.delayedCall(SAY_MS, () => this.hush());
    return true;
  }

  /** 말풍선을 바로 지운다(창이 열리거나 꾸미기에 들어갈 때). */
  hush(): void {
    this.bubbleTimer?.remove();
    this.bubbleTimer = undefined;
    this.bubble?.destroy();
    this.bubble = undefined;
  }

  /** 쉬는 날: 자기 자리 근처에서 거의 움직이지 않고 천천히 숨쉰다. */
  setResting(on: boolean): void {
    if (this.resting === on) return;
    this.resting = on;
    this.target = null;
    this.breath?.remove();
    this.breath = undefined;
    this.sprite.setScale(this.sprite.scaleX, this.baseScaleY).setAngle(0);
    if (on && !CALM) {
      this.breath = this.scene.tweens.add({ targets: this.sprite, scaleY: this.baseScaleY * 1.03, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** 멈춰 있을 때의 버릇 한 번(이미 움직이는 중이면 건너뛴다). */
  private idleHabit(): void {
    if (CALM || this.resting || this.scene.tweens.isTweening(this.sprite)) return;
    if (this.habit.idle === 'tilt') {
      this.scene.tweens.add({ targets: this.sprite, angle: -7, duration: 500, yoyo: true, hold: 500, ease: 'Sine.easeInOut' });
    } else if (this.habit.idle === 'tap') {
      this.scene.tweens.add({ targets: this.sprite, scaleY: this.baseScaleY * 0.9, duration: 110, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
    }
  }

  /** frozen: 창이 열려 있거나 꾸미는 중이면 가만히 있는다. */
  update(dtMs: number, player: { x: number; y: number }, frozen: boolean): void {
    this.clock += dtMs;
    const dx = player.x - this.x;
    const near = Math.hypot(dx, player.y - this.y) < NEAR;
    if (near && !this.wasNear) this.met = true;
    this.wasNear = near;
    if (frozen || near) {
      // 가까이 온 새싹이 쪽을 돌아본다(옆모습은 오른쪽을 보는 그림이라 왼쪽이면 뒤집는다).
      if (!frozen && Math.abs(dx) > 12) {
        this.pose('side');
        this.sprite.setFlipX(dx < 0);
      } else {
        this.pose('front');
        this.sprite.setFlipX(false);
      }
      return;
    }
    if (!this.target) {
      this.pause -= dtMs;
      this.pose('front');
      this.sprite.setFlipX(false);
      this.sprite.setOrigin(0.5, ORIGIN_Y);
      this.idleIn -= dtMs;
      if (this.idleIn <= 0) {
        this.idleHabit();
        this.idleIn = 2500 + Math.random() * 2500;
      }
      if (this.pause > 0 || this.resting) return; // 쉬는 날엔 서성이지 않는다
      // 자기 자리 근처에서 설 수 있는 곳을 골라 천천히 걸어간다. 못 찾으면 잠시 더 쉰다.
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * (ROAM - 20);
        const t = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r * 0.6 };
        if (this.canStand(t.x, t.y)) {
          this.target = t;
          break;
        }
      }
      const [lo, hi] = this.habit.pause;
      this.pause = lo + Math.random() * (hi - lo);
      return;
    }
    const tx = this.target.x - this.x;
    const ty = this.target.y - this.y;
    const dist = Math.hypot(tx, ty);
    const step = (this.habit.speed * dtMs) / 1000;
    if (dist <= step) {
      this.target = null;
    } else {
      const nx = this.x + (tx / dist) * step;
      const ny = this.y + (ty / dist) * step;
      if (this.canStand(nx, ny)) {
        this.sprite.setPosition(nx, ny);
        // 피오는 통통 뛰듯: 위치는 그대로, 그리는 기준점만 올렸다 내린다.
        if (this.habit.hop && !CALM) this.sprite.setOrigin(0.5, ORIGIN_Y + (Math.abs(Math.sin(this.clock / 110)) * 6) / SIZE);
        // 위로 걸어갈 때는 뒷모습, 그 밖에는 옆모습 두 장을 번갈아 쓴다(왼쪽은 뒤집기).
        if (ty < 0 && Math.abs(ty) > Math.abs(tx)) {
          this.pose('back');
          this.sprite.setFlipX(false);
        } else {
          this.pose(Math.floor(this.clock / 260) % 2 ? 'walk' : 'side');
          this.sprite.setFlipX(tx < 0);
        }
      } else {
        this.target = null; // 막혔으면 거기서 멈춘다
      }
    }
    this.place();
  }
}
