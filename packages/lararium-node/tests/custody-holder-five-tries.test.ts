/**
 * custody-holder-five-tries — the vessel's, the face's and the ward's bound each count five (operator, 2026-11-23), and the
 * refusal carries the tries left.
 *
 *   F1  the vessel unlock burns on the 5th miss and not the 4th; the right route then reads `attempts-spent`.
 *   F2  a face unlock burns on its own 5th miss and not the 4th.
 *   F3  a ward act's miss refuses `ward-no-slot-opens` carrying `attemptsLeft` and the climbing words; the 5th reads spent.
 *   (The custody door's answer carrying the count rides custody-frames.test.)
 *   CONTROL: the right route on the 4th miss's heels still opens.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ATTEMPT_BUDGET } from "@lararium/mesh/attempt-budget";
import { WardRefused } from "@lararium/mesh/ward-slots";
import { type Credential, type PinSpec, type SlotSpec } from "@lararium/mesh/keyslot-door";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder, seatFaceAutoFounder, UNLOCK_ATTEMPTS_PER_BOOT } from "../src/custody-holder.js";
import type { CustodyHomes } from "../src/vault-carriers.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 240_000 });

const pass = (passphrase: string): Credential => ({ kind: "passphrase", passphrase });
const pin = (passphrase: string): PinSpec => ({ kind: "passphrase", passphrase });
const RIGHT = "five-tries-passphrase";
const roots: string[] = [];

async function found() {
  const dir = mkdtempSync(join(tmpdir(), "lar-five-tries-"));
  roots.push(dir);
  const homes: CustodyHomes = { identity: join(dir, "identity"), storage: join(dir, "vessel"), seal: join(dir, "nexus") };
  mkdirSync(homes.identity, { recursive: true });
  const io = new FsCustodyIo(homes);
  await foundCustody({ homes, io, slots: [{ t: 1, pins: [pin(RIGHT)] }] });
  return makeCustodyHolder({ homes, io });
}
beforeEach(() => seatFaceAutoFounder((): readonly SlotSpec[] => [{ t: 1, pins: [pin(RIGHT)] }]));
let seat: SeatedScratchCustody | null = null;
afterEach(async () => {
  await seat?.drop(); seat = null;
  seatFaceAutoFounder(null);
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("five tries", () => {
  test("the node bound derives from the one constant, and counts five", () => {
    expect(UNLOCK_ATTEMPTS_PER_BOOT).toBe(ATTEMPT_BUDGET);
    expect(UNLOCK_ATTEMPTS_PER_BOOT).toBe(5);
  });

  test("F1 the vessel unlock burns on the 5th miss, not the 4th", async () => {
    const h = await found();
    for (let miss = 1; miss <= 4; miss++) expect(await h.unlock([pass(`wrong-${miss}`)])).toEqual({ reading: "no-slot-opens", attemptsLeft: 5 - miss });
    expect(h.attemptsLeft()).toBe(1);
    expect(await h.unlock([pass("wrong-5")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 0 });
    expect(await h.unlock([pass(RIGHT)])).toEqual({ reading: "attempts-spent" });
  });

  test("CONTROL: after four misses the right route still opens", async () => {
    const h = await found();
    for (let miss = 1; miss <= 4; miss++) await h.unlock([pass(`wrong-${miss}`)]);
    expect((await h.unlock([pass(RIGHT)])).reading).toBe("opens");
  });

  test("F2 a face unlock burns on its own 5th miss, not the 4th", async () => {
    seat = await seatScratchCustody("five-tries-face");
    const { holder } = seat;
    const a = await holder.foundFace({ group: personaGroupDigest("group-five-a"), slots: [{ t: 1, pins: [pin("route-a")] }] });
    await holder.lockFace(a.fcid);
    for (let miss = 1; miss <= 4; miss++) {
      expect(await holder.unlockFace({ fcid: a.fcid }, [pass(`wrong-${miss}`)])).toEqual({ reading: "no-slot-opens", fcid: a.fcid, attemptsLeft: 5 - miss });
    }
    expect((await holder.unlockFace({ fcid: a.fcid }, [pass("route-a")])).reading).toBe("opens");
    await holder.lockFace(a.fcid);
    expect(await holder.unlockFace({ fcid: a.fcid }, [pass("wrong-5")])).toEqual({ reading: "no-slot-opens", fcid: a.fcid, attemptsLeft: 0 });
    // The sixth try, the right route among it, meets a spent bound: refused before any derivation, 0 left.
    expect(await holder.unlockFace({ fcid: a.fcid }, [pass("route-a")])).toEqual({ reading: "attempts-spent", fcid: a.fcid, attemptsLeft: 0 });
    expect(holder.attemptsLeft()).toBe(ATTEMPT_BUDGET);   // the face's count stands apart from the vessel's
  });

  test("F3 a ward miss carries attemptsLeft and the climbing words; the 5th reads spent", async () => {
    seat = await seatScratchCustody("five-tries-ward");
    const { holder } = seat;
    const a = await holder.foundFace({ group: personaGroupDigest("group-five-w"), slots: [{ t: 1, pins: [pin("route-w")] }] });
    const refusals: WardRefused[] = [];
    for (let miss = 1; miss <= 5; miss++) {
      const e = await holder.withWardKey({ fcid: a.fcid }, [pass(`wrong-${miss}`)], async () => "signed").catch((x: unknown) => x);
      expect(e).toBeInstanceOf(WardRefused);
      refusals.push(e as WardRefused);
    }
    expect(refusals.map((r) => r.attemptsLeft)).toEqual([4, 3, 2, 1, 0]);
    expect(refusals.slice(0, 4).map((r) => r.reading)).toEqual(Array(4).fill("ward-no-slot-opens"));
    expect(refusals[4]!.reading).toBe("ward-attempts-spent");
    expect(refusals[1]!.message).not.toMatch(/CAREFUL|LAST TRY/);
    expect(refusals[2]!.message).toMatch(/CAREFUL/);
    expect(refusals[3]!.message).toMatch(/LAST TRY/);
    expect(refusals[4]!.message).toMatch(/SPENT/);
  });
});
