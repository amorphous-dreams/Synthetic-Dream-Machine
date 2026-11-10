/**
 * uds-locked-fails-closed — A LOCKED HEARTH FAILS CLOSED at the verb door (operator ruling 2026-11-09).
 *
 * Gaia boots her node vessel on Tuesday and forgets to unlock it. Her MCP memory write reaches the UDS door while the
 * vessel's key stays shut: the control document stands as a stand-in (`standControlHome`), so the door answers
 * `vessel-locked`, places no verb, writes no receipt fact and claims no durability. She unlocks (the vessel recomposes
 * over the opened key) and retries under the same request id: it lands once. A second retry lands nothing new.
 *
 *   L1 — RED (Gaia Tuesday): locked, the invocation and its receipt read both refuse `vessel-locked`; nothing runs or rests
 *   L2 — RED (midnight petitioner): the receipt ledger over a locked control store answers no fact, durable or otherwise
 *   L3 — CONTROL: after unlock the same request id lands once, and a retry answers the outcome with no second placement
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
  mintSecretHomeAddress, mintVesselDocumentId, nameControlHome, openSecretHome, standControlHome, vesselHeldHomes,
  OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX, VESSEL_LOCKED, type LarDoc,
} from "@lararium/mesh";
import { FactLedger, startUdsChannel } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";

describe("a locked hearth fails closed at the verb door", () => {
  test("L1/L3 — RED (Gaia Tuesday): locked, a memory write refuses `vessel-locked` and nothing runs or rests; after unlock the same id lands once, and a retry lands nothing new", async () => {
    const v = await foundedThenLocked();
    const control = await standControlHome(v.repo, v.daemon);
    expect(controlHomeRefusal(control)?.refusal).toBe(VESSEL_LOCKED);

    let placed = 0;
    const first = await door(control, v.repo, () => { placed += 1; });
    try {
      const refused = await send(first.socketPath, { verb: "memory-write", args: { text: "heron" }, requestedBy: "did:key:gaia", requestId: "tuesday-1" });
      expect(refused["status"]).toBe("error");
      expect(refused["refusal"]).toEqual({ reason: VESSEL_LOCKED });
      expect(refused["durable"]).toBeUndefined();
      const receipt = await send(first.socketPath, { op: "receipt", requestId: "tuesday-1" });
      expect(receipt["refusal"]).toEqual({ reason: VESSEL_LOCKED });
      expect(placed).toBe(0);
    } finally { await first.close(); }
    await v.repo.flush();
    expect(v.store.waiting(v.address.controlId)).toBe(0);

    // THE UNLOCK: the key opens and the vessel recomposes, standing the control document itself.
    await openSecretHome(v.repo, v.address);
    const opened = await standControlHome(v.repo, v.daemon);
    expect(controlHomeRefusal(opened)).toBeNull();
    expect(titles(opened, RECEIPT_FACT_URI_PREFIX)).toEqual([]);
    const openedStore = controlStoreOf(opened);
    const second = await door(opened, v.repo, (o) => {
      placed += 1;
      setTimeout(() => { void openedStore.put(concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", cause: "test-island", batchMode: "best-effort", results: { summary: { ok: true, output: { landed: true } } } }), { kind: "lares-verb", requestId: o.requestId }); }, 20);
    }, openedStore);
    try {
      const landed = await send(second.socketPath, { verb: "memory-write", args: { text: "heron" }, requestedBy: "did:key:gaia", requestId: "tuesday-1" });
      expect(landed["status"], JSON.stringify(landed)).toBe("done");
      const retry = await send(second.socketPath, { verb: "memory-write", args: { text: "heron" }, requestedBy: "did:key:gaia", requestId: "tuesday-1" });
      expect(retry["status"], JSON.stringify(retry)).toBe("done");
      expect(placed).toBe(1);
      expect(titles(opened, OUTCOME_URI_PREFIX)).toEqual([`${OUTCOME_URI_PREFIX}tuesday-1`]);
      expect(titles(opened, RECEIPT_FACT_URI_PREFIX)).toEqual([`${RECEIPT_FACT_URI_PREFIX}tuesday-1`]);
    } finally { await second.close(); }
    await v.repo.shutdown();
  });

  test("L2 — RED (midnight petitioner): the receipt ledger over a locked control store answers no fact, durable or absent; it refuses `vessel-locked`", async () => {
    const v = await foundedThenLocked();
    const control = await standControlHome(v.repo, v.daemon);
    const ledger = new FactLedger(controlStoreOf(control), v.repo, 16, 1);
    await expect(ledger.get("midnight-1")).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await expect(ledger.arbitrate("midnight-1", "digest", undefined, "memory-write")).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await v.repo.shutdown();
  });
});

async function door(controlHandle: Awaited<ReturnType<typeof standControlHome>>, repo: Repo, placeVerb: (o: { requestId: string; verb: string }) => void, control = controlStoreOf(controlHandle)) {
  const dir = mkdtempSync(join(tmpdir(), "uds-locked-"));
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
