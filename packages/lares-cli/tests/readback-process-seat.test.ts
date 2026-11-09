/** The CLI owns its terminal read-back; a standing daemon's harness seat grants no waiver here. */
import { afterEach, expect, test, vi } from "vitest";
import { seatReadBackStandIn } from "@lararium/node";
import { coldKeyCode } from "@lararium/mesh";
import { sealedAct } from "../src/sealed-act-door.js";
import { readBackStandsIn } from "../src/sealed-rows.js";
import { CardReadBackRefused, readBack } from "../src/cold-card-readback.js";
import * as prompt from "../src/prompt-secret.js";

// Setup loaded the command graph already; reload it so this test owns the modeled custody door.
vi.hoisted(() => { vi.resetModules(); });
// Model the standing daemon's answer, which the old CLI path used instead of its own flag.
vi.mock("../src/sealed-act-door.js", () => ({ sealedAct: vi.fn() }));
afterEach(() => { seatReadBackStandIn(false); vi.restoreAllMocks(); });

test("terminal read-back names faults without echoing input and accepts the card", async () => {
  seatReadBackStandIn(false);
  vi.spyOn(prompt, "canPromptSecret").mockReturnValue(true);
  const secret = vi.spyOn(prompt, "promptSecret");
  const seed = new Uint8Array(32).fill(7);
  const code = coldKeyCode(seed);
  const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  for (const [bad, reason] of [["abc", "3 of 72 characters"], ["z".repeat(72), "a character outside 0-9 a-f"], ["0".repeat(72), "a typo somewhere (checksum)"], [coldKeyCode(new Uint8Array(32).fill(8)), "reads as another card"]]) {
    secret.mockResolvedValueOnce(bad!);
    if (bad!.length < 72) secret.mockResolvedValueOnce(""); // an empty line ends a short attempt
    secret.mockResolvedValueOnce(code);
    await readBack({ command: null, positional: [], options: {}, flags: {} }, [{ chair: "test chair", seed: seed.slice(), digest: "x" }], 1, "");
    const lines = output.mock.calls.map((c) => String(c[0])).join("");
    expect(lines).toContain(reason);
    expect(lines).not.toContain(bad);
    output.mockClear();
  }
  expect(secret.mock.calls[0]?.[0]).toContain("three code lines (dashes and spaces optional), not the confirm words; the input stays hidden");
});

test("multiple cards announce their order", async () => {
  seatReadBackStandIn(true);
  const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  await readBack({ command: null, positional: [], options: {}, flags: {} }, ["first", "second"].map((chair) => ({ chair, seed: new Uint8Array(32).fill(7), digest: "x" })), 1, "");
  expect(String(output.mock.calls[0]?.[0])).toContain("2 cards print in order: first, second");
});

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

test("one attempt gathers the card's three lines, typed or pasted one per line, and a one-line paste reads whole", async () => {
  seatReadBackStandIn(false);
  vi.spyOn(prompt, "canPromptSecret").mockReturnValue(true);
  const secret = vi.spyOn(prompt, "promptSecret");
  const seed = new Uint8Array(32).fill(7);
  const code = coldKeyCode(seed);
  const hex = code.replace(/[\s-]/g, "");
  const lines = [hex.slice(0, 24), hex.slice(24, 48), hex.slice(48)].map((l) => l.replace(/(.{4})(?=.)/g, "$1-"));
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  // three lines, one prompt each, inside ONE attempt
  for (const line of lines) secret.mockResolvedValueOnce(line);
  await readBack({ command: null, positional: [], options: {}, flags: {} }, [{ chair: "place", seed: seed.slice(), digest: "x" }], 0, "");
  expect(secret).toHaveBeenCalledTimes(3);
  secret.mockReset();
  // the three lines on one line, spaces between
  secret.mockResolvedValueOnce(lines.join(" "));
  await readBack({ command: null, positional: [], options: {}, flags: {} }, [{ chair: "place", seed: seed.slice(), digest: "x" }], 0, "");
  expect(secret).toHaveBeenCalledTimes(1);
});
