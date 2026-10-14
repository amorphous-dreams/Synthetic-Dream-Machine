/**
 * custody-row-remove — the custody seat's removal door: a holder removes only a row its own key opens.
 *
 *   X1  a row the seat's key opens leaves, with any stray sidecar beside it, and the door answers that a row stood;
 *       nothing at the path answers that none stood.                control: a sibling row stays, byte for byte
 *   X2  RED: A WRONG KEY REMOVES NOTHING. A row another vessel sealed, a torn row and bare bytes each refuse
 *       `CustodyRowUnavailable` naming what stands, and the bytes stay.
 *   X3  RED: a locked seat refuses `CustodyLocked`; a file no carrier row names refuses `CustodyRowUnknown`; a cold
 *       row refuses this door.
 *   X4  a COLD row's removal reads the row first, under the same hold: a row it declines stays byte for byte, and
 *       the one it accepts leaves.                                   control: with no reading asked, the row leaves
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { SEALING_SUFFIX } from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable, CustodyRowUnknown } from "../src/custody-holder.js";
import { readCustodyRow, removeColdCustodyRow, removeCustodyRow, writeCustodyRow } from "../src/custody-seat.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const ROW = `hosting/${"a".repeat(32)}/spent-${"b".repeat(64)}-n-${"c".repeat(32)}`;
const SIBLING = `hosting/${"a".repeat(32)}/spent-${"b".repeat(64)}-n-${"d".repeat(32)}`;
const text = (s: string): Uint8Array => new TextEncoder().encode(s);

const drops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const drop of drops.splice(0).reverse()) await drop(); });
async function custody(label: string): Promise<SeatedScratchCustody> {
  const c = await seatScratchCustody(label);
  drops.push(() => c.drop());
  return c;
}
const refusal = async (act: Promise<unknown>): Promise<unknown> => act.then((v) => `landed ${String(v)}`, (e: unknown) => e);
const at = (c: SeatedScratchCustody, row: string): string => join(c.homes.storage, ...row.split("/"));

describe("the custody seat's removal door", () => {
  test("X1 — a row the key opens leaves with its sidecar; nothing standing answers that none stood", async () => {
    const c = await custody("remove-x1");
    expect(await removeCustodyRow("storage", ROW)).toBe(false);                    // nothing stood
    await writeCustodyRow("storage", ROW, text("n one two"));
    await writeCustodyRow("storage", SIBLING, text("n three four"));
    const sibling = readFileSync(at(c, SIBLING));
    writeFileSync(`${at(c, ROW)}${SEALING_SUFFIX}`, "a write that never committed");
    // A removal that reads the row first leaves a row it declines, and takes the one it accepts, under one hold.
    expect(await removeCustodyRow("storage", ROW, (plaintext) => new TextDecoder().decode(plaintext) === "n another row")).toBe(false);
    expect(existsSync(at(c, ROW))).toBe(true);
    expect(await removeCustodyRow("storage", ROW, (plaintext) => new TextDecoder().decode(plaintext) === "n one two")).toBe(true);
    expect(existsSync(at(c, ROW))).toBe(false);
    expect(existsSync(`${at(c, ROW)}${SEALING_SUFFIX}`)).toBe(false);
    expect(await readCustodyRow("storage", ROW)).toBeNull();
    expect(readFileSync(at(c, SIBLING)).equals(sibling)).toBe(true);               // CONTROL
    expect(await removeCustodyRow("storage", ROW)).toBe(false);
  });

  test("X2 — a wrong key removes nothing: another vessel's row, a torn row and bare bytes each refuse and stay", async () => {
    const b = await custody("remove-x2-b");
    const a = await custody("remove-x2-a");
    process.env["LAR_ROOT"] = b.root;
    await writeCustodyRow("storage", ROW, text("n one two"));
    process.env["LAR_ROOT"] = a.root;
    await writeCustodyRow("storage", ROW, text("n one two"));
    const own = readFileSync(at(a, ROW));
    copyFileSync(at(b, ROW), at(a, ROW));
    const foreign = readFileSync(at(a, ROW));
    expect(foreign.equals(own)).toBe(false);                                       // two keys, two encodings
    const torn = Buffer.from(own.subarray(0, own.length - 3));
    for (const [standing, reading] of [[foreign, "key-fails"], [torn, /key-fails|torn|unopenable/], [Buffer.from("n one two"), "bare"]] as const) {
      writeFileSync(at(a, ROW), standing);
      const refused = await refusal(removeCustodyRow("storage", ROW));
      expect(refused).toBeInstanceOf(CustodyRowUnavailable);
      expect((refused as CustodyRowUnavailable).reading).toMatch(reading);
      expect(readFileSync(at(a, ROW)).equals(standing)).toBe(true);
    }
    writeFileSync(at(a, ROW), own);                                                // CONTROL: its own row leaves
    expect(await removeCustodyRow("storage", ROW)).toBe(true);
  });

  test("X3 — a locked seat, a file no row names, and a cold row each refuse this door", async () => {
    const c = await custody("remove-x3");
    await writeCustodyRow("storage", ROW, text("n one two"));
    expect(await refusal(removeCustodyRow("storage", "hosting/not-a-row"))).toBeInstanceOf(CustodyRowUnknown);
    expect(await refusal(removeCustodyRow("identity", "recovery-device-share-h0.bin"))).toBeInstanceOf(CustodyRowUnknown);
    await c.holder.lock();
    expect(await refusal(removeCustodyRow("storage", ROW))).toBeInstanceOf(CustodyLocked);
    expect(existsSync(at(c, ROW))).toBe(true);
  });

  test("X4 — a cold row's removal reads the row first: a row it declines stays, and the one it accepts leaves", async () => {
    const c = await custody("remove-x4");
    const COLD = "recovery-device-share-h0.bin";
    const cold = join(c.homes.identity, COLD);
    await c.holder.writeRow("identity", COLD, text("a cold share"));
    const standing = readFileSync(cold);
    const seen: string[] = [];
    expect(await removeColdCustodyRow("identity", COLD, (plaintext) => { seen.push(new TextDecoder().decode(plaintext)); return false; })).toBe(false);
    expect(seen).toEqual(["a cold share"]);
    expect(readFileSync(cold).equals(standing), "a declined row stays, byte for byte").toBe(true);
    expect(await removeColdCustodyRow("identity", COLD, (plaintext) => new TextDecoder().decode(plaintext) === "a cold share")).toBe(true);
    expect(existsSync(cold)).toBe(false);
    // control: with no reading asked, a cold row its key opens leaves
    await c.holder.writeRow("identity", COLD, text("a cold share"));
    expect(await removeColdCustodyRow("identity", COLD)).toBe(true);
  });
});
