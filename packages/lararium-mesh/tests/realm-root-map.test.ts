/**
 * realm-root-map — the ROOT map a realm member consult reads, filled from co-signed `keptBy` alone.
 *
 * Proven: a co-signed record roots every name it holds; a one-steward record roots nobody; a foreign-realm
 * record roots nobody; a name reading neither steward class enters nothing; an unknown key answers null (an
 * honest nothing); bag lists read sorted; the map carries no leaf-map link.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/two-maps
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { signRealmBagRegistration, type RealmBagRegistration } from "../src/realm-bag.js";
import { realmRootMap, realmRootOf } from "../src/realm-root-map.js";

const REALM = "epoch-cid-genesis";
const seed    = (n: number) => new Uint8Array(32).fill(n);
const signerOf = (s: Uint8Array) => (b: Uint8Array) => ed.signAsync(b, s).then(hex);
const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const steward  = async (n: number) => ({ signer: await pubOf(seed(n)), sign: signerOf(seed(n)) });
const BAG_X = "lar:///ha.ka.ba/bags/x";
const BAG_Y = "lar:///ha.ka.ba/bags/y";

const reg = (realmId: string, bagUri: string, ...who: number[]) =>
  Promise.all(who.map(steward)).then((s) =>
    signRealmBagRegistration({ realmId, bagUri, docUrl: "automerge:doc", readTier: "contract" }, s));
const standingOf = (...recs: RealmBagRegistration[]) => new Map(recs.map((r) => [r.bagUri, r]));

describe("realm-root-map — the ROOT map, filled from co-signed keptBy", () => {
  test("a co-signed record roots BOTH names to its bag", async () => {
    const m = realmRootMap(REALM, standingOf(await reg(REALM, BAG_X, 1, 2)));
    expect(m.realmId).toBe(REALM);
    expect(realmRootOf(m, await pubOf(seed(1)))).toEqual([BAG_X]);
    expect(realmRootOf(m, await pubOf(seed(2)))).toEqual([BAG_X]);
  });

  test("a ONE-steward record roots nobody — it names one hand's own book", async () => {
    const m = realmRootMap(REALM, standingOf(await reg(REALM, BAG_X, 1)));
    expect(m.roots.size).toBe(0);
    expect(realmRootOf(m, await pubOf(seed(1)))).toBeNull();
  });

  test("a FOREIGN-realm record roots nobody", async () => {
    const m = realmRootMap(REALM, standingOf(await reg("another-realm", BAG_X, 1, 2)));
    expect(m.roots.size).toBe(0);
  });

  test("a name reading neither steward class enters NOTHING; the readable name still enters", async () => {
    const good = await reg(REALM, BAG_X, 1, 2);
    const torn: RealmBagRegistration = { ...good, keptBy: [...good.keptBy, "0xNOT-A-KEY"] };
    const m = realmRootMap(REALM, standingOf(torn));
    expect(m.roots.has("0xnot-a-key")).toBe(false);
    expect(m.roots.size).toBe(2);
  });

  test("a Handle-class name enters beside a Face-class name", async () => {
    const good = await reg(REALM, BAG_X, 1, 2);
    const handle = `handle-${"ab".repeat(32)}`;
    const m = realmRootMap(REALM, standingOf({ ...good, keptBy: [good.keptBy[0]!, handle] }));
    expect(realmRootOf(m, handle)).toEqual([BAG_X]);
  });

  test("an UNKNOWN key answers null — an honest nothing, never a leaf promoted", async () => {
    const m = realmRootMap(REALM, standingOf(await reg(REALM, BAG_X, 1, 2)));
    expect(realmRootOf(m, await pubOf(seed(9)))).toBeNull();
    expect(realmRootOf(m, "")).toBeNull();
  });

  test("names read lower-case and a key asked in upper case still finds its root", async () => {
    const m = realmRootMap(REALM, standingOf(await reg(REALM, BAG_X, 1, 2)));
    expect(realmRootOf(m, (await pubOf(seed(1))).toUpperCase())).toEqual([BAG_X]);
  });

  test("one steward across two co-signed bags reads both, sorted by bagUri", async () => {
    const m = realmRootMap(REALM, standingOf(await reg(REALM, BAG_Y, 1, 2), await reg(REALM, BAG_X, 1, 3)));
    expect(realmRootOf(m, await pubOf(seed(1)))).toEqual([BAG_X, BAG_Y]);
    expect(realmRootOf(m, await pubOf(seed(3)))).toEqual([BAG_X]);
  });

  test("CONTROL: an empty standing roots nobody", () => {
    expect(realmRootMap(REALM, new Map()).roots.size).toBe(0);
  });
});
