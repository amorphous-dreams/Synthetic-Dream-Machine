/**
 * vessel-protocol-version — THE HELLO SPEAKS ITS VERSION, AND THE VERSION NAMES A TABLE (the Pono Browser, wave W2; story T-X3).
 *
 * A deploy can leave one tab on one build beside a tab on another. The protocol names itself by the SHA-256 of its declared
 * message table (`VESSEL_PROTOCOL_TABLE`), never by a count, so two builds read each other's name and refuse where the
 * tables differ. No hash orders another: neither side claims the newer build.
 *
 *   V1 RED      the pinned `VESSEL_PROTOCOL` reads the table's own address. A moved table goes red here and prints the pin.
 *   V2 RED      THE HASH DERIVES FROM THE DECLARED TABLE ALONE. A table with one field removed (a hello field, a boot input),
 *               one more field, one flag turned or one more law hashes to another address, each its own.
 *               CONTROL: nothing else moves it: a copy of the table, and the same table with its keys in another order,
 *               hash alike, and the address reads the same on every call.
 *   V3 RED      a differing name refuses `protocol-skew`, and its words name both sides and the cure; an absent name
 *               refuses too. CONTROL: two sides of one table never refuse.
 *   V4          the name reads `sha256-` and 64 hex digits: a content address, with no dot and no counter in it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { expect, test } from "vitest";
import { PROTOCOL_SKEW, protocolAddressOf, protocolSkew, VESSEL_PROTOCOL, VESSEL_PROTOCOL_TABLE } from "../src/vessel-protocol.js";

type LooseTable = { pageToVessel: Record<string, Record<string, number>>; records: Record<string, Record<string, number>>; laws: string[] };
const moved = (change: (table: LooseTable) => void): unknown => {
  const copy = JSON.parse(JSON.stringify(VESSEL_PROTOCOL_TABLE)) as LooseTable;
  change(copy);
  return copy;
};

test("V1 RED the pinned protocol reads the declared table's own address", async () => {
  const address = await protocolAddressOf(VESSEL_PROTOCOL_TABLE);
  expect(VESSEL_PROTOCOL, `the message table moved: pin VESSEL_PROTOCOL in src/vessel-protocol.ts to "${address}"`).toBe(address);
});

test("V2 RED the hash derives from the declared table alone: a removed field moves it, and so does each other change; CONTROL: a copy, a key order and a second call move nothing", async () => {
  const here = await protocolAddressOf(VESSEL_PROTOCOL_TABLE);
  const helloFieldGone = await protocolAddressOf(moved((t) => { delete t.pageToVessel["hello"]!["resume"]; }));
  const bootInputGone = await protocolAddressOf(moved((t) => { delete t.records["VesselBoot"]!["admitCarriage"]; }));
  const field = await protocolAddressOf(moved((t) => { t.pageToVessel["hello"]!["oneMore"] = 0; }));
  const flag = await protocolAddressOf(moved((t) => { t.pageToVessel["hello"]!["face"] = 1; }));
  const law = await protocolAddressOf(moved((t) => { t.laws.push("a meaning that changed under one shape"); }));
  expect(new Set([here, helloFieldGone, bootInputGone, field, flag, law]).size, "six tables, six addresses").toBe(6);
  // CONTROL: the table alone decides. An untouched copy and a second call read the same address.
  expect(await protocolAddressOf(moved(() => undefined))).toBe(here);
  expect(await protocolAddressOf(VESSEL_PROTOCOL_TABLE)).toBe(here);
  // CONTROL: the same table, its tags and fields written last to first.
  const reversed = (value: unknown): unknown => value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).reverse().map(([k, v]) => [k, reversed(v)]))
    : value;
  expect(await protocolAddressOf(reversed(VESSEL_PROTOCOL_TABLE))).toBe(here);
});

test("V3 RED a differing name refuses protocol-skew and names both sides and the cure, and so does an absent one; CONTROL: one table never refuses", async () => {
  const other = await protocolAddressOf(moved((t) => { t.laws.push("another build"); }));
  const skew = protocolSkew(other);
  expect(skew?.refusal).toBe(PROTOCOL_SKEW);
  expect(skew?.why).toContain(VESSEL_PROTOCOL.slice(0, 15));
  expect(skew?.why).toContain(other.slice(0, 15));
  expect(skew?.why, "the refusal names its cure").toMatch(/Reload or close the other tabs of this site, then reload this one/);
  for (const absent of [undefined, null, "", 3]) {
    const none = protocolSkew(absent);
    expect(none?.refusal, `a hello naming ${JSON.stringify(absent)}`).toBe(PROTOCOL_SKEW);
    expect(none?.why).toContain("names no protocol");
  }
  // CONTROL: two tabs of one build.
  expect(protocolSkew(VESSEL_PROTOCOL)).toBeNull();
  expect(protocolSkew(other, other)).toBeNull();
});

test("V4 the name reads as a content address, never a counted version", () => {
  expect(VESSEL_PROTOCOL).toMatch(/^sha256-[0-9a-f]{64}$/);
});
