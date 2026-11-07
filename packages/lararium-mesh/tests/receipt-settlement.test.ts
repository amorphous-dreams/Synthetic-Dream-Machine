/**
 * The vessel's half of the settlement round (L29): it answers receipt asks whenever asked, during the island's submit too, and
 * sends `receipt:close` once, only after the island's `receipt:asks-done` AND every answer still being made has posted. No clock.
 * The wiki pool, the node daemon worker and the browser daemon each hold one `receiptSettlement` per island; `answerIslandAsks`
 * (the browser daemon's door) reads here whole over a fake port.
 */
import { describe, expect, test } from "vitest";
import { answerIslandAsks, receiptSettlement, type CapabilityRecord } from "../src/index.js";

const turns = async (n = 8): Promise<void> => { for (let i = 0; i < n; i++) await Promise.resolve(); };

describe("receiptSettlement", () => {
  test("close waits on asks-done and on every outstanding answer, and runs once — CONTROL: asks-done over no answer closes at once", async () => {
    let closes = 0;
    const s = receiptSettlement(() => { closes++; });
    let answer!: () => void;
    const pending = s.answering(new Promise<void>((resolve) => { answer = resolve; }));
    await turns();
    expect(closes, "answers flow before asks-done; nothing closes").toBe(0);
    s.asksDone();
    await turns();
    expect(closes, "one answer still being made").toBe(0);
    answer();
    await pending;
    await turns();
    expect(closes).toBe(1);
    s.asksDone();
    await s.answering(Promise.resolve());
    expect(closes, "close runs once").toBe(1);

    let control = 0;
    receiptSettlement(() => { control++; }).asksDone();
    expect(control).toBe(1);
  });

  test("a refused answer still counts down", async () => {
    let closes = 0;
    const s = receiptSettlement(() => { closes++; });
    s.asksDone();
    await s.answering(Promise.reject(new Error("no"))).catch(() => {});
    await turns();
    expect(closes).toBe(1);
  });
});

describe("answerIslandAsks (browser daemon door)", () => {
  function port() {
    const posted: Array<{ type: string; requestId?: string; issued?: boolean }> = [];
    let listener!: (msg: unknown) => void;
    return {
      posted,
      send: (msg: unknown) => listener(msg),
      port: { post: (msg: unknown) => { posted.push(msg as never); }, listen: (cb: (msg: unknown) => void) => { listener = cb; return () => {}; } },
    };
  }

  test("answers a receipt ask before asks-done, then closes after the last answer posts", async () => {
    const releases: Array<() => void> = [];
    const caps = { receipt: () => new Promise<void>((resolve) => { releases.push(resolve); }) } as unknown as CapabilityRecord;
    const p = port();
    answerIslandAsks(p.port, caps);
    p.send({ type: "receipt:request", requestId: "a", documentIds: ["doc-a"] });
    p.send({ type: "receipt:request", requestId: "b", documentIds: ["doc-b"] });
    releases[0]!();
    await turns();
    expect(p.posted.map((m) => m.type), "the vessel answers during the island's submit").toEqual(["receipt:issued"]);
    p.send({ type: "receipt:asks-done" });
    await turns();
    expect(p.posted.map((m) => m.type), "b's answer still being made").toEqual(["receipt:issued"]);
    releases[1]!();
    await turns();
    expect(p.posted.map((m) => m.type)).toEqual(["receipt:issued", "receipt:issued", "receipt:close"]);
    expect(p.posted.slice(0, 2).map((m) => m.issued)).toEqual([true, true]);
  });
});
