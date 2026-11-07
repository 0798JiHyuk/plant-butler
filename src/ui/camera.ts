import { PHOTO_MAX_BYTES } from '@/core/photoCheck';

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach(track => track.stop());
}

/** Canvas re-encoding strips camera metadata; no image enters the game store. */
export function cameraFrame(video: HTMLVideoElement): string {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) throw new Error('Camera not ready');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.8, 0.65, 0.5]) {
    const image = canvas.toDataURL('image/jpeg', quality);
    if (image.startsWith('data:image/jpeg;base64,') && image.length <= PHOTO_MAX_BYTES / 3 * 4) return image;
  }
  throw new Error('Image too large');
}
