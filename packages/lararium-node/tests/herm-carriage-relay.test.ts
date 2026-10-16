/**
 * herm-carriage-relay.test.ts — CARRIAGE PEERING AND THE HERM RELAY OF THE PUBLIC MAP, gate-native (the shut-routes house ruling, stable-founding-road #/rulings: "an explicit Nexus opens the herm relay"; each shut route "flips on a proven gate-native caller").
 *
 * Three herms stand at ONE Nexus whose quorum counted a `carry` over each: an ORIGIN (a crossroads node/alpha announced at),
 * and two relays. Each serves its FLOW map through its own floor gate, assembled the way a vessel assembles every gate
 * (`vesselGate`: the held-root admit reader, the vessel's real sorter, the vessel's one posture reader), and each carries through
 * the pull the vessel hands its carriage (`vesselCarriagePull`): pins off the Nexus's carriage board, filed only where the
 * reader's own replica counts the signer as a carrier; the place arm presented; the pointer verified under the peer's key.
 *
 *   · the hearths carry from the herm: relay one merges the origin's map;
 *   · RED: the origin goes DARK, and relay two still catches up from relay one, never touching the origin;
 *   · multi-hop: a reader at the last hop reads relay two's map, VERIFIED under relay two's key, carrying node/alpha;
 *   · RED: a stranger (a place no quorum carried) holds no pin, presents nothing and dials nothing; handed the pin, it knocks,
 *     proves its key and is ANSWERED: a herm answers the knock (operator ruling), the pin being the knock itself;
 *   · RED: a reader that stands in ANOTHER Nexus holds no pin here and knocks nowhere; its foreign contract fails the proof
 *     and meets silence, posture or no posture;
 *   · RED: a herm stands no gate at a Nexus that does not carry it; the gate it stands answers the knock (OPEN by class).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import {
  composeVessel, dialEntryToRecord, deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, hearthPinIndex, memoryBackedWithdrawals,
  ORACLE_SOCKET_ROUTE, pullAndVerifyOracle, CARRIAGE_PIN_ABSENT,
  type CapModule, type CarriageEntry, type HearthPinIndex, type LarDoc, type MeshPalaceDoc,
} from "@lararium/mesh";
import { mountFlowMapReadFace } from "../src/oracle-read-face.js";
import { carriageCap, CAP, type MeshPalaceComponent } from "../src/node-caps.js";
import { vesselGate } from "../src/vessel-gates.js";
import { gateReadingsFor, layStatementOn, vesselCarriagePull } from "../src/herm-carriage.js";
import { ownPlacePosture } from "../src/socket-sorter.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";
import { dialer, realDeadlines, AUDIENCE } from "./oracle-floor-rig.js";
import { rootOf, world, type World } from "../../lararium-mesh/tests/face-gate-fixture.js";

const BEARING = "lar:///ha.ka.ba/@oracle/node/alpha";
const servers: Server[] = [];
const dirs: string[] = [];
const disposers: Array<() => Promise<void> | void> = [];
afterAll(async () => {
  for (const d of disposers.splice(0).reverse()) await d();
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

interface Herm {
  readonly label: string;
  readonly seed:  Uint8Array;
  readonly key:   string;
  readonly sign:  (image: Uint8Array) => Promise<Uint8Array>;
  readonly carry: CarriageEntry | null;
}

async function hermOf(w: World, label: string, carried = true): Promise<Herm> {
  const seed = new Uint8Array(32);
  seed.set(new TextEncoder().encode(label).subarray(0, 32));
  seed[31] = 7;
  const key = Buffer.from(await ed.getPublicKeyAsync(seed)).toString("hex");
  return { label, seed, key, sign: (image) => ed.signAsync(image, seed), carry: carried ? await w.carryFor(seed) : null };
}

/** The Nexus as each carried vessel's own replica reads it: one charter, its board, and the carry acts over the herms. */
function readingOf(w: World, acts: readonly CarriageEntry[]): CarriedNexusReading {
  return { ...w.held!, denyBoard: [...acts], aid: w.nexus, via: "carrier-seal", island: `island-${w.nexus}`, sealLineage: [], posture: "private" } as CarriedNexusReading;
}

/** One shared carriage board, as every replica of it would converge: a plain doc and a handle over it. */
function boardOf(): { doc: LarDoc; handle: { doc(): LarDoc; change(fn: (d: LarDoc) => void): void } } {
  const doc = { schemaVersion: "0.1", tiddlers: {} } as LarDoc;
  return { doc, handle: { doc: () => doc, change: (fn) => fn(doc) } };
}

/** Stand a herm: its floor gate at `w` (the vessel's own assembly), its FLOW-map read-face, and its gate-native carriage. */
async function stand(h: Herm, w: World, readings: () => Promise<readonly CarriedNexusReading[]>, board: ReturnType<typeof boardOf>, opts: { tiddlers?: MeshPalaceDoc["tiddlers"]; peers?: Array<{ endpoint: string; gatePubKey: string }> } = {}) {
  const repo = new Repo({ sharePolicy: async () => true });
  disposers.push(() => repo.shutdown().catch(() => {}));
  const handle = repo.create<MeshPalaceDoc>({ schemaVersion: "0.1", tiddlers: opts.tiddlers ?? {} });
  const door = floorKeyDoor(rootOf(`herm ${h.label}`));
  const server = createServer();
  servers.push(server);
  const dir = mkdtempSync(join(tmpdir(), `herm-relay-${h.label}-`)); dirs.push(dir);
  const refusals: string[] = [];
  const face = await mountFlowMapReadFace({
    httpServer: server, meshPalaceHandle: handle, signerSeed: h.seed, storageDir: dir,
    gates: async (sessions) => gateReadingsFor("herm", await readings()).map((r) => {
      const bundle = deriveGateBundle(floorGateRoot(door), new TextEncoder().encode(r.aid), floorRoute(ORACLE_SOCKET_ROUTE));
      return {
        pin: bundle.pin,
        gate: vesselGate({
          readings, posture: () => ownPlacePosture("herm", null),
          shadows: { consult: () => ({ aside: false, fleetAside: true }), consultPlace: () => ({ aside: false }) },
          grants: { grantFor: () => null }, withdrawals: memoryBackedWithdrawals(), deadlines: realDeadlines(1_500), audience: AUDIENCE,
          onRefuse: (_at, reason) => refusals.push(reason),
        }, { bundle, nexus: r.aid, sessions }),
      };
    }),
  });
  disposers.push(() => face.dispose());
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const pins = hearthPinIndex();
  const pull = vesselCarriagePull<MeshPalaceDoc>({
    placeClass: "herm", ownPlaceKey: h.key, sign: h.sign, readings, ownNexus: () => null,
    openBoard: async () => board.doc,
    ownFloorPin: async (nexus) => deriveGateBundle(floorGateRoot(door), new TextEncoder().encode(nexus), floorRoute(ORACLE_SOCKET_ROUTE)).pin,
    layStatement: async (_url, statement) => { layStatementOn(board.handle, statement); },
    pins, audience: AUDIENCE, deadlines: realDeadlines(1_500), dialSocket: dialer,
  });
  const meshpalace: CapModule = { id: CAP.meshpalace, build: () => ({ handle } as MeshPalaceComponent) };
  const vessel = await composeVessel([meshpalace, carriageCap({ peers: opts.peers ?? [], pullOracle: pull, pullIntervalMs: 1_000_000 })]);
  disposers.push(() => vessel.dispose());
  const carriage = vessel.get<{ pullOnce: () => Promise<number> }>(CAP.carriage)!;
  return { origin, handle, pull, pins, refusals, carriage, close: () => new Promise<void>((r) => { face.dispose(); server.closeAllConnections?.(); server.close(() => r()); }) };
}

/** A reader that carries nothing of its own: the pull its vessel would hand its carriage. */
function readerPull(h: Herm, readings: () => Promise<readonly CarriedNexusReading[]>, board: ReturnType<typeof boardOf>, pins: HearthPinIndex = hearthPinIndex()) {
  const urls: string[] = [];
  const pull = vesselCarriagePull<MeshPalaceDoc>({
    placeClass: "herm", ownPlaceKey: h.key, sign: h.sign, readings, ownNexus: () => null, openBoard: async () => board.doc,
    pins, audience: AUDIENCE, deadlines: realDeadlines(1_500), dialSocket: (url) => { urls.push(url); return dialer(url); },
  });
  return { pull, urls, pins };
}

describe("the herm relay and carriage peering, gate-native, at one explicit Nexus", () => {
  let w: World, origin: Herm, relayOne: Herm, relayTwo: Herm, lastHop: Herm;
  let acts: CarriageEntry[];
  let readings: () => Promise<readonly CarriedNexusReading[]>;
  let board: ReturnType<typeof boardOf>;
  let dial: ReturnType<typeof dialEntryToRecord>;
  let O: Awaited<ReturnType<typeof stand>>, H1: Awaited<ReturnType<typeof stand>>, H2: Awaited<ReturnType<typeof stand>>;
  beforeAll(async () => {
    w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE, nexus: "nexus-cabal.synthetic" });
    origin = await hermOf(w, "origin");
    relayOne = await hermOf(w, "relay-one");
    relayTwo = await hermOf(w, "relay-two");
    lastHop = await hermOf(w, "last-hop");
    acts = [origin, relayOne, relayTwo, lastHop].map((h) => h.carry!);
    readings = async () => [readingOf(w, acts)];
    board = boardOf();
    dial = dialEntryToRecord({ bearing: BEARING, verifyingKeyHex: "a".repeat(64), endpoint: "ws://alpha/p", scale: "dreamnet" }, "origin");
    O = await stand(origin, w, readings, board, { tiddlers: { [dial.tiddler.title]: dial } });
    // Each herm lays its own statement on its first refresh; the origin's runs here, the relays' on their own first pulls.
    await O.pull("http://127.0.0.1:9", origin.key).catch(() => null);
    H1 = await stand(relayOne, w, readings, board, { peers: [{ endpoint: O.origin, gatePubKey: origin.key }] });
    H2 = await stand(relayTwo, w, readings, board, { peers: [{ endpoint: H1.origin, gatePubKey: relayOne.key }] });
  }, 60_000);

  test("the hearths carry from the herm: relay one merges the origin's map through the origin's floor gate", async () => {
    await H1.carriage.pullOnce();
    expect(Object.keys(H1.handle.doc()?.tiddlers ?? {})).toContain(dial.tiddler.title);
  }, 30_000);

  test("RED: with the origin DARK, relay two catches up from relay one and never touches the origin", async () => {
    await O.close();
    const dark = await pullAndVerifyOracle(O.origin, {
      pins: H2.pins, hearth: origin.key, nexus: w.pin.nexus, presentation: { kind: "place", placeKey: relayTwo.key, sign: relayTwo.sign, arm: null },
      audience: AUDIENCE, deadlines: realDeadlines(1_000), verifyingKey: origin.key, dialSocket: dialer,
    });
    expect(dark.ok).toBe(false);                                     // the origin answers nobody now
    await H2.carriage.pullOnce();
    expect(Object.keys(H2.handle.doc()?.tiddlers ?? {})).toContain(dial.tiddler.title);
  }, 30_000);

  test("multi-hop: the last hop reads relay two's map, VERIFIED under relay two's own key, carrying node/alpha", async () => {
    const reader = readerPull(lastHop, readings, board);
    // The read-face republishes after a merge on its own beat: a loaded box serves the pre-merge snapshot a moment longer,
    // so the read asks again until relay two's map carries the merge, inside the vector's budget.
    let read = await reader.pull(H2.origin, relayTwo.key);
    for (const until = Date.now() + 20_000; read.ok && !Object.keys(read.doc?.tiddlers ?? {}).includes(dial.tiddler.title) && Date.now() < until; ) {
      await new Promise((r) => setTimeout(r, 250));
      read = await reader.pull(H2.origin, relayTwo.key);
    }
    expect(read.ok, read.reason).toBe(true);
    expect(read.pointer?.pub).toBe(relayTwo.key);
    expect(Object.keys(read.doc?.tiddlers ?? {})).toContain(dial.tiddler.title);
    // CONTROL beside it: the same map named under the origin's key does not verify — the pointer binds its publisher.
    const misnamed = await pullAndVerifyOracle(H2.origin, {
      pins: { get: (k) => reader.pins.get({ ...k, hearth: relayTwo.key }) }, hearth: relayTwo.key, nexus: w.pin.nexus,
      presentation: { kind: "place", placeKey: lastHop.key, sign: lastHop.sign, arm: { kind: "place", contract: lastHop.carry!, lineage: [] } },
      audience: AUDIENCE, deadlines: realDeadlines(), verifyingKey: origin.key, dialSocket: dialer,
    });
    expect(misnamed.ok).toBe(false);
    expect(misnamed.reason).toMatch(/pointer rejected/);
  }, 30_000);

  test("RED: a stranger — a place no quorum carried — presents nothing and dials nothing; handed the pin, it knocks, proves and is answered", async () => {
    const stranger = await hermOf(w, "scraper", false);
    const reader = readerPull(stranger, readings, board);
    const read = await reader.pull(H2.origin, relayTwo.key);
    expect(read.ok).toBe(false);
    expect(read.reason).toMatch(/presentation-absent/);
    expect(reader.urls).toEqual([]);
    // Handed the pin, the stranger KNOCKS: the path derives from the gate key it now holds, its own key proves, and a herm
    // answers any proven peer that knocked (operator ruling "A herm answers the knock"). The map it reads is the public one.
    const handed = await pullAndVerifyOracle(H2.origin, {
      pins: { get: (k) => reader.pins.get(k) ?? lastHopPin() }, hearth: relayTwo.key, nexus: w.pin.nexus,
      presentation: { kind: "place", placeKey: stranger.key, sign: stranger.sign, arm: null },
      audience: AUDIENCE, deadlines: realDeadlines(), verifyingKey: relayTwo.key, dialSocket: dialer,
    });
    expect(handed.ok, handed.reason).toBe(true);
    expect(handed.pointer?.pub).toBe(relayTwo.key);
  }, 30_000);

  test("RED: a reader standing in ANOTHER Nexus holds no pin here and knocks nowhere; its foreign contract meets silence", async () => {
    const elsewhere = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE, nexus: "nexus-other.synthetic" });
    const foreign = await hermOf(elsewhere, "foreign-herm");
    const foreignBoard = boardOf();
    const reader = readerPull(foreign, async () => [readingOf(elsewhere, [foreign.carry!])], foreignBoard);
    const read = await reader.pull(H2.origin, relayTwo.key);
    expect(read).toEqual({ ok: false, reason: CARRIAGE_PIN_ABSENT });
    expect(reader.urls).toEqual([]);
    // Handed relay two's pin out of band, it presents its own Nexus's contract at this Nexus's gate, which reads it unheld.
    const forced = await pullAndVerifyOracle(H2.origin, {
      pins: { get: (k) => H2.pins.get(k) ?? reader.pins.get(k) ?? lastHopPin() }, hearth: relayTwo.key, nexus: w.pin.nexus,
      presentation: { kind: "place", placeKey: foreign.key, sign: foreign.sign, arm: { kind: "place", contract: foreign.carry!, lineage: [] } },
      audience: AUDIENCE, deadlines: realDeadlines(), verifyingKey: relayTwo.key, dialSocket: dialer,
    });
    expect(forced.ok).toBe(false);
    expect(forced.pointer).toBeUndefined();
  }, 30_000);

  /** relay two's pin as the last hop's index filed it off the board. */
  function lastHopPin() {
    const pins = hearthPinIndex();
    for (const raw of Object.values(board.doc.tiddlers)) {
      const text = (raw as { tiddler?: { text?: string } }).tiddler?.text;
      const parsed = text ? JSON.parse(text) as { placeKey?: string; pin?: unknown } : null;
      if (parsed?.placeKey === relayTwo.key) pins.put(relayTwo.key, parsed.pin);
    }
    return pins.get({ hearth: relayTwo.key, nexus: w.pin.nexus, route: ORACLE_SOCKET_ROUTE, tier: "floor" });
  }

  test("RED: a herm stands no gate at a Nexus that does not carry it; the gate it stands answers the knock, OPEN by class", () => {
    const held = readingOf(w, acts);
    expect(gateReadingsFor("herm", [{ ...held, via: "seat" }])).toEqual([]);
    expect(gateReadingsFor("herm", [held]).map((r) => r.aid)).toEqual([w.nexus]);
    expect(gateReadingsFor("lararium", [{ ...held, via: "seat" }]).length).toBe(1);   // CONTROL: a hearth's carried Nexus stands
    // The carrying charter's own posture never narrows a herm: a waystone by class.
    expect(ownPlacePosture("herm", null)).toBe("open");
    expect(ownPlacePosture("herm", { federationPosture: "private" } as never)).toBe("open");
  });
});
