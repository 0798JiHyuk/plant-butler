import Phaser from 'phaser';
import { daysBetween, todayKey } from '../core/clock';
import { copy } from '../core/copy';
import { events } from '../core/events';
import { flipDecor, isResting, plantSeed, storeDecor, storePlant, takeFromStorage } from '../core/rules';
import { store } from '../core/store';
import type { DecorItem, PlantedItem, StoredThing } from '../core/types';
import { canHarvest, growthStage, placeZone } from '../core/economy';
import { isTree } from '../core/plants';
import { preloadAssets } from './assets';
import { BED_BACK, bedFoot, decorFoot, feetOverlap, footDepth, inFront, insideFoot, smallFoot, trunkFoot, type Foot } from './footprints';
import { Npc } from './Npc';
import { BED, bedFits, COLS, coverZoom, defaultViewZoom, inBed, isDecorTile, isFieldTile, isWalkable, MAP_H, MAP_W, NPC_HOMES, nearestSlot, plantSlots, ROWS, setBedPos, slotWorld, SPAWN, TILE, treeRoomAt } from './map';
import { Player } from './Player';

/** 도감 식물 그림(96px)을 정원에서 보이는 크기로 */
const PLANT_SIZE = 44;
const TREE_SIZE = 120;
const DRAG_DEPTH = 9000;
/** 이 거리 안에서 끝나면 "끌지 않고 짚기만 했다" = 창고로 치운다. */
const TAP_THRESHOLD = TILE * 0.3;

/** 이전 그림의 저장본(꽃·화분·등불)은 새 소품으로 바꿔 보여준다. */
const LEGACY_DECOR: Record<string, string> = { flower: 'flowerpot', pot: 'flowerpot', lamp: 'table' };

function decorTexture(item: Pick<DecorItem, 'kind' | 'variant'>): string {
  return `decor_${shownKind(item.kind)}`;
}

/** 화면에 보이는 소품 종류(예전 저장본은 바꿔 보여 주는 새 소품). 발자국도 보이는 그림을 따른다. */
function shownKind(kind: DecorItem['kind']): DecorItem['kind'] {
  return (LEGACY_DECOR[kind] ?? kind) as DecorItem['kind'];
}

/** 마당에 놓으려는 것: 소품(종류·방향)이거나 식물(나무는 줄기, 수확한 꽃은 작은 자리). 겹침을 볼 때 쓴다. */
type Placeable = { decor: DecorItem['kind']; flip: boolean } | { tree: boolean };

const placeableOf = (item: Pick<DecorItem, 'kind' | 'flip'>): Placeable => ({ decor: item.kind, flip: !!item.flip });

export class GardenScene extends Phaser.Scene {
  private player!: Player;
  private keys!: { cursors: Phaser.Types.Input.Keyboard.CursorKeys; wasd: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key> };
  private stick = { x: 0, y: 0 };
  private locked = false;
  private viewZoom = 1;
  private jumpKey!: Phaser.Input.Keyboard.Key;

  private decorSprites = new Map<string, Phaser.GameObjects.Image>();
  private plantSprites = new Map<string, Phaser.GameObjects.Image>();
  private fruitMarks = new Map<string, Phaser.GameObjects.Image>();
  private npcs: Npc[] = [];
  private decorating = false;
  private dragId: string | null = null;
  private dragKind: 'decor' | 'plant' | 'bed' | null = null;
  private bedImg?: Phaser.GameObjects.Image;
  private bedGrab = { x: 0, y: 0 };
  private bedFrom = { x: 0, y: 0 };
  private dragStart = { x: 0, y: 0 };
  /** 끌기 시작할 때 짚은 곳과 그림 바닥 사이의 거리 */
  private grab = { x: 0, y: 0 };
  /** 끄는 식물이 놓일 곳: 수확한 꽃은 소품처럼 마당에 놓는다. */
  private dragSpot: 'decor' | 'plant' = 'plant';
  private placing: StoredThing | null = null;
  private placingSprite?: Phaser.GameObjects.Image;
  private seedPick: string | null = null;
  private seedPickTree = false;
  private moundHint?: Phaser.GameObjects.Graphics;
  private grid?: Phaser.GameObjects.Graphics;
  private hint?: Phaser.GameObjects.Graphics;
  /** ?hitbox: 발자국(못 지나가는 곳)을 정원 위에 그려 본다. 소품 그림을 바꿀 때 맞춰 보는 용도. */
  private hitbox?: Phaser.GameObjects.Graphics;
  /** 꾸미기에서 짚은 것. 아래쪽에 [옮기기]·[방향 바꾸기]·[창고에 넣기] 메뉴가 뜬다. */
  private selected: { id: string; kind: 'decor' | 'plant' } | null = null;
  /** [옮기기]로 들고 있는 중: 포인터를 따라 칸에 맞춰 보이다가, 손을 뗀 칸에 놓인다. */
  private carrying = false;
  private selectMark?: Phaser.GameObjects.Graphics;

  constructor() {
    super('garden');
  }

  preload(): void {
    preloadAssets(this);
  }

  create(): void {
    this.add.image(0, 0, 'garden_background').setOrigin(0, 0).setDepth(0);
    this.drawField();

    // 걸을 수 있는 곳: 마당 다각형 안이면서, 텃밭·소품의 발자국(땅에 닿은 자리)이 아닌 곳
    const isBlocked = (px: number, py: number) => !isWalkable(px, py) || insideFoot(bedFoot(), px, py) || this.blockedByDecor(px, py);
    this.player = new Player(this, SPAWN.x, SPAWN.y, isBlocked);

    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H).startFollow(this.player.sprite, true, 0.12, 0.12).setRoundPixels(true);
    this.applyZoom(store.state.settings.viewZoom ?? defaultViewZoom(this.cameras.main.height));
    this.scale.on('resize', () => this.applyZoom(this.viewZoom));

    const kb = this.input.keyboard!;
    this.keys = {
      cursors: kb.createCursorKeys(),
      wasd: kb.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>,
    };
    this.jumpKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // 새싹이를 누르면 폴짝 뛴다(스페이스바와 같은 동작)
    this.player.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.hop());
    store.state.garden.items.forEach((item) => this.placeDecor(item, false));
    store.state.garden.plants.forEach((p) => this.placePlant(p, false));
    if (isResting(store.state, todayKey())) this.player.setPose('rest');

    if (new URLSearchParams(location.search).has('hitbox')) this.hitbox = this.add.graphics().setDepth(DRAG_DEPTH - 3);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDragStart(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onDragMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onDragEnd(p));

    const offs = [
      events.on('move-input', (v) => (this.stick = v)),
      events.on('ui-lock', ({ locked }) => this.setLocked(locked)),
      events.on('sprout-pose', ({ pose }) => this.player.setPose(pose)),
      events.on('celebrate', ({ item }) => this.celebrate(item)),
      events.on('plant-grown', ({ planted }) => this.showSpot(this.plantXY(planted).x, this.plantXY(planted).y, () => this.placePlant(planted, true))),
      events.on('view-zoom', ({ zoom }) => this.applyZoom(zoom)),
      events.on('decorate-mode', ({ on }) => (on ? this.enterDecorate() : this.exitDecorate())),
      events.on('decor-place-start', (item) => this.startPlacing(item)),
      events.on('decor-action', ({ action }) => this.onDecorAction(action)),
      events.on('seed-pick-start', ({ seedId, tree }) => this.startSeedPick(seedId, tree)),
      events.on('harvested', ({ id }) => this.liftPlant(id)),
      store.subscribe(() => this.refreshPlants()),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));

    // 날짜가 바뀌면(자정을 넘기거나 데모에서 날짜를 넘기면) 식물의 모습이 바뀐다. 열어 둔 채로 자정을 넘긴 경우도 반영한다.
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this.refreshPlants() });
    this.refreshPlants();

    // 주민들: 자기 자리 근처를 서성이고, 누르면 대화한다. 그림이 오기 전에는 임시 그림과 이름표로 보인다.
    const canStand = (x: number, y: number) => isWalkable(x, y) && isWalkable(x - 14, y) && isWalkable(x + 14, y) && !inBed(x, y, 20) && !this.blockedByDecor(x, y);
    const defs: { id: 'nuri' | 'moru' | 'pio'; name: string }[] = [
      { id: 'nuri', name: copy.talk.npc.nuri.name },
      { id: 'moru', name: copy.talk.npc.moru.name },
      { id: 'pio', name: copy.talk.npc.pio.name },
    ];
    this.npcs = defs.map(
      (d) =>
        new Npc(this, d.id, d.name, NPC_HOMES[d.id], canStand, () => {
          if (!this.locked && !this.decorating) events.emit('npc-talk', { id: d.id });
        }),
    );
  }

  update(_time: number, delta: number): void {
    const { cursors, wasd } = this.keys;
    let x = (cursors.right.isDown || wasd.D.isDown ? 1 : 0) - (cursors.left.isDown || wasd.A.isDown ? 1 : 0);
    let y = (cursors.down.isDown || wasd.S.isDown ? 1 : 0) - (cursors.up.isDown || wasd.W.isDown ? 1 : 0);
    if (x === 0 && y === 0) ({ x, y } = this.stick);
    if (this.locked) x = y = 0;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    if (!this.locked && Phaser.Input.Keyboard.JustDown(this.jumpKey)) this.hop();
    this.player.move(x, y, delta);
    if (!this.player.isJumping) this.player.sprite.setDepth(this.standDepth(this.player.x, this.player.y));
    for (const npc of this.npcs) {
      npc.update(delta, this.player, this.locked || this.decorating);
      npc.sprite.setDepth(this.standDepth(npc.x, npc.y));
    }
    if (this.hitbox) this.drawHitbox();

    const cam = this.cameras.main;
    events.emit('player-screen', { x: (this.player.x - cam.worldView.x) * cam.zoom, y: (this.player.y - cam.worldView.y) * cam.zoom, zoom: cam.zoom });
  }

  /** 시야(배율). 정원 전체가 보이는 배율보다 작아질 수 없고, 꾸미기 중에는 전체 보기가 우선한다. */
  private applyZoom(zoom: number): void {
    this.viewZoom = zoom;
    if (this.decorating) return;
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(zoom, coverZoom(cam.width, cam.height), 2));
  }

  /** 글을 쓰는 동안에는 W·A·S·D가 글자로 입력되어야 하므로 키보드 가로채기를 끈다. */
  private setLocked(locked: boolean): void {
    this.locked = locked;
    const kb = this.input.keyboard!;
    // 꺼져 있는 동안 뗀 키는 Phaser가 받지 못해 눌린 채로 남는다(창을 닫으면 혼자 계속 걷던 버그).
    // 창이 다른 데로 넘어갈 때 Phaser가 하는 것처럼, 켜고 끌 때마다 눌림 상태를 지운다.
    kb.resetKeys();
    kb.enabled = !locked;
    if (locked) kb.disableGlobalCapture();
    else kb.enableGlobalCapture();
  }

  // ---------- 정원에 놓이는 것들 ----------
  /** 그 칸에 놓았을 때의 발자국. 소품 크기는 그림(텍스처) 크기라서 튀어나오는 연출 중에도 같다. */
  private footFor(what: Placeable, col: number, row: number): Foot {
    const x = col * TILE + TILE / 2;
    const y = (row + 1) * TILE;
    if ('decor' in what) {
      const frame = this.textures.getFrame(decorTexture({ kind: what.decor, variant: 0 }));
      return decorFoot(shownKind(what.decor), x, y, frame.realWidth, frame.realHeight, what.flip);
    }
    return what.tree ? trunkFoot(x, y) : smallFoot(x, y);
  }

  /** 들고 있거나 끌고 있는 것(정원에서 잠시 빠진 것) */
  private isLifted(id: string): boolean {
    return id === this.dragId || (this.carrying && id === this.selected?.id);
  }

  /** 놓인 소품과 그 발자국(들고 있는 소품은 뺀다). */
  private decorFeet(): { img: Phaser.GameObjects.Image; foot: Foot }[] {
    const out: { img: Phaser.GameObjects.Image; foot: Foot }[] = [];
    for (const item of store.state.garden.items) {
      const img = this.decorSprites.get(item.id);
      if (!img || this.isLifted(item.id)) continue;
      out.push({ img, foot: this.footFor(placeableOf(item), item.col, item.row) });
    }
    return out;
  }

  /** 마당에서 자리를 차지한 것들의 발자국: 텃밭·소품·나무 줄기·장식으로 놓은 꽃(exceptId는 뺀다). */
  private groundFeet(exceptId: string, withBed = true): Foot[] {
    const feet: Foot[] = withBed ? [bedFoot()] : [];
    for (const item of store.state.garden.items) {
      if (item.id !== exceptId) feet.push(this.footFor(placeableOf(item), item.col, item.row));
    }
    for (const p of store.state.garden.plants) {
      if (p.id === exceptId || isFieldTile(p.col, p.row)) continue;
      feet.push(this.footFor({ tree: isTree(p.plantId) }, p.col, p.row));
    }
    return feet;
  }

  /** 소품을 그리는 순서: 발자국의 앞뒤 가운데(그림 바닥이 아니라 땅에 닿은 자리). */
  private decorDepth(item: Pick<DecorItem, 'kind' | 'flip' | 'col' | 'row'>): number {
    return footDepth(this.footFor(placeableOf(item), item.col, item.row));
  }

  /**
   * 서 있는 것(새싹이·주민)을 그리는 순서. 보통은 발 위치(y)이고, 그림이 겹치는 소품·텃밭과는
   * 발이 발자국의 앞인지 뒤인지로 정한다(비스듬한 벤치의 왼쪽 끝 뒤·오른쪽 끝 앞도 맞게 보이도록).
   */
  private standDepth(x: number, y: number): number {
    const things = [
      ...this.decorFeet().map(({ img, foot }) => ({ foot, depth: img.depth, left: img.x - img.displayWidth / 2, right: img.x + img.displayWidth / 2, top: img.y - img.displayHeight, bottom: img.y })),
      { foot: bedFoot(), depth: BED.y + BED_BACK, left: BED.x, right: BED.x + BED.w, top: BED.y, bottom: BED.y + BED.h },
    ];
    let depth = y;
    for (const t of things) {
      // 그림끼리 겹치지 않으면 순서는 상관없다(서 있는 그림은 발에서 위로 약 64px, 좌우로 24px).
      if (x + 24 < t.left || x - 24 > t.right || y < t.top || y - 64 > t.bottom) continue;
      if (inFront(t.foot, x, y)) depth = Math.max(depth, t.depth + 0.5);
      else depth = Math.min(depth, t.depth - 0.5);
    }
    return depth;
  }

  /** ?hitbox: 텃밭·소품·나무의 발자국과 새싹이의 발을 그린다. */
  private drawHitbox(): void {
    const g = this.hitbox!;
    g.clear();
    g.lineStyle(2, 0xff3b30, 0.9);
    for (const { foot } of this.decorFeet()) g.strokePoints(foot.map(([x, y]) => ({ x, y })), true);
    g.strokePoints(bedFoot().map(([x, y]) => ({ x, y })), true);
    for (const p of store.state.garden.plants) {
      if (!isTree(p.plantId)) continue;
      const at = this.plantXY(p);
      g.strokePoints(trunkFoot(at.x, at.y).map(([x, y]) => ({ x, y })), true);
    }
    g.lineStyle(2, 0x0a84ff, 0.9);
    g.strokeRect(this.player.x - 12, this.player.y - 8, 24, 8);
  }

  /** 소품은 발자국만큼 막는다. 발자국 뒤쪽(위)으로는 걸어 지나가며 소품에 가려진다. */
  private blockedByDecor(px: number, py: number): boolean {
    if (this.decorFeet().some(({ foot }) => insideFoot(foot, px, py))) return true;
    for (const p of store.state.garden.plants) {
      if (!isTree(p.plantId)) continue;
      const at = this.plantXY(p); // 나무는 줄기만 막는다
      if (insideFoot(trunkFoot(at.x, at.y), px, py)) return true;
    }
    return false;
  }

  private placeDecor(item: DecorItem, pop: boolean): void {
    const img = this.add
      .image(item.col * TILE + TILE / 2, (item.row + 1) * TILE, decorTexture(item))
      .setOrigin(0.5, 1)
      .setFlipX(!!item.flip)
      .setDepth(this.decorDepth(item));
    this.decorSprites.set(item.id, img);
    if (pop) this.pop(img);
  }

  /** 밭: 나무 틀 텃밭 그림. 식물은 이 그림의 두둑 위에 심긴다. */
  private drawField(): void {
    const saved = store.state.garden.bed;
    if (saved) setBedPos(saved.x, saved.y);
    // 그리는 순서는 틀 뒤의 땅 줄(BED_BACK). 그 뒤에 선 새싹이는 텃밭에 가려지고, 두둑의 식물은 그보다 앞이다.
    this.bedImg = this.add.image(BED.x, BED.y, 'garden_field').setOrigin(0, 0).setDisplaySize(BED.w, BED.h).setDepth(BED.y + BED_BACK);
  }

  /** 텃밭이 옮겨졌을 때 그림과 그 위의 식물·열매 표시를 새 자리로 맞춘다. */
  private syncBed(): void {
    this.bedImg?.setPosition(BED.x, BED.y).setDepth(BED.y + BED_BACK);
    for (const p of store.state.garden.plants) {
      const img = this.plantSprites.get(p.id);
      if (!img || !isFieldTile(p.col, p.row)) continue;
      const pos = this.plantXY(p);
      img.setPosition(pos.x, pos.y).setDepth(pos.y);
    }
    // 열매 표시는 위아래로 흔들리는 중이라 지우고 새 자리에 다시 만든다.
    for (const mark of this.fruitMarks.values()) mark.destroy();
    this.fruitMarks.clear();
    this.refreshPlants();
  }

  /** 텃밭을 놓을 수 없게 만드는 점들: 놓인 소품과 새싹이. */
  private bedAvoid(): { x: number; y: number }[] {
    const yard = store.state.garden.plants.filter((p) => !isFieldTile(p.col, p.row));
    const pts = [...store.state.garden.items, ...yard].map((i) => ({ x: i.col * TILE + TILE / 2, y: i.row * TILE + TILE / 2 }));
    return [...pts, { x: this.player.sprite.x, y: this.player.sprite.y }];
  }

  /** 심은 날과 오늘로 정해지는 식물의 모습: 씨앗 → 새싹 → 꽃. */
  private plantLook(plantId: string, plantedOn: string, fruiting = true): { key: string; size: number } {
    const stage = growthStage(plantedOn, todayKey(), plantId);
    if (stage === 'young') return { key: 'plant_tree_young', size: TREE_SIZE * 0.7 };
    if (stage === 'bloom' && isTree(plantId)) return { key: fruiting ? `plant_${plantId}` : 'plant_tree_grown', size: TREE_SIZE };
    if (stage === 'seed') return { key: 'plant_seed', size: 26 };
    if (stage === 'sprout' && !isTree(plantId) && daysBetween(plantedOn, todayKey()) >= 2) return { key: 'plant_bud', size: 40 }; // 꽃이 피기 전날은 봉오리
    if (stage === 'sprout') return { key: 'plant_sprout', size: 40 };
    return { key: `plant_${plantId}`, size: PLANT_SIZE };
  }

  private placePlant(p: PlantedItem, pop: boolean): void {
    const look = this.plantLook(p.plantId, p.date, canHarvest(p, todayKey(), store.state.days));
    const pos = this.plantXY(p);
    const size = this.plantSize(p, look.size);
    const img = this.add
      .image(pos.x, pos.y, look.key)
      .setOrigin(0.5, 1)
      .setDisplaySize(size, size)
      .setDepth(pos.y);
    // 꽃이 핀 식물을 누르면 열매를 딴다(꾸미는 중에는 끌어 옮기기가 우선이다).
    img.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (!this.decorating && !this.locked) events.emit('plant-tap', { id: p.id });
    });
    this.plantSprites.set(p.id, img);
    if (pop) this.pop(img);
    this.refreshPlants();
  }

  /** 식물이 서 있는 곳(발 끝). 밭의 두둑이거나, 예전 저장본이면 마당 칸. */
  private plantXY(p: { col: number; row: number }): { x: number; y: number } {
    return slotWorld(p.col, p.row) ?? { x: p.col * TILE + TILE / 2, y: (p.row + 1) * TILE };
  }

  /** 밭의 두둑은 서로 가까워서 식물을 조금 작게 보여 준다. */
  private plantSize(p: { col: number; row: number }, size: number): number {
    return isFieldTile(p.col, p.row) ? Math.round(size * 0.8) : size;
  }

  /** 이미 정원에 있는 식물의 모습과 "열매가 열렸어요" 표시를 지금 날짜에 맞게 고친다. */
  private refreshPlants(): void {
    const today = todayKey();
    const live = new Set<string>();
    for (const p of store.state.garden.plants) {
      const img = this.plantSprites.get(p.id);
      if (!img) continue; // 아직 정원에 놓이는 연출 중이면 건너뛴다
      live.add(p.id);
      const look = this.plantLook(p.plantId, p.date, canHarvest(p, today, store.state.days));
      if (img.texture.key !== look.key) img.setTexture(look.key);
      if (!this.tweens.isTweening(img)) {
        const size = this.plantSize(p, look.size);
        img.setDisplaySize(size, size);
      }
      const ready = canHarvest(p, today, store.state.days);
      const mark = this.fruitMarks.get(p.id);
      if (ready && !mark) {
        const m = this.add.image(img.x, img.y - look.size - 4, 'fruit_mark').setDepth(DRAG_DEPTH - 2).setDisplaySize(24, 24);
        m.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (!this.decorating && !this.locked) events.emit('plant-tap', { id: p.id });
        });
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this.tweens.add({ targets: m, y: m.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        this.fruitMarks.set(p.id, m);
      } else if (!ready && mark) {
        mark.destroy();
        this.fruitMarks.delete(p.id);
      } else if (ready && mark && !this.tweens.isTweening(mark)) {
        mark.setPosition(img.x, img.y - look.size - 4);
      }
    }
    // 창고로 들어간 식물의 표시는 지운다.
    for (const [id, mark] of this.fruitMarks) {
      if (!live.has(id)) {
        mark.destroy();
        this.fruitMarks.delete(id);
      }
    }
  }

  /** 열매를 땄다: 나무는 살짝 흔들리고, 꽃은 떠오르며 밭에서 사라진다(창고로 간다). */
  private liftPlant(id: string): void {
    const img = this.plantSprites.get(id);
    if (!img) return;
    if (store.state.garden.plants.some((p) => p.id === id)) {
      this.tweens.add({ targets: img, angle: 3, duration: 90, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      return;
    }
    this.plantSprites.delete(id);
    this.tweens.add({ targets: img, y: img.y - 24, alpha: 0, duration: 320, ease: 'Sine.easeOut', onComplete: () => img.destroy() });
  }

  private pop(img: Phaser.GameObjects.Image): void {
    const target = img.scale;
    img.setScale(0);
    this.tweens.add({ targets: img, scale: target, duration: 450, ease: 'Back.easeOut' });
  }

  /** 카메라가 그 칸으로 가서 무언가 일어나는 걸 보여주고, 다시 새싹이를 따라간다. */
  private showSpot(x: number, y: number, act: () => void): void {
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(x, y, 700, 'Sine.easeInOut');
    this.time.delayedCall(750, act);
    this.time.delayedCall(2100, () => {
      if (!this.decorating) cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    });
  }

  /** 그냥 폴짝: 보상이나 기록과 무관한 새싹이의 장난. 창이 열려 있거나 꾸미는 중에는 하지 않는다. */
  private hop(): void {
    if (this.locked || this.decorating) return;
    this.player.playJump(() => {
      this.time.delayedCall(250, () => {
        if (this.player.currentPose === 'joy') this.player.setPose('idle');
      });
    });
  }

  private celebrate(item: DecorItem | null): void {
    this.player.playJump(() => {
      this.time.delayedCall(700, () => {
        if (this.player.currentPose === 'joy') this.player.setPose('idle');
      });
    });
    if (item) this.time.delayedCall(900, () => this.showSpot(item.col * TILE + TILE / 2, item.row * TILE, () => this.placeDecor(item, true)));
  }

  // ---------- 꾸미기: 정원 전체를 보여주고 소품을 끌어 칸에 맞춰 놓는다 ----------
  private enterDecorate(): void {
    this.decorating = true;
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.removeBounds();
    cam.setZoom(Math.min(cam.width / MAP_W, cam.height / MAP_H)); // 정원 전체가 한 화면에 들어오는 배율(꾸미기 전용)
    cam.centerOn(MAP_W / 2, MAP_H / 2);
    this.grid = this.add.graphics().setDepth(DRAG_DEPTH - 1);
    this.grid.lineStyle(1, 0xffffff, 0.28);
    for (let c = 0; c <= COLS; c++) this.grid.lineBetween(c * TILE, 0, c * TILE, MAP_H);
    for (let r = 0; r <= ROWS; r++) this.grid.lineBetween(0, r * TILE, MAP_W, r * TILE);
    this.hint = this.add.graphics().setDepth(DRAG_DEPTH + 1); // 들고 있는 그림(DRAG_DEPTH)에 가려지지 않게 그 위에
    this.selectMark = this.add.graphics().setDepth(DRAG_DEPTH - 1);
  }

  private exitDecorate(): void {
    this.deselect();
    this.decorating = false;
    this.dragId = null;
    this.cancelPlacing();
    this.cancelSeedPick();
    this.grid?.destroy();
    this.hint?.destroy();
    this.selectMark?.destroy();
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W, MAP_H);
    this.applyZoom(this.viewZoom);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.player.hopOutIfStuck();
  }

  /** 소품·나무를 새싹이 위에 놓았으면, 놓는 연출이 끝난 뒤 새싹이가 옆으로 비켜선다. */
  private makeRoom(): void {
    this.time.delayedCall(180, () => this.player.hopOutIfStuck());
  }

  /** 씨앗을 심을 곳 고르기: 빈 두둑을 밝게 보여 주고, 누른 곳에 심는다. 터치에서도 보이도록 포인터를 따라다니지 않는다. */
  private startSeedPick(seedId: string, tree: boolean): void {
    if (!this.decorating) return;
    this.seedPick = seedId;
    this.seedPickTree = tree;
    this.moundHint = this.add.graphics().setDepth(DRAG_DEPTH - 1);
    this.moundHint.fillStyle(0x7dff7d, 0.55);
    if (tree) {
      // 나무는 마당 칸에 심는다. 꾸미기처럼 정원 전체를 보여 준다.
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (this.canPlace(col, row, '', 'decor', { tree: true })) this.moundHint.fillRect(col * TILE + 2, row * TILE + 2, TILE - 4, TILE - 4);
        }
      }
      return;
    }
    // 두둑이 손가락으로 누를 만큼 크게 보이도록 텃밭으로 다가간다(위쪽 바 높이만큼 아래로 비켜 준다).
    const cam = this.cameras.main;
    const barH = 80;
    cam.setZoom(Math.min(cam.width / (BED.w + 60), (cam.height - barH) / (BED.h + 30)));
    cam.centerOn(BED.x + BED.w / 2, BED.y + BED.h / 2 - barH / 2 / cam.zoom);
    for (const { col, row } of plantSlots()) {
      const at = slotWorld(col, row);
      if (at && this.canPlace(col, row, '', 'plant', { tree: false })) this.moundHint.fillEllipse(at.x, at.y - 8, 40, 20);
    }
  }

  private cancelSeedPick(): void {
    this.seedPick = null;
    this.moundHint?.destroy();
    this.moundHint = undefined;
  }

  private commitSeedPick(p: Phaser.Input.Pointer): void {
    const seedId = this.seedPick;
    const spot = this.seedPickTree ? 'decor' : 'plant';
    const cell = this.cellAt(p, spot);
    if (!seedId || !this.canPlace(cell.col, cell.row, '', spot, { tree: this.seedPickTree })) return;
    let planted: PlantedItem | null = null;
    store.update((d) => {
      planted = plantSeed(d, seedId, todayKey(), cell);
    });
    if (planted) {
      events.emit('seed-planted', { planted });
      this.makeRoom(); // 마당에 심은 나무 줄기가 새싹이 발밑일 수 있다
    }
  }

  /** 창고에서 꺼낸 것(소품·식물): 포인터를 따라다니다 칸을 짚으면 놓인다. 취소해도 창고에 그대로 남는다. */
  private startPlacing(item: StoredThing): void {
    if (!this.decorating) return;
    this.deselect();
    this.cancelPlacing();
    this.placing = item;
    const texture = item.type === 'decor' ? decorTexture({ kind: item.decorKind, variant: item.variant }) : this.plantLook(item.plantId, item.date).key;
    const cam = this.cameras.main;
    this.placingSprite = this.add
      .image(cam.worldView.centerX, cam.worldView.centerY, texture)
      .setOrigin(0.5, 1)
      .setAlpha(0.85)
      .setFlipX(item.type === 'decor' && !!item.flip)
      .setDepth(DRAG_DEPTH);
    if (item.type === 'plant') {
      const size = this.plantLook(item.plantId, item.date).size;
      this.placingSprite.setDisplaySize(size, size);
    }
  }

  private cancelPlacing(): void {
    this.placing = null;
    this.placingSprite?.destroy();
    this.placingSprite = undefined;
  }

  private commitPlacing(p: Phaser.Input.Pointer): void {
    const item = this.placing;
    if (!item) return;
    const spot = this.spotOf(item);
    const { col, row } = this.cellAt(p, spot);
    const what = this.whatOfStored(item);
    if (!this.canPlace(col, row, '', spot, what)) {
      this.preview(this.placingSprite, spot, col, row, '', what);
      events.emit('decor-blocked', { why: 'place' });
      return;
    }
    let placed: DecorItem | PlantedItem | null = null;
    store.update((d) => {
      placed = takeFromStorage(d, item.id, { col, row });
    });
    this.cancelPlacing();
    this.hint?.clear();
    if (placed) {
      if (item.type === 'decor') this.placeDecor(placed as DecorItem, true);
      else this.placePlant(placed as PlantedItem, true);
      events.emit('decor-changed', { action: 'placed' });
      this.makeRoom();
    }
  }

  private isTreeId(id: string): boolean {
    const plant = store.state.garden.plants.find((p) => p.id === id);
    return !!plant && isTree(plant.plantId);
  }

  /** 정원에 놓인 것이 무엇인지(겹침 검사용): 소품이면 종류·방향, 식물이면 나무인지. */
  private whatOf(id: string): Placeable {
    const item = store.state.garden.items.find((i) => i.id === id);
    return item ? placeableOf(item) : { tree: this.isTreeId(id) };
  }

  private whatOfStored(item: StoredThing): Placeable {
    return item.type === 'decor' ? placeableOf({ kind: item.decorKind, flip: item.flip }) : { tree: isTree(item.plantId) };
  }

  /** 놓을 자리의 종류: 소품과 수확한 꽃은 마당 칸, 키우는 식물은 두둑. */
  private spotOf(thing: StoredThing): 'decor' | 'plant' {
    return thing.type === 'plant' && placeZone(thing) === 'field' ? 'plant' : 'decor';
  }

  private spotOfId(id: string): 'decor' | 'plant' {
    const plant = store.state.garden.plants.find((pl) => pl.id === id);
    return plant && placeZone(plant) === 'field' ? 'plant' : 'decor';
  }

  /** 포인터가 가리키는 칸. 식물은 밭의 가장 가까운 두둑(없으면 -1), 소품은 마당 칸. */
  private cellAt(p: Phaser.Input.Pointer, kind: 'decor' | 'plant'): { col: number; row: number } {
    if (kind === 'plant') return nearestSlot(p.worldX, p.worldY, 34) ?? { col: -1, row: -1 };
    return { col: Math.floor(p.worldX / TILE), row: Math.floor(p.worldY / TILE) };
  }

  /** 끄는 중의 칸: 마당에서는 처음 짚은 자리만큼 비켜 둔 그림 바닥이 기준이라, 큰 소품의 윗부분을 잡고 끌어도 튀지 않는다. */
  private dragCell(p: Phaser.Input.Pointer): { col: number; row: number } {
    if (this.dragSpot === 'plant') return this.cellAt(p, 'plant');
    const bx = p.worldX - this.grab.x;
    const by = p.worldY - this.grab.y;
    return { col: Math.floor(bx / TILE), row: Math.floor((by - TILE / 2) / TILE) };
  }

  /** 정원에 놓인 것의 그림 바닥(발 끝) 자리 */
  private baseOf(id: string, kind: 'decor' | 'plant'): { x: number; y: number } {
    const item = kind === 'decor' ? store.state.garden.items.find((i) => i.id === id) : undefined;
    if (item) return { x: item.col * TILE + TILE / 2, y: (item.row + 1) * TILE };
    const plant = store.state.garden.plants.find((pl) => pl.id === id);
    return plant ? this.plantXY(plant) : { x: 0, y: 0 };
  }

  private spriteOf(id: string, kind: 'decor' | 'plant'): Phaser.GameObjects.Image | undefined {
    return (kind === 'decor' ? this.decorSprites : this.plantSprites).get(id);
  }

  /** 끌거나 들고 있는 그림을 놓일 자리에 맞춰 보여 준다(마당은 칸, 밭은 가장 가까운 두둑, 없으면 포인터). */
  private hover(img: Phaser.GameObjects.Image | undefined, spot: 'decor' | 'plant', col: number, row: number, p: Phaser.Input.Pointer): void {
    if (!img) return;
    const at = spot === 'plant' ? slotWorld(col, row) : { x: col * TILE + TILE / 2, y: (row + 1) * TILE };
    img.setPosition(at?.x ?? p.worldX, at?.y ?? p.worldY + TILE / 2);
  }

  /**
   * 놓일 자리를 미리 보여 준다: 발자국을 초록·빨강으로(들고 있는 그림 위에 겹쳐서), 놓을 수 없으면 그림을 더 흐리게.
   * 색을 입히는 setTint는 WebGL에서만 보여서(캔버스로 그리는 기기에선 안 보임) 투명도로 알린다.
   */
  private preview(img: Phaser.GameObjects.Image | undefined, spot: 'decor' | 'plant', col: number, row: number, exceptId: string, what: Placeable): void {
    const ok = this.canPlace(col, row, exceptId, spot, what);
    this.showHint(col, row, ok, spot, what);
    img?.setAlpha(ok ? 0.85 : 0.55);
  }

  /** 놓을 수 있는지 초록·빨강으로 보여 주는 표시. 마당에서는 놓일 발자국 모양 그대로 보여 준다. */
  private showHint(col: number, row: number, ok: boolean, spot: 'decor' | 'plant', what: Placeable): void {
    if (!this.hint) return;
    this.hint.clear();
    const color = ok ? 0x7dff7d : 0xff7d7d;
    this.hint.fillStyle(color, 0.45);
    if (spot === 'plant') {
      const slot = slotWorld(col, row);
      if (slot) this.hint.fillEllipse(slot.x, slot.y - 8, 40, 20);
      return;
    }
    const pts = this.footFor(what, col, row).map(([x, y]) => ({ x, y }));
    this.hint.fillPoints(pts, true);
    this.hint.lineStyle(2, color, 0.95);
    this.hint.strokePoints(pts, true);
  }

  /**
   * 마당 안의 빈 자리면 어디든(자기 자신이 있던 자리는 비어 있는 것으로 본다).
   * 마당에서는 놓일 발자국이 텃밭·소품·나무 줄기·장식 꽃의 발자국과 겹치면 놓지 않는다(칸만 달라도 겹쳐 놓이던 것).
   */
  private canPlace(col: number, row: number, exceptId: string, spot: 'decor' | 'plant', what: Placeable): boolean {
    const { items, plants } = store.state.garden;
    if ('tree' in what && what.tree && !treeRoomAt(col, row, plants.filter((p) => p.id !== exceptId && isTree(p.plantId)))) return false;
    // 식물은 밭 안에서만, 소품은 밭 밖 마당에서만 놓는다.
    const where = spot === 'plant' ? isFieldTile(col, row) : isDecorTile(col, row);
    if (!where) return false;
    if (items.some((i) => i.id !== exceptId && i.col === col && i.row === row)) return false;
    if (plants.some((p) => p.id !== exceptId && p.col === col && p.row === row)) return false;
    if (spot === 'plant') return true;
    const foot = this.footFor(what, col, row);
    return !this.groundFeet(exceptId).some((f) => feetOverlap(f, foot));
  }

  /** 텃밭을 지금 자리에 놓을 수 있는지: 마당 안이고 새싹이·주민 자리를 피하며, 소품·나무의 발자국과 겹치지 않는다. */
  private bedOk(): boolean {
    const foot = bedFoot();
    return bedFits(BED.x, BED.y, this.bedAvoid()) && !this.groundFeet('', false).some((f) => feetOverlap(f, foot));
  }

  /** 누른 곳에 있는 것: 작은 식물이 먼저, 그다음 그림이 그 자리를 덮는 소품·나무 중 가장 앞에 그려진 것. */
  private pickAt(p: Phaser.Input.Pointer): { id: string; kind: 'decor' | 'plant' } | null {
    let plant: { id: string; d: number } | null = null;
    for (const pl of store.state.garden.plants) {
      const pos = this.plantXY(pl);
      const d = Math.hypot(p.worldX - pos.x, p.worldY - (pos.y - 14));
      if (d <= 26 && (!plant || d < plant.d)) plant = { id: pl.id, d };
    }
    if (plant) return { id: plant.id, kind: 'plant' };
    const { items, plants } = store.state.garden;
    const big = [
      ...items.map((i) => ({ id: i.id, kind: 'decor' as const })),
      ...plants.filter((pl) => isTree(pl.plantId) && !isFieldTile(pl.col, pl.row)).map((pl) => ({ id: pl.id, kind: 'plant' as const })),
    ];
    let top: { id: string; kind: 'decor' | 'plant'; depth: number } | null = null;
    for (const c of big) {
      const img = this.spriteOf(c.id, c.kind);
      if (img?.getBounds().contains(p.worldX, p.worldY) && (!top || img.depth > top.depth)) top = { ...c, depth: img.depth };
    }
    return top && { id: top.id, kind: top.kind };
  }

  // ---------- 짚은 것: 아래쪽 메뉴([옮기기]·[방향 바꾸기]·[창고에 넣기]) ----------
  private select(id: string, kind: 'decor' | 'plant'): void {
    this.selected = { id, kind };
    this.carrying = false;
    this.drawSelectMark();
    events.emit('decor-select', { id, type: kind, carrying: false });
  }

  /** 고른 것을 내려놓는다(들고 있었다면 원래 자리로 돌려놓는다). */
  private deselect(): void {
    if (!this.selected) return;
    if (this.carrying) this.putBack();
    this.selected = null;
    this.selectMark?.clear();
    this.hint?.clear();
    events.emit('decor-select', null);
  }

  /** 짚은 것 둘레를 노랗게: 소품은 발자국, 식물은 발밑 타원. */
  private drawSelectMark(): void {
    const g = this.selectMark;
    const sel = this.selected;
    if (!g || !sel) return;
    g.clear();
    g.lineStyle(3, 0xffd23f, 1).fillStyle(0xffd23f, 0.25);
    const item = sel.kind === 'decor' ? store.state.garden.items.find((i) => i.id === sel.id) : undefined;
    if (item) {
      const pts = this.footFor(placeableOf(item), item.col, item.row).map(([x, y]) => ({ x, y }));
      g.fillPoints(pts, true).strokePoints(pts, true);
      return;
    }
    const at = this.baseOf(sel.id, sel.kind);
    g.fillEllipse(at.x, at.y - 4, 44, 18).strokeEllipse(at.x, at.y - 4, 44, 18);
  }

  private onDecorAction(action: 'move' | 'flip' | 'store' | 'cancel'): void {
    if (!this.selected || !this.decorating) return;
    if (action === 'cancel') this.deselect();
    else if (action === 'store') this.storeSelected();
    else if (action === 'flip') this.flipSelected();
    else this.liftSelected();
  }

  /** [창고에 넣기] */
  private storeSelected(): void {
    const { id, kind } = this.selected!;
    this.deselect();
    store.update((d) => (kind === 'decor' ? storeDecor(d, id) : storePlant(d, id)));
    this.spriteOf(id, kind)?.destroy();
    (kind === 'decor' ? this.decorSprites : this.plantSprites).delete(id);
    events.emit('decor-changed', { action: 'stored' });
  }

  /** [방향 바꾸기]: 좌우를 바꾼다. 바꾼 모양이 다른 것과 겹치면 바꾸지 않는다. */
  private flipSelected(): void {
    const sel = this.selected!;
    const item = store.state.garden.items.find((i) => i.id === sel.id);
    const img = this.decorSprites.get(sel.id);
    if (!item || !img || this.carrying) return;
    const turned = { ...item, flip: !item.flip };
    if (!this.canPlace(item.col, item.row, item.id, 'decor', placeableOf(turned))) {
      events.emit('decor-blocked', { why: 'flip' });
      return;
    }
    store.update((d) => flipDecor(d, item.id));
    img.setFlipX(turned.flip).setDepth(this.decorDepth(turned));
    this.tweens.add({ targets: img, scaleX: { from: 0.7, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    this.drawSelectMark();
    this.makeRoom();
  }

  /** [옮기기]: 짚은 것을 들어 올린다. 포인터를 따라 칸에 맞춰 보이고, 손을 뗀 칸에 놓인다. */
  private liftSelected(): void {
    const sel = this.selected!;
    if (this.carrying) return;
    this.carrying = true;
    this.spriteOf(sel.id, sel.kind)?.setDepth(DRAG_DEPTH).setAlpha(0.85);
    this.selectMark?.clear();
    events.emit('decor-select', { id: sel.id, type: sel.kind, carrying: true });
  }

  /** 들고 있는 것을 포인터가 가리키는 칸에 맞춰 보여 준다. */
  private carryTo(p: Phaser.Input.Pointer): void {
    const { id, kind } = this.selected!;
    const spot = this.spotOfId(id);
    const { col, row } = this.cellAt(p, spot);
    const img = this.spriteOf(id, kind);
    this.hover(img, spot, col, row, p);
    this.preview(img, spot, col, row, id, this.whatOf(id));
  }

  /** 손을 뗀 칸에 내려놓는다. 놓을 수 없으면 빨갛게 보인 채 계속 들고 있는다. */
  private dropCarried(p: Phaser.Input.Pointer): void {
    const { id, kind } = this.selected!;
    const spot = this.spotOfId(id);
    const { col, row } = this.cellAt(p, spot);
    if (!this.canPlace(col, row, id, spot, this.whatOf(id))) {
      events.emit('decor-blocked', { why: 'place' });
      return;
    }
    this.carrying = false;
    this.moveTo(id, kind, col, row);
    this.deselect();
    events.emit('decor-changed', { action: 'placed' });
    this.makeRoom();
  }

  /** 들고 있던 것을 원래 자리로 */
  private putBack(): void {
    if (!this.selected) return;
    this.carrying = false;
    this.settle(this.selected.id, this.selected.kind);
    this.hint?.clear();
  }

  /** 정원에 놓인 것을 그 칸으로 옮기고 그림도 맞춘다. */
  private moveTo(id: string, kind: 'decor' | 'plant', col: number, row: number): void {
    store.update((d) => {
      const target = kind === 'decor' ? d.garden.items.find((i) => i.id === id) : d.garden.plants.find((pl) => pl.id === id);
      if (target) {
        target.col = col;
        target.row = row;
      }
    });
    this.settle(id, kind);
  }

  /** 그림을 저장된 자리로 맞춘다(그리는 순서·투명도도 원래대로). */
  private settle(id: string, kind: 'decor' | 'plant'): void {
    const img = this.spriteOf(id, kind);
    if (!img) return;
    const item = kind === 'decor' ? store.state.garden.items.find((i) => i.id === id) : undefined;
    const to = this.baseOf(id, kind);
    img.setAlpha(1).setDepth(item ? this.decorDepth(item) : to.y);
    this.tweens.add({ targets: img, x: to.x, y: to.y, duration: 120 });
  }

  // ---------- 누르기·끌기 ----------
  private onDragStart(p: Phaser.Input.Pointer): void {
    if (!this.decorating) return;
    if (this.seedPick) {
      this.commitSeedPick(p);
      return;
    }
    if (this.placing) {
      this.commitPlacing(p);
      return;
    }
    if (this.carrying) {
      this.carryTo(p); // 놓기는 손을 뗄 때(터치로 누른 채 끌어 맞출 수 있게)
      return;
    }
    this.deselect();
    const best = this.pickAt(p);
    if (!best) {
      if (inBed(p.worldX, p.worldY)) {
        this.dragId = 'bed';
        this.dragKind = 'bed';
        this.dragStart = { x: p.worldX, y: p.worldY };
        this.bedGrab = { x: p.worldX - BED.x, y: p.worldY - BED.y };
        this.bedFrom = { x: BED.x, y: BED.y };
        this.bedImg?.setAlpha(0.85);
      }
      return;
    }
    this.dragId = best.id;
    this.dragKind = best.kind;
    this.dragSpot = this.spotOfId(best.id);
    this.dragStart = { x: p.worldX, y: p.worldY };
    const base = this.baseOf(best.id, best.kind);
    this.grab = { x: p.worldX - base.x, y: p.worldY - base.y };
    this.spriteOf(best.id, best.kind)?.setDepth(DRAG_DEPTH).setAlpha(0.85);
  }

  private onDragMove(p: Phaser.Input.Pointer): void {
    if (!this.hint) return;
    if (this.placing) {
      const spot = this.spotOf(this.placing);
      const { col, row } = this.cellAt(p, spot);
      this.hover(this.placingSprite, spot, col, row, p);
      this.preview(this.placingSprite, spot, col, row, '', this.whatOfStored(this.placing));
      return;
    }
    if (this.carrying) {
      this.carryTo(p);
      return;
    }
    if (!this.dragId || !this.dragKind) return;
    if (this.dragKind === 'bed') {
      setBedPos(Math.round((p.worldX - this.bedGrab.x) / 8) * 8, Math.round((p.worldY - this.bedGrab.y) / 8) * 8);
      this.syncBed();
      const ok = this.bedOk();
      this.hint.clear();
      this.hint.lineStyle(3, ok ? 0x7dff7d : 0xff7d7d, 0.9);
      this.hint.strokeRect(BED.x, BED.y, BED.w, BED.h);
      return;
    }
    // 짚기만 하는 동안에는 그림을 움직이지 않는다(큰 소품의 윗부분을 눌러도 칸이 튀지 않게).
    if (Math.hypot(p.worldX - this.dragStart.x, p.worldY - this.dragStart.y) < TAP_THRESHOLD) return;
    const { col, row } = this.dragCell(p);
    const img = this.spriteOf(this.dragId, this.dragKind);
    this.hover(img, this.dragSpot, col, row, p);
    this.preview(img, this.dragSpot, col, row, this.dragId, this.whatOf(this.dragId));
  }

  /** 짚기만 했으면 메뉴를 띄우고(바로 창고에 넣지 않는다), 끌었으면 그 칸에(안 되면 원래 자리에) 놓는다. */
  private onDragEnd(p: Phaser.Input.Pointer): void {
    if (this.carrying) {
      this.dropCarried(p);
      return;
    }
    const id = this.dragId;
    const kind = this.dragKind;
    if (!id || !kind) return;
    this.dragId = null;
    this.dragKind = null;
    this.hint?.clear();

    if (kind === 'bed') {
      this.bedImg?.setAlpha(1);
      if (this.bedOk()) {
        const { x, y } = BED;
        store.update((d) => {
          d.garden.bed = { x, y };
        });
        events.emit('decor-changed', { action: 'placed' });
      } else {
        setBedPos(this.bedFrom.x, this.bedFrom.y); // 놓을 수 없는 곳이면 원래 자리로
        this.syncBed();
        events.emit('decor-blocked', { why: 'place' });
      }
      return;
    }

    const moved = Math.hypot(p.worldX - this.dragStart.x, p.worldY - this.dragStart.y);
    if (moved < TAP_THRESHOLD) {
      this.settle(id, kind);
      this.select(id, kind);
      return;
    }
    const { col, row } = this.dragCell(p);
    if (this.canPlace(col, row, id, this.dragSpot, this.whatOf(id))) {
      this.moveTo(id, kind, col, row);
      this.makeRoom();
    } else {
      this.settle(id, kind); // 놓을 수 없는 곳이면 원래 자리로
      events.emit('decor-blocked', { why: 'place' });
    }
  }
}
