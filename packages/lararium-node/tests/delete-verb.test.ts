/**
 * delete-verb.test.ts — the INGEST verb's whole-carrier deletion wave
 * (watcher build 4, moʻolelo 2026-06-14). Synthetic carriers (no live-boot
 * fixture — the fixture-drift lesson holds): seed N small carriers, then send a
 * wave carrying `deletions` and assert the gate's split applies correctly.
 *
 * Under proof:
 *   - a vanished carrier that pairs with no arrival → declined; no wave tombstones a carrier
 *   - a flood of vanished addresses → each declined, nothing removed, no brake named
 *   - an ambiguous pair → declined on the island's own word
 *   - a unique hash-matched add → rename re-link, change-id PRESERVED
 */

import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh";
import type { ChangeOrigin, LarTiddlerRecord, VerbContext, Verb, CapabilityAccess, CapabilityVerifyResult } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { VerbTable } from "../../lararium-tw5/src/verb-dispatcher.js";
import { registerActionReactors } from "../../lararium-tw5/src/action-handler.js";

const BAG = "lar:///ha.ka.ba/bags/lares";

function makeComposite(): CompositeStore {
  const c = new CompositeStore();
  c.addLayer({ bagId: BAG, store: new MemoryTiddlerStore(), writable: true });
  return c;
}

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });

function ctx(composite: CompositeStore, args: Record<string, unknown>): VerbContext {
  const invocation: Verb = {
    requestId: "req-del-1",
    title: "lar:///lararium.local.vm/verbs/req-del-1",
    action: "INGEST", args, targets: [], batchMode: "best-effort",
    status: "pending", requestedBy: "operator-test", requestedAt: "2026-06-14T00:00:00Z",
  };
  return { daemon: composite, invocation, cap: allowCap };
}

/** Seed `n` single-record synthetic carriers lar:///c0..c{n-1}, each its own changeId. */
async function seedCarriers(composite: CompositeStore, n: number): Promise<void> {
  const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: BAG };
  for (let i = 0; i < n; i++) {
    const uri = `lar:///c${i}`;
    const record: LarTiddlerRecord = { tiddler: { title: uri, text: `body ${i}` } as LarTiddlerRecord["tiddler"], meta: { changeId: `cid-${i}` } };
    await composite.put(record, origin, { bag: BAG });
  }
}

async function seedOne(composite: CompositeStore, uri: string, changeId: string): Promise<void> {
  const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: BAG };
  const record: LarTiddlerRecord = { tiddler: { title: uri, text: "renameable body" } as LarTiddlerRecord["tiddler"], meta: { changeId } };
  await composite.put(record, origin, { bag: BAG });
}

function waveArgs(opts: {
  deletions?: Array<{ uri: string; syncedHash: string }>;
  carriers?: Array<{ uri: string; text: string; diskHash: string; syncedHash: string | null }>;
}): Record<string, unknown> {
  return {
    "source-uri": "file:///staged",
    "to-bag": BAG,
    "change-id": "chg-wave",
    carriers: opts.carriers ?? [],
    ...(opts.deletions ? { deletions: opts.deletions } : {}),
  };
}

async function liveTitles(composite: CompositeStore): Promise<string[]> {
  return (await composite.listVisible()).sort();
}

/** Carrier titles only — drops the withEffectRecord residency-ledger entries. */
const carriersOnly = (titles: readonly string[]): string[] => titles.filter((t) => /^lar:\/\/\/[a-z-]+\d*$/.test(t));

describe("INGEST — the vanished addresses a wave names", () => {
  test("★ a vanished carrier that pairs with no arrival tombstones nothing: the island declines it by name ★", async () => {
    const composite = makeComposite();
    await seedCarriers(composite, 10);
    const before = await liveTitles(composite);
    const table = new VerbTable();
    registerActionReactors(table, { composite });

    const args = waveArgs({ deletions: [{ uri: "lar:///c0", syncedHash: "h0" }] });
    const result = await table.get("INGEST")!(args, ctx(composite, args)) as Record<string, unknown>;

    expect(result["deletions"]).toEqual({ renames: [], absent: [], declined: ["lar:///c0"] });
    expect(carriersOnly(await liveTitles(composite)), "a wave removed a carrier no person named").toEqual(carriersOnly(before));
    expect((result["carriers"] as Array<Record<string, unknown>>).filter((c) => c["decision"] === "tombstone")).toEqual([]);
  });

  test("★ a flood of vanished addresses removes nothing, and the answer names no brake ★", async () => {
    const composite = makeComposite();
    await seedCarriers(composite, 10);
    const before = await liveTitles(composite);
    const table = new VerbTable();
    registerActionReactors(table, { composite });

    const deletions = [0, 1, 2, 3, 4, 5].map((i) => ({ uri: `lar:///c${i}`, syncedHash: `h${i}` }));
    const args = waveArgs({ deletions });
    const result = await table.get("INGEST")!(args, ctx(composite, args)) as Record<string, unknown>;

    expect(result["deletions"]).toEqual({ renames: [], absent: [], declined: deletions.map((d) => d.uri) });
    expect(carriersOnly(await liveTitles(composite))).toEqual(carriersOnly(before));
  });

  test("★ one vanished address and two files of the wave that hold its bytes: nothing re-links and nothing leaves ★", async () => {
    const composite = makeComposite();
    await seedOne(composite, "lar:///old-name", "cid-keepme");
    const table = new VerbTable();
    registerActionReactors(table, { composite });

    const args = waveArgs({
      deletions: [{ uri: "lar:///old-name", syncedHash: "HMATCH" }],
      carriers: [
        { uri: "lar:///new-name", text: "renamed content", diskHash: "HMATCH", syncedHash: null },
        { uri: "lar:///twin-name", text: "renamed content", diskHash: "HMATCH", syncedHash: null },
      ],
    });
    const result = await table.get("INGEST")!(args, ctx(composite, args)) as Record<string, unknown>;

    expect((result["deletions"] as Record<string, unknown>)["declined"]).toEqual(["lar:///old-name"]);
    expect(await liveTitles(composite), "the ambiguous source left the records").toContain("lar:///old-name");
  });

  test("a vanished source whose records hold nothing reads absent, and its arrival lands as itself", async () => {
    const composite = makeComposite();
    const table = new VerbTable();
    registerActionReactors(table, { composite });
    const args = waveArgs({
      deletions: [{ uri: "lar:///never-landed", syncedHash: "HMATCH" }],
      carriers: [{ uri: "lar:///new-name", text: "renamed content", diskHash: "HMATCH", syncedHash: null }],
    });
    const result = await table.get("INGEST")!(args, ctx(composite, args)) as Record<string, unknown>;
    expect(result["deletions"]).toEqual({ renames: [], absent: ["lar:///never-landed"], declined: [] });
    expect(await liveTitles(composite)).toContain("lar:///new-name");
  });

  test("★ a re-link never lands over records that stand at its target: the source declines and the target meets the gate ★", async () => {
    const seeded = async (): Promise<CompositeStore> => {
      const composite = makeComposite();
      await seedOne(composite, "lar:///old-name", "cid-keepme");
      const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: BAG };
      await composite.put({ tiddler: { title: "lar:///new-name", text: "words that already stand here" } as LarTiddlerRecord["tiddler"], meta: { changeId: "cid-there" } }, origin, { bag: BAG });
      return composite;
    };
    const wave = (unattended: boolean): Record<string, unknown> => ({
      ...waveArgs({
        deletions: [{ uri: "lar:///old-name", syncedHash: "HMATCH" }],
        carriers: [{ uri: "lar:///new-name", text: "renamed content", diskHash: "HMATCH", syncedHash: null }],
      }),
      ...(unattended ? { unattended: true } : {}),
    });
    const textAt = async (composite: CompositeStore, uri: string): Promise<unknown> =>
      (await composite.resolveAll(uri)).find((e) => e.bagId === BAG)?.record.tiddler["text"];

    // A wave no person stands behind: nothing re-links, nothing lands, both carriers stand as they stood.
    const quiet = await seeded();
    const quietTable = new VerbTable();
    registerActionReactors(quietTable, { composite: quiet });
    const stood = await quietTable.get("INGEST")!(wave(true), ctx(quiet, wave(true))) as Record<string, unknown>;
    expect(stood["deletions"]).toEqual({ renames: [], absent: [], declined: ["lar:///old-name"] });
    expect((stood["carriers"] as Array<Record<string, unknown>>).find((c) => c["uri"] === "lar:///new-name")).toMatchObject({ decision: "conflict", reason: "no-base" });
    expect(await textAt(quiet, "lar:///new-name"), "a re-link replaced records that stood at its target, unweighed").toBe("words that already stand here");
    expect(await liveTitles(quiet)).toContain("lar:///old-name");

    // CONTROL: a person's wave adopts the file at the target; the source still declines and stands.
    const named = await seeded();
    const namedTable = new VerbTable();
    registerActionReactors(namedTable, { composite: named });
    const adopted = await namedTable.get("INGEST")!(wave(false), ctx(named, wave(false))) as Record<string, unknown>;
    expect((adopted["deletions"] as Record<string, unknown>)["declined"]).toEqual(["lar:///old-name"]);
    expect(await textAt(named, "lar:///new-name")).toBe("renamed content");
    expect(await liveTitles(named)).toContain("lar:///old-name");
  });

  test("unique hash-matched add → rename re-link, change-id PRESERVED", async () => {
    const composite = makeComposite();
    await seedCarriers(composite, 10);
    await seedOne(composite, "lar:///old-name", "cid-keepme");
    const table = new VerbTable();
    registerActionReactors(table, { composite });

    const args = waveArgs({
      deletions: [{ uri: "lar:///old-name", syncedHash: "HMATCH" }],
      carriers: [{ uri: "lar:///new-name", text: "renamed content", diskHash: "HMATCH", syncedHash: null }],
    });
    const result = await table.get("INGEST")!(args, ctx(composite, args)) as Record<string, unknown>;

    expect(result["deletions"]).toEqual({ renames: [{ fromUri: "lar:///old-name", toUri: "lar:///new-name" }], absent: [], declined: [] });
    const after = await liveTitles(composite);
    expect(after).not.toContain("lar:///old-name");
    expect(after).toContain("lar:///new-name");

    // The re-link preserved the original change-id — NOT the wave's "chg-wave".
    const moved = (await composite.resolveAll("lar:///new-name")).find((e) => e.bagId === BAG)!.record;
    expect(moved.meta?.["changeId"]).toBe("cid-keepme");
  });
});
