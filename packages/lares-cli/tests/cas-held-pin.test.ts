/**
 * `lares bag cas --pin <cid> --held` BINDS TO THE LIFE THE STORE NAMES, or refuses by name.
 *
 * A held pin dies with the vessel life the store names at rest (`<hearth>/vessel/.life`, `readVesselLife`). A store that names
 * no life (never claimed, or a life record that reads torn) gives `--held` nothing to bind to: the door refuses
 * `held-pin-no-life` and writes no pin. Driven through the CLI's own door (`cmdCas`) under a scratch `LAR_ROOT`, reading the
 * envelope the CLI prints. CONTROL: a store that names a life pins, and the pin carries that life.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdCas } from "../src/commands/cas.js";

const CID = "a".repeat(64);
let root = "";
let prior: { root: string | undefined; cas: string | undefined };

beforeEach(() => {
  prior = { root: process.env["LAR_ROOT"], cas: process.env["LAR_CAS"] };
  root = mkdtempSync(join(tmpdir(), "lr-cas-held-"));
  process.env["LAR_ROOT"] = root;
  delete process.env["LAR_CAS"];
  mkdirSync(vesselDir(), { recursive: true });
});
afterEach(() => {
  if (prior.root === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior.root;
  if (prior.cas === undefined) delete process.env["LAR_CAS"]; else process.env["LAR_CAS"] = prior.cas;
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const vesselDir = (): string => join(root, "hearth", "vessel");
const pinsFile = (): string => join(vesselDir(), "cas", ".pins.json");

async function pinHeld(): Promise<{ code: number; payload: { ok: boolean; data?: { pins: Array<{ cid: string; life?: string }> }; error?: { code: string } } }> {
  const lines: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  vi.spyOn(console, "error").mockImplementation(() => {});
  const code = await cmdCas({ command: "bag", positional: ["cas"], options: { pin: CID }, flags: { held: true, json: true } });
  vi.restoreAllMocks();
  return { code, payload: JSON.parse(lines.join("")) };
}

describe("lares bag cas --pin --held", () => {
  test("★ a store that names no life refuses held-pin-no-life by name, and writes no pin ★", async () => {
    const { code, payload } = await pinHeld();
    expect(code).toBe(1);
    expect(payload).toMatchObject({ ok: false, error: { code: "held-pin-no-life" } });
    expect(existsSync(pinsFile()), "no pin rests").toBe(false);
  });

  test("a life record that reads torn names no life: the same refusal, and no pin", async () => {
    writeFileSync(join(vesselDir(), ".life"), "not-a-life\n");
    const { code, payload } = await pinHeld();
    expect(code).toBe(1);
    expect(payload).toMatchObject({ ok: false, error: { code: "held-pin-no-life" } });
    expect(existsSync(pinsFile())).toBe(false);
  });

  test("CONTROL: a store that names a life pins, and the pin carries that life", async () => {
    const life = "0123456789abcdef".repeat(2);   // the life id's one spelling: 32 lowercase hex
    writeFileSync(join(vesselDir(), ".life"), `${life}\n`);
    const { code, payload } = await pinHeld();
    expect(code).toBe(0);
    expect(payload.ok).toBe(true);
    expect(payload.data?.pins).toEqual([expect.objectContaining({ cid: CID, life })]);
    expect(readFileSync(pinsFile(), "utf8")).toContain(life);
  });
});
