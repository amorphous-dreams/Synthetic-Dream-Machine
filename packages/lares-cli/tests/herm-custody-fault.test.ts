/**
 * herm-custody-fault — `lares herm` reads a herm's origin-custody refusal as a boot FAULT, never a stall.
 *
 * The node refuses a herm handed a Web origin before listen and exits. `lares herm` reads readiness from the
 * node's own log attestation: `vessel-ready` on a live stand, `fatal:` on a boot fault. A refusal that never
 * prints the fault marker leaves the CLI waiting out its idle window and reporting "boot stalled", which
 * names the wrong condition. The boot runs the built `dist` main under a scratch `LAR_ROOT`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { larBootstrapPath, larDataDir } from "@lararium/node";
import { cmdHerm } from "../src/commands/herm.js";
import type { ParsedArgs } from "../src/parse-args.js";

const ORIGIN_ENV = ["LAR_WEB_ORIGIN", "LAR_ORACLE_ORIGIN", "LAR_SAME_ORIGIN", "LAR_PUBLIC_URL", "LAR_RECIPE"];
const WAYSTONE = /a waystone serves no arrival page; light a Pronaos on a lararium/;

let root: string;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "herm-custody-fault-"));
  saved = {};
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("LAR_PRONAOS_") || ORIGIN_ENV.includes(key)) { saved[key] = process.env[key]; delete process.env[key]; }
  }
  for (const key of ["LAR_ROOT", "LAR_BAGS", "LAR_CAS"]) saved[key] = process.env[key];
  process.env["LAR_ROOT"] = root;
  process.env["LAR_BAGS"] = join(root, "bags");
  delete process.env["LAR_CAS"];
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
});

const verb = (): ParsedArgs => ({ command: "herm", positional: [], options: { port: "0", "relay-port": "0" }, flags: { json: true } });

/** The stand-up returns 0 by design (`ok` carries the verdict), so read the emitted payload. */
async function run(): Promise<{ ok: boolean; note: string }> {
  const lines: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try {
    await cmdHerm(verb());
    const json = lines.find((l) => l.trim().startsWith("{"));
    const payload = json ? JSON.parse(json) as { ok?: boolean; data?: { herm?: { note?: string } } } : {};
    return { ok: payload.ok === true, note: payload.data?.herm?.note ?? "" };
  } finally { log.mockRestore(); err.mockRestore(); out.mockRestore(); }
}

describe("lares herm — a refused herm reads as a fault", () => {
  it("★ a herm handed LAR_WEB_ORIGIN attests a boot fault within seconds, with the waystone line in its log ★", async () => {
    mkdirSync(larDataDir(), { recursive: true });
    writeFileSync(larBootstrapPath(), "{}", "utf8");
    process.env["LAR_WEB_ORIGIN"] = "http://web.local";

    const started = Date.now();
    const r = await run();
    const elapsed = Date.now() - started;

    expect(r.ok).toBe(false);
    expect(r.note).toMatch(/attested a boot fault/);
    expect(r.note).not.toMatch(/stalled/);
    expect(elapsed).toBeLessThan(20_000);
    expect(readFileSync(join(larDataDir(), "herm-serve.log"), "utf8")).toMatch(WAYSTONE);
  }, 60_000);

  it("CONTROL — a root with no bootstrap spawns nothing and names the preflight, not a fault", async () => {
    process.env["LAR_WEB_ORIGIN"] = "http://web.local";
    const r = await run();
    expect(r.ok).toBe(false);
    expect(r.note).toMatch(/no bootstrap/);
    expect(r.note).not.toMatch(/boot fault/);
  }, 30_000);
});
