import Phaser from 'phaser';
import { CAFE, CAFE_SEATS, CAFE_TABLES, cafeWalkable, type CafeMember } from '../core/cafe';
import { events } from '../core/events';
import { withinReach } from '../core/interaction';
import { isTree } from '../core/plants';
import type { SharedGarden } from '../core/sharedGarden';
import { GARDEN_DECOR_BOUNDS } from '../core/worldGeometry';
import { inGardenRegion } from '../core/worldTerrain';
import { auth } from '../lib/auth';
import { CafeConnection } from '../lib/cafe';
import { Player } from './Player';
import { DEFAULT_BED, slotWorldAt } from './map';
import { drawMeadow } from './worldBackground';

interface Peer { sprite:Phaser.GameObjects.Sprite; label:Phaser.GameObjects.Text; row:CafeMember }
/** A separate scene: visiting never replaces, restores or writes the owner's store. */
export class SocialScene extends Phaser.Scene {
  private epoch=0;
  private mode:'cafe'|'visit'='cafe';
  private garden?:SharedGarden;
  private player!:Player;
  private keys!:Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!:Record<'W'|'A'|'S'|'D',Phaser.Input.Keyboard.Key>;
  private stick={x:0,y:0};
  private locked=false;
  private seat:string|null=null;
  private seating=false;
  private connection?:CafeConnection;
  private peers=new Map<string,Peer>();
  private connectionStatus:'connecting'|'online'|'error'|'replaced'='connecting';
  private count=0;
  constructor(){super('social');}
  init(data:{garden?:SharedGarden}={}){this.garden=data.garden;this.mode=data.garden?'visit':'cafe';}
  preload():void {
    const base=import.meta.env.BASE_URL;
    if(!this.textures.exists('cafe_room'))this.load.image('cafe_room',`${base}assets/garden/cafe/interior.webp`);
    if(!this.textures.exists('cafe_chair'))this.load.image('cafe_chair',`${base}assets/garden/cafe/chair.png`);
  }
  create():void {
    this.epoch++;
    this.locked=false;this.seat=null;this.seating=false;this.stick={x:0,y:0};this.peers.clear();this.count=0;this.connectionStatus='connecting';
    events.emit('social-location',{location:this.mode,name:this.garden?.name});
    if(this.mode==='cafe')this.drawCafe();else this.drawVisit(this.garden!);
    const spawn=this.mode==='cafe'?CAFE.spawn:{x:896,y:2700};
    this.player=new Player(this,spawn.x,spawn.y,(x,y)=>this.mode==='cafe'?!cafeWalkable(x,y):!inGardenRegion(x,y));
    const cam=this.cameras.main;
    if(this.mode==='cafe')cam.setBounds(0,0,CAFE.width,CAFE.height).setZoom(.8);
    else {const b=GARDEN_DECOR_BOUNDS;cam.setBounds(b.x,b.y,b.width,b.height).setZoom(Math.max(cam.width/b.width,cam.height/b.height));}
    cam.startFollow(this.player.sprite,true,.12,.12).setRoundPixels(true);
    const kb=this.input.keyboard!;this.keys=kb.createCursorKeys();this.wasd=kb.addKeys('W,A,S,D') as typeof this.wasd;
    const offs=[
      events.on('move-input',v=>{this.stick=v;}),
      events.on('ui-lock',({locked})=>{this.locked=locked;this.stick={x:0,y:0};kb.enabled=!locked;kb.resetKeys();}),
      events.on('cafe-stand',()=>{void this.changeSeat(null);}),
      events.on('social-travel',({destination,garden})=>{
        if(destination==='garden')this.scene.start('garden',{fromCafe:true});
        else this.scene.restart(destination==='visit'?{garden}:{});
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{offs.forEach(off=>off());this.connection?.stop();this.connection=undefined;});
    if(this.mode==='cafe'){
      this.connection=new CafeConnection((members,status)=>{
        if(!this.scene.isActive())return;
        this.connectionStatus=status;this.count=members.length;this.syncPeers(members);this.reportStatus();
      });
      this.reportStatus();void this.connection.start();
    }
  }
  private reportStatus(){events.emit('cafe-state',{status:this.connectionStatus,count:this.count,seated:!!this.seat});}
  private drawCafe():void {
    this.textures.get('cafe_room').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.image(0,0,'cafe_room').setOrigin(0).setDisplaySize(CAFE.width,CAFE.height);
    for(const table of CAFE_TABLES)this.add.image(table.x,table.y,'decor_table').setOrigin(.5,1).setDisplaySize(190,150).setDepth(table.y);
    for(const seat of CAFE_SEATS)this.add.image(seat.x,seat.y,'cafe_chair').setOrigin(.5,1).setDepth(seat.y)
      .setInteractive({useHandCursor:true}).on('pointerdown',()=>{void this.changeSeat(seat.id);});
  }
  private async changeSeat(id:string|null):Promise<void> {
    if(this.mode!=='cafe'||this.locked||this.seating)return;
    const target=CAFE_SEATS.find(s=>s.id===id);
    if(id&&(!target||!withinReach(this.player,target))){events.emit('interaction-too-far',{});return;}
    if(!id&&!this.seat)return;
    const old=CAFE_SEATS.find(s=>s.id===this.seat);
    const at=target??{x:old?.x??this.player.x,y:(old?.y??this.player.y)+45};
    const epoch=this.epoch;
    this.seating=true;
    const result=await this.connection?.seat(id,at.x,at.y);
    if(!this.scene.isActive()||epoch!==this.epoch)return;
    this.seating=false;
    if(result!=='ok'){events.emit('cafe-notice',{kind:result==='occupied'?'occupied':'error'});return;}
    this.seat=id;this.player.sprite.setPosition(at.x,at.y-(id?42:0));
    if(id)this.player.restOnFurniture('sit',at.y+2);else this.player.setPose('idle');
    this.reportStatus();
  }
  private syncPeers(rows:CafeMember[]):void {
    const remote=rows.filter(r=>r.user_id!==auth.getSnapshot().userId),ids=new Set(remote.map(r=>r.user_id));
    for(const [id,peer] of this.peers)if(!ids.has(id)){peer.sprite.destroy();peer.label.destroy();this.peers.delete(id);}
    for(const row of remote){
      const old=this.peers.get(row.user_id);if(old){old.row=row;old.label.setText(row.garden_name);continue;}
      const sprite=this.add.sprite(row.x,row.y,'sprout_idle').setOrigin(.5,88/90).setTint(0xe6efdb).setInteractive({useHandCursor:true});
      const label=this.add.text(row.x,row.y-92,row.garden_name,{fontFamily:'sans-serif',fontSize:'17px',color:'#49382b',backgroundColor:'#fff8e8',padding:{x:8,y:4}}).setOrigin(.5,1);
      const peer={sprite,label,row};this.peers.set(row.user_id,peer);
      sprite.on('pointerdown',()=>{
        if(this.locked)return;
        if(withinReach(this.player,peer.row))events.emit('cafe-person',{member:peer.row});
        else events.emit('interaction-too-far',{});
      });
    }
  }
  private drawVisit(g:SharedGarden):void {
    drawMeadow(this);
    this.add.image(g.bed.x,g.bed.y,'garden_field').setOrigin(0).setDisplaySize(DEFAULT_BED.w,DEFAULT_BED.h).setDepth(g.bed.y);
    const legacy:Record<string,string>={flower:'flowerpot',pot:'flowerpot',lamp:'table'};
    for(const item of g.items){const x=item.col*32+16,y=(item.row+1)*32;
      this.add.image(x,y,`decor_${legacy[item.kind]??item.kind}`).setOrigin(.5,1).setDepth(y);
    }
    for(const p of g.plants){
      const slot=slotWorldAt(p.col,p.row,g.bed),at=slot??{x:p.col*32+16,y:(p.row+1)*32+28};
      const key=p.stage==='seed'?(slot?'plant_field_planted':'plant_planted'):p.stage==='sprout'?'plant_sprout':p.stage==='young'?'plant_tree_young':isTree(p.plantId)&&p.harvested?'plant_tree_grown':`plant_${p.plantId}`;
      const size=(isTree(p.plantId)&&p.stage==='bloom'?120:p.stage==='young'?84:44)*(slot?.8:1);
      this.add.image(at.x,at.y,key).setOrigin(.5,1).setDisplaySize(size,size).setDepth(at.y);
    }
  }
  update(_time:number,delta:number):void {
    if(!this.player)return;
    const k=this.keys,w=this.wasd;
    let x=Number(k.right.isDown||w.D.isDown)-Number(k.left.isDown||w.A.isDown),y=Number(k.down.isDown||w.S.isDown)-Number(k.up.isDown||w.W.isDown);
    if(!x&&!y)({x,y}=this.stick);
    if(this.locked||this.seating||this.seat)x=y=0;
    const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
    this.player.move(x,y,Math.min(delta,50));
    if(!this.seat&&!this.seating)this.connection?.move(this.player.x,this.player.y);
    for(const peer of this.peers.values()){
      const r=peer.row,s=peer.sprite,ty=r.y-(r.seat_id?42:0),dx=r.x-s.x,dy=ty-s.y,moving=Math.hypot(dx,dy)>2;
      s.x+=dx*Math.min(1,delta/150);s.y+=dy*Math.min(1,delta/150);
      if(r.seat_id){s.anims.stop();s.setTexture('sprout_sit').setFlipX(false);}
      else if(moving){const dir=Math.abs(dx)>Math.abs(dy)?'side':dy<0?'back':'front';s.play(`sprout-walk-${dir}`,true).setFlipX(dir==='side'&&dx<0);}
      else{s.anims.stop();s.setTexture('sprout_idle').setFlipX(false);}
      s.setDepth(r.y+2);peer.label.setPosition(s.x,s.y-85).setDepth(r.y+3);
    }
  }
}
