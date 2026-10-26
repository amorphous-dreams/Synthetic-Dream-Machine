/**
 * place-card — a joinee reaches no place-arm presentation cardless or on another seed's card. Measured: the place founding
 * (`runInit` without an admit) persists the card from `foundThePlace`; the admit branch founded no place and persisted none,
 * so a joinee at the floor met `loadVesselCard`'s bare throw. Reds: no card refuses `absent` by name; a card minted from another
 * seed refuses `not-own-seed` and is never replaced. Controls: `ensurePlaceCard` mints one from the vessel's own seed, then keeps
 * it, and the place arm's card verifies; the admit branch of `runInit` calls it.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { mintPlaceCard } from "@lararium/keyhive";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { generateOrLoadVesselIdentity, persistVesselCard } from "../src/node-vessel-identity.js";
import { ensurePlaceCard, PlaceCardRefused, requirePlaceCardOfOwnSeed } from "../src/place-card.js";
import { sealTestCustody } from "./found-route.js";

const root = mkdtempSync(join(tmpdir(), "lar-place-card-"));
afterAll(async () => {
  await withLarRoot(root, async () => { const h = seatedCustody(); if (h) { await h.lock(); unseatCustody(h); } });
  rmSync(root, { recursive: true, force: true });
});

describe("the place card", () => {
  test("RED: a cardless joinee refuses `absent`; CONTROL: its own-seed card is minted, kept and verifies", async () => {
    await withLarRoot(root, async () => {
      await sealTestCustody();
      await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
      await expect(requirePlaceCardOfOwnSeed()).rejects.toMatchObject({ why: "absent" });
      expect(await ensurePlaceCard()).toBe("minted");
      expect(await requirePlaceCardOfOwnSeed()).toContain("{");
      expect(await ensurePlaceCard(), "a card at rest of its own seed is kept").toBe("kept");
    });
  }, 120_000);

  test("RED: a card of another seed refuses `not-own-seed` and is never replaced", async () => {
    const stranger = await mintPlaceCard({ vesselSeed: new Uint8Array(32).fill(77) });
    await withLarRoot(root, async () => {
      await persistVesselCard(stranger.contactCardJson);
      await expect(requirePlaceCardOfOwnSeed()).rejects.toMatchObject({ why: "not-own-seed" });
      await expect(ensurePlaceCard()).rejects.toBeInstanceOf(PlaceCardRefused);
    });
  }, 120_000);

  test("RED: a place slot holding the FACE's card refuses `not-own-seed`; the cure lives at the place founding, so the slot is never overwritten with it", async () => {
    const { loadVesselCard } = await import("../src/node-vessel-identity.js");
    const faceAtomSeed = new Uint8Array(32).fill(91);   // a face's atom is not the vessel's seed
    const faceCard = await mintPlaceCard({ vesselSeed: faceAtomSeed });
    await withLarRoot(root, async () => {
      await persistVesselCard(faceCard.contactCardJson);
      await expect(requirePlaceCardOfOwnSeed()).rejects.toMatchObject({ why: "not-own-seed" });
      await expect(ensurePlaceCard()).rejects.toMatchObject({ why: "not-own-seed" });
      expect(await loadVesselCard(), "the refusal leaves the slot as it stood").toBe(faceCard.contactCardJson);
    });
  }, 120_000);

  test("CONTROL: the admit branch of runInit mints the card before it lands the binding", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "commands", "init.ts"), "utf8");
    const admit = src.indexOf("const payload = opts.admitPayload;");
    expect(admit).toBeGreaterThan(0);
    expect(src.indexOf("await ensurePlaceCard();", admit)).toBeGreaterThan(admit);
    expect(src.indexOf("await ensurePlaceCard();", admit)).toBeLessThan(src.indexOf("runApplyAdmitPayload({", admit));
  });
});
