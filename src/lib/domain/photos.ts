/** Longest edge after downscale. Keeps each photo ≈60–120 KB so localStorage (~5 MB) lasts. */
const MAX_EDGE_PX = 800;
const JPEG_QUALITY = 0.72;

/**
 * Downscale an uploaded image in the browser and return a JPEG data URL.
 * Keep this even if photos move to the backend/S3 later — it saves bandwidth on factory networks.
 */
export function fileToJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) return reject(new Error("canvas unavailable"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`could not read ${file.name}`));
    };
    img.src = url;
  });
}

/** Only allow http(s) and data:image URLs as photo sources. */
export function isSafeImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^data:image\//i.test(url);
}
