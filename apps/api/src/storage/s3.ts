import { AwsClient } from "aws4fetch";
import type { FileStorage } from ".";

export interface S3Options {
  /** e.g. `https://fsn1.your-objectstorage.com`, or `http://localhost:9000` for MinIO. */
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Objects in a bucket of an S3-compatible store, addressed path-style so MinIO works too. */
export function s3Storage(options: S3Options, fetchImpl: typeof fetch = fetch): FileStorage {
  const client = new AwsClient({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    service: "s3",
    region: options.region,
  });
  const base = `${options.endpoint.replace(/\/+$/, "")}/${encodeURIComponent(options.bucket)}`;
  const urlOf = (key: string) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;

  async function send(url: string, init: RequestInit) {
    const request = await client.sign(url, init);
    return fetchImpl(request);
  }

  return {
    async put(key, body, contentType) {
      const response = await send(urlOf(key), {
        method: "PUT",
        body,
        headers: { "content-type": contentType, "content-length": String(body.byteLength) },
      });
      if (!response.ok) throw new Error(`S3 PUT ${key} failed: ${response.status} ${await response.text()}`);
    },

    async get(key) {
      const response = await send(urlOf(key), { method: "GET" });
      if (response.status === 404) return null;
      if (!response.ok || !response.body) throw new Error(`S3 GET ${key} failed: ${response.status}`);
      return response.body;
    },
  };
}
