import Phaser from 'phaser';
import { PIO_SEEDS } from '../core/pioSeeds';

/** Code-drawn UI icon stays crisp at any zoom and needs no new raster art. */
export function pioSeedMarker(scene:Phaser.Scene):Phaser.GameObjects.Image {
  const key='pio_hidden_seed_hint';
  if(!scene.textures.exists(key)){
    const g=scene.add.graphics();
    g.fillStyle(0x3e4e2d,.18).fillEllipse(22,59,28,7);
    g.fillStyle(0xfff5d9).fillTriangle(14,40,30,40,22,53);
    g.lineStyle(3,0x856844).strokeTriangle(14,40,30,40,22,53);
    g.fillStyle(0xfff5d9).fillRoundedRect(4,3,36,42,13);
    g.lineStyle(3,0x856844).strokeRoundedRect(4,3,36,42,13);
    g.fillStyle(0xe8b94e).fillRoundedRect(18,11,8,20,4).fillCircle(22,36,4);
    g.generateTexture(key,44,64);g.destroy();
  }
  return scene.add.image(PIO_SEEDS.x,PIO_SEEDS.y,key).setOrigin(.5,1).setDepth(PIO_SEEDS.y+1);
}
