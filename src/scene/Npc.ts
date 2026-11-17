import Phaser from 'phaser';
import type { NpcId } from '../core/events';
import { movementFor, pickStop } from '../core/npcRoutes';

const SIZE = 60; // 화면에서 보이는 크기(px)
const LABEL_DEPTH = 8000; // 이름표는 소품에 가려지지 않게 항상 위에

export interface NpcContext { resting: boolean; reducedMotion: boolean }

/**
 * 정원에 사는 주민. 주민마다 정해진 정류장(core/npcRoutes.ts)을 속도·멈춤 시간·몸짓이 다르게 오간다.
 * 새싹이가 가까이 오거나 대화 중이면 멈추고, 쉬는 날에는 걷지 않는다.
 */
export class Npc {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private target: { x: number; y: number } | null = null;
  private stop = 0; // 지금 서 있는(또는 향하는) 정류장 번호
  private pause = 800 + Math.random() * 2000;
  private clock = Math.random() * 1000;

  constructor(
    private scene: Phaser.Scene,
    readonly id: NpcId,
    name: string,
    private home: { x: number; y: number },
    private canStand: (x: number, y: number) => boolean,
    onTap: () => void,
    private context: () => NpcContext = () => ({ resting: false, reducedMotion: false }),
  ) {
    this.sprite = scene.add.image(home.x, home.y, `npc_${id}_front`).setOrigin(0.5, 0.96).setDisplaySize(SIZE, SIZE);
    this.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', onTap);
    this.label = scene.add
      .text(home.x, home.y, name, {
        fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif",
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#2b1f17',
        backgroundColor: '#fffaf0', // 반투명이면 배경 그림이 비쳐서 흐려 보인다. 꽉 찬 색으로.
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setResolution(2);
    this.place();
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  private place(): void {
    this.sprite.setDepth(this.sprite.y);
    this.label.setPosition(this.sprite.x, this.sprite.y - SIZE + 2).setDepth(LABEL_DEPTH);
  }

  private pose(p: 'front' | 'side' | 'walk' | 'back'): void {
    this.sprite.setTexture(`npc_${this.id}_${p}`);
  }

  /** 몸짓: 멈춘 동안(느리·모루)이나 걷는 동안(피오)의 작은 흔들림. 위치는 건드리지 않는다. */
  private gesture(kind: 'none' | 'tilt' | 'tap' | 'hop', active: boolean): void {
    let angle = 0, scaleY = 1;
    if (active) {
      const t = this.clock / 1000;
      if (kind === 'tilt') angle = Math.sin(t * 1.2) * 5;
      else if (kind === 'tap') scaleY = 1 + Math.max(0, Math.sin(t * 7)) * 0.05;
      else if (kind === 'hop') scaleY = 1 + Math.abs(Math.sin(t * 9)) * 0.08;
    }
    this.sprite.setAngle(angle).setDisplaySize(SIZE, SIZE * scaleY);
  }

  /** frozen: 창이 열려 있거나 꾸미는 중이면 가만히 있는다. */
  update(dtMs: number, player: { x: number; y: number }, frozen: boolean): void {
    this.clock += dtMs;
    const near = Math.hypot(player.x - this.x, player.y - this.y) < 80;
    const move = movementFor(this.id, this.context());
    if (frozen || near || !move.walks) {
      this.gesture('none', false);
      this.pose('front');
      this.sprite.setFlipX(false);
      return;
    }
    if (!this.target) {
      this.pause -= dtMs;
      this.pose('front');
      this.sprite.setFlipX(false);
      this.gesture(move.idle === 'hop' ? 'none' : move.idle, true);
      if (this.pause > 0) return;
      // 정류장 가운데서 비중대로 하나를 골라 걸어간다. 갈 곳이 없으면 제자리에서 더 쉰다.
      const next = pickStop(this.id, this.stop, Math.random, this.canStand);
      if (next) {
        this.target = { x: next.x, y: next.y };
        this.stop = next.index;
      }
      this.pause = move.pauseMs[0] + Math.random() * (move.pauseMs[1] - move.pauseMs[0]);
      return;
    }
    this.gesture(move.idle === 'hop' ? 'hop' : 'none', true);
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = (move.speed * dtMs) / 1000;
    if (dist <= step) {
      this.target = null;
    } else {
      const nx = this.x + (dx / dist) * step;
      const ny = this.y + (dy / dist) * step;
      if (this.canStand(nx, ny)) {
        this.sprite.setPosition(nx, ny);
        // 위로 걸어갈 때는 뒷모습, 그 밖에는 옆모습 두 장을 번갈아 쓴다(왼쪽은 뒤집기).
        if (dy < 0 && Math.abs(dy) > Math.abs(dx)) {
          this.pose('back');
          this.sprite.setFlipX(false);
        } else {
          this.pose(Math.floor(this.clock / 260) % 2 ? 'walk' : 'side');
          this.sprite.setFlipX(dx < 0);
        }
      } else {
        this.target = null; // 막혔으면 거기서 멈춘다
      }
    }
    this.place();
  }
}
