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
  // The census rides the same door, so a test reads which faces stand open and shut off one stub.
  houseFaces: async () => {
    frames.push({ op: "census" });
    const c = door({ op: "census" });
    const list = (v: unknown): number[] => (Array.isArray(v) ? (v as number[]) : []);
    return { open: list(c?.["facesLit"]), shut: list(c?.["facesLocked"]) };
  },
}));
vi.mock("../src/local-connector.js", async (real) => ({ ...(await real<typeof import("../src/local-connector.js")>()), udsAlive: async () => true }));
// THE SHARE LANDING a wear replays: a stub that records each landing and answers what the test names.
const landings: Array<Record<string, unknown>> = [];
let landed: Record<string, unknown> | null = { granted: 0, lifted: 0, pending: 0 };
vi.mock("../src/share-doors.js", async (real) => ({
  ...(await real<typeof import("../src/share-doors.js")>()),
  LIVE_SHARE_DOORS: { faces: async () => [{ handleIndex: 0, petname: "steward" }, { handleIndex: 2, petname: "referee" }], file: { read: () => null, write: () => {} }, verb: async () => null, out: () => {}, err: () => {} },
  landShares: async (_doors: unknown, faces: unknown) => { landings.push({ faces }); return landed; },
}));

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
  prompts = 0; frames.length = 0; out = []; landings.length = 0; landed = { granted: 0, lifted: 0, pending: 0 };
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

  it("★ a piped wear (the shim's `exec -T … wear N </dev/null`) prints its one prose line, never the frame ★", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "wear", face: 1, held: true, standing: "hearth" };
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    try {
      expect(await cmdWear(parseArgs(["wear", "1"]))).toBe(0);
    } finally {
      delete (process.stdout as { isTTY?: boolean }).isTTY;
    }
    expect(out).toEqual(["wearing h1: the vessel stands as hearth. It asked for no route."]);
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

  it("★ RED a wear onto the face already worn replays the share landing: the rows a grant carried for it lift, by name (the referee walk's `stands worn already` changed nothing) ★", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "wear", face: 2, held: true, already: true, standing: "hearth" };
    landed = { granted: 0, lifted: 1, pending: 0 };
    expect(await cmdWear(parseArgs(["wear", "2", "--no-json"]))).toBe(0);
    expect(landings, "one landing, naming every face by handle index and pet-name").toEqual([{ faces: [{ handleIndex: 0, petname: "steward" }, { handleIndex: 2, petname: "referee" }] }]);
    expect(out.join("\n")).toMatch(/face h2 stands worn already/);
    expect(out.join("\n")).toMatch(/shares: 1 granted row\(s\) now stand in h2's catalog/);
    // The envelope carries the landing beside the wear's answer.
    out = []; landings.length = 0;
    expect(await wear("2")).toBe(0);
    expect(answer()).toMatchObject({ ok: true, data: { op: "wear", face: 2, already: true, shares: { lifted: 1, granted: 0, pending: 0 } } });
    expect(landings).toHaveLength(1);
  });

  it("a wear's replay that finds a face still shut names the wait; a replay that moves nothing says nothing; a refused wear lands nothing", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "wear", face: 1, held: true, standing: "hearth" };
    landed = { granted: 0, lifted: 0, pending: 1 };
    expect(await cmdWear(parseArgs(["wear", "1", "--no-json"]))).toBe(0);
    expect(out.join("\n")).toMatch(/shares: 1 grant\(s\) wait for a shut face/);
    out = []; landed = { granted: 0, lifted: 0, pending: 0 };
    expect(await cmdWear(parseArgs(["wear", "1", "--no-json"]))).toBe(0);
    expect(out).toEqual(["wearing h1: the vessel stands as hearth. It asked for no route."]);
    // CONTROL: a refused switch takes no landing.
    landings.length = 0;
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "wear", face: 1, held: true, standing: "hearth", switchRefused: "h1 would not stand", wornAgain: 0 };
    expect(await wear("1")).toBe(1);
    expect(landings).toEqual([]);
  });

  it("the command table seats `wear`, accepting `face` and `yes` (turn over records the shore's flush left unwritten) alone", () => {
    const row = COMMANDS.find((c) => c.name === "wear");
    expect(row).toBeDefined();
    expect(row!.accepts).toEqual(["face", "yes"]);
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

  it("★ `unlock --face N` on a held key with N standing open asks nothing: it wears N ★", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true)
      : frame["op"] === "census" ? { op: "census", facesLit: [0, 1, 2], facesLocked: [] }
      : { op: "wear", face: 1, held: true, standing: "hearth" };
    expect(await cmdVault(parseArgs(["vault", "unlock", "--face", "1", "--json"]))).toBe(0);
    expect(prompts).toBe(0);
    expect(frames).toEqual([{ op: "custody" }, { op: "census" }, { op: "wear", face: 1 }]);
    expect(answer()).toMatchObject({ ok: true, data: { op: "wear", face: 1 } });
    expect(landings, "the unlock that wears an open face replays the share landing, as the wear does").toHaveLength(1);
  });

  it("`unlock --face N` on a held key where no face hN stands refuses by name and asks nothing", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "census", facesLit: [0], facesLocked: [1] };
    expect(await cmdVault(parseArgs(["vault", "unlock", "--face", "4", "--json"]))).toBe(1);
    expect(prompts).toBe(0);
    expect(frames.map((f) => f["op"])).toEqual(["custody", "census"]);
    expect(answer().error?.code).toBe("face-not-standing");
  });

  it("CONTROL: `unlock --face N` on a held key with N shut still asks N's own route", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true)
      : frame["op"] === "census" ? { op: "census", facesLit: [0], facesLocked: [1] }
      : { op: "unlock", reading: "opens", slot: "slot-1", held: true, standing: "hearth" };
    await cmdVault(parseArgs(["vault", "unlock", "--face", "1", "--json"]));
    expect(prompts).toBeGreaterThan(0);
    expect(frames.map((f) => f["op"]).slice(0, 3)).toEqual(["custody", "census", "unlock"]);
  });

  it("CONTROL: on a closed vessel the unlock gathers its route and sends it", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(false) : { op: "unlock", reading: "opens", slot: "slot-1", held: true, standing: "hearth" };
    await cmdVault(parseArgs(["vault", "unlock", "--json"]));
    expect(prompts).toBeGreaterThan(0);
    expect(frames.map((f) => f["op"]).slice(0, 2)).toEqual(["custody", "unlock"]);
  });
});

describe("RED a seat wears on word (the command)", () => {
  for (const [mark, value] of [["CLAUDECODE", "1"], ["CODEX_SANDBOX", "seatbelt"], ["CODEX_SANDBOX_NETWORK_DISABLED", "1"]] as const) {
    it(`under the harness's mark ${mark}, the wear frame carries \`seat: "ai"\` and the door's answer moves the mount`, async () => {
      process.env[mark] = value;
      door = (frame) => frame["op"] === "custody" ? custody(true)
        : { op: "wear", face: 1, held: true, standing: "hearth" };
      expect(await wear("1")).toBe(0);
      expect(frames.at(-1)).toEqual({ op: "wear", face: 1, seat: "ai" });
    });
  }

  it("CONTROL: with no mark the frame carries the face alone", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "wear", face: 1, held: true, standing: "hearth" };
    expect(await wear("1")).toBe(0);
    expect(frames.at(-1)).toEqual({ op: "wear", face: 1 });
  });
});

describe("RED a wear flushes every shore before it turns the face (the vessel asks it in-process)", () => {
  const STRANDS = { whole: false, islands: [
    { island: "daemon", answered: true, written: [], writtenCount: 2, unwritten: [], unwrittenCount: 0, fileWrites: 2, drained: true },
    { island: "wiki:sdm", answered: true, written: [], writtenCount: 0, unwritten: [{ state: "failed", uri: "lar:///a.b.c/stuck", why: "its reconcile threw again on the retry" }], unwrittenCount: 1, fileWrites: 0, drained: true },
  ] };
  const refused = { op: "wear", status: "error", errorMessage: "the shore's flush left records unwritten", refusal: { reason: "shore-unwritten", shore: STRANDS } };

  it("WS1 a wear the vessel refuses over unwritten records names each record and the --yes that turns anyway, and sends no second frame", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : refused;
    expect(await wear("1")).toBe(1);
    expect(frames).toEqual([{ op: "custody" }, { op: "wear", face: 1 }]);
    const a = answer();
    expect(a).toMatchObject({ ok: false, error: { code: "shore-unwritten" } });
    expect(a.error!.message).toContain("lar:///a.b.c/stuck");
    expect(a.error!.message).toContain("wiki:sdm");
    expect(a.error!.message).toContain("lares wear 1 --yes");
  });

  it("WS2 `--yes` carries `yes: true` on the wear frame, and the wear prints the flush's reading beside its line", async () => {
    door = (frame) => frame["op"] === "custody" ? custody(true) : { op: "wear", face: 1, held: true, standing: "hearth", shore: STRANDS };
    expect(await cmdWear(parseArgs(["wear", "1", "--yes"]))).toBe(0);
    expect(frames).toEqual([{ op: "custody" }, { op: "wear", face: 1, yes: true }]);
    const text = out.join("\n");
    expect(text).toContain("wearing h1: the vessel stands as hearth.");
    expect(text).toMatch(/shore: daemon wrote 2 owed carrier\(s\)/);
    expect(text).toMatch(/shore: wiki:sdm wrote 0 owed carrier\(s\); 1 left unwritten: failed lar:\/\/\/a\.b\.c\/stuck \(its reconcile threw again on the retry\)/);
  });
});
