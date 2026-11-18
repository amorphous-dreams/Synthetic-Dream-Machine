/**
 * keep-seat-moments — the keep pair seats at the moments the human's routes stand in hand, and never otherwise.
 *
 *   KM1  RED: the unlock seats the keep pair under its passphrase where none rests, and says so; a seat that rests stays; a
 *        route with no passphrase seats nothing. CONTROL: the seated pair opens under that passphrase and no other.
 *   KM2  RED: a paper read-back (`vault bind --paper`) binds a paper slot beside the seat's passphrase, opened by the route the
 *        bind took; the sheet then opens the same secret. CONTROL: a passphrase bind binds no keep slot.
 *   KM3  RED: both unlock roads (a standing vessel, and none) and both bind roads (the vessel's and a face's) call the moments.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { confirmPaperPin, draftPaperPin, type Credential } from "@lararium/mesh";

vi.setConfig({ testTimeout: 120_000 });

const STEWARD: Credential[] = [{ kind: "passphrase", passphrase: "the steward's own words" }];
const OTHER: Credential[] = [{ kind: "passphrase", passphrase: "somebody else entirely" }];

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lar-keep-moments-")); writeFileSync(join(root, ".lar-test-scratch"), "keep moments suite\n"); process.env["LAR_ROOT"] = root; });
afterEach(() => { rmSync(root, { recursive: true, force: true }); delete process.env["LAR_ROOT"]; });

describe("the keep pair seats where the human's routes stand in hand", () => {
  test("KM1 RED: the unlock seats the pair under its passphrase, once; CONTROL: it opens under that passphrase alone", async () => {
    const { seatKeepAtUnlock, readKeepSeat, openKeepSeat, keepSeatPath } = await import("../src/keep-seat.js");
    const said: string[] = [];
    expect(await seatKeepAtUnlock([{ kind: "paper", sheets: ["not a sheet"] }], (l) => said.push(l)), "a route with no passphrase seats nothing").toBe("no-passphrase");
    expect(existsSync(keepSeatPath())).toBe(false);
    expect(await seatKeepAtUnlock(STEWARD, (l) => said.push(l))).toBe("seated");
    expect(said.some((l) => /keep/.test(l)), "the unlock names the seat it made").toBe(true);
    const first = readFileSync(keepSeatPath(), "utf8");
    expect(await seatKeepAtUnlock(OTHER, () => {}), "a seat that rests stays").toBe("resting");
    expect(readFileSync(keepSeatPath(), "utf8")).toBe(first);
    const seat = readKeepSeat()!;
    expect((await openKeepSeat(seat, STEWARD)).reading).toBe("opens");
    expect((await openKeepSeat(seat, OTHER)).reading).toBe("no-slot-opens");
  });

  test("KM2 RED: a paper read-back binds a paper slot beside the passphrase; CONTROL: a passphrase bind binds none", async () => {
    const { seatKeepAtUnlock, keepSlotAtBind, readKeepSeat, openKeepSeat } = await import("../src/keep-seat.js");
    await seatKeepAtUnlock(STEWARD, () => {});
    expect(await keepSlotAtBind(STEWARD, { t: 1, pins: [{ kind: "passphrase", passphrase: "a new passphrase" }] }, () => {}), "CONTROL: a passphrase bind leaves the keep seat be").toBe("no-paper");
    expect(readKeepSeat()!.slots.slots.length).toBe(1);
    const draft = draftPaperPin();
    const confirmed = confirmPaperPin(draft, draft.sheets);
    expect(await keepSlotAtBind(STEWARD, { t: 1, pins: [{ kind: "paper", confirmed }] }, () => {})).toBe("bound");
    const seat = readKeepSeat()!;
    expect(seat.slots.slots.length).toBe(2);
    const byPaper = await openKeepSeat(seat, [{ kind: "paper", sheets: draft.sheets }]);
    const byPass = await openKeepSeat(seat, STEWARD);
    expect(byPaper.reading).toBe("opens");
    expect(Buffer.from((byPaper as { secret: Uint8Array }).secret).equals(Buffer.from((byPass as { secret: Uint8Array }).secret))).toBe(true);
  });

  test("KM3 RED: both unlock roads and both bind roads call the moments", () => {
    const vault = readFileSync(new URL("../src/commands/vault.ts", import.meta.url), "utf8");
    expect(vault.match(/seatKeepAtUnlock\(/g)?.length ?? 0, "a standing vessel's unlock and the unlock with none each seat").toBeGreaterThanOrEqual(2);
    expect(vault.match(/keepSlotAtBind\(/g)?.length ?? 0, "the vessel's bind and a face's bind each offer the keep slot").toBeGreaterThanOrEqual(2);
  });
});
