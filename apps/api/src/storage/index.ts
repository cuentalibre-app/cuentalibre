import type { Env } from "../env";
import { diskStorage } from "./disk";
import { s3Storage } from "./s3";

/**
 * Where uploaded files are kept. The database only holds their metadata, so
 * the bytes can live on local disk for a self-hosted install, or in any
 * S3-compatible store (MinIO, Hetzner, AWS…).
 */
export interface FileStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** The file's bytes, or null if there is nothing under the key. */
  get(key: string): Promise<ReadableStream<Uint8Array> | null>;
  /** Removes the file under the key; does nothing if there is none. */
  delete(key: string): Promise<void>;
}

export function createStorage(env: Env): FileStorage {
  if (env.STORAGE_DRIVER === "disk") return diskStorage(env.STORAGE_DIR);
  return s3Storage({
    endpoint: env.S3_ENDPOINT!,
    bucket: env.S3_BUCKET!,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
  });
}
