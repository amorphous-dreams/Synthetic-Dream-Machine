/**
 * dial-presentation-joinee — an own-fleet JOINEE composes its dial, and the dial presents the WORN face's own leaf.
 *
 * The joinee keeps no roster line: its leaf is the scope the certificate in its join record names at the dialed Nexus,
 * read through `readJoinedFaceProof`. A founder presents for the face it wears and no other: a leaf of another face that
 * answers the admit refuses by name, and no root of another face signs anything.
 *
 *   J1  RED (witness): a joinee holding the hearth's charter, the face's kept admit and its join record composes its
 *       dial through the vessel's own defaults (no doors), dials the hearth through the production mount
 *       (`maybeStartNexusClientDial` → `LarWSClientAdapter` → `faceGateServer` over `vesselGate`), sorts same-operator,
 *       and syncs a document both ways. Before the fix the joinee read `leaf-absent`: it holds no roster, so no leaf.
 *   J2  RED: a founder wearing face h0 whose only leaf answering the admit is face h1's refuses `leaf-other-face`, and
 *       no founder door is reached and no record is kept. CONTROL: the worn face's own leaf presents.
 *   J3  RED: a joinee whose join record names no certificate at the dialed Nexus reads `leaf-absent`; one with no record
 *       reads `join-absent`.
 *   J4  RED: no single worn face names the group (two faces name it, or none does) while this vessel HOLDS a face root:
 *       it refuses `face-unworn` and presents nothing, never falling to the joinee branch. CONTROL: the same vessel
 *       holding no root reads as the joinee and presents.
 */
import { createServer, type Server } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createPrivateKey, createPublicKey } from "node:crypto";
import * as ed from "@noble/ed25519";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Repo, type AutomergeUrl, type DocHandle, type PeerId } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import {
  DAEMON_BAG_ID, admitCarriageCommit, custodyRootDoor, deriveGateBundle, hearthPinIndex, heldNexusRoot, hex,
  makeMultiSigQuorumVerifier, memoryBackedWithdrawals, nexusAidOf, signCarriageContract, signCarriageQuorum,
  sovereignGateRoot, sovereignRoute,
  type AdmitOpening, type CarriageEntry, type FaceScope, type GateBundle, type GateSession, type NexusDoc,
} from "@lararium/mesh";
import { SessionTable, sessionBinding } from "../../lararium-mesh/src/session-contract.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { admitBundlePathFor } from "../src/admit-bundle.js";
import { composeDialPresentation } from "../src/dial-presentation.js";
import { storeFaceProofKey } from "../src/face-key-custody.js";
import { faceDeviceBook } from "../src/face-device-book.js";
import { faceGateServer, gateSessionRegistry } from "../src/face-gate-server.js";
import { keepFaceJoinRecord, noteIssuedFaceKeys, readFaceJoinRecord } from "../src/fleet-join-custody.js";
import { ensureFounderCertificate } from "../src/founder-self-certificate.js";
import { gateGrantRing } from "../src/gate-rings.js";
import { gateShadowRing } from "../src/gate-shadow-ring.js";
import { gateSyncServer } from "../src/gate-sync-server.js";
import { persistIdentityAnchors } from "../src/identity-anchors.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";
import { maybeStartNexusClientDial, type NexusClientDial } from "../src/nexus-client-dial.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { vesselGate } from "../src/vessel-gates.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const keyOf = (secret: Uint8Array) => createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret)]), format: "der", type: "pkcs8" });
const publicOf = (secret: Uint8Array): string =>
  Buffer.from((createPublicKey(keyOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + fill) & 0xff);
const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);

const KAHU = [1, 2, 3].map((n) => new Uint8Array(32).fill(n));
const ROOT = secretOf(11);
const FACE = secretOf(3);
const OTHER_FACE = secretOf(5);
const GROUP = "0x" + "b7f1c2a9d4e60381";
const JOINEE_DEVICE = "10".repeat(32);
const FOUNDER_DEVICE = "f0".repeat(32);
const SALT = "5a".repeat(32);
const rootDoors = { loadRoot: async () => ({ seed: Uint8Array.from(ROOT), verifyingKey: publicOf(ROOT) }), vesselKey: async () => JOINEE_DEVICE };
const realDeadlines = () => ({ draw(lapse: () => void) { const t = setTimeout(lapse, 5_000); return { cancel: () => clearTimeout(t) }; } });

const refusals: string[] = [];
const opened: Array<{ close(): Promise<void> | void }> = [];
let custody: SeatedScratchCustody | null = null;
afterEach(async () => {
  for (const o of opened.splice(0).reverse()) await o.close();
  await custody?.drop();
  custody = null;
  refusals.length = 0;
});

interface Joinee {
  readonly sealHome: string;
  readonly aid:      string;
  readonly charter:  NexusDoc;
  readonly bundle:   GateBundle;
  readonly scope:    FaceScope;
  readonly admit:    CarriageEntry;
}

/**
 * A vessel holding the hearth's charter at its primary path and the face's admit, taken as a bundle, for the hearth's
 * sovereign sync pin. `joined` lands the join record a root holder issues (certificate and grant over this vessel's
 * own face-scoped key at the scope), as the fleet-join answer leaves it.
 */
async function standJoinee(opts: { joined?: boolean } = {}): Promise<Joinee> {
  custody = await seatScratchCustody("dial-joinee");
  const sealHome = join(custody.root, "seal");
  const keys = await Promise.all(KAHU.map(pubOf));
  const charter = heldCharter({ keys, threshold: 2 }).doc({ labels: keys.map((_, i) => `Kahu ${i}`) });
  const aid = nexusAidOf(charter)!;
  writeNexusDoc(sealHome, charter);
  const bundle = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(7) })), new TextEncoder().encode(aid), sovereignRoute("/ws"));
  opened.push({ close: () => bundle.drop() });
  const scope = { faceKey: publicOf(FACE), nexus: aid } as FaceScope;
  const opening: AdmitOpening = { carriage: { gatePin: bundle.pin, canon: {} }, salt: SALT };
  const quorum = await Promise.all(KAHU.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const consent = await signCarriageContract(scope.faceKey, charter.sealEpochCid!, signerOf(FACE));
  const admit = await signCarriageQuorum({ nym: scope.faceKey, action: "admit", parents: [], sealEpochCid: charter.sealEpochCid!, carriageCommit: admitCarriageCommit(opening) }, quorum, consent);
  const path = admitBundlePathFor(sealHome, aid);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ aid, gatePubKey: bundle.pin.signingKey, admit, lineage: [], opening }));
  // The vessel wears the face: its anchors name GROUP. It holds no root and no roster line.
  await persistIdentityAnchors({ personaGroupId: GROUP, meshCabalDocIdHex: "cd".repeat(16) }, 0);
  if (opts.joined !== false) {
    // The root holder's issue, as the fleet-join answer lands it: the same doors, then the vessel keeps the record.
    await storeFaceProofKey(scope, FACE, 0);
    await ensureFounderCertificate({ face: 0, personaGroup: GROUP, scope }, { ...rootDoors, groupOf: async () => GROUP });
  }
  return { sealHome, aid, charter, bundle, scope, admit };
}

const compose = (j: Joinee, over: Partial<Parameters<typeof composeDialPresentation>[0]> = {}) =>
  composeDialPresentation({
    sealHome: j.sealHome, pin: j.bundle.pin, personaGroup: GROUP,
    table: new SessionTable(`dial-${globalThis.crypto.randomUUID()}`), binding: sessionBinding("socket"), profile: "face", ...over,
  });

/** The hearth: one sovereign sync gate on a live socket, as the vessel composes it, and a doc it holds for the face. */
async function standHearth(j: Joinee) {
  const record = (await readFaceJoinRecord(GROUP))!;
  await noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: record.rootKey, device: JOINEE_DEVICE, certificates: record.certificates as never });
  // ONE PROCESS HOLDS BOTH ENDS, so the joinee's record and the hearth's share one custody row. The hearth's own record
  // holds ITS certificates, never the joinee's: the joinee's key reaches the hearth's book through the issued note alone.
  const book = faceDeviceBook({ records: async () => [{ ...(await readFaceJoinRecord(GROUP))!, certificates: [] }], ownVesselKey: async () => FOUNDER_DEVICE });
  await book.refresh();
  const sessions = new Map<string, GateSession>();
  const repo = new Repo({ sharePolicy: async (peerId: PeerId) => sessions.get(peerId)?.class === "same-operator" } as never);
  const doc = repo.create<{ fleet: string; back?: string }>({ fleet: "the face's own document" });
  const gateSync = gateSyncServer();
  const registry = gateSessionRegistry((channel, session) => gateSync.onOpen(channel, session));
  const server = faceGateServer();
  const adapter = new NodeWSServerAdapter(gateSync.wss as never, 60_000);
  adapter.on("peer-candidate", ({ peerId }) => {
    queueMicrotask(() => {
      const session = gateSync.sessionOf((adapter.sockets as Record<string, unknown>)[peerId]);
      if (session) sessions.set(peerId, session);
    });
  });
  repo.networkSubsystem.addNetworkAdapter(adapter);
  const held = heldNexusRoot({ nexus: j.aid, charter: j.charter, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in held) throw new Error(held.absent);
  const reading = { ...held, aid: j.aid, via: "charter", island: `island-${j.aid}`, posture: "private" } as unknown as CarriedNexusReading;
  const gate = vesselGate({
    readings: async () => [reading],
    posture: () => "private",
    shadows: gateShadowRing({ ring: { fold: () => ({ fleets: [], realms: [] }), deviceAside: () => false }, deviceOf: (x) => book.deviceOf(x) }),
    grants: gateGrantRing({ joinRecords: async () => [], rootHoldings: () => [{ personaGroup: GROUP, rootKey: record.rootKey, scopes: [j.scope] }] }),
    withdrawals: memoryBackedWithdrawals(), deadlines: realDeadlines(), audience: DAEMON_BAG_ID,
    onRefuse: (_at, reason, detail) => refusals.push(`${reason}${detail ? ` ${JSON.stringify(detail)}` : ""}`),
    onShut: (arm) => refusals.push(`shut ${String(arm)}`),
  }, { bundle: j.bundle, nexus: j.aid, sessions: registry.table });
  server.stand({ gate, pin: j.bundle.pin });
  const http: Server = createServer();
  http.on("upgrade", (req, socket, head) => { if (!server.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const port = (http.address() as { port: number }).port;
  const hearth = {
    syncUrl: `ws://127.0.0.1:${port}/ws`, repo, doc, sessions,
    async close() {
      server.close(); registry.close(); gateSync.close();
      await repo.shutdown().catch(() => undefined);
      await new Promise<void>((r) => http.close(() => r()));
    },
  };
  opened.push(hearth);
  return hearth;
}

function findWhenReady<T>(repo: Repo, url: AutomergeUrl, ms: number): Promise<DocHandle<T>> {
  return new Promise<DocHandle<T>>((resolve, reject) => {
    const progress = repo.findWithProgress<T>(url);
    let unsub: () => void = () => undefined;
    const timer = setTimeout(() => { unsub(); reject(new Error(`timeout: ${url} never became ready`)); }, ms);
    const settle = (state: ReturnType<typeof progress.peek>): void => {
      if (state.state === "ready") { clearTimeout(timer); unsub(); resolve(state.handle); }
    };
    unsub = progress.subscribe(settle);
    settle(progress.peek());
  });
}

async function until(check: () => boolean, ms: number, what: string): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error(`timeout: ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe("an own-fleet joinee composes its dial", () => {
  test("J1 RED (witness): the joinee dials its hearth through compose, the production mount and the gate, and syncs", async () => {
    const j = await standJoinee();
    // The vessel's own defaults: anchors name the worn face, the roster names no root, so the joinee branch reads.
    const composed = await compose(j);
    if (!("presentation" in composed)) throw new Error(`no presentation: ${composed.refusal} ${composed.detail ?? ""}`);
    expect(composed.presentation.certificate.scope).toEqual(j.scope);

    const hearth = await standHearth(j);
    const pins = hearthPinIndex();
    expect(pins.put("hearth-one", j.bundle.pin)).toBe(true);
    const repo = new Repo({ peerId: "joinee-leaf" as PeerId, sharePolicy: async () => true } as never);
    opened.push({ close: () => repo.shutdown().catch(() => undefined) });
    const logs: string[] = [];
    const dial: NexusClientDial | null = maybeStartNexusClientDial({
      repo, syncUrl: hearth.syncUrl, pins, hearth: "hearth-one", nexus: j.bundle.pin.nexus,
      presentation: composed.presentation, deadlines: realDeadlines(), onLog: (l) => logs.push(l),
    });
    expect(dial, logs.join("\n")).not.toBeNull();
    opened.push({ close: () => dial!.stop() });

    await until(() => [...hearth.sessions.values()].length > 0, 10_000, `the gate never seated the joinee (${refusals.join(" | ")}; ${logs.join(" | ")}; anergized ${dial!.adapter.anergized}; ready ${dial!.adapter.isReady()}; peers ${repo.peers.join(",")}; hearth peers ${hearth.repo.peers.join(",")}; state ${(dial!.adapter.socket as unknown as { readyState?: number } | undefined)?.readyState})`);
    expect([...hearth.sessions.values()][0]!.class).toBe("same-operator");
    // The hearth's document reaches the joinee, and the joinee's change reaches the hearth.
    const there = await findWhenReady<{ fleet: string; back?: string }>(repo, hearth.doc.url, 10_000);
    expect(there.doc()?.fleet).toBe("the face's own document");
    there.change((d) => { d.back = "from the joinee"; });
    await until(() => hearth.doc.doc()?.back === "from the joinee", 10_000, "the joinee's change never reached the hearth");
  });

  test("J2 RED: a founder wearing h0 never presents h1's leaf, and no root of h1 signs; CONTROL: h0's own leaf presents", async () => {
    const j = await standJoinee({ joined: false });
    let rootReached = 0;
    const founder = { loadRoot: async () => { rootReached += 1; return rootDoors.loadRoot(); }, vesselKey: rootDoors.vesselKey };
    const leafOf = async (handleIndex: number, seed: Uint8Array) => ({ handleIndex, verifyingKey: publicOf(seed), seed: Uint8Array.from(seed) });
    // h1's leaf answers the admit's nym; the vessel wears h0.
    const other = await compose(j, { doors: { faceOfGroup: async () => 0, rootHeld: async () => true, leaves: async () => [await leafOf(1, FACE)], founder } });
    expect(other).toEqual({ refusal: "leaf-other-face" });
    expect(rootReached).toBe(0);
    expect(await readFaceJoinRecord(GROUP)).toBeNull();
    // A leaf of h0 that does not answer the admit is no leaf either.
    expect(await compose(j, { doors: { faceOfGroup: async () => 0, rootHeld: async () => true, leaves: async () => [await leafOf(0, OTHER_FACE)], founder } }))
      .toEqual({ refusal: "leaf-absent" });
    // CONTROL: h0's own leaf presents, under h0's root.
    await storeFaceProofKey(j.scope, FACE, 0);
    const own = await compose(j, { doors: { faceOfGroup: async () => 0, rootHeld: async () => true, leaves: async () => [await leafOf(1, FACE), await leafOf(0, FACE)], founder: { ...founder, groupOf: async () => GROUP } } });
    if (!("presentation" in own)) throw new Error(`no presentation: ${own.refusal} ${own.detail ?? ""}`);
    expect(own.presentation.certificate.scope).toEqual(j.scope);
    expect(rootReached).toBe(1);
  });

  test("J3 RED: a join record with no certificate at the dialed Nexus reads leaf-absent; no record reads join-absent", async () => {
    const j = await standJoinee({ joined: false });
    expect(await compose(j)).toEqual({ refusal: "join-absent" });
    await keepFaceJoinRecord({ personaGroup: GROUP, rootKey: publicOf(ROOT), certificates: [{ scope: { faceKey: publicOf(FACE), nexus: "nexus-elsewhere.synthetic" }, vesselFaceKey: JOINEE_DEVICE }], grants: [] });
    expect(await compose(j)).toEqual({ refusal: "leaf-absent" });
  });

  test("J4 RED: an ambiguous group with a held root refuses face-unworn; CONTROL: no root held reads as the joinee", async () => {
    const j = await standJoinee();
    const ambiguous = await compose(j, { doors: { faceOfGroup: async () => null, anyRootHeld: async () => true } });
    expect(ambiguous).toMatchObject({ refusal: "face-unworn" });
    expect("presentation" in ambiguous).toBe(false);
    const joinee = await compose(j, { doors: { faceOfGroup: async () => null, anyRootHeld: async () => false } });
    if (!("presentation" in joinee)) throw new Error(`no presentation: ${joinee.refusal} ${joinee.detail ?? ""}`);
    expect(joinee.presentation.certificate.scope).toEqual(j.scope);
  });
});
