function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = url;
  });
}

export function isLikelyImage(file: File): boolean {
  if (/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

export async function compressAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare that photo.");
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.fillStyle = "#f6f1ea";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
