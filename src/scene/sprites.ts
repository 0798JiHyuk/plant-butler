// 새싹이: 올려 준 새 기준 그림(굵은 갈색 윤곽, 올리브 잎)에서 잘라 낸 포즈와 걷기 프레임. 72px 키, 90×90 캔버스, 발이 아래에서 2px 위.
// 원본 시트는 art/source/sprout2-*.webp, 자르는 방법은 tools/slice_art.py.
// 걷기는 앞·뒤·옆(오른쪽) 4프레임씩이고, 왼쪽은 옆모습을 좌우로 뒤집어 쓴다.

export type StaticPose = 'idle' | 'joy' | 'rest' | 'back' | 'sit' | 'lie';
export type WalkDir = 'front' | 'back' | 'side';

export const STATIC_POSES: StaticPose[] = ['idle', 'joy', 'rest', 'back', 'sit', 'lie'];
export const JUMP_FRAMES = ['jump1', 'jump2', 'jump3', 'jump4'] as const;
export const WALK_FRAMES = [1, 2, 3, 4] as const;
export type SproutPose = StaticPose | (typeof JUMP_FRAMES)[number];

/** 텍스처 키 목록(불러오기용) */
export const SPROUT_TEXTURES: string[] = [
  ...STATIC_POSES,
  ...JUMP_FRAMES,
  ...(['front', 'back', 'side'] as const).flatMap((d) => WALK_FRAMES.map((n) => `walk_${d}${n}`)),
];

export const SPROUT_ORIGIN_Y = 88 / 90;

export function sproutUrl(texture: string): string {
  return `${import.meta.env.BASE_URL}assets/garden/sprout2/${texture}.png`;
}
