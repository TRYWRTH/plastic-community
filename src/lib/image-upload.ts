import { supabase } from "@/integrations/supabase/client";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const BUCKET = "event-images";

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/**
 * Resizes/re-encodes an image client-side (caps the long edge at 1600px,
 * re-encodes as JPEG) before uploading it to the user's own folder in the
 * event-images bucket, so a single photo from a phone camera doesn't ship
 * multiple megabytes over the wire. Returns the public URL.
 */
export async function uploadEventImage(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  const blob = await resizeImage(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Best-effort cleanup — failures here shouldn't block the caller's flow. */
export async function deleteEventImage(publicUrl: string) {
  const marker = `/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // non-critical — an orphaned object in storage isn't a user-facing problem
  }
}
