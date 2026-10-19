// Top-up receipt rules shared by the upload route, the server functions and the
// browser. No server imports here.

/** Hard limit, enforced by the upload route and by the Storage bucket itself. */
export const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;

/** Receipts are kept this long after the top-up was requested, then deleted. */
export const RECEIPT_RETENTION_DAYS = 60;

/** Accepted image types and the extension each is stored under. */
export const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/**
 * Receipts are stored privately as `<userId>/<timestamp>.<ext>` and the top-up keeps
 * that path, not a URL. True only for a path the upload route could have made for
 * this user, so nobody can attach someone else's file or an outside link.
 */
export function isOwnReceiptPath(path: string, userId: string): boolean {
  const [owner, file, ...rest] = path.split("/");
  return (
    rest.length === 0 &&
    owner === userId &&
    new RegExp(`^\\d+\\.(${Object.values(RECEIPT_TYPES).join("|")})$`).test(file ?? "")
  );
}

/**
 * Phone photos are often over the limit, so shrink big images in the browser before
 * uploading: longest side 2000px, JPEG. Returns the file unchanged when it already
 * fits or the browser can't decode it (the server still enforces the limit).
 */
export async function shrinkReceipt(file: File): Promise<File> {
  if (file.size <= MAX_RECEIPT_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    for (const quality of [0.85, 0.7, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= MAX_RECEIPT_BYTES) {
        return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
  } catch {
    // Undecodable here (e.g. HEIC in Chrome): let the server reject it if too big
  }
  return file;
}
