import { afterEach, describe, expect, test, vi } from "vitest";
import { waitForSlotDocument, type SlotWaitDeps } from "../src/slot-wait.js";

function deps(find: () => Promise<string>): SlotWaitDeps<string> {
  return {
    find,
    absence: (error) => error instanceof Error && error.message === "unavailable",
    peerCount: () => 0,
    now: () => Date.now(),
    lastHeard: () => 0,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    defer: async () => {},
    budgets: { silenceMs: 8_000, hardCapMs: 60_000, pollMs: 250 },
  };
}

async function flushPromises() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("slot wait wakes on document readiness", () => {
  afterEach(() => vi.useRealTimers());

  test("a document arriving settles the wait without advancing its timer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let arrive!: (handle: string) => void;
    const document = new Promise<string>((resolve) => { arrive = resolve; });
    const result = vi.fn();
    void waitForSlotDocument(deps(() => document)).then(result);
    arrive("document-handle");
    await flushPromises();
    expect(result).toHaveBeenCalledWith({ outcome: "ready", handle: "document-handle" });
  });

  test("an unresolved document never reports premature success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const result = vi.fn();
    void waitForSlotDocument(deps(() => new Promise<string>(() => {}))).then(result);
    await flushPromises();
    expect(result).not.toHaveBeenCalled();
  });

  test("silence and refusal retain their named outcomes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const silent = waitForSlotDocument(deps(() => new Promise<string>(() => {})));
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await silent).toEqual({ outcome: "never-arrived", silentMs: 8_000, elapsedMs: 8_000 });

    const refused = waitForSlotDocument(deps(() => Promise.reject(new Error("invalid address"))));
    await vi.advanceTimersByTimeAsync(250);
    expect(await refused).toEqual({ outcome: "refused", why: "invalid address" });
  });
});
