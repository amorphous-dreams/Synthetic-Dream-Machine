/**
 * kukulu-lays-canon — the raise offers the canon lay inside the hand act the owner already performs (story U4,
 * `lar:///ha.ka.ba/kahua/memory/course/held-forks-told-as-stories`).
 *
 * After the restand, `lares rite kukulu` reads the canon lag (the carriers in the canon source's `bags/` the canon layers
 * lack, new or changed) and prints it on every raise. Where the canon source stands in a checkout and the owner holds a
 * terminal, it shows the lay's preview (every new and changed title, and the hazard: every file under `bags/<slug>`
 * enters canon) and lays only on an explicit yes. A seat (no terminal, or an AI launcher) names the lag and never lays;
 * a canon source in no checkout names the lag and offers nothing.
 *
 * The vessel half: `lares vessel lay --lag` reads the lag off disk (the Synced tree against `bags/`), writes nothing; and
 * `lares vessel lay --canon` walks the holdings leg alone, never the mirror leg.
 *
 * Every rite port answers from a FAKE; the vessel half runs over a scratch LAR_ROOT (LAR_BAGS set per test, never globally).
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { riteKukulu, type CanonLag, type RitePorts, type StandReading } from "../src/rite-kukulu.js";
import type { ParsedArgs } from "../src/parse-args.js";

vi.mock("../src/commands/act.js", () => ({ cmdAct: vi.fn(async () => 0) }));
vi.mock("../src/commands/ingest.js", async (orig) => ({ ...(await orig<typeof import("../src/commands/ingest.js")>()), cmdIngest: vi.fn(async () => 0) }));

const HEAD = "a".repeat(40), IMAGE = "sha256:" + "ab".repeat(32);
const READING: StandReading = { revision: HEAD, image: IMAGE, how: "built", vessel: "standing", current: false, pulama: "off", lit: null, admitted: null, offer: false };
const ABSENT = { ok: false as const, code: "swarm-lei-absent", message: "no lei" };

const LAG: CanonLag = {
  source: "/workspace/bags",
  checkout: true,
  holdings: [
    { holding: "lares", toBag: "lar:///ha.ka.ba/bags/lares", new: ["lar:///ha.ka.ba/lares/api/pono/fresh"], changed: ["lar:///ha.ka.ba/lares/api/pono/otakiage"] },
    { holding: "sdm", toBag: "lar:///ha.ka.ba/bags/sdm", new: [], changed: [] },
  ],
  lag: 2,
};

/** The rite's ports with the canon ports beside them; every call recorded in order. */
function fakes(over: { lag?: CanonLag | null; tty?: boolean; seat?: boolean; yes?: boolean; lay?: number; raise?: number } = {}) {
  const calls: string[] = [], said: string[] = [];
  const ports: RitePorts = {
    checkout: async () => ({ head: HEAD, branch: "main" }),
    stage: async () => ({ code: 0, reading: READING }),
    raise: async () => { calls.push("raise"); return over.raise ?? 0; },
    tty: () => over.tty ?? true,
    row: async () => ABSENT,
    say: (line) => { said.push(line); },
    seat: () => over.seat ?? false,
    canonLag: async () => { calls.push("canon-lag"); return over.lag === undefined ? LAG : over.lag; },
    ask: async (q) => { calls.push(`ask ${q}`); return over.yes ?? false; },
    layCanon: async () => { calls.push("lay-canon"); return over.lay ?? 0; },
  };
  return { ports, calls, said };
}

describe("kukulu offers the canon lay on the owner's yes", () => {
  it("RED: a checkout-sourced canon on the owner's terminal shows the preview (each new and changed title, the hazard) before the yes, then lays", async () => {
    const f = fakes({ yes: true });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls.map((c) => c.split(" ")[0])).toEqual(["raise", "canon-lag", "ask", "lay-canon"]);
    const text = f.said.join("\n");
    expect(text).toMatch(/canon lags the canon source by 2 carrier\(s\) \(1 new, 1 changed\) in \/workspace\/bags/);
    expect(text).toMatch(/every file under \/workspace\/bags\/<holding> enters canon/);
    expect(text).toMatch(/NEW\s+lar:\/\/\/ha\.ka\.ba\/lares\/api\/pono\/fresh/);
    expect(text).toMatch(/CHANGED\s+lar:\/\/\/ha\.ka\.ba\/lares\/api\/pono\/otakiage/);
    // The preview lands before the question.
    expect(f.calls[2]).toMatch(/lay these 2 carrier\(s\) into canon now\?/);
    expect(out).toMatchObject({ code: 0, data: { raised: true, canon: { lag: 2, checkout: true, laid: true } } });
  });

  it("RED: no yes, no lay: a no (or a Ctrl+C at the question) leaves canon untouched and names the line that lays it later", async () => {
    const f = fakes({ yes: false });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).not.toContain("lay-canon");
    expect(f.said.join("\n")).toMatch(/nothing laid; canon stands as it stood, 2 carrier\(s\) behind: lares vessel lay --canon --apply/);
    expect(out).toMatchObject({ code: 0, data: { canon: { lag: 2, laid: false } } });
  });

  it("RED: a seat with no terminal names the lag and never asks, never lays", async () => {
    const f = fakes({ tty: false, yes: true });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise", "canon-lag"]);
    expect(f.said.join("\n")).toMatch(/canon lags the canon source by 2 carrier\(s\)[\s\S]*this seat holds no terminal, so nothing lays; your hand: lares rite kukulu on a terminal \(or lares vessel lay --canon --apply\)/);
    expect(out).toMatchObject({ code: 0, data: { canon: { lag: 2, laid: false, seat: true } } });
  });

  it("RED: an AI launcher on a terminal is a seat too: it names the lag and never lays", async () => {
    const f = fakes({ tty: true, seat: true, yes: true });
    await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise", "canon-lag"]);
    expect(f.said.join("\n")).toMatch(/an AI seat launched this rite, so nothing lays/);
  });

  it("RED: a canon source in no checkout names the lag aloud and offers nothing", async () => {
    const f = fakes({ lag: { ...LAG, source: "/elsewhere/bags", checkout: false }, yes: true });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise", "canon-lag"]);
    expect(f.said.join("\n")).toMatch(/canon lags the canon source by 2 carrier\(s\)[\s\S]*\/elsewhere\/bags stands in no checkout, so the raise offers no lay/);
    expect(out).toMatchObject({ code: 0, data: { canon: { lag: 2, checkout: false, laid: false } } });
  });

  it("RED: a level canon says so and asks nothing; a lag that reads nowhere says so and asks nothing", async () => {
    const level = fakes({ lag: { ...LAG, holdings: [], lag: 0 } });
    expect(await riteKukulu(level.ports, {})).toMatchObject({ code: 0, data: { canon: { lag: 0 } } });
    expect(level.calls).toEqual(["raise", "canon-lag"]);
    expect(level.said.join("\n")).toMatch(/canon stands level with \/workspace\/bags/);
    const unread = fakes({ lag: null });
    expect(await riteKukulu(unread.ports, {})).toMatchObject({ code: 0, data: { canon: { read: false } } });
    expect(unread.calls).toEqual(["raise", "canon-lag"]);
    expect(unread.said.join("\n")).toMatch(/the canon lag reads nowhere/);
  });

  it("RED: a lay that fails after the yes names it, and the rite answers non-zero", async () => {
    const f = fakes({ yes: true, lay: 1 });
    const out = await riteKukulu(f.ports, {});
    expect(out).toMatchObject({ code: 1, data: { canon: { laid: false }, refusal: "kukulu-canon-lay-failed" } });
    expect(f.said.join("\n")).toMatch(/the canon lay answered 1/);
  });

  it("CONTROL: a raise that fails reads no lag and offers nothing; ports with no canon read leave the answer as it stood", async () => {
    const f = fakes({ raise: 9, yes: true });
    await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise"]);
    const { canonLag: _l, ask: _a, layCanon: _c, ...bare } = fakes().ports;
    const out = await riteKukulu(bare, {});
    expect(out.data).not.toHaveProperty("canon");
  });
});

describe("the vessel half: `vessel lay --lag` and `vessel lay --canon`", () => {
  let root: string;
  const prior = { root: process.env["LAR_ROOT"], bags: process.env["LAR_BAGS"] };
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lares-kukulu-lag-")); });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (prior.root === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior.root;
    if (prior.bags === undefined) delete process.env["LAR_BAGS"]; else process.env["LAR_BAGS"] = prior.bags;
  });

  /** A scratch corpus: `<root>/<corpus>/bags/notes/ha.ka.ba/notes/one.tid`, the house root at `<root>/lar`. */
  function corpus(checkout: boolean): string {
    const dir = join(root, "corpus");
    mkdirSync(join(dir, "bags", "notes", "ha.ka.ba", "notes"), { recursive: true });
    writeFileSync(join(dir, "bags", "notes", "ha.ka.ba", "notes", "one.tid"), "title: lar:///ha.ka.ba/notes/one\n\nthe first\n");
    if (checkout) writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages: []\n");
    process.env["LAR_ROOT"] = join(root, "lar");
    process.env["LAR_BAGS"] = join(dir, "bags");
    return dir;
  }

  it("RED: the lag counts what canon lacks off disk and names a checkout source by its pnpm-workspace.yaml; CONTROL: no checkout reads checkout false", async () => {
    const { readCanonLag } = await import("../src/commands/lay.js");
    const dir = corpus(true);
    const lag = readCanonLag();
    expect(lag).toMatchObject({ source: join(dir, "bags"), checkout: true, lag: 1 });
    expect(lag.holdings).toEqual([{ holding: "notes", toBag: "lar:///ha.ka.ba/bags/notes", new: ["lar:///ha.ka.ba/notes/one"], changed: [] }]);
    rmSync(join(dir, "pnpm-workspace.yaml"));
    expect(readCanonLag()).toMatchObject({ checkout: false, lag: 1 });
  });

  it("RED: `vessel lay --lag --json` answers the reading as one JSON line and writes nothing", async () => {
    const { cmdLay } = await import("../src/commands/lay.js");
    corpus(true);
    const written: string[] = [];
    const write = process.stdout.write;
    process.stdout.write = ((chunk: unknown) => { written.push(String(chunk)); return true; }) as typeof process.stdout.write;
    try {
      expect(await cmdLay({ command: "vessel", positional: [], options: {}, flags: { lag: true, json: true } } as unknown as ParsedArgs)).toBe(0);
    } finally { process.stdout.write = write; }
    const answer = JSON.parse(written.join("").trim().split("\n").at(-1)!) as { ok: boolean; data: CanonLag };
    expect(answer).toMatchObject({ ok: true, data: { checkout: true, lag: 1 } });
    const { cmdIngest } = await import("../src/commands/ingest.js");
    expect(cmdIngest).not.toHaveBeenCalled();
  });

  it("RED: `vessel lay --canon` walks the holdings leg alone and never touches the mirror leg", async () => {
    const { cmdLay } = await import("../src/commands/lay.js");
    corpus(true);
    const touched: string[] = [];
    const doors = new Proxy({}, { get: (_t, name) => { touched.push(String(name)); return () => { throw new Error(`mirror door ${String(name)} touched`); }; } });
    const log = console.log;
    console.log = () => {};
    try {
      expect(await cmdLay({ command: "vessel", positional: [], options: {}, flags: { canon: true, apply: true, yes: true } } as unknown as ParsedArgs, doors as never)).toBe(0);
    } finally { console.log = log; }
    expect(touched).toEqual([]);
  });
});
