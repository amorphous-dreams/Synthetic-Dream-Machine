/**
 * face-card-restore — the root cards re-land a face's lineage and root, and open no memory, on the real doors.
 *
 * Vessel A founds a hearth, lights a face, splits its root 2-of-3 by the real founding split
 * (`armRecoveryAtFounding`, the act `persona new --split-root` runs), and gets destroyed: the device share dies with
 * it. The person holds the recorded code and the escrow carrier. Vessel B founds fresh and the reader restores.
 *
 *   C1  two cards from distinct custodians restore the face onto B at a free index: the same root, the same fixed
 *       prefix, a NEW seat (another key group, another veil, a device edge for B's own key). The face holds no
 *       content key, no memory entry, no proof key, no name and no handle-book record; the pending row leaves.
 *   C2  too few cards, one custodian, a repeated card and a malformed card each refuse by name before any write.
 *       control: the same two honest cards land.
 *   C3  cards of two different faces refuse `cards-another-root`; so do honest cards over a face named wrongly,
 *       and a face unnamed refuses `face-unnamed`. controls: the cards of each face land under that face's own name.
 *   C4  a board that holds a rotation away from the root refuses `root-superseded`, with the restore's own name
 *       passing through and no row moved.   control: a board that holds the inception alone lands.
 *   C5  paper opens no memory: the built body's memory section holds nothing, and the reader keeps no secret half
 *       for it; the guardian-card split restores through the same reader.
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
  GUARDIAN_SLOT_CUSTODIAN, attestAndRotate, deriveSelfRecoveryKey, faceAtomKeyFromSeed, hex, splitToGuardianCards,
  type PersonaKelEvent, type RandomProvider,
} from "@lararium/mesh";
import * as init from "../src/commands/init.js";
import { armRecoveryAtFounding } from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import {
  CARD_REFUSALS, CardRestoreRefused, buildCardBody, restoreFaceFromCards, type FaceNamed, type PresentedCard,
} from "../src/face-card-restore.js";
import { FACE_PROOF_KEY_FILE } from "../src/face-key-custody.js";
import { faceRowNames } from "./face-paths.js";
import { RestoreRefused } from "../src/face-bundle-restore.js";
import { loadIdentityAnchors, veilArchivePath } from "../src/identity-anchors.js";
import { loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { loadNodeHandleBook } from "../src/node-circle-store.js";
import {
  listPersonaRosterLines, loadVesselVerifyingKey, makeNodePersonaDeclarationStore, makeNodePersonaPetnameStore,
} from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { readLocalPersonaKelChain, seatLocalPersonaKelChain } from "../src/local-persona-kel.js";
import { RESTORE_PENDING_FILE } from "../src/vault-carriers.js";
import { larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

vi.setConfig({ testTimeout: 600_000, hookTimeout: 600_000 });

const REPO_GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const foundFace = direct(init.runFoundTheFace);
const withRepo = <T>(act: Parameters<typeof ownedStore<T>>[1]): Promise<T> => ownedStore(larDataDir(), act);

const roots: string[] = [];
const priorRoot = process.env["LAR_ROOT"];
async function leave(): Promise<void> {
  const holder = seatedCustody();
  if (holder) { await holder.lock(); unseatCustody(holder); }
}
/** Found a hearth (the place, its seed charter, persona zero's face) under a fresh scratch root and stand in it, unlocked. */
async function foundVessel(label: string): Promise<string> {
  await leave();
  const root = mkdtempSync(join(tmpdir(), `lar-cards-${label}-`));
  roots.push(root);
  process.env["LAR_ROOT"] = root;
  cpSync(REPO_GENESIS, join(root, "genesis"), { recursive: true });
  await foundDirect({ storageDir: larDataDir(), genesisDir: join(root, "genesis") });
  await seatSeedCharter({ name: `${label}-keeper` });
  await foundFace({ genesisDir: join(root, "genesis"), handleIndex: 0 });
  return root;
}
afterEach(async () => {
  vi.restoreAllMocks();
  await leave();
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

interface Faces {
  /** The recorded code and escrow carrier each face's founding split handed the person, by handle-index. */
  readonly cards: ReadonlyMap<number, { readonly recordedCode: string; readonly escrowCarrier: string }>;
  readonly keys:  ReadonlyMap<number, { readonly rootKey: string; readonly prefix: string; readonly group: string; readonly atomKey: string }>;
  readonly vesselKey: string;
}
const paper = (f: Faces, index: number): PresentedCard[] => [
  { code: f.cards.get(index)!.recordedCode, custodian: "recorded-code" },
  { code: f.cards.get(index)!.escrowCarrier, custodian: "escrow-peer" },
];
const named = (f: Faces, index: number): FaceNamed => ({ verifyingKey: f.keys.get(index)!.rootKey });

/**
 * Found vessel A, light persona zero and a second face, split each root by the real founding split, give the first
 * face names and a handle-book, and DESTROY A: nothing of it survives but the cards in hand.
 */
async function splitOnDestroyedVessel(label: string): Promise<Faces> {
  const root = await foundVessel(label);
  await foundFace({ genesisDir: join(root, "genesis"), handleIndex: 1 });
  await (await makeNodePersonaPetnameStore()).set(0, "the gardener");
  await (await makeNodePersonaDeclarationStore()).set(0, { handle: "the-gardener-handle" });
  const cards = new Map<number, { recordedCode: string; escrowCarrier: string }>();
  const keys = new Map<number, { rootKey: string; prefix: string; group: string; atomKey: string }>();
  for (const index of [0, 1]) {
    const armed = await armRecoveryAtFounding(larDataDir(), index);
    expect(armed.minted, `setup: the split of h${index} armed`).toBe(true);
    cards.set(index, { recordedCode: armed.recordedCode, escrowCarrier: armed.escrowCarrier });
    const anchors = (await loadIdentityAnchors(index))!;
    keys.set(index, {
      rootKey: (await listPersonaRosterLines()).find((l) => l.handleIndex === index)!.verifyingKey,
      prefix: anchors.personaKelPrefix!, group: anchors.personaGroupId,
      atomKey: faceAtomKeyFromSeed((await loadFaceAtomOfGroup(anchors.personaGroupId))!, anchors.personaGroupId).key,
    });
  }
  const out: Faces = { cards, keys, vesselKey: await loadVesselVerifyingKey() };
  await leave();
  rmSync(root, { recursive: true, force: true });
  expect(existsSync(root)).toBe(false);
  return out;
}

const refusalOf = async (p: Promise<unknown>): Promise<string> => {
  const e = await p.then(() => null, (err: unknown) => err);
  if (e === null) return "LANDED";
  if (e instanceof CardRestoreRefused || e instanceof RestoreRefused) return e.reason;
  return `threw: ${(e as Error).message.slice(0, 120)}`;
};
/** Every file under this root's identity and storage homes, by path, with a digest of its bytes. */
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
/** The identity home's files and every file in its indexed face directories. */
const identityNames = (): string[] => [...readdirSync(larIdentityDir()), ...faceRowNames()].sort();
const pendingStands = (): boolean => faceRowNames().some((n) => RESTORE_PENDING_FILE.test(n));

describe("the root cards re-land a face's lineage and root, and open no memory", () => {
  test("C1 — two cards restore the face onto a fresh hearth at a free index, under a new seat, holding no key and no memory", async () => {
    const a = await splitOnDestroyedVessel("a");
    await foundVessel("b");
    const own = (await listPersonaRosterLines())[0]!;
    const heldBefore = identityNames();
    expect(own.handleIndex, "CONTROL: the fresh hearth holds persona zero's root alone").toBe(0);
    expect(await loadIdentityAnchors(1)).toBeNull();
    const face = a.keys.get(0)!;

    const restored = await restoreFaceFromCards({ cards: paper(a, 0), face: named(a, 0), as: 1, withRepo });
    expect(restored.face).toEqual({ handleIndex: 1, verifyingKey: face.rootKey });
    expect(restored.prefix).toBe(face.prefix);
    expect(restored.resumed).toBe(false);
    expect(restored.guardianSet).toBe("none");
    // PAPER LANDED THE ROOT AND NOTHING ELSE: no proof key, no name, no handle-book record, no memory entry.
    expect(restored.landed).toEqual({ faceProofKeys: 0, petname: false, handle: false, handleBook: { landed: 0, kept: 0 } });
    expect(restored.holds, "the memory section holds no key version").toEqual([]);
    expect(faceRowNames().filter((n) => FACE_PROOF_KEY_FILE.test(n))).toHaveLength(0);
    expect(await (await makeNodePersonaPetnameStore()).get(1)).toBeUndefined();
    expect((await loadNodeHandleBook(1)).snapshotFor(face.rootKey).records).toEqual([]);

    // THE LINEAGE RETURNED: the same root, the same fixed prefix, the same signer name, at a NEW seat.
    expect(await listPersonaRosterLines()).toEqual([own, { handleIndex: 1, verifyingKey: face.rootKey }]);
    const anchors = (await loadIdentityAnchors(1))!;
    expect(anchors.personaKelPrefix).toBe(face.prefix);
    expect(anchors.signerDid?.toLowerCase().replace(/^0x/, "")).toBe(face.rootKey);
    expect(anchors.personaGroupId).not.toBe(face.group);
    const atomKey = faceAtomKeyFromSeed((await loadFaceAtomOfGroup(anchors.personaGroupId))!, anchors.personaGroupId).key;
    expect(atomKey).not.toBe(face.atomKey);
    expect(existsSync(veilArchivePath(anchors.personaGroupId))).toBe(true);
    const here = await loadVesselVerifyingKey();
    expect(here).not.toBe(a.vesselKey);
    expect(JSON.stringify(anchors.deviceEdge).toLowerCase()).toContain(atomKey.toLowerCase());
    expect(JSON.stringify(anchors.deviceEdge).toLowerCase()).not.toContain(here.toLowerCase());
    expect(JSON.stringify(anchors.deviceEdge).toLowerCase()).not.toContain(face.atomKey.toLowerCase());
    expect(JSON.stringify(anchors.deviceEdge).toLowerCase()).not.toContain(a.vesselKey.toLowerCase());
    // The board holds the inception alone: the cards carry the root's own first event and no later one.
    expect((await withRepo((repo) => readLocalPersonaKelChain(repo, face.prefix))).map((e) => e.seq)).toEqual([0]);
    expect(pendingStands(), "the pending row leaves once the face stands lit").toBe(false);
    // THE NEW FILES ARE THE FACE'S OWN ROWS: the root, its roster line, its anchors and its veil; no row of a key bag.
    const landed = identityNames().filter((n) => !heldBefore.includes(n));
    expect(landed.length, "setup: the restore landed rows").toBeGreaterThan(0);
    expect(landed.filter((n) => /content|memory|bag|key-version|keyversion|wrap/i.test(n)), `landed rows: ${landed.join(", ")}`).toEqual([]);

    // A second restore over it refuses, and moves nothing.
    const before = homeTree();
    expect(await refusalOf(restoreFaceFromCards({ cards: paper(a, 0), face: named(a, 0), as: 2, withRepo }))).toBe("face-already-held");
    expect(homeTree()).toBe(before);
  });

  test("C2 — too few cards, one custodian, a repeated card and a malformed card each refuse by name before any write", async () => {
    const a = await splitOnDestroyedVessel("a");
    await foundVessel("b");
    const before = homeTree();
    const [recorded, escrow] = paper(a, 0) as [PresentedCard, PresentedCard];
    const refusing = (cards: PresentedCard[], as = 1): Promise<string> => refusalOf(restoreFaceFromCards({ cards, face: named(a, 0), as, withRepo }));

    expect(await refusing([])).toBe("cards-too-few");
    expect(await refusing([recorded])).toBe("cards-too-few");
    expect(await refusing([escrow])).toBe("cards-too-few");
    // Two cards labelled as one custodian: no solo quorum.
    expect(await refusing([recorded, { ...escrow, custodian: "recorded-code" }])).toBe("cards-one-custodian");
    // One card twice.
    expect(await refusing([recorded, { ...recorded, custodian: "escrow-peer" }])).toBe("cards-repeat");
    // A malformed card: a slipped character (the checksum catches it), a short code, a stranger's text, a custodian no split holds.
    const slipped = recorded.code.slice(0, 10) + (recorded.code[10] === "0" ? "1" : "0") + recorded.code.slice(11);
    expect(slipped).not.toBe(recorded.code);
    expect(await refusing([{ ...recorded, code: slipped }, escrow])).toBe("card-malformed");
    expect(await refusing([{ ...recorded, code: recorded.code.slice(0, 6) }, escrow])).toBe("card-malformed");
    expect(await refusing([{ ...recorded, code: "not a card" }, escrow])).toBe("card-malformed");
    expect(await refusing([{ ...recorded, custodian: "neighbour" as never }, escrow])).toBe("card-malformed");
    // A target index that reads as no index.
    expect(await refusing([recorded, escrow], -1)).toBe("face-unnamed");
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);
    expect([...CARD_REFUSALS]).toEqual(["cards-too-few", "cards-one-custodian", "card-malformed", "cards-repeat", "face-unnamed", "cards-another-root"]);

    // CONTROL: the same two honest cards, with a stray space and capitals a transcription adds, land.
    expect(await refusing([{ ...recorded, code: ` ${recorded.code.toUpperCase()} ` }, escrow])).toBe("LANDED");
  });

  test("C3 — cards of two faces, a wrong name and no name each refuse before any write; each face lands under its own name", async () => {
    const a = await splitOnDestroyedVessel("a");
    await foundVessel("b");
    const before = homeTree();
    const mixed: PresentedCard[] = [
      { code: a.cards.get(0)!.recordedCode, custodian: "recorded-code" },
      { code: a.cards.get(1)!.escrowCarrier, custodian: "escrow-peer" },
    ];
    // CONTROL FOR THE FIXTURE: the two faces carry different roots, so the mixed pair rebuilds neither.
    expect(a.keys.get(0)!.rootKey).not.toBe(a.keys.get(1)!.rootKey);
    expect(await refusalOf(restoreFaceFromCards({ cards: mixed, face: named(a, 0), as: 1, withRepo }))).toBe("cards-another-root");
    expect(await refusalOf(restoreFaceFromCards({ cards: mixed, face: named(a, 1), as: 1, withRepo }))).toBe("cards-another-root");
    expect(await refusalOf(restoreFaceFromCards({ cards: mixed, face: { prefix: a.keys.get(0)!.prefix }, as: 1, withRepo }))).toBe("cards-another-root");
    // Honest cards over the other face's name.
    expect(await refusalOf(restoreFaceFromCards({ cards: paper(a, 0), face: named(a, 1), as: 1, withRepo }))).toBe("cards-another-root");
    expect(await refusalOf(restoreFaceFromCards({ cards: paper(a, 0), face: { prefix: a.keys.get(1)!.prefix }, as: 1, withRepo }))).toBe("cards-another-root");
    // A name with a prefix of one face and a key of the other.
    expect(await refusalOf(restoreFaceFromCards({ cards: paper(a, 0), face: { verifyingKey: a.keys.get(0)!.rootKey, prefix: a.keys.get(1)!.prefix }, as: 1, withRepo }))).toBe("cards-another-root");
    // No name at all: a code carries no root to check against.
    expect(await refusalOf(restoreFaceFromCards({ cards: paper(a, 0), face: {}, as: 1, withRepo }))).toBe("face-unnamed");
    expect(homeTree()).toBe(before);
    expect(pendingStands()).toBe(false);

    // CONTROLS: each face lands under its own name, by key (with the 0x spelling) and by prefix.
    expect(await refusalOf(restoreFaceFromCards({ cards: paper(a, 0), face: { verifyingKey: `0x${a.keys.get(0)!.rootKey.toUpperCase()}` }, as: 1, withRepo }))).toBe("LANDED");
    expect(await refusalOf(restoreFaceFromCards({ cards: paper(a, 1), face: { prefix: a.keys.get(1)!.prefix }, as: 2, withRepo }))).toBe("LANDED");
    expect((await loadIdentityAnchors(1))?.personaKelPrefix).toBe(a.keys.get(0)!.prefix);
    expect((await loadIdentityAnchors(2))?.personaKelPrefix).toBe(a.keys.get(1)!.prefix);
  });

  test("C4 — a board that holds a rotation away from the root refuses `root-superseded` and moves nothing", async () => {
    const a = await splitOnDestroyedVessel("a");
    const face = a.keys.get(0)!;
    // The face's own recovery key (the root derives it) rotates a fresh operating key in beneath the fixed prefix.
    await foundVessel("b");
    const body = await buildCardBody({ cards: paper(a, 0), face: named(a, 0), as: 1 });
    const seed = Uint8Array.from(Buffer.from(body.root.signingKey, "hex"));
    const recovery = await deriveSelfRecoveryKey(seed);
    const fresh = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 41) & 0xff);
    const rotated = await attestAndRotate({
      head: body.kel[0]!, freshOpKeyDid: `0x${hex(await ed.getPublicKeyAsync(fresh))}`, guardianRecoveryKeys: [recovery.verifyingKey], recoveryThreshold: 1,
      guardianSigners: [{ signer: recovery.verifyingKey, sign: (bytes) => ed.signAsync(bytes, Buffer.from(recovery.signingKey, "hex")).then(hex) }],
    });
    if (!rotated.ok) throw new Error(`setup: the rotation refused: ${rotated.reason}`);
    const newer: PersonaKelEvent[] = [body.kel[0]!, rotated.event];
    expect(newer[1]!.prefix, "setup: the rotation stands under the cards' own prefix").toBe(face.prefix);

    await withRepo((repo) => seatLocalPersonaKelChain(repo, newer));
    const boarded = homeTree();
    expect(await refusalOf(restoreFaceFromCards({ cards: paper(a, 0), face: named(a, 0), as: 1, withRepo }))).toBe("root-superseded");
    expect(homeTree()).toBe(boarded);
    expect(pendingStands()).toBe(false);
    expect((await listPersonaRosterLines()).length).toBe(1);
    expect(await loadIdentityAnchors(1)).toBeNull();

    // CONTROL: a board that holds the inception alone lands, and says its head came off the board.
    await foundVessel("c");
    await withRepo((repo) => seatLocalPersonaKelChain(repo, [body.kel[0]!]));
    const landed = await restoreFaceFromCards({ cards: paper(a, 0), face: named(a, 0), as: 1, withRepo });
    expect(landed.checked).toEqual({ seq: 0, from: "board" });
  });

  test("C5 — paper opens no memory: the built body holds an empty section and no key, and a guardian-card split restores through the same reader", async () => {
    const a = await splitOnDestroyedVessel("a");
    await foundVessel("b");
    const body = await buildCardBody({ cards: paper(a, 0), face: named(a, 0), as: 1 });
    expect(body.memory.holds).toEqual([]);
    expect(body.faceProofKeys).toEqual([]);
    expect(body.handleBook.records).toEqual([]);
    expect(body.names).toEqual({});
    expect(body.guardianSet).toBeNull();
    expect(body.kel).toHaveLength(1);
    expect(body.rosterLine).toEqual({ handleIndex: 1, verifyingKey: a.keys.get(0)!.rootKey });
    // The section reads as base64 of a sealed box, and two builds seal to two throwaway keys: no pair the bundle key
    // or the root derives opens it.
    const again = await buildCardBody({ cards: paper(a, 0), face: named(a, 0), as: 1 });
    expect(body.memory.section).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(again.memory.section).not.toBe(body.memory.section);

    // A GUARDIAN-CARD SPLIT of the same root (mine, guardian-A, guardian-B) rebuilds it from any two cards.
    const rng: RandomProvider = { getRandomValues: (b) => globalThis.crypto.getRandomValues(b) };
    const seed = Uint8Array.from(Buffer.from(body.root.signingKey, "hex"));
    const split = splitToGuardianCards(seed, "Ana", "Bo", 1, rng);
    const guardians = split.cards.filter((c) => c.slot !== "mine").map((c): PresentedCard => ({ code: c.shareCode, custodian: GUARDIAN_SLOT_CUSTODIAN[c.slot] }));
    expect(guardians.map((c) => c.custodian)).toEqual(["guardian", "escrow-peer"]);
    expect(await refusalOf(restoreFaceFromCards({ cards: guardians.slice(0, 1), face: named(a, 0), as: 1, withRepo }))).toBe("cards-too-few");
    const landed = await restoreFaceFromCards({ cards: guardians, face: named(a, 0), as: 1, withRepo });
    expect(landed.face).toEqual({ handleIndex: 1, verifyingKey: a.keys.get(0)!.rootKey });
    expect(landed.holds).toEqual([]);
  });
});
