import jpeg from "jpeg-js";
import { PNG } from "pngjs";

/*
 * Photos are prepared before they reach the model. Phones take them large (3–5 MB,
 * 12 MP or more) and iPhones save HEIC, which no provider reads; Anthropic also
 * refuses images over 5 MB. Those are decoded, shrunk and sent as JPEG, upright.
 * Small JPEG, PNG, WebP and GIF files go as they are. The stored file is untouched.
 * Everything here is plain JavaScript or WebAssembly, so the bundle needs no native code.
 * Decoding a 12 MP photo takes about a second and a few hundred MB, so photos are
 * decoded one at a time, and libheif is only loaded once a HEIC arrives.
 */

/** Images larger than this are shrunk. */
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
/**
 * Longest side of a shrunk image. Enough for a long ticket's small print; the
 * providers scale it down further on their side anyway.
 */
export const MAX_IMAGE_SIDE = 2400;
const JPEG_QUALITY = 85;
/**
 * Largest image decoded: 50 MP, what the biggest phone sensors give by default, takes
 * 200 MB as RGBA. A few kilobytes can declare far more, so the size is checked first.
 */
export const MAX_IMAGE_PIXELS = 50_000_000;

export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/heic";

/** Pixels as RGBA, four bytes each, row by row. */
export interface Bitmap {
  width: number;
  height: number;
  data: Uint8Array;
}

/** An image the providers read, and its type. */
export interface PreparedImage {
  mediaType: Exclude<ImageType, "image/heic">;
  data: Uint8Array;
}

/** The image could not be decoded. */
export class ImageError extends Error {}

const readUint16 = (bytes: Uint8Array, offset: number, little: boolean) =>
  little ? bytes[offset]! | (bytes[offset + 1]! << 8) : (bytes[offset]! << 8) | bytes[offset + 1]!;
const readUint32 = (bytes: Uint8Array, offset: number, little: boolean) =>
  little
    ? (readUint16(bytes, offset, true) | (readUint16(bytes, offset + 2, true) << 16)) >>> 0
    : ((readUint16(bytes, offset, false) << 16) | readUint16(bytes, offset + 2, false)) >>> 0;

/**
 * A JPEG's EXIF orientation (1 to 8), 1 when it has none. Phones store portrait
 * photos sideways and record how to turn them here; re-encoding drops the EXIF,
 * so the pixels have to be turned first.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1]!;
    // Start of scan: the image data follows, no more metadata
    if (marker === 0xda) break;
    const length = readUint16(bytes, offset + 2, false);
    const exif = String.fromCharCode(...bytes.subarray(offset + 4, offset + 10)) === "Exif\0\0";
    if (marker === 0xe1 && exif) {
      const tiff = offset + 10;
      const little = bytes[tiff] === 0x49;
      const ifd = tiff + readUint32(bytes, tiff + 4, little);
      const entries = readUint16(bytes, ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > bytes.length) break;
        if (readUint16(bytes, entry, little) === 0x0112) {
          const value = readUint16(bytes, entry + 8, little);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    offset += 2 + length;
  }
  return 1;
}

const PNG_IHDR = 0x49484452;

/**
 * The width and height a PNG's header declares. `pngjs` takes the last `IHDR` chunk
 * it meets as the size to allocate, so a file with more than one is refused.
 */
function pngSize(bytes: Uint8Array): [number, number] {
  if (bytes.length < 33 || readUint32(bytes, 12, false) !== PNG_IHDR)
    throw new Error("The PNG doesn't start with IHDR");
  // Chunks are length, type, data and CRC; only their headers are read
  for (let offset = 33; offset + 8 <= bytes.length; offset += 12 + readUint32(bytes, offset, false)) {
    if (readUint32(bytes, offset + 4, false) === PNG_IHDR) throw new Error("The PNG has more than one IHDR");
  }
  return [readUint32(bytes, 16, false), readUint32(bytes, 20, false)];
}

/**
 * The largest width and height a HEIC declares in its `ispe` boxes, one per image or
 * tile; libheif allocates for those. Throws when there is none, as libheif can't decode it.
 */
function heicSize(bytes: Uint8Array): [number, number] {
  let size: [number, number] | null = null;
  for (let i = 4; i + 16 <= bytes.length; i++) {
    // "ispe", then version and flags, width and height
    if (bytes[i] !== 0x69 || bytes[i + 1] !== 0x73 || bytes[i + 2] !== 0x70 || bytes[i + 3] !== 0x65) continue;
    const width = readUint32(bytes, i + 8, false);
    const height = readUint32(bytes, i + 12, false);
    if (!size || width * height > size[0] * size[1]) size = [width, height];
  }
  if (!size) throw new Error("The HEIC declares no size");
  return size;
}

/** Refuses an image larger than `MAX_IMAGE_PIXELS` before anything is allocated for it. */
function checkSize([width, height]: [number, number]) {
  if (width * height > MAX_IMAGE_PIXELS) throw new Error(`The image is too large: ${width}×${height}`);
}

/** The bitmap shrunk so its longest side is at most `maxSide`, each pixel the average of those it covers. */
export function downscale(bitmap: Bitmap, maxSide: number): Bitmap {
  const { width, height, data } = bitmap;
  const scale = maxSide / Math.max(width, height);
  if (scale >= 1) return bitmap;
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y++) {
    const y0 = Math.floor((y * height) / outHeight);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / outHeight));
    for (let x = 0; x < outWidth; x++) {
      const x0 = Math.floor((x * width) / outWidth);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / outWidth));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * width + sx) * 4;
          r += data[i]!;
          g += data[i + 1]!;
          b += data[i + 2]!;
          a += data[i + 3]!;
        }
      }
      const count = (y1 - y0) * (x1 - x0);
      const o = (y * outWidth + x) * 4;
      out[o] = Math.round(r / count);
      out[o + 1] = Math.round(g / count);
      out[o + 2] = Math.round(b / count);
      out[o + 3] = Math.round(a / count);
    }
  }
  return { width: outWidth, height: outHeight, data: out };
}

/** The bitmap turned upright for its EXIF orientation: mirrored, rotated, or both. */
export function orient(bitmap: Bitmap, orientation: number): Bitmap {
  if (orientation <= 1 || orientation > 8) return bitmap;
  const { width: w, height: h, data } = bitmap;
  const swaps = orientation >= 5;
  const outWidth = swaps ? h : w;
  const outHeight = swaps ? w : h;
  const out = new Uint8Array(data.length);
  // Where the pixel at (x, y) goes
  const target = (x: number, y: number): [number, number] => {
    switch (orientation) {
      case 2:
        return [w - 1 - x, y];
      case 3:
        return [w - 1 - x, h - 1 - y];
      case 4:
        return [x, h - 1 - y];
      case 5:
        return [y, x];
      case 6:
        return [h - 1 - y, x];
      case 7:
        return [h - 1 - y, w - 1 - x];
      default:
        return [y, w - 1 - x];
    }
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [tx, ty] = target(x, y);
      out.set(data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (ty * outWidth + tx) * 4);
    }
  }
  return { width: outWidth, height: outHeight, data: out };
}

/** JPEG of the bitmap, with transparent pixels over white, as JPEG has no transparency. Changes the bitmap. */
function encodeJpeg(bitmap: Bitmap): Uint8Array {
  const { data } = bitmap;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]! / 255;
    if (alpha === 1) continue;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c]! * alpha + 255 * (1 - alpha));
    data[i + 3] = 255;
  }
  return new Uint8Array(jpeg.encode(bitmap, JPEG_QUALITY).data);
}

async function decode(type: "image/jpeg" | "image/png" | "image/heic", bytes: Uint8Array): Promise<Bitmap> {
  if (type === "image/jpeg") {
    const image = jpeg.decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: MAX_IMAGE_PIXELS / 1_000_000,
      maxMemoryUsageInMB: 1024,
    });
    return { width: image.width, height: image.height, data: image.data };
  }
  if (type === "image/png") {
    checkSize(pngSize(bytes));
    const image = PNG.sync.read(Buffer.from(bytes));
    return { width: image.width, height: image.height, data: image.data };
  }
  checkSize(heicSize(bytes));
  // libheif applies the image's own rotation while decoding
  const { default: decodeHeic } = await import("heic-decode");
  const image = await decodeHeic({ buffer: bytes });
  return { width: image.width, height: image.height, data: new Uint8Array(image.data.buffer) };
}

let queue: Promise<unknown> = Promise.resolve();

/** Runs the task once those queued before it end, so only one photo is in memory decoded. */
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * The image as the model gets it: HEIC always, and JPEG or PNG when larger than
 * `MAX_IMAGE_BYTES` or (JPEG) stored sideways, become an upright JPEG no larger than
 * `MAX_IMAGE_SIDE`. WebP and GIF can't be decoded here and go as they are.
 */
export async function prepareImage(type: ImageType, bytes: Uint8Array): Promise<PreparedImage> {
  if (type === "image/webp" || type === "image/gif") return { mediaType: type, data: bytes };
  const orientation = type === "image/jpeg" ? jpegOrientation(bytes) : 1;
  if (type !== "image/heic" && bytes.length <= MAX_IMAGE_BYTES && orientation === 1)
    return { mediaType: type, data: bytes };
  return oneAtATime(async () => {
    let bitmap: Bitmap;
    try {
      bitmap = await decode(type, bytes);
    } catch (error) {
      throw new ImageError(error instanceof Error ? error.message : String(error));
    }
    return { mediaType: "image/jpeg", data: encodeJpeg(orient(downscale(bitmap, MAX_IMAGE_SIDE), orientation)) };
  });
}
