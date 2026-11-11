import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCandidates } from "./cartociudad";

type Reply = "ok" | "error" | "hang";

/** A fake fetch that answers each call as told, in order, and records the URLs. */
function stubFetch(replies: Reply[]) {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, { signal }: { signal: AbortSignal }) => {
      const reply = replies[urls.length] ?? "hang";
      urls.push(url);
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
        if (reply === "ok") resolve(new Response(JSON.stringify([{ id: String(urls.length) }])));
        if (reply === "error") resolve(new Response("", { status: 400 }));
      });
    }),
  );
  return urls;
}

describe("fetchCandidates", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("answers with the first request when it's quick", async () => {
    const urls = stubFetch(["ok"]);
    await expect(fetchCandidates("https://x/c?q=a")).resolves.toEqual([{ id: "1" }]);
    expect(urls).toEqual(["https://x/c?q=a"]);
  });

  it("sends a second request alongside one that hangs, with a different URL", async () => {
    const urls = stubFetch(["hang", "ok"]);
    const result = fetchCandidates("https://x/c?q=a");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual([{ id: "2" }]);
    expect(urls[1]).toMatch(/^https:\/\/x\/c\?q=a&attempt=2-/);
  });

  it("retries right away after an error", async () => {
    stubFetch(["error", "ok"]);
    await expect(fetchCandidates("https://x/c?q=a")).resolves.toEqual([{ id: "2" }]);
  });

  it("fails once every attempt has failed", async () => {
    const urls = stubFetch(["error", "error", "error"]);
    await expect(fetchCandidates("https://x/c?q=a")).rejects.toThrow("HTTP 400");
    expect(urls).toHaveLength(3);
  });

  it("gives up when the caller cancels", async () => {
    stubFetch(["hang"]);
    const controller = new AbortController();
    const result = fetchCandidates("https://x/c?q=a", controller.signal);
    controller.abort();
    await expect(result).rejects.toBeDefined();
  });
});
