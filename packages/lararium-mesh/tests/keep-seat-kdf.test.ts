/**
 * keep-seat-kdf — the keep seat's passphrase slot derives at no less than the custody passphrase's production cost.
 *
 * The wrapped keep secret rides the keep's REMOTE, so its passphrase slot invites offline guessing: each derivation must cost
 * at least what a face's custody passphrase costs in production (keyslot's one scrypt constant), and each slot carries its own
 * random salt. The paper slot inherits its sheet's entropy and derives through no passphrase KDF.
 *
 *   KK1  RED: every derivation a keep seat's mint and open run receives a cost equal to or above the custody slot's, at or
 *        above the production floor (N 2^17, r 8, p 1, 32 bytes). CONTROL: the custody slot's own derivation reads that floor.
 *   KK2  RED: two seats minted under one passphrase carry distinct salts and distinct public halves.
 *   KK3  RED: a paper slot bound beside the passphrase opens the same secret, and derives through no passphrase KDF.
 *   KK4  RED: the remote-carried passphrase slot costs MORE than custody: its route first stretches at the pinned remote cost
 *        (N 2^18, r 8, p 2: 256 MiB of working set, the most a laptop and a browser tab both hold), then derives at custody's
 *        own, so a guess against the remote copy pays both. CONTROL: the custody slot derives at custody's cost alone.
 */
import { describe, expect, test, vi } from "vitest";
import { bindSlot, confirmPaperPin, draftPaperPin, mintKdfPort, nobleKdf, type ScryptCost } from "../src/keyslot.js";
import { mintTreeKey } from "../src/tree-key.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";

vi.setConfig({ testTimeout: 120_000 });

const FLOOR = { N: 1 << 17, r: 8, p: 1, dkLen: 32 };
const PASS = { kind: "passphrase", passphrase: "correct horse battery staple" } as const;

function recordingPort(): { port: ReturnType<typeof mintKdfPort>; costs: ScryptCost[]; salts: string[] } {
  const costs: ScryptCost[] = [];
  const salts: string[] = [];
  const port = mintKdfPort(async (password, salt, cost) => {
    costs.push(cost); salts.push(Buffer.from(salt).toString("hex"));
    return scryptAsync(password, salt, { N: cost.N, r: cost.r, p: cost.p, dkLen: cost.dkLen });
  });
  return { port, costs, salts };
}

const atLeast = (c: ScryptCost, floor: { N: number; r: number; p: number; dkLen: number }): boolean => c.N >= floor.N && c.r >= floor.r && c.p >= floor.p && c.dkLen >= floor.dkLen;

describe("the keep seat's passphrase slot costs what custody costs", () => {
  test("KK1 RED: every keep derivation receives at least the custody slot's production cost", async () => {
    const custody = recordingPort();
    await bindSlot(null, mintTreeKey(), { t: 1, pins: [PASS] }, custody.port);
    expect(custody.costs.length, "CONTROL: the custody slot derived once").toBe(1);
    expect(atLeast(custody.costs[0]!, FLOOR), "CONTROL: the custody slot derives at the production floor").toBe(true);

    const { mintKeepSeat, openKeepSecret } = await import("../src/keep-seat.js");
    const keep = recordingPort();
    const { seat } = await mintKeepSeat({ t: 1, pins: [PASS] }, keep.port);
    const opened = await openKeepSecret(seat, [PASS], keep.port);
    expect(opened.reading).toBe("opens");
    expect(keep.costs.length, "the keep's mint and open each derived").toBeGreaterThanOrEqual(2);
    for (const c of keep.costs) {
      expect(atLeast(c, custody.costs[0]!), `a keep derivation ran below the custody cost: ${JSON.stringify(c)}`).toBe(true);
      expect(atLeast(c, FLOOR), `a keep derivation ran below the production floor: ${JSON.stringify(c)}`).toBe(true);
    }
  });

  test("KK2 RED: two seats under one passphrase carry their own random salts and their own pairs", async () => {
    const { mintKeepSeat } = await import("../src/keep-seat.js");
    const a = recordingPort(), b = recordingPort();
    const { seat: sa } = await mintKeepSeat({ t: 1, pins: [PASS] }, a.port);
    const { seat: sb } = await mintKeepSeat({ t: 1, pins: [PASS] }, b.port);
    expect(a.salts[0]).not.toBe(b.salts[0]);
    expect(Buffer.from(sa.publicKey).equals(Buffer.from(sb.publicKey))).toBe(false);
  });

  test("KK3 RED: a paper slot beside the passphrase opens the same secret, through no passphrase derivation", async () => {
    const { mintKeepSeat, bindKeepSlot, openKeepSecret } = await import("../src/keep-seat.js");
    const { seat } = await mintKeepSeat({ t: 1, pins: [PASS] }, nobleKdf);
    const draft = draftPaperPin();
    const confirmed = confirmPaperPin(draft, draft.sheets);
    const withPaper = await bindKeepSlot(seat, [PASS], { t: 1, pins: [{ kind: "paper", confirmed }] }, nobleKdf);
    expect(withPaper.reading).toBe("bound");
    const seated = (withPaper as { seat: typeof seat }).seat;
    const byPass = await openKeepSecret(seated, [PASS], nobleKdf);
    const paper = recordingPort();
    const byPaper = await openKeepSecret(seated, [{ kind: "paper", sheets: draft.sheets }], paper.port);
    expect(byPaper.reading).toBe("opens");
    expect(paper.costs, "the paper slot derives through no passphrase KDF").toEqual([]);
    expect(Buffer.from((byPaper as { secret: Uint8Array }).secret).equals(Buffer.from((byPass as { secret: Uint8Array }).secret))).toBe(true);
  });

  test("KK4 RED: the keep's passphrase route stretches at the pinned remote cost before custody's own", async () => {
    const custody = recordingPort();
    await bindSlot(null, mintTreeKey(), { t: 1, pins: [PASS] }, custody.port);
    expect(custody.costs, "CONTROL: custody derives at its cost alone").toEqual([FLOOR]);
    const { mintKeepSeat } = await import("../src/keep-seat.js");
    const keep = recordingPort();
    await mintKeepSeat({ t: 1, pins: [PASS] }, keep.port);
    const REMOTE = { N: 1 << 18, r: 8, p: 2, dkLen: 32 };
    expect(keep.costs.map((c) => ({ ...c })), "the keep's route stretches at the remote cost, then derives at custody's").toEqual([REMOTE, FLOOR]);
    expect(REMOTE.N * REMOTE.r * REMOTE.p).toBeGreaterThan(FLOOR.N * FLOOR.r * FLOOR.p);
    expect(128 * REMOTE.N * REMOTE.r, "the working set stays at 256 MiB").toBe(256 * 1024 * 1024);
  });
});
