/**
 * lease-frontier-owned-layer — the daemon island reads its lease frontier off the layer it HOLDS.
 *
 * Under an owned document the island's main repo DENIES the daemon doc; the doc lives in the owned repo and
 * reaches the island as a layer of its composite. A lease read that walks the oracle registry over the main
 * repo never resolves there, and a persona-bound boot then refuses on "current lease frontier unavailable".
 *
 * This boots the REAL daemon behaviour over a REAL founding, with the island's main repo denying the daemon
 * doc (the oracle registry still names it — the address split, exactly as a vessel boots) and the slots living
 * only in the composite's daemon layer.
 *
 *   V1 — an empty, readable lease set reads 0: the persona-bound boot stands
 *   V2 — a slot present is READ through the composite: a slot of 1 over an edge bound at 0 refuses STALE
 *   V3 — the realm verbs reach the same daemon layer (realm-feed writes, realm-clock reads it back)
 *   CONTROLS (must refuse on any code):
 *   C1 — the daemon layer genuinely absent → UNAVAILABLE and refuse, never 0
 *   C2 — an edge for a different vessel → refuse
 *   C3 — a broken persona-KEL chain → refuse
 */
import { describe, test, expect, afterEach } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { runFoundingCeremony } from "@lararium/keyhive";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import {
  CompositeStore, AutomergeDocStore, DAEMON_BAG_ID, hex, leaseEpochSlotUri, makeIslandRepo, attachMessageChannelSync,
  materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix, type LarDoc,
} from "@lararium/mesh";
import { VerbTable } from "@lararium/tw5";
import * as ed25519 from "@noble/ed25519";

const pubOf = async (s: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(s));
const seed  = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const FOUNDER_SEED = seed(71);
const OTHER_SEED   = seed(171);

const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });

/** Found a face, then stand the island the way an owned-document vessel does: a main repo that DENIES the
 *  daemon doc, an oracle registry that names it anyway, and the daemon doc reaching the composite as a layer. */
async function standIsland(opts: { daemonLayer?: boolean } = {}) {
  const vesselRepo = new Repo({ sharePolicy: async () => true });
  const key = await pubOf(FOUNDER_SEED);
  const cer = await runFoundingCeremony({
    repo: vesselRepo, vesselSeed: FOUNDER_SEED, vesselVerifyingKey: key,
    vesselDisplayName: "Founder", binding: { mode: "self-stood", signerSeed: FOUNDER_SEED }, hearthTrueName: "", nexusPubkey: key,
  });
  const kelBoard = await materializeSharedLarDoc(vesselRepo, personaKelBoardDocUrl(key), "board:persona-kel");
  const chain = personaKelChainForPrefix(kelBoard.doc(), cer.personaKelPrefix);
  if (!chain) throw new Error("fixture: no persona-KEL chain on the founder's board");

  // The oracle registry names the daemon doc — the address the old road walked.
  const oracle = vesselRepo.create<LarDoc>({
    schemaVersion: "lar/1",
    tiddlers: { [DAEMON_BAG_ID]: { tiddler: { title: DAEMON_BAG_ID, text: cer.daemonUrl } } },
  } as unknown as LarDoc);

  // The island's MAIN repo denies the daemon doc (owned-document split).
  // A plain MessageChannel (the global one) — the sync leg the kernel's island repo rides; no nested island stands.
  const { port1, port2 } = new MessageChannel();
  const islandRepo = makeIslandRepo({ syncPort: port1 as never, denyDocument: cer.daemonUrl });
  const detach = attachMessageChannelSync(vesselRepo, port2 as never);
  teardown.push(() => { detach(); port1.close(); port2.close(); });

  // The composite's daemon layer — the owned doc, as the kernel layers it.
  const daemonHandle = await vesselRepo.find<LarDoc>(cer.daemonUrl as AutomergeUrl);
  const composite = new CompositeStore();
  if (opts.daemonLayer !== false) {
    const store = new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID);
    composite.addLayer({ bagId: DAEMON_BAG_ID, store, writable: true });
    store.markSyncComplete();
  }
  const ctx = {
    wikiUri: "lar:///ha.ka.ba/wikis/daemon", composite, tw5: {} as never, handles: new Map(), post: () => {},
    repo: islandRepo, catalogUrl: null, oracleUrl: oracle.url, engine: { sha256: "", version: "" },
    recipe: { wikiSlug: "daemon" },
  } as never;
  const daemonAuth = {
    seed: FOUNDER_SEED, vesselVerifyingKey: key,
    personaGroupDocIdHex: cer.personaGroupDocIdHex, personaGroupAgentIdHex: cer.personaGroupAgentIdHex,
    meshCabalDocIdHex: cer.meshCabalDocIdHex, registerBags: [DAEMON_BAG_ID], signerDid: cer.signerDid,
    personaKel: { prefix: cer.personaKelPrefix, chain }, deviceEdge: cer.founderEdge, archiveOpens: true,
  };
  const writeSlot = (value: string) => daemonHandle.change((d) => {
    const title = leaseEpochSlotUri(cer.personaGroupDocIdHex, "another-writer");
    (d.tiddlers as Record<string, unknown>)[title] = { tiddler: { title, text: value } };
  });
  return { ctx, daemonAuth, daemonHandle, writeSlot, chain };
}

const boot = async (daemonAuth: unknown, ctx: unknown) => {
  const opts = operatorDaemonOptions({ daemonAuth } as never);
  const kh = await opts.verifierFactory!(ctx as never);
  await (kh as { dispose?: () => Promise<void> }).dispose?.();
};

describe("the lease frontier reads off the island's own daemon layer", () => {
  test("V1 — an empty, readable lease set reads 0: the persona-bound boot stands", async () => {
    const { ctx, daemonAuth } = await standIsland();
    await expect(boot(daemonAuth, ctx)).resolves.toBeUndefined();
  }, 60_000);

  test("V2 — a slot present is read: a slot of 1 over an edge bound at 0 refuses STALE", async () => {
    const { ctx, daemonAuth, writeSlot } = await standIsland();
    writeSlot("1");
    await expect(boot(daemonAuth, ctx)).rejects.toThrow(/delegation lease stale/);
  }, 60_000);

  test("V3 — realm-feed and realm-clock reach the composite's daemon layer", async () => {
    const { ctx, daemonAuth, daemonHandle } = await standIsland();
    const registry = new VerbTable();
    operatorDaemonOptions({ daemonAuth } as never).wireWorkerVerbs!(registry, ctx as never);
    const realm = "ab".repeat(32);
    const writer = "cd".repeat(32);
    const call = (verb: string, args: Record<string, unknown>) =>
      (registry as unknown as { get(n: string): ((a: Record<string, unknown>) => Promise<Record<string, unknown>>) | undefined })
        .get(verb)!(args);
    const fed = await call("realm-feed", { realm, writer });
    expect(fed["epoch"]).toBe(1);
    expect(Object.keys(daemonHandle.doc()!.tiddlers).some((t) => t.includes(realm))).toBe(true);
    const clock = await call("realm-clock", { realm });
    expect(JSON.stringify(clock)).toContain(writer);
  }, 60_000);

  test("C1 — the daemon layer genuinely absent reads UNAVAILABLE and refuses, never 0", async () => {
    const { ctx, daemonAuth } = await standIsland({ daemonLayer: false });
    await expect(boot(daemonAuth, ctx)).rejects.toThrow(/current lease frontier unavailable/);
  }, 60_000);

  test("C2 — an edge for a different vessel refuses", async () => {
    const { ctx, daemonAuth } = await standIsland();
    const other = { ...daemonAuth, seed: OTHER_SEED, vesselVerifyingKey: await pubOf(OTHER_SEED) };
    await expect(boot(other, ctx)).rejects.toThrow(/Binding Gate/);
  }, 60_000);

  test("C3 — a broken persona-KEL chain refuses", async () => {
    const { ctx, daemonAuth, chain } = await standIsland();
    const broken = [{ ...chain[0]!, opKeyDid: "0x" + "ee".repeat(32) }, ...chain.slice(1)];
    const tampered = { ...daemonAuth, personaKel: { prefix: daemonAuth.personaKel.prefix, chain: broken } };
    await expect(boot(tampered, ctx)).rejects.toThrow(/Binding Gate/);
  }, 60_000);
});
