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
  CompositeStore, AutomergeDocStore, DAEMON_BAG_ID, hex, leaseEpochSlotUri, wikiBagUri, makeIslandRepo, attachMessageChannelSync,
  materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix, type LarDoc,
  mintFaceAnchor, signLeaseAdvance, ed25519SignerFromSeed, faceAtomPublicKey, signAsFaceAtom, signFaceLeafBond, hexToBytes,
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
  const cer = await runFoundingCeremony({ repo: vesselRepo, vesselSeed: FOUNDER_SEED, placeVerifyingKey: key,
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
  const catalog = vesselRepo.create<LarDoc>({
    schemaVersion: "lar/1",
    tiddlers: { [wikiBagUri("daemon")]: { tiddler: { title: wikiBagUri("daemon"), text: cer.daemonUrl } } },
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
    wikiUri: "lar:///ha.ka.ba/wikis/daemon", composite, tw5: {} as never,
    handles: new Map([[wikiBagUri("daemon"), daemonHandle]]), post: () => {},
    repo: islandRepo, catalogUrl: catalog.url, oracleUrl: oracle.url, engine: { sha256: "", version: "" },
    recipe: { wikiSlug: "daemon" },
  } as never;
  const daemonAuth = {
    atom: { seed: hex(cer.atomSeed), key: cer.founderEdge.deviceVerifyingKey }, veilArchiveBytes: cer.veilArchive,
    seed: FOUNDER_SEED, placeVerifyingKey: key, faceAddressSecret: hex(new Uint8Array(32).fill(74)),
    personaGroupId: cer.personaGroupId,
    meshCabalDocIdHex: cer.meshCabalDocIdHex, registerBags: [DAEMON_BAG_ID], signerDid: cer.signerDid,
    personaKel: { prefix: cer.personaKelPrefix, chain }, deviceEdge: cer.founderEdge, archiveOpens: true,
    faceAnchor: mintFaceAnchor({ personaGroup: cer.personaGroupId, personaKelPrefix: cer.personaKelPrefix,
      personaRootDid: cer.founderEdge.personaRootDid, edge: cer.founderEdge, leaseEpoch: 0 }),
  };
  // A face's lease slot counts only SIGNED by a key the KEL seats: the root signs; a bare number raises nothing.
  const writeSlotText = (text: string) => daemonHandle.change((d) => {
    const title = leaseEpochSlotUri(cer.personaGroupId, "another-writer");
    (d.tiddlers as Record<string, unknown>)[title] = { tiddler: { title, text } };
  });
  const writeSlot = async (epoch: number) => writeSlotText(await signLeaseAdvance(
    { resource: cer.personaGroupId, epoch },
    { key: cer.founderEdge.personaRootDid.replace(/^0x/, ""), sign: ed25519SignerFromSeed(FOUNDER_SEED) }));
  const writeUnsignedSlot = writeSlotText;
  return { ctx, daemonAuth, daemonHandle, writeSlot, writeUnsignedSlot, chain };
}

const cer0AtomSeed = (auth: { atom: { seed: string } }): Uint8Array => hexToBytes(auth.atom.seed);
const boot = async (daemonAuth: unknown, ctx: unknown) => {
  const opts = operatorDaemonOptions({ daemonAuth } as never, { dyadReading: () => "clear" });
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
    await writeSlot(1);
    await expect(boot(daemonAuth, ctx)).rejects.toThrow(/delegation lease stale/);
  }, 60_000);

  test("V2b — RED: an unsigned slot, or a stranger's signed one, raises nothing: the boot stands", async () => {
    const { ctx, daemonAuth, writeUnsignedSlot } = await standIsland();
    writeUnsignedSlot("1");
    await expect(boot(daemonAuth, ctx)).resolves.toBeUndefined();
    writeUnsignedSlot(await signLeaseAdvance({ resource: daemonAuth.personaGroupId, epoch: 9 },
      { key: "ab".repeat(32), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(8)) }));
    await expect(boot(daemonAuth, ctx)).resolves.toBeUndefined();
  }, 60_000);

  test("V3 — realm-feed and realm-clock reach the composite's daemon layer", async () => {
    const { ctx, daemonAuth, daemonHandle } = await standIsland();
    const registry = new VerbTable();
    operatorDaemonOptions({ daemonAuth } as never, { dyadReading: () => "clear" }).wireWorkerVerbs!(registry, ctx as never);
    const realm = "ab".repeat(32);
    // realm-feed writes the mounted face's own leaf slot, its writer bound to the presenter through the face's bond.
    const leafSeed = new Uint8Array(32).fill(91);
    const writer = faceAtomPublicKey(leafSeed);
    const bond = await signFaceLeafBond({ atom: daemonAuth.atom.key, leaf: writer, nexusAid: "bafy-lease-nexus", realm },
      { atom: (b) => signAsFaceAtom(cer0AtomSeed(daemonAuth), b), leaf: (b) => signAsFaceAtom(leafSeed, b) });
    const call = (verb: string, args: Record<string, unknown>) =>
      (registry as unknown as { get(n: string): ((a: Record<string, unknown>, c: unknown) => Promise<Record<string, unknown>>) | undefined })
        .get(verb)!(args, { presenter: `0x${daemonAuth.atom.key}`, local: true });
    const fed = await call("realm-feed", { realm, writer, bond });
    expect(fed["epoch"]).toBe(1);
    expect(Object.keys(daemonHandle.doc()!.tiddlers).some((t) => t.includes(realm))).toBe(true);
    const clock = await call("realm-clock", { realm });
    expect(JSON.stringify(clock)).toContain(writer);
  }, 60_000);

  test("C1 — the daemon layer genuinely absent reads UNAVAILABLE and refuses, never 0", async () => {
    const { ctx, daemonAuth } = await standIsland({ daemonLayer: false });
    await expect(boot(daemonAuth, ctx)).rejects.toThrow(/current lease frontier unavailable/);
  }, 60_000);

  test("C2 — an edge for a different atom refuses", async () => {
    const { ctx, daemonAuth } = await standIsland();
    const other = { ...daemonAuth, atom: { seed: hex(OTHER_SEED), key: await pubOf(OTHER_SEED) }, veilArchiveBytes: undefined };
    await expect(boot(other, ctx)).rejects.toThrow(/Binding Gate/);
  }, 60_000);

  test("C3 — a broken persona-KEL chain refuses", async () => {
    const { ctx, daemonAuth, chain } = await standIsland();
    const broken = [{ ...chain[0]!, opKeyDid: "0x" + "ee".repeat(32) }, ...chain.slice(1)];
    const tampered = { ...daemonAuth, personaKel: { prefix: daemonAuth.personaKel.prefix, chain: broken } };
    await expect(boot(tampered, ctx)).rejects.toThrow(/Binding Gate/);
  }, 60_000);
});
