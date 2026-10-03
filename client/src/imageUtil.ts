// Phone photos are often several MB (and sometimes HEIC), which is more than
// the photo analysis needs and over Claude's per-image limit. Re-encode a
// smaller JPEG copy just for analysis - the original files are still what
// gets attached to the event.
const MAX_EDGE = 1568;

export async function downscaleForAnalysis(file: File): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } catch {
    // The browser can't decode this format (e.g. HEIC outside Safari)
    return null;
  }
}
