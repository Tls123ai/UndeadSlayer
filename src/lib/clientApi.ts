export class RequestError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
    this.name = "RequestError";
  }
}

/** Checked responses and a bounded timeout for every account/save operation. */
export async function requestJson<T>(url: string, options: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  try {
    const response = await fetch(url, { ...options, cache: "no-store", signal: controller.signal });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new RequestError("The game server returned an invalid response. Please try again.", response.status);
    }
    if (!response.ok) {
      const error = data && typeof data === "object" && "error" in data ? data.error : null;
      throw new RequestError(typeof error === "string" ? error : "The game server could not complete this request.", response.status);
    }
    return data as T;
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException("Request cancelled.", "AbortError");
    if (error instanceof RequestError) throw error;
    if (controller.signal.aborted) throw new RequestError("The game server is taking too long to respond. Please try again.");
    throw new RequestError("Cannot reach the game server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

// Keep the loading screen readable even when the database and artwork are cached.
// These are minimum screen durations, NOT simulated asset-loading percentages.
export const LOADING_SCREEN_DURATIONS = {
  startup: 2_000,
  authentication: 1_000,
  battle: 1_000,
} as const;

export async function finishLoading(
  startedAt: number,
  minimumMs: number = LOADING_SCREEN_DURATIONS.startup,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new DOMException("Loading cancelled.", "AbortError");
  const elapsed = Math.max(0, performance.now() - startedAt);
  // Slow loads only need the short completion transition, not another full wait.
  const remaining = Math.max(140, minimumMs - elapsed);
  await new Promise<void>((resolve, reject) => {
    const aborted = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", aborted);
      reject(new DOMException("Loading cancelled.", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", aborted);
      resolve();
    }, remaining);
    signal?.addEventListener("abort", aborted, { once: true });
  });
}

export const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
