/**
 * uds-floor-answers — A PLACE WITH NO READABLE CONTROL DOCUMENT STILL ANSWERS ITS FLOOR (house decision, brief item 1).
 *
 * Elyncia-5492: the crossroads herm at Saltmere holds no face and never will; the ferry-wardens hand it a carry bundle
 * and ask it where a flow record rests. Gaia-2026: a public relay box on a library shelf, faceless by design. A herm's
 * control document never mints (it mints with the face), so its verb door stood a stand-in that refused EVERY
 * invocation `control-home-unnamed`: the carry bundle, the `where`, and the lift's own founding refusal never answered.
 *
 *   F1 — RED: a faceless place answers a read-only `where` and a place row (`nexus-carry-take`) on the maintenance frame;
 *        the answer waits in the floor store's memory, claims no durability and rests no receipt fact
 *   F2 — CONTROL: a verb outside the floor (`memory-write`) refuses `control-home-unnamed` and places nothing
 *   F3 — CONTROL: a locked hearth's place row runs on the floor; its memory write refuses `vessel-locked`
 *   F4 — an id the floor already answered reads back, never runs twice; a receipt the floor never held refuses by name
 */
import { describe, expect, test } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import * as A from "@automerge/automerge";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import {
  SealedDocumentStore, bindSecretHomeRest, concludeVerb, controlHomeRefusal, controlStoreOf, emptyLarDoc, enrollSecretHome,
  mintSecretHomeAddress, mintVesselDocumentId, nameControlHome, standControlHome, vesselHeldHomes,
  CONTROL_HOME_UNNAMED, RECEIPT_FACT_URI_PREFIX, OUTCOME_URI_PREFIX, VESSEL_LOCKED, type CompositeStore, type LarDoc,
} from "@lararium/mesh";
import { startUdsChannel } from "../src/uds-channel.js";
import { FLOOR_VERBS } from "../src/floor-verbs.js";
import { claimStore } from "../src/owned-store.js";

describe("a place with no readable control document answers its floor", () => {
  test("F1/F2/F4 — RED (the Saltmere herm): a faceless place answers `where` and a carry take; a memory write refuses `control-home-unnamed`", async () => {
    const v = faceless();
    const control = await standControlHome(v.repo, v.daemon);
    expect(controlHomeRefusal(control)?.refusal).toBe(CONTROL_HOME_UNNAMED);
    const store = controlStoreOf(control);
    const placed: string[] = [];
    const seat = await door(control, store, v.repo, (o) => { placed.push(o.verb); answerLater(store, o); });
    try {
      const where = await send(seat.socketPath, { verb: "where", args: { tiddler: "$:/lares/flow" }, requestedBy: "did:key:warden", requestId: "saltmere-where" });
      expect(where["status"], JSON.stringify(where)).toBe("done");
      expect(where["durable"]).toBeUndefined();
      const carried = await send(seat.socketPath, { verb: "nexus-carry-take", args: { raw: "{}" }, requestedBy: "did:key:warden", requestId: "saltmere-carry" });
      expect(carried["status"], JSON.stringify(carried)).toBe("done");
      // F2: a verb outside the floor refuses by the stand-in's name, and nothing is placed for it.
      const write = await send(seat.socketPath, { verb: "memory-write", args: { text: "heron" }, requestedBy: "did:key:warden", requestId: "saltmere-write" });
      expect(write["status"]).toBe("error");
      expect(write["refusal"]).toEqual({ reason: CONTROL_HOME_UNNAMED });
      expect(placed).toEqual(["where", "nexus-carry-take"]);
      // F4: the answered id reads back and never runs twice; a receipt the floor never held refuses by name.
      const again = await send(seat.socketPath, { verb: "where", args: { tiddler: "$:/lares/flow" }, requestedBy: "did:key:warden", requestId: "saltmere-where" });
      expect(again["status"]).toBe("done");
      expect(placed).toEqual(["where", "nexus-carry-take"]);
      const held = await send(seat.socketPath, { op: "receipt", requestId: "saltmere-carry" });
      expect(held["state"]).toBe("done");
      const never = await send(seat.socketPath, { op: "receipt", requestId: "saltmere-write" });
      expect(never["refusal"]).toEqual({ reason: CONTROL_HOME_UNNAMED });
      // NOTHING RESTS: the stand-in's document holds no receipt fact and no outcome.
      expect(titles(control, RECEIPT_FACT_URI_PREFIX)).toEqual([]);
      expect(titles(control, OUTCOME_URI_PREFIX)).toEqual([]);
    } finally { await seat.close(); }
    await v.repo.shutdown();
  });

  test("F3 — CONTROL (Gaia Tuesday, locked): a place row runs on the floor; the memory write still refuses `vessel-locked`", async () => {
    const v = await foundedThenLocked();
    const control = await standControlHome(v.repo, v.daemon);
    expect(controlHomeRefusal(control)?.refusal).toBe(VESSEL_LOCKED);
    const store = controlStoreOf(control);
    const placed: string[] = [];
    const seat = await door(control, store, v.repo, (o) => { placed.push(o.verb); answerLater(store, o); });
    try {
      const carried = await send(seat.socketPath, { verb: "nexus-carry-take", args: { raw: "{}" }, requestedBy: "did:key:gaia", requestId: "tuesday-carry" });
      expect(carried["status"], JSON.stringify(carried)).toBe("done");
      const write = await send(seat.socketPath, { verb: "memory-write", args: { text: "heron" }, requestedBy: "did:key:gaia", requestId: "tuesday-write" });
      expect(write["refusal"]).toEqual({ reason: VESSEL_LOCKED });
      expect(placed).toEqual(["nexus-carry-take"]);
    } finally { await seat.close(); }
    await v.repo.flush();
    expect(v.store.waiting(v.address.controlId)).toBe(0);
    await v.repo.shutdown();
  });

  test("the floor holds the read-only queries and every row of the place, never a row that acts as a face", () => {
    expect(FLOOR_VERBS.has("where")).toBe(true);
    expect(FLOOR_VERBS.has("nexus-carry-take")).toBe(true);
    expect(FLOOR_VERBS.has("persona-new")).toBe(true);
    for (const face of ["kahua-propose", "intent-issue", "memory-write", "meme-put", "circle-list"]) expect(FLOOR_VERBS.has(face), face).toBe(false);
  });
});

/** The island's part, played here: the act's outcome lands in the floor store a beat after the door places it. */
function answerLater(store: CompositeStore, o: { requestId: string; verb: string }): void {
  setTimeout(() => {
    void store.put(concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", cause: "test-island", batchMode: "best-effort",
      results: { summary: { ok: true, output: { answered: o.verb } } } }), { kind: "lares-verb", requestId: o.requestId });
  }, 20);
}

async function door(controlHandle: Awaited<ReturnType<typeof standControlHome>>, control: CompositeStore, repo: Repo, placeVerb: (o: { requestId: string; verb: string }) => void) {
  const dir = mkdtempSync(join(tmpdir(), "uds-floor-"));
  const claim = await claimStore(dir, { holder: "vessel" });
  const channel = startUdsChannel({ controlHandle, control, claim, repo, timeoutMs: 3_000, placeVerb });
  for (let i = 0; i < 100 && !existsSync(claim.socketPath); i++) await new Promise((r) => setTimeout(r, 10));
  return { socketPath: claim.socketPath, close: async () => { await channel.close(); await claim.release(); rmSync(dir, { recursive: true, force: true }); } };
}

function send(socketPath: string, inv: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const sock = createConnection(socketPath);
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("connect", () => sock.write(JSON.stringify(inv) + "\n"));
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl !== -1) { const line = buf.slice(0, nl); sock.end(); resolve(JSON.parse(line)); }
    });
    sock.on("error", reject);
  });
}

const titles = (handle: { doc(): LarDoc | undefined }, prefix: string): string[] =>
  Object.keys(handle.doc()?.tiddlers ?? {}).filter((t) => t.startsWith(prefix));

/** A herm: a sealed rest with no secret home and a daemon document that names no control document. */
function faceless() {
  const held = heldRepo(memoryAdapter());
  return { repo: held.repo, daemon: held.repo.create<LarDoc>(emptyLarDoc()) };
}

/** A vessel founded with its face (home and control minted, the daemon document naming control), then booted locked. */
async function foundedThenLocked() {
  const inner = memoryAdapter();
  const founding = heldRepo(inner);
  const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
  await enrollSecretHome(founding.repo, address);
  const daemonBytes = A.save((() => { const d = founding.repo.create<LarDoc>(emptyLarDoc()); nameControlHome(d, `automerge:${address.controlId}`); return d.doc(); })());
  await founding.repo.flush();
  await founding.repo.shutdown();
  const locked = heldRepo(inner);
  return { address: address as typeof address & { controlId: string }, repo: locked.repo, store: locked.store, daemon: locked.repo.import<LarDoc>(daemonBytes) };
}

function memoryAdapter(): StorageAdapterInterface {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => starts(k, prefix)).map(([k, data]) => ({ key: k.split("\u0000"), data: Uint8Array.from(data) })); },
    async removeRange(prefix) { for (const k of [...bytes.keys()]) if (starts(k, prefix)) bytes.delete(k); },
  };
}

function heldRepo(inner: StorageAdapterInterface) {
  const homes = vesselHeldHomes();
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const store = new SealedDocumentStore({ inner, bagOf: (id) => homes.bagOf(id), sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, waitOverSealed: true, hydrates: false });
  const repo = new Repo({ storage: store, network: [] });
  bindSecretHomeRest(repo, homes.rest((id) => store.holdsSealed(id), () => { store.mapMoved(); void store.reseal(); }));
  return { repo, store };
}
