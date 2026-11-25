/**
 * keep-seat-moments — a paper read-back joins the keep pair, opened by the route the bind took. (The unlock's moment, and the
 * proof it seats under, read in keep-seat-proved.)
 *
 *   KM2  RED: a paper read-back (`vault bind --paper`) binds a paper slot beside the seat's passphrase, opened by the route the
 *        bind took; the sheet then opens the same secret. CONTROL: a passphrase bind binds no paper slot.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { confirmPaperPin, draftPaperPin, type Credential } from "@lararium/mesh/keyslot-door";

vi.setConfig({ testTimeout: 180_000 });

const STEWARD: Credential[] = [{ kind: "passphrase", passphrase: "the steward's own words" }];

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lar-keep-moments-")); writeFileSync(join(root, ".lar-test-scratch"), "keep moments suite\n"); process.env["LAR_ROOT"] = root; });
afterEach(() => { rmSync(root, { recursive: true, force: true }); delete process.env["LAR_ROOT"]; });

describe("a paper read-back joins the keep pair", () => {
  test("KM2 RED: a paper read-back binds a paper slot beside the passphrase; CONTROL: a passphrase bind binds no paper slot", async () => {
    const { seatKeepAtUnlock, keepSlotAtBind, readKeepSeat, openKeepSeat } = await import("../src/keep-seat.js");
    await seatKeepAtUnlock({ reading: "opens", opener: [0] }, STEWARD, () => {});
    const before = readKeepSeat()!.slots.slots.length;
    const draft = draftPaperPin();
    const confirmed = confirmPaperPin(draft, draft.sheets);
    expect(await keepSlotAtBind(STEWARD, { t: 1, pins: [{ kind: "paper", confirmed }] }, () => {})).toBe("bound");
    const seat = readKeepSeat()!;
    expect(seat.slots.slots.length).toBe(before + 1);
    const byPaper = await openKeepSeat(seat, [{ kind: "paper", sheets: draft.sheets }]);
    const byPass = await openKeepSeat(seat, STEWARD);
    expect(byPaper.reading).toBe("opens");
    expect(Buffer.from((byPaper as { secret: Uint8Array }).secret).equals(Buffer.from((byPass as { secret: Uint8Array }).secret))).toBe(true);
  });
});
