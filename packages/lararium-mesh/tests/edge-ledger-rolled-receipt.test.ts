/**
 * edge-ledger-rolled-receipt — A ROLL MARK COUNTS ONLY UNDER A RECEIPT THIS VESSEL'S KEY SIGNED (road `T33`).
 *
 * The finding (the train t2 cold read, wave three, N2): `markRaiseRolled` kept `{edgeId, how, seat}` and dropped the
 * roll's receipt, and every reader of the `rolled/<raise>` rows (`raisesSeenThrough`, `rolledRaises`, `keptSeatRolls`)
 * counted any row standing there. A hand that writes the vessel's ledger plants `rolled/<raise>` and the raise reads
 * answered: seat-duties skips its roll, and a lifted device's edge reads `returned` while its key roll stays owed.
 *
 *   R1  RED: a planted row (no receipt, or a receipt under another key, or one altered after signing) answers nothing:
 *       the raise stays out of `raisesSeenThrough` and `rolledRaises`, `keptSeatRolls` keeps no roll for it, and the
 *       lifted edge still reads `owing`.
 *   R1c CONTROL: the vessel's own receipt-signed mark answers the raise in every reader, and the edge reads `returned`.
 *   R2  RED: a planted row never blocks the genuine mark; the genuine roll lands over it, receipt and all, and the kept
 *       roll verifies under the vessel's key.
 *   R3  CONTROL: a mark answered with no authority still stays out of `raisesSeenThrough` (the seat may stand), and a
 *       later answer from this vessel's own key steps it up.
 */
import { describe, expect, it } from "vitest";
import {
  EDGE_LEDGER_PREFIX, edgeStandingOf, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, keptSeatRolls, markRaiseRolled,
  raisesSeenThrough, rolledRaises, signSeatRoll, storedLarRecord, verifiedSeatRoll,
  type EdgeReading, type LarDoc, type SeatRoll,
} from "../src/index.js";

const SCOPE = "cd".repeat(32);
const EDGE = "ef".repeat(32);
const RAISE = "a1".repeat(32);
const OWN = new Uint8Array(32).fill(0x31);
const OTHER = new Uint8Array(32).fill(0x77);

const rollOf = (how: SeatRoll["how"] = "revoked"): SeatRoll =>
  ({ kind: "seat-roll", scope: SCOPE, edgeId: EDGE, raiseCids: [RAISE], how, seat: { group: "0xgroup", member: "0xmember" } });
const signed = (how: SeatRoll["how"] = "revoked", by = OWN) => signSeatRoll(rollOf(how), ed25519SignerFromSeed(by));
const emptyLedger = (): LarDoc => ({ tiddlers: {} }) as unknown as LarDoc;
const plant = (doc: LarDoc, text: string): void => {
  const key = `${EDGE_LEDGER_PREFIX}${SCOPE}/rolled/${RAISE}`;
  doc.tiddlers[key] = storedLarRecord(key, { text }, SCOPE);
};
/** A lifted edge: its shadow came down, and its raise still owes its key roll until a mark answers it. */
const lifted: EdgeReading = { stands: false, raiseCids: [RAISE] } as unknown as EdgeReading;

describe("a roll mark counts only under a receipt this vessel's key signed (T33)", () => {
  it("R1 — RED: a planted row answers nothing", async () => {
    const key = await ed25519VerifyingKeyFromSeed(OWN);
    const plants: Record<string, string> = {
      "no receipt": JSON.stringify({ edgeId: EDGE, how: "revoked" }),
      "the bare word": "rolled",
      "another key's receipt": JSON.stringify(await signed("revoked", OTHER)),
      "altered after signing": JSON.stringify({ ...(await signed("no-authority")), how: "revoked" }),
    };
    for (const [what, text] of Object.entries(plants)) {
      const doc = emptyLedger();
      plant(doc, text);
      expect([...raisesSeenThrough(doc, SCOPE, key)], `R1 seen through: ${what}`).toEqual([]);
      expect([...rolledRaises(doc, SCOPE, key)], `R1 rolled: ${what}`).toEqual([]);
      expect(keptSeatRolls(doc, SCOPE, key), `R1 kept: ${what}`).toEqual([]);
      expect(edgeStandingOf(lifted, raisesSeenThrough(doc, SCOPE, key)), `R1 standing: ${what}`).toBe("owing");
    }
  });

  it("R1c — CONTROL: the vessel's own receipt-signed mark answers the raise in every reader", async () => {
    const key = await ed25519VerifyingKeyFromSeed(OWN);
    const doc = emptyLedger();
    markRaiseRolled(doc, SCOPE, RAISE, await signed(), key);
    expect([...raisesSeenThrough(doc, SCOPE, key)], "R1c").toEqual([RAISE]);
    expect([...rolledRaises(doc, SCOPE, key)], "R1c").toEqual([RAISE]);
    expect(edgeStandingOf(lifted, raisesSeenThrough(doc, SCOPE, key)), "R1c").toBe("returned");
  });

  it("R2 — RED: a planted row never blocks the genuine mark, and the kept roll carries its receipt", async () => {
    const key = await ed25519VerifyingKeyFromSeed(OWN);
    const doc = emptyLedger();
    plant(doc, JSON.stringify({ edgeId: EDGE, how: "gone" }));
    markRaiseRolled(doc, SCOPE, RAISE, await signed("revoked"), key);
    const kept = keptSeatRolls(doc, SCOPE, key);
    expect(kept.map((r) => r.how), "the genuine answer lands over the plant").toEqual(["revoked"]);
    expect(verifiedSeatRoll(kept[0], key), "the kept roll verifies under the vessel's key").not.toBeNull();
  });

  it("R3 — CONTROL: a no-authority mark stays owed, and the vessel's later answer steps it up", async () => {
    const key = await ed25519VerifyingKeyFromSeed(OWN);
    const doc = emptyLedger();
    markRaiseRolled(doc, SCOPE, RAISE, await signed("no-authority"), key);
    expect([...raisesSeenThrough(doc, SCOPE, key)]).toEqual([]);
    expect([...rolledRaises(doc, SCOPE, key)]).toEqual([RAISE]);
    markRaiseRolled(doc, SCOPE, RAISE, await signed("gone"), key);
    expect([...raisesSeenThrough(doc, SCOPE, key)]).toEqual([RAISE]);
  });
});
