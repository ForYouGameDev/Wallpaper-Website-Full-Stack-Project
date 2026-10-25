// Browser-side image pipeline used by the admin uploader.
// Output: thumbnail (~240px), preview (~500px), watermarked preview (~500px). The original is uploaded untouched.
// Limitations: runs on the admin's device (very large images, e.g. >60 MP, can exhaust phone memory);
// WebP encoding needs a modern browser; EXIF orientation is applied by createImageBitmap.

export type Processed = {
  width: number; height: number;
  thumb: Blob; preview: Blob; watermark: Blob;
};

async function resize(src: ImageBitmap, targetW: number): Promise<HTMLCanvasElement> {
  const w = Math.min(targetW, src.width);
  const h = Math.round((src.height * w) / src.width);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode image'))), 'image/webp', q));

function drawWatermark(c: HTMLCanvasElement, label: string) {
  const ctx = c.getContext('2d')!;
  ctx.save();
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(-Math.PI / 6);
  const size = Math.max(14, Math.round(c.width / 14));
  ctx.font = `700 ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = Math.max(1, size / 16);
  const diag = Math.hypot(c.width, c.height);
  for (let y = -diag / 2; y < diag / 2; y += size * 3) {
    for (let x = -diag / 2; x < diag / 2; x += size * label.length * 0.7 + size * 2) {
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    }
  }
  ctx.restore();
}

export async function processImage(file: File, watermarkLabel: string): Promise<Processed> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Only JPEG, PNG or WebP images are supported.');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const thumbC = await resize(bmp, 240);
    const prevC = await resize(bmp, 500);
    const wmC = await resize(bmp, 500);
    drawWatermark(wmC, watermarkLabel);
    const [thumb, preview, watermark] = await Promise.all([toBlob(thumbC, 0.72), toBlob(prevC, 0.8), toBlob(wmC, 0.8)]);
    return { width: bmp.width, height: bmp.height, thumb, preview, watermark };
  } finally {
    bmp.close();
  }
}

export function extOf(file: File): string {
  return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
}
