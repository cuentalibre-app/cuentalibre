import jpeg from "jpeg-js";
import { describe, expect, it } from "vitest";
import { sniffType } from "./extract";
import {
  downscale,
  ImageError,
  jpegOrientation,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_SIDE,
  orient,
  prepareImage,
  type Bitmap,
} from "./image";

/** 64×32: the left half red, the right half blue, with a green square in the top left corner. */
function pattern(width = 64, height = 32): Bitmap {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const green = x < 8 && y < 8;
      data.set(green ? [0, 255, 0, 255] : x < width / 2 ? [255, 0, 0, 255] : [0, 0, 255, 255], i);
    }
  }
  return { width, height, data };
}

/** The colour of a pixel, as the nearest of red, green, blue and white. */
function colourAt(bitmap: Bitmap, x: number, y: number) {
  const i = (y * bitmap.width + x) * 4;
  const [r, g, b] = [bitmap.data[i]!, bitmap.data[i + 1]!, bitmap.data[i + 2]!];
  if (r > 200 && g > 200 && b > 200) return "white";
  return r > 128 ? "red" : g > 128 ? "green" : b > 128 ? "blue" : "other";
}

const encode = (bitmap: Bitmap, quality = 95) => new Uint8Array(jpeg.encode(bitmap, quality).data);
const decode = (bytes: Uint8Array): Bitmap => jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });

/** The JPEG with an EXIF block recording this orientation, as phones write it. */
function withOrientation(bytes: Uint8Array, orientation: number) {
  const tiff = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0];
  const exif = [...new TextEncoder().encode("Exif\0\0"), ...tiff];
  const app1 = [0xff, 0xe1, 0, exif.length + 2, ...exif];
  return new Uint8Array([...bytes.subarray(0, 2), ...app1, ...bytes.subarray(2)]);
}

/** The pattern above as a HEIC photo, made with macOS `sips`. */
const HEIC = Uint8Array.from(
  atob(
    "AAAAJGZ0eXBoZWljAAAAAG1pZjFNaVBybWlhZk1pSEJoZWljAAABhm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAHBpY3QAAAAAAAAA" +
      "AAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAADnBpdG0AAAAAAAEAAAAjaWluZgAAAAAAAQAAABVp" +
      "bmZlAgAAAAABAABodmMxAAAAAOZpcHJwAAAAxWlwY28AAAATY29scm5jbHgAAgACAAaAAAAADGNsbGkAywBAAAAAFGlzcGUAAAAA" +
      "AAAAQAAAACAAAAAJaXJvdAAAAAAQcGl4aQAAAAADCAgIAAAAcWh2Y0MBA3AAAACwAAAAAAAe8AD8/fj4AAALA6AAAQAXQAEMAf//" +
      "A3AAAAMAsAAAAwAAAwAecCShAAEAI0IBAQNwAAADALAAAAMAAAMAHqAUIEHBjCOIe5FlU3AgIGAIogABAAlEAcBhcshAUyQAAAAZ" +
      "aXBtYQAAAAAAAAABAAEGgQIDBYaEAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAAboAAABiAAAAAW1kYXQAAAAAAAAAcgAAAF4oAa+j" +
      "woAaXr0WlX/7d//x1db/gAGi5K+CtJP95HX6gtlkW2myF6tUR95R23QeQ3/94c2f5chv/z5Og5hfWCZ/6TDx/jkoNLT6HrP0vyJW" +
      "fuKY/zQNxCwAlg3qJqtg",
  ),
  (char) => char.charCodeAt(0),
);

describe("jpegOrientation", () => {
  it("reads the EXIF orientation, and 1 without one", () => {
    const plain = encode(pattern());
    expect(jpegOrientation(plain)).toBe(1);
    expect(jpegOrientation(withOrientation(plain, 6))).toBe(6);
    expect(jpegOrientation(withOrientation(plain, 3))).toBe(3);
  });
});

describe("orient", () => {
  it("turns a photo stored sideways upright", () => {
    // 6: turn 90° clockwise, so the top left corner goes to the top right
    const turned = orient(pattern(), 6);
    expect([turned.width, turned.height]).toEqual([32, 64]);
    expect(colourAt(turned, 28, 2)).toBe("green");
    expect(colourAt(turned, 16, 10)).toBe("red");
    expect(colourAt(turned, 16, 50)).toBe("blue");
  });

  it("turns it the other way, upside down, or mirrors it", () => {
    expect(colourAt(orient(pattern(), 8), 2, 60)).toBe("green");
    expect(colourAt(orient(pattern(), 3), 60, 28)).toBe("green");
    expect(colourAt(orient(pattern(), 2), 60, 2)).toBe("green");
    expect(colourAt(orient(pattern(), 5), 2, 2)).toBe("green");
    expect(colourAt(orient(pattern(), 7), 28, 60)).toBe("green");
  });
});

describe("downscale", () => {
  it("shrinks the longest side to the maximum, keeping the proportions and colours", () => {
    const small = downscale(pattern(), 16);
    expect([small.width, small.height]).toEqual([16, 8]);
    expect(colourAt(small, 0, 0)).toBe("green");
    expect(colourAt(small, 4, 6)).toBe("red");
    expect(colourAt(small, 12, 6)).toBe("blue");
  });

  it("leaves a small image as it is", () => {
    const image = pattern();
    expect(downscale(image, 100)).toBe(image);
  });
});

describe("prepareImage", () => {
  it("sends a small upright JPEG as it is", async () => {
    const bytes = encode(pattern());
    expect(await prepareImage("image/jpeg", bytes)).toEqual({ mediaType: "image/jpeg", data: bytes });
  });

  it("turns a JPEG stored sideways upright, whatever its size", async () => {
    const prepared = await prepareImage("image/jpeg", withOrientation(encode(pattern()), 6));
    const image = decode(prepared.data);
    expect([image.width, image.height]).toEqual([32, 64]);
    expect(colourAt(image, 28, 2)).toBe("green");
    expect(jpegOrientation(prepared.data)).toBe(1);
  });

  it("converts HEIC, as iPhones save photos, to JPEG", async () => {
    expect(sniffType(HEIC)).toBe("image/heic");
    const prepared = await prepareImage("image/heic", HEIC);
    expect(prepared.mediaType).toBe("image/jpeg");
    const image = decode(prepared.data);
    expect([image.width, image.height]).toEqual([64, 32]);
    expect([colourAt(image, 2, 2), colourAt(image, 16, 20), colourAt(image, 50, 20)]).toEqual(["green", "red", "blue"]);
  });

  it("shrinks a large photo", async () => {
    // Noise doesn't compress, so a photo-sized image weighs megabytes
    const width = 3000;
    const height = 1200;
    const data = new Uint8Array(width * height * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 2654435761) >>> 24));
    const bytes = encode({ width, height, data }, 100);
    expect(bytes.length).toBeGreaterThan(MAX_IMAGE_BYTES);

    const prepared = await prepareImage("image/jpeg", bytes);
    const image = decode(prepared.data);
    expect([image.width, image.height]).toEqual([MAX_IMAGE_SIDE, 960]);
    expect(prepared.data.length).toBeLessThan(bytes.length);
  });

  it("puts a transparent PNG over white", async () => {
    const { PNG } = await import("pngjs");
    const png = new PNG({ width: 2000, height: 1000 });
    png.data.fill(0);
    const bytes = new Uint8Array(PNG.sync.write(png, { deflateLevel: 0 }));
    expect(bytes.length).toBeGreaterThan(MAX_IMAGE_BYTES);
    const image = decode((await prepareImage("image/png", bytes)).data);
    expect(colourAt(image, 10, 10)).toBe("white");
  });

  describe("refuses an image declaring more than the maximum pixels, before decoding it", () => {
    const side = Math.ceil(Math.sqrt(MAX_IMAGE_PIXELS)) + 1;
    const tooLarge = /too large|maxResolutionInMP/;
    const setUint16 = (bytes: Uint8Array, at: number, value: number) => bytes.set([value >> 8, value & 0xff], at);
    const setUint32 = (bytes: Uint8Array, at: number, value: number) =>
      new DataView(bytes.buffer, bytes.byteOffset).setUint32(at, value);

    it("PNG", async () => {
      // Only the header: past the size that gets decoded, and declaring a huge image
      const bytes = new Uint8Array(MAX_IMAGE_BYTES + 1);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      setUint32(bytes, 16, side);
      setUint32(bytes, 20, side);
      await expect(prepareImage("image/png", bytes)).rejects.toThrow(tooLarge);
    });

    it("PNG with a small header followed by a huge one, the size pngjs would decode", async () => {
      const bytes = new Uint8Array(MAX_IMAGE_BYTES + 1);
      const ihdr = (at: number, width: number, height: number) => {
        bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], at);
        setUint32(bytes, at + 8, width);
        setUint32(bytes, at + 12, height);
        bytes.set([8, 6, 0, 0, 0], at + 16);
      };
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      ihdr(8, 1, 1);
      ihdr(33, side, side);
      await expect(prepareImage("image/png", bytes)).rejects.toThrow(/more than one IHDR/);
    }, 1_000);

    it("PNG whose first header declares a length other than 13, hiding the next chunk", async () => {
      const bytes = new Uint8Array(MAX_IMAGE_BYTES + 1);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 25, 0x49, 0x48, 0x44, 0x52]);
      setUint32(bytes, 16, 1);
      setUint32(bytes, 20, 1);
      await expect(prepareImage("image/png", bytes)).rejects.toThrow(/isn't 13 bytes/);
    }, 1_000);

    it("JPEG", async () => {
      const bytes = withOrientation(encode(pattern()), 6);
      const sof = bytes.findIndex((byte, i) => byte === 0xff && bytes[i + 1] === 0xc0);
      setUint16(bytes, sof + 5, side);
      setUint16(bytes, sof + 7, side);
      await expect(prepareImage("image/jpeg", bytes)).rejects.toThrow(tooLarge);
    });

    it("HEIC", async () => {
      const bytes = HEIC.slice();
      const ispe = bytes.findIndex((_, i) => new TextDecoder().decode(bytes.subarray(i, i + 4)) === "ispe");
      setUint32(bytes, ispe + 8, side);
      setUint32(bytes, ispe + 12, side);
      await expect(prepareImage("image/heic", bytes)).rejects.toThrow(tooLarge);
    });
  });

  it("fails on an image it can't decode", async () => {
    const broken = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode("ftypheic"), 0, 0, 0, 0]);
    await expect(prepareImage("image/heic", broken)).rejects.toBeInstanceOf(ImageError);
  });
});
