/**
 * unlock-under-pulama-asks-nothing — `lares vault unlock` at a vessel whose custody a pūlama holds gathers no credential: it
 * reads the door first, sends an unlock that carries none, and names the pūlama and what it waits on.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
// Every HOME here stands under the scratch root, so the surface env file a pūlama reading looks for never names the real one.
const PULAMA_KEYS = ["HOME", "LARES_PULAMA", "LAR_PULAMA_SOCKET"] as const;
let priorEnv: Record<string, string | undefined>;
beforeEach(() => {
  prompts = 0; frames.length = 0; out = [];
  root = mkdtempSync(join(tmpdir(), "unlock-pulama-"));
  process.env["LAR_ROOT"] = root;
  priorEnv = Object.fromEntries(PULAMA_KEYS.map((k) => [k, process.env[k]]));
  process.env["HOME"] = join(root, "operator");
  delete process.env["LARES_PULAMA"];
  delete process.env["LAR_PULAMA_SOCKET"];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation((c) => { out.push(String(c)); return true; });
});
afterEach(() => {
  vi.restoreAllMocks(); delete process.env["LAR_ROOT"];
  for (const k of PULAMA_KEYS) { if (priorEnv[k] === undefined) delete process.env[k]; else process.env[k] = priorEnv[k]; }
  rmSync(root, { recursive: true, force: true });
});
/** The surface env file at the scratch operator's `~/.lares`, as the host shim reads it. */
const surfaceEnvFile = (text: string): void => {
  mkdirSync(join(process.env["HOME"]!, ".lares"), { recursive: true });
  writeFileSync(join(process.env["HOME"]!, ".lares", "lares-surface.env"), text);
};

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

  it("unlock-names-the-refused-composition: the unlock frame reads no answer and a second probe names `composition-refused`; the answer names it and the vessel's log, not an unreachable vessel", async () => {
    let probes = 0;
    door = (frame) => frame["op"] === "custody"
      ? custody(++probes === 1 ? { session: false, waits: "pulama-image-unadmitted" } : { session: false, waits: "composition-refused" })
      : null;
    expect(await run("unlock")).toBe(1);
    expect(prompts).toBe(0);
    expect(frames).toEqual([{ op: "custody" }, { op: "unlock" }, { op: "custody" }]);
    const a = answer();
    expect(a.error?.code).toBe("pulama-waits");
    expect(a.error?.message).toContain("composition-refused");
    expect(a.error?.message).toMatch(/the sovereign composition refused/);
    // CONTROL: a probe that reads nothing either still names the vessel unreachable.
    frames.length = 0; out.length = 0;
    door = (frame) => (frame["op"] === "custody" && frames.length === 1 ? custody({ session: false, waits: "pulama-locked" }) : null);
    expect(await run("unlock")).toBe(1);
    expect(answer().error?.code).toBe("daemon-unreachable");
  });

  it("RED probe-waits-out-the-recomposition: the unlock frame reads no answer while the vessel recomposes; the probe waits out the gap (no socket, then `composing` with the session still standing) and names `composition-refused` once the dial settles", async () => {
    const { PULAMA_PROBE } = await import("../src/commands/vault.js");
    PULAMA_PROBE.waitMs = 1;
    let probes = 0;
    door = (frame) => {
      if (frame["op"] !== "custody") return null;
      probes += 1;
      if (probes === 1) return custody({ session: false, waits: "pulama-image-unadmitted" });
      // THE GAP: the composition tore down (no socket answers), then the floor stands while the dial still runs.
      if (probes === 2) return null;
      if (probes === 3) return { ...custody({ session: true, waits: null }), composing: true };
      return { ...custody({ session: false, waits: "composition-refused" }), composing: false };
    };
    expect(await run("unlock")).toBe(1);
    expect(prompts).toBe(0);
    expect(frames).toEqual([{ op: "custody" }, { op: "unlock" }, { op: "custody" }, { op: "custody" }, { op: "custody" }]);
    expect(answer().error?.code).toBe("pulama-waits");
    expect(answer().error?.message).toContain("composition-refused");
    // CONTROL: a vessel that never answers again reads unreachable, within the probe's bound.
    frames.length = 0; out.length = 0;
    door = (frame) => (frame["op"] === "custody" && frames.length === 1 ? custody({ session: false, waits: "pulama-locked" }) : null);
    expect(await run("unlock")).toBe(1);
    expect(answer().error?.code).toBe("daemon-unreachable");
    expect(frames.length).toBe(2 + PULAMA_PROBE.tries);
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

describe("RED unlock-refuses-on-unread-probe (the custody door reads no answer)", () => {
  it("unlock-refuses-on-unread-probe-under-a-pulama: the vessel's own socket names a pūlama, the probe reads nothing; refuse by name, ask nothing, send no unlock", async () => {
    process.env["LAR_PULAMA_SOCKET"] = "/pulama/socket/pulama.sock";
    door = () => null;
    expect(await run("unlock")).toBe(1);
    expect(prompts).toBe(0);
    expect(frames).toEqual([{ op: "custody" }]);
    const a = answer();
    expect(a.ok).toBe(false);
    expect(a.error?.code).toBe("custody-probe-unread");
    expect(a.error?.message).toMatch(/pūlama/);
    expect(a.error?.message).toMatch(/lares vault status/);
  });

  it("unlock-refuses-on-unread-probe-under-a-pulama: the host env names LARES_PULAMA=1, a route flag changes nothing", async () => {
    process.env["LARES_PULAMA"] = "1";
    door = () => null;
    expect(await run("unlock", "--passphrase")).toBe(1);
    expect(prompts).toBe(0);
    expect(frames).toEqual([{ op: "custody" }]);
    expect(answer().error?.code).toBe("custody-probe-unread");
  });

  it("unlock-unread-probe-reads-the-surface-env-file: no env names the pūlama, the surface env file does", async () => {
    surfaceEnvFile("LARES_HOUSE=/nowhere\nLARES_PULAMA=1\n");
    door = () => null;
    expect(await run("unlock")).toBe(1);
    expect(prompts).toBe(0);
    expect(frames).toEqual([{ op: "custody" }]);
    expect(answer().error?.code).toBe("custody-probe-unread");
  });

  it("CONTROL unlock-unread-probe-without-a-pulama-still-prompts: no pūlama named anywhere (the file's last line turns it off), the route gets gathered as before", async () => {
    surfaceEnvFile("LARES_PULAMA=1\nLARES_PULAMA=0\n");
    door = () => null;
    expect(await run("unlock", "--passphrase")).toBe(1);
    expect(prompts).toBeGreaterThan(0);
    expect(frames[0]).toEqual({ op: "custody" });
    expect(frames[1]).toMatchObject({ op: "unlock", credentials: [{ kind: "passphrase" }] });
    expect(answer().error?.code).toBe("daemon-unreachable");
  });
});
