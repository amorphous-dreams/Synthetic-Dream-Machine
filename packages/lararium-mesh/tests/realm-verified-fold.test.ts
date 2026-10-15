/**
 * realm-verified-fold — a shared board ignores an unverifiable slot (L93), so a forged slot cannot lift
 * a realm's epoch (L97).
 *
 * The plain fold (`realmMaintenanceFromBoard`) takes a MAX over every slot and checks no seal — sound
 * under a vessel's own bag, where the only hand that writes a slot owns it. The moment the ledger moves
 * to a realm's own substrate (a doc every dweller may write), one forged slot carrying a large number
 * lifts the epoch forever (the max-register never decreases). The verifying fold folds ONLY slots whose
 * seal proves the writer rolled them; an unsealed or mis-sealed slot reads as ignored, never fatal.
 *
 * The CONTROL fires the plain fold on the same forgery and watches it fold — the hole this closes.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { realmFeedSlotUri } from "../src/cabal-realm.js";
import {
  realmFeedSlotValue, signRealmFeed,
  realmMaintenanceFromBoard, verifiedMaintenanceFromBoard,
} from "../src/cabal-realm-clock.js";

const REALM = "a".repeat(64);

async function face(seedByte: number) {
  const seed = new Uint8Array(32).fill(seedByte);
  const nym  = Buffer.from(await ed.getPublicKeyAsync(seed)).toString("hex");
  return { nym, sign: async (b: Uint8Array) => Buffer.from(await ed.signAsync(b, seed)).toString("hex") };
}

function putSlot(doc: LarDoc, writer: string, value: string): void {
  const uri = realmFeedSlotUri(REALM, writer);
  (doc.tiddlers as Record<string, unknown>)[uri] = { tiddler: { title: uri, text: value } };
}

describe("verifiedMaintenanceFromBoard — a forged slot cannot lift a shared realm's epoch", () => {
  test("★ CONTROL: the plain fold FOLDS an unsealed high slot (the hole) ★", async () => {
    const honest = await face(3);
    const doc = emptyLarDoc() as LarDoc;
    putSlot(doc, honest.nym, realmFeedSlotValue({ epoch: 5, sig: await signRealmFeed({ realm: REALM, writer: honest.nym, epoch: 5 }, honest.sign) }));
    putSlot(doc, "f".repeat(64), realmFeedSlotValue({ epoch: 9999 }));   // an unsealed bare roll any hand could write
    expect(realmMaintenanceFromBoard(doc, REALM).effectiveEpoch, "the plain fold takes the forgery's max").toBe(9999);
  });

  test("★ the verified fold IGNORES the forgery — the epoch holds at the sealed max ★", async () => {
    const honest = await face(3);
    const doc = emptyLarDoc() as LarDoc;
    putSlot(doc, honest.nym, realmFeedSlotValue({ epoch: 5, sig: await signRealmFeed({ realm: REALM, writer: honest.nym, epoch: 5 }, honest.sign) }));
    putSlot(doc, "f".repeat(64), realmFeedSlotValue({ epoch: 9999 }));                 // unsealed → ignored
    putSlot(doc, "e".repeat(64), realmFeedSlotValue({ epoch: 8888, sig: "deadbeef" })); // mis-sealed → ignored
    const v = await verifiedMaintenanceFromBoard(doc, REALM);
    expect(v.effectiveEpoch, "only the valid-sealed slot folds").toBe(5);
    expect(v.maintainerCount).toBe(1);
  });

  test("★ two honestly-sealed faces both fold — the fold ignores forgeries, not peers ★", async () => {
    const a = await face(3); const b = await face(4);
    const doc = emptyLarDoc() as LarDoc;
    putSlot(doc, a.nym, realmFeedSlotValue({ epoch: 5, sig: await signRealmFeed({ realm: REALM, writer: a.nym, epoch: 5 }, a.sign) }));
    putSlot(doc, b.nym, realmFeedSlotValue({ epoch: 7, sig: await signRealmFeed({ realm: REALM, writer: b.nym, epoch: 7 }, b.sign) }));
    const v = await verifiedMaintenanceFromBoard(doc, REALM);
    expect(v.effectiveEpoch).toBe(7);
    expect(v.maintainerCount).toBe(2);
  });
});
