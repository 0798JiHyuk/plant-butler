import Phaser from 'phaser';
import { copy } from '../core/copy';
import { WORLD_SIZE } from '../core/worldGeometry';
import { WORLD_TILES } from '../core/worldTiles';

/** Four lossless source crops; smooth only the painted background, keeping sprites crisp. */
export function drawMeadow(scene: Phaser.Scene): void {
  for(const tile of WORLD_TILES){
    scene.textures.get(tile.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(tile.x,tile.y,tile.key).setOrigin(0,0).setDisplaySize(tile.width,tile.height).setDepth(0);
  }
}

export function drawHome(scene: Phaser.Scene): void {
  scene.add.image(0, 0, 'home_background').setOrigin(0, 0).setDepth(0);
  scene.add.text(WORLD_SIZE.interiorWidth / 2, 178, copy.world.home, { fontFamily: 'sans-serif', fontSize: '18px', color: '#63452b' }).setOrigin(0.5);
}
