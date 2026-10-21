// Profile-photo rules shared by the upload route and the browser. No server imports here.

/** Hard limit, enforced by the upload route and by the Storage bucket itself. */
export const MAX_AVATAR_BYTES = 512 * 1024;

/** Biggest photo a member can pick; it is shrunk before upload, so this only stops silly files. */
export const MAX_AVATAR_SOURCE_BYTES = 10 * 1024 * 1024;

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

/** The square the member framed, in pixels of the original photo (from react-easy-crop). */
export type CropArea = { x: number; y: number; width: number; height: number };

/** Checks the picked file's size; throws a message fit for a toast. */
export function checkAvatarSource(file: File): void {
  if (file.size > MAX_AVATAR_SOURCE_BYTES) throw new Error("Photo must be 10 MB or smaller");
}

/** Cuts the framed square out of the photo and re-encodes it as a small JPEG. */
export async function cropAvatar(file: File, area: CropArea): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(AVATAR_SIZE, Math.round(area.width));
  canvas
    .getContext("2d")!
    .drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Couldn't read that photo");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}
