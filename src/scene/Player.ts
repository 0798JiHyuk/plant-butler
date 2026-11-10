import Phaser from 'phaser';
import { findFreeSpot } from './footprints';
import { MAP_H, MAP_W } from './map';
import { SPROUT_ORIGIN_Y, WALK_FRAMES, type SproutPose, type WalkDir } from './sprites';

const SPEED = 110; // px/초
const FOOT_HALF_W = 12;
const FOOT_H = 8;

type Motion = 'breathe' | 'walk' | 'still';

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private pose: SproutPose | 'walk' = 'idle';
  private motion?: Phaser.Tweens.Tween;
  private jumping = false;
  private dir: WalkDir = 'front';

  /** x, y는 발 위치. isBlocked는 그 지점에 설 수 없으면 true. */
  constructor(private scene: Phaser.Scene, x: number, y: number, private isBlocked: (px: number, py: number) => boolean) {
    this.sprite = scene.add.sprite(x, y, 'sprout_idle').setOrigin(0.5, SPROUT_ORIGIN_Y);
    // 걷기 그림 4프레임을 방향별로 돌린다(앞·뒤·옆). 왼쪽은 옆모습을 뒤집어 쓴다.
    for (const d of ['front', 'back', 'side'] as const) {
      const key = `sprout-walk-${d}`;
      if (!scene.anims.exists(key)) {
        scene.anims.create({ key, frames: WALK_FRAMES.map((n) => ({ key: `sprout_walk_${d}${n}` })), frameRate: 8, repeat: -1 });
      }
    }
    this.setMotion('breathe');
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get currentPose(): SproutPose | 'walk' { return this.pose; }
  /** 뛰는 동안에는 y가 위로 떠 있어서 그리는 순서를 바꾸지 않는다. */
  get isJumping(): boolean { return this.jumping; }

  setPose(pose: SproutPose): void {
    this.pose = pose;
    this.sprite.anims.stop();
    this.sprite.setTexture(`sprout_${pose}`);
    this.setMotion(pose === 'idle' ? 'breathe' : 'still');
  }

  /** 가만히 있을 땐 숨 쉬듯 살짝 움직인다. 걸을 땐 걷기 그림이 움직임을 맡는다. */
  private setMotion(kind: Motion): void {
    this.motion?.remove();
    this.motion = undefined;
    this.sprite.setScale(this.sprite.scaleX < 0 ? -1 : 1, 1).setAngle(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || kind === 'still') return;
    if (kind === 'walk') return;
    this.motion =
      this.scene.tweens.add({ targets: this.sprite, scaleY: 1.03, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** 해냈을 때의 점프: 웅크림 → 도약 → 정점 → 착지, 그 뒤 기쁜 표정으로 이어진다. 끝나면 onDone. */
  playJump(onDone?: () => void): void {
    if (this.jumping) return;
    this.jumping = true;
    this.pose = 'joy';
    this.sprite.anims.stop();
    this.setMotion('still');
    const baseY = this.sprite.y;
    const show = (frame: string) => this.sprite.setTexture(`sprout_${frame}`);
    const t = this.scene.tweens;
    const finish = () => {
      this.sprite.y = baseY;
      this.jumping = false;
      show('joy');
      onDone?.();
    };
    show('jump1');
    this.scene.time.delayedCall(150, () => {
      show('jump2');
      t.add({
        targets: this.sprite, y: baseY - 34, duration: 190, ease: 'Sine.easeOut',
        onComplete: () => {
          show('jump3');
          t.add({
            targets: this.sprite, y: baseY, duration: 230, ease: 'Sine.easeIn',
            onComplete: () => {
              show('jump4');
              this.scene.time.delayedCall(130, finish);
            },
          });
        },
      });
    });
  }

  /** 발밑에 소품이 놓여 갇혔으면 가장 가까운 빈자리로 폴짝 비켜선다(꾸미기에서 새싹이 위에 놓았을 때). */
  hopOutIfStuck(): void {
    if (this.jumping || !this.collides(this.x, this.y)) return;
    const to = findFreeSpot(this.x, this.y, (x, y) => !this.collides(x, y));
    if (!to) return; // 너무 깊이 갇혔으면 move()처럼 걸어서 빠져나가게 둔다
    this.jumping = true;
    const from = { x: this.x, y: this.y };
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 360,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        this.sprite.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * 22);
      },
      onComplete: () => {
        this.sprite.setPosition(to.x, to.y);
        this.jumping = false;
      },
    });
  }

  /** 방향 벡터(-1..1)로 이동. 축마다 따로 충돌을 검사해 벽을 따라 미끄러진다. */
  move(vx: number, vy: number, dtMs: number): void {
    if (this.jumping) return;
    const moving = vx !== 0 || vy !== 0;
    if (moving && (this.pose === 'rest' || this.pose === 'joy')) {
      this.pose = 'idle';
      this.sprite.setTexture('sprout_idle');
    }
    if (moving) {
      const step = (SPEED * dtMs) / 1000;
      const stuck = this.collides(this.x, this.y); // 소품이 발밑에 놓였다면 빠져나올 수 있게
      const nx = Phaser.Math.Clamp(this.x + vx * step, FOOT_HALF_W, MAP_W - FOOT_HALF_W);
      if (stuck || !this.collides(nx, this.y)) this.sprite.x = nx;
      const ny = Phaser.Math.Clamp(this.y + vy * step, FOOT_H, MAP_H);
      if (stuck || !this.collides(this.x, ny)) this.sprite.y = ny;
      if (vx !== 0) this.sprite.setFlipX(vx < 0);
      // 가로 이동이 더 크면 옆모습, 아니면 위(집 쪽)는 뒷모습·아래는 앞모습
      const dir: WalkDir = Math.abs(vx) > Math.abs(vy) ? 'side' : vy < 0 ? 'back' : 'front';
      if (dir !== this.dir || this.pose !== 'walk') {
        this.dir = dir;
        this.sprite.play(`sprout-walk-${dir}`);
      }
      if (dir !== 'side') this.sprite.setFlipX(false); // 앞·뒤 걷기는 좌우 방향이 없다
      if (this.pose !== 'walk') {
        this.pose = 'walk';
        this.setMotion('walk');
      }
    } else if (this.pose === 'walk') {
      this.pose = 'idle';
      this.dir = 'front';
      this.sprite.anims.stop();
      this.sprite.setFlipX(false);
      this.sprite.setTexture('sprout_idle');
      this.setMotion('breathe');
    }
    this.sprite.setDepth(this.sprite.y);
  }

  private collides(x: number, y: number): boolean {
    return (
      this.isBlocked(x - FOOT_HALF_W, y - FOOT_H) || this.isBlocked(x + FOOT_HALF_W, y - FOOT_H) ||
      this.isBlocked(x - FOOT_HALF_W, y - 1) || this.isBlocked(x + FOOT_HALF_W, y - 1)
    );
  }
}
