import { describe, it, expect, vi, afterEach } from "vitest";
import { withRetry } from "../with-retry";

afterEach(() => {
  vi.useRealTimers();
});

describe("withRetry", () => {
  it("returns the result without retrying when the first attempt succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once when the first attempt fails", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient network failure"))
      .mockResolvedValueOnce("ok");

    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after a single retry and propagates the original error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("groq is down"));

    await expect(withRetry(fn)).rejects.toThrow(/groq is down/);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("hands each attempt a signal that is not aborted on the success path", async () => {
    const signals: AbortSignal[] = [];
    const fn = vi.fn(async (signal: AbortSignal) => {
      signals.push(signal);
      return "ok";
    });

    await withRetry(fn);
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);
  });

  it("aborts the in-flight request when an attempt times out", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fn = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      // Never settles: only the timeout can end this attempt.
      return new Promise<string>(() => {});
    });

    const result = withRetry(fn, 1000);
    const assertion = expect(result).rejects.toThrow(/timeout/);

    await vi.advanceTimersByTimeAsync(1000);
    expect(signals).toHaveLength(2); // first attempt timed out, retry started
    expect(signals[0].aborted).toBe(true);
    expect(signals[1]).not.toBe(signals[0]); // fresh controller per attempt
    expect(signals[1].aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    expect(fn).toHaveBeenCalledTimes(2);
    expect(signals[1].aborted).toBe(true);
  });

  it("clears the timeout timer on the success path", async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    await withRetry(async () => "ok", 15000);

    expect(clearSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    clearSpy.mockRestore();
  });
});
