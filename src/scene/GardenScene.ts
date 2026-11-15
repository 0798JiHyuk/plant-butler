import { withinReach,INTERACTION_RANGE,SHOP_RANGE,seatPlacement } from '../core/interaction';
import { GARDEN_DECOR_BOUNDS, LANDMARKS, CAFE_BENCH, WORLD_SIZE } from '../core/worldGeometry';
import { editLayout, layoutState } from '../core/layoutDraft';
import { discover, exploration, ensureExploration, zoneAt } from '../core/exploration';
import { drawNeighborhood, districtBlocked, districtReserved } from './neighborhood';
import Phaser from 'phaser';
import { daysBetween, todayKey } from '../core/clock';
import { copy } from '../core/copy';
import { events } from '../core/events';
import { isResting, plantSeed, storeDecor, storePlant, takeFromStorage } from '../core/rules';
import { store } from '../core/store';
import type { DecorItem, PlantedItem, StoredThing } from '../core/types';
import { canHarvest, growthStage, placeZone } from '../core/economy';
import { isTree } from '../core/plants';
import { preloadAssets } from './assets';
import { Npc } from './Npc';
import { DEFAULT_BED, BED, bedFits, COLS, defaultViewZoom, inBed, isDecorTile, isFieldTile, isWalkable, MAP_H, MAP_W, NPC_HOMES, nearestSlot, plantSlots, setBedPos, slotWorld, SPAWN, TILE, treeRoomAt } from './map';
import { Player } from './Player';
import { HOME, furnitureOf, homeCellAllowed, moveHomeFurniture, placeHomeFurniture, storeHomeFurniture } from '../core/world';
import { drawHome, drawMeadow } from './worldBackground';

/** 도감 식물 그림(96px)을 정원에서 보이는 크기로 */
const PLANT_SIZE = 44;
const TREE_SIZE = 120;
const DRAG_DEPTH = 9000;
/** 이 거리 안에서 끝나면 "끌지 않고 짚기만 했다" = 창고로 치운다. */
const TAP_THRESHOLD = TILE * 0.3;

/** 이전 그림의 저장본(꽃·화분·등불)은 새 소품으로 바꿔 보여준다. */
const LEGACY_DECOR: Record<string, string> = { flower: 'flowerpot', pot: 'flowerpot', lamp: 'table' };

function decorTexture(item: Pick<DecorItem, 'kind' | 'variant'>): string {
  return `decor_${LEGACY_DECOR[item.kind] ?? item.kind}`;
}

export class GardenScene extends Phaser.Scene {
  private get state() { return layoutState(); }
  private seated: string | null = null;
  private positionTick = 0;
  private reducedMotion = false;
  private lastZone = '';
  private updateBoard?: ()=>void;
  private indoor = false;
  private returnOutside = false;
  private doorArmed = true;
  private get mapWidth():number {return this.indoor?WORLD_SIZE.interiorWidth:MAP_W;}
  private get mapHeight(): number { return this.indoor ? 712 : MAP_H; }
  private get items(): DecorItem[] { return furnitureOf(this.state, this.indoor); }
  private walkable(x: number, y: number): boolean {
    return this.indoor ? x > HOME.left + 16 && x < HOME.right - 16 && y > 258 && y < HOME.bottom : isWalkable(x, y);
  }
  init(data: { indoor?: boolean; returning?: boolean } = {}): void {
    this.indoor = data.indoor ?? (exploration(store.state).seat?.zone === 'home');
    this.returnOutside = data.returning ?? false;
    this.doorArmed = true;
  }
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
  private furnitureGrab = { x: 0, y: 0 };
  /** 끄는 식물이 놓일 곳: 수확한 꽃은 소품처럼 마당에 놓는다. */
  private dragSpot: 'decor' | 'plant' = 'plant';
  private placing: StoredThing | null = null;
  private placingSprite?: Phaser.GameObjects.Image;
  private seedPick: string | null = null;
  private seedPickTree = false;
  private moundHint?: Phaser.GameObjects.Graphics;
  private grid?: Phaser.GameObjects.Graphics;
  private decorShade?: Phaser.GameObjects.Graphics;
  private hint?: Phaser.GameObjects.Graphics;

  constructor() {
    super('garden');
  }

  preload(): void {
    preloadAssets(this);
  }

  create(): void {
    this.decorSprites.clear(); this.plantSprites.clear(); this.fruitMarks.clear();
    this.npcs = []; this.stick = { x: 0, y: 0 }; this.locked = false;
    this.seated = null; this.lastZone = '';
    this.decorating = false; this.dragId = null; this.dragKind = null;
    this.placing = null; this.placingSprite = undefined; this.seedPick = null;
    this.grid = undefined; this.hint = undefined; this.moundHint = undefined;
    if(this.indoor && !exploration(this.state).starterGranted)store.tryUpdate(s=>{
      const p=ensureExploration(s);
      if(!p.starterGranted){p.starterGranted=true;s.garden.storage.push({id:'starter-home-bench',type:'decor',decorKind:'bench',variant:0});}
    });
    this.updateBoard=undefined;
    if (this.indoor) drawHome(this);
    else { drawMeadow(this); this.updateBoard=drawNeighborhood(this, (point,range)=>this.canInteractAt(point,range),()=>this.state);this.updateBoard(); this.drawField(); }
    events.emit('location-changed', { indoor: this.indoor });
    if (!this.indoor) {
      const door = this.add.zone(LANDMARKS.home.x,LANDMARKS.home.y-30,140,100).setDepth(2).setInteractive({ useHandCursor: true });
      door.on('pointerdown', () => { if(this.canInteractAt(LANDMARKS.home,SHOP_RANGE))events.emit('house-entry', {}); });
    }

    // 걸을 수 있는 곳: 마당 다각형 안이면서, 놓인 큰 소품의 발밑이 아닌 곳
    const isBlocked = (px: number, py: number) => !this.walkable(px, py) || (!this.indoor && districtBlocked(px, py)) || (!this.indoor && inBed(px, py - 6)) || this.blockedByDecor(px, py);
    this.player = new Player(this, this.indoor ? 640 : this.returnOutside ? LANDMARKS.home.x : SPAWN.x, this.indoor ? 540 : this.returnOutside ? LANDMARKS.home.y+55 : SPAWN.y, isBlocked);

    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight).startFollow(this.player.sprite, true, 0.12, 0.12).setRoundPixels(true);
    this.applyZoom(this.indoor ? Math.min(this.cameras.main.width / this.mapWidth, this.cameras.main.height / this.mapHeight) : this.state.settings.viewZoom ?? defaultViewZoom(this.cameras.main.height));
    const resize = () => this.applyZoom(this.viewZoom);
    this.scale.on('resize', resize);

    const kb = this.input.keyboard!;
    this.keys = {
      cursors: kb.createCursorKeys(),
      wasd: kb.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>,
    };
    this.jumpKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // 새싹이를 누르면 폴짝 뛴다(스페이스바와 같은 동작)
    this.player.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.hop());
    this.items.forEach((item) => this.placeDecor(item, false));
    (this.indoor ? [] : this.state.garden.plants).forEach((p) => this.placePlant(p, false));
    if (isResting(this.state, todayKey())) this.player.setPose('rest');
    const savedSeat=exploration(this.state).seat;
    if(savedSeat){const item=this.items.find(x=>x.id===savedSeat.id);const at=savedSeat.id==='cafe-bench'&&!this.indoor?{x:CAFE_BENCH.x,y:CAFE_BENCH.y+30}:item?{x:item.col*TILE+16,y:(item.row+1)*TILE+28}:null;
      if(at){this.player.sprite.setPosition(at.x,at.y);this.setSeat(savedSeat.id);}else store.tryUpdate(s=>{delete ensureExploration(s).seat;});
    }

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDragStart(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onDragMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onDragEnd(p));

    const offs = [
      events.on('move-input', (v) => (this.stick = v)),
      events.on('ui-lock', ({ locked }) => this.setLocked(locked)),
      events.on('ui-pointer-cancel',()=>this.cancelUiPointer()),
      events.on('sprout-pose', ({ pose }) => {if(!this.seated)this.player.setPose(pose);}),
      events.on('celebrate', ({ item }) => this.celebrate(item)),
      events.on('plant-grown', ({ planted }) => this.showSpot(this.plantXY(planted).x, this.plantXY(planted).y, () => this.placePlant(planted, true))),
      events.on('view-zoom', ({ zoom }) => this.applyZoom(zoom)),
      events.on('decorate-mode', ({ on }) => (on ? this.enterDecorate() : this.exitDecorate())),
      events.on('decor-place-start', (item) => this.startPlacing(item)),
      events.on('seed-pick-start', ({ seedId, tree }) => this.startSeedPick(seedId, tree)),
      events.on('harvested', ({ id }) => this.liftPlant(id)),
      events.on('state-restored', () => this.scene.restart({ indoor: exploration(store.state).seat?.zone === 'home' })),
      events.on('layout-refresh', () => this.redrawLayout()),
      events.on('seat-change', ({ id }) => this.setSeat(id)),
      events.on('house-travel', ({ indoor }) => { if (!this.decorating) this.scene.restart({ indoor }); }),
      () => this.scale.off('resize', resize),
      store.subscribe(() => { if (!store.restoring) {
        this.refreshPlants();this.updateBoard?.();
        const reduced=!!this.state.settings.reducedMotion;
        if(reduced!==this.reducedMotion){this.reducedMotion=reduced;if(this.seated)this.setSeat(this.seated);else this.player.setPose(isResting(this.state,todayKey())?'rest':'idle');if(reduced)this.tweens.getTweensOf([...this.fruitMarks.values()]).forEach(t=>t.remove());}
      } }),
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
    this.npcs = (this.indoor ? [] : defs).map(
      (d) =>
        new Npc(this, d.id, d.name, NPC_HOMES[d.id], canStand, () => {
          const npc=this.npcs.find(n=>n.id===d.id);if(this.canInteractAt(npc??NPC_HOMES[d.id]))events.emit('npc-talk',{id:d.id});
        }),
    );
    events.emit('garden-ready', {});
  }

  update(_time: number, delta: number): void {
    const { cursors, wasd } = this.keys;
    let x = (cursors.right.isDown || wasd.D.isDown ? 1 : 0) - (cursors.left.isDown || wasd.A.isDown ? 1 : 0);
    let y = (cursors.down.isDown || wasd.S.isDown ? 1 : 0) - (cursors.up.isDown || wasd.W.isDown ? 1 : 0);
    if (x === 0 && y === 0) ({ x, y } = this.stick);
    if (this.locked || this.seated) x = y = 0;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    if (!this.locked && Phaser.Input.Keyboard.JustDown(this.jumpKey)) this.hop();
    this.player.move(x, y, delta);
    for (const npc of this.npcs) npc.update(delta, this.player, this.locked || this.decorating);

    if (!this.locked && !this.decorating) {
      const near = this.indoor ? Math.abs(this.player.x - HOME.doorX) < 65 && this.player.y > 598
        : Math.abs(this.player.x-LANDMARKS.home.x)<58 && Math.abs(this.player.y-LANDMARKS.home.y)<35;
      if (!near) this.doorArmed = true;
      if (near && this.doorArmed) { this.doorArmed = false; if (this.indoor) this.scene.restart({ indoor: false, returning: true }); else events.emit('house-entry', {}); }
    }
    this.positionTick += delta;
    if (this.positionTick > 180) {
      this.positionTick = 0;
      const zone = zoneAt(this.player.x, this.player.y, this.indoor);
      if (!this.decorating && zone !== this.lastZone) {
        if (store.tryUpdate(s => { discover(s, zone); })) this.lastZone = zone;
      }
      events.emit('world-position', { x: this.player.x, y: this.player.y, indoor: this.indoor });
    }
    const cam = this.cameras.main;
    events.emit('player-screen', { x: (this.player.x - cam.worldView.x) * cam.zoom, y: (this.player.y - cam.worldView.y) * cam.zoom, zoom: cam.zoom });
  }

  /** 시야(배율). 정원 전체가 보이는 배율보다 작아질 수 없고, 꾸미기 중에는 전체 보기가 우선한다. */
  private applyZoom(zoom: number): void {
    this.viewZoom = zoom;
    if (this.decorating) { this.frameDecorate(); return; }
    const cam = this.cameras.main;
    const minimum = this.indoor ? Math.min(cam.width / this.mapWidth, cam.height / this.mapHeight) : Math.max(cam.width / this.mapWidth, cam.height / this.mapHeight);
    cam.setZoom(Phaser.Math.Clamp(zoom, minimum, 2));
    if (this.indoor) {
      const padding = Math.max(0, (cam.width / cam.zoom - this.mapWidth) / 2);
      cam.setBounds(-padding, 0, this.mapWidth + padding * 2, this.mapHeight).setBackgroundColor('#334829');
    } else cam.setBackgroundColor('#4d6d3a');
  }

  private redrawLayout(): void {
    for(const img of this.decorSprites.values())img.destroy(); this.decorSprites.clear();
    for(const img of this.plantSprites.values())img.destroy(); this.plantSprites.clear();
    for(const img of this.fruitMarks.values())img.destroy(); this.fruitMarks.clear();
    this.items.forEach(item=>this.placeDecor(item,false));
    if(!this.indoor){this.state.garden.plants.forEach(item=>this.placePlant(item,false)); const bed=this.state.garden.bed??DEFAULT_BED;setBedPos(bed.x,bed.y);this.bedImg?.setPosition(BED.x,BED.y);this.syncBed();}
  }
  private canInteractAt(point:{x:number;y:number},range=INTERACTION_RANGE):boolean {
    if(this.locked||this.decorating)return false;
    if(!withinReach(this.player,point,range)){events.emit('interaction-too-far',{});return false;}
    events.emit('world-position',{x:this.player.x,y:this.player.y,indoor:this.indoor});
    return true;
  }

  private setSeat(id: string | null): void {
    if(id&&this.decorating)return;
    if(!id){
      if(this.seated){
        const img=this.decorSprites.get(this.seated),anchor=this.seated==='cafe-bench'?CAFE_BENCH:img;
        if(anchor){
          const candidates=[{x:anchor.x,y:anchor.y+30},{x:anchor.x-110,y:anchor.y+22},{x:anchor.x+110,y:anchor.y+22}];
          const at=candidates.find(p=>this.walkable(p.x,p.y)&&!this.blockedByDecor(p.x,p.y)&&(!this.indoor?!districtBlocked(p.x,p.y)&&!inBed(p.x,p.y):true));
          if(at)this.player.sprite.setPosition(at.x,at.y);
        }
      }
      this.seated=null;this.player?.setPose('idle');
      if(exploration(this.state).seat)store.tryUpdate(s=>{delete ensureExploration(s).seat;});
      return;
    }
    const img=this.decorSprites.get(id),item=this.items.find(i=>i.id===id);
    const anchor=id==='cafe-bench'?CAFE_BENCH:img;
    const kind=id==='cafe-bench'?'bench':item?.kind;
    if(!anchor||(kind!=='bench'&&kind!=='hammock'))return;
    if(!withinReach(this.player,anchor)){events.emit('interaction-too-far',{});return;}
    if(!store.tryUpdate(s=>{ensureExploration(s).seat={zone:this.indoor?'home':zoneAt(anchor.x,anchor.y,false),id};}))return;
    const at=seatPlacement(anchor,kind,img?.displayHeight??125);
    this.seated=id;this.player.sprite.setPosition(at.x,at.y);this.player.restOnFurniture(at.pose,at.depth);
  }

  /** 글을 쓰는 동안에는 W·A·S·D가 글자로 입력되어야 하므로 키보드 가로채기를 끈다. */
  private setLocked(locked: boolean): void {
    this.locked = locked;
    const kb = this.input.keyboard!;
    kb.enabled = !locked;
    if (locked) kb.disableGlobalCapture();
    else kb.enableGlobalCapture();
  }

  // ---------- 정원에 놓이는 것들 ----------
  /** 큰 소품은 발밑 타원만큼 막는다. 소품 뒤쪽(위)으로는 걸어 지나갈 수 있다. */
  private blockedByDecor(px: number, py: number): boolean {
    for (const img of this.decorSprites.values()) {
      if (Math.abs(px - img.x) < img.displayWidth * 0.36 && py <= img.y && py > img.y - 18) return true;
    }
    for (const p of this.indoor ? [] : this.state.garden.plants) {
      if (!isTree(p.plantId)) continue;
      const at = this.plantXY(p); // 나무는 줄기만 막는다
      if (Math.abs(px - at.x) < 14 && py <= at.y && py > at.y - 14) return true;
    }
    return false;
  }

  private placeDecor(item: DecorItem, pop: boolean): void {
    const img = this.add
      .image(item.col * TILE + TILE / 2, (item.row + 1) * TILE, decorTexture(item))
      .setOrigin(0.5, 1)
      .setDepth((item.row + 1) * TILE);
    if(item.kind==='bench'||item.kind==='hammock') img.setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(this.canInteractAt(img)) this.setSeat(this.seated===item.id?null:item.id);});
    this.decorSprites.set(item.id, img);
    if (pop) this.pop(img);
  }

  /** 밭: 나무 틀 텃밭 그림. 식물은 이 그림의 두둑 위에 심긴다. */
  private drawField(): void {
    const saved = this.state.garden.bed;
    setBedPos(saved?.x ?? DEFAULT_BED.x, saved?.y ?? DEFAULT_BED.y);
    this.bedImg = this.add.image(BED.x, BED.y, 'garden_field').setOrigin(0, 0).setDisplaySize(BED.w, BED.h).setDepth(BED.y);
  }

  /** 텃밭이 옮겨졌을 때 그림과 그 위의 식물·열매 표시를 새 자리로 맞춘다. */
  private syncBed(): void {
    this.bedImg?.setPosition(BED.x, BED.y).setDepth(BED.y);
    for (const p of this.indoor ? [] : this.state.garden.plants) {
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
    const yard = this.state.garden.plants.filter((p) => !isFieldTile(p.col, p.row));
    const pts = [...this.items, ...yard].map((i) => ({ x: i.col * TILE + TILE / 2, y: i.row * TILE + TILE / 2 }));
    return [...pts, { x: this.player.sprite.x, y: this.player.sprite.y }];
  }

  /** 심은 날과 오늘로 정해지는 식물의 모습: 씨앗 → 새싹 → 꽃. */
  private plantLook(plantId: string, plantedOn: string, fruiting = true, inField = false): { key: string; size: number } {
    const stage = growthStage(plantedOn, todayKey(), plantId);
    if (stage === 'young') return { key: 'plant_tree_young', size: TREE_SIZE * 0.7 };
    if (stage === 'bloom' && isTree(plantId)) return { key: fruiting ? `plant_${plantId}` : 'plant_tree_grown', size: TREE_SIZE };
    if (stage === 'seed') return inField ? { key: 'plant_field_planted', size: 40 } : { key: 'plant_planted', size: 44 };
    if (stage === 'sprout' && !isTree(plantId) && daysBetween(plantedOn, todayKey()) >= 2) return { key: 'plant_bud', size: 40 }; // 꽃이 피기 전날은 봉오리
    if (stage === 'sprout') return { key: 'plant_sprout', size: 40 };
    return { key: `plant_${plantId}`, size: PLANT_SIZE };
  }

  private placePlant(p: PlantedItem, pop: boolean): void {
    const look = this.plantLook(p.plantId, p.date, canHarvest(p, todayKey(), this.state.days), isFieldTile(p.col, p.row));
    const pos = this.plantXY(p);
    const size = this.plantSize(p, look.size);
    const img = this.add
      .image(pos.x, pos.y, look.key)
      .setOrigin(0.5, 1)
      .setDisplaySize(size, size)
      .setDepth(pos.y);
    // 꽃이 핀 식물을 누르면 열매를 딴다(꾸미는 중에는 끌어 옮기기가 우선이다).
    img.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if(this.canInteractAt(this.plantXY(p)))events.emit('plant-tap',{id:p.id});
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
    for (const p of this.indoor ? [] : this.state.garden.plants) {
      const img = this.plantSprites.get(p.id);
      if (!img) continue; // 아직 정원에 놓이는 연출 중이면 건너뛴다
      live.add(p.id);
      const look = this.plantLook(p.plantId, p.date, canHarvest(p, today, this.state.days), isFieldTile(p.col, p.row));
      if (img.texture.key !== look.key) img.setTexture(look.key);
      if (!this.tweens.isTweening(img)) {
        const size = this.plantSize(p, look.size);
        img.setDisplaySize(size, size);
      }
      const ready = canHarvest(p, today, this.state.days);
      const mark = this.fruitMarks.get(p.id);
      if (ready && !mark) {
        const m = this.add.image(img.x, img.y - look.size - 4, 'fruit_mark').setDepth(DRAG_DEPTH - 2).setDisplaySize(24, 24);
        m.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if(this.canInteractAt(this.plantXY(p)))events.emit('plant-tap',{id:p.id});
        });
        if (!this.state.settings.reducedMotion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    if (this.state.garden.plants.some((p) => p.id === id)) {
      this.tweens.add({ targets: img, angle: 3, duration: 90, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      return;
    }
    this.plantSprites.delete(id);
    this.tweens.add({ targets: img, y: img.y - 24, alpha: 0, duration: 320, ease: 'Sine.easeOut', onComplete: () => img.destroy() });
  }

  private pop(img: Phaser.GameObjects.Image): void {
    if(this.state.settings.reducedMotion)return;
    const target = img.scale;
    img.setScale(0);
    this.tweens.add({ targets: img, scale: target, duration: 450, ease: 'Back.easeOut' });
  }

  /** 카메라가 그 칸으로 가서 무언가 일어나는 걸 보여주고, 다시 새싹이를 따라간다. */
  private showSpot(x: number, y: number, act: () => void): void {
    if(this.state.settings.reducedMotion){act();return;}
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
    if (this.locked || this.decorating || this.seated) return;
    this.player.playJump(() => {
      this.time.delayedCall(250, () => {
        if (this.player.currentPose === 'joy') this.player.setPose('idle');
      });
    });
  }

  private celebrate(item: DecorItem | null): void {
    if(this.seated)return;
    this.player.playJump(() => {
      this.time.delayedCall(700, () => {
        if (this.player.currentPose === 'joy') this.player.setPose('idle');
      });
    });
    if (item && !this.indoor) this.time.delayedCall(900, () => this.showSpot(item.col * TILE + TILE / 2, item.row * TILE, () => this.placeDecor(item, true)));
  }

  // ---------- 꾸미기: 정원 전체를 보여주고 소품을 끌어 칸에 맞춰 놓는다 ----------
  private enterDecorate(): void {
    this.setSeat(null);
    this.decorating = true;
    this.frameDecorate();
    if(!this.indoor){
      const b=GARDEN_DECOR_BOUNDS;
      this.decorShade=this.add.graphics().setDepth(DRAG_DEPTH-3).fillStyle(0x233523,.6);
      this.decorShade.fillRect(0,0,MAP_W,b.y);
      this.decorShade.fillRect(0,b.y+b.height,MAP_W,MAP_H-b.y-b.height);
      this.decorShade.fillRect(0,b.y,b.x,b.height);
      this.decorShade.fillRect(b.x+b.width,b.y,MAP_W-b.x-b.width,b.height);
    }
    this.grid = this.add.graphics().setDepth(DRAG_DEPTH - 1);
    this.grid.lineStyle(1, 0xffffff, 0.28);
    for(let row=0;row<Math.ceil(this.mapHeight/TILE);row++)for(let col=0;col<Math.ceil(this.mapWidth/TILE);col++){
      if(this.indoor?homeCellAllowed(col,row):isDecorTile(col,row))this.grid.strokeRect(col*TILE,row*TILE,TILE,TILE);
    }
    this.hint = this.add.graphics().setDepth(DRAG_DEPTH - 1);
  }

  private frameDecorate():void {
    const cam=this.cameras.main;
    const b=this.indoor?{x:0,y:0,width:this.mapWidth,height:this.mapHeight}:GARDEN_DECOR_BOUNDS;
    cam.stopFollow().removeBounds().setViewport(0,88,this.scale.width,this.scale.height-88);
    cam.setZoom(Math.min(cam.width/(b.width+64),cam.height/(b.height+48)));
    cam.centerOn(b.x+b.width/2,b.y+b.height/2);
  }

  private exitDecorate(): void {
    this.decorating = false;
    this.redrawLayout();
    this.dragId = null;
    this.cancelPlacing();
    this.cancelSeedPick();
    this.grid?.destroy();
    this.decorShade?.destroy();this.decorShade=undefined;
    this.hint?.destroy();
    const cam = this.cameras.main;
    cam.setViewport(0,0,this.scale.width,this.scale.height);
    cam.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.applyZoom(this.viewZoom);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
  }

  /** 씨앗을 심을 곳 고르기: 빈 두둑을 밝게 보여 주고, 누른 곳에 심는다. 터치에서도 보이도록 포인터를 따라다니지 않는다. */
  private startSeedPick(seedId: string, tree: boolean): void {
    if (!this.decorating || this.indoor) return;
    this.seedPick = seedId;
    this.seedPickTree = tree;
    this.moundHint = this.add.graphics().setDepth(DRAG_DEPTH - 1);
    this.moundHint.fillStyle(0x7dff7d, 0.55);
    if (tree) {
      // 나무는 마당 칸에 심는다. 꾸미기처럼 정원 전체를 보여 준다.
      for (let row = 0; row < Math.ceil(this.mapHeight / TILE); row++) {
        for (let col = 0; col < COLS; col++) {
          if (this.canPlace(col, row, '', 'decor', true)) this.moundHint.fillRect(col * TILE + 2, row * TILE + 2, TILE - 4, TILE - 4);
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
      if (at && this.canPlace(col, row, '', 'plant')) this.moundHint.fillEllipse(at.x, at.y - 8, 40, 20);
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
    if (!seedId || !this.canPlace(cell.col, cell.row, '', spot, this.seedPickTree)) return;
    let planted: PlantedItem | null = null;
    editLayout((d) => {
      planted = plantSeed(d, seedId, todayKey(), cell);
    });
    if (planted) events.emit('seed-planted', { planted });
  }

  /** 창고에서 꺼낸 것(소품·식물): 포인터를 따라다니다 칸을 짚으면 심긴다. 취소해도 창고에 그대로 남는다. */
  private startPlacing(item: StoredThing): void {
    if (!this.decorating || (this.indoor && item.type !== 'decor')) return;
    this.cancelPlacing();
    this.placing = item;
    const texture = item.type === 'decor' ? decorTexture({ kind: item.decorKind, variant: item.variant }) : this.plantLook(item.plantId, item.date).key;
    const cam = this.cameras.main;
    this.placingSprite = this.add
      .image(cam.worldView.centerX, cam.worldView.centerY, texture)
      .setOrigin(0.5, 1)
      .setAlpha(0.85)
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
    const ok = this.canPlace(col, row, '', spot, item.type === 'plant' && isTree(item.plantId));
    if (!ok) return;
    let placed: DecorItem | PlantedItem | null = null;
    editLayout((d) => {
      placed = this.indoor ? placeHomeFurniture(d, item.id, col, row) : takeFromStorage(d, item.id, { col, row });
    });
    this.cancelPlacing();
    this.hint?.clear();
    if (placed) {
      if (item.type === 'decor') this.placeDecor(placed as DecorItem, true);
      else this.placePlant(placed as PlantedItem, true);
      events.emit('decor-changed', { action: 'placed' });
    }
  }

  private isTreeId(id: string): boolean {
    const plant = this.state.garden.plants.find((p) => p.id === id);
    return !!plant && isTree(plant.plantId);
  }

  /** 놓을 자리의 종류: 소품과 수확한 꽃은 마당 칸, 키우는 식물은 두둑. */
  private spotOf(thing: StoredThing): 'decor' | 'plant' {
    return thing.type === 'plant' && placeZone(thing) === 'field' ? 'plant' : 'decor';
  }

  /** 포인터가 가리키는 칸. 식물은 밭의 가장 가까운 두둑(없으면 -1), 소품은 마당 칸. */
  private cellAt(p: Phaser.Input.Pointer, kind: 'decor' | 'plant'): { col: number; row: number } {
    if (kind === 'plant') return nearestSlot(p.worldX, p.worldY, 34) ?? { col: -1, row: -1 };
    return { col: Math.floor(p.worldX / TILE), row: Math.floor(p.worldY / TILE) };
  }

  /** 놓을 수 있는지 초록·빨강으로 보여 주는 표시 */
  private showHint(col: number, row: number, ok: boolean, kind: 'decor' | 'plant'): void {
    if (!this.hint) return;
    this.hint.clear();
    this.hint.fillStyle(ok ? 0x7dff7d : 0xff7d7d, 0.45);
    const slot = kind === 'plant' ? slotWorld(col, row) : null;
    if (slot) this.hint.fillEllipse(slot.x, slot.y - 8, 40, 20);
    else if (kind === 'decor') this.hint.fillRect(col * TILE, row * TILE, TILE, TILE);
  }

  /** 소품·식물 모두: 마당 안의 빈 칸이면 어디든(자기 자신이 있던 칸은 비어 있는 것으로 본다). */
  private canPlace(col: number, row: number, exceptId: string, kind: 'decor' | 'plant', tree = false): boolean {
    if (!this.indoor && districtReserved(col * TILE + 16, (row + 1) * TILE)) return false;
    if (this.indoor) return kind === 'decor' && homeCellAllowed(col, row)
      && !this.items.some(i => i.id !== exceptId && Math.abs(i.col - col) < 2 && Math.abs(i.row - row) < 2)
      && Math.hypot(col * TILE + 16 - this.player.x, (row + 1) * TILE - this.player.y) > 36;
    const { items, plants } = this.state.garden;
    if (tree && !treeRoomAt(col, row, plants.filter((p) => p.id !== exceptId && isTree(p.plantId)))) return false;
    // 식물은 밭 안에서만, 소품은 밭 밖 마당에서만 놓는다.
    const where = kind === 'plant' ? isFieldTile(col, row) : isDecorTile(col, row);
    return (
      where &&
      !items.some((i) => i.id !== exceptId && i.col === col && i.row === row) &&
      !plants.some((p) => p.id !== exceptId && p.col === col && p.row === row)
    );
  }

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
    let best: { id: string; kind: 'decor' | 'plant'; d: number } | null = null;
    for (const item of this.items) {
      const img = this.decorSprites.get(item.id);
      if (this.indoor) {
        // 선반처럼 키가 큰 가구도 그림 중앙에서 잡을 수 있어야 한다.
        if (img?.getBounds().contains(p.worldX, p.worldY)) {
          const d = -img.depth;
          if (!best || d < best.d) best = { id: item.id, kind: 'decor', d };
        }
      } else {
        const d = Math.hypot(p.worldX - (item.col * TILE + TILE / 2), p.worldY - (item.row * TILE + TILE / 2));
        if (d <= TILE * 1.1 && (!best || d < best.d)) best = { id: item.id, kind: 'decor', d };
      }
    }
    for (const plant of this.indoor ? [] : this.state.garden.plants) {
      const pos = this.plantXY(plant);
      const d = Math.hypot(p.worldX - pos.x, p.worldY - (pos.y - 14));
      if (d <= 26 && (!best || d < best.d)) best = { id: plant.id, kind: 'plant', d };
    }
    if (!best) {
      if (!this.indoor && inBed(p.worldX, p.worldY)) {
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
    const dragged = this.state.garden.plants.find((pl) => pl.id === best.id);
    this.dragSpot = best.kind === 'plant' && dragged && placeZone(dragged) === 'field' ? 'plant' : 'decor';
    this.dragStart = { x: p.worldX, y: p.worldY };
    const sprites = best.kind === 'decor' ? this.decorSprites : this.plantSprites;
    const img = sprites.get(best.id);
    if (img) this.furnitureGrab = { x: p.worldX - img.x, y: p.worldY - img.y };
    sprites.get(best.id)?.setDepth(DRAG_DEPTH).setAlpha(0.85);
  }

  private onDragMove(p: Phaser.Input.Pointer): void {
    if (!this.hint) return;
    if (this.placing) {
      this.placingSprite?.setPosition(p.worldX, p.worldY + TILE / 2);
      const spot = this.spotOf(this.placing);
      const { col, row } = this.cellAt(p, spot);
      this.showHint(col, row, this.canPlace(col, row, '', spot, this.placing.type === 'plant' && isTree(this.placing.plantId)), spot);
      return;
    }
    if (!this.dragId || !this.dragKind) return;
    if (this.dragKind === 'bed') {
      setBedPos(Math.round((p.worldX - this.bedGrab.x) / 8) * 8, Math.round((p.worldY - this.bedGrab.y) / 8) * 8);
      this.syncBed();
      const ok = bedFits(BED.x, BED.y, this.bedAvoid());
      this.hint.clear();
      this.hint.lineStyle(3, ok ? 0x7dff7d : 0xff7d7d, 0.9);
      this.hint.strokeRect(BED.x, BED.y, BED.w, BED.h);
      return;
    }
    const sprites = this.dragKind === 'decor' ? this.decorSprites : this.plantSprites;
    const img = sprites.get(this.dragId);
    img?.setPosition(this.indoor ? p.worldX - this.furnitureGrab.x : p.worldX, this.indoor ? p.worldY - this.furnitureGrab.y : p.worldY + TILE / 2);
    const { col, row } = this.indoor && img ? { col: Math.floor(img.x / TILE), row: Math.floor((img.y - 1) / TILE) } : this.cellAt(p, this.dragSpot);
    this.showHint(col, row, this.canPlace(col, row, this.dragId, this.dragSpot, this.isTreeId(this.dragId)), this.dragSpot);
  }

  private cancelUiPointer():void {
    for(const pointer of this.input.manager.pointers)if(pointer.isDown)pointer.reset();
    if(!this.dragId)return;
    const bed=this.dragKind==='bed';
    this.dragId=null;this.dragKind=null;this.hint?.clear();
    if(bed){setBedPos(this.bedFrom.x,this.bedFrom.y);this.bedImg?.setAlpha(1);this.syncBed();}
    else this.redrawLayout();
  }

  /** 끌지 않고 짚기만 했으면 창고로 치우기, 옮겼으면 그 칸에(안 되면 원래 자리에) 놓기. */
  private onDragEnd(p: Phaser.Input.Pointer): void {
    const id = this.dragId;
    const kind = this.dragKind;
    if (!id || !kind) return;
    this.dragId = null;
    this.dragKind = null;
    this.hint?.clear();

    if (kind === 'bed') {
      this.bedImg?.setAlpha(1);
      if (bedFits(BED.x, BED.y, this.bedAvoid())) {
        const { x, y } = BED;
        editLayout((d) => {
          d.garden.bed = { x, y };
        });
        events.emit('decor-changed', { action: 'placed' });
      } else {
        setBedPos(this.bedFrom.x, this.bedFrom.y); // 놓을 수 없는 곳이면 원래 자리로
        this.syncBed();
      }
      return;
    }

    const isDecor = kind === 'decor';
    const subject = isDecor
      ? this.items.find((i) => i.id === id)
      : this.state.garden.plants.find((p) => p.id === id);
    const sprites = isDecor ? this.decorSprites : this.plantSprites;
    const img = sprites.get(id);
    if (!subject || !img) return;

    const moved = Math.hypot(p.worldX - this.dragStart.x, p.worldY - this.dragStart.y);
    if (moved < TAP_THRESHOLD) {
      editLayout((d) => (isDecor ? this.indoor ? storeHomeFurniture(d, id) : storeDecor(d, id) : storePlant(d, id)));
      sprites.delete(id);
      img.destroy();
      events.emit('decor-changed', { action: 'stored' });
      return;
    }

    let { col, row } = this.indoor && isDecor ? { col: Math.floor(img.x / TILE), row: Math.floor((img.y - 1) / TILE) } : this.cellAt(p, this.dragSpot);
    const canGo = this.canPlace(col, row, id, this.dragSpot, this.isTreeId(id));
    if (canGo) {
      editLayout((d) => {
        const target = isDecor ? furnitureOf(d, this.indoor).find((i) => i.id === id) : d.garden.plants.find((pl) => pl.id === id);
        if (this.indoor && isDecor) moveHomeFurniture(d, id, col, row);
        else { target!.col = col; target!.row = row; }
      });
    } else {
      ({ col, row } = subject); // 놓을 수 없는 곳이면 원래 자리로
    }
    const to = isDecor ? { x: col * TILE + TILE / 2, y: (row + 1) * TILE } : this.plantXY({ col, row });
    img.setAlpha(1).setDepth(isDecor ? (row + 1) * TILE : to.y);
    this.tweens.add({ targets: img, x: to.x, y: to.y, duration: 120 });
  }
}
