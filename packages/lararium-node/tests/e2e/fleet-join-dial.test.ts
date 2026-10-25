/**
 * fleet-join-dial — an own-fleet joinee dials its hearth on what the fleet-join answer carried, and nothing seeded by hand.
 *
 * Vessel A founds the hearth and wears the face; vessel B founds a bare place. Offer → request → answer → land, each on
 * its own vessel root, then B's boot dial (`chooseHearthDial` over the bootstrap pin and the kept bundles, the pins filed,
 * `composeDialPresentation`, `maybeStartNexusClientDial`) crosses A's sovereign sync gate, sorts same-operator and syncs
 * a document both ways. The charter, the face's admit at A's Nexus and A's floor pins rode the answer under the root's
 * signature; A minted the admit once, through the contract door, at its answer.
 *
 *   F1  RED (witness): the whole road, end to end, with no hand-seeded charter or bundle
 *   F2  RED: an answer whose admit was moved refuses at land (`answer-unsigned`), and one the root re-signed over an admit
 *       its quorum never signed refuses at land by name (`admit-…`); neither writes a charter, a bundle, a secret or a
 *       record. CONTROL: the true answer lands.
 *   F3  a second answer reuses the face's admit A minted at the first: one admit on the board, one kept bundle
 *   F4  the joinee keeps A's floor pins at A's Nexus, at floor tier on the flow route, as the answer carried them
 *   F5  RED: the sovereign pin ROTATES (another gate door): the face's household admit is minted again, committed to the
 *       new pin, and the kept file replaced; never the old one reused. CONTROL: the same door again reuses the new one.
 *   F1 also witnesses house ruling "The admit's gate pin": (b) B's boot files the kept floor pins under the hearth it dials, before
 *       any crossing; (a) a dial index holding the sovereign pin alone learns A's flow pin over the verified sovereign
 *       session, and both carriers name the same pin
 */
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { Repo, type AutomergeUrl, type DocHandle, type PeerId } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import * as ed25519 from "@noble/ed25519";
import {
  DAEMON_BAG_ID, PERSONA_GROUP_ID_TIDDLER, SOVEREIGN_SYNC_ROUTE, FLOW_SOCKET_ROUTE, deriveGateBundle, fleetJoinAnswerImage, heldNexusRoot,
  custodyRootDoor, gateBundleDigest,
  hex, makeMultiSigQuorumVerifier, memoryBackedWithdrawals, nexusAidOf, sovereignGateRoot, sovereignRoute, utf8Bytes,
  type FleetJoinAnswer, type GateBundle, type GateSession,
} from "@lararium/mesh";
import { SessionTable, sessionBinding } from "../../../lararium-mesh/src/session-contract.js";
import { runFoundTheFace, runFleetJoinOffer, runFleetJoinRequest, runFleetJoinAnswer, runFleetJoinLand } from "../../src/index.js";
import { readKeptAdmitBundles } from "../../src/admit-bundle.js";
import { readCarriedCharters } from "../../src/carried-set.js";
import { custodyGateDoor } from "../../src/custody-seat.js";
import { composeDialPresentation } from "../../src/dial-presentation.js";
import { faceDeviceBook } from "../../src/face-device-book.js";
import { faceGateServer, gateSessionRegistry } from "../../src/face-gate-server.js";
import { heldRootHoldings } from "../../src/face-root-holdings.js";
import { readFaceAddressSecret, readFaceJoinRecord } from "../../src/fleet-join-custody.js";
import { readKeptHearthFloorPins } from "../../src/commands/fleet-join.js";
import { gateGrantRing } from "../../src/gate-rings.js";
import { gateShadowRing } from "../../src/gate-shadow-ring.js";
import { gateSyncServer } from "../../src/gate-sync-server.js";
import { readHearthDialPin } from "../../src/hearth-dial-pin.js";
import { chooseHearthDial, fileHearthPins, hearthGatePins, hearthNameOf } from "../../src/hearth-gate-pins.js";
import type { CarriedNexusReading } from "../../src/nexus-carriage.js";
import { maybeStartNexusClientDial } from "../../src/nexus-client-dial.js";
import { readNexusDoc } from "../../src/nexus-doc.js";
import { loadPersonaGroupRootSeed, loadVesselVerifyingKey, vesselFloorKeyDoor } from "../../src/node-vessel-identity.js";
import { hearthFloorPins, hearthSovereignPin } from "../../src/hearth-sovereign-pin.js";
import { ensureFaceHouseholdAdmit, faceHouseholdAdmitPath } from "../../src/face-household-admit.js";
import { vesselGate } from "../../src/vessel-gates.js";
import { larBootstrapPath, larSealHome } from "../../src/vessel-paths.js";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { direct } from "../direct-store.js";
import { standFacePlane } from "../face-plane-fixture.js";
import { foundDirect, openTestCustody, sealTestCustody, seatSeedCharter } from "../found-route.js";

const TEST_ROOT = join(tmpdir(), `lar-fleet-join-dial-${Date.now()}`);
const vessel = (name: string) => {
  const root = join(TEST_ROOT, name);
  return { root, storage: join(root, "data", "lares", "vessel"), genesis: join(root, "genesis") };
};
const A = vessel("a");
const B = vessel("b");
const BUILT_GENESIS = join(new URL("../../", import.meta.url).pathname, "..", "..", "genesis");
const ship = (genesisDir: string): void => {
  mkdirSync(genesisDir, { recursive: true });
  cpSync(BUILT_GENESIS, genesisDir, { recursive: true, filter: (src) => !src.endsWith("social-bootstrap.json") });
};
const realDeadlines = () => ({ draw(lapse: () => void) { const t = setTimeout(lapse, 5_000); return { cancel: () => clearTimeout(t) }; } });

/** Run `work` as vessel `v`: its root, and its own custody seated. */
const as = <T>(v: { root: string }, work: () => Promise<T>): Promise<T> => withLarRoot(v.root, async () => { await openTestCustody(); return work(); });

const closers: Array<() => Promise<void> | void> = [];
afterAll(async () => {
  for (const close of closers.reverse()) await close();
  try { rmSync(TEST_ROOT, { recursive: true, force: true }); } catch { /* best effort */ }
});

function bootstrapGroup(path: string): string {
  const raw = JSON.parse(readFileSync(path, "utf8")) as { text?: string };
  return (JSON.parse(raw.text ?? "{}") as { tiddlers?: Record<string, { text?: string }> }).tiddlers?.[PERSONA_GROUP_ID_TIDDLER]?.text ?? "";
}

// ── The hearth's listener stands first, so the answer names where it listens ──────────────────
const http: Server = createServer();
let port = 0;
let syncUrl = "";
let standUpgrade: ((req: never, socket: never, head: never) => boolean) | null = null;
http.on("upgrade", (req, socket, head) => { if (!standUpgrade?.(req as never, socket as never, head as never)) socket.destroy(); });

let groupA = "";
let aidA = "";
let catalogA = "";
let offerJson: unknown;
let requestJson: unknown;
let answer: FleetJoinAnswer;

beforeAll(async () => {
  for (const v of [A, B]) { mkdirSync(v.storage, { recursive: true }); ship(v.genesis); }
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  port = (http.address() as { port: number }).port;
  syncUrl = `ws://127.0.0.1:${port}${SOVEREIGN_SYNC_ROUTE}`;
  closers.push(() => new Promise<void>((r) => http.close(() => r())));

  await withLarRoot(A.root, () => foundDirect({ storageDir: A.storage, genesisDir: A.genesis }));
  await withLarRoot(A.root, () => seatSeedCharter({ name: "vessel-a" }));
  await withLarRoot(A.root, () => direct(runFoundTheFace)({ storageDir: A.storage, genesisDir: A.genesis }));
  await withLarRoot(B.root, async () => { await sealTestCustody(); });
  await withLarRoot(B.root, () => foundDirect({ storageDir: B.storage, genesisDir: B.genesis }));

  groupA = await withLarRoot(A.root, async () => bootstrapGroup(larBootstrapPath()));
  aidA = await withLarRoot(A.root, async () => nexusAidOf(readNexusDoc(larSealHome()))!);
  offerJson = JSON.parse(JSON.stringify(await as(A, () => runFleetJoinOffer({ sealHome: larSealHome() }))));
  requestJson = JSON.parse(JSON.stringify(await as(B, () => runFleetJoinRequest({ offer: offerJson }))));
  catalogA = await as(A, () => standFacePlane(A.storage));
  answer = JSON.parse(JSON.stringify(await as(A, () => direct(runFleetJoinAnswer)({ storageDir: A.storage, catalogUrl: catalogA, request: requestJson, syncUrl }))));
}, 240_000);

describe("an own-fleet joinee dials on what the answer carried", () => {
  test("F2 RED: a moved admit, or one the root re-signed past its quorum, refuses at land and writes nothing", async () => {
    const moved = { ...answer, admit: { ...answer.admit, admit: { ...answer.admit.admit, parents: ["moved"] } } };
    await expect(as(B, () => direct(runFleetJoinLand)({ storageDir: B.storage, answer: moved }))).rejects.toMatchObject({ refusal: "answer-unsigned" });
    // The root signs an admit whose quorum signatures were stripped: the answer reads, the admit holds nowhere.
    const forged = await as(A, async () => {
      const body = { ...answer, admit: { ...answer.admit, admit: { ...answer.admit.admit, signatures: [] } } } as FleetJoinAnswer;
      const seed = await loadPersonaGroupRootSeed(0);
      try { return { ...body, signature: hex(await ed25519.signAsync(fleetJoinAnswerImage(body), seed)) }; } finally { seed.fill(0); }
    });
    await expect(as(B, () => direct(runFleetJoinLand)({ storageDir: B.storage, answer: forged }))).rejects.toMatchObject({ refusal: expect.stringMatching(/^admit-/) });
    await as(B, async () => {
      // barrier: both runFleetJoinLand refusals answered, awaited through rejects above, before the store read
      expect(readCarriedCharters(larSealHome()).size).toBe(0);
      expect(readKeptAdmitBundles(larSealHome())).toEqual([]);
      expect(await readFaceJoinRecord(groupA)).toBeNull();
      expect(await readFaceAddressSecret(groupA)).toBeNull();
      expect(readKeptHearthFloorPins(larSealHome(), aidA)).toEqual([]);
    });
    // CONTROL: the true answer lands.
    await as(B, () => direct(runFleetJoinLand)({ storageDir: B.storage, answer }));
    await as(B, async () => {
      expect([...readCarriedCharters(larSealHome()).keys()]).toEqual([aidA]);
      expect(readKeptAdmitBundles(larSealHome()).map((b) => b.aid)).toEqual([aidA]);
    });
  }, 120_000);

  test("F4: the joinee keeps the hearth's floor pins at its Nexus, at floor tier on the flow route", async () => {
    const kept = await as(B, async () => readKeptHearthFloorPins(larSealHome(), aidA));
    expect(kept).toEqual(answer.floorPins);
    expect(kept.map((p) => [p.tier, p.route, p.nexus])).toEqual([["floor", FLOW_SOCKET_ROUTE, hex(utf8Bytes(aidA))]]);
  });

  test("F1 RED (witness): offer → request → answer → land → boot dial → same-operator sync, nothing seeded by hand", async () => {
    // ── The hearth, as A's vessel stands it: its own charter's reading, its grant ring over the face it holds, its issued book.
    const hearth = await as(A, async () => {
      const sealHome = larSealHome();
      const charter = readNexusDoc(sealHome);
      const held = heldNexusRoot({ nexus: aidA, charter, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
      if ("absent" in held) throw new Error(held.absent);
      const holdings = await heldRootHoldings({ sealHome, faces: [{ face: 0, personaGroup: groupA }] });
      const own = (await loadVesselVerifyingKey()).toLowerCase();
      const record = await readFaceJoinRecord(groupA);
      const book = faceDeviceBook({ records: async () => (record ? [record] : []), ownVesselKey: async () => own });
      await book.refresh();
      const bundle: GateBundle = deriveGateBundle(sovereignGateRoot(custodyGateDoor()), new TextEncoder().encode(aidA), sovereignRoute(SOVEREIGN_SYNC_ROUTE));
      const floor = hearthFloorPins(aidA, await vesselFloorKeyDoor());
      return { held, holdings, book, bundle, floor };
    });
    closers.push(() => hearth.bundle.drop());
    const sessions = new Map<string, GateSession>();
    const refusals: string[] = [];
    const hearthRepo = new Repo({ sharePolicy: async (peerId: PeerId) => sessions.get(peerId)?.class === "same-operator" } as never);
    const doc = hearthRepo.create<{ fleet: string; back?: string }>({ fleet: "the face's own document" });
    const gateSync = gateSyncServer({ floorPins: (nexus) => (nexus === aidA ? hearth.floor : []) });
    const registry = gateSessionRegistry((channel, session) => gateSync.onOpen(channel, session));
    const server = faceGateServer();
    const adapter = new NodeWSServerAdapter(gateSync.wss as never, 60_000);
    adapter.on("peer-candidate", ({ peerId }) => {
      queueMicrotask(() => { const s = gateSync.sessionOf((adapter.sockets as Record<string, unknown>)[peerId]); if (s) sessions.set(peerId, s); });
    });
    hearthRepo.networkSubsystem.addNetworkAdapter(adapter);
    const reading = { ...hearth.held, aid: aidA, via: "charter", island: `island-${aidA}`, posture: "private" } as unknown as CarriedNexusReading;
    const gate = vesselGate({
      readings: async () => [reading], posture: () => "private",
      shadows: gateShadowRing({ ring: { fold: () => ({ fleets: [], realms: [] }), deviceAside: () => false }, deviceOf: (x) => hearth.book.deviceOf(x) }),
      grants: gateGrantRing({ joinRecords: async () => [], rootHoldings: () => hearth.holdings }),
      withdrawals: memoryBackedWithdrawals(), deadlines: realDeadlines(), audience: DAEMON_BAG_ID,
      onRefuse: (_at, reason) => refusals.push(reason), onShut: (arm) => refusals.push(`shut ${String(arm)}`),
    }, { bundle: hearth.bundle, nexus: aidA, sessions: registry.table });
    server.stand({ gate, pin: hearth.bundle.pin });
    standUpgrade = (req, socket, head) => server.handleUpgrade(req, socket, head);
    closers.push(async () => { server.close(); registry.close(); gateSync.close(); await hearthRepo.shutdown().catch(() => undefined); });

    // ── The joinee's boot dial, on what it kept and nothing else.
    await as(B, async () => {
      const sealHome = larSealHome();
      const bootPin = readHearthDialPin(larBootstrapPath());
      const choice = chooseHearthDial({
        hearthPin: bootPin ? { syncUrl: bootPin.syncUrl, ...(bootPin.gatePin ? { gatePin: bootPin.gatePin } : {}) } : null,
        kept: readKeptAdmitBundles(sealHome),
        keptFloor: (nexusHex) => readKeptHearthFloorPins(sealHome, Buffer.from(nexusHex, "hex").toString("utf8")),
      });
      expect(choice.syncUrl).toBe(syncUrl);
      expect(choice.pin).toEqual(hearth.bundle.pin);
      expect(choice.warnings).toEqual([]);
      // (b) the signed answer's floor pins file under the dialed hearth before any crossing.
      const hearthName = hearthNameOf(choice.syncUrl!);
      const flowKey = { hearth: hearthName, nexus: choice.pin!.nexus, route: FLOW_SOCKET_ROUTE, tier: "floor" as const };
      const booted = hearthGatePins();
      fileHearthPins(booted, choice.filings);
      expect(booted.get(flowKey)).toEqual(answer.floorPins[0]);
      expect(hearth.floor).toEqual(answer.floorPins);
      // (a) the dial's index holds the sovereign pin alone; the session must teach it the flow's.
      const pins = hearthGatePins();
      fileHearthPins(pins, choice.filings.filter((f) => f.pin.tier === "sovereign"));
      expect(pins.get(flowKey)).toBeNull();
      const personaGroup = bootstrapGroup(larBootstrapPath());
      expect(personaGroup).toBe(groupA);
      const composed = await composeDialPresentation({
        sealHome, pin: choice.pin!, personaGroup,
        table: new SessionTable(`dial-${globalThis.crypto.randomUUID()}`), binding: sessionBinding("socket"), profile: "face",
      });
      if (!("presentation" in composed)) throw new Error(`no presentation: ${composed.refusal} ${composed.detail ?? ""}`);
      const repo = new Repo({ peerId: "joinee-b" as PeerId, sharePolicy: async () => true } as never);
      const logs: string[] = [];
      const dial = maybeStartNexusClientDial({
        repo, syncUrl: choice.syncUrl, pins, hearth: hearthNameOf(choice.syncUrl!), nexus: choice.pin!.nexus,
        presentation: composed.presentation, deadlines: realDeadlines(), onLog: (l) => logs.push(l),
      });
      expect(dial, logs.join("\n")).not.toBeNull();
      try {
        const start = Date.now();
        while (sessions.size === 0) {
          if (Date.now() - start > 15_000) throw new Error(`the gate never seated the joinee (${refusals.join(" | ")}; ${logs.join(" | ")}; anergized ${dial!.adapter.anergized})`);
          await new Promise((r) => setTimeout(r, 25));
        }
        expect([...sessions.values()][0]!.class).toBe("same-operator");
        const start1 = Date.now();
        while (pins.get(flowKey) === null) {
          if (Date.now() - start1 > 15_000) throw new Error("the sovereign session never carried the hearth's floor pins");
          await new Promise((r) => setTimeout(r, 25));
        }
        expect(pins.get(flowKey)).toEqual(answer.floorPins[0]);
        const there = await findWhenReady<{ fleet: string; back?: string }>(repo, doc.url, 15_000);
        expect(there.doc()?.fleet).toBe("the face's own document");
        there.change((d) => { d.back = "from the joinee"; });
        const start2 = Date.now();
        while (doc.doc()?.back !== "from the joinee") {
          if (Date.now() - start2 > 15_000) throw new Error("the joinee's change never reached the hearth");
          await new Promise((r) => setTimeout(r, 25));
        }
      } finally {
        dial!.stop();
        await repo.shutdown().catch(() => undefined);
      }
    });
  }, 120_000);

  test("F3: a second answer reuses the face's admit the first one minted", async () => {
    const again = await as(A, () => direct(runFleetJoinAnswer)({ storageDir: A.storage, catalogUrl: catalogA, request: requestJson, syncUrl })) as FleetJoinAnswer;
    expect(again.admit).toEqual(answer.admit);
    const kept = await withLarRoot(A.root, async () => readdirSync(join(larSealHome(), "nexus", "face-admit", aidA)));
    expect(kept).toHaveLength(1);
  }, 120_000);

  test("F5 RED: a rotated sovereign pin mints the household admit again and replaces the kept one", async () => {
    const rotated = custodyRootDoor({ derive: () => new Uint8Array(32).fill(0x5e) });
    const before = answer.admit;
    const mint = () => as(A, () => direct(ensureFaceHouseholdAdmit)({ storageDir: A.storage, sealHome: larSealHome(), face: 0, gateDoor: rotated, syncUrl }));
    const minted = await mint();
    const newPin = hearthSovereignPin(aidA, rotated);
    expect(gateBundleDigest(minted.opening.carriage.gatePin)).toBe(gateBundleDigest(newPin));
    expect(gateBundleDigest(newPin)).not.toBe(gateBundleDigest(answer.carriage.gatePin));
    expect(minted.admit.carriageCommit).not.toBe(before.admit.carriageCommit);
    expect(minted.admit.nym).toBe(before.admit.nym);
    const keptPath = await withLarRoot(A.root, async () => faceHouseholdAdmitPath(larSealHome(), aidA, minted.admit.nym));
    expect(JSON.parse(readFileSync(keptPath, "utf8"))).toEqual(JSON.parse(JSON.stringify(minted)));
    expect(await withLarRoot(A.root, async () => readdirSync(join(larSealHome(), "nexus", "face-admit", aidA)))).toHaveLength(1);
    // CONTROL: the same door again reuses the admit it just minted.
    expect(await mint()).toEqual(JSON.parse(JSON.stringify(minted)));
  }, 120_000);
});

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

// Keep the unused import list honest: existsSync is used by the setup guard below.
if (!existsSync(join(BUILT_GENESIS, "seed.json"))) throw new Error(`[fleet-join-dial] no hearth engine at ${BUILT_GENESIS}: run \`pnpm --filter @lararium/node build:genesis\` first.`);
