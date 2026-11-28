/**
 * found-refusals — a refused founding tells the truth at the door: the store's shape is read BEFORE any route is asked,
 * every refusal leads its line by name with no stack, and `vessel stand --init` carries a refused founding's exit code.
 * Real files under a scratch LAR_ROOT; the only fake is the route gatherer's count.
 */
import { closeScratch, openScratch, type Scratch } from "../../lararium-node/tests/support/scratch-fixture.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { vesselCustodyHomes } from "@lararium/node";
import { parseArgs } from "../src/parse-args.js";
import { cmdFound, setFoundingRoute } from "../src/commands/found.js";
import { gatherFoundingRoute, CredentialTtyRefusal } from "../src/custody-prompt.js";

let house: Scratch;
let root: string;
let err: string[];

function snapshot(dir: string): string {
  const h = createHash("sha256");
  const walk = (d: string): void => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n); const st = statSync(p);
      h.update(p);
      if (st.isDirectory()) walk(p); else if (st.isFile()) h.update(readFileSync(p));
    }
  };
  walk(dir);
  return h.digest("hex");
}

beforeEach(() => {
  house = openScratch();
  root = house.root;
  err = [];
  vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.join(" ")); });
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); closeScratch(house); });

describe("vessel found — the store's shape is read before any route is asked", () => {
  it("★ a store holding a face row with no slot tree refuses OccupiedStoreRefusal by name, asks for NO route, prints no stack, writes nothing ★", async () => {
    const homes = vesselCustodyHomes();
    mkdirSync(homes.identity, { recursive: true });
    const face = join(homes.identity, "faces", "ab".repeat(16));
    mkdirSync(face, { recursive: true });
    writeFileSync(join(face, "anchors-h0.json"), "{}");     // a face row with no slot tree
    let asked = 0;
    setFoundingRoute(async () => { asked++; return [{ t: 1, pins: [{ kind: "passphrase", passphrase: "never-asked" }] }]; });
    const before = snapshot(root);
    expect(await cmdFound(parseArgs(["vessel", "found"]))).toBe(1);
    expect(asked).toBe(0);
    expect(err[0]).toMatch(/^\[lares vessel found\] refused: OccupiedStoreRefusal: /);
    expect(err.join("\n")).not.toMatch(/\n\s+at /);
    expect(snapshot(root)).toBe(before);
  });

  it("CONTROL: a clean root asks for the route exactly once", async () => {
    let asked = 0;
    setFoundingRoute(async () => { asked++; throw new CredentialTtyRefusal("lares vessel found", "stop here"); });
    expect(await cmdFound(parseArgs(["vessel", "found"]))).toBe(1);
    expect(asked).toBe(1);
  });

  it("★ a route that gathers no slot refuses CustodyFoundingRefused by name, with its advice and no stack ★", async () => {
    setFoundingRoute(async () => []);
    expect(await cmdFound(parseArgs(["vessel", "found"]))).toBe(1);
    expect(err[0]).toMatch(/^\[lares vessel found\] refused: CustodyFoundingRefused: /);
    expect(err[1]).toMatch(/binds a human route/);
    expect(err.join("\n")).not.toMatch(/\n\s+at /);
  });

  it("★ with no TTY the real gatherer refuses CredentialTtyRefusal, leads the line by name, and writes nothing ★", async () => {
    setFoundingRoute(gatherFoundingRoute);
    const before = snapshot(root);
    expect(await cmdFound(parseArgs(["vessel", "found"]))).toBe(1);
    expect(err[0]).toMatch(/^\[lares vessel found\] refused: CredentialTtyRefusal: /);
    expect(snapshot(root)).toBe(before);
  });
});

describe("vessel stand --init — a refused founding ends the stand non-zero", () => {
  it("★ exits 1 naming FoundingRefused, starts nothing; CONTROL: --observe never founds and exits 0 ★", async () => {
    vi.resetModules();
    const found = vi.fn(async () => [{ step: "init", action: "failed", detail: "init exited 1" }]);
    vi.doMock("../src/standup.js", () => ({ foundIfAbsent: found }));
    const { cmdStand } = await import("../src/commands/stand.js");
    expect(await cmdStand(parseArgs(["vessel", "stand", "init=true", "--no-json"]))).toBe(1);
    expect(found).toHaveBeenCalledTimes(1);
    expect(err.join("\n")).toMatch(/lares vessel stand: FoundingRefused: init exited 1/);

    const json: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((c) => { json.push(String(c)); return true; });
    expect(await cmdStand(parseArgs(["vessel", "stand", "init=true", "--json"]))).toBe(1);
    expect(JSON.parse(json.join("").trim().split("\n").pop()!).error.code).toBe("FoundingRefused");

    found.mockClear();
    expect(await cmdStand(parseArgs(["vessel", "stand", "observe=true", "--no-json"]))).toBe(0);
    expect(found).not.toHaveBeenCalled();
    vi.doUnmock("../src/standup.js");
  }, 60_000);
});
