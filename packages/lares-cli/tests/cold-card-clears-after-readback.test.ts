/** Once the read-back confirms a cold-key card, the card's printed lines leave the terminal (a paste of the scrollback never carries them). */
import { afterEach, expect, test, vi } from "vitest";
import { seatReadBackStandIn } from "@lararium/node";
import { coldKeyCardLines, coldKeyCode } from "@lararium/mesh";
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

/** The rows a terminal of `columns` shows for the text written before the erase: each line takes ceil(length / columns) rows, 1 at least. */
function rowsShown(written: string, columns: number): number {
  const lines = written.split("\n"); lines.pop();
  return lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / columns)), 0);
}

async function runAt(columns: number): Promise<{ written: string; up: number }> {
  seatReadBackStandIn(false);
  vi.spyOn(prompt, "canPromptSecret").mockReturnValue(true);
  const label = "x".repeat(99) + "\n"; // a 99-character label plus its closing line feed, as the hidden prompt writes
  vi.spyOn(prompt, "promptSecret").mockImplementation(async () => { process.stdout.write(label); return coldKeyCode(seed()); });
  const wasTTY = process.stdout.isTTY, wasColumns = process.stdout.columns;
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
  Object.defineProperty(process.stdout, "columns", { value: columns, configurable: true });
  const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await readBack(ARGS, [{ chair: "test chair", seed: seed(), digest: "x" }], 1, "");
    const all = out.mock.calls.map((c) => String(c[0])).join("");
    const erase = /\u001b\[(\d+)A\u001b\[0J$/.exec(all);
    return { written: all.slice(0, erase?.index ?? all.length), up: Number(erase?.[1] ?? -1) };
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: wasTTY, configurable: true });
    Object.defineProperty(process.stdout, "columns", { value: wasColumns, configurable: true });
  }
}

test("on a narrow terminal the erase climbs every wrapped row, not only the line feeds", async () => {
  const { written, up } = await runAt(40);
  expect(up).toBe(rowsShown(written, 40));
  expect(up).toBeGreaterThan(written.split("\n").length - 1);
});

test("control: on a wide terminal no line wraps, so the rows equal the line feeds", async () => {
  const { written, up } = await runAt(200);
  expect(up).toBe(written.split("\n").length - 1);
  expect(up).toBe(rowsShown(written, 200));
});
