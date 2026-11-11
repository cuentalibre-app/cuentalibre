import type { Candidate } from "./address-search-model";

/**
 * CartoCiudad usually answers in under 0.7 s; past this, a second request goes
 * out alongside, which the browser sends on another connection in case this
 * one died on the way without notice.
 */
const HEDGE_MS = 800;
/** Requests at most per search, counting the hedge and the retries after an error. */
const MAX_ATTEMPTS = 3;
/** Each request gives up after this. */
const TIMEOUT_MS = 5000;

/**
 * Candidates from CartoCiudad, which now and then answers with an error or
 * leaves a request hanging for seconds. A request still pending after
 * `HEDGE_MS`, or one that fails, starts another; the first answer wins and
 * cancels the rest. Each attempt changes the URL with a parameter the service
 * ignores, since the browser would queue a request for the same URL behind
 * the stuck one.
 */
export function fetchCandidates(url: string, signal?: AbortSignal): Promise<Candidate[]> {
  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = [];
    let attempts = 0;
    let pending = 0;
    let settled = false;
    let hedge: ReturnType<typeof setTimeout> | undefined;

    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedge);
      for (const c of controllers) c.abort();
      settle();
    };

    const launch = () => {
      const controller = new AbortController();
      controllers.push(controller);
      attempts++;
      pending++;
      clearTimeout(hedge);
      if (attempts < MAX_ATTEMPTS) hedge = setTimeout(launch, HEDGE_MS);
      const signals = [controller.signal, AbortSignal.timeout(TIMEOUT_MS), ...(signal ? [signal] : [])];
      fetch(attempts === 1 ? url : `${url}&attempt=${attempts}-${Date.now()}`, { signal: AbortSignal.any(signals) })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<Candidate[]>;
        })
        .then(
          (candidates) => finish(() => resolve(candidates)),
          (error: unknown) => {
            pending--;
            if (settled) return;
            if (signal?.aborted) return finish(() => reject(error));
            if (attempts < MAX_ATTEMPTS) launch();
            else if (pending === 0) finish(() => reject(error));
          },
        );
    };

    if (signal?.aborted) return reject(signal.reason);
    signal?.addEventListener("abort", () => finish(() => reject(signal.reason)), { once: true });
    launch();
  });
}
