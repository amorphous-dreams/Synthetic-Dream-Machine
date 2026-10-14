/**
 * face-bundle-restore — a face returns from its bundle onto a fresh vessel as a RECOVERY ACT, on the real doors.
 *
 * Every act runs the real founding (`runInit`), the real face rite (`runFoundTheFace`), the real cut and the real
 * restore over real stores under scratch roots. Vessel A founds, lights a face and cuts; A's whole home gets
 * destroyed; vessel B founds fresh and restores.
 *
 *   R1  the restored face stands on B under the SAME fixed prefix and signer name, at a NEW seat: another key
 *       group, another veil, a device edge for B's own key. The carried rows land; the pending row leaves.
 *   R2  a second restore over the face refuses `face-already-held`, and moves nothing.
 *   R3  an altered body, and another bundle's key, refuse `bundle-refused` before any field reads.
 *   R4  a body whose own parts disagree refuses `bundle-inconsistent`: a roster line for another key, a signer
 *       name for another key, a prefix the root does not derive, a key history from another root.
 *   R5  `root-superseded`: a carried history whose head names another operating key; and a board that holds a
 *       newer head than the bundle carried.          control: the same bundle over a board that holds none lands
 *   R6  every preflight refusal lands before any write: a roster line for another key at the index, an orphan
 *       root under another key, a lit face at the index, a proof key row under other bytes, no founded place.
 *   R7  a restore that stops after its commit row completes when the same restore runs again, from the row.
 *       A pending row of another face refuses `restore-pending`.
 *   R8  a restore lands additively: a name this vessel holds stays.
 *   R9  a history longer than its inception seats whole on the fresh vessel's board: a contested rotation the
 *       face vetoed stays vetoed.                    control: the open contest alone refuses `root-superseded`
 *
 * Scratch roots, synthetic names and keys. Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-restore
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import * as ed from "@noble/ed25519";
import {
  HandleBook, attestAndRotate, canonicalJsonBytes, deriveSelfRecoveryKey, foldPersonaContests, guardianRecoveryRegistrationCard, hex, mintBundleKey, mintHandleInception, mintPersonaInception, mintVeto,
  openFaceBundleBody, readFaceBundleBody, sealFaceBundleBody, sealMemorySection, signHandleCard,
  type FaceBundleBody, type HandleCard, type HandleKelEvent, type PersonaKelEvent,
} from "@lararium/mesh";
import * as init from "../src/commands/init.js";
import { removeCustodyRow, seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { cutFaceBundle } from "../src/face-bundle-cut.js";
import { RESTORE_REFUSALS, RestoreRefused, restoreFaceBundle } from "../src/face-bundle-restore.js";
import { FACE_PROOF_KEY_FILE, storeFaceProofKey } from "../src/face-key-custody.js";
import { loadIdentityAnchors, persistIdentityAnchors, veilArchivePath } from "../src/identity-anchors.js";
import { loadNodeHandleBook, saveNodeHandleBook } from "../src/node-circle-store.js";
import {
  generateOrLoadPersonaGroupRoot, listPersonaRosterLines, loadVesselVerifyingKey, makeNodePersonaDeclarationStore,
  makeNodePersonaPetnameStore,
} from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { readLocalPersonaKelChain, readLocalPersonaKelEvents, seatLocalPersonaKelChain } from "../src/persona-admit-flow.js";
import { RESTORE_PENDING_FILE } from "../src/vault-carriers.js";
import { larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect } from "./found-route.js";
import { seatScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 600_000, hookTimeout: 600_000 });

const REPO_GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const foundFace = direct(init.runFoundTheFace);
const withRepo = <T>(act: Parameters<typeof ownedStore<T>>[1]): Promise<T> => ownedStore(larDataDir(), act);
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + fill) & 0xff);
const publicOf = async (secret: Uint8Array): Promise<string> => hex(await ed.getPublicKeyAsync(secret));

const roots: string[] = [];
const priorRoot = process.env["LAR_ROOT"];
/** Leave the standing root: lock and unseat its custody. The root's files stay until `destroy`. */
async function leave(): Promise<void> {
  const holder = seatedCustody();
  if (holder) { await holder.lock(); unseatCustody(holder); }
}
/** Found a fresh vessel under a fresh scratch root and stand in it, unlocked. */
async function foundVessel(label: string): Promise<string> {
  await leave();
  const root = mkdtempSync(join(tmpdir(), `lar-restore-${label}-`));
  roots.push(root);
  process.env["LAR_ROOT"] = root;
  cpSync(REPO_GENESIS, join(root, "genesis"), { recursive: true });
  await foundDirect({ storageDir: larDataDir(), genesisDir: join(root, "genesis") });
  return root;
}
afterEach(async () => {
  vi.restoreAllMocks();
  await leave();
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function cardOf(fill: number, glamour: string): Promise<HandleCard> {
  const seed = new Uint8Array(32).fill(fill);
  const did = `0x${await publicOf(seed)}`;
  const chain: HandleKelEvent[] = [mintHandleInception(did, did, "ab".repeat(32), `hkeynext-${"cd".repeat(32)}`)];
  return signHandleCard({ nym: chain[0]!.prefix, chain, glamour, parents: [], standing: null, fleetProof: null }, (b) => ed.signAsync(b, seed).then(hex));
}

interface Cut {
  readonly sealedBody: Uint8Array; readonly bundleKey: Uint8Array; readonly body: FaceBundleBody;
  readonly rootKey: string; readonly prefix: string; readonly group: string; readonly veilTag: string; readonly vesselKey: string;
}
/** Found vessel A, light a face, give it names, a proof key and a recognised friend, cut its bundle, and DESTROY A. */
async function cutOnDestroyedVessel(label: string, faceLabel = "the gardener", proofFill = 3): Promise<Cut> {
  const root = await foundVessel(label);
  await foundFace({ genesisDir: join(root, "genesis"), handleIndex: 0 });
  const rootKey = (await listPersonaRosterLines()).find((l) => l.handleIndex === 0)!.verifyingKey;
  await (await makeNodePersonaPetnameStore()).set(0, faceLabel);
  await (await makeNodePersonaDeclarationStore()).set(0, { handle: `${faceLabel}-handle`, seat: true, chair: "CHAIR-ON-A" });
  const proof = secretOf(proofFill);
  await storeFaceProofKey({ faceKey: await publicOf(proof), nexus: "nexus-test-one" }, proof, 0);
  const book = new HandleBook();
  const friend = await cardOf(11, "a-friend");
  await book.ingest(friend, undefined, rootKey);
  book.setPetname(friend.nym, "Ana", rootKey);
  await saveNodeHandleBook(book);
  const anchors = (await loadIdentityAnchors(0))!;
  const bundleKey = mintBundleKey();
  const cut = await cutFaceBundle({
    face: 0, bundleKey,
    door: {
      wornFace: () => 0, ownEdgeShadowed: async () => false,
      cutMemory: async (to) => ({ section: Buffer.from(sealMemorySection([], to)).toString("base64"), holds: [] }),
      kel: (prefix) => withRepo((repo) => readLocalPersonaKelChain(repo, prefix)),
    },
  });
  const body = readFaceBundleBody(openFaceBundleBody(cut.sealedBody, bundleKey)!)!;
  const out: Cut = {
    sealedBody: cut.sealedBody, bundleKey, body, rootKey, prefix: anchors.personaKelPrefix!, group: anchors.personaGroupId,
    veilTag: anchors.veilTag!, vesselKey: await loadVesselVerifyingKey(),
  };
  // DESTROY THE SCRATCH HOME: nothing of vessel A survives but the bundle in hand.
  await leave();
  rmSync(root, { recursive: true, force: true });
  expect(existsSync(root)).toBe(false);
  return out;
}
/** Seal `body` under a fresh key, as a bundle a cut would carry. */
function sealed(body: FaceBundleBody): { sealedBody: Uint8Array; bundleKey: Uint8Array } {
  const bundleKey = mintBundleKey();
  return { sealedBody: sealFaceBundleBody(canonicalJsonBytes(body), bundleKey), bundleKey };
}
const refusalOf = async (p: Promise<unknown>): Promise<string> => {
  const e = await p.then(() => null, (err: unknown) => err);
  return e === null ? "LANDED" : e instanceof RestoreRefused ? e.reason : `threw: ${(e as Error).message.slice(0, 120)}`;
};
/**
 * Every file under this root's identity home AND its storage home, by path, with a digest of its bytes: a refused
 * restore moves no sealed row and writes no document. A store's claim file comes and goes with each holder.
 */
function homeTree(): string {
  const h = createHash("sha256");
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p); else if (!/claim|lock/i.test(name)) h.update(p).update(readFileSync(p));
    }
  };
  walk(larIdentityDir());
  walk(larDataDir());
  return h.digest("hex");
}
const pendingStands = (): boolean => existsSync(join(larIdentityDir(), RESTORE_PENDING_FILE));

describe("a face returns from its bundle onto a fresh vessel", () => {
  test("R1 + R2 — the restored face stands under the same prefix at a NEW seat; a second restore refuses", async () => {
    const a = await cutOnDestroyedVessel("a");
    await foundVessel("b");
    expect((await listPersonaRosterLines()).length, "CONTROL: the fresh vessel holds no root").toBe(0);
    expect(init.faceStands()).toBe(false);

    const restored = await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo });
    expect(restored.face).toEqual({ handleIndex: 0, verifyingKey: a.rootKey });
    expect(restored.prefix).toBe(a.prefix);
    expect(restored.resumed).toBe(false);
    expect(restored.checked).toEqual({ seq: 0, from: "bundle" });
    expect(restored.landed).toEqual({ faceProofKeys: 1, petname: true, handle: true, handleBook: { landed: 1, kept: 0 } });

    // THE LINEAGE RETURNED: the same root, the same fixed prefix, the same signer name.
    expect(await listPersonaRosterLines()).toEqual([{ handleIndex: 0, verifyingKey: a.rootKey }]);
    const anchors = (await loadIdentityAnchors(0))!;
    expect(anchors.personaKelPrefix).toBe(a.prefix);
    expect(anchors.signerDid?.toLowerCase().replace(/^0x/, "")).toBe(a.rootKey);
    expect(init.faceStands()).toBe(true);
    // A NEW SEAT: another key group, another veil tag, a veil archive of this vessel's own, an edge for this vessel's key.
    expect(anchors.personaGroupId).not.toBe(a.group);
    expect(anchors.veilTag).not.toBe(a.veilTag);
    expect(existsSync(veilArchivePath(0))).toBe(true);
    const here = await loadVesselVerifyingKey();
    expect(here).not.toBe(a.vesselKey);
    expect(JSON.stringify(anchors.deviceEdge).toLowerCase()).toContain(here.toLowerCase());
    expect(JSON.stringify(anchors.deviceEdge).toLowerCase()).not.toContain(a.vesselKey.toLowerCase());
    // The board holds the face's key history.
    expect((await withRepo((repo) => readLocalPersonaKelChain(repo, a.prefix))).map((e) => e.eventCid)).toEqual(a.body.kel.map((e) => e.eventCid));
    // THE CARRIED ROWS LANDED: the names, the record under the face's own tag, the proof key. The seat claim and the chair label stayed behind.
    expect(await (await makeNodePersonaPetnameStore()).get(0)).toBe("the gardener");
    expect(await (await makeNodePersonaDeclarationStore()).get(0)).toEqual({ handle: "the gardener-handle" });
    const friend = (await loadNodeHandleBook()).snapshotFor(a.rootKey).records;
    expect(friend.map((r) => r.petname)).toEqual(["Ana"]);
    expect(readdirSync(larIdentityDir()).filter((n) => FACE_PROOF_KEY_FILE.test(n))).toHaveLength(1);
    expect(pendingStands(), "the pending row leaves once the face stands lit").toBe(false);

    // R2: a second restore over it refuses, and moves nothing.
    const before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("face-already-held");
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("face-already-held");
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);
  });

  test("R3 + R4 — an altered body, another key, and a body whose own parts disagree each refuse by name before any write", async () => {
    const a = await cutOnDestroyedVessel("a");
    const other = await cutOnDestroyedVessel("other", "the potter", 5);
    await foundVessel("b");
    const before = homeTree();
    // R3: one altered bit; another bundle's key.
    const bent = Uint8Array.from(a.sealedBody);
    bent[bent.length - 1] = bent[bent.length - 1]! ^ 0x01;
    expect(hex(bent)).not.toBe(hex(a.sealedBody));
    expect(await refusalOf(restoreFaceBundle({ sealedBody: bent, bundleKey: a.bundleKey, withRepo }))).toBe("bundle-refused");
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: other.bundleKey, withRepo }))).toBe("bundle-refused");
    // R4: each relation, bent one at a time, under a body that still seals and reads as a body.
    const bends: Array<[string, (b: FaceBundleBody) => FaceBundleBody]> = [
      ["a roster line for another key", (b) => ({ ...b, rosterLine: { ...b.rosterLine, verifyingKey: other.rootKey } })],
      ["a root key its seed does not derive", (b) => ({ ...b, root: { ...b.root, verifyingKey: other.rootKey }, rosterLine: { ...b.rosterLine, verifyingKey: other.rootKey } })],
      ["a signer name for another key", (b) => ({ ...b, anchors: { ...b.anchors, signerDid: `0x${other.rootKey}` } })],
      ["a prefix the root does not derive", (b) => ({ ...b, anchors: { ...b.anchors, personaKelPrefix: other.prefix } })],
      ["a key history from another root", (b) => ({ ...b, kel: other.body.kel })],
      ["no key history", (b) => ({ ...b, kel: [] })],
      // A body made to agree with itself around a key its seed does not derive: the key rides the root, the roster
      // line and the signer's name, and the prefix and the inception derive from that claimed key. The seed alone tells.
      ["a claimed key the seed does not derive, with every other part made to agree", (b) => {
        const inception = mintPersonaInception(`0x${other.rootKey}`, b.kel[0]!.recoverySetHash);
        return {
          ...b, root: { ...b.root, verifyingKey: other.rootKey }, rosterLine: { ...b.rosterLine, verifyingKey: other.rootKey },
          anchors: { signerDid: `0x${other.rootKey}`, personaKelPrefix: inception.prefix }, kel: [inception],
        };
      }],
    ];
    for (const [name, bend] of bends) {
      expect(await refusalOf(restoreFaceBundle({ ...sealed(bend(a.body)), withRepo })), name).toBe("bundle-inconsistent");
    }
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);
    // CONTROL: the unbent body, sealed the same way, lands.
    expect(await refusalOf(restoreFaceBundle({ ...sealed(a.body), withRepo }))).toBe("LANDED");
  });

  test("R5 — a root the face's key history superseded refuses `root-superseded`: in the carried log, and on this vessel's own board", async () => {
    const a = await cutOnDestroyedVessel("a");
    // The face's own recovery key rotates a fresh operating key in beneath the fixed prefix.
    const seed = Uint8Array.from(Buffer.from(a.body.root.signingKey, "hex"));
    const recovery = await deriveSelfRecoveryKey(seed);
    const fresh = secretOf(41);
    const rotated = await attestAndRotate({
      head: a.body.kel[0]!, freshOpKeyDid: `0x${await publicOf(fresh)}`, guardianRecoveryKeys: [recovery.verifyingKey], recoveryThreshold: 1,
      guardianSigners: [{ signer: recovery.verifyingKey, sign: (bytes) => ed.signAsync(bytes, Buffer.from(recovery.signingKey, "hex")).then(hex) }],
    });
    if (!rotated.ok) throw new Error(`setup: the rotation refused: ${rotated.reason}`);
    const newer: PersonaKelEvent[] = [...a.body.kel, rotated.event];

    await foundVessel("b");
    const before = homeTree();
    // The carried log itself names the newer head.
    expect(await refusalOf(restoreFaceBundle({ ...sealed({ ...a.body, kel: newer }), withRepo }))).toBe("root-superseded");
    expect(homeTree()).toBe(before);
    // This vessel's own board learned the newer head; the bundle carries only the history as far as its cut.
    await withRepo((repo) => seatLocalPersonaKelChain(repo, newer));
    const boarded = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("root-superseded");
    expect(homeTree()).toBe(boarded);
    expect(pendingStands()).toBe(false);
    expect((await listPersonaRosterLines()).length).toBe(0);
    // A GUARDIAN SET GRAFTED IN: the rotation keeps the root as the operating key and commits recovery to another
    // key set. The root no longer satisfies the face's current recovery commitment, and the restore refuses.
    const grafted = await attestAndRotate({
      head: a.body.kel[0]!, freshOpKeyDid: `0x${a.rootKey}`, guardianRecoveryKeys: [recovery.verifyingKey], recoveryThreshold: 1,
      guardianSigners: [{ signer: recovery.verifyingKey, sign: (bytes) => ed.signAsync(bytes, Buffer.from(recovery.signingKey, "hex")).then(hex) }],
      next: { guardians: [guardianRecoveryRegistrationCard("guardian-a", await publicOf(secretOf(51)), "a guardian")], threshold: 1 },
    });
    if (!grafted.ok) throw new Error(`setup: the graft refused: ${grafted.reason}`);
    await foundVessel("grafted");
    expect(await refusalOf(restoreFaceBundle({ ...sealed({ ...a.body, kel: [...a.body.kel, grafted.event] }), withRepo }))).toBe("root-superseded");

    // A FORK: two verified rotations claim one seat. The one reader settles no fork by order and stops before the
    // seat, so its lineage still heads at the inception; the restore refuses the forked history all the same.
    const rival = await attestAndRotate({
      head: a.body.kel[0]!, freshOpKeyDid: `0x${await publicOf(secretOf(47))}`, guardianRecoveryKeys: [recovery.verifyingKey], recoveryThreshold: 1,
      guardianSigners: [{ signer: recovery.verifyingKey, sign: (bytes) => ed.signAsync(bytes, Buffer.from(recovery.signingKey, "hex")).then(hex) }],
    });
    if (!rival.ok) throw new Error(`setup: the rival rotation refused: ${rival.reason}`);
    await foundVessel("forked");
    await withRepo((repo) => seatLocalPersonaKelChain(repo, [...newer, rival.event]));
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("root-superseded");
    expect((await listPersonaRosterLines()).length).toBe(0);
    // An event that does not verify moves nothing: a rotation no recovery key signed, planted on the board, refuses
    // nobody. The board holds no event of the lineage, so the check says it read its head off the bundle.
    await foundVessel("planted");
    await withRepo((repo) => seatLocalPersonaKelChain(repo, [{ ...rotated.event, rotationSigs: [] }]));
    expect((await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo })).checked).toEqual({ seq: 0, from: "bundle" });
    // A board that holds the lineage's own head says so.
    await foundVessel("boarded");
    await withRepo((repo) => seatLocalPersonaKelChain(repo, [a.body.kel[0]!]));
    expect((await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo })).checked).toEqual({ seq: 0, from: "board" });
    // CONTROL: the same bundle on a vessel whose board holds no newer head lands.
    await foundVessel("c");
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("LANDED");
  });

  test("R6 — every preflight refusal lands before any write", async () => {
    const a = await cutOnDestroyedVessel("a");
    const other = await cutOnDestroyedVessel("other", "the potter", 5);

    // No founded place: custody stands seated under a scratch root, and no vessel got founded there.
    await leave();
    const bare = await seatScratchCustody("restore-unfounded");
    try {
      expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo: () => { throw new Error("no store opens for an unfounded place"); } }))).toMatch(/^(place-unfounded|threw: no store opens)/);
    } finally { await bare.drop(); }

    // A roster line for another key at the index: a root this vessel minted itself.
    await foundVessel("b");
    await generateOrLoadPersonaGroupRoot(0);
    let before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("roster-names-another-key");
    expect(homeTree()).toBe(before);

    // A lit face at the index (another face, restored there first).
    await foundVessel("c");
    expect(await refusalOf(restoreFaceBundle({ sealedBody: other.sealedBody, bundleKey: other.bundleKey, withRepo }))).toBe("LANDED");
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("roster-names-another-key");
    // CONTROL: beside the lit founding face, at a free index, the same bundle lands as a compartment.
    expect(homeTree()).toBe(before);
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("LANDED");
    expect((await loadIdentityAnchors(1))?.personaKelPrefix).toBe(a.prefix);

    // AN ADMITTED FACE holds anchors at its index and no root: the index stands lit, with no roster line to name.
    await foundVessel("lit");
    await persistIdentityAnchors({ personaGroupId: "an-admitted-group", meshCabalDocIdHex: "an-admitted-cabal" }, 0);
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("index-held");
    expect(homeTree()).toBe(before);

    // AN ORPHAN ROOT under another key: a root row with no roster line (an act that stopped between its two writes).
    await foundVessel("orphan");
    await generateOrLoadPersonaGroupRoot(0);
    expect(await removeCustodyRow("identity", readdirSync(larIdentityDir()).find((n) => /persona-roster/.test(n))!)).toBe(true);
    expect(await listPersonaRosterLines()).toEqual([]);
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("orphan-names-another-key");
    expect(homeTree()).toBe(before);

    // A NAMES ROW THAT STANDS AND DOES NOT READ WHOLE refuses by its own name before the commit row: the landing
    // meets no row the preflight has not already read.
    await foundVessel("torn");
    await seatedCustody()!.writeRow("identity", readdirSync(larIdentityDir()).find((n) => /persona-petnames/.test(n)) ?? ".persona-petnames.json", new TextEncoder().encode("{ this row reads as no map"));
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toMatch(/^threw: custody row identity\/\.persona-petnames.*reads malformed/);
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);

    // A face at an index above zero on a vessel with no founding face lit.
    await foundVessel("d");
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 2, withRepo }))).toBe("founding-face-unlit");
    // A proof key row under other bytes for the same face at the same Nexus.
    const clash = secretOf(9);
    await storeFaceProofKey({ faceKey: await publicOf(clash), nexus: "nexus-test-one" }, clash, 0);
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("row-conflict");
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);
    expect([...RESTORE_REFUSALS]).toEqual([
      "bundle-refused", "bundle-inconsistent", "root-superseded", "face-already-held", "restore-pending", "place-unfounded",
      "founding-face-unlit", "index-held", "roster-names-another-key", "orphan-names-another-key", "row-conflict",
    ]);
  });

  test("R9 — a history that holds more than its inception seats whole on the fresh vessel's board: a contested rotation the face vetoed stays vetoed", async () => {
    const a = await cutOnDestroyedVessel("a");
    const seed = Uint8Array.from(Buffer.from(a.body.root.signingKey, "hex"));
    const recovery = await deriveSelfRecoveryKey(seed);
    // A rotation lands provisional, open to contest; the standing operating key (the root) vetoes it.
    const contested = await attestAndRotate({
      head: a.body.kel[0]!, freshOpKeyDid: `0x${await publicOf(secretOf(43))}`, guardianRecoveryKeys: [recovery.verifyingKey], recoveryThreshold: 1,
      guardianSigners: [{ signer: recovery.verifyingKey, sign: (bytes) => ed.signAsync(bytes, Buffer.from(recovery.signingKey, "hex")).then(hex) }],
      provisional: true,
    });
    if (!contested.ok) throw new Error(`setup: the provisional rotation refused: ${contested.reason}`);
    const veto = await mintVeto({ contested: contested.event, standing: a.body.kel[0]!, sign: (bytes) => ed.signAsync(bytes, seed).then(hex) });

    // CONTROL: the open contest alone, with no veto, refuses: its newest event names another operating key.
    await foundVessel("open");
    expect(await refusalOf(restoreFaceBundle({ ...sealed({ ...a.body, kel: [...a.body.kel, contested.event] }), withRepo }))).toBe("root-superseded");

    // A cut carries the LINEAGE its board's fold verified: the inception, then the veto that took the contested seat.
    await foundVessel("b");
    const restored = await restoreFaceBundle({ ...sealed({ ...a.body, kel: [...a.body.kel, veto] }), withRepo });
    expect(restored.checked.seq).toBe(1);
    // The fresh vessel's board holds the WHOLE carried lineage, the veto among it.
    expect((await withRepo((repo) => readLocalPersonaKelEvents(repo, a.prefix))).map((e) => e.eventCid).sort()).toEqual([a.body.kel[0]!.eventCid, veto.eventCid].sort());
    // So a copy of the killed rotation arriving later moves nothing here: the fold still heads at the veto, under the root.
    await withRepo((repo) => seatLocalPersonaKelChain(repo, [contested.event]));
    const fold = foldPersonaContests((await withRepo((repo) => readLocalPersonaKelEvents(repo, a.prefix))).sort((x, y) => x.seq - y.seq));
    expect(fold.fork).toBeNull();
    expect(fold.kel[fold.kel.length - 1]!.eventCid).toBe(veto.eventCid);
    expect(fold.kel[fold.kel.length - 1]!.opKeyDid.toLowerCase().replace(/^0x/, "")).toBe(a.rootKey);
  });

  test("R7 — a restore that stops after its commit row completes when it runs again; another face's pending row refuses", async () => {
    const a = await cutOnDestroyedVessel("a");
    const other = await cutOnDestroyedVessel("other", "the potter", 5);
    await foundVessel("b");
    // The face rite fails once, after the commit row and the rows landed.
    const real = init.runFoundTheFace;
    const rite = vi.spyOn(init, "runFoundTheFace").mockImplementationOnce(async () => { throw new Error("the rite stopped"); });
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("threw: the rite stopped");
    expect(pendingStands(), "the commit row stands: this restore owes its rest").toBe(true);
    expect(init.faceStands()).toBe(false);
    // Another face's restore refuses while this one stands pending.
    expect(await refusalOf(restoreFaceBundle({ sealedBody: other.sealedBody, bundleKey: other.bundleKey, as: 1, withRepo }))).toBe("restore-pending");
    // The same face under ANOTHER index refuses too: the pending restore completes where it committed.
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 3, withRepo }))).toBe("restore-pending");
    expect(pendingStands()).toBe(true);
    // ANOTHER CUT of the same face that carries a newer head refuses the resume: the check reads the handed
    // bundle's log beside the row's own.
    const seed = Uint8Array.from(Buffer.from(a.body.root.signingKey, "hex"));
    const recovery = await deriveSelfRecoveryKey(seed);
    const rotated = await attestAndRotate({
      head: a.body.kel[0]!, freshOpKeyDid: `0x${await publicOf(secretOf(53))}`, guardianRecoveryKeys: [recovery.verifyingKey], recoveryThreshold: 1,
      guardianSigners: [{ signer: recovery.verifyingKey, sign: (bytes) => ed.signAsync(bytes, Buffer.from(recovery.signingKey, "hex")).then(hex) }],
    });
    if (!rotated.ok) throw new Error(`setup: the rotation refused: ${rotated.reason}`);
    expect(await refusalOf(restoreFaceBundle({ ...sealed({ ...a.body, kel: [...a.body.kel, rotated.event] }), withRepo }))).toBe("root-superseded");
    expect(init.faceStands()).toBe(false);
    // The same restore again completes, from the row.
    rite.mockImplementation(real);
    const again = await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo });
    expect(again.resumed).toBe(true);
    expect(again.face).toEqual({ handleIndex: 0, verifyingKey: a.rootKey });
    expect(pendingStands()).toBe(false);
    expect(init.faceStands()).toBe(true);
    expect((await loadIdentityAnchors(0))?.personaKelPrefix).toBe(a.prefix);
  });

  test("R8 — a restore lands additively: a name this vessel already holds stays", async () => {
    const a = await cutOnDestroyedVessel("a");
    await foundVessel("b");
    await (await makeNodePersonaPetnameStore()).set(0, "a name kept here");
    const restored = await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo });
    expect(restored.landed.petname).toBe(false);
    expect(restored.landed.handle).toBe(true);
    expect(await (await makeNodePersonaPetnameStore()).get(0)).toBe("a name kept here");
  });
});
