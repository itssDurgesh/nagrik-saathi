// Browser-only helpers: shrink a photo to a model-friendly JPEG plus a small thumbnail for the AMC record.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = src;
  });
}

function toJpeg(img: HTMLImageElement, max: number, quality: number) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.round((img.naturalWidth || img.width) * scale);
  const h = Math.round((img.naturalHeight || img.height) * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  g.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function preparePhoto(src: string) {
  const img = await loadImage(src);
  return { full: toJpeg(img, 1024, 0.85), thumb: toJpeg(img, 320, 0.7) };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
