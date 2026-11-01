/**
 * lares-mcp-launch — the seat's launch refuses BY NAME on an `mcp` below its pin (road L3, walk gap G4).
 *
 * `lares_mcp.py` builds on `mcp.server.mcpserver`, which an `mcp` older than the pin lacks. Launched on such
 * an interpreter the seat died on an import deep inside its build, after the daemon check, and a harness
 * reads that as a closed connection and nothing more. The launch now reads the installed `mcp` first and
 * refuses with the version it found, the pin it needs and the cure.
 *
 * The probe runs the REAL seat on the stack's interpreter with a stub `mcp` distribution in front of the
 * real one on PYTHONPATH, under a scratch LAR_ROOT where no daemon stands, so nothing reaches a live house.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { resolveMempalacePython } from "@lararium/mempalace";

const PKG = join(import.meta.dirname, "..");
const SEAT = join(PKG, "scripts", "lares_mcp.py");
const MEMPALACE = join(PKG, "..", "..", "mempalace");

/** The `mcp==X` pin a requirements file names. */
const pinIn = (file: string): string => {
  const m = /^mcp==(\S+)\s*$/m.exec(readFileSync(join(PKG, file), "utf8"));
  if (!m) throw new Error(`${file} names no mcp pin`);
  return m[1]!;
};

let dir: string;
let python: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "mcp-launch-"));
  const found = resolveMempalacePython();
  if (found === null) throw new Error("no interpreter holds mempalace (~/.venv or LARES_PYTHON); `lares mempalace install` stands one");
  python = found;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Launch the seat with a stub `mcp` of `version` shadowing the installed one. */
function launch(version: string): { code: number | null; stderr: string } {
  const stub = join(dir, `mcp-${version}`);
  mkdirSync(join(stub, "mcp"), { recursive: true });
  writeFileSync(join(stub, "mcp", "__init__.py"), "");
  mkdirSync(join(stub, `mcp-${version}.dist-info`), { recursive: true });
  writeFileSync(join(stub, `mcp-${version}.dist-info`, "METADATA"), `Metadata-Version: 2.1\nName: mcp\nVersion: ${version}\n`);
  const r = spawnSync(python, [SEAT], {
    encoding: "utf8",
    timeout: 60_000,
    input: "",
    env: { ...process.env, PYTHONPATH: [stub, MEMPALACE].join(delimiter), LAR_ROOT: join(dir, "root") },
  });
  return { code: r.status, stderr: String(r.stderr ?? "") };
}

describe("the seat's launch reads its mcp first", () => {
  it("an mcp below the pin refuses by name: the version found, the pin, the cure", () => {
    const pin = pinIn("requirements.txt");
    const r = launch("1.28.1");
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain("mcp 1.28.1");
    expect(r.stderr).toContain(`mcp==${pin}`);
    expect(r.stderr).toContain("requirements.txt");
    expect(r.stderr).not.toContain("Traceback");
  });

  it("control: an mcp at the pin passes the probe, and the launch stops at the absent daemon instead", () => {
    const r = launch(pinIn("requirements.txt"));
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain("no lares daemon");
    expect(r.stderr).not.toContain("below the pin");
  });

  it("the pin the seat holds agrees with requirements.txt and the image lock", () => {
    const held = /^MCP_PIN = "([^"]+)"$/m.exec(readFileSync(SEAT, "utf8"))?.[1];
    expect(held).toBe(pinIn("requirements.txt"));
    expect(held).toBe(pinIn("requirements-image.lock"));
  });
});
