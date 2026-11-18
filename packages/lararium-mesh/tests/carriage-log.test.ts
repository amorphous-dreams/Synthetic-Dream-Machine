/**
 * carriage-log — Gaia Thursday: a place logs what it carried, under its own key, keyed by the carriage.
 *
 * Gaia stands a herm at the crossroads on Thursday and walks away. What it carries lands in its public carriage log, one
 * signed receipt per carriage: a restart reads the same log back, a replayed carriage appends nothing, and "did you carry
 * X" answers from the log alone. A forged, torn or stranger-signed line files nothing.
 */
import { describe, expect, it } from "vitest";
import {
  CARRIAGE_CARRIER_DOMAIN, CARRIAGE_RECEIPT_DOMAIN, PLACE_SIGNER_DOMAINS, carriageReceiptImage, makeCarriageLog, placeSignerFromSeed,
  readCarriageReceipt, verifyPlaceDuty, type CarriageLogJournal, type CarriageReceipt,
} from "../src/index.js";

const seed = (n: number) => new Uint8Array(32).fill(n);
const CID = "bafkr4ia".padEnd(59, "q");

/** A journal as a disk keeps it: the lines it took, which outlive the log that wrote them. */
function memoryJournal(lines: unknown[] = []): CarriageLogJournal & { readonly lines: unknown[] } {
  return { lines, load: () => lines.map((l) => JSON.parse(JSON.stringify(l))), append: (r) => { lines.push(JSON.parse(JSON.stringify(r))); } };
}

describe("Gaia Thursday: the place's carriage log", () => {
  it("the receipt is a sixth floor duty of the place signer, verifying under the place key alone", async () => {
    expect(PLACE_SIGNER_DOMAINS).toContain(CARRIAGE_RECEIPT_DOMAIN);
    const log = makeCarriageLog({ signer: placeSignerFromSeed(seed(1)) });
    const receipt = await log.carry(CID, "cas-block");
    const image = carriageReceiptImage(receipt);
    expect(verifyPlaceDuty({ domain: CARRIAGE_RECEIPT_DOMAIN, image, sig: receipt.sig, signerKey: placeSignerFromSeed(seed(1)).key })).toBe(true);
    expect(verifyPlaceDuty({ domain: CARRIAGE_CARRIER_DOMAIN, image, sig: receipt.sig, signerKey: receipt.place })).toBe(false);
    expect(JSON.stringify(receipt)).not.toMatch(/time|seq|peer/);
  });

  it("a carriage entry survives a restart, and a replayed carriage id appends nothing", async () => {
    const journal = memoryJournal();
    const first = makeCarriageLog({ signer: placeSignerFromSeed(seed(1)), journal });
    const receipt = await first.carry(CID, "cas-block");
    await first.carry(CID, "cas-block");
    expect(journal.lines).toHaveLength(1);

    const again = makeCarriageLog({ signer: placeSignerFromSeed(seed(1)), journal });
    expect(again.carried(CID)).toEqual(receipt);
    expect(await again.carry(CID, "cas-block")).toEqual(receipt);
    expect(journal.lines).toHaveLength(1);
    expect(again.carried("bafkr4ianevercarried")).toBeNull();
  });

  it("two takes of one carriage in flight append once", async () => {
    const journal = memoryJournal();
    const log = makeCarriageLog({ signer: placeSignerFromSeed(seed(1)), journal });
    const [a, b] = await Promise.all([log.carry(CID, "persona-kel-drop"), log.carry(CID, "persona-kel-drop")]);
    expect(a).toEqual(b);
    expect(journal.lines).toHaveLength(1);
  });

  it("a forged, torn or stranger-signed line files nothing at the restart", async () => {
    const stranger = await makeCarriageLog({ signer: placeSignerFromSeed(seed(7)) }).carry("bafkr4iastranger", "cas-block");
    const ours = await makeCarriageLog({ signer: placeSignerFromSeed(seed(1)) }).carry("bafkr4iaours", "cas-block");
    const forged: CarriageReceipt = { ...ours, carriage: "bafkr4iaforged" };
    const journal = memoryJournal([stranger, forged, { torn: true }, "nonsense", ours]);
    const log = makeCarriageLog({ signer: placeSignerFromSeed(seed(1)), journal });
    expect(log.carried("bafkr4iastranger")).toBeNull();
    expect(log.carried("bafkr4iaforged")).toBeNull();
    expect(log.carried("bafkr4iaours")).toEqual(ours);
    expect(readCarriageReceipt(forged)).toBeNull();
  });

  it("a journal that refuses the line keeps nothing: the log never answers carried for a receipt a restart would lose", async () => {
    const log = makeCarriageLog({ signer: placeSignerFromSeed(seed(1)), journal: { load: () => [], append: () => { throw new Error("disk full"); } } });
    await expect(log.carry(CID, "cas-block")).rejects.toThrow(/disk full/);
    expect(log.carried(CID)).toBeNull();
  });

  it("a carriage id names an address, never free text", async () => {
    const log = makeCarriageLog({ signer: placeSignerFromSeed(seed(1)) });
    await expect(log.carry("the operator's diary entry", "cas-block")).rejects.toThrow(/carriage-log-refused/);
  });
});
