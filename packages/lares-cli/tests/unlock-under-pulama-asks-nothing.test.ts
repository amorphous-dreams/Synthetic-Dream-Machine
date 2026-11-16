/**
 * unlock-under-pulama-asks-nothing — `lares vault unlock` at a vessel whose custody a pūlama holds gathers no credential: it
 * reads the door first, sends an unlock that carries none, and names the pūlama and what it waits on.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let prompts = 0;
vi.mock("../src/prompt-secret.js", () => {
  const asked = (): Promise<string> => { prompts += 1; return Promise.resolve("a-route-nobody-should-be-asked-for"); };
  return { canPromptSecret: () => true, promptLine: asked, promptSecret: asked, promptSecretConfirmed: asked };
});

const frames: Array<Record<string, unknown>> = [];
let door: (frame: Record<string, unknown>) => Record<string, unknown> | null = () => null;
vi.mock("../src/custody-door.js", async (real) => ({
  ...(await real<typeof import("../src/custody-door.js")>()),
  sendCustodyFrame: async (frame: Record<string, unknown>) => { frames.push(frame); return door(frame); },
}));
vi.mock("../src/local-connector.js", async (real) => ({ ...(await real<typeof import("../src/local-connector.js")>()), udsAlive: async () => true }));

import { parseArgs } from "../src/parse-args.js";

let cmdVault: typeof import("../src/commands/vault.js").cmdVault;
beforeAll(async () => {
  vi.resetModules();
  ({ cmdVault } = await import("../src/commands/vault.js"));
});

let out: string[];
let root: string;
beforeEach(() => {
  prompts = 0; frames.length = 0; out = [];
  root = mkdtempSync(join(tmpdir(), "unlock-pulama-"));
  process.env["LAR_ROOT"] = root;
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation((c) => { out.push(String(c)); return true; });
});
afterEach(() => { vi.restoreAllMocks(); delete process.env["LAR_ROOT"]; rmSync(root, { recursive: true, force: true }); });

const custody = (pulama?: { session: boolean; waits: string | null }) => ({ op: "custody", unlocked: pulama?.session === true, slot: null, attemptsLeft: 0, standing: "herm", ...(pulama ? { pulama } : {}) });
const run = (...argv: string[]): Promise<number> => cmdVault(parseArgs(["vault", ...argv, "--json"]));
const answer = (): { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } } => JSON.parse(out.join("").trim().split("\n").at(-1) ?? "{}");

describe("RED unlock-under-pulama-asks-nothing (the command)", () => {
  it("asks for no method, no passphrase and no pin; sends an unlock with no credential; refuses naming the pūlama and what it waits on", async () => {
    door = (frame) => frame["op"] === "custody" ? custody({ session: false, waits: "kukulu-unvouched" })
      : { op: "unlock", reading: "pulama-waits", held: false, standing: "herm", pulama: { session: false, waits: "kukulu-unvouched" } };
    expect(await run("unlock")).toBe(1);
    expect(prompts).toBe(0);
    expect(frames).toEqual([{ op: "custody" }, { op: "unlock" }]);
    const a = answer();
    expect(a.ok).toBe(false);
    expect(a.error?.code).toBe("pulama-waits");
    expect(a.error?.message).toMatch(/custody rests with a pūlama/);
    expect(a.error?.message).toMatch(/kukulu-unvouched/);
    expect(a.error?.message).toMatch(/lares rite kukulu/);
    expect(a.error?.message).toMatch(/No route typed here opens it/);
  });

  it("an unlit pūlama names the hand that lights it; an unreachable one names the raise; a route flag changes nothing; none asks a route", async () => {
    for (const [waits, hint, flags] of [["pulama-locked", /pulama light/, []], ["pulama-unreachable", /pulama up/, ["--passphrase"]], ["pulama-locked", /pulama light/, ["--all", "--face", "0"]]] as const) {
      frames.length = 0; out.length = 0;
      door = (frame) => frame["op"] === "custody" ? custody({ session: false, waits }) : { op: "unlock", reading: "pulama-waits", held: false, standing: "herm", pulama: { session: false, waits } };
      expect(await run("unlock", ...flags)).toBe(1);
      expect(prompts, waits).toBe(0);
      expect(frames[1]).toEqual({ op: "unlock" });
      expect(answer().error?.code).toBe("pulama-waits");
      expect(answer().error?.message).toMatch(hint);
      expect(answer().error?.message).toContain(waits);
    }
  });

  it("a pūlama that serves the vessel answers standing, with no route asked", async () => {
    door = (frame) => frame["op"] === "custody" ? custody({ session: false, waits: "pulama-locked" })
      : { op: "unlock", reading: "opens", held: true, standing: "hearth", pulama: { session: true, waits: null } };
    expect(await run("unlock")).toBe(0);
    expect(prompts).toBe(0);
    expect(answer()).toMatchObject({ ok: true, data: { reading: "opens", standing: "hearth" } });
  });

  it("CONTROL: a vessel that holds its own custody still gathers the route and sends it", async () => {
    door = (frame) => frame["op"] === "custody" ? custody() : { op: "unlock", reading: "no-slot-opens", attemptsLeft: 2, standing: "herm" };
    expect(await run("unlock", "--passphrase")).toBe(1);
    expect(prompts).toBeGreaterThan(0);
    expect(frames).toHaveLength(2);
    expect(frames[1]).toMatchObject({ op: "unlock", credentials: [{ kind: "passphrase", passphrase: "a-route-nobody-should-be-asked-for" }] });
  });
});
