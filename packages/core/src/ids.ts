/*
 * Record IDs are UUIDv7 (RFC 9562), generated on the client: an optimistic
 * create already has its final ID, so nothing needs remapping once the server
 * accepts it, and IDs sort by creation time, which keeps database indexes
 * compact.
 *
 * Layout: 48-bit Unix timestamp in milliseconds, version 7, a 12-bit counter
 * (the "rand_a" field, used as RFC 9562 method 1 to stay monotonic within a
 * millisecond), variant 10, and 62 random bits.
 */

// Web Crypto is available in browsers and Node; core does not load DOM types.
declare const crypto: { getRandomValues<T extends Uint8Array>(array: T): T };

export type IdSource = {
  now: () => number;
  random: (bytes: Uint8Array) => void;
};

const defaultSource: IdSource = {
  now: () => Date.now(),
  random: (bytes) => void crypto.getRandomValues(bytes),
};

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Whether a string is a lowercase UUIDv7. */
export function isUuidV7(value: string): boolean {
  return UUID_V7.test(value);
}

/**
 * Returns a UUIDv7 generator. IDs from one generator are strictly increasing,
 * even within the same millisecond or if the clock goes back.
 */
export function createIdGenerator(source: IdSource = defaultSource): () => string {
  let lastMs = -1;
  let counter = 0;
  const bytes = new Uint8Array(16);

  return () => {
    source.random(bytes);
    let ms = source.now();
    if (ms > lastMs) {
      // Start each millisecond low in the counter range, leaving room to increment.
      counter = bytes[6]! & 0x07;
      lastMs = ms;
    } else if (++counter > 0xfff) {
      // Counter overflow: borrow the next millisecond.
      counter = 0;
      lastMs += 1;
    }
    ms = lastMs;

    bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
    bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
    bytes[2] = (ms >>> 24) & 0xff;
    bytes[3] = (ms >>> 16) & 0xff;
    bytes[4] = (ms >>> 8) & 0xff;
    bytes[5] = ms & 0xff;
    bytes[6] = 0x70 | (counter >>> 8);
    bytes[7] = counter & 0xff;
    bytes[8] = 0x80 | (bytes[8]! & 0x3f);

    let hex = "";
    for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

/** A new record ID: a time-ordered UUIDv7. */
export const newId = createIdGenerator();
