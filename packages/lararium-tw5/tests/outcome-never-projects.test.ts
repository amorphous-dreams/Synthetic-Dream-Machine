/**
 * AN OUTCOME AND ITS EFFECT INDEX NEVER PROJECT TO DISK.
 *
 * A verb's outcome record and the effect index row that names it live in the daemon's control bag as
 * bookkeeping. Each carries `disk-projection: no`, so no mirror ever writes a file for one, whatever
 * layer it lands in.
 *
 * Control: the outcome's own content (status, results) stands unchanged beside the field.
 */
import { describe, expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, OUTCOME_URI_PREFIX, concludeVerb, wikiSlotUri, type Verb } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { writeOutcome, EFFECT_URI_PREFIX } from "../src/verb-vm.js";

describe("an outcome and its effect index never project", () => {
  test("the outcome builder stamps disk-projection: no", () => {
    const record = concludeVerb({ requestId: "r1", verb: "LOAD", status: "done", cause: "", batchMode: "best-effort", results: { a: { ok: true } as never } });
    expect(record.tiddler.title).toBe(`${OUTCOME_URI_PREFIX}r1`);
    expect(record.tiddler["disk-projection"]).toBe("no");
    expect(record.tiddler["status"], "CONTROL: the outcome's content stands").toBe("done");
    expect(JSON.parse(String(record.tiddler["results"]))).toEqual({ a: { ok: true } });
  });

  test("a written outcome and its effect index row both carry the field", async () => {
    const daemon = new CompositeStore();
    daemon.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
    const invocation = {
      requestId: "r2", title: "lar:///lararium.local.vm/verbs/r2", action: "LOAD", args: {}, targets: [], batchMode: "best-effort",
      status: "pending", requestedBy: "operator", requestedAt: "2026-10-12T00:00:00Z", effectKey: "effect-key-1",
    } as unknown as Verb;
    await writeOutcome(daemon, { invocation, status: "done", result: {} });
    const outcome = await daemon.getLive(`${OUTCOME_URI_PREFIX}r2`);
    const index = await daemon.getLive(`${EFFECT_URI_PREFIX}effect-key-1`);
    expect(outcome?.tiddler["disk-projection"]).toBe("no");
    expect(index, "the effect index row landed").not.toBeNull();
    expect(index?.tiddler["disk-projection"]).toBe("no");
    expect(index?.tiddler["request-id"], "CONTROL: the row still names its attempt").toBe("r2");
  });

  // THE LEDGER RESTS IN THE DAEMON WIKI'S WORKING SLOT (sealed-store#/owed, U1's D half): the slot seals under the lit
  // face, while the daemon document beneath rests clear, so an outcome body never rests in the daemon document.
  test("a written outcome and its effect index row land in the daemon wiki's working slot, and the daemon bag holds neither", async () => {
    const working = wikiSlotUri("daemon", "working");
    const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
    const slot = new MemoryTiddlerStore(working);
    const daemon = new CompositeStore();
    daemon.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true });
    daemon.addLayer({ bagId: working, store: slot, writable: true, defaultWritable: true });
    expect(daemon.defaultWritableBagId(), "the setup took: the working slot writes by default").toBe(working);
    const invocation = {
      requestId: "r3", title: "lar:///lararium.local.vm/verbs/r3", action: "LOAD", args: {}, targets: [], batchMode: "best-effort",
      status: "pending", requestedBy: "operator", requestedAt: "2026-10-12T00:00:00Z", effectKey: "effect-key-3",
    } as unknown as Verb;
    await writeOutcome(daemon, { invocation, status: "done", result: { body: "private-heron" } });
    expect(await slot.get(`${OUTCOME_URI_PREFIX}r3`), "the outcome rests in the working slot").not.toBeNull();
    expect(await slot.get(`${EFFECT_URI_PREFIX}effect-key-3`), "the effect index rests in the working slot").not.toBeNull();
    expect(await daemonBag.listVisible(), "the daemon document rests neither").toEqual([]);
    // CONTROL: the composite still answers the outcome whole by its title, as every reader asks it.
    expect(JSON.parse(String((await daemon.get(`${OUTCOME_URI_PREFIX}r3`))?.tiddler["results"]))).toEqual({ summary: { ok: true, output: { body: "private-heron" } } });
  });
});
