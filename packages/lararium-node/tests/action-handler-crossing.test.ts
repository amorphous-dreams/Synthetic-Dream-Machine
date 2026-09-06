/**
 * action-handler-crossing — the gate reads a crossing's DIRECTION and prices it.
 *
 * `crossingDirection` carries the rule (inward cheap · lateral read · outward wants the kahu-cabal),
 * and until this wire the gate branched on the VERB instead — the price followed the wrong axis, so an
 * OUTWARD copy passed on a read cap alone. These vectors assert the production path collects the price
 * the module names.
 *
 * The tier seam: `ActionHandlerOptions.bagTier` — a reader from bag URL to its resolved `CapTier`, or
 * null where no tier stands declared. Fail-closed: an absent reader (and a null answer) reads VEIL, and
 * veil→veil runs LATERAL, so a vessel that threads no reader keeps exactly the behavior it had.
 *
 * Register: unbuilt-laws ⑤ — A GATE CAN READ A BAG'S TIER · AN OUTWARD COPY WITHOUT A CABAL SIGNATURE
 * REFUSES. Meme: lar:///ha.ka.ba/lararium/mesh/cap-tier
 */

import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh";
import type {
  ActionVerb, ChangeOrigin, LarTiddlerRecord, VerbContext, Verb,
  CapabilityAccess, CapabilityVerifyResult, CapTier,
} from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { VerbTable } from "../../lararium-tw5/src/verb-dispatcher.js";
import { registerActionReactors } from "../../lararium-tw5/src/action-handler.js";

// ---------------------------------------------------------------------------
// Fixtures — two bags at declared tiers, a reader over them, an allow-all cap
// ---------------------------------------------------------------------------

const BAG_VEIL   = "lar:///ha.ka.ba/bags/veiled";
const BAG_PUBLIC = "lar:///ha.ka.ba/bags/shelf";

const TIERS: Readonly<Record<string, CapTier>> = {
  [BAG_VEIL]:   "veil",
  [BAG_PUBLIC]: "public",
};

function bagTier(bagUrl: string): CapTier | null {
  return TIERS[bagUrl] ?? null;
}

function makeComposite(): CompositeStore {
  const c = new CompositeStore();
  c.addLayer({ bagId: BAG_VEIL,   store: new MemoryTiddlerStore(), writable: true, defaultWritable: false });
  c.addLayer({ bagId: BAG_PUBLIC, store: new MemoryTiddlerStore(), writable: true });
  return c;
}

function alwaysAllowCap(): VerbContext["cap"] {
  return async (_access: CapabilityAccess, _bagUrl: string): Promise<CapabilityVerifyResult> => ({ ok: true });
}

function makeContext(composite: CompositeStore, verb: ActionVerb, args: Record<string, unknown>): VerbContext {
  const invocation: Verb = {
    requestId:   "req-x",
    title:       `lar:///lararium.local.vm/verbs/req-x`,
    action:      verb,
    args,
    targets:     [],
    batchMode:   "best-effort",
    status:      "pending",
    requestedBy: "operator-test",
    requestedAt: "2026-09-05T00:00:00Z",
  };
  return { daemon: composite, invocation, cap: alwaysAllowCap() };
}

function seedTiddler(composite: CompositeStore, bag: string, title: string, text: string, changeId?: string): Promise<void> {
  const record: LarTiddlerRecord = {
    tiddler: { title, text },
    ...(changeId !== undefined && { meta: { changeId } }),
  };
  const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: bag };
  return composite.put(record, origin, { bag });
}

function makeTable(composite: CompositeStore): VerbTable {
  const table = new VerbTable();
  registerActionReactors(table, { composite, bagTier });
  return table;
}

// ---------------------------------------------------------------------------
// ⑤ the outward gate — the price follows the DIRECTION
// ---------------------------------------------------------------------------

describe("crossing direction pricing", () => {
  test("★ AN OUTWARD COPY WITHOUT A CABAL SIGNATURE REFUSES ★", async () => {
    // veil → public relaxes confinement with no return crossing; the decision to relax
    // belongs to the kahu-cabal quorum, and no cabal signature rides this invocation.
    const composite = makeComposite();
    const table = makeTable(composite);
    await seedTiddler(composite, BAG_VEIL, "Secret", "held for few", "c-1");

    const handler = table.get("COPY")!;
    const args = { title: "Secret", "from-bag": BAG_VEIL, "to-bag": BAG_PUBLIC, "change-id": "c-1" };
    await expect(handler(args, makeContext(composite, "COPY", args)))
      .rejects.toThrow(/outward|cabal/i);
  });

  test("★ AN OUTWARD MOVE REFUSES THE SAME WAY ★", async () => {
    // MOVE relaxes confinement exactly as COPY does, and additionally tombstones the source.
    const composite = makeComposite();
    const table = makeTable(composite);
    await seedTiddler(composite, BAG_VEIL, "Secret", "held for few", "c-1");

    const handler = table.get("MOVE")!;
    const args = { title: "Secret", "from-bag": BAG_VEIL, "to-bag": BAG_PUBLIC, "change-id": "c-1" };
    await expect(handler(args, makeContext(composite, "MOVE", args)))
      .rejects.toThrow(/outward|cabal/i);
  });

  test("the INWARD copy stays cheap — the recipe stack depends on it", async () => {
    // public → veil raises confinement: the shadow-copy shape, priced at read and nothing more.
    const composite = makeComposite();
    const table = makeTable(composite);
    await seedTiddler(composite, BAG_PUBLIC, "Shelf", "held for many", "c-2");

    const handler = table.get("COPY")!;
    const args = { title: "Shelf", "from-bag": BAG_PUBLIC, "to-bag": BAG_VEIL, "change-id": "c-2" };
    const outcome = await handler(args, makeContext(composite, "COPY", args));
    expect(outcome).toBeTruthy();
    expect((await composite.resolveAll("Shelf")).map((e) => e.bagId)).toContain(BAG_VEIL);
  });

  test("an ABSENT reader keeps today's behavior — veil meets veil and runs lateral", async () => {
    // A vessel that threads no bagTier reader fails closed to VEIL on both sides: lateral,
    // read-priced, no cabal — byte-for-byte the gate's standing behavior before this wire.
    const composite = makeComposite();
    const table = new VerbTable();
    registerActionReactors(table, { composite });
    await seedTiddler(composite, BAG_VEIL, "Plain", "x", "c-3");

    const handler = table.get("COPY")!;
    const args = { title: "Plain", "from-bag": BAG_VEIL, "to-bag": BAG_PUBLIC, "change-id": "c-3" };
    const outcome = await handler(args, makeContext(composite, "COPY", args));
    expect(outcome).toBeTruthy();
  });
});
