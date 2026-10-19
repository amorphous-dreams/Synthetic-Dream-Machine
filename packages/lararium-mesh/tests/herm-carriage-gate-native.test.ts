/**
 * herm-carriage-gate-native — carriage peering and the herm-to-herm relay of the public map, reopened gate-native.
 *
 * A real floor-tier gate on "/oracle" (a private Nexus: no stranger is answered) plays a herm's oracle face. The reader
 * is a faceless PLACE: its own key and the Nexus quorum's counted `carry` act over it (the place arm). The pin comes from a
 * statement the herm signed with the key the quorum's act names, read against the reader's own carrier fold
 * (lar:///ha.ka.ba/lararium/mesh/place-floor-pin). Each vector stands red first against its control.
 */
import { describe, expect, test } from "vitest";
import * as A from "@automerge/automerge";
import * as ed25519 from "@noble/ed25519";
import { hearthPinIndex } from "../src/admit-gate-pin.js";
import { channelSessionTable, type GateSessionChannel } from "../src/gate-session-channel.js";
import { buildOraclePointer, exportOracleSnapshot } from "../src/oracle-substrate.js";
import { ORACLE_POINTER_FRAME, ORACLE_SOCKET_ROUTE, pullAndVerifyOracle, type PlaceOraclePresentation } from "../src/oracle-read-client.js";
import {
  filePlaceFloorPins, placeArmFor, placeFloorPinKey, placeFloorPinsFromBoard, readPlaceFloorPin, signPlaceFloorPin, writePlaceFloorPin,
} from "../src/place-floor-pin.js";
import { CARRIAGE_PIN_ABSENT, gateNativeCarriagePull } from "../src/carriage-pull.js";
import { carriageEntriesFromBoard, writeCarriageEntry } from "../src/carriage-board.js";
import type { LarDoc } from "../src/base-doc.js";
import { hex, utf8Bytes } from "../src/crypto.js";
import { dialSocketTo, gateOver } from "./gate-dial-fixture.js";
import { AUDIENCE, handDeadlines, place, wire, world, type Place, type World } from "./face-gate-fixture.js";

const HERM_SEED = Uint8Array.from({ length: 32 }, (_, i) => i + 11);   // the herm's vessel key: publisher and place key
const enc = (text: string): Uint8Array => new TextEncoder().encode(text);

/** The herm: a floor gate at `w`'s Nexus serving one FLOW map signed by its vessel key, as the node face serves it. */
async function herm(w: World, serve: (send: () => void) => void = (send) => send()) {
  const snap = await exportOracleSnapshot(A.from({ tiddlers: { "dial/node-alpha": { text: "lar:///ha.ka.ba/@oracle/node/alpha" } } }));
  const ptr = await buildOraclePointer({ snapshot: snap, parents: [], signerSeed: HERM_SEED });
  const served = { count: 0 };
  const gate = gateOver(w, channelSessionTable((channel: GateSessionChannel) => {
    served.count++;
    serve(() => {
      channel.send("session", enc(JSON.stringify({ type: ORACLE_POINTER_FRAME, pointer: ptr })));
      channel.send("session", snap.bytes);
    });
  }));
  const key = hex(await ed25519.getPublicKeyAsync(HERM_SEED));
  return { gate, key, served, sign: (image: Uint8Array) => ed25519.signAsync(image, HERM_SEED) };
}

const asPlace = (pl: Place, arm: Place["arm"] | null = pl.arm): PlaceOraclePresentation => ({ kind: "place", placeKey: pl.key, sign: pl.sign, arm });

/**
 * Pull with the reader's own deadline. The gate's own outcome decides the lapse, never a count of turns: a reader the
 * gate fell silent to can learn nothing more, so its deadline lapses by hand on both sides; a reader the gate attached
 * or answered finishes by itself; a reader that never dialed settles before any gate runs.
 */
async function pull(w: World, h: Awaited<ReturnType<typeof herm>>, presentation: PlaceOraclePresentation, pins = hearthPinIndex()) {
  if (pins.size === 0) pins.put(h.key, w.pin);
  const deadlines = handDeadlines();
  const urls: string[] = [];
  const { dial, accepted } = wire();
  const accepting = accepted.then((socket) => h.gate.accept(socket));
  const pulling = pullAndVerifyOracle("http://herm.test", {
    pins, hearth: h.key, nexus: w.pin.nexus, presentation, audience: AUDIENCE, deadlines, verifyingKey: h.key,
    dialSocket: (url) => { urls.push(url); return dial; },
  });
  const first = await Promise.race([pulling.then((res) => ({ res })), accepting.then((gate) => ({ gate }))]);
  if ("res" in first) return { res: first.res, urls };
  if (first.gate.outcome === "silence") { deadlines.fire(); w.deadlines.fire(); }
  return { res: await pulling, urls };
}

describe("the faceless reader at a herm's floor gate", () => {
  test("CONTROL: a place the Nexus carries presents its counted contract and reads the map, verified", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    const h = await herm(w);
    const { res } = await pull(w, h, asPlace(await place(w, "relay herm")));
    expect(res.ok, res.reason).toBe(true);
    expect(h.served.count).toBe(1);
  });

  test("CONTROL: a herm slow to serve still reads verified; no count of turns lapses an honest pull", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    // The herm answers only after the reader's side has turned many times over, as a loaded runner can.
    const later = (send: () => void) => { void (async () => { for (let i = 0; i < 2_000; i++) await new Promise((r) => setImmediate(r)); send(); })(); };
    const h = await herm(w, later);
    const { res } = await pull(w, h, asPlace(await place(w, "relay herm")));
    expect(res.ok, res.reason).toBe(true);
    expect(h.served.count).toBe(1);
  });

  test("RED: a STRANGER (a place no Nexus carries, presenting no contract) meets silence and learns no pointer", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    const h = await herm(w);
    const { res } = await pull(w, h, asPlace(await place(w, "scraper"), null));
    expect(res.ok).toBe(false);
    expect(res.pointer).toBeUndefined();
    expect(res.reason).toMatch(/dial failed/);
    expect(h.served.count).toBe(0);
  });

  test("RED: a reader carried by ANOTHER Nexus presents a contract this gate's root never counts, and meets silence", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE, nexus: "nexus-a.synthetic" });
    const other = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE, nexus: "nexus-b.synthetic" });
    const h = await herm(w);
    const pl = await place(other, "foreign herm");
    const { res } = await pull(w, h, asPlace(pl));
    expect(res.ok).toBe(false);
    expect(res.pointer).toBeUndefined();
    expect(h.served.count).toBe(0);
  });

  test("RED: a reader whose index holds the herm's pin only at another Nexus refuses before it dials", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE, nexus: "nexus-a.synthetic" });
    const other = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE, nexus: "nexus-b.synthetic" });
    const h = await herm(w);
    const pins = hearthPinIndex();
    pins.put(h.key, other.pin);
    const { res, urls } = await pull(w, h, asPlace(await place(w, "relay herm")), pins);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/pin-absent/);
    expect(urls).toEqual([]);
  });
});

describe("the herm's floor pin, carried signed", () => {
  const at = (w: World, carriers: Iterable<string>) => ({ nexusHex: w.pin.nexus, route: ORACLE_SOCKET_ROUTE, carriers: new Set(carriers) });

  test("CONTROL: the herm's own statement files its pin for a reader whose replica counts the herm as carrier", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    const h = await herm(w);
    const statement = await signPlaceFloorPin({ placeKey: h.key, pin: w.pin, sign: h.sign });
    const read = readPlaceFloorPin(JSON.parse(JSON.stringify(statement)), at(w, [h.key]));
    expect(read).toEqual({ placeKey: h.key, pin: w.pin });
  });

  test("RED: an announcement never authenticates its own first pin — a herm the reader's Nexus does not carry files nothing", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    const h = await herm(w);
    const statement = await signPlaceFloorPin({ placeKey: h.key, pin: w.pin, sign: h.sign });
    expect(readPlaceFloorPin(statement, at(w, []))).toEqual({ refusal: "place-uncarried" });
  });

  test("RED: a pin signed by any other key, or standing at another Nexus or tier, files nothing", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    const other = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE, nexus: "nexus-b.synthetic" });
    const sovereign = await world({ route: "/ws" });
    const h = await herm(w);
    const forger = Uint8Array.from({ length: 32 }, (_, i) => 99 - i);
    const forged = await signPlaceFloorPin({ placeKey: h.key, pin: w.pin, sign: (image) => ed25519.signAsync(image, forger) });
    expect(readPlaceFloorPin(forged, at(w, [h.key]))).toEqual({ refusal: "signature-refused" });
    const elsewhere = await signPlaceFloorPin({ placeKey: h.key, pin: other.pin, sign: h.sign });
    expect(readPlaceFloorPin(elsewhere, at(w, [h.key]))).toEqual({ refusal: "pin-other-nexus" });
    const notFloor = await signPlaceFloorPin({ placeKey: h.key, pin: sovereign.pin, sign: h.sign });
    expect(readPlaceFloorPin(notFloor, { ...at(w, [h.key]), nexusHex: sovereign.pin.nexus })).toEqual({ refusal: "pin-not-floor" });
    // CONTROL beside them: the honest statement still files.
    const honest = await signPlaceFloorPin({ placeKey: h.key, pin: w.pin, sign: h.sign });
    expect("pin" in readPlaceFloorPin(honest, at(w, [h.key]))).toBe(true);
  });

  test("the statement rides the carriage board as a sidecar the act extractor never reads, and files from it", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    const h = await herm(w);
    const doc: LarDoc = { tiddlers: {} } as LarDoc;
    const statement = await signPlaceFloorPin({ placeKey: h.key, pin: w.pin, sign: h.sign });
    writePlaceFloorPin(doc, statement);
    expect(Object.keys(doc.tiddlers)).toEqual([placeFloorPinKey(h.key)]);
    expect(carriageEntriesFromBoard(doc)).toEqual([]);
    const pins = hearthPinIndex();
    const filed = filePlaceFloorPins(pins, placeFloorPinsFromBoard(doc), at(w, [h.key]));
    expect(filed.filed).toEqual([h.key]);
    expect(pins.get({ hearth: h.key, nexus: w.pin.nexus, route: ORACLE_SOCKET_ROUTE, tier: "floor" })).toEqual(w.pin);
  });
});

describe("the place arm a herm presents", () => {
  test("CONTROL: the counted head carry presents, with its counted past as lineage", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    const seed = Uint8Array.from({ length: 32 }, (_, i) => i + 40);
    const first = await w.carryFor(seed);
    const { carriageEntryActCid } = await import("../src/carriage-registry.js");
    const off = await w.uncarryFor(seed, [carriageEntryActCid(first)]);
    const again = await w.carryFor(seed, [carriageEntryActCid(off)]);
    const key = hex(await ed25519.getPublicKeyAsync(seed));
    const arm = await placeArmFor([first, off, again], w.held!.roster, key);
    expect(arm?.contract).toEqual(again);
    expect(arm?.lineage.length).toBe(2);
  });

  test("RED: an uncarry that descends from the contract leaves no arm, and an act the roster never counted presents none", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    const other = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE, nexus: "nexus-b.synthetic" });
    const seed = Uint8Array.from({ length: 32 }, (_, i) => i + 41);
    const key = hex(await ed25519.getPublicKeyAsync(seed));
    const first = await w.carryFor(seed);
    const { carriageEntryActCid } = await import("../src/carriage-registry.js");
    const off = await w.uncarryFor(seed, [carriageEntryActCid(first)]);
    expect(await placeArmFor([first, off], w.held!.roster, key)).toBeNull();
    expect(await placeArmFor([await other.carryFor(seed)], w.held!.roster, key)).toBeNull();
    expect(await placeArmFor([first], w.held!.roster, key)).not.toBeNull();   // CONTROL
  });
});

describe("the gate-native carriage pull", () => {
  test("RED: a peer this vessel holds no floor pin for at any Nexus it stands in is never dialed", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    const h = await herm(w);
    const urls: string[] = [];
    const reader = await place(w, "relay herm");
    const pullOracle = gateNativeCarriagePull({
      pins: hearthPinIndex(), nexuses: () => [w.nexus], presentationFor: async () => asPlace(reader),
      audience: AUDIENCE, deadlines: handDeadlines(), dialSocket: (url) => { urls.push(url); return dialSocketTo(h.gate).socket; },
    });
    const res = await pullOracle("http://herm.test", h.key);
    expect(res).toEqual({ ok: false, reason: CARRIAGE_PIN_ABSENT });
    expect(urls).toEqual([]);
  });

  test("CONTROL: one dial per (peer, Nexus), at the pin its board carried, presenting the place's contract — the map verifies", async () => {
    const w = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE });
    const elsewhere = await world({ tier: "floor", route: ORACLE_SOCKET_ROUTE, nexus: "nexus-b.synthetic" });
    const h = await herm(w);
    const reader = await place(w, "relay herm");
    const board: LarDoc = { tiddlers: {} } as LarDoc;
    writeCarriageEntry(board, reader.contract);
    writePlaceFloorPin(board, await signPlaceFloorPin({ placeKey: h.key, pin: w.pin, sign: h.sign }));
    const pins = hearthPinIndex();
    const urls: string[] = [];
    const asked: string[] = [];
    const pullOracle = gateNativeCarriagePull({
      pins,
      nexuses: () => [elsewhere.nexus, w.nexus, w.nexus],
      refresh: async () => { filePlaceFloorPins(pins, placeFloorPinsFromBoard(board), { nexusHex: w.pin.nexus, route: ORACLE_SOCKET_ROUTE, carriers: new Set([h.key]) }); },
      presentationFor: async (nexus) => {
        asked.push(nexus);
        const arm = await placeArmFor(carriageEntriesFromBoard(board), w.held!.roster, reader.key);
        return arm ? { kind: "place", placeKey: reader.key, sign: reader.sign, arm } : null;
      },
      audience: AUDIENCE, deadlines: handDeadlines(), dialSocket: (url) => { urls.push(url); return dialSocketTo(h.gate).socket; },
    });
    const res = await pullOracle("http://herm.test", h.key);
    expect(res.ok, res.reason).toBe(true);
    expect(urls).toEqual(["ws://herm.test/oracle"]);
    expect(asked).toEqual([w.nexus]);
    expect(hex(utf8Bytes(w.nexus))).toBe(w.pin.nexus);
  });
});
