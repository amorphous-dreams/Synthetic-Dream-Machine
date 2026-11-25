/**
 * `lares vessel read` never throws over the reality-tunnel catalog: a CLI whose tree carries no catalog (an older image
 * against a newer checkout, or the reverse) names the skew plainly on the memory line and goes on reading the rest.
 *
 *   VR1 vessel-read-names-the-catalog-skew: the catalog stands absent; the read exits 0, its answer carries the guards as
 *       unread with the cause, and the human line names the skew and the rebuild.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../src/reality-tunnel/catalog.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/reality-tunnel/catalog.js")>();
  return { ...real, homeItems: () => { throw new Error(`${real.CARRIER} stands absent`); } };
});

const { dispatch } = await import("../src/bin/lares.js");

const roots: string[] = [];
const savedRoot = process.env["LAR_ROOT"];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  if (savedRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = savedRoot;
});

async function read(root: string, json: boolean): Promise<{ code: number; out: string }> {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { lines.push(a.join(" ")); });
  process.env["LAR_ROOT"] = root;
  let output = "";
  const stdoutWrite = process.stdout.write;
  process.stdout.write = ((chunk: unknown) => { output += String(chunk); return true; }) as typeof process.stdout.write;
  try {
    const code = await dispatch(["vessel", "read", "--root", root, ...(json ? ["--json"] : ["--no-json"]), "--skip-build"]);
    return { code, out: json ? output : `${lines.join("\n")}\n${output}` };
  } finally {
    process.stdout.write = stdoutWrite;
  }
}

describe("vessel read over an absent reality-tunnel catalog", () => {
  test("VR1 vessel-read-names-the-catalog-skew: the read goes on, and names the skew instead of throwing", async () => {
    const root = mkdtempSync(join(tmpdir(), "lares-read-skew-"));
    roots.push(root);
    mkdirSync(join(root, "hearth", "vessel"), { recursive: true });
    const json = await read(root, true);
    expect(json.code).toBe(0);
    const data = (JSON.parse(json.out) as { data: Record<string, unknown> }).data;
    expect(data["memoryGuards"]).toBeNull();
    expect(data["memoryGuardsHeld"]).toBeNull();
    expect(String(data["memoryGuardsUnread"])).toMatch(/reality-tunnel\.mem stands absent/);
    expect(data).toHaveProperty("storage");
    const human = await read(root, false);
    expect(human.code).toBe(0);
    expect(human.out).toMatch(/memory: {6}the retention guards read nowhere: .*reality-tunnel\.mem stands absent.*this CLI and the tree it reads stand at different revisions/);
  });
});
