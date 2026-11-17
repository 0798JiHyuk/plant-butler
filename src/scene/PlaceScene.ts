import Phaser from 'phaser';
import { events } from '../core/events';
import { withinReach } from '../core/interaction';
import { atPlaceDoor, enterPlace, PLACE_REACH, PLACES, placeWalkable, type PlaceId } from '../core/places';
import { store } from '../core/store';
import { Player } from './Player';

/**
 * 학교·직장 실내. 집 실내처럼 그림 한 장 위를 걷는 별도 장면이다.
 * 걸을 수 있는 곳과 문·메모 자리는 core/places.ts 가 정하고, 여기서는 그리기와 입력만 한다.
 * 가구 배치·구매·보상은 없다. 들어와 둘러보고 문으로 나간다.
 */
export class PlaceScene extends Phaser.Scene {
  private place: PlaceId = 'school';
  private player!: Player;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private stick = { x: 0, y: 0 };
  private locked = false;
  private doorArmed = false;
  private hint?: Phaser.GameObjects.Graphics;

  constructor() { super('place'); }

  init(data: { place?: PlaceId } = {}): void {
    this.place = data.place === 'work' ? 'work' : 'school';
  }

  preload(): void {
    const base = import.meta.env.BASE_URL;
    for (const id of ['school', 'work'] as const) {
      if (!this.textures.exists(`place_${id}`)) this.load.image(`place_${id}`, `${base}assets/garden/${id}-interior.webp`);
    }
  }

  create(): void {
    const spec = PLACES[this.place];
    this.stick = { x: 0, y: 0 }; this.locked = false; this.doorArmed = false;
    this.textures.get(`place_${this.place}`).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.image(0, 0, `place_${this.place}`).setOrigin(0).setDisplaySize(spec.width, spec.height).setDepth(0);
    store.tryUpdate(s => { enterPlace(s, this.place); });
    events.emit('social-location', { location: this.place });

    this.player = new Player(this, spec.spawn.x, spec.spawn.y, (x, y) => !placeWalkable(this.place, x, y));
    this.player.sprite.setDepth(spec.spawn.y);

    // 메모 자리: 책상 앞에 서서 누르면 그 장소의 안내 장면이 열린다. 멀면 가까이 가라고만 알린다.
    const spot = spec.memo;
    this.add.zone(spot.x, spot.y, 190, 120).setDepth(3).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.locked) return;
        if (withinReach(this.player, spot, PLACE_REACH)) events.emit('place-memo', { place: this.place });
        else events.emit('interaction-too-far', {});
      });

    const cam = this.cameras.main;
    this.fitCamera();
    cam.startFollow(this.player.sprite, true, 0.12, 0.12).setRoundPixels(true).setBackgroundColor('#334829');

    const kb = this.input.keyboard!;
    this.keys = kb.createCursorKeys();
    this.wasd = kb.addKeys('W,A,S,D') as typeof this.wasd;
    this.jumpKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const resize = () => this.fitCamera();
    this.scale.on('resize', resize);
    const offs = [
      events.on('move-input', v => { this.stick = v; }),
      events.on('ui-lock', ({ locked }) => { this.locked = locked; this.stick = { x: 0, y: 0 }; kb.enabled = !locked; kb.resetKeys(); }),
      events.on('place-travel', ({ place }) => {
        if (place === null) this.scene.start('garden', { fromPlace: this.place });
        else this.scene.restart({ place });
      }),
      events.on('place-exit-hint', () => this.showDoorHint()),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { offs.forEach(off => off()); this.scale.off('resize', resize); kb.enabled = true; });
  }

  /** 방 그림 전체가 한 화면에 들어오게 맞춘다(집 실내와 같은 방식). */
  private fitCamera(): void {
    const spec = PLACES[this.place], cam = this.cameras.main;
    const zoom = Math.min(cam.width / spec.width, cam.height / spec.height);
    const padding = Math.max(0, (cam.width / zoom - spec.width) / 2);
    cam.setZoom(zoom).setBounds(-padding, 0, spec.width + padding * 2, spec.height);
  }

  /** 그냥 폴짝: 정원과 같은 장난. 보상이나 기록과 무관하다. */
  private hop(): void {
    if (this.locked) return;
    this.player.playJump(() => {
      this.time.delayedCall(250, () => { if (this.player.currentPose === 'joy') this.player.setPose('idle'); });
    });
  }

  private showDoorHint(): void {
    const door = PLACES[this.place].door;
    this.hint?.destroy();
    const arrow = this.add.graphics().setDepth(1000);
    arrow.fillStyle(0xfff0b8, 0.95).lineStyle(3, 0x694f36);
    arrow.fillTriangle(door.x - 18, door.y - 78, door.x + 18, door.y - 78, door.x, door.y - 48);
    arrow.strokeTriangle(door.x - 18, door.y - 78, door.x + 18, door.y - 78, door.x, door.y - 48);
    this.hint = arrow;
    this.tweens.add({ targets: arrow, alpha: 0.25, duration: 520, yoyo: true, repeat: 5, onComplete: () => { arrow.destroy(); if (this.hint === arrow) this.hint = undefined; } });
  }

  update(_time: number, delta: number): void {
    if (!this.player) return;
    const k = this.keys, w = this.wasd;
    let x = Number(k.right.isDown || w.D.isDown) - Number(k.left.isDown || w.A.isDown);
    let y = Number(k.down.isDown || w.S.isDown) - Number(k.up.isDown || w.W.isDown);
    if (!x && !y) ({ x, y } = this.stick);
    if (this.locked) x = y = 0;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    if (!this.locked && Phaser.Input.Keyboard.JustDown(this.jumpKey)) this.hop();
    this.player.move(x, y, Math.min(delta, 50));
    this.player.sprite.setDepth(this.player.y);
    const atDoor = atPlaceDoor(this.place, this.player.x, this.player.y);
    if (!atDoor) this.doorArmed = true;
    if (atDoor && this.doorArmed && !this.locked) { this.doorArmed = false; events.emit('place-travel', { place: null }); }
  }
}
