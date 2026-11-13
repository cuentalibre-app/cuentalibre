declare module "heic-decode" {
  /** Decodes the primary image of a HEIC/HEIF file to RGBA pixels. */
  export default function decode(options: {
    buffer: ArrayBufferLike | Uint8Array;
  }): Promise<{ width: number; height: number; data: Uint8ClampedArray }>;
}
