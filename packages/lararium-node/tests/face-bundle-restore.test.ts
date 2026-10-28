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
 *   R10 a restore after guardian enrolment: a bundle cut after the face enrolled carries its set, lands, and seats
 *       the face's sealed set row at the target index; a bundle cut BEFORE the enrolment still restores over a
 *       board that holds the enrolment, and says the set rode no bundle. A guardians' rotation that moves the set
 *       cuts both off (`root-superseded`); a carried set its own log does not commit refuses `bundle-inconsistent`;
 *       a carried key another face of this vessel guards with refuses `guardian-key-serves-another-face`; a set
 *       row at the target under another set refuses `row-conflict`. Each refusal lands before any write.
 *   R11 a restored face stands PROVISIONAL: the restore lands the mark beside the root, an enrolment refuses
 *       `face-provisional` on its own door and through the sealed act door, and names who could confirm. A view
 *       refuses by name where it reads as none, names another face, fails its signature, names a key that stands as
 *       no such party (a chair this vessel holds among them), names a sibling (owed), or disagrees with the head;
 *       each refusal keeps the mark. A guardian's own agreeing view lifts it.
 *                                                    control: a face this vessel founded carries no mark
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
  HandleBook, attestAndRotate, faceLogViewLine, signFaceLogView, canonicalJsonBytes, coldKeySeedFromCode, sealKeySetHash, deriveSelfRecoveryKey, faceAtomKeyFromSeed, foldPersonaContests, guardianRecoveryRegistrationCard, hex, mintBundleKey, mintHandleInception, mintPersonaInception, mintVeto,
  openFaceBundleBody, readFaceBundleBody, sealFaceBundleBody, sealMemorySection, signHandleCard,
  type FaceBundleBody, type HandleCard, type HandleKelEvent, type PersonaKelEvent,
} from "@lararium/mesh";
import * as init from "../src/commands/init.js";
import { removeCustodyRow, seatedCustody, unseatCustody, writeCustodyRow } from "../src/custody-seat.js";
import { cutFaceBundle } from "../src/face-bundle-cut.js";
import { RESTORE_REFUSALS, RestoreRefused, restoreFaceBundle } from "../src/face-bundle-restore.js";
import { FACE_PROOF_KEY_FILE, storeFaceProofKey } from "../src/face-key-custody.js";
import { faceRowNames } from "./face-paths.js";
import { guardianOffer, guardianSetFile, readGuardianSet, runGuardianEnrolment } from "../src/guardian-enrolment.js";
import { ConfirmRefused, FaceProvisional, chairLogView, confirmProvisional, readProvisionalMark, refuseWhileProvisional } from "../src/face-provisional.js";
import { readNexusDoc } from "../src/nexus-doc.js";
import { SealedActRefused, runSealedAct } from "../src/sealed-acts.js";
import { loadIdentityAnchors, persistIdentityAnchors, veilArchivePath } from "../src/identity-anchors.js";
import { loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { loadNodeHandleBook, saveNodeHandleBook } from "../src/node-circle-store.js";
import {
  listPersonaRosterLines, loadVesselVerifyingKey, makeNodePersonaDeclarationStore,
  makeNodePersonaPetnameStore,
} from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { readLocalPersonaKelChain, readLocalPersonaKelEvents, seatLocalPersonaKelChain } from "../src/local-persona-kel.js";
import { RESTORE_PENDING_FILE } from "../src/vault-carriers.js";
import { larDataDir, larIdentityDir, larSealHome } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter, TEST_PASSPHRASE } from "./found-route.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { unlockCustody } from "../src/custody-session.js";
import { openFaceTree } from "../src/face-custody.js";
import { FIXTURE_PASSPHRASE, seatScratchCustody } from "./custody-seat-fixture.js";
import { nodeSessionDoor } from "../src/uds-session-door.js";
import { SessionTable, sessionBinding } from "@lararium/mesh";

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
/**
 * Found a fresh vessel under a fresh scratch root and stand in it, unlocked: a HEARTH by default (the place, its
 * seed charter and persona zero's face, as the Stable founding act stands one), its seed charter alone with no face
 * lit yet (`"charter"`), or a bare place (`"place"`).
 */
async function foundVessel(label: string, as: "hearth" | "charter" | "place" = "hearth"): Promise<string> {
  await leave();
  const root = mkdtempSync(join(tmpdir(), `lar-restore-${label}-`));
  roots.push(root);
  process.env["LAR_ROOT"] = root;
  cpSync(REPO_GENESIS, join(root, "genesis"), { recursive: true });
  await foundDirect({ storageDir: larDataDir(), genesisDir: join(root, "genesis") });
  if (as !== "place") await seatSeedCharter({ name: `${label}-keeper` });
  if (as === "hearth") await foundFace({ genesisDir: join(root, "genesis"), handleIndex: 0 });
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
  readonly rootKey: string; readonly prefix: string; readonly group: string; readonly atomKey: string; readonly vesselKey: string;
  /** The custody keys of A as A held them, read before A was destroyed: the face's FCK and the node key (S). */
  readonly heldKeys: { readonly fck: Uint8Array; readonly nodeKey: Uint8Array; readonly fcid: string };
  /** Where the face enrolled guardians before the cut: the bundle cut BEFORE that enrolment, each guardian's own half, and A's board after it. */
  readonly enrolled?: {
    readonly early: { readonly sealedBody: Uint8Array; readonly bundleKey: Uint8Array; readonly body: FaceBundleBody };
    readonly guardians: readonly { readonly code: string; readonly recoveryPubKey: string }[];
    readonly kel: readonly PersonaKelEvent[];
  };
}
/** The face's FCK and the node key as the standing vessel's trees open them under the test route: what a bundle must never carry. */
async function readHeldKeys(): Promise<{ fck: Uint8Array; nodeKey: Uint8Array; fcid: string }> {
  const homes = { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
  const io = new FsCustodyIo(homes);
  const creds = [{ kind: "passphrase" as const, passphrase: TEST_PASSPHRASE }, { kind: "passphrase" as const, passphrase: FIXTURE_PASSPHRASE }];
  const standing = (await seatedCustody()!.faceStanding({ ordinal: 0 }))!;
  const face = await openFaceTree({ io, homes, fcid: standing.fcid, credentials: creds });
  const node = await unlockCustody({ io, homes, credentials: creds });
  if (face.reading !== "opens" || node.reading !== "opens") throw new Error(`the fixture's trees do not open under the test routes: face ${face.reading}, node ${node.reading}`);
  return { fck: Uint8Array.from(face.fck), nodeKey: Uint8Array.from(node.treeKey), fcid: standing.fcid };
}

/** Cut face 0's bundle on the standing vessel under a fresh key, with an empty memory section. */
async function cutHere(): Promise<{ sealedBody: Uint8Array; bundleKey: Uint8Array; body: FaceBundleBody }> {
  const bundleKey = mintBundleKey();
  const cut = await cutFaceBundle({
    face: 0, bundleKey,
    door: {
      wornFace: () => 0, ownEdgeShadowed: async () => false,
      cutMemory: async (to) => ({ section: Buffer.from(sealMemorySection([], to)).toString("base64"), holds: [] }),
      kel: (prefix) => withRepo((repo) => readLocalPersonaKelChain(repo, prefix)),
      memoryDoor: null, importMemory: null,
    },
  });
  return { sealedBody: cut.sealedBody, bundleKey, body: readFaceBundleBody(openFaceBundleBody(cut.sealedBody, bundleKey)!)! };
}
/**
 * Found vessel A, light a face, give it names, a proof key and a recognised friend, cut its bundle, and DESTROY A.
 * With `guardians` above zero the face first cuts an early bundle, then enrols that many guardians at that
 * threshold by its typed first event, and cuts after.
 */
async function cutOnDestroyedVessel(label: string, faceLabel = "the gardener", proofFill = 3, guardians = 0): Promise<Cut> {
  const root = await foundVessel(label);
  const rootKey = (await listPersonaRosterLines()).find((l) => l.handleIndex === 0)!.verifyingKey;
  await (await makeNodePersonaPetnameStore()).set(0, faceLabel);
  await (await makeNodePersonaDeclarationStore()).set(0, { handle: `${faceLabel}-handle`, seat: true, chair: "CHAIR-ON-A" });
  const proof = secretOf(proofFill);
  await storeFaceProofKey({ faceKey: await publicOf(proof), nexus: "nexus-test-one" }, proof, 0);
  const book = new HandleBook();
  const friend = await cardOf(11, "a-friend");
  await book.ingest(friend, undefined, rootKey);
  book.setPetname(friend.nym, "Ana", rootKey);
  await saveNodeHandleBook(0, book);
  const anchors = (await loadIdentityAnchors(0))!;
  let enrolled: Cut["enrolled"];
  if (guardians > 0) {
    const early = await cutHere();
    const offers = await Promise.all(Array.from({ length: guardians }, () => guardianOffer(anchors.personaKelPrefix!)));
    await withRepo((repo) => runGuardianEnrolment({ repo, handleIndex: 0, offers: offers.map((o) => o.offer), threshold: guardians }));
    enrolled = {
      early, guardians: offers.map((o) => ({ code: o.code, recoveryPubKey: o.recoveryPubKey })),
      kel: await withRepo((repo) => readLocalPersonaKelChain(repo, anchors.personaKelPrefix!)),
    };
  }
  const cut = await cutHere();
  const heldKeys = await readHeldKeys();
  const out: Cut = {
    ...cut, heldKeys, rootKey, prefix: anchors.personaKelPrefix!, group: anchors.personaGroupId,
    atomKey: faceAtomKeyFromSeed((await loadFaceAtomOfGroup(anchors.personaGroupId))!, anchors.personaGroupId).key,
    vesselKey: await loadVesselVerifyingKey(), ...(enrolled ? { enrolled } : {}),
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
const pendingStands = (): boolean => faceRowNames().some((n) => RESTORE_PENDING_FILE.test(n));

describe("a face returns from its bundle onto a fresh vessel", () => {
  test("R1 + R2 — the restored face stands under the same prefix at a NEW seat; a second restore refuses", async () => {
    const a = await cutOnDestroyedVessel("a");
    await foundVessel("b");
    const own = (await listPersonaRosterLines())[0]!;
    expect(own.handleIndex, "CONTROL: the fresh hearth holds persona zero's root alone").toBe(0);
    expect(await loadIdentityAnchors(1)).toBeNull();

    // The fresh hearth's persona zero holds h0; the restored face lands beside it.
    const restored = await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo });
    expect(restored.face).toEqual({ handleIndex: 1, verifyingKey: a.rootKey });
    expect(restored.prefix).toBe(a.prefix);
    expect(restored.resumed).toBe(false);
    expect(restored.checked).toEqual({ seq: 0, from: "bundle" });
    expect(restored.landed).toEqual({ faceProofKeys: 1, petname: true, handle: true, handleBook: { landed: 1, kept: 0 } });

    // THE LINEAGE RETURNED: the same root, the same fixed prefix, the same signer name.
    expect(await listPersonaRosterLines()).toEqual([own, { handleIndex: 1, verifyingKey: a.rootKey }]);
    const anchors = (await loadIdentityAnchors(1))!;
    expect(anchors.personaKelPrefix).toBe(a.prefix);
    expect(anchors.signerDid?.toLowerCase().replace(/^0x/, "")).toBe(a.rootKey);
    // A new seat has another group and atom, its own archive, and an edge for its atom.
    expect(anchors.personaGroupId).not.toBe(a.group);
    const atomKey = faceAtomKeyFromSeed((await loadFaceAtomOfGroup(anchors.personaGroupId))!, anchors.personaGroupId).key;
    expect(atomKey).not.toBe(a.atomKey);
    expect(existsSync(veilArchivePath(anchors.personaGroupId))).toBe(true);
    // The restored face binds THIS hearth: its edge names the seed charter this vessel founded.
    expect(anchors.deviceEdge!.hearthTrueName).toBe((await loadIdentityAnchors(0))!.deviceEdge!.hearthTrueName);
    const here = await loadVesselVerifyingKey();
    expect(here).not.toBe(a.vesselKey);
    expect(JSON.stringify(anchors.deviceEdge).toLowerCase()).toContain(atomKey.toLowerCase());
    expect(JSON.stringify(anchors.deviceEdge).toLowerCase()).not.toContain(here.toLowerCase());
    expect(JSON.stringify(anchors.deviceEdge).toLowerCase()).not.toContain(a.atomKey.toLowerCase());
    expect(JSON.stringify(anchors.deviceEdge).toLowerCase()).not.toContain(a.vesselKey.toLowerCase());
    // The board holds the face's key history.
    expect((await withRepo((repo) => readLocalPersonaKelChain(repo, a.prefix))).map((e) => e.eventCid)).toEqual(a.body.kel.map((e) => e.eventCid));
    // THE CARRIED ROWS LANDED: the names, the record under the face's own tag, the proof key. The seat claim and the chair label stayed behind.
    expect(await (await makeNodePersonaPetnameStore()).get(1)).toBe("the gardener");
    expect(await (await makeNodePersonaDeclarationStore()).get(1)).toEqual({ handle: "the gardener-handle" });
    const friend = (await loadNodeHandleBook(1)).snapshotFor(a.rootKey).records;
    expect(friend.map((r) => r.petname)).toEqual(["Ana"]);
    expect(faceRowNames().filter((n) => FACE_PROOF_KEY_FILE.test(n))).toHaveLength(1);
    expect(pendingStands(), "the pending row leaves once the face stands lit").toBe(false);

    // R2: a second restore over it refuses, and moves nothing.
    const before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("face-already-held");
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("face-already-held");
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);
  });

  test("R12 — a bundle carries no bare face key and no node key, in any form; the scan proves itself on a planted key first", async () => {
    const a = await cutOnDestroyedVessel("a");
    const forms = (k: Uint8Array): string[] => [Buffer.from(k).toString("hex"), Buffer.from(k).toString("base64")];
    const bodyText = JSON.stringify(a.body);
    const rawBytes = Buffer.from(a.sealedBody).toString("latin1");
    const carries = (k: Uint8Array): boolean => forms(k).some((f) => bodyText.includes(f)) || rawBytes.includes(Buffer.from(k).toString("latin1"));
    // KNOWN POSITIVE: the same scan over a body that carries the key finds it.
    const planted = JSON.stringify({ ...a.body, planted: Buffer.from(a.heldKeys.fck).toString("hex") });
    expect(forms(a.heldKeys.fck).some((f) => planted.includes(f))).toBe(true);
    expect(carries(a.heldKeys.fck)).toBe(false);
    expect(carries(a.heldKeys.nodeKey)).toBe(false);
    expect(bodyText).not.toContain(a.heldKeys.fcid);
  });

  test("R13 — a restore opens no sibling: with the sibling face LOCKED the face still returns, and the sibling's ciphertext stays byte-identical", async () => {
    const a = await cutOnDestroyedVessel("a");
    await foundVessel("b");
    const holder = seatedCustody()!;
    const sibling = (await holder.faceStanding({ ordinal: 0 }))!;
    const siblingBytes = (): string => {
      const h = createHash("sha256");
      const dir = join(larIdentityDir(), "faces", sibling.fcid);
      for (const name of readdirSync(dir).sort()) h.update(name).update(readFileSync(join(dir, name)));
      return h.digest("hex");
    };
    const before = siblingBytes();
    await holder.lockFace(sibling.fcid);                                     // the sibling rests shut for the whole restore
    expect(holder.unlockedFaces()).toEqual([]);
    const restored = await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo });
    expect(restored.face).toEqual({ handleIndex: 1, verifyingKey: a.rootKey });
    expect(holder.unlockedFaces().includes(sibling.fcid)).toBe(false);       // the restore opened nothing of the sibling
    expect(siblingBytes()).toBe(before);                                     // and moved nothing of it
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
    expect(await refusalOf(restoreFaceBundle({ ...sealed(a.body), as: 1, withRepo }))).toBe("LANDED");
  });

  test("R14 — an old mixed archive (one body that carries a second face's section) refuses before any write; the single-face body lands", async () => {
    const a = await cutOnDestroyedVessel("a");
    const other = await cutOnDestroyedVessel("other", "the potter", 5);
    await foundVessel("b");
    const before = homeTree();
    const mixed = { ...a.body, siblings: [other.body], petnames: [...(a.body as unknown as { petnames?: unknown[] }).petnames ?? [], other.rootKey] } as unknown as FaceBundleBody;
    const reason = await refusalOf(restoreFaceBundle({ ...sealed(mixed), withRepo }));
    expect(["bundle-refused", "bundle-inconsistent"]).toContain(reason);
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);
    expect(await refusalOf(restoreFaceBundle({ ...sealed(a.body), as: 1, withRepo }))).toBe("LANDED");   // CONTROL
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
    expect((await listPersonaRosterLines()).length).toBe(1);
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
    expect((await listPersonaRosterLines()).length).toBe(1);
    // An event that does not verify moves nothing: a rotation no recovery key signed, planted on the board, refuses
    // nobody. The board holds no event of the lineage, so the check says it read its head off the bundle.
    await foundVessel("planted");
    await withRepo((repo) => seatLocalPersonaKelChain(repo, [{ ...rotated.event, rotationSigs: [] }]));
    expect((await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo })).checked).toEqual({ seq: 0, from: "bundle" });
    // A board that holds the lineage's own head says so.
    await foundVessel("boarded");
    await withRepo((repo) => seatLocalPersonaKelChain(repo, [a.body.kel[0]!]));
    expect((await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo })).checked).toEqual({ seq: 0, from: "board" });
    // CONTROL: the same bundle on a vessel whose board holds no newer head lands.
    await foundVessel("c");
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("LANDED");
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

    // A PLACE WITH NO SEED CHARTER holds no hearth for the restored face to bind to.
    await foundVessel("place", "place");
    let before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("no-hearth");
    expect(homeTree()).toBe(before);

    // A roster line for another key at the index: persona zero's own root, which the seed charter's seat claim stands for.
    await foundVessel("b", "charter");
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("roster-names-another-key");
    expect(homeTree()).toBe(before);

    // A lit face at the index (another face, restored there first, beside persona zero).
    await foundVessel("c");
    expect(await refusalOf(restoreFaceBundle({ sealedBody: other.sealedBody, bundleKey: other.bundleKey, as: 1, withRepo }))).toBe("LANDED");
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("roster-names-another-key");
    // CONTROL: beside the lit faces, at a free index, the same bundle lands as a compartment.
    expect(homeTree()).toBe(before);
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 2, withRepo }))).toBe("LANDED");
    expect((await loadIdentityAnchors(2))?.personaKelPrefix).toBe(a.prefix);

    // AN ADMITTED FACE holds anchors at its index and no root: the index stands lit, with no roster line to name.
    await foundVessel("lit");
    await persistIdentityAnchors({ personaGroupId: "an-admitted-group", meshCabalDocIdHex: "an-admitted-cabal" }, 1);
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("index-held");
    expect(homeTree()).toBe(before);

    // AN ORPHAN ROOT under another key: a root row with no roster line (an act that stopped between its two writes).
    await foundVessel("orphan", "charter");
    expect(await removeCustodyRow("identity", ".persona-roster-h0.json")).toBe(true);
    expect(await listPersonaRosterLines()).toEqual([]);
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo }))).toBe("orphan-names-another-key");
    expect(homeTree()).toBe(before);

    // A NAMES ROW THAT STANDS AND DOES NOT READ WHOLE refuses by its own name before the commit row: the landing
    // meets no row the preflight has not already read.
    await foundVessel("torn");
    await seatedCustody()!.writeRow("identity", ".persona-petnames-h1.json", new TextEncoder().encode("{ this row reads as no map"));
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toMatch(/^threw: custody row identity\/\.persona-petnames.*reads malformed/);
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);

    // A face at an index above zero on a hearth whose founding face never lit (its seed charter stands alone).
    await foundVessel("d", "charter");
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 2, withRepo }))).toBe("founding-face-unlit");
    // A proof key row under other bytes for the same face at the same Nexus.
    await foundVessel("e");
    const clash = secretOf(9);
    await storeFaceProofKey({ faceKey: await publicOf(clash), nexus: "nexus-test-one" }, clash, 1);
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("row-conflict");
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);
    expect([...RESTORE_REFUSALS]).toEqual([
      "bundle-refused", "bundle-inconsistent", "root-superseded", "face-already-held", "restore-pending", "place-unfounded",
      "founding-face-unlit", "no-hearth", "index-held", "roster-names-another-key", "orphan-names-another-key", "row-conflict",
      "guardian-key-serves-another-face", "hearth-stands",
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
    const restored = await restoreFaceBundle({ ...sealed({ ...a.body, kel: [...a.body.kel, veto] }), as: 1, withRepo });
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
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("threw: the rite stopped");
    expect(pendingStands(), "the commit row stands: this restore owes its rest").toBe(true);
    expect(await loadIdentityAnchors(1)).toBeNull();
    // Another face's restore refuses while this one stands pending.
    expect(await refusalOf(restoreFaceBundle({ sealedBody: other.sealedBody, bundleKey: other.bundleKey, as: 2, withRepo }))).toBe("restore-pending");
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
    expect(await loadIdentityAnchors(1)).toBeNull();
    // The same restore again completes, from the row.
    rite.mockImplementation(real);
    const again = await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, withRepo });
    expect(again.resumed).toBe(true);
    expect(again.face).toEqual({ handleIndex: 1, verifyingKey: a.rootKey });
    expect(pendingStands()).toBe(false);
    expect((await loadIdentityAnchors(1))?.personaKelPrefix).toBe(a.prefix);
  });

  test("R8 — a restore lands additively: a name this vessel already holds stays", async () => {
    const a = await cutOnDestroyedVessel("a");
    await foundVessel("b");
    await (await makeNodePersonaPetnameStore()).set(1, "a name kept here");
    const restored = await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo });
    expect(restored.landed.petname).toBe(false);
    expect(restored.landed.handle).toBe(true);
    expect(await (await makeNodePersonaPetnameStore()).get(1)).toBe("a name kept here");
  });

  test("R10 — a restore after guardian enrolment carries the face's set, and an earlier bundle still restores", async () => {
    const a = await cutOnDestroyedVessel("a", "the gardener", 3, 2);
    const { early, guardians, kel } = a.enrolled!;
    const setHash = sealKeySetHash(guardians.map((g) => g.recoveryPubKey), 2);
    expect(kel.map((e) => e.kind ?? "plain"), "CONTROL: A's board heads at the typed first enrolment").toEqual(["plain", "guardian-enrolment"]);
    expect(early.body.guardianSet, "the early cut carries no set: its log stood one-of-one").toBeNull();
    expect(a.body.guardianSet?.guardianSetHash, "the later cut carries the set its log commits").toBe(setHash);
    expect(a.body.guardianSet?.guardians.map((g) => g.recoveryPubKey)).toEqual(guardians.map((g) => g.recoveryPubKey));

    // THE LATER BUNDLE lands, and seats the face's sealed set row at the target index.
    await foundVessel("b");
    const restored = await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo });
    expect(restored.checked).toEqual({ seq: 1, from: "bundle" });
    expect(restored.guardianSet).toBe("landed");
    expect(await readGuardianSet(1)).toEqual({ prefix: a.prefix, ...a.body.guardianSet });
    expect((await loadIdentityAnchors(1))?.personaKelPrefix).toBe(a.prefix);

    // THE EARLY BUNDLE restores over a board that holds the enrolment the root itself signed; the set rode no bundle.
    await foundVessel("c");
    await withRepo((repo) => seatLocalPersonaKelChain(repo, kel));
    const late = await restoreFaceBundle({ sealedBody: early.sealedBody, bundleKey: early.bundleKey, as: 1, withRepo });
    expect(late.checked).toEqual({ seq: 1, from: "board" });
    expect(late.guardianSet).toBe("absent");
    expect(await readGuardianSet(1)).toBeNull();

    // A GUARDIANS' ROTATION that moves the set cuts every earlier bundle off.
    const moved = await attestAndRotate({
      head: kel[1]!, freshOpKeyDid: `0x${a.rootKey}`, guardianRecoveryKeys: guardians.map((g) => g.recoveryPubKey), recoveryThreshold: 2,
      guardianSigners: guardians.map((g) => ({ signer: g.recoveryPubKey, sign: (bytes: Uint8Array) => ed.signAsync(bytes, coldKeySeedFromCode(g.code)).then(hex) })),
      next: { guardians: [guardianRecoveryRegistrationCard("guardian-a", await publicOf(secretOf(61)), "a new guardian")], threshold: 1 },
    });
    if (!moved.ok) throw new Error(`setup: the guardians' rotation refused: ${moved.reason}`);
    await foundVessel("d");
    await withRepo((repo) => seatLocalPersonaKelChain(repo, [...kel, moved.event]));
    let before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("root-superseded");
    expect(await refusalOf(restoreFaceBundle({ sealedBody: early.sealedBody, bundleKey: early.bundleKey, as: 1, withRepo }))).toBe("root-superseded");
    expect(homeTree()).toBe(before);

    // A CARRIED SET ITS OWN LOG DOES NOT COMMIT: another digest beside the enrolment, and a set beside a one-of-one log.
    await foundVessel("e");
    before = homeTree();
    const other = { ...a.body.guardianSet!, guardianSetHash: sealKeySetHash([guardians[0]!.recoveryPubKey], 1), threshold: 1, guardians: [a.body.guardianSet!.guardians[0]!] };
    expect(await refusalOf(restoreFaceBundle({ ...sealed({ ...a.body, guardianSet: other }), as: 1, withRepo }))).toBe("bundle-inconsistent");
    expect(await refusalOf(restoreFaceBundle({ ...sealed({ ...early.body, guardianSet: a.body.guardianSet }), as: 1, withRepo }))).toBe("bundle-inconsistent");
    // A set whose registrations do not recompute the digest it names.
    const bent = { ...a.body.guardianSet!, guardians: [a.body.guardianSet!.guardians[1]!, a.body.guardianSet!.guardians[1]!] };
    expect(await refusalOf(restoreFaceBundle({ ...sealed({ ...a.body, guardianSet: bent }), as: 1, withRepo }))).toBe("bundle-inconsistent");
    expect(homeTree()).toBe(before);

    // A CARRIED KEY ANOTHER FACE OF THIS VESSEL GUARDS WITH refuses, naming that face.
    const shared = { prefix: "persona-" + "00".repeat(32), guardianSetHash: sealKeySetHash([guardians[1]!.recoveryPubKey], 1), threshold: 1, guardians: [a.body.guardianSet!.guardians[1]!] };
    await writeCustodyRow("identity", guardianSetFile(0), new TextEncoder().encode(JSON.stringify(shared)));
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("guardian-key-serves-another-face");
    expect(homeTree()).toBe(before);

    // A SET ROW AT THE TARGET under another set refuses `row-conflict`; the same set there lands beside it.
    await foundVessel("f");
    const fresh = await publicOf(secretOf(71));
    const stale = { prefix: a.prefix, guardianSetHash: sealKeySetHash([fresh], 1), threshold: 1, guardians: [guardianRecoveryRegistrationCard("guardian-a", fresh, null)] };
    await writeCustodyRow("identity", guardianSetFile(1), new TextEncoder().encode(JSON.stringify(stale)));
    before = homeTree();
    expect(await refusalOf(restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo }))).toBe("row-conflict");
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);
    await writeCustodyRow("identity", guardianSetFile(1), new TextEncoder().encode(JSON.stringify({ prefix: a.prefix, ...a.body.guardianSet })));
    expect((await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo })).guardianSet).toBe("held");
  });
  test("R15 — a restored face standing provisional, and a face this vessel founded, each open a session at the place through the production door, so persona.confirm and the guardian enrolment ride it", async () => {
    const a = await cutOnDestroyedVessel("a");
    await foundVessel("b");
    await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo });
    expect(await readProvisionalMark(1)).not.toBeNull();                       // h1 stands provisional
    expect(await readProvisionalMark(0)).toBeNull();                           // h0, founded here, stands whole
    // The production door with its real ports: the face's anchors, its atom row, the place KEL. No dial pin stands, so
    // each session anchors at this vessel's own place.
    const door = nodeSessionDoor({ pin: () => null, sealHome: larSealHome() });
    const anchor = await door.anchorNow();
    expect(anchor.kind).toBe("place");
    for (const face of [0, 1]) {
      const opened = await door.open({ faceRef: `h${face}`, hand: "cli" });
      if (!opened.ok) throw new Error(`h${face} refused: ${opened.refusal}`);
      const group = (await loadIdentityAnchors(face))!.personaGroupId;
      const atomKey = faceAtomKeyFromSeed((await loadFaceAtomOfGroup(group))!, group).key;
      expect(opened.supply).toMatchObject({ ordinal: face, presenter: `0x${atomKey}`, anchor, face: { personaGroup: group } });
      // The atom certifies the session's signer once the table holds the session live.
      const table = new SessionTable("owner");
      const binding = sessionBinding(`socket-${face}`);
      const live = table.open(binding, opened.supply.face, opened.supply.profile);
      if (!live.ok) throw new Error(live.refusal);
      const minted = await opened.supply.mint({ table, binding, session: live.session });
      expect(minted.ok, `h${face} mints its signer`).toBe(true);
      if (minted.ok) minted.signer.drop();
    }
    // CONTROL: a face this vessel does not hold refuses by name.
    expect(await door.open({ faceRef: "h2", hand: "cli" })).toEqual({ ok: false, refusal: "face-absent" });
  });

  test("R11 — a restored face stands provisional until a party's own view agrees with its head", async () => {
    const a = await cutOnDestroyedVessel("a", "the gardener", 3, 1);
    const { guardians, kel } = a.enrolled!;
    await foundVessel("b");
    expect(await readProvisionalMark(0), "CONTROL: the face this vessel founded carries no mark").toBeNull();
    await expect(refuseWhileProvisional(0, "a control act")).resolves.toBeUndefined();

    const restored = await restoreFaceBundle({ sealedBody: a.sealedBody, bundleKey: a.bundleKey, as: 1, withRepo });
    const head = { seq: 1, eventCid: kel[1]!.eventCid };
    expect(await readProvisionalMark(1)).toEqual({ prefix: a.prefix, head, from: "bundle" });
    expect(restored.provisional.couldConfirm.some((l) => l.includes(guardians[0]!.recoveryPubKey.slice(0, 16)))).toBe(true);

    // AN ENROLMENT REFUSES by name, on its own door and through the sealed act door; nothing lands on the board.
    const offer = (await guardianOffer(a.prefix)).offer;
    const provisionalOf = async (p: Promise<unknown>): Promise<string> => {
      const e = await p.then(() => null, (err: unknown) => err);
      return e instanceof FaceProvisional ? `provisional:${e.act}` : e instanceof SealedActRefused ? `sealed:${e.reason}` : `other:${String(e)}`;
    };
    expect(await provisionalOf(withRepo((repo) => runGuardianEnrolment({ repo, handleIndex: 1, offers: [offer], threshold: 1 })))).toBe("provisional:guardian enrolment");
    const ctx = { kelHead: null, personaSelves: null, walk: null, hosting: { withRepo } } as unknown as Parameters<typeof runSealedAct>[2];
    expect(await provisionalOf(runSealedAct("persona.guardian.enrol", { handleIndex: 1, offers: offer, threshold: 1 }, ctx))).toBe("sealed:face-provisional");
    expect((await withRepo((repo) => readLocalPersonaKelChain(repo, a.prefix))).length).toBe(2);
    expect(await runSealedAct("persona.provisional", { handleIndex: 1 }, ctx)).toMatchObject({ provisional: true, head, from: "bundle" });

    // EVERY VIEW THAT DOES NOT CONFIRM refuses by name and keeps the mark.
    const guardianSeed = coldKeySeedFromCode(guardians[0]!.code);
    const strangerSeed = secretOf(91);
    const confirmOf = async (view: string): Promise<string> => {
      const e = await confirmProvisional({ handleIndex: 1, view }).then(() => null, (err: unknown) => err);
      return e === null ? "CONFIRMED" : e instanceof ConfirmRefused ? e.reason : `threw: ${String(e)}`;
    };
    const viewOf = async (over: Partial<{ prefix: string; seq: number; eventCid: string; party: "guardian" | "chair" | "sibling"; seed: Uint8Array }>): Promise<string> =>
      faceLogViewLine(await signFaceLogView({ prefix: a.prefix, ...head, party: "guardian", seed: guardianSeed, ...over }));
    const ownSeatKey = readNexusDoc(larSealHome())!.kahu.find((k) => k.verifyingKey)!.verifyingKey!;
    expect(await confirmOf("lar-log-view:not-a-view")).toBe("view-malformed");
    expect(await confirmOf(await viewOf({ prefix: "persona-" + "00".repeat(32) }))).toBe("view-other-face");
    const signed = await signFaceLogView({ prefix: a.prefix, ...head, party: "guardian", seed: guardianSeed });
    expect(await confirmOf(faceLogViewLine({ ...signed, seq: 0 }))).toBe("view-unsigned");
    expect(await confirmOf(await viewOf({ seed: strangerSeed }))).toBe("party-not-standing");
    expect(await confirmOf(await viewOf({ party: "chair", seed: strangerSeed }))).toBe("party-not-standing");
    const ownChair = await withRepo((repo) => chairLogView({ repo, prefix: a.prefix, seatKey: ownSeatKey }));
    expect(ownChair).toMatchObject({ ...head, party: "chair" });
    expect(await confirmOf(faceLogViewLine(ownChair)), "a chair this vessel holds speaks for this vessel, never as another party").toBe("party-not-standing");
    expect(await confirmOf(await viewOf({ party: "sibling" }))).toBe("party-unread");
    expect(await confirmOf(await viewOf({ seq: 0, eventCid: kel[0]!.eventCid }))).toBe("view-disagrees");
    expect(await readProvisionalMark(1), "every refusal keeps the mark").toEqual({ prefix: a.prefix, head, from: "bundle" });

    // A GUARDIAN'S OWN AGREEING VIEW lifts the mark: the head its view names comes off a board (`persona.head`), and
    // its card signs it; a second confirm finds none.
    const boardHead = await runSealedAct("persona.head", { prefix: a.prefix }, ctx);
    expect(boardHead).toEqual({ prefix: a.prefix, ...head });
    const guardianView = await viewOf({ seq: Number(boardHead["seq"]), eventCid: String(boardHead["eventCid"]) });
    expect(await runSealedAct("persona.confirm", { handleIndex: 1, view: guardianView }, ctx)).toMatchObject({ handleIndex: 1, party: "guardian", head });
    expect(await readProvisionalMark(1)).toBeNull();
    expect(await confirmOf(await viewOf({}))).toBe("not-provisional");
    await expect(refuseWhileProvisional(1, "guardian enrolment")).resolves.toBeUndefined();
  });
});
