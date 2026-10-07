/**
 * admit-bundle.test.ts — the CARRIED admit (O8): a joinee takes the admit bundle by hand, keeps it per Nexus, and
 * its dial presents it at the hearth that issued it, and nowhere else (F2).
 *
 * Proven:
 *   · TAKE refuses, writing nothing: a bundle for a leaf this vessel does not hold; a tampered admit; a forged
 *     one (signed by hands the charter never seated); a bundle for a Nexus this vessel holds no charter for;
 *   · TAKE keeps a whole bundle at `<sealHome>/nexus/carriage-admit/<aid>.json`, beside the consent;
 *   · THE DIALED NEXUS ONLY (F2) — primary P holds an admit, the dialed hearth belongs to Q, carried Q holds no
 *     admit: nothing presents and no board is read, so P's leaf never reaches Q. CONTROL: dialing P's own
 *     hearth presents P's admit;
 *   · KEPT vs BOARD — the board's admit head presents only when it descends from the kept admit; an admit on
 *     the board that does not descend from it leaves the kept one presenting;
 *   · A PRIVATE gate holds the kept bundle: no board ever crossed to the joinee, yet her presentation reads
 *     MEMBER at the hearth. CONTROL: without the take, the same joinee presents nothing and stays a STRANGER;
 *   · THE DIAL SURFACES the presenter's findings on both its paths (kept and board), even when nothing presents,
 *     and never lets one change the pick. CONTROL: one anchor per epoch surfaces nothing.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  NEXUS_DOC_DOMAIN, hex, genesisSealEpochCid, realmIdOfCharter, signCarriageQuorum, signCarriageContract,
  carriageEntryActCid, carriageDocUrl, writeCarriageEntry, emptyLarDoc, signLeafProof, foundingRoster,
  genesisCharterEpoch, rotateSealEpoch, sealKeySetHash, signRollAnchor, writeRollAnchor, isRollAnchor, rollAnchorCid,
  type NexusDoc, type CarriageEntry, type LarDoc,
} from "@lararium/mesh";
import { takeAdmitBundle, readKeptAdmitBundle, admitBundlePathFor, dialedNexusAid, AdmitBundleError, type AdmitBundle } from "../src/admit-bundle.js";
import { dialPresentation, makeNexusMembership, type CarriedNexusReading } from "../src/nexus-carriage.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { carriedCharterHome, carriageConsentPathFor } from "../src/carried-set.js";
import type { NexusLeaf } from "../src/nexus-leaf.js";

const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const seed = (n: number) => new Uint8Array(32).fill(n);

const P_KAHU = [seed(1), seed(2), seed(3)];
const Q_KAHU = [seed(4), seed(5), seed(6)];
const LEAF_P = seed(21);
const LEAF_Q = seed(22);
const FOREIGN_LEAF = seed(23);
const VESSEL = seed(30);
const GATE_P = "a1".repeat(32);
const GATE_Q = "b2".repeat(32);

async function charter(kahuSeeds: Uint8Array[]): Promise<NexusDoc> {
  const keys = await Promise.all(kahuSeeds.map(pubOf));
  return {
    kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2),
    kahu: keys.map((k, i) => ({ displayName: `Kahu ${i}`, verifyingKey: k })),
  };
}

async function act(doc: NexusDoc, kahuSeeds: Uint8Array[], leafSeed: Uint8Array, action: "admit" | "revoke", parents: string[] = []): Promise<CarriageEntry> {
  const nym = await pubOf(leafSeed);
  const epoch = doc.sealEpochCid!;
  const quorum = await Promise.all(kahuSeeds.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const consent = action === "admit" ? await signCarriageContract(nym, epoch, signerOf(leafSeed)) : undefined;
  return signCarriageQuorum({ nym, action, parents, sealEpochCid: epoch }, quorum, consent);
}

function boardOf(entries: CarriageEntry[]): LarDoc {
  const doc = emptyLarDoc();
  for (const e of entries) writeCarriageEntry(doc, e);
  return doc;
}

const bundleText = (b: AdmitBundle): string => JSON.stringify(b);

describe("the carried admit — take, keep, and present at the issuing hearth alone", () => {
  let root: string;
  let prior: string | undefined;
  let priorGate: string | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-admit-bundle-"));
    prior = process.env["LAR_ROOT"]; priorGate = process.env["LAR_JOIN_GATE"];
    process.env["LAR_ROOT"] = root; delete process.env["LAR_JOIN_GATE"];
  });
  afterEach(() => {
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    if (priorGate !== undefined) process.env["LAR_JOIN_GATE"] = priorGate;
    rmSync(root, { recursive: true, force: true });
  });

  /** A joinee vessel holding P's charter at the primary path and Q's carried, one leaf per Nexus. */
  async function stand() {
    const sealHome = join(root, "nexus");
    const P = await charter(P_KAHU);
    const Q = await charter(Q_KAHU);
    const aidP = realmIdOfCharter(P)!;
    const aidQ = realmIdOfCharter(Q)!;
    writeNexusDoc(sealHome, P);
    writeNexusDoc(carriedCharterHome(sealHome, aidQ), Q);
    const leafAt = new Map<string, Uint8Array>([[aidP, LEAF_P], [aidQ, LEAF_Q]]);
    const leaves = async (aid: string): Promise<readonly NexusLeaf[]> => {
      const s = leafAt.get(aid);
      return s ? [{ handleIndex: 0, verifyingKey: await pubOf(s), seed: s }] : [];
    };
    const admitP = await act(P, P_KAHU, LEAF_P, "admit");
    const bundleP: AdmitBundle = { aid: aidP, gatePubKey: GATE_P, admit: admitP, lineage: [] };
    return { sealHome, P, Q, aidP, aidQ, leaves, admitP, bundleP };
  }

  test("TAKE refuses a bundle for a leaf this vessel does not hold — nothing written", async () => {
    const w = await stand();
    const foreign = await act(w.P, P_KAHU, FOREIGN_LEAF, "admit");
    await expect(takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText({ ...w.bundleP, admit: foreign }), leaves: w.leaves }))
      .rejects.toThrow(AdmitBundleError);
    expect(existsSync(admitBundlePathFor(w.sealHome, w.aidP))).toBe(false);
    // CONTROL: the bundle for this vessel's own leaf lands.
    await expect(takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText(w.bundleP), leaves: w.leaves })).resolves.toMatchObject({ aid: w.aidP });
  });

  test("TAKE refuses a tampered or forged admit — nothing written", async () => {
    const w = await stand();
    const sig = w.admitP.signatures[0]!.sig;
    const flipped = sig.slice(0, -2) + (sig.endsWith("00") ? "01" : "00");
    expect(flipped).not.toBe(sig);                                                    // the bytes MOVED
    const tampered: CarriageEntry = { ...w.admitP, signatures: [{ ...w.admitP.signatures[0]!, sig: flipped }, ...w.admitP.signatures.slice(1)] };
    await expect(takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText({ ...w.bundleP, admit: tampered }), leaves: w.leaves }))
      .rejects.toThrow(AdmitBundleError);
    // Forged: the same leaf, admitted by hands the charter never seated (Q's kahu signing at P's epoch).
    const forged = await act(w.P, Q_KAHU, LEAF_P, "admit");
    await expect(takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText({ ...w.bundleP, admit: forged }), leaves: w.leaves }))
      .rejects.toThrow(AdmitBundleError);
    expect(existsSync(admitBundlePathFor(w.sealHome, w.aidP))).toBe(false);
  });

  test("TAKE refuses a Nexus this vessel holds no charter for, and a malformed bundle", async () => {
    const w = await stand();
    const unheld = await charter([seed(7), seed(8), seed(9)]);
    const admit = await act(unheld, [seed(7), seed(8), seed(9)], LEAF_P, "admit");
    await expect(takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText({ aid: realmIdOfCharter(unheld)!, gatePubKey: GATE_P, admit, lineage: [] }), leaves: w.leaves }))
      .rejects.toThrow(AdmitBundleError);
    await expect(takeAdmitBundle({ sealHome: w.sealHome, raw: "{not json", leaves: w.leaves })).rejects.toThrow(AdmitBundleError);
    await expect(takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText({ ...w.bundleP, gatePubKey: "zz" }), leaves: w.leaves })).rejects.toThrow(AdmitBundleError);
  });

  test("TAKE keeps the whole bundle per Nexus, beside the consent", async () => {
    const w = await stand();
    const r = await takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText(w.bundleP), leaves: w.leaves });
    expect(r.nym).toBe(await pubOf(LEAF_P));
    expect(r.admitCid).toBe(carriageEntryActCid(w.admitP));
    expect(r.path).toBe(admitBundlePathFor(w.sealHome, w.aidP));
    expect(join(r.path, "..", "..")).toBe(join(carriageConsentPathFor(w.sealHome, w.aidP), "..", ".."));
    expect(JSON.parse(readFileSync(r.path, "utf8"))).toEqual(JSON.parse(bundleText(w.bundleP)));
    expect(readKeptAdmitBundle(w.sealHome, w.aidP)?.gatePubKey).toBe(GATE_P);
  });

  test("★ F2: primary P holds an admit, the dialed hearth is Q's, Q holds none → nothing presents, no board is read ★", async () => {
    const w = await stand();
    await takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText(w.bundleP), leaves: w.leaves });
    const asked: string[] = [];
    const boards = new Map<string, LarDoc>([[carriageDocUrl(w.aidP), boardOf([w.admitP])], [carriageDocUrl(w.aidQ), boardOf([])]]);
    const open = async (url: string) => { asked.push(url); return boards.get(url); };
    expect(dialedNexusAid({ sealHome: w.sealHome, gatePubKey: GATE_Q })).toBeNull();
    const toQ = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: await pubOf(VESSEL), gatePubKey: GATE_Q, open, leaves: w.leaves });
    expect(toQ).toBeNull();
    expect(asked).toEqual([]);
    // CONTROL: dialing P's own hearth presents P's admit.
    expect(dialedNexusAid({ sealHome: w.sealHome, gatePubKey: GATE_P })).toBe(w.aidP);
    const toP = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: await pubOf(VESSEL), gatePubKey: GATE_P, open, leaves: w.leaves });
    expect(toP?.aid).toBe(w.aidP);
    expect(carriageEntryActCid(toP!.admit)).toBe(carriageEntryActCid(w.admitP));
  });

  test("CONTROL: no gate key named, or no kept bundle for the gate → no Nexus is tied, nothing presents", async () => {
    const w = await stand();
    const open = async () => boardOf([w.admitP]);
    expect(dialedNexusAid({ sealHome: w.sealHome, gatePubKey: null })).toBeNull();
    // The primary's board holds the admit, but no bundle ties GATE_P to P — the primary is never assumed.
    expect(await dialPresentation({ sealHome: w.sealHome, ownVesselKey: await pubOf(VESSEL), gatePubKey: GATE_P, open, leaves: w.leaves })).toBeNull();
  });

  test("KEPT vs BOARD — the board head presents only when it descends from the kept admit", async () => {
    const w = await stand();
    await takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText(w.bundleP), leaves: w.leaves });
    const vessel = await pubOf(VESSEL);
    // A re-admit descending from the kept admit (through a revoke) — the board's head moved forward: it presents.
    const revoke  = await act(w.P, P_KAHU, LEAF_P, "revoke", [carriageEntryActCid(w.admitP)]);
    const readmit = await act(w.P, P_KAHU, LEAF_P, "admit", [carriageEntryActCid(revoke)]);
    const forward = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: vessel, gatePubKey: GATE_P,
      open: async () => boardOf([w.admitP, revoke, readmit]), leaves: w.leaves });
    expect(carriageEntryActCid(forward!.admit)).toBe(carriageEntryActCid(readmit));
    expect(forward!.lineage.map(carriageEntryActCid).sort()).toEqual([carriageEntryActCid(w.admitP), carriageEntryActCid(revoke)].sort());
    // An admit on the board that does NOT descend from the kept one (it cites a revoke concurrent with the kept
    // admit, never the kept admit itself) never displaces it.
    const sideRevoke = await act(w.P, P_KAHU, LEAF_P, "revoke");
    const sideAdmit  = await act(w.P, P_KAHU, LEAF_P, "admit", [carriageEntryActCid(sideRevoke)]);
    expect(carriageEntryActCid(sideAdmit)).not.toBe(carriageEntryActCid(w.admitP));
    const kept = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: vessel, gatePubKey: GATE_P,
      open: async () => boardOf([sideRevoke, sideAdmit]), leaves: w.leaves });
    expect(carriageEntryActCid(kept!.admit)).toBe(carriageEntryActCid(w.admitP));
    // An empty replica (a PRIVATE hearth crosses no board) presents the kept admit.
    const bare = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: vessel, gatePubKey: GATE_P,
      open: async () => undefined, leaves: w.leaves });
    expect(carriageEntryActCid(bare!.admit)).toBe(carriageEntryActCid(w.admitP));
  });

  test("★ a PRIVATE gate holds the kept bundle; CONTROL: without the take, the joinee stays a STRANGER ★", async () => {
    const w = await stand();
    const vessel = await pubOf(VESSEL);
    const nonce = "cd".repeat(32);
    // THE HEARTH's side: P carried (its own charter), its deny board empty. No board ever crosses to the joinee.
    const hearthReading: CarriedNexusReading = {
      aid: w.aidP, via: "seat", island: w.aidP, roster: foundingRoster(w.P), sealLineage: [], denyBoard: [], antigen: [],
      antigenRoster: foundingRoster(w.P),
    };
    const hearth = makeNexusMembership({ readCarried: async () => [hearthReading] });
    await hearth.refold();
    const bindingOf = async () => {
      const p = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: vessel, gatePubKey: GATE_P, open: async () => undefined, leaves: w.leaves });
      if (!p) return null;
      const leafProof = await signLeafProof({ admit: p.admit, nonce, gatePubKey: GATE_P, vesselKey: vessel, sign: signerOf(p.leaf.seed) });
      return { presentedAdmit: { admit: p.admit, lineage: p.lineage, leafProof }, nonce, gatePubKey: GATE_P, vesselKey: vessel };
    };
    // CONTROL first: no take → no presentation → STRANGER.
    const before = await bindingOf();
    expect(before).toBeNull();
    await hearth.present("joinee", before);
    expect(hearth.membership.holdsCarriagePeer("joinee")).toBe(false);
    // The take, then the same dial → MEMBER under her leaf.
    await takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText(w.bundleP), leaves: w.leaves });
    await hearth.present("joinee", await bindingOf());
    expect(hearth.membership.holdsCarriagePeer("joinee")).toBe(true);
    expect(hearth.leafNymOf("joinee")).toBe(await pubOf(LEAF_P));
  });
});

describe("a bundle taken across a seal roll carries the anchor, and the dial presents it", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lares-admit-roll-")); prior = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root; });
  afterEach(() => { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; rmSync(root, { recursive: true, force: true }); });

  const OLD = [seed(41), seed(42), seed(43)];
  const NEW = [seed(51), seed(52), seed(53)];
  const LEAF = seed(54);
  const GATE = "c4".repeat(32);

  test("★ an anchored bundle takes and presents at the new head; CONTROL: the same bundle without its anchor refuses ★", async () => {
    const [oldKeys, newKeys] = await Promise.all([Promise.all(OLD.map(pubOf)), Promise.all(NEW.map(pubOf))]);
    const e0 = genesisCharterEpoch(oldKeys, 2, sealKeySetHash(newKeys, 2));
    const r = await rotateSealEpoch(e0, { keys: newKeys, threshold: 2 }, "",
      await Promise.all(NEW.map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) }))));
    if (!r.ok) throw new Error(r.reason);
    const kahu = newKeys.map((k, i) => ({ displayName: `Kahu ${i}`, verifyingKey: k }));
    const rolled: NexusDoc = { kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: r.epoch.epochCid, sealLineage: [e0, r.epoch], kahu };
    const sealHome = join(root, "nexus");
    writeNexusDoc(sealHome, rolled);
    const aid = realmIdOfCharter(rolled)!;
    expect(aid).toBe(e0.epochCid);
    const leaves = async (a: string): Promise<readonly NexusLeaf[]> =>
      a === aid ? [{ handleIndex: 0, verifyingKey: await pubOf(LEAF), seed: LEAF }] : [];

    const atE0: NexusDoc = { kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: e0.epochCid, kahu };
    const admit = await act(atE0, OLD, LEAF, "admit");
    const anchor = await signRollAnchor(
      { prevEpochCid: e0.epochCid, sealEpochCid: r.epoch.epochCid, prevKeys: oldKeys, prevThreshold: 2, parents: [carriageEntryActCid(admit)] },
      await Promise.all(NEW.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) }))),
    );

    // CONTROL: the bundle as taken BEFORE the roll — no anchor — does not hold at the new head.
    await expect(takeAdmitBundle({ sealHome, raw: bundleText({ aid, gatePubKey: GATE, admit, lineage: [] }), leaves }))
      .rejects.toThrow(AdmitBundleError);
    expect(existsSync(admitBundlePathFor(sealHome, aid))).toBe(false);
    const taken = await takeAdmitBundle({ sealHome, raw: bundleText({ aid, gatePubKey: GATE, admit, lineage: [anchor] }), leaves });
    expect(taken.admitCid).toBe(carriageEntryActCid(admit));

    // The dial off the board: the anchored admit presents, its anchor riding the lineage.
    const board = emptyLarDoc();
    writeCarriageEntry(board, admit);
    writeRollAnchor(board, anchor);
    const p = await dialPresentation({ sealHome, ownVesselKey: await pubOf(VESSEL), gatePubKey: GATE,
      open: async (url) => (url === carriageDocUrl(aid) ? board : undefined), leaves });
    expect(p).not.toBeNull();
    expect(carriageEntryActCid(p!.admit)).toBe(carriageEntryActCid(admit));
    expect(p!.lineage.filter(isRollAnchor).map(rollAnchorCid)).toEqual([rollAnchorCid(anchor)]);
  });
});

describe("the dial surfaces what the presenter noticed — two roll anchors opening one epoch", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lares-admit-fork-")); prior = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root; });
  afterEach(() => { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; rmSync(root, { recursive: true, force: true }); });

  const OLD = [seed(61), seed(62), seed(63)];
  const NEW = [seed(71), seed(72), seed(73)];
  const LEAF = seed(74);
  const GATE = "d5".repeat(32);

  /** A charter rolled once, an admit minted before the roll, the anchor that carries it, and an orphan retry. */
  async function rolledWithFork() {
    const [oldKeys, newKeys] = await Promise.all([Promise.all(OLD.map(pubOf)), Promise.all(NEW.map(pubOf))]);
    const e0 = genesisCharterEpoch(oldKeys, 2, sealKeySetHash(newKeys, 2));
    const newHands = await Promise.all(NEW.map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
    const r = await rotateSealEpoch(e0, { keys: newKeys, threshold: 2 }, "", newHands);
    if (!r.ok) throw new Error(r.reason);
    const kahu = newKeys.map((k, i) => ({ displayName: `Kahu ${i}`, verifyingKey: k }));
    const rolled: NexusDoc = { kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: r.epoch.epochCid, sealLineage: [e0, r.epoch], kahu };
    const sealHome = join(root, "nexus");
    writeNexusDoc(sealHome, rolled);
    const aid = realmIdOfCharter(rolled)!;
    const leaves = async (a: string): Promise<readonly NexusLeaf[]> =>
      a === aid ? [{ handleIndex: 0, verifyingKey: await pubOf(LEAF), seed: LEAF }] : [];
    const admit = await act({ kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: e0.epochCid, kahu }, OLD, LEAF, "admit");
    const anchorOf = async (parents: string[]) => signRollAnchor(
      { prevEpochCid: e0.epochCid, sealEpochCid: r.epoch.epochCid, prevKeys: oldKeys, prevThreshold: 2, parents },
      newHands.slice(0, 2),
    );
    const carrying = await anchorOf([carriageEntryActCid(admit)]);
    const orphan   = await anchorOf([]);   // an earlier attempt at the same roll — it holds nothing in its past
    const boardWith = (anchors: readonly typeof carrying[]): LarDoc => {
      const board = emptyLarDoc();
      writeCarriageEntry(board, admit);
      for (const a of anchors) writeRollAnchor(board, a);
      return board;
    };
    return { sealHome, aid, leaves, admit, carrying, orphan, anchorOf, epochCid: r.epoch.epochCid, boardWith };
  }

  const dial = async (w: Awaited<ReturnType<typeof rolledWithFork>>, board: LarDoc) => {
    const heard: unknown[] = [];
    const p = await dialPresentation({
      sealHome: w.sealHome, ownVesselKey: await pubOf(VESSEL), gatePubKey: GATE, leaves: w.leaves,
      open: async (url) => (url === carriageDocUrl(w.aid) ? board : undefined),
      onFinding: (f) => heard.push(f),
    });
    return { p, heard };
  };

  test("★ the KEPT path surfaces the fork once, and still presents through the carrying anchor ★", async () => {
    const w = await rolledWithFork();
    await takeAdmitBundle({ sealHome: w.sealHome, raw: bundleText({ aid: w.aid, gatePubKey: GATE, admit: w.admit, lineage: [w.carrying] }), leaves: w.leaves });
    const { p, heard } = await dial(w, w.boardWith([w.carrying, w.orphan]));
    expect(carriageEntryActCid(p!.admit)).toBe(carriageEntryActCid(w.admit));
    expect(p!.lineage.filter(isRollAnchor).map(rollAnchorCid)).toEqual([rollAnchorCid(w.carrying)]);
    expect(heard).toEqual([{ kind: "anchors-open-one-epoch", epochCid: w.epochCid, anchorCids: [rollAnchorCid(w.carrying), rollAnchorCid(w.orphan)].sort() }]);
    // CONTROL: one anchor per epoch surfaces nothing.
    expect((await dial(w, w.boardWith([w.carrying]))).heard).toEqual([]);
  });

  test("★ the BOARD path (no holding kept bundle) surfaces the fork, and still presents ★", async () => {
    const w = await rolledWithFork();
    // A kept bundle taken before the roll ties the gate to the Nexus and holds nothing at the rolled head on its
    // own, so the dial reads the board's head for each held leaf.
    const path = admitBundlePathFor(w.sealHome, w.aid);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bundleText({ aid: w.aid, gatePubKey: GATE, admit: w.admit, lineage: [] }));
    const { p, heard } = await dial(w, w.boardWith([w.orphan, w.carrying]));
    expect(carriageEntryActCid(p!.admit)).toBe(carriageEntryActCid(w.admit));
    expect(heard).toEqual([{ kind: "anchors-open-one-epoch", epochCid: w.epochCid, anchorCids: [rollAnchorCid(w.carrying), rollAnchorCid(w.orphan)].sort() }]);
    // CONTROL: one anchor per epoch surfaces nothing.
    const control = await dial(w, w.boardWith([w.carrying]));
    expect(control.p).not.toBeNull();
    expect(control.heard).toEqual([]);
  });

  test("a fork surfaces even when nothing presents — divergence is never dropped", async () => {
    const w = await rolledWithFork();
    const path = admitBundlePathFor(w.sealHome, w.aid);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bundleText({ aid: w.aid, gatePubKey: GATE, admit: w.admit, lineage: [] }));
    const orphanTwin = await w.anchorOf(["00".repeat(32)]);   // a second attempt that holds the admit no better
    const { p, heard } = await dial(w, w.boardWith([w.orphan, orphanTwin]));
    expect(p).toBeNull();
    expect(heard).toHaveLength(1);
  });
});
