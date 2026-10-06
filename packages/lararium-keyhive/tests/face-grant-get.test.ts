/**
 * face-grant-get.test — THE RECORD OVER THE SUMMARY, the daemon's read door for a face-join grant record.
 *
 * A `face-join` outcome is a bounded view: past the outcome cap its `capEvents` fold to a count and a digest. The
 * authoritative act is the `face-join-grant/v1` record the verb writes to the PersonaGroup plane. `face-grant-get`
 * reads that record back through the SAME store the write reaches, so a caller reads the act, never its view.
 *
 *   G1 — a record standing at THIS group's title for the named joinee reads back whole
 *   G2 — CONTROL: an absent joinee reads null, never another joinee's record
 *   G3 — CONTROL: a record under ANOTHER group's title, on the same plane, never answers for this group
 *   G4 — CONTROL: a tombstoned record reads null
 *   G5 — CONTROL: a call naming no joinee refuses, naming the argument
 *   G6 — a faceless floor registers no grant read, as it registers no join
 */
import { describe, test, expect } from "vitest";
import { MessageChannel } from "node:worker_threads";
import { makeIslandRepo, personaBagIdFor, type LarDoc } from "@lararium/mesh";
import { VerbTable } from "@lararium/tw5";
import { operatorDaemonOptions } from "../src/operator-daemon-behavior.js";
import { faceGrantTitle } from "../src/face-grant-record.js";

const GROUP       = "ab".repeat(16);
const OTHER_GROUP = "ef".repeat(16);
const JOINEE      = `0x${"cd".repeat(8)}${"6".repeat(64)}`;
const OTHER       = `0x${"cd".repeat(8)}${"7".repeat(64)}`;

const manifest = (face: boolean) => ({
  daemonAuth: {
    vesselVerifyingKey: "a".repeat(64),
    registerBags: [],
    ...(face ? { personaGroupDocIdHex: GROUP, personaGroupAgentIdHex: "cd".repeat(16) } : {}),
  },
}) as never;

/** A stand-in record body — the read door carries bytes back and judges nothing. */
const recordFor = (group: string, joinee: string, capEvents: string[]) => ({
  kind: "face-join-grant/v1", groupDocIdHex: group, joineeAgentIdHex: joinee, capEvents, reKeyed: true, regranted: 2, sig: "00",
});

type Rows = Record<string, { text: string; deleted?: boolean }>;

/** An in-memory catalog naming this group's PersonaGroup plane, and that plane holding `rows`. */
function standPlane(rows: Rows) {
  // A repo with no peer on the far end of its port: every doc it holds is one this test created.
  const { port1, port2 } = new MessageChannel();
  port1.unref(); port2.unref();
  const repo = makeIslandRepo({ syncPort: port1 } as never);
  const plane = repo.create<LarDoc>({ tiddlers: {} } as unknown as LarDoc);
  plane.change((d) => {
    for (const [title, { text, deleted }] of Object.entries(rows)) {
      (d.tiddlers as Record<string, unknown>)[title] = { tiddler: { title, text }, meta: deleted ? { deleted: true } : {} };
    }
  });
  const bag = personaBagIdFor(GROUP);
  const catalog = repo.create<LarDoc>({ tiddlers: { [bag]: { tiddler: { title: bag, text: plane.url }, meta: {} } } } as unknown as LarDoc);
  return { repo, catalogUrl: catalog.url };
}

function wire(face: boolean, rows: Rows = {}) {
  const { repo, catalogUrl } = standPlane(rows);
  const registry = new VerbTable();
  const ctx = { composite: {}, repo, catalogUrl, oracleUrl: "automerge:fakeOracle", tw5: {}, post: () => {} } as never;
  operatorDaemonOptions(manifest(face)).wireWorkerVerbs?.(registry, ctx);
  expect(registry.list().length, "the wiring pass never ran").toBeGreaterThan(0);
  return registry;
}

const read = async (registry: VerbTable, args: Record<string, unknown>) =>
  (await registry.get("face-grant-get")!(args, {} as never)) as { title: string; record: Record<string, unknown> | null };

describe("face-grant-get — the record, read back through the store the join wrote", () => {
  test("G1 — the record at this group's title for the named joinee reads back whole", async () => {
    const events = Array.from({ length: 40 }, (_, i) => `ev-${i}`);
    const title = faceGrantTitle(GROUP, JOINEE);
    const r = await read(wire(true, { [title]: { text: JSON.stringify(recordFor(GROUP, JOINEE, events)) } }), { joinee: JOINEE });
    expect(r.title).toBe(title);
    // Past the outcome cap of 32, and still an ARRAY — the record is never folded into a view.
    expect(r.record?.["capEvents"]).toEqual(events);
    expect(r.record?.["regranted"]).toBe(2);
  });

  test("G2 — CONTROL: an absent joinee reads null, never another joinee's record", async () => {
    const r = await read(wire(true, { [faceGrantTitle(GROUP, OTHER)]: { text: JSON.stringify(recordFor(GROUP, OTHER, ["x"])) } }), { joinee: JOINEE });
    expect(r.record).toBeNull();
  });

  test("G3 — CONTROL: another group's record on the same plane never answers for this group", async () => {
    const r = await read(wire(true, { [faceGrantTitle(OTHER_GROUP, JOINEE)]: { text: JSON.stringify(recordFor(OTHER_GROUP, JOINEE, ["x"])) } }), { joinee: JOINEE });
    expect(r.title).toBe(faceGrantTitle(GROUP, JOINEE));
    expect(r.record).toBeNull();
  });

  test("G4 — CONTROL: a tombstoned record reads null", async () => {
    const title = faceGrantTitle(GROUP, JOINEE);
    const r = await read(wire(true, { [title]: { text: JSON.stringify(recordFor(GROUP, JOINEE, ["x"])), deleted: true } }), { joinee: JOINEE });
    expect(r.record).toBeNull();
  });

  test("G5 — CONTROL: a call naming no joinee refuses, naming the argument", async () => {
    await expect(read(wire(true), {})).rejects.toThrow(/args\.joinee/);
  });

  test("G6 — a faceless floor registers no grant read, as it registers no join", () => {
    const registry = wire(false);
    expect(registry.has("face-join")).toBe(false);
    expect(registry.has("face-grant-get")).toBe(false);
  });
});
