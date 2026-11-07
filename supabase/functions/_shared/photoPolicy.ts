/** 사진으로 관찰할 범위만 정의한다. 실제 수행·시간·인격을 평가하지 않는다. */
export const photoPolicies: Record<string, { criterion: string }> = {
  cafe: { criterion: 'A cafe storefront/sign or a cafe interior with recognizable cafe context. A cup alone is insufficient.' },
  meal: { criterion: 'A prepared meal or food ready to eat. Do not infer whether it was eaten or its temperature.' },
  draw: { criterion: 'A drawing, doodle or sketch on a surface. Do not assess skill or infer time spent.' },
  'water-plant': { criterion: 'A real potted plant with visible watering action, such as water being poured onto its soil. A plant alone is insufficient.' },
  sunlight: { criterion: 'A real potted plant placed near a window or in a visibly bright naturally lit position. Do not infer that it was moved.' },
};

export const PHOTO_MAX_BYTES = 600_000;
export type PhotoVerdict = 'matched' | 'not_matched' | 'uncertain';
export function photoPolicy(id: string | undefined) {
  return id && Object.prototype.hasOwnProperty.call(photoPolicies, id) ? photoPolicies[id] : undefined;
}
export function parsePhotoVerdict(value: unknown): PhotoVerdict | null {
  if (!value || typeof value !== 'object' || !('status' in value)) return null;
  return value.status === 'matched' || value.status === 'not_matched' || value.status === 'uncertain' ? value.status : null;
}
