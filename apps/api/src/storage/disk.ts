import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import type { FileStorage } from ".";

/** Files under a directory of the local disk, one per key. */
export function diskStorage(directory: string): FileStorage {
  const root = resolve(directory);
  const pathOf = (key: string) => {
    const path = resolve(root, key);
    if (!path.startsWith(root + sep)) throw new Error(`Invalid storage key: ${key}`);
    return path;
  };

  return {
    async put(key, body) {
      const path = pathOf(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body, { flag: "wx" });
    },

    async get(key) {
      const path = pathOf(key);
      const found = await stat(path).catch(() => null);
      if (!found?.isFile()) return null;
      return Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;
    },
  };
}
