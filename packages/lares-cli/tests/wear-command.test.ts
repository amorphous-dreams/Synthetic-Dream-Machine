/**
 * wear-command — `lares wear N`: unlock opens custody, wear chooses the face. The command asks no route, sends one `wear` frame
 * carrying the face alone, and on a vessel holding no key names the one act that opens it. `lares vault unlock` gathers a route
 * only while custody stays closed: on a held key a bare unlock asks nothing and names `lares wear N`.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let prompts = 0;
vi.mock("../src/prompt-secret.js", () => {
  const asked = (): Promise<string> => { prompts += 1; return Promise.resolve("a-route-nobody-should-be-asked-for"); };
  // A line prompt answers blank (the default route, no further pin); a hidden one answers the route.
  const line = (): Promise<string> => { prompts += 1; return Promise.resolve(""); };
  return { canPromptSecret: () => true, promptLine: line, promptSecret: asked, promptSecretConfirmed: asked, readWardPassphrase: asked };
});

const frames: Array<Record<string, unknown>> = [];
let door: (frame: Record<string, unknown>) => Record<string, unknown> | null = () => null;
vi.mock("../src/custody-door.js", async (real) => ({
  ...(await real<typeof import("../src/custody-door.js")>()),
  sendCustodyFrame: async (frame: Record<string, unknown>) => { frames.push(frame); return door(frame); },
}));
vi.mock("../src/local-connector.js", async (real) => ({ ...(await real<typeof import("../src/local-connector.js")>()), udsAlive: async () => true }));

import { parseArgs } from "../src/parse-args.js";

let cmdWear: (args: ReturnType<typeof parseArgs>) => Promise<number>;
let cmdVault: typeof import("../src/commands/vault.js").cmdVault;
let COMMANDS: typeof import("../src/bin/lares.js").COMMANDS;
beforeAll(async () => {
  vi.resetModules();
  const wearModule = "../src/commands/wear.js";
  ({ cmdWear } = await import(/* @vite-ignore */ wearModule).catch(() => ({ cmdWear: async () => { throw new Error("no `wear` command stands"); } })));
  ({ cmdVault } = await import("../src/commands/vault.js"));
  ({ COMMANDS } = await import("../src/bin/lares.js"));
});

let out: string[];
let root: string;
/** The operator's own house and the harness's seat marks: none may leak in, so each test names the ones it stands. */
const ENV_KEYS = ["HOME", "LARES_PULAMA", "LAR_PULAMA_SOCKET", "CLAUDECODE", "CODEX_SANDBOX", "CODEX_SANDBOX_NETWORK_DISABLED"] as const;
let priorEnv: Record<string, string | undefined> = {};
beforeEach(() => {
  prompts = 0; frames.length = 0; out = [];
  root = mkdtempSync(join(tmpdir(), "wear-command-"));
  process.env["LAR_ROOT"] = root;
  priorEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env["HOME"] = join(root, "operator");
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation((c) => { out.push(String(c)); return true; });
});
afterEach(() => {
  vi.restoreAllMocks(); delete process.env["LAR_ROOT"];
  for (const k of ENV_KEYS) { if (priorEnv[k] === undefined) delete process.env[k]; else process.env[k] = priorEnv[k]; }
  rmSync(root, { recursive: true, force: true });
});

const custody = (unlocked: boolean) => ({ op: "custody", unlocked, slot: unlocked ? "slot-1" : null, attemptsLeft: 3, standing: unlocked ? "hearth" : "herm", composing: false });
const wear = (...argv: string[]): Promise<number> => cmdWear(parseArgs(["wear", ...argv, "--json"]));
const answer = (): { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } } => JSON.parse(out.join("").trim().split("\n").at(-1) ?? "{}");

describe("RED lares wear N", () => {
  it("wear-asks-no-route-and-sends-the-wear-frame", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "wear", face: 1, held: true, standing: "hearth" };
    expect(await wear("1")).toBe(0);
    expect(prompts).toBe(0);
    expect(frames).toEqual([{ op: "custody" }, { op: "wear", face: 1 }]);
    expect(answer()).toMatchObject({ ok: true, data: { op: "wear", face: 1 } });
  });

  it("`--face N` names the face as well as the positional", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "wear", face: 2, held: true, standing: "hearth" };
    expect(await wear("--face", "2")).toBe(0);
    expect(frames.at(-1)).toEqual({ op: "wear", face: 2 });
  });

  it("wear-names-unlock-when-custody-is-closed, and sends no wear", async () => {
    door = () => custody(false);
    expect(await wear("1")).toBe(1);
    expect(prompts).toBe(0);
    expect(frames).toEqual([{ op: "custody" }]);
    expect(answer().error?.code).toBe("custody-locked");
    expect(answer().error?.message).toMatch(/lares vault unlock/);
  });

  it("a refusal from the door answers its own name (face-not-lent names the lend)", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true)
      : { op: "wear", status: "error", errorMessage: "the pūlama lends this vessel h0, h2, and h1 stands outside that set", refusal: { reason: "face-not-lent", lent: [0, 2] } };
    expect(await wear("1")).toBe(1);
    expect(answer().error).toMatchObject({ code: "face-not-lent" });
    expect(answer().error?.message).toMatch(/h0, h2/);
  });

  it("a refused switch names the face worn again", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "wear", face: 1, held: true, standing: "hearth", switchRefused: "h1 would not stand", wornAgain: 0 };
    expect(await wear("1")).toBe(1);
    expect(answer().error?.code).toBe("wear-refused");
    expect(answer().error?.message).toMatch(/h1 did not stand \(h1 would not stand\); h0 worn again/);
  });

  it("no face, or a face that names no handle index, refuses as usage before any frame", async () => {
    door = () => custody(true);
    for (const argv of [[], ["one"], ["-1"], ["1.5"]]) {
      frames.length = 0; out = [];
      expect(await wear(...argv)).not.toBe(0);
      expect(answer().error?.code).toBe("usage");
      expect(frames).toEqual([]);
    }
  });

  it("the command table seats `wear`, accepting `face` alone", () => {
    const row = COMMANDS.find((c) => c.name === "wear");
    expect(row).toBeDefined();
    expect(row!.accepts).toEqual(["face"]);
  });
});

describe("RED vault unlock gathers a route only while custody stays closed", () => {
  it("unlock-on-a-held-key-asks-nothing and names `lares wear N`", async () => {
    door = () => custody(true);
    expect(await cmdVault(parseArgs(["vault", "unlock", "--json"]))).toBe(0);
    expect(prompts).toBe(0);
    expect(frames).toEqual([{ op: "custody" }]);
    expect(answer()).toMatchObject({ ok: true, data: { reading: "already-unlocked" } });
    expect(out.join("\n")).toMatch(/lares wear N/);
  });

  it("CONTROL: on a closed vessel the unlock gathers its route and sends it", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(false) : { op: "unlock", reading: "opens", slot: "slot-1", held: true, standing: "hearth" };
    await cmdVault(parseArgs(["vault", "unlock", "--json"]));
    expect(prompts).toBeGreaterThan(0);
    expect(frames.map((f) => f["op"]).slice(0, 2)).toEqual(["custody", "unlock"]);
  });
});

describe("RED a seat never wears (the command)", () => {
  for (const [mark, value] of [["CLAUDECODE", "1"], ["CODEX_SANDBOX", "seatbelt"], ["CODEX_SANDBOX_NETWORK_DISABLED", "1"]] as const) {
    it(`under the harness's mark ${mark}, the wear frame carries \`seat: "ai"\` and the door's refusal reads by name`, async () => {
      process.env[mark] = value;
      door = (frame) => frame["op"] === "custody" ? custody(true)
        : { op: "wear", status: "error", errorMessage: "a seat wears no face: run `lares wear N` from the operator's own terminal", refusal: { reason: "seat-wears-no-face" } };
      expect(await wear("1")).toBe(1);
      expect(frames.at(-1)).toEqual({ op: "wear", face: 1, seat: "ai" });
      expect(answer().error?.code).toBe("seat-wears-no-face");
    });
  }

  it("CONTROL: with no mark the frame carries the face alone", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "wear", face: 1, held: true, standing: "hearth" };
    expect(await wear("1")).toBe(0);
    expect(frames.at(-1)).toEqual({ op: "wear", face: 1 });
  });
});
