import { describe, expect, test } from "vitest";
import { CompositeStore, type Verb, type VerbContext } from "@lararium/mesh";
import { makeActionReactorFor } from "../src/action-handler.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";

const CANON = "lar:///ha.ka.ba/bags/probe-book";
const WORKING = "lar:///ha.ka.ba/wikis/probe-book/working";
const allow = async () => ({ ok: true as const });

function reactor(working = true) {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: CANON, store: new MemoryTiddlerStore(), writable: true });
  if (working) composite.addLayer({ bagId: WORKING, store: new MemoryTiddlerStore(), writable: true });
  const invocation: Verb = { requestId: "req", title: "lar:///lararium.local.vm/verbs/req", action: "LOAD", args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-10-19T00:00:00Z" } as Verb;
  const context: VerbContext = { daemon: composite, invocation, cap: allow };
  return { load: makeActionReactorFor("LOAD", { composite, reach: undefined }) as (args: Record<string, unknown>, ctx: VerbContext) => Promise<Record<string, unknown>>, context };
}

const args = (to: string, extra: Record<string, unknown> = {}) => ({ "to-bag": to, "source-uri": "file:///load", "change-id": "load-working", carriers: [{ title: "lar:///t/probe-book/one", text: "one" }], ...extra });

describe("LOAD lands on a wiki working layer", () => {
  test.each([false, true])("canon LOAD refuses with the working and MOVE route (dry-run=%s)", async (dryRun) => {
    const r = reactor();
    await expect(r.load(args(CANON, dryRun ? { "dry-run": true } : {}), r.context)).rejects.toThrow(/load-into-canon.*lar:\/\/\/ha\.ka\.ba\/wikis\/probe-book\/working.*MOVE/);
  });

  test("the island reactor applies the same canon refusal", async () => {
    const r = reactor(false);
    await expect(r.load(args(CANON), r.context)).rejects.toThrow(/load-into-canon/);
  });

  test("CONTROL: LOAD to working lands", async () => {
    const r = reactor();
    await expect(r.load(args(WORKING), r.context)).resolves.toMatchObject({ verb: "LOAD" });
  });

  test("CONTROL: the founding seed door admits canon LOAD", async () => {
    const r = reactor();
    await expect(r.load(args(CANON, { "seed-door": "founding" }), r.context)).resolves.toMatchObject({ verb: "LOAD" });
  });
});
