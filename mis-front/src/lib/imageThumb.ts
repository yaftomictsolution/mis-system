"use client";

const THUMB_SIZE = 96;
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"];

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isSameOriginUrl(source: string): boolean {
  if (!isBrowser()) return false;

  try {
    const url = new URL(source, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
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

function renderThumbnail(image: HTMLImageElement, size = THUMB_SIZE): string | null {
  if (!isBrowser()) return null;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) return null;

  const sourceWidth = image.naturalWidth || image.width || size;
  const sourceHeight = image.naturalHeight || image.height || size;
  const scale = Math.max(size / sourceWidth, size / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (size - drawWidth) / 2;
  const offsetY = (size - drawHeight) / 2;

  context.fillStyle = "#f1f5f9";
  context.fillRect(0, 0, size, size);
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function createImageThumbFromBlob(
  file: File | Blob | null | undefined,
  size = THUMB_SIZE,
): Promise<string | null> {
  if (!isBrowser() || !isImageFile(file) || !file) return null;

  const objectUrl = URL.createObjectURL(file as Blob);
  try {
    const image = await loadImage(objectUrl);
    return renderThumbnail(image, size);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function createImageThumbFromUrl(url: string | null | undefined, size = THUMB_SIZE): Promise<string | null> {
  const source = String(url ?? "").trim();
  if (!isBrowser() || !source) return null;
  if (!isSameOriginUrl(source)) return null;

  try {
    const response = await fetch(source, { credentials: "include" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return createImageThumbFromBlob(blob, size);
  } catch {
    return null;
  }
}

export function resolveOfflineImageSrc(input: {
  customer_image_thumb?: string | null;
  customer_image_url?: string | null;
  representative_image_thumb?: string | null;
  representative_image_url?: string | null;
  apartment_image_thumb?: string | null;
  apartment_image_url?: string | null;
}): string | null {
  const customerThumb = String(input.customer_image_thumb ?? "").trim();
  if (customerThumb) return customerThumb;

  const representativeThumb = String(input.representative_image_thumb ?? "").trim();
  if (representativeThumb) return representativeThumb;

  const apartmentThumb = String(input.apartment_image_thumb ?? "").trim();
  if (apartmentThumb) return apartmentThumb;

  const customerUrl = String(input.customer_image_url ?? "").trim();
  if (customerUrl) {
    if (!isBrowser()) return customerUrl;
    if (navigator.onLine || isSameOriginUrl(customerUrl)) return customerUrl;
  }

  const representativeUrl = String(input.representative_image_url ?? "").trim();
  if (representativeUrl) {
    if (!isBrowser()) return representativeUrl;
    if (navigator.onLine || isSameOriginUrl(representativeUrl)) return representativeUrl;
  }

  const apartmentUrl = String(input.apartment_image_url ?? "").trim();
  if (!apartmentUrl) return null;
  if (!isBrowser()) return apartmentUrl;
  return navigator.onLine || isSameOriginUrl(apartmentUrl) ? apartmentUrl : null;
}
