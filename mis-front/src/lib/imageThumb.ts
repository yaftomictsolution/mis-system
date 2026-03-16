"use client";

const THUMB_SIZE = 96;
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"];

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function isImageFile(file: File | Blob | null | undefined): boolean {
  if (!file) return false;
  const mime = String(file.type ?? "").toLowerCase();
  if (mime.startsWith("image/")) return true;

  if (file instanceof File) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    return IMAGE_EXTENSIONS.includes(extension);
  }

  return false;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

function renderThumbnail(image: HTMLImageElement): string | null {
  if (!isBrowser()) return null;

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;

  const context = canvas.getContext("2d");
  if (!context) return null;

  const sourceWidth = image.naturalWidth || image.width || THUMB_SIZE;
  const sourceHeight = image.naturalHeight || image.height || THUMB_SIZE;
  const scale = Math.max(THUMB_SIZE / sourceWidth, THUMB_SIZE / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (THUMB_SIZE - drawWidth) / 2;
  const offsetY = (THUMB_SIZE - drawHeight) / 2;

  context.fillStyle = "#f1f5f9";
  context.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function createImageThumbFromBlob(file: File | Blob | null | undefined): Promise<string | null> {
  if (!isBrowser() || !isImageFile(file) || !file) return null;

  const objectUrl = URL.createObjectURL(file as Blob);
  try {
    const image = await loadImage(objectUrl);
    return renderThumbnail(image);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function createImageThumbFromUrl(url: string | null | undefined): Promise<string | null> {
  const source = String(url ?? "").trim();
  if (!isBrowser() || !source) return null;

  try {
    const response = await fetch(source, { credentials: "include" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return createImageThumbFromBlob(blob);
  } catch {
    return null;
  }
}

export function resolveOfflineImageSrc(input: {
  customer_image_thumb?: string | null;
  customer_image_url?: string | null;
  apartment_image_thumb?: string | null;
  apartment_image_url?: string | null;
}): string | null {
  const customerThumb = String(input.customer_image_thumb ?? "").trim();
  if (customerThumb) return customerThumb;

  const apartmentThumb = String(input.apartment_image_thumb ?? "").trim();
  if (apartmentThumb) return apartmentThumb;

  const customerUrl = String(input.customer_image_url ?? "").trim();
  if (customerUrl) return customerUrl;

  const apartmentUrl = String(input.apartment_image_url ?? "").trim();
  return apartmentUrl || null;
}
