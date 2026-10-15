/**
 * AN INGEST THAT LANDS NOTHING FOR A CONFLICT ENDS NON-ZERO.
 *
 * A person names a file to `lares ingest`. Where the disk and the records both moved past the file's base,
 * the gate lands nothing and answers `conflict`. An exit of zero there reads as "your words landed". The
 * door ends under the `conflict` exit class, names the carrier, and names the two doors that settle the
 * standoff under its key: `lares shore take-disk` and `lares shore take-records`.
 *
 * Control: a wave whose every carrier landed exits zero.
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  decide: (uri: string): Record<string, unknown> => ({ uri, decision: "ingest", grade: "clean", landed: 1 }),
}));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    const carriers = (args["carriers"] as Array<{ uri: string }>).map((c) => h.decide(c.uri));
    return { status: "done", requestId: "req-conflict-1", results: { summary: { ok: true, output: { carriers } } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdIngest } from "../src/commands/ingest.js";
import { exitFor } from "../src/render.js";

const TO = "lar:///ha.ka.ba/bags/x";
const URI = "lar:///ha.ka.ba/x/y";
let tmp = "";
const saved = { r: process.env["LAR_ROOT"], b: process.env["LAR_BAGS"], w: process.env["LAR_WIKIS"] };
afterEach(() => {
  if (tmp) { rmSync(tmp, { recursive: true, force: true }); tmp = ""; }
  for (const [k, v] of [["LAR_ROOT", saved.r], ["LAR_BAGS", saved.b], ["LAR_WIKIS", saved.w]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  h.calls.length = 0;
  h.decide = (uri) => ({ uri, decision: "ingest", grade: "clean", landed: 1 });
});

/** One scratch vessel root holding one carrier file, and the command run over it with `--apply --yes --json`. */
async function ingestOne(): Promise<{ rc: number; json: Record<string, unknown> }> {
  tmp = mkdtempSync(join(tmpdir(), "ingest-conflict-"));
  const dir = join(tmp, "bags", "x", "ha.ka.ba", "x");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "y.mem"), "a hand's words\n");
  process.env["LAR_ROOT"] = tmp; delete process.env["LAR_BAGS"]; delete process.env["LAR_WIKIS"];
  const lines: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((m: unknown) => { lines.push(String(m)); return true; });
  try {
    const rc = await cmdIngest({ command: "ingest", positional: [], options: { source: join(tmp, "bags", "x"), to: TO }, flags: { apply: true, yes: true, json: true } } as never);
    return { rc, json: JSON.parse(lines.join("")) as Record<string, unknown> };
  } finally { spy.mockRestore(); }
}

describe("lares ingest — a conflict lands nothing and the exit says so", () => {
  test("★ a carrier that stands in a conflict ends the run under the conflict exit class and names both doors ★", async () => {
    h.decide = (uri) => ({ uri, decision: "conflict", reason: "both-moved", grade: "clean", warnings: [`${uri}: the arriving text and the records both moved past the base the writer read (both-moved)`] });
    const { rc, json } = await ingestOne();
    expect(h.calls.map((c) => c.verb)).toEqual(["INGEST"]);
    expect(rc, "an ingest that landed nothing for a conflict exited zero").toBe(exitFor("conflict"));
    expect(rc).not.toBe(0);
    expect(json["ok"]).toBe(false);
    const error = json["error"] as { code: string; message: string };
    expect(error.code).toBe("conflict");
    expect(error.message).toContain(URI);
    expect(error.message).toContain("lares shore take-disk");
    expect(error.message).toContain("lares shore take-records");
    expect((json["data"] as { conflicts: Array<{ uri: string; why: string }> }).conflicts.map((c) => c.uri)).toEqual([URI]);
  });

  test("CONTROL: a wave whose every carrier landed exits zero", async () => {
    const { rc, json } = await ingestOne();
    expect(rc).toBe(0);
    expect(json["ok"]).toBe(true);
  });

  test("the wave a person names rides attended: it carries no `unattended` mark", async () => {
    await ingestOne();
    expect(h.calls[0]!.args).not.toHaveProperty("unattended");
  });
});
