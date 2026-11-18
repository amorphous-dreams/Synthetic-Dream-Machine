/** Once the read-back confirms a cold-key card, the card's printed lines leave the terminal (a paste of the scrollback never carries them). */
import { afterEach, expect, test, vi } from "vitest";
import { seatReadBackStandIn } from "@lararium/node";
import { coldKeyCardLines, coldKeyCode, COLD_KEY_CARD_DEFAULT_FIELDS } from "@lararium/mesh";
import { readBack } from "../src/cold-card-readback.js";
import * as prompt from "../src/prompt-secret.js";

afterEach(() => { seatReadBackStandIn(false); vi.restoreAllMocks(); });

const ARGS = { command: null, positional: [], options: {}, flags: {} };
const seed = (): Uint8Array => new Uint8Array(32).fill(7);

async function run(isTTY: boolean): Promise<string> {
  seatReadBackStandIn(false);
  vi.spyOn(prompt, "canPromptSecret").mockReturnValue(true);
  vi.spyOn(prompt, "promptSecret").mockResolvedValue(coldKeyCode(seed()));
  const was = process.stdout.isTTY;
  Object.defineProperty(process.stdout, "isTTY", { value: isTTY, configurable: true });
  const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await readBack(ARGS, [{ chair: "test chair", seed: seed(), digest: "x" }], 1, "");
    return out.mock.calls.map((c) => String(c[0])).join("");
  } finally { Object.defineProperty(process.stdout, "isTTY", { value: was, configurable: true }); }
}

test("on a terminal the confirmed card's lines are erased: cursor up over exactly the printed lines, then erase", async () => {
  const shown = await run(true);
  const printed = 1 + coldKeyCardLines(seed(), { purpose: "the next key of one chair; it rolls the charter once", chairLabel: "test chair", generation: 1, charterFingerprint: "" }, ["purpose", "chairLabel", "generation"]).length;
  expect(shown).toContain(`\u001b[${printed}A\u001b[0J`);
});

test("control: with no terminal on stdout, nothing is erased and one line reminds the person to clear the scrollback", async () => {
  const shown = await run(false);
  expect(shown).not.toContain("\u001b[");
  expect(shown).toContain("clear your scrollback");
});
