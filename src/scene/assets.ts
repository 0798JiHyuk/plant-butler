// 그래픽의 유일한 출입구. 배경·새싹이·소품은 public/assets/garden 의 PNG/WebP를 불러온다.
// 주민은 public/assets/garden/npc, 도감 식물은 public/assets/plants. 모두 tools/slice_art.py 가 art 폴더에서 잘라 만든다.
import Phaser from 'phaser';
import { plants } from '../core/plants';
import { SPROUT_TEXTURES, sproutUrl } from './sprites';

const base = import.meta.env.BASE_URL;

export const NPC_IDS = ['nuri', 'moru', 'pio'] as const;
export const NPC_POSES = ['front', 'side', 'walk', 'back'] as const;
export const npcUrl = (id: string, pose: string) => `${base}assets/garden/npc/${id}_${pose}.png`;

export const DECOR_KINDS = ['flowerpot', 'table', 'shelf', 'bench', 'birdbath', 'hammock'] as const;

export function preloadAssets(scene: Phaser.Scene): void {
  scene.load.image('garden_background', `${base}assets/garden/background.webp`);
  scene.load.image('garden_field', `${base}assets/garden/field.png`);
  for (const t of SPROUT_TEXTURES) scene.load.image(`sprout_${t}`, sproutUrl(t));
  for (const kind of DECOR_KINDS) scene.load.image(`decor_${kind}`, `${base}assets/garden/props/${kind}.png`);
  for (const p of plants) scene.load.image(`plant_${p.id}`, `${base}assets/plants/${p.id}.png`);
  scene.load.image('plant_tree_young', `${base}assets/plants/tree_young.png`);
  scene.load.image('plant_tree_grown', `${base}assets/plants/tree_grown.png`);
  scene.load.image('plant_planted', `${base}assets/plants/planted.png`);
  scene.load.image('plant_seed', `${base}assets/icons-ui/seed.png`);
  scene.load.image('plant_sprout', `${base}assets/icons-ui/seedling.png`);
  scene.load.image('plant_bud', `${base}assets/icons-ui/bud.png`);
  scene.load.image('fruit_mark', `${base}assets/icons-ui/fruit.png`);
  scene.load.image('npc_mark', `${base}assets/icons-ui/talk.png`); // 그날 열린 이야기가 있는 주민 머리 위
  for (const id of NPC_IDS) for (const pose of NPC_POSES) scene.load.image(`npc_${id}_${pose}`, npcUrl(id, pose));
}
