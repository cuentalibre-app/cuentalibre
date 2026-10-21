import { describe, expect, it } from "vitest";
import { s3Storage } from "./s3";

const options = {
  endpoint: "http://minio:9000/",
  bucket: "cuentalibre",
  region: "auto",
  accessKeyId: "key",
  secretAccessKey: "secret",
};

/** A fetch that records the signed requests and answers each one with the next response. */
function fakeFetch(...responses: Response[]) {
  const requests: Request[] = [];
  const fetchImpl = (async (input: Request) => {
    requests.push(input);
    return responses.shift()!;
  }) as typeof fetch;
  return { requests, fetchImpl };
}

describe("s3 storage", () => {
  it("puts and gets objects path-style, signed", async () => {
    const { requests, fetchImpl } = fakeFetch(new Response(null, { status: 200 }), new Response("bytes"));
    const storage = s3Storage(options, fetchImpl);
    await storage.put("org/file id/key", new TextEncoder().encode("bytes"), "application/pdf");
    const body = await storage.get("org/file id/key");

    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ["PUT", "http://minio:9000/cuentalibre/org/file%20id/key"],
      ["GET", "http://minio:9000/cuentalibre/org/file%20id/key"],
    ]);
    expect(requests[0]!.headers.get("content-type")).toBe("application/pdf");
    expect(requests[0]!.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=key\//);
    expect(await new Response(body).text()).toBe("bytes");
  });

  it("answers null for a missing object and throws on other errors", async () => {
    const { fetchImpl } = fakeFetch(new Response(null, { status: 404 }), new Response("denied", { status: 403 }));
    const storage = s3Storage(options, fetchImpl);
    expect(await storage.get("missing")).toBeNull();
    await expect(storage.put("key", new Uint8Array(1), "text/plain")).rejects.toThrow(/403/);
  });

  it("deletes objects, and a missing one is not an error", async () => {
    const { requests, fetchImpl } = fakeFetch(
      new Response(null, { status: 204 }),
      new Response(null, { status: 404 }),
      new Response("denied", { status: 403 }),
    );
    const storage = s3Storage(options, fetchImpl);
    await storage.delete("org/file id/key");
    await storage.delete("missing");
    await expect(storage.delete("key")).rejects.toThrow(/403/);
    expect(requests[0]!.method).toBe("DELETE");
    expect(requests[0]!.url).toBe("http://minio:9000/cuentalibre/org/file%20id/key");
  });
});
