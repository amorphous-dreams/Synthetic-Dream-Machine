/** The CLI owns its terminal read-back; a standing daemon's harness seat grants no waiver here. */
import { afterEach, expect, test, vi } from "vitest";
import { seatReadBackStandIn } from "@lararium/node";
import { coldKeyCode } from "@lararium/mesh";
import { sealedAct } from "../src/sealed-act-door.js";
import { readBackStandsIn } from "../src/sealed-rows.js";
import { CardReadBackRefused, readBack } from "../src/cold-card-readback.js";

// Setup loaded the command graph already; reload it so this test owns the modeled custody door.
vi.hoisted(() => { vi.resetModules(); });
// Model the standing daemon's answer, which the old CLI path used instead of its own flag.
vi.mock("../src/sealed-act-door.js", () => ({ sealedAct: vi.fn() }));
afterEach(() => { seatReadBackStandIn(false); vi.clearAllMocks(); });

test("a harness-seated CLI reads back beside an unseated daemon without asking its custody door", async () => {
  vi.mocked(sealedAct).mockResolvedValue({ standIn: false });
  seatReadBackStandIn(true);
  expect(await readBackStandsIn()).toBe(true);
  const seed = new Uint8Array(32).fill(7);
  const code = coldKeyCode(seed);
  const cards = await readBack({ command: null, positional: [], options: {}, flags: { json: true } }, [{ chair: "test chair", seed, digest: "test digest" }], 1, "");
  expect(cards[0]?.["code"]).toBe(code);
  expect(seed.every((byte) => byte === 0)).toBe(true);
  expect(sealedAct).not.toHaveBeenCalled();
});

test("without a CLI seat JSON card output refuses and clears the seed even if the daemon would waive read-back", async () => {
  vi.mocked(sealedAct).mockResolvedValue({ standIn: true });
  seatReadBackStandIn(false);
  expect(await readBackStandsIn()).toBe(false);
  const seed = new Uint8Array(32).fill(7);
  await expect(readBack({ command: null, positional: [], options: {}, flags: { json: true } }, [{ chair: "test chair", seed, digest: "test digest" }], 1, ""))
    .rejects.toBeInstanceOf(CardReadBackRefused);
  expect(seed.every((byte) => byte === 0)).toBe(true);
  expect(sealedAct).not.toHaveBeenCalled();
});
