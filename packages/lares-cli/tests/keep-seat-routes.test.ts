/**
 * keep-seat-routes — the keep seats under EVERY route an act proved, a proved route joins a resting keep, a re-seat names the
 * routes that leave, and a t-of-n custody slot seats at what the act holds and says so.
 *
 * Two custody routes (a passphrase, a paper sheet) each open the house. A keep seated under one alone flip-flops: an unlock under
 * the other warns, a re-seat under it drops the first. So an act that proved several routes seats them all, and one that proved a
 * route the resting keep lacks binds it beside the route that opens the keep.
 *
 *   KJ1  RED: custody slots opened by every typed credential read whole (`slotsOpenedBy`), each with its threshold and pin count.
 *   KJ2  RED: an unlock that proved the passphrase and the paper sheet, over a keep seated under the passphrase alone, JOINS the
 *        sheet: the keep then opens under the sheet alone, and the unlock says so.
 *   KJ3  RED: a re-seat under two proved routes seats both, and names the routes of the old keep that leave.
 *   KJ4  RED: a 2-of-3 custody slot opened by two typed pins seats a 2-of-2 keep slot over them and says why (the act holds only
 *        the pins it typed).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bindSlot,
  confirmHeldPaper,
  confirmPaperPin,
  draftPaperPin,
  nobleKdf,
  slotsOpenedBy,
  type Credential,
} from "@lararium/mesh/keyslot-door";
import { mintTreeKey } from "@lararium/mesh/tree-key-door";

vi.setConfig({ testTimeout: 240_000 });

const PW: Credential = { kind: "passphrase", passphrase: "the steward's long passphrase" };
let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lar-keep-routes-")); writeFileSync(join(root, ".lar-test-scratch"), "keep routes suite\n"); process.env["LAR_ROOT"] = root; });
afterEach(() => { rmSync(root, { recursive: true, force: true }); delete process.env["LAR_ROOT"]; });

const sheet = () => { const d = draftPaperPin(); confirmPaperPin(d, d.sheets); return d.sheets; };

describe("the keep seats under every proved route", () => {
  test("KJ1 RED: every slot the typed credentials open reads whole", async () => {
    const sheets = sheet();
    const key = mintTreeKey();
    let tree = await bindSlot(null, key, { t: 1, pins: [{ kind: "passphrase", passphrase: (PW as { passphrase: string }).passphrase }] }, nobleKdf);
    tree = await bindSlot(tree, key, { t: 1, pins: [{ kind: "paper", confirmed: confirmHeldPaper(sheets) }] }, nobleKdf);
    const proved = await slotsOpenedBy(tree, [PW, { kind: "paper", sheets }], nobleKdf);
    expect(proved.map((p) => ({ opener: p.opener, t: p.t, pins: p.pins }))).toEqual([{ opener: [0], t: 1, pins: 1 }, { opener: [1], t: 1, pins: 1 }]);
  });

  test("KJ2 RED: a proved sheet joins a keep seated under the passphrase", async () => {
    const seats = await import("../src/keep-seat.js");
    const sheets = sheet();
    const creds: Credential[] = [PW, { kind: "paper", sheets }];
    await seats.seatKeepAtUnlock({ reading: "opens", opener: [0], proved: [{ opener: [0], t: 1, pins: 1 }] }, [PW], () => {});
    const said: string[] = [];
    expect(await seats.seatKeepAtUnlock({ reading: "opens", opener: [0], proved: [{ opener: [0], t: 1, pins: 1 }, { opener: [1], t: 1, pins: 1 }] }, creds, (l) => said.push(l))).toBe("joined");
    expect((await seats.openKeepSeat(seats.readKeepSeat()!, [{ kind: "paper", sheets }])).reading).toBe("opens");
    expect(said.join("\n")).toMatch(/join/);
  });

  test("KJ3 RED: a re-seat under two proved routes seats both and names the routes that leave", async () => {
    const seats = await import("../src/keep-seat.js");
    await seats.seatKeepAtUnlock({ reading: "opens", opener: [0], proved: [{ opener: [0], t: 1, pins: 1 }] }, [PW], () => {});
    const sheets = sheet();
    const NEW: Credential = { kind: "passphrase", passphrase: "the steward's newer long passphrase" };
    const said: string[] = [];
    expect(await seats.reseatKeepPair([[NEW], [{ kind: "paper", sheets }]], (l) => said.push(l))).toBe(true);
    expect((await seats.openKeepSeat(seats.readKeepSeat()!, [NEW])).reading).toBe("opens");
    expect((await seats.openKeepSeat(seats.readKeepSeat()!, [{ kind: "paper", sheets }])).reading).toBe("opens");
    expect(said.join("\n")).toMatch(/leave.*passphrase/s);
  });

  test("KJ4 RED: a 2-of-3 custody slot opened by two typed pins seats 2-of-2 and says why", async () => {
    const seats = await import("../src/keep-seat.js");
    const sheets = sheet();
    const creds: Credential[] = [PW, { kind: "paper", sheets }];
    const said: string[] = [];
    expect(await seats.seatKeepAtUnlock({ reading: "opens", opener: [0, 1], proved: [{ opener: [0, 1], t: 2, pins: 3 }] }, creds, (l) => said.push(l))).toBe("seated");
    expect(seats.readKeepSeat()!.slots.slots[0]!.t).toBe(2);
    expect(said.join("\n")).toMatch(/2-of-3/);
  });
});
