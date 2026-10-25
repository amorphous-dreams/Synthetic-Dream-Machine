/**
 * A locked `persona list` prints the public indices the floor index names and nothing a face keeps private; a face that
 * unlocks shows its name. A vessel with no face standing has nothing to show and refuses naming the unlock.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdPersona } from "../src/commands/persona.js";
import { cmdVessel } from "../src/commands/vessel.js";
import { seatedCustody } from "@lararium/node";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe("a locked persona list", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(async () => {
    prior = process.env["LAR_ROOT"];
    root = mkdtempSync(join(tmpdir(), "lares-list-locked-"));
    process.env["LAR_ROOT"] = root;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    writeFileSync(join(root, ".lar-test-scratch"), "");
    expect(await cmdVessel({ command: "vessel", positional: ["found"], options: { name: "private-label" }, flags: { json: true, hearth: true } })).toBe(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    rmSync(root, { recursive: true, force: true });
  });

  test("RED: locked, it prints the face's public index and no private label; CONTROL: unlocked, the label shows", async () => {
    const wire: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { wire.push(String(chunk)); return true; });
    const holder = seatedCustody()!;
    await holder.lock();
    expect(await cmdPersona({ command: "persona", positional: ["list"], options: {}, flags: { json: true } })).toBe(0);
    const locked = wire.join("");
    expect(locked).toContain('"locked":[0]');
    expect(locked).not.toContain("private-label");
    wire.length = 0;
    expect((await holder.unlock([{ kind: "passphrase", passphrase: "test-founding-passphrase" }])).reading).toBe("opens");
    expect(await cmdPersona({ command: "persona", positional: ["list"], options: {}, flags: { json: true } })).toBe(0);
    expect(wire.join("")).toContain("private-label");
  });

  test("a vessel with no face standing refuses a locked list naming the unlock", async () => {
    rmSync(join(root, "data"), { recursive: true, force: true });
    const holder = seatedCustody();
    await holder?.lock();
    expect(await cmdPersona({ command: "persona", positional: ["list"], options: {}, flags: { json: true } })).toBe(1);
  });
});
