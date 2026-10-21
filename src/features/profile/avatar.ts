// Profile-photo rules shared by the upload route and the browser. No server imports here.

/** Hard limit, enforced by the upload route and by the Storage bucket itself. */
export const MAX_AVATAR_BYTES = 512 * 1024;

/** The browser shrinks every photo to a square this many pixels wide before upload. */
export const AVATAR_SIZE = 256;

/** Custom photos live in the public `avatars` bucket; Google's are on googleusercontent. */
export const AVATAR_BUCKET = "avatars";

/**
 * True when the picture is one the member uploaded. The Google sign-in sync leaves
 * these alone, so a chosen photo isn't replaced the next time they log in.
 */
export function isCustomAvatar(image: string | null | undefined): boolean {
  return !!image && image.includes(`/${AVATAR_BUCKET}/`);
}

/** Centre-crops to a square and re-encodes as a small JPEG. Throws if the browser can't decode it. */
export async function prepareAvatar(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(AVATAR_SIZE, side);
  canvas
    .getContext("2d")!
    .drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Couldn't read that photo");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}
