/**
 * AN OUTCOME AND ITS EFFECT INDEX REST IN THE CONTROL DOCUMENT.
 *
 * Placement decides residency: a verb's outcome record and the effect index row that names it rest in the vessel's
 * control document (`control-home`), which no recipe composes and no mirror names, so neither reaches a projected
 * layer. The daemon wiki's working slot (mirrored at `wikis/daemon-<F>`) and the daemon document rest neither.
 *
 * Control: the outcome's own content (status, results) stands unchanged.
 */
import { describe, expect, test } from "vitest";
import { CompositeStore, CONTROL_HOME_ID, DAEMON_BAG_ID, OUTCOME_URI_PREFIX, concludeVerb, wikiSlotUri, type Verb } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { writeOutcome, EFFECT_URI_PREFIX } from "../src/verb-vm.js";

describe("an outcome and its effect index rest in the control document", () => {
  test("the outcome builder titles the outcome under the control home", () => {
    const record = concludeVerb({ requestId: "r1", verb: "LOAD", status: "done", cause: "", batchMode: "best-effort", results: { a: { ok: true } as never } });
    expect(record.tiddler.title).toBe(`${OUTCOME_URI_PREFIX}r1`);
    expect(record.tiddler.title.startsWith(`${CONTROL_HOME_ID}/outcomes/`)).toBe(true);
    expect(record.tiddler["status"], "CONTROL: the outcome's content stands").toBe("done");
    expect(JSON.parse(String(record.tiddler["results"]))).toEqual({ a: { ok: true } });
  });

  test("a written outcome and its effect index row land in the control store alone; the working slot and the daemon bag hold neither", async () => {
    const working = wikiSlotUri("daemon", "working");
    const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
    const slot = new MemoryTiddlerStore(working);
    const daemon = new CompositeStore();
    daemon.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true });
    daemon.addLayer({ bagId: working, store: slot, writable: true, defaultWritable: true });
    const controlBag = new MemoryTiddlerStore(CONTROL_HOME_ID);
    const control = new CompositeStore();
    control.addLayer({ bagId: CONTROL_HOME_ID, store: controlBag, writable: true, defaultWritable: true });
    const invocation = {
      requestId: "r3", title: "lar:///lararium.local.vm/verbs/r3", action: "LOAD", args: {}, targets: [], batchMode: "best-effort",
      status: "pending", requestedBy: "operator", requestedAt: "2026-10-12T00:00:00Z", effectKey: "effect-key-3",
    } as unknown as Verb;
    await writeOutcome(control, { invocation, status: "done", result: { body: "private-heron" } });
    expect(await controlBag.get(`${OUTCOME_URI_PREFIX}r3`), "the outcome rests in the control document").not.toBeNull();
    const index = await controlBag.get(`${EFFECT_URI_PREFIX}effect-key-3`);
    expect(index, "the effect index rests in the control document").not.toBeNull();
    expect(index?.tiddler["request-id"], "CONTROL: the row still names its attempt").toBe("r3");
    expect(await slot.listVisible(), "the mirrored working slot rests neither").toEqual([]);
    expect(await daemonBag.listVisible(), "the daemon document rests neither").toEqual([]);
    expect(JSON.parse(String((await control.get(`${OUTCOME_URI_PREFIX}r3`))?.tiddler["results"]))).toEqual({ summary: { ok: true, output: { body: "private-heron" } } });
  });
});
