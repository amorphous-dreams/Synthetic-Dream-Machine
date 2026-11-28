/**
 * hearth-roster-door — `lares vessel roster`, who is home, at the CLI. The daemon wire stands mocked (law-door's shape): the
 * vessel's channel answers `hearth-roster` with a roster `@lararium/mesh` composed; here the CLI's half: the one verb it puts
 * on the wire, the prose it prints through a pipe, and the JSON body `json=true` carries whole (the body the MCP seat's roster act, lar:///face.roster.reads, answers).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { composeHearthRoster, type HearthRoster } from "@lararium/mesh/hearth-roster";

const h = vi.hoisted(() => ({ calls: [] as Array<{ verb: string; args: Record<string, unknown> }>, roster: null as unknown, refuse: null as string | null }));

vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    if (h.refuse) return { status: "error", requestId: "r", errorMessage: h.refuse };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.roster } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdVessel, VESSEL_SUBS } from "../src/commands/vessel.js";
import { PROSE_FIRST_READS } from "../src/render.js";
import type { ParsedArgs } from "../src/parse-args.js";

const argv = (flags: Record<string, boolean> = {}): ParsedArgs => ({ command: "vessel", positional: ["roster"], options: {}, flags } as unknown as ParsedArgs);

async function run(args: ParsedArgs): Promise<{ exit: number; out: string }> {
  const chunks: string[] = [];
  const write = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => { chunks.push(String(chunk)); return true; }) as never);
  const log = vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => { chunks.push(parts.join(" ") + "\n"); });
  const err = vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => { chunks.push(parts.join(" ") + "\n"); });
  try { return { exit: await cmdVessel(args), out: chunks.join("") }; }
  finally { write.mockRestore(); log.mockRestore(); err.mockRestore(); }
}

const ROSTER: HearthRoster = composeHearthRoster({
  worn: 1, lit: [], lent: [1], asker: "hand",
  local: [{ session: "0a11bb02-0000-4000-8000-000000000001", face: 1, hand: "cli", anchor: "place" }, { session: "f2c7aa01-0000-4000-8000-000000000002", face: 1, hand: "seat", anchor: "place" }],
  planes: [{ face: 1, self: "a".repeat(64), lanes: [{ face: 1, intent: "d".repeat(64), verb: "face-join", claimant: "b".repeat(64), claim: "c".repeat(64) }],
    vota: [{ face: 1, intent: "d".repeat(64), verb: "face-join", issuer: "b".repeat(64), audience: "pinned", waitsOn: "outcome", owedBy: "b".repeat(64), claimed: true }],
    far: [{ atom: "b".repeat(64), face: 1, self: false, standing: "stands", acts: 3, lastHeard: [{ entry: "claim", cid: "c".repeat(64) }] }] }],
  unread: [],
});

beforeEach(() => { h.calls = []; h.roster = ROSTER; h.refuse = null; });
afterEach(() => vi.restoreAllMocks());

describe("lares vessel roster", () => {
  test("RED: the sub-door stands and puts the one read on the wire; CONTROL: it answers a pipe in prose, rotation first", async () => {
    expect(VESSEL_SUBS).toContain("roster");
    expect(PROSE_FIRST_READS).toContain("vessel roster");
    const r = await run(argv());
    expect(r.exit).toBe(0);
    expect(h.calls).toEqual([{ verb: "hearth-roster", args: {} }]);
    const lines = r.out.trimEnd().split("\n");
    expect(lines[0]).toBe("Lares hearth (who is home): 2 seats here · 1 heard from afar · 1 lane · 1 open votum");
    expect(lines[1]).toBe("rotation: this vessel wears h1, held by s-0a11bb02 (a hand (cli)) and s-f2c7aa01 (an AI seat (seat))");
    expect(r.out).toContain("bbbbbbbbbbbb  h1  last heard at claim cccccccccccc (3 acts, stands)");
    expect(r.out).toContain("h1 face-join (intent dddddddddddd, from bbbbbbbbbbbb, audience pinned): waits on an outcome, owed by bbbbbbbbbbbb (claimed)");
  });

  test("RED: json=true carries the roster whole; CONTROL: a refusal crosses by its own code", async () => {
    const r = await run(argv({ json: true }));
    const body = JSON.parse(r.out) as { ok: boolean; data: HearthRoster };
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(JSON.parse(JSON.stringify(ROSTER)));
    expect(Object.keys(body.data).sort()).toEqual(["asker", "counts", "grain", "lanes", "lanesGap", "more", "rotation", "seats", "unread", "vota"]);
    h.refuse = "vessel-locked: run `lares vault unlock`";
    const refused = await run(argv({ json: true }));
    expect(refused.exit).not.toBe(0);
    expect(refused.out).toContain("vessel-locked");
  });

  test("RED: the shared fixture's roster is the one mesh composes, and the CLI's json=true data carries it whole (the MCP seat's body, test_hearth_tools.py); CONTROL: its prose is the CLI's", async () => {
    const fixture = JSON.parse(readFileSync(resolve(__dirname, "../../lararium-sensorium/scripts/fixtures/hearth-roster.json"), "utf8")) as { input: Parameters<typeof composeHearthRoster>[0]; roster: HearthRoster; prose: string[] };
    expect(JSON.parse(JSON.stringify(composeHearthRoster(fixture.input)))).toEqual(fixture.roster);
    h.roster = fixture.roster;
    expect((JSON.parse((await run(argv({ json: true }))).out) as { data: unknown }).data).toEqual(fixture.roster);
    expect((await run(argv())).out.trimEnd().split("\n")).toEqual(fixture.prose);
  });
});
