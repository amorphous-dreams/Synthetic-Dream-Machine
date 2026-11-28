/**
 * A FALLEN VESSEL ANSWERS NO VERBS, SO THE STEP-IN READ NEEDS NONE. `lares vessel read` reads the resting engine falls
 * (`.engine-falls`) and every id a boot holds (in flight at a fall, or in quarantine) straight from the files beside the
 * store, with no daemon standing, and names the hand act that moves the house on.
 *
 *   SF1  resting falls read back with their cause, life and document in flight; the in-flight id reads held.
 *   SF2  the prose names the falls, the held ids and the stop by its exact command.
 *   SF3  a quarantined id reads held, naming `lares vessel release`.
 *   CONTROL  a house with no fall reads none, and the prose adds no line.
 *   WELD  the MCP seat's own reading (`step_in.py`, which a refusal from a fallen vessel carries) answers the same
 *         `engineFalls` and `held` this read answers, from the same files.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { dispatch } from "../src/bin/lares.js";
import { quarantineDoc, restEngineFall } from "@lararium/node";

const roots: string[] = [];
const savedRoot = process.env["LAR_ROOT"];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  if (savedRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = savedRoot;
});

const IN_FLIGHT = "2xYzInFlightDocumentIdAbCdEf";
const QUARANTINED = "4NMNnkMhL8jXrdJ9jamS2rUEaQDq";

function house(): { root: string; store: string } {
  const root = mkdtempSync(join(tmpdir(), "lares-read-falls-"));
  roots.push(root);
  const store = join(root, "hearth", "vessel");
  mkdirSync(store, { recursive: true });
  process.env["LAR_ROOT"] = root;
  return { root, store };
}

function fell(store: string): void {
  restEngineFall(store, { cause: "wasm-unreachable", path: "repo", detail: "unreachable", since: "2026-11-23T01:00:00.000Z", lastSettled: null, inFlight: IN_FLIGHT }, "a".repeat(32));
}

async function readJson(root: string): Promise<{ data: Record<string, unknown> }> {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let output = "";
  const stdoutWrite = process.stdout.write;
  process.stdout.write = ((chunk: unknown) => { output += String(chunk); return true; }) as typeof process.stdout.write;
  try { expect(await dispatch(["vessel", "read", `root=${root}`, "json=true", "skip-build=true"])).toBe(0); }
  finally { process.stdout.write = stdoutWrite; }
  return JSON.parse(output);
}

async function readProse(root: string): Promise<string[]> {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a) => { lines.push(a.join(" ")); });
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await dispatch(["vessel", "read", `root=${root}`, "skip-build=true"])).toBe(0);
  return lines;
}

describe("vessel read names the falls and the held ids with no daemon standing", () => {
  test("SF1 — resting falls read back; the document in flight reads held", async () => {
    const { root, store } = house();
    fell(store);
    const { data } = await readJson(root);
    expect(data["engineFalls"]).toEqual([{ life: "a".repeat(32), pid: process.pid, cause: "wasm-unreachable", path: "repo", since: "2026-11-23T01:00:00.000Z", inFlight: IN_FLIGHT }]);
    expect(data["held"]).toEqual([{ documentId: IN_FLIGHT, why: "in-flight" }]);
  });

  test("SF2 — the prose names the falls, the held id and the stop by its command", async () => {
    const { root, store } = house();
    fell(store);
    const text = (await readProse(root)).join("\n");
    expect(text).toMatch(/engine falls:\s+1 resting/);
    expect(text).toMatch(/wasm-unreachable on the repo path/);
    expect(text).toContain(IN_FLIGHT);
    expect(text).toMatch(/`lares vessel stop`/);
  });

  test("SF3 — a quarantined id reads held, naming `lares vessel release`", async () => {
    const { root, store } = house();
    const live = join(store, QUARANTINED.slice(0, 2), QUARANTINED.slice(2), "snapshot");
    mkdirSync(live, { recursive: true });
    writeFileSync(join(live, "chunk"), "torn");
    quarantineDoc(store, { documentId: QUARANTINED, status: "torn" });
    const { data } = await readJson(root);
    expect(data["held"]).toEqual([{ documentId: QUARANTINED, why: "quarantine" }]);
    expect((await readProse(root)).join("\n")).toMatch(/`lares vessel release <documentId>/);
  });

  test("CONTROL — no fall reads none, and the prose adds no fall line", async () => {
    const { root } = house();
    const { data } = await readJson(root);
    expect(data["engineFalls"]).toEqual([]);
    expect(data["held"]).toEqual([]);
    expect((await readProse(root)).join("\n")).not.toMatch(/engine falls|held:/);
  });

  test("WELD — the seat's step-in reading (python) answers the same falls and held ids as this read", async () => {
    const { root, store } = house();
    fell(store);
    restEngineFall(store, { cause: "module-terminated", path: "ledger", detail: "x", since: "2026-11-23T02:00:00.000Z", lastSettled: null, inFlight: null }, "b".repeat(32));
    const live = join(store, QUARANTINED.slice(0, 2), QUARANTINED.slice(2), "snapshot");
    mkdirSync(live, { recursive: true });
    writeFileSync(join(live, "chunk"), "torn");
    quarantineDoc(store, { documentId: QUARANTINED, status: "torn" });
    const { data } = await readJson(root);
    const py = spawnSync(process.env["LARES_PYTHON"] || "python3", ["-c", "import json, sys, step_in\nprint(json.dumps(step_in.reading(sys.argv[1])))", store], {
      env: { ...process.env, PYTHONPATH: resolve(process.cwd(), "../lararium-sensorium/scripts") }, encoding: "utf8",
    });
    expect(py.status, py.stderr).toBe(0);
    expect(JSON.parse(py.stdout)).toEqual({ engineFalls: data["engineFalls"], held: data["held"] });
  });
});
