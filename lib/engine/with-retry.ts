/**
 * The single retry + timeout layer every Groq call site in this app wraps its
 * request with. Exactly one retry, one timeout, one attempt in flight at a time.
 *
 * `fn` receives an `AbortSignal` that is aborted when the attempt times out, so
 * the underlying request is actually cancelled instead of being abandoned while
 * it keeps running in the background. Call sites must forward that signal to the
 * SDK (`{ signal }`) and disable the SDK's own internal retries
 * (`{ maxRetries: 0 }`) — otherwise two retry mechanisms stack.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 15000
): Promise<T> {
  const attempt = () => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      fn(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          // Cancel the in-flight request, then surface the timeout.
          controller.abort();
          reject(new Error("timeout"));
        }, timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
  };

  try {
    return await attempt();
  } catch {
    // Exactly one retry. If the second attempt fails its error propagates —
    // no fallback content is ever invented.
    return await attempt();
  }
}
