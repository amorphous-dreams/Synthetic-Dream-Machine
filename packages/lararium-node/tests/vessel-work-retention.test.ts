/** Completed answers leave the ring; every request decision survives a fresh snapshot. */
import { describe, test, expect } from "vitest";
import { EFFECT_URI_PREFIX, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
import { FactLedger } from "../src/uds-channel.js";
import { snapshotWork } from "./work-store-fixture.js";

const ORIGIN = { kind: "lares-verb", requestId: "retention-fixture" } as const;

describe("vessel work retains decisions across answer eviction", () => {
  test("a thousand completed requests keep compact decisions across restart", async () => {
    const rest = snapshotWork();
    const work = rest.open();
    const ring = 64;
    const ledger = new FactLedger(work.store, work, ring, "first-life");
    for (let i = 0; i < 1000; i++) {
      const id = `w-${i}`, digest = `sha256-${i}`;
      expect(await ledger.arbitrate(id, digest)).toEqual({ verdict: "run" });
      await work.store.put({ tiddler: { title: `${OUTCOME_URI_PREFIX}${id}`, status: "done", "input-digest": digest } }, ORIGIN);
      await work.store.put({ tiddler: { title: `${EFFECT_URI_PREFIX}${i}`, "request-id": id, "input-digest": digest } }, ORIGIN);
      await ledger.observeOutcome(id, "done", digest, 200);
    }
    await work.flush();
    const reopened = rest.open();
    const titles = await reopened.store.listVisible();
    expect(titles.filter(title => title.startsWith(RECEIPT_FACT_URI_PREFIX))).toHaveLength(1000);
    expect(titles.filter(title => title.startsWith(OUTCOME_URI_PREFIX))).toHaveLength(ring);
    const fresh = new FactLedger(reopened.store, reopened, ring, "next-life");
    expect(await fresh.arbitrate("w-0", "sha256-0")).toEqual({ verdict: "refuse", reason: "retention-gap" });
    expect(await fresh.arbitrate("w-999", "sha256-999")).toEqual({ verdict: "refuse", reason: "already-committed" });
    expect(await reopened.store.get(`${OUTCOME_URI_PREFIX}w-0`)).toBeNull();
  });

  test("pending claims and unreadable decisions survive count pressure and restart", async () => {
    const rest = snapshotWork();
    const work = rest.open();
    const ledger = new FactLedger(work.store, work, 1, "first-life");
    for (const id of ["pending-a", "pending-b"]) expect(await ledger.arbitrate(id, id)).toEqual({ verdict: "run" });
    const title = `${RECEIPT_FACT_URI_PREFIX}unreadable`;
    await work.store.put({ tiddler: { title, state: "committed", seq: "40" } }, ORIGIN);
    await ledger.cancel("cancel-a");
    await ledger.cancel("cancel-b");
    expect(await ledger.get("pending-a")).toMatchObject({ state: "committed" });
    const reopened = rest.open();
    const fresh = new FactLedger(reopened.store, reopened, 1, "next-life");
    expect(await fresh.arbitrate("pending-a", "pending-a")).toEqual({ verdict: "refuse", reason: "interrupted" });
    expect(await fresh.arbitrate("unreadable", "anything")).toEqual({ verdict: "refuse", reason: "receipt-fact-torn" });
    expect((await reopened.store.get(title))?.tiddler).toEqual({ title, state: "committed", seq: "40" });
    await fresh.cancel("fresh-cancel");
    expect(await fresh.get("fresh-cancel")).toMatchObject({ seq: 41 });
  });
});
