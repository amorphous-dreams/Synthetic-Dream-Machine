/**
 * hearth-floor-pins, THE FLOOR CARD (carrier (c), W14): the place's signed floor pin claim and the KEL rows that fold to its
 * head, carried by the person's own hand in a device's arrival URL, and filed only against an anchor conveyed apart from it.
 *
 *   C1  CONTROL: a card reads back whole: the claim on the flow route and the KEL rows
 *   C2  a sovereign pin, a floor pin on another route, a torn claim, a stray field or a torn carriage reads no card
 *   C3  an UNANCHORED card refuses by name (a card never anchors itself); the ANCHORED genesis card files (control)
 *   C4  a FORGED card (another hand's signature, another place's claim, an anchor of another AID) refuses
 *   C5  a STALE card at a known older head files nothing and the newer head keeps serving; an OFFLINE answer names its last sync
 *   C6  a rotated place's card names the key its pointers sign under now, and a descendant card replaces live
 */
import { describe, expect, it } from "vitest";
import { hex, utf8Bytes, base64UrlEncode } from "../src/crypto.js";
import { hearthPinIndex } from "../src/admit-gate-pin.js";
import {
  fileHearthFloorCard, hearthFloorCardText, lastSyncNote, readHearthFloorCard, verifyHearthFloorCard, type HearthFloorCard,
} from "../src/hearth-floor-pins.js";
import { claimAt, floorPinFor, forgedClaim, foundPlace, headOf, rotatePlace, seedOf, type TestPlace } from "./place-claim-fixture.js";

const NEXUS = "nexus-floor-card";
const NEXUS_HEX = hex(utf8Bytes(NEXUS));
const flowPin = (fill = 5, route = "/flow") => floorPinFor(NEXUS, route, fill);
const cardOf = async (place: TestPlace, fill = 5): Promise<HearthFloorCard> =>
  Object.freeze({ claim: await claimAt(place, flowPin(fill)), kel: place.chain });
const carried = (value: unknown): string => base64UrlEncode(utf8Bytes(JSON.stringify(value)));
const key = { hearth: "http://node:8080", nexus: NEXUS_HEX, route: "/flow", tier: "floor" as const };

describe("the floor card reads", () => {
  it("C1 — CONTROL: a card reads back whole", async () => {
    const card = await cardOf(foundPlace(1));
    const text = hearthFloorCardText(card);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(readHearthFloorCard(text)).toEqual(card);
  });

  it("C2 — a sovereign pin, another floor route, a stray field or a torn carriage reads no card", async () => {
    const place = foundPlace(1);
    const card = await cardOf(place);
    const sovereign = { ...card.claim, pin: { ...card.claim.pin, tier: "sovereign" } };
    expect(readHearthFloorCard(carried({ claim: sovereign, kel: card.kel }))).toBeNull();
    expect(readHearthFloorCard(carried({ claim: await claimAt(place, flowPin(5, "/shelf")), kel: card.kel }))).toBeNull();
    expect(readHearthFloorCard(carried({ claim: { ...card.claim, pin: { ...card.claim.pin, transportKey: "00".repeat(32) } }, kel: card.kel }))).toBeNull();
    expect(readHearthFloorCard(carried({ claim: card.claim, kel: card.kel, gate: "x" }))).toBeNull();
    expect(readHearthFloorCard(carried({ claim: card.claim, kel: [] }))).toBeNull();
    expect(readHearthFloorCard(carried({ claim: card.claim, kel: [{ junk: 1 }] }))).toBeNull();
    expect(readHearthFloorCard(carried({ pin: card.claim.pin, publisher: "ab".repeat(32) }))).toBeNull();     // the old unsigned card
    expect(readHearthFloorCard(hearthFloorCardText(card).slice(0, 40))).toBeNull();
    expect(readHearthFloorCard("not a card!")).toBeNull();
    expect(readHearthFloorCard(undefined)).toBeNull();
  });
});

describe("the floor card anchors apart from itself", () => {
  it("C3 — CONTROL: the anchored genesis card files; RED: the same card with no anchor refuses place-unanchored", async () => {
    const place = foundPlace(1);
    const card = await cardOf(place);
    const ix = hearthPinIndex();
    expect(fileHearthFloorCard(ix, key.hearth, card, null)).toEqual({ filed: false, refusal: "place-unanchored" });
    expect(ix.get(key)).toBeNull();
    const ok = fileHearthFloorCard(ix, key.hearth, card, { aid: place.aid, via: "genesis" });
    expect(ok).toMatchObject({ filed: true, moved: "first", publisher: headOf(place).signerKey });
    expect(ix.get(key)).toEqual(card.claim.pin);
  });

  it("C4 — RED: a forged card refuses: another hand's signature, another place's claim, an anchor of another AID", async () => {
    const place = foundPlace(1), stranger = foundPlace(2);
    const anchor = { aid: place.aid, via: "transfer" as const };
    const honest = await cardOf(place);
    expect(verifyHearthFloorCard(honest, anchor)).toHaveProperty("publisher");
    const forged = { ...honest, claim: await forgedClaim(place, flowPin(5), seedOf(99)) };
    expect(verifyHearthFloorCard(forged, anchor)).toEqual({ refusal: "signature-refused" });
    expect(verifyHearthFloorCard(await cardOf(stranger), anchor)).toEqual({ refusal: "place-unanchored" });
    expect(verifyHearthFloorCard(honest, { aid: stranger.aid, via: "transfer" })).toEqual({ refusal: "place-unanchored" });
    expect(verifyHearthFloorCard({ claim: honest.claim, kel: [] as never }, anchor)).toEqual({ refusal: "head-unreadable" });
    expect(verifyHearthFloorCard(null, anchor)).toEqual({ refusal: "statement-malformed" });
  });
});

describe("the floor card orders by KEL descent", () => {
  it("C5 — RED: a stale card at a known older head files nothing and the newer head serves; CONTROL: the newer card files", async () => {
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const anchor = { aid: p0.aid, via: "admit" as const };
    const ix = hearthPinIndex();
    const newer = await cardOf(p1, 6), older = await cardOf(p0, 5);
    expect(fileHearthFloorCard(ix, key.hearth, newer, anchor)).toMatchObject({ filed: true, moved: "first" });
    const stale = fileHearthFloorCard(ix, key.hearth, older, anchor);
    expect(stale).toMatchObject({ filed: false, refusal: "rollback", held: headOf(p1).headDigest });
    expect(ix.get(key)).toEqual(newer.claim.pin);
  });

  it("C5 — an offline reader says which head it holds: as of its last sync", async () => {
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const ix = hearthPinIndex();
    expect(lastSyncNote(ix.standingOf(key))).toMatch(/nothing synced yet/);
    fileHearthFloorCard(ix, key.hearth, await cardOf(p0), { aid: p0.aid, via: "genesis" });
    expect(lastSyncNote(ix.standingOf(key))).toBe(`as of my last sync: place ${p0.aid.slice(0, 12)}… at KEL seq 0 (${headOf(p0).headDigest.slice(0, 12)}…)`);
    fileHearthFloorCard(ix, key.hearth, await cardOf(p1, 6), { aid: p0.aid, via: "genesis" });
    expect(lastSyncNote(ix.standingOf(key))).toContain("KEL seq 1");
  });

  it("C6 — POSITIVE: a descendant card after rotation replaces live and names the key its pointers sign under now", async () => {
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const anchor = { aid: p0.aid, via: "genesis" as const };
    const ix = hearthPinIndex();
    fileHearthFloorCard(ix, key.hearth, await cardOf(p0, 5), anchor);
    const next = fileHearthFloorCard(ix, key.hearth, await cardOf(p1, 6), anchor);
    expect(next).toMatchObject({ filed: true, moved: "replaced", publisher: headOf(p1).signerKey });
    expect(headOf(p1).signerKey).not.toBe(headOf(p0).signerKey);
    expect(ix.get(key)).toEqual(flowPin(6));
  });
});
