/**
 * store-failure — a failure that came through the store door names itself in JSON.
 *
 * A row's refusal answers under the name its row gave; a refusal the vessel named keeps that name; the store's own
 * faults (another holder, a door that never answered, a wait that ended) each read under their own code. No store
 * refusal reaches a script as a bare `refused` or `error`.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/local-connector.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/local-connector.js")>();
  return { ...actual, udsAlive: vi.fn(async () => true), whoHolds: vi.fn(async () => null), udsSocketPresent: vi.fn(() => true), invokeLocal: vi.fn() };
});
// `handle rotate` acts as a face, so on a running vessel it rides a session of the one face the vessel resolves.
vi.mock("../src/sealed-act-door.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/sealed-act-door.js")>();
  return { ...actual, sealedAct: vi.fn(async () => ({ face: 0 })) };
});
vi.mock("../src/session-connector.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/session-connector.js")>();
  return { ...actual, openLocalSession: vi.fn() };
});
vi.mock("../src/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/env.js")>();
  return { ...actual, vesselDid: vi.fn(async () => "did:test"), larSealHome: vi.fn(() => "/tmp/unused-seal") };
});

import { NexusKapaeError, StoreHeld } from "@lararium/node";
import { invokeLocal, LocalWaitExpired } from "../src/local-connector.js";
import { openLocalSession } from "../src/session-connector.js";
import { storeVerb, storeFailure, RoutedVerbRefused, SlowBootTimeout } from "../src/store-door.js";
import { DaemonUnreachable } from "../src/verb-call.js";
import { cmdKapae } from "../src/commands/nexus-kapae-cmd.js";
import { dispatch } from "../src/bin/lares.js";
import { parseArgs } from "../src/parse-args.js";

/** The vessel's answer for a row that refused: the door's words, and the name the row refuses under. */
const rowRefused = (verb: string, words: string) => ({
  status: "done" as const, requestId: "r", results: { summary: { ok: true, output: { verb, refused: words, refusal: `${verb}-refused` } } },
});
/** Run `fn` with stdout captured; the one JSON line it printed. */
async function jsonOf(fn: () => Promise<number>): Promise<{ code: number; payload: { ok: boolean; error?: { code: string; message: string; hint?: string } } }> {
  const lines: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try { const code = await fn(); return { code, payload: JSON.parse(lines.join("")) }; }
  finally { spy.mockRestore(); }
}

describe("storeFailure names a failure by its own type", () => {
  it("★ a row's refusal keeps the class its command names and carries the name its row answered ★", async () => {
    vi.mocked(invokeLocal).mockResolvedValue(rowRefused("nexus-kapae-list", "no charter seats a quorum"));
    const err = await storeVerb("nexus-kapae-list", {}, NexusKapaeError).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NexusKapaeError);
    expect(storeFailure(err, "refused")).toEqual({ code: "nexus-kapae-list-refused", message: "no charter seats a quorum" });
  });

  it("a refusal the vessel named reads under that name's code, with its cure where one stands", async () => {
    vi.mocked(invokeLocal).mockResolvedValue({ status: "error", requestId: "r", errorMessage: "the bag takes no writes", refusal: { reason: "bag-retired" } });
    const err = await storeVerb("nexus-kapae-list", {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RoutedVerbRefused);
    const failure = storeFailure(err);
    expect(failure.code).toBe("bag-retired");
    expect(failure.hint).toMatch(/CREATE/);
    // A name this build has no code for still travels as itself, never as `verb-error`.
    expect(storeFailure(new RoutedVerbRefused("later", "a-later-name")).code).toBe("a-later-name");
  });


});

describe("a command's JSON carries the name", () => {
  const list = () => cmdKapae(parseArgs(["nexus", "kapae", "--list", "--json"]));

  it("★ `lares nexus kapae --list` at a floor reads `waking-floor` and exits 2, never `error` ★", async () => {
    vi.mocked(invokeLocal).mockResolvedValue({ status: "error", requestId: "r", errorMessage: "the vessel holds no face", refusal: { reason: "waking-floor" } });
    const { code, payload } = await jsonOf(list);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("waking-floor");
    expect(code).toBe(2);
  });

  it("a row's refusal reaches JSON under its row's name", async () => {
    vi.mocked(invokeLocal).mockResolvedValue(rowRefused("nexus-kapae-list", "no charter seats a quorum"));
    const { code, payload } = await jsonOf(list);
    expect(payload.error).toEqual({ code: "nexus-kapae-list-refused", message: "no charter seats a quorum" });
    expect(code).toBe(1);
  });

  it("CONTROL: a fault that names nothing still reads `error`", async () => {
    vi.mocked(invokeLocal).mockRejectedValue(new Error("a synthetic transport fault"));
    const { code, payload } = await jsonOf(list);
    expect(payload.error?.code).toBe("error");
    expect(code).toBe(1);
  });

  it("★ a store refusal no command caught leaves the dispatcher as one JSON object, never a throw ★", async () => {
    // A face row rides `session:act`; the vessel's refusal answers with the refusal's own name as its reason.
    const refused = { status: "error", errorMessage: "the vessel holds no face", reason: "waking-floor" };
    vi.mocked(openLocalSession).mockResolvedValue({ faceRef: "proof", act: async () => refused, close: async () => {} } as never);
    const { code, payload } = await jsonOf(() => dispatch(["handle", "rotate", "--json"]));
    expect(payload.error?.code).toBe("waking-floor");
    expect(code).toBe(2);
  });
});
