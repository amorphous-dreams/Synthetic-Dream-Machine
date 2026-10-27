/**
 * THE STORM WITNESS, node leg (W14 to W16): a place rotates through four heads and each head is carried; the evidence reaches a
 * reader reordered, in batches, with restarts that drop the pair index and offline gaps that skip a refresh. The same evidence
 * yields the same head: no arrival order wins, the head never moves backward while the index stands, and a restart converges.
 * The browser leg (`lararium-browser/tests/place-claim-storm.test.ts`) reads the same facts as anchored cards.
 *
 * SILENT-ZERO: an empty board serves nothing and surfaces no fork, and the instrument proves itself on the same fixture with a
 * known-positive rotation and carry (the head serves) and a planted fork (the fork surfaces).
 */
import { describe, expect, test } from "vitest";
import { hex, utf8Bytes } from "../src/crypto.js";
import { hearthPinIndex, type HearthPinIndex } from "../src/admit-gate-pin.js";
import { carriageEntriesFromBoard, writeCarriageEntry } from "../src/carriage-board.js";
import { foldCarrierSet, signCarriageQuorum, signCarrierContract, type CarriageEntry } from "../src/carriage-registry.js";
import type { LarDoc } from "../src/base-doc.js";
import { filePlaceFloorPins, placeFloorPinsFromBoard, writePlaceFloorPin } from "../src/place-floor-pin.js";
import { placeKelRowsFromBoard, writePlaceKelEvent } from "../src/place-kel-board.js";
import { claimAt, floorPinFor, headOf, prng, rotatePlace, shuffled, stormStages, type StormStage } from "./place-claim-fixture.js";
import { seatedCharter, type SeatedCharter } from "./charter-fixture.js";
import * as ed from "@noble/ed25519";

const emptyBoard = (): LarDoc => ({ schemaVersion: "lar/1", tiddlers: {} } as unknown as LarDoc);
const KEY = (charter: SeatedCharter, hearth: string) => ({ hearth, nexus: hex(utf8Bytes(charter.aid)), route: "/flow", tier: "floor" as const });

/** The quorum's carry over one stage's signer, with the place's own carrier seal made by that signer. */
async function carryOf(charter: SeatedCharter, stage: StormStage): Promise<CarriageEntry> {
  const hands = await charter.signers();
  const seal = await signCarrierContract(stage.signerKey, charter.head.epochCid, async (bytes) => hex(await ed.signAsync(bytes, stage.place.signer)));
  return signCarriageQuorum({ nym: stage.signerKey, action: "carry", parents: [], sealEpochCid: charter.head.epochCid }, hands, seal);
}

type Item = { readonly kind: "claim" | "kel" | "carry"; readonly stage: number; readonly write: (d: LarDoc) => void };
async function itemsOf(charter: SeatedCharter, stages: readonly StormStage[]): Promise<Item[]> {
  const items: Item[] = [];
  for (const [i, stage] of stages.entries()) {
    const carry = await carryOf(charter, stage);
    items.push({ kind: "claim", stage: i, write: (d) => writePlaceFloorPin(d, stage.claim) });
    items.push({ kind: "kel", stage: i, write: (d) => { for (const event of stage.place.chain) writePlaceKelEvent(d, stage.place.aid, event); } });
    items.push({ kind: "carry", stage: i, write: (d) => writeCarriageEntry(d, carry) });
  }
  return items;
}

/** One refresh, as a reader's pull does it: fold the carrier set off the board's own acts, then file every claim through the one fold. */
async function refresh(charter: SeatedCharter, board: LarDoc, index: HearthPinIndex): Promise<void> {
  const carriers = await foldCarrierSet(carriageEntriesFromBoard(board), charter.roster);
  filePlaceFloorPins(index, placeFloorPinsFromBoard(board), {
    nexusHex: hex(utf8Bytes(charter.aid)), route: "/flow", kelRows: placeKelRowsFromBoard(board), standing: { via: "carrier", carriers },
  });
}
const stands = (charter: SeatedCharter, index: HearthPinIndex, stages: readonly StormStage[], at: number): { served: unknown; head: string | undefined; seq: number | undefined } => {
  const key = KEY(charter, stages[at]!.signerKey);
  return { served: index.get(key), head: index.standingOf(key)?.head, seq: index.standingOf(key)?.seq };
};

describe("the storm witness: rotation plus carry under reorder, restart and offline gaps", () => {
  test("the same evidence yields the same head in every arrival order; the head never moves backward; a restart converges", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 41 });
    const stages = await stormStages(charter.aid, 4);
    const items = await itemsOf(charter, stages);
    const finalHead = headOf(stages[3]!.place).headDigest;
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const next = prng(seed);
      const order = shuffled(items, next);
      const board = emptyBoard();
      let index = hearthPinIndex();
      let floor = -1;
      for (let at = 0; at < order.length;) {
        const batch = order.slice(at, at + 1 + Math.floor(next() * 4));
        at += batch.length;
        for (const item of batch) item.write(board);
        const roll = next();
        if (roll < 0.25) continue;                                     // an offline gap: this refresh never ran
        if (roll > 0.8) index = hearthPinIndex();                      // a restart: the index is gone, the board stands
        await refresh(charter, board, index);
        // The reader serves the pin of the stage whose signer name the dial carries; the newest stage filed is the standing one.
        for (let s = 3; s >= 0; s--) {
          const held = index.standingOf(KEY(charter, stages[s]!.signerKey));
          if (held) { if (roll <= 0.8) expect(held.seq, `seed ${String(seed)} moved the head backward`).toBeGreaterThanOrEqual(floor); floor = Math.max(floor, held.seq); break; }
        }
      }
      await refresh(charter, board, index);
      const final = stands(charter, index, stages, 3);
      expect(final.head, `seed ${String(seed)}`).toBe(finalHead);
      expect(final.served).toEqual(stages[3]!.pin);
      expect(index.forks()).toEqual([]);
      // The superseded signers answer nothing: no stage but the last serves a pin under its own name.
      for (let s = 0; s < 3; s++) expect(index.get(KEY(charter, stages[s]!.signerKey))).toBeNull();
      // A restart over the finished board converges on the same head.
      const again = hearthPinIndex();
      await refresh(charter, board, again);
      expect(stands(charter, again, stages, 3).head).toBe(finalHead);
      outcomes.add(`${String(final.head)}|${JSON.stringify(final.served)}`);
    }
    expect([...outcomes]).toHaveLength(1);                             // no arrival winner across all twelve orders
  }, 240_000);

  test("SILENT-ZERO: an empty board serves nothing and shows no fork, and the same instrument reads the known-positive rotation and carry", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 41 });
    const stages = await stormStages(charter.aid, 4);
    const empty = hearthPinIndex();
    await refresh(charter, emptyBoard(), empty);
    expect(stands(charter, empty, stages, 3).served).toBeNull();
    expect(empty.forks()).toEqual([]);
    // the known positive, through the same refresh: all four heads, claimed and carried, serve the last
    const board = emptyBoard();
    for (const item of await itemsOf(charter, stages)) item.write(board);
    const positive = hearthPinIndex();
    await refresh(charter, board, positive);
    expect(stands(charter, positive, stages, 3).head).toBe(headOf(stages[3]!.place).headDigest);
  });

  test("a rotation whose carry has not arrived serves the older head, as of the last sync; the carry moves it", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 41 });
    const stages = await stormStages(charter.aid, 2);
    const items = await itemsOf(charter, stages);
    const board = emptyBoard();
    for (const item of items.filter((i) => !(i.kind === "carry" && i.stage === 1))) item.write(board);
    const index = hearthPinIndex();
    await refresh(charter, board, index);
    expect(stands(charter, index, stages, 0).seq).toBe(0);
    expect(stands(charter, index, stages, 1).served).toBeNull();     // the new signer is carried by no counted act yet
    items.find((i) => i.kind === "carry" && i.stage === 1)!.write(board);
    await refresh(charter, board, index);
    expect(stands(charter, index, stages, 1).seq).toBe(1);
  });

  test("a planted fork (a sibling rotation, claimed and carried) surfaces in any order and holds the settled ancestor", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 41 });
    const stages = await stormStages(charter.aid, 2);
    const sibling = rotatePlace(stages[0]!.place, 1);
    const siblingPin = floorPinFor(charter.aid, "/flow", 77);
    const twin: StormStage = { place: sibling, pin: siblingPin, claim: await claimAt(sibling, siblingPin), signerKey: headOf(sibling).signerKey };
    const all = [...stages, twin];
    const items = [...await itemsOf(charter, all)];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const board = emptyBoard();
      const index = hearthPinIndex();
      for (const item of shuffled(items, prng(seed))) { item.write(board); await refresh(charter, board, index); }
      expect(index.forks().length).toBeGreaterThan(0);
      seen.add(JSON.stringify({ forks: index.forks(), at: index.standingOf(KEY(charter, stages[0]!.signerKey))?.head ?? null }));
    }
    expect(seen.size).toBe(1);
  }, 240_000);
});
