/**
 * `lares vessel read` prints the floor shadow count (backlog-awakens 3a) from the tally file beside the vessel store, so the
 * operator reads the flip condition whether or not the vessel stands.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatch } from "../src/bin/lares.js";

const roots: string[] = [];
const savedRoot = process.env["LAR_ROOT"];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  if (savedRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = savedRoot;
});

async function readJson(root: string): Promise<{ data: Record<string, unknown> }> {
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env["LAR_ROOT"] = root;
  let output = "";
  const stdoutWrite = process.stdout.write;
  process.stdout.write = ((chunk: unknown) => { output += String(chunk); return true; }) as typeof process.stdout.write;
  try {
    expect(await dispatch(["vessel", "read", `root=${root}`, "--json", "--skip-build"])).toBe(0);
  } finally {
    process.stdout.write = stdoutWrite;
  }
  return JSON.parse(output);
}

function house(): { root: string; store: string } {
  const root = mkdtempSync(join(tmpdir(), "lares-floor-shadow-"));
  roots.push(root);
  const store = join(root, "hearth", "vessel");
  mkdirSync(store, { recursive: true });
  return { root, store };
}

describe("vessel read names the floor shadow count", () => {
  test("a kept tally reads back on the read's answer", async () => {
    const { root, store } = house();
    const tally = { current: { floor: "a".repeat(64), cleanBoots: 7, mismatchBoots: 0, unreadBoots: 0, firstMismatch: null }, prior: [] };
    writeFileSync(join(store, "floor-shadow.json"), JSON.stringify(tally));
    expect((await readJson(root)).data["floorShadow"]).toEqual(tally);
  });

  test("a tally kept before the count named its floor reads as a prior floor's history", async () => {
    const { root, store } = house();
    const unkeyed = { cleanBoots: 2, mismatchBoots: 1, unreadBoots: 4, firstMismatch: null };
    writeFileSync(join(store, "floor-shadow.json"), JSON.stringify(unkeyed));
    expect((await readJson(root)).data["floorShadow"]).toEqual({ current: null, prior: [{ floor: null, ...unkeyed }] });
  });

  test("CONTROL: a house with no tally answers null, never a guess", async () => {
    const { root } = house();
    expect((await readJson(root)).data["floorShadow"]).toBeNull();
  });
});

describe("vessel read answers a pipe in prose (quiet-pipe)", () => {
  afterEach(() => { delete (process.stdout as { isTTY?: boolean }).isTTY; });

  test("★ a piped `vessel read` prints the terminal's few lines, never the JSON envelope ★", async () => {
    const { root } = house();
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    process.env["LAR_ROOT"] = root;
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => { lines.push(a.join(" ")); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stdoutWrite = process.stdout.write;
    let raw = "";
    process.stdout.write = ((chunk: unknown) => { raw += String(chunk); return true; }) as typeof process.stdout.write;
    try {
      expect(await dispatch(["vessel", "read", `root=${root}`, "--skip-build"])).toBe(0);
    } finally {
      process.stdout.write = stdoutWrite;
    }
    expect(raw).toBe("");
    expect(lines[0]).toBe("lares vessel read (local node)");
    expect(lines.join("\n")).toMatch(/bootstrap:\s+absent/);
    expect(lines.length).toBeLessThanOrEqual(10);
  });
});
