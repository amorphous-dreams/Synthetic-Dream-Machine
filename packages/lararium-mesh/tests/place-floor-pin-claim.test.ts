/**
 * place-floor-pin, THE FLOOR PIN CLAIM (W14): a place claims one exact gate pin at one head of its own KEL, and the reader
 * resolves the signer at that head.
 *
 * Each vector stands red against its control: a claim at the inception head reads (control), a claim at a rotated head reads
 * (known positive), and the refusals below each flip one fact of those.
 */
import { describe, expect, test } from "vitest";
import * as nobleEd from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { PLACE_FLOOR_PIN_REFUSALS, PLACE_FLOOR_PIN_ROWS, PLACE_FLOOR_PIN_ROW_CHARS, foldClaimHead, placeFloorPinsFromBoard, placeFloorPinKey, readPlaceFloorPin, writePlaceFloorPin, filePlaceFloorPins, type ClaimReadAt } from "../src/place-floor-pin.js";
import { PLACE_KEL_BOARD_ROWS, PLACE_KEL_ROW_CHARS, PLACE_KEL_PREFIX, placeKelRowsFromBoard } from "../src/place-kel-board.js";
import { hearthPinIndex } from "../src/admit-gate-pin.js";
import type { LarDoc } from "../src/base-doc.js";
import { claimAt, digests, floorPinFor, forgedClaim, foundPlace, headOf, keyOf, rotatePlace, rowsOf, seedOf } from "./place-claim-fixture.js";

const NEXUS = "nexus-claim.synthetic";
const NEXUS_HEX = hex(new TextEncoder().encode(NEXUS));
const pinAt = (fill: number, route = "/flow") => floorPinFor(NEXUS, route, fill);
const carriedBy = (...keys: string[]): ClaimReadAt["standing"] => ({ via: "carrier", carriers: new Set(keys) });
const at = (rows: unknown[], standing: ClaimReadAt["standing"], over: Partial<ClaimReadAt> = {}): ClaimReadAt =>
  ({ nexusHex: NEXUS_HEX, route: "/flow", kelRows: rows, standing, ...over });
const refusal = (r: unknown): string | null => (typeof r === "object" && r !== null && "refusal" in r ? String((r as { refusal: string }).refusal) : null);

describe("a floor pin claim reads at the head it names", () => {
  test("CONTROL: a claim at the inception head reads, under a counted carrier and under an anchor alike", async () => {
    const place = foundPlace(1);
    const claim = await claimAt(place, pinAt(10));
    const carried = readPlaceFloorPin(claim, at(rowsOf(place), carriedBy(keyOf(1 * 20 + 1))));
    expect(refusal(carried)).toBeNull();
    expect(carried).toMatchObject({ aid: place.aid, seq: 0, signerKey: keyOf(21) });
    expect(refusal(readPlaceFloorPin(claim, at(rowsOf(place), { via: "anchor", aid: place.aid })))).toBeNull();
  });

  test("POSITIVE: a claim at a ROTATED head reads, names the new signer, and carries its whole lineage", async () => {
    const place = rotatePlace(rotatePlace(foundPlace(1)));
    const claim = await claimAt(place, pinAt(11));
    const read = readPlaceFloorPin(claim, at(rowsOf(place), carriedBy(headOf(place).signerKey)));
    expect(refusal(read)).toBeNull();
    const reading = read as Exclude<typeof read, { refusal: string }>;
    expect(reading.seq).toBe(2);
    expect(reading.signerKey).toBe(headOf(place).signerKey);
    expect(reading.stand.lineage).toEqual(digests(place));
  });

  test("RED: a forged claim (a signature of another hand) refuses; its honest twin is the control", async () => {
    const place = foundPlace(1);
    const honest = await claimAt(place, pinAt(10));
    expect(refusal(readPlaceFloorPin(honest, at(rowsOf(place), { via: "anchor", aid: place.aid })))).toBeNull();
    const forged = await forgedClaim(place, pinAt(10), seedOf(99));
    expect(refusal(readPlaceFloorPin(forged, at(rowsOf(place), { via: "anchor", aid: place.aid })))).toBe("signature-refused");
    const flipped = { ...honest, sig: honest.sig.replace(/^./, (c) => (c === "0" ? "1" : "0")) };
    expect(refusal(readPlaceFloorPin(flipped, at(rowsOf(place), { via: "anchor", aid: place.aid })))).toBe("signature-refused");
  });

  test("RED: an OLD SIGNER after rotation refuses at the new head; the old signer's claim at the OLD head still reads", async () => {
    const start = foundPlace(1);
    const rotated = rotatePlace(start);
    const rows = rowsOf(rotated);
    const oldSignerAtNewHead = await forgedClaim(rotated, pinAt(12), start.signer);
    expect(refusal(readPlaceFloorPin(oldSignerAtNewHead, at(rows, { via: "anchor", aid: start.aid })))).toBe("signature-refused");
    const newSigner = await claimAt(rotated, pinAt(12));
    expect(refusal(readPlaceFloorPin(newSigner, at(rows, { via: "anchor", aid: start.aid })))).toBeNull();
    const oldClaim = await claimAt(start, pinAt(10));
    expect(refusal(readPlaceFloorPin(oldClaim, at(rows, { via: "anchor", aid: start.aid })))).toBeNull();
  });

  test("RED: a FOREIGN place refuses: no carrier signer, and an anchor that names another AID", async () => {
    const mine = foundPlace(1), theirs = foundPlace(2);
    const claim = await claimAt(theirs, pinAt(10));
    const rows = rowsOf(mine, theirs);
    expect(refusal(readPlaceFloorPin(claim, at(rows, carriedBy(headOf(mine).signerKey))))).toBe("place-uncarried");
    expect(refusal(readPlaceFloorPin(claim, at(rows, { via: "anchor", aid: mine.aid })))).toBe("place-unanchored");
    expect(refusal(readPlaceFloorPin(claim, at(rows, carriedBy(headOf(theirs).signerKey))))).toBeNull();
  });

  test("RED: a wrong Nexus, tier or route refuses by name", async () => {
    const place = foundPlace(1);
    const standing = { via: "anchor", aid: place.aid } as const;
    const claim = await claimAt(place, pinAt(10));
    expect(refusal(readPlaceFloorPin(claim, at(rowsOf(place), standing, { nexusHex: hex(new TextEncoder().encode("nexus-other")) })))).toBe("pin-other-nexus");
    expect(refusal(readPlaceFloorPin(claim, at(rowsOf(place), standing, { route: "/shelf" })))).toBe("pin-other-route");
    const sovereign = { ...claim, pin: { ...claim.pin, tier: "sovereign" } };
    expect(refusal(readPlaceFloorPin(sovereign, at(rowsOf(place), standing)))).toBe("pin-not-floor");
    expect(refusal(readPlaceFloorPin({ ...claim, pin: "nonsense" }, at(rowsOf(place), standing)))).toBe("pin-unreadable");
  });

  test("RED: a claim at a head the reader cannot fold refuses (a head its rows lack; a head naming another seq)", async () => {
    const place = rotatePlace(foundPlace(1));
    const claim = await claimAt(place, pinAt(11));
    const standing = { via: "anchor", aid: place.aid } as const;
    expect(refusal(readPlaceFloorPin(claim, at(rowsOf(foundPlace(1)), standing)))).toBe("head-unreadable");
    expect(refusal(readPlaceFloorPin(claim, at([], standing)))).toBe("head-unreadable");
    expect(refusal(readPlaceFloorPin({ ...claim, seq: 0 }, at(rowsOf(place), standing)))).toBe("head-unreadable");
    expect(refusal(readPlaceFloorPin(claim, at(rowsOf(place), standing)))).toBeNull();
  });

  test("RED: a claim past a KEL fork refuses kel-forked and names the trunk; a claim at the common ancestor still reads", async () => {
    const start = foundPlace(1);
    const left = rotatePlace(start, 0), right = rotatePlace(start, 1);
    const rows = rowsOf(left, right);
    const standing = { via: "anchor", aid: start.aid } as const;
    const onBranch = await claimAt(left, pinAt(11));
    const read = readPlaceFloorPin(onBranch, at(rows, standing));
    expect(refusal(read)).toBe("kel-forked");
    expect((read as { fork?: { aid: string; trunk: string[] } }).fork).toEqual({ aid: start.aid, trunk: [digests(start)[0]] });
    const atAncestor = await claimAt(start, pinAt(10));
    expect(refusal(readPlaceFloorPin(atAncestor, at(rows, standing)))).toBeNull();
    expect(refusal(readPlaceFloorPin(onBranch, at(rowsOf(left), standing)))).toBeNull();     // control: the same branch with no fork in view
  });

  test("RED: the old statement shape (a placeKey, no head) and stray fields read no claim", async () => {
    const place = foundPlace(1);
    const claim = await claimAt(place, pinAt(10));
    const standing = { via: "anchor", aid: place.aid } as const;
    const { aid: _a, seq: _s, head: _h, ...rest } = claim;
    expect(refusal(readPlaceFloorPin({ ...rest, placeKey: headOf(place).signerKey }, at(rowsOf(place), standing)))).toBe("statement-malformed");
    expect(refusal(readPlaceFloorPin({ ...claim, extra: 1 }, at(rowsOf(place), standing)))).toBe("statement-malformed");
    for (const junk of [null, 7, "x", [], {}]) expect(refusal(readPlaceFloorPin(junk, at(rowsOf(place), standing)))).toBe("statement-malformed");
  });

  test("the claim signs no release head and no sixth domain: its image leads with the one place floor pin duty", async () => {
    const place = foundPlace(1);
    const claim = await claimAt(place, pinAt(10));
    expect(Object.keys(claim).sort()).toEqual(["aid", "head", "kind", "pin", "seq", "sig"]);
    expect(PLACE_FLOOR_PIN_REFUSALS).toContain("kel-forked");
  });

  test("foldClaimHead walks unordered rows, ignores noise, and bounds its work", () => {
    const place = rotatePlace(rotatePlace(foundPlace(1)));
    const shuffled = rowsOf(place).reverse();
    const noise = [{ junk: true }, "text", null, ...rowsOf(foundPlace(2))];
    const folded = foldClaimHead([...noise, ...shuffled], place.aid, headOf(place).headDigest);
    expect(folded.ok && folded.head.seq).toBe(2);
    expect(foldClaimHead(shuffled, place.aid, "0".repeat(64)).ok).toBe(false);
    expect(foldClaimHead(shuffled, "z", headOf(place).headDigest).ok).toBe(false);
  });

  test("hostile boards are bounded at the board: claim rows and KEL rows cap, an oversized payload is noise, a pass folds each head once", async () => {
    const place = foundPlace(1);
    const claim = await claimAt(place, pinAt(10));
    const board = { schemaVersion: "lar/1", tiddlers: {} } as unknown as LarDoc;
    writePlaceFloorPin(board, claim);                                          // CONTROL: the honest row reads
    expect(placeFloorPinsFromBoard(board)).toHaveLength(1);
    const text = JSON.stringify(claim);
    for (let i = 0; i < PLACE_FLOOR_PIN_ROWS + 50; i++) {
      board.tiddlers[`${placeFloorPinKey(claim).replace(/[^/]+$/, "")}${String(i).padStart(4, "0")}x`] = { tiddler: { title: "x", text } } as never;
    }
    board.tiddlers[`${placeFloorPinKey(claim)}-fat`] = { tiddler: { title: "x", text: " ".repeat(PLACE_FLOOR_PIN_ROW_CHARS + 1) + text } } as never;
    expect(placeFloorPinsFromBoard(board)).toHaveLength(PLACE_FLOOR_PIN_ROWS);
    const kelBoard = { schemaVersion: "lar/1", tiddlers: {} } as unknown as LarDoc;
    const row = JSON.stringify(place.chain[0]);
    for (let i = 0; i < PLACE_KEL_BOARD_ROWS + 10; i++) kelBoard.tiddlers[`${PLACE_KEL_PREFIX}${place.aid}/${String(i).padStart(5, "0")}`] = { tiddler: { title: "x", text: row } } as never;
    kelBoard.tiddlers[`${PLACE_KEL_PREFIX}${place.aid}/fat`] = { tiddler: { title: "x", text: " ".repeat(PLACE_KEL_ROW_CHARS + 1) + row } } as never;
    expect(placeKelRowsFromBoard(kelBoard)).toHaveLength(PLACE_KEL_BOARD_ROWS);
    // A pass over the surplus files the one honest head once and reads the same in the same order.
    const index = hearthPinIndex();
    const report = filePlaceFloorPins(index, placeFloorPinsFromBoard(board), at(rowsOf(place), { via: "anchor", aid: place.aid }));
    expect(report.filed.length).toBe(PLACE_FLOOR_PIN_ROWS);
    expect(index.size).toBe(1);
  }, 120_000);
});
