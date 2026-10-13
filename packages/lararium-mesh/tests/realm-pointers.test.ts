import { describe, test, expect } from "vitest";
import { CABAL_REALM_RE, REALM_BAG_DOMAIN, REALM_DOC_URI, realmDocPointer, realmStewardPointer, realmStandingPointer, writeRealmStanding, readRealmStanding, type RealmBagRegistration } from "../src/realm-bag.js";
import { tiddlerText, type LarDoc } from "../src/base-doc.js";

describe("per-realm oracle pointers", () => {
  test("pointer keys separate realms and pointer kinds, encoding reserved characters", () => {
    const a = "realm/a#one", b = "realm-b";
    const keys = [realmDocPointer(a), realmStewardPointer(a), realmStandingPointer(a)];
    const otherKeys = [realmDocPointer(b), realmStewardPointer(b), realmStandingPointer(b)];
    expect(new Set([...keys, ...otherKeys]).size).toBe(6);
    expect(keys.every((key) => key.startsWith(`${REALM_DOC_URI}/`))).toBe(true);
    expect(keys.every((key) => key.includes(encodeURIComponent(a)))).toBe(true);
  });

  test("standing writes sort and round-trip registrations, skip identical text, and drop torn entries", () => {
    const make = (bagUri: string): RealmBagRegistration => ({
      kind: REALM_BAG_DOMAIN, realmId: "r", bagUri,
      docUrl: `automerge:${bagUri}`, keptBy: ["hand"], readTier: "contract", signatures: [],
    });
    const a = make("lar:///z"), b = make("lar:///a");
    const map = new Map([[a.bagUri, a], [b.bagUri, b]]);
    const draft = { tiddlers: {} } as LarDoc;
    expect(writeRealmStanding(draft, "r", map)).toBe(true);
    const key = realmStandingPointer("r"), text = tiddlerText(draft.tiddlers[key]);
    expect([...readRealmStanding(text).keys()]).toEqual(["lar:///a", "lar:///z"]);
    const before = JSON.stringify(draft.tiddlers[key]);
    expect(writeRealmStanding(draft, "r", new Map([[b.bagUri, b], [a.bagUri, a]]))).toBe(false);
    expect(JSON.stringify(draft.tiddlers[key])).toBe(before);
    expect(readRealmStanding("{").size).toBe(0);
    expect(readRealmStanding("{}").size).toBe(0);
    expect(readRealmStanding("[]").size).toBe(0);
    expect(readRealmStanding(`[${JSON.stringify(a)},{}]`).size).toBe(1);
  });
  test("a cabal realm id reads as 64 lower-case hex and nothing else", () => {
    expect(CABAL_REALM_RE.test("a".repeat(64))).toBe(true);
    for (const bad of ["a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64), "", ` ${"a".repeat(64)}`, `${"a".repeat(64)}\n`]) expect(CABAL_REALM_RE.test(bad)).toBe(false);
  });
});
