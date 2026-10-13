/**
 * held-root-doors.test.ts — THE HELD ROOT AT THE NODE'S DOORS.
 *
 * The carriage verifier checks an admit's epoch, its signatures and a root this vessel holds locally, and
 * refuses by name without that root. Each door hands the verifier a held root built from the charter the
 * vessel keeps (`heldNexusRoot`), and each names the one refusal `no-held-root` where it holds none.
 *
 *   N1 THE SEAT: a socket that presents a quorum-signed admit with a good leaf proof, for a Nexus whose charter
 *      this vessel does not hold, reads `no-held-root`; the holder's `onRefuse` hears it once and the peer
 *      stays a stranger / with the root held, the same socket stands and `onRefuse` stays silent.
 *   N2 the seat names its other refusals: a bad leaf proof reads `leaf-proof-failed`, a revoked admit reads
 *      `admit-denied:…` / the same admit unrevoked stands.
 *   N3 THE TAKE: a bundle for a Nexus this vessel keeps no charter for refuses `no-held-root (no-charter)` and
 *      writes nothing / with the charter kept, the same bundle lands.
 *   N4 the offline check reads a bundle against its OWN charter alone: no charter and another Nexus's charter
 *      each read false / its own charter reads true.
 *   N5 a carried reading reads as a held root: its `nexus` equals its `aid`, its roster stands at the charter's
 *      head, and its revision moves when a revoke lands on the deny board / it holds still when nothing moved.
 *   N6 THE WELD: across every package's sources, the held-root module alone NAMES `verifyPresentedAdmit`
 *      beside the file that declares it (a call, an import under another name and a re-export each name it) /
 *      the declaring file and the held-root module both get found, so the scan reads sources.
 *   N7 THE SORTER, the seat's first reader: a refused admit names itself to the vessel's own `onRefuse` and
 *      the socket draws the same verdict as a socket that presented nothing / a held admit names nothing.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ed from "@noble/ed25519";
import {
  hex, realmIdOfCharter, signCarriageQuorum, signCarriageContract, signCarrierContract, makeMultiSigQuorumVerifier,
  carriageEntryActCid, carriageDocUrl, writeCarriageEntry, emptyLarDoc, heldNexusRoot,
  type NexusDoc, type CarriageEntry, type LarDoc,
} from "@lararium/mesh";
import { takeAdmitBundle, admitBundleHolds, admitBundlePathFor, AdmitBundleError, type AdmitBundle } from "../src/admit-bundle.js";
import {
  leafReadingFor, leafStandingFor, makeNexusMembership, type CarriedNexusReading, type SocketBinding,
} from "../src/nexus-carriage.js";
import { placeCarriedNexuses } from "../src/vessel-raise.js";
import { makeSocketSorter } from "../src/socket-sorter.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import type { NexusLeaf } from "../src/nexus-leaf.js";
import { socketProof, socketUnderTest } from "./gate-dial-fixture.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";

const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const signerOf = (s: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, s).then(hex);
const seed = (n: number) => new Uint8Array(32).fill(n);
const P_KAHU = [seed(1), seed(2), seed(3)];
const Q_KAHU = [seed(4), seed(5), seed(6)];
const LEAF = seed(21), OTHER_KEY = seed(22), VESSEL = seed(30), PLACE = seed(31);
const GATE = "ee".repeat(32), NONCE = "ab".repeat(32);

async function charter(kahu: Uint8Array[]): Promise<NexusDoc> {
  const keys = await Promise.all(kahu.map(pubOf));
  return heldCharter({ keys, threshold: 2 }).doc({ labels: keys.map((_, i) => `Kahu ${i}`) });
}
async function act(doc: NexusDoc, kahu: Uint8Array[], action: "admit" | "revoke", parents: string[] = []): Promise<CarriageEntry> {
  const nym = await pubOf(LEAF), epoch = doc.sealEpochCid!;
  const quorum = await Promise.all(kahu.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const consent = action === "admit" ? await signCarriageContract(nym, epoch, signerOf(LEAF)) : undefined;
  return signCarriageQuorum({ nym, action, parents, sealEpochCid: epoch }, quorum, consent);
}
/** A carried reading over a REAL held root: the charter filed under its own genesis, with a deny board. */
function readingOf(doc: NexusDoc, denyBoard: CarriageEntry[] = []): CarriedNexusReading {
  const aid = realmIdOfCharter(doc)!;
  const root = heldNexusRoot({ nexus: aid, charter: doc, denyBoard, antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in root) throw new Error(`fixture: ${root.absent}`);
  return { ...root, sealLineage: root.sealLineage ?? [], aid, via: "consent", island: `island-${aid}`, posture: "private" };
}
async function bind(admit: CarriageEntry, opts: { signer?: Uint8Array } = {}): Promise<SocketBinding> {
  const vesselKey = await pubOf(VESSEL);
  const leafProof = await socketProof(socketUnderTest(vesselKey, { nonce: NONCE, gatePubKey: GATE }), { kind: "admit", admit, lineage: [] }, signerOf(opts.signer ?? LEAF));
  return { presentedAdmit: { admit, lineage: [], leafProof }, nonce: NONCE, gatePubKey: GATE, vesselKey };
}

describe("the held root at the socket seat", () => {
  test("N1 an admit for a Nexus this vessel holds no root for refuses no-held-root; control: with the root it stands", async () => {
    const P = await charter(P_KAHU), Q = await charter(Q_KAHU);
    const admitQ = await act(Q, Q_KAHU, "admit");             // well-formed, quorum-signed, for a Nexus this vessel lacks
    const binding = await bind(admitQ);
    expect(await leafReadingFor(binding, [readingOf(P)])).toEqual({ refusal: "no-held-root" });
    expect(await leafReadingFor(binding, [])).toEqual({ refusal: "no-held-root" });
    expect(await leafStandingFor(binding, [readingOf(P)])).toBeNull();
    const heard: Array<[string, string]> = [];
    const lacking = makeNexusMembership({ readCarried: async () => [readingOf(P)], onRefuse: (peer, refusal) => { heard.push([peer, refusal]); } });
    await lacking.refold();
    await lacking.present("peer-q", binding);
    expect(heard).toEqual([["peer-q", "no-held-root"]]);
    expect(lacking.membership.holdsCarriagePeer("peer-q")).toBe(false);
    await lacking.refold();                                    // a refold re-verifies quietly
    expect(heard).toHaveLength(1);
    // A callback that throws never decides the fold: a peer that stood, then presents a refused admit, falls.
    const admitP = await act(P, P_KAHU, "admit");
    const throwing = makeNexusMembership({ readCarried: async () => [readingOf(P)], onRefuse: () => { throw new Error("a log that fails"); } });
    await throwing.refold();
    await throwing.present("peer-p", await bind(admitP));
    expect(throwing.membership.holdsCarriagePeer("peer-p")).toBe(true);
    await throwing.present("peer-p", binding);
    expect(throwing.membership.holdsCarriagePeer("peer-p")).toBe(false);
    // CONTROL: the vessel holds Q's root too, and the same socket stands with nothing refused.
    const quiet: string[] = [];
    const holding = makeNexusMembership({ readCarried: async () => [readingOf(P), readingOf(Q)], onRefuse: (_p, refusal) => { quiet.push(refusal); } });
    await holding.refold();
    await holding.present("peer-q", binding);
    expect(holding.membership.holdsCarriagePeer("peer-q")).toBe(true);
    expect(quiet).toEqual([]);
    expect(await leafReadingFor(binding, [readingOf(P), readingOf(Q)])).toEqual({ standing: { nym: await pubOf(LEAF), aid: realmIdOfCharter(Q) } });
  });

  test("N2 the seat names its other refusals; control: the same admit unrevoked stands", async () => {
    const P = await charter(P_KAHU);
    const admit = await act(P, P_KAHU, "admit");
    expect(await leafReadingFor(await bind(admit, { signer: OTHER_KEY }), [readingOf(P)])).toEqual({ refusal: "leaf-proof-failed" });
    const revoke = await act(P, P_KAHU, "revoke", [carriageEntryActCid(admit)]);
    const denied = await leafReadingFor(await bind(admit), [readingOf(P, [revoke])]);
    expect(denied).toMatchObject({ refusal: expect.stringMatching(/^admit-denied:/) });
    expect(await leafReadingFor(await bind(admit), [readingOf(P)])).toMatchObject({ standing: { nym: await pubOf(LEAF) } });
    // A presented admit of no readable shape reads by name too, and never throws.
    const torn = { presentedAdmit: { admit: null, lineage: [], leafProof: "00" }, nonce: NONCE, gatePubKey: GATE, vesselKey: await pubOf(VESSEL) } as unknown as SocketBinding;
    expect(await leafReadingFor(torn, [readingOf(P)])).toMatchObject({ refusal: expect.any(String) });
  });
});

describe("the held root at the take, on a real seal home", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lares-held-root-")); prior = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root; });
  afterEach(() => { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; rmSync(root, { recursive: true, force: true }); });

  const leaves = async (): Promise<readonly NexusLeaf[]> => [{ handleIndex: 0, verifyingKey: await pubOf(LEAF), seed: LEAF }];

  test("N3 a bundle for a Nexus this vessel keeps no charter for refuses no-held-root and writes nothing; control: with the charter it lands", async () => {
    const sealHome = join(root, "nexus");
    const P = await charter(P_KAHU), Q = await charter(Q_KAHU);
    writeNexusDoc(sealHome, P);
    const aidQ = realmIdOfCharter(Q)!;
    const bundle: AdmitBundle = { aid: aidQ, gatePubKey: GATE, admit: await act(Q, Q_KAHU, "admit"), lineage: [] };
    const take = () => takeAdmitBundle({ sealHome, raw: JSON.stringify(bundle), leaves });
    await expect(take()).rejects.toThrow(AdmitBundleError);
    await expect(take()).rejects.toThrow(/^no-held-root \(no-charter\)/);
    expect(existsSync(admitBundlePathFor(sealHome, aidQ))).toBe(false);
    // CONTROL: the vessel keeps Q's charter at its primary path, and the same bundle lands.
    const home2 = join(root, "nexus-q");
    writeNexusDoc(home2, Q);
    const kept = await takeAdmitBundle({ sealHome: home2, raw: JSON.stringify(bundle), leaves });
    expect(kept.aid).toBe(aidQ);
    expect(existsSync(admitBundlePathFor(home2, aidQ))).toBe(true);
  });

  test("N4 the offline check reads a bundle against its own charter alone", async () => {
    const P = await charter(P_KAHU), Q = await charter(Q_KAHU);
    const bundle: AdmitBundle = { aid: realmIdOfCharter(Q)!, gatePubKey: GATE, admit: await act(Q, Q_KAHU, "admit"), lineage: [] };
    expect(await admitBundleHolds(bundle, null)).toBe(false);
    expect(await admitBundleHolds(bundle, undefined)).toBe(false);
    expect(await admitBundleHolds(bundle, P)).toBe(false);                      // another Nexus's charter
    expect(await admitBundleHolds({ ...bundle, aid: realmIdOfCharter(P)! }, P)).toBe(false);   // P's name, Q's quorum
    expect(await admitBundleHolds(bundle, Q)).toBe(true);                       // CONTROL
    // A bundle filed under ANOTHER name than the charter's own never holds, though P's quorum signed its admit.
    const ownP: AdmitBundle = { aid: realmIdOfCharter(P)!, gatePubKey: GATE, admit: await act(P, P_KAHU, "admit"), lineage: [] };
    expect(await admitBundleHolds(ownP, P)).toBe(true);                         // CONTROL
    expect(await admitBundleHolds({ ...ownP, aid: "a-borrowed-name" }, P)).toBe(false);
  });

  test("N5 a carried reading reads as a held root, and its revision moves with the deny board", async () => {
    const sealHome = join(root, "nexus");
    const P = await charter(P_KAHU);
    writeNexusDoc(sealHome, P);
    const place = await pubOf(PLACE);
    const epoch = P.sealEpochCid!;
    const quorum = await Promise.all(P_KAHU.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
    const carry = await signCarriageQuorum({ nym: place, action: "carry", parents: [], sealEpochCid: epoch }, quorum, await signCarrierContract(place, epoch, signerOf(PLACE)));
    const board: LarDoc = emptyLarDoc();
    writeCarriageEntry(board, carry);
    const island = nodeNexusIsland({ ownVesselKey: place, sealHome });
    const open = async (url: string) => (url === carriageDocUrl(island) ? board : undefined);
    const [first] = await placeCarriedNexuses({ sealHome, ownVesselKey: place, open });
    expect(first).toBeDefined();
    expect(first!.nexus).toBe(first!.aid);
    expect(first!.nexus).toBe(realmIdOfCharter(P));
    expect(first!.roster.sealEpochCid).toBe(epoch);
    const [again] = await placeCarriedNexuses({ sealHome, ownVesselKey: place, open });
    expect(again!.revision).toBe(first!.revision);                              // CONTROL: nothing moved
    const admit = await act(P, P_KAHU, "admit");
    writeCarriageEntry(board, await act(P, P_KAHU, "revoke", [carriageEntryActCid(admit)]));
    const [moved] = await placeCarriedNexuses({ sealHome, ownVesselKey: place, open });
    expect(moved!.revision).not.toBe(first!.revision);
  });
});

// ── N6 THE WELD ─────────────────────────────────────────────────────────────────────────────────────────────
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(path);
  }
  return out;
}
function withoutComments(text: string): string {
  return text.split("\n").filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
  }).join("\n");
}

describe("the sorter reads first", () => {
  test("N7 a refused admit names itself locally and the socket draws what a bare socket draws; control: a held admit names nothing", async () => {
    const P = await charter(P_KAHU), Q = await charter(Q_KAHU);
    const heard: Array<[string, string]> = [];
    const sorter = (readings: CarriedNexusReading[]) => makeSocketSorter({
      readings: async () => readings, carrier: () => false, primaryPosture: () => "private",
      onRefuse: (vesselKey, refusal) => { heard.push([vesselKey, refusal]); },
    });
    const vesselKey = await pubOf(VESSEL);
    const socket = async (admit: CarriageEntry | null) => {
      const challenge = { nonce: NONCE, gatePubKey: GATE };
      const presented = admit === null ? undefined
        : { kind: "admit" as const, admit, lineage: [], leafProof: await socketProof(socketUnderTest(vesselKey, challenge), { kind: "admit", admit, lineage: [] }, signerOf(LEAF)) };
      return { sameOperator: false, vesselKey, challenge, ...(presented ? { presented } : {}) } as Parameters<ReturnType<typeof makeSocketSorter>>[0];
    };
    const admitQ = await act(Q, Q_KAHU, "admit");
    const refused = await sorter([readingOf(P)])(await socket(admitQ));
    const bare = await sorter([readingOf(P)])(await socket(null));
    expect(refused).toEqual(bare);                                   // the wire draws no cause
    expect(heard).toEqual([[vesselKey, "no-held-root"]]);
    // A callback that throws never decides the sort: under an OPEN posture the refused admit still draws what
    // a bare socket draws.
    const open = (onRefuse?: () => void) => makeSocketSorter({ readings: async () => [readingOf(P)], carrier: () => false, primaryPosture: () => "open", ...(onRefuse ? { onRefuse } : {}) });
    const bareOpen = await open()(await socket(null));
    expect(bareOpen).not.toBeNull();
    expect(await open(() => { throw new Error("a log that fails"); })(await socket(admitQ))).toEqual(bareOpen);
    // CONTROL: the vessel holds Q's root; the same socket sorts contracted and names nothing.
    heard.length = 0;
    expect(await sorter([readingOf(P), readingOf(Q)])(await socket(admitQ))).toMatchObject({ class: "contracted", standing: { aid: realmIdOfCharter(Q) } });
    expect(heard).toEqual([]);
  });
});

describe("the weld", () => {
  test("N6 the held-root module alone names the verifier, beside the file that declares it", () => {
    const callers = readdirSync(resolve(repoRoot, "packages"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const src = resolve(repoRoot, "packages", entry.name, "src");
        try { return sourceFiles(src); } catch { return []; }
      })
      .filter((path) => /\bverifyPresentedAdmit\b/.test(withoutComments(readFileSync(path, "utf8"))))
      .map((path) => path.slice(repoRoot.length + 1).replaceAll("\\", "/"))
      .sort();
    // CONTROL inside the reading: the declaring file and the one caller both get found, so the scan reads sources.
    expect(callers, `verifyPresentedAdmit call sites: ${callers.join(", ") || "none"}`).toEqual([
      "packages/lararium-mesh/src/carriage-registry.ts",
      "packages/lararium-mesh/src/held-nexus-root.ts",
    ]);
  });
});
