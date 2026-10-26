/**
 * admit-gate-pin, THE PAIR INDEX UNDER THE FLOOR PIN CLAIM (W15): KEL descent orders the pin.
 *
 * A descendant claim replaces; a known ancestor refuses as a rollback; two claims at one head and a forked KEL surface as a
 * fork; arrival order never selects. Every red stands against a control (a duplicate of the same digest; a live replacement
 * after rotation) and a known positive (the replacement serves the new signer's pin).
 */
import { describe, expect, test } from "vitest";
import { hex, utf8Bytes } from "../src/crypto.js";
import { dialPinKeyOf, hearthPinIndex, type HearthPinIndex, type PlaceClaimStand } from "../src/admit-gate-pin.js";
import { filePlaceFloorPins, readPlaceFloorPin, type PlaceFloorPinReading } from "../src/place-floor-pin.js";
import { claimAt, digests, floorPinFor, foundPlace, headOf, rotatePlace, rowsOf, type TestPlace } from "./place-claim-fixture.js";

const NEXUS = "nexus-index.synthetic";
const NEXUS_HEX = hex(utf8Bytes(NEXUS));
const pinAt = (fill: number, route = "/flow") => floorPinFor(NEXUS, route, fill);
const keyFor = (name: string, route = "/flow") => ({ hearth: name, nexus: NEXUS_HEX, route, tier: "floor" as const });

/** Read a claim (anchored to `place`'s AID, over `rows`) into the stand the index files. */
async function stood(place: TestPlace, fill: number, rows: unknown[] = rowsOf(place)): Promise<PlaceFloorPinReading> {
  const read = readPlaceFloorPin(await claimAt(place, pinAt(fill)), { nexusHex: NEXUS_HEX, route: "/flow", kelRows: rows, standing: { via: "anchor", aid: place.aid } });
  if ("refusal" in read) throw new Error(`fixture claim refuses: ${read.refusal}`);
  return read;
}
const file = (ix: HearthPinIndex, name: string, r: PlaceFloorPinReading) => ix.fileClaim(name, r.pin, r.stand);

describe("a claim files, and KEL descent replaces", () => {
  test("CONTROL: a claim files first, and the same claim again reads duplicate", async () => {
    const ix = hearthPinIndex();
    const a = await stood(foundPlace(1), 10);
    expect(file(ix, "h", a)).toMatchObject({ filed: true, moved: "first" });
    expect(file(ix, "h", a)).toMatchObject({ filed: true, moved: "duplicate" });
    expect(ix.get(keyFor("h"))).toEqual(a.pin);
    expect(ix.size).toBe(1);
  });

  test("POSITIVE: a descendant claim after rotation REPLACES the pin live; the standing names the new head", async () => {
    const ix = hearthPinIndex();
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const a = await stood(p0, 10), b = await stood(p1, 11);
    file(ix, "h", a);
    expect(file(ix, "h", b)).toMatchObject({ filed: true, moved: "replaced" });
    expect(ix.get(keyFor("h"))).toEqual(b.pin);
    expect(ix.standingOf(keyFor("h"))).toMatchObject({ aid: p0.aid, seq: 1, head: headOf(p1).headDigest });
    expect(ix.forks()).toEqual([]);
  });

  test("RED: a known ANCESTOR refuses as a rollback and the newer pin keeps serving", async () => {
    const ix = hearthPinIndex();
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const a = await stood(p0, 10), b = await stood(p1, 11);
    file(ix, "h", b);
    expect(file(ix, "h", a)).toMatchObject({ filed: false, refusal: "rollback", held: { seq: 1 } });
    expect(ix.get(keyFor("h"))).toEqual(b.pin);
  });

  test("RED: two claims at ONE head with different pins surface as a fork; the settled ancestor keeps serving", async () => {
    const ix = hearthPinIndex();
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const a = await stood(p0, 10), b = await stood(p1, 11), twin = await stood(p1, 12);
    file(ix, "h", a); file(ix, "h", b);
    const result = file(ix, "h", twin);
    expect(result).toMatchObject({ filed: false, refusal: "fork" });
    expect(ix.forks()).toHaveLength(1);
    expect(ix.forks()[0]).toMatchObject({ heads: [headOf(p1).headDigest], settled: headOf(p0).headDigest });
    expect(ix.get(keyFor("h"))).toEqual(a.pin);
  });

  test("RED: a forked KEL surfaces: sibling heads hold the common ancestor's pin", async () => {
    const ix = hearthPinIndex();
    const p0 = foundPlace(1), left = rotatePlace(p0, 0), right = rotatePlace(p0, 1);
    const rows = rowsOf(left, right);
    const a = await stood(p0, 10, rows);
    file(ix, "h", a);
    file(ix, "h", await stood(left, 11, rowsOf(left)));
    const result = file(ix, "h", await stood(right, 12, rowsOf(right)));
    expect(result).toMatchObject({ filed: false, refusal: "fork" });
    expect(ix.get(keyFor("h"))).toEqual(a.pin);
  });

  test("RED: another place AID at the same key surfaces too, and serves nothing until one yields", async () => {
    const ix = hearthPinIndex();
    const one = await stood(foundPlace(1), 10), two = await stood(foundPlace(2), 10);
    file(ix, "h", one);
    file(ix, "h", two);
    expect(ix.get(keyFor("h"))).toBeNull();
    expect(ix.size).toBe(0);
  });

  test("a noted KEL fork withdraws the claims past the trunk, and order does not matter", async () => {
    const p0 = foundPlace(1), left = rotatePlace(p0, 0);
    const a = await stood(p0, 10), l = await stood(left, 11);
    const note = { aid: p0.aid, trunk: [digests(p0)[0]!] };
    const orders: Array<(ix: HearthPinIndex) => void> = [
      (ix) => { file(ix, "h", a); file(ix, "h", l); ix.noteKelFork(note); },
      (ix) => { ix.noteKelFork(note); file(ix, "h", l); file(ix, "h", a); },
      (ix) => { file(ix, "h", l); ix.noteKelFork(note); file(ix, "h", a); },
    ];
    for (const run of orders) {
      const ix = hearthPinIndex();
      run(ix);
      expect(ix.get(keyFor("h"))).toEqual(a.pin);
      expect(ix.forks().map((f) => f.key.startsWith("kel"))).toEqual([true]);
    }
  });
});

describe("arrival order selects nothing", () => {
  const permutations = <T>(xs: T[]): T[][] => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));

  test("a descent in all six arrival orders converges to the same head and pin; a fresh index over the same evidence converges the same", async () => {
    const p0 = foundPlace(1), p1 = rotatePlace(p0), p2 = rotatePlace(p1);
    const all = [await stood(p0, 10), await stood(p1, 11), await stood(p2, 12)];
    const heads = new Set<string>();
    for (const order of permutations(all)) {
      const ix = hearthPinIndex();
      for (const r of order) file(ix, "h", r);
      heads.add(`${ix.standingOf(keyFor("h"))?.head}|${JSON.stringify(ix.get(keyFor("h")))}`);
      expect(ix.forks()).toEqual([]);
    }
    expect([...heads]).toEqual([`${headOf(p2).headDigest}|${JSON.stringify(all[2]!.pin)}`]);
  });

  test("sibling claims in either order surface the same fork and hold the same ancestor", async () => {
    const p0 = foundPlace(1), x = rotatePlace(p0, 0), y = rotatePlace(p0, 1);
    const base = await stood(p0, 10), cx = await stood(x, 11, rowsOf(x)), cy = await stood(y, 12, rowsOf(y));
    const seen = new Set<string>();
    for (const order of permutations([base, cx, cy])) {
      const ix = hearthPinIndex();
      for (const r of order) file(ix, "h", r);
      seen.add(JSON.stringify({ forks: ix.forks(), served: ix.get(keyFor("h")) }));
    }
    expect(seen.size).toBe(1);
    expect(JSON.parse([...seen][0]!).forks).toHaveLength(1);
  });

  test("CONTROL/silent-zero: an empty index surfaces no fork and serves no pin; the instrument sees a planted fork", async () => {
    const empty = hearthPinIndex();
    expect(empty.forks()).toEqual([]);
    expect(empty.get(keyFor("h"))).toBeNull();
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const planted = hearthPinIndex();
    file(planted, "h", await stood(p1, 11)); file(planted, "h", await stood(p1, 12));
    expect(planted.forks()).toHaveLength(1);
  });
});

describe("a pin that rides no claim keeps the unclaimed rule (claims always use the set fold)", () => {
  test("an unclaimed floor pin files first-wins until a claim serves; then a bare put matches what is served or files nothing", async () => {
    const ix = hearthPinIndex();
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const admitPin = pinAt(9);
    expect(ix.put("h", admitPin)).toBe(true);
    expect(ix.put("h", pinAt(8))).toBe(false);                     // an UNCLAIMED admit pin is first-wins while no claim rides the key
    const a = await stood(p0, 10), b = await stood(p1, 11);
    file(ix, "h", a);
    expect(ix.get(keyFor("h"))).toEqual(a.pin);                    // the claim serves over the unclaimed pin
    expect(ix.put("h", admitPin)).toBe(false);                     // an unclaimed pin no longer moves a claimed key
    expect(ix.put("h", a.pin)).toBe(true);
    file(ix, "h", b);
    expect(ix.put("h", a.pin)).toBe(false);                        // the replaced pin is not served
  });

  test("a SOVEREIGN pin rides no claim: the index refuses the claim by name", async () => {
    const ix = hearthPinIndex();
    const a = await stood(foundPlace(1), 10);
    const sovereign = { ...a.pin, tier: "sovereign" as const, route: "/ws" };
    expect(ix.fileClaim("h", sovereign, a.stand)).toMatchObject({ filed: false });
  });

  test("a malformed stand, an unreadable pin and a bad hearth file nothing", async () => {
    const ix = hearthPinIndex();
    const a = await stood(foundPlace(1), 10);
    const bad: PlaceClaimStand = { ...a.stand, lineage: [] };
    expect(ix.fileClaim("h", a.pin, bad)).toMatchObject({ filed: false, refusal: "stand-malformed" });
    expect(ix.fileClaim("h", "pin", a.stand)).toMatchObject({ filed: false, refusal: "pin-unreadable" });
    expect(ix.fileClaim("", a.pin, a.stand)).toMatchObject({ filed: false, refusal: "hearth-unreadable" });
    expect(ix.size).toBe(0);
  });

  test("a rotated place serves under its new name only: the superseded signer key answers nothing", async () => {
    const ix = hearthPinIndex();
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const a = await stood(p0, 10), b = await stood(p1, 11);
    file(ix, a.signerKey, a); file(ix, b.signerKey, b);
    expect(ix.get(keyFor(b.signerKey))).toEqual(b.pin);
    expect(ix.get(keyFor(a.signerKey))).toBeNull();
    expect(ix.forHearth(b.signerKey, NEXUS)).toEqual([b.pin]);
    expect(ix.forHearth(a.signerKey, NEXUS)).toEqual([]);
  });

  test("filePlaceFloorPins files a board's statements through the one fold and reports what the index held back", async () => {
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const ix = hearthPinIndex();
    const claims = [await claimAt(p1, pinAt(11)), await claimAt(p0, pinAt(10))];
    const report = filePlaceFloorPins(ix, claims, { nexusHex: NEXUS_HEX, route: "/flow", kelRows: rowsOf(p1), standing: { via: "anchor", aid: p0.aid } });
    expect(report.filed).toEqual([headOf(p1).signerKey]);
    expect(report.held).toEqual(["rollback"]);
    expect(dialPinKeyOf(headOf(p1).signerKey, pinAt(11)).hearth).toBe(headOf(p1).signerKey);
  });

  test("noted KEL forks are bounded: a hostile writer minting forks of its own AIDs cannot grow the index past its bound", () => {
    const ix = hearthPinIndex();
    for (let i = 0; i < 1100; i++) ix.noteKelFork({ aid: i.toString(16).padStart(64, "0"), trunk: ["a".repeat(64)] });
    expect(ix.forks().length).toBe(1024);
    ix.noteKelFork({ aid: "0".repeat(64), trunk: ["b".repeat(64)] });         // CONTROL: an AID already noted still takes its earlier fork
    expect(ix.forks().length).toBe(1024);
  });
});
