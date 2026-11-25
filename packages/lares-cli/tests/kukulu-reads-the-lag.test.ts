/**
 * kukulu-reads-the-lag — every raise reads the house's lag aloud, and the owner's yes lays the checkout's workbench
 * projection, never canon (story U4, re-scoped under Mu: operator, 2026-11-22).
 *
 * After the restand, `lares rite kukulu` reads two gaps and names each: the canon bag behind the canon source (the
 * carriers in `bags/` the canon layers lack: canon fills through promote and the floor's sealed cut alone, so the raise
 * only names it) and each wiki's workbench behind the checkout's `wikis/<slug>`. Where the release the vessel runs
 * carries a newer seed (the seed offer) than it serves, the line names that by its own word, the floor card's title and the runnable line. Where the canon source stands in a checkout and
 * the owner holds a terminal, the raise previews the workbench lay (each title a mounted workbench would take) and lays
 * it on an explicit yes, into each wiki's working layer the worn face mounts; a workbench that does not mount is named
 * and left. No prompt ever writes the canon bag. A seat (no terminal, or an AI launcher) names the lag and lays nothing.
 *
 * The vessel half: `lares vessel lay --lag` reads both gaps off disk and the worn face's seats, writing nothing, and names the
 * floor's drift behind live canon beside them (`floorDrift`, its own field: lag keeps its meaning, an unread drift reads null); and
 * `lares vessel lay --workbench` walks the checkout's workbench waves alone (no holdings leg, no face roots, no kahua).
 *
 * Every rite port answers from a FAKE; the vessel half runs over a scratch LAR_ROOT (LAR_BAGS set per test, never globally).
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { riteKukulu, type HouseLag, type RitePorts, type StandReading } from "../src/rite-kukulu.js";
import type { ParsedArgs } from "../src/parse-args.js";
import type { MirrorDoors, MirrorWave } from "../src/seed-mirrors.js";

vi.mock("../src/commands/act.js", () => ({ cmdAct: vi.fn(async () => 0) }));
vi.mock("../src/commands/ingest.js", async (orig) => ({ ...(await orig<typeof import("../src/commands/ingest.js")>()), cmdIngest: vi.fn(async () => 0) }));

const HEAD = "a".repeat(40), IMAGE = "sha256:" + "ab".repeat(32);
const READING: StandReading = { revision: HEAD, image: IMAGE, how: "built", vessel: "standing", current: false, pulama: "off", lit: null, admitted: null, offer: false };
const ABSENT = { ok: false as const, code: "swarm-lei-absent", message: "no lei" };

const LAG: HouseLag = {
  source: "/workspace/bags",
  checkout: true,
  holdings: [{ holding: "lares", toBag: "lar:///ha.ka.ba/bags/lares", new: ["lar:///ha.ka.ba/lares/api/pono/fresh"], changed: ["lar:///ha.ka.ba/lares/api/pono/otakiage"] }],
  lag: 2,
  wikis: "/workspace/wikis",
  benches: [
    { slug: "sdm", toBag: "lar:///ha.ka.ba/wikis/sdm/working", planned: ["lar:///ha.ka.ba/sdm/notes/one", "lar:///ha.ka.ba/sdm/notes/two"], mounts: true },
    { slug: "lares", toBag: "lar:///ha.ka.ba/wikis/lares/working", planned: ["lar:///ha.ka.ba/lares/docs/x"], mounts: false, why: "the worn face holds no writer's seat there" },
  ],
  benchLag: 3,
};

/** The rite's ports with the lag ports beside them; every call recorded in order. */
function fakes(over: { lag?: HouseLag | null; tty?: boolean; seat?: boolean; yes?: boolean; lay?: number; raise?: number; seed?: string } = {}) {
  const calls: string[] = [], said: string[] = [];
  const ports: RitePorts = {
    checkout: async () => ({ head: HEAD, branch: "main" }),
    stage: async () => ({ code: 0, reading: READING }),
    raise: async () => { calls.push("raise"); return over.raise ?? 0; },
    tty: () => over.tty ?? true,
    row: async () => ABSENT,
    say: (line) => { said.push(line); },
    seat: () => over.seat ?? false,
    houseLag: async () => { calls.push("house-lag"); return over.lag === undefined ? LAG : over.lag; },
    ask: async (q) => { calls.push(`ask ${q}`); return over.yes ?? false; },
    layWorkbench: async () => { calls.push("lay-workbench"); return over.lay ?? 0; },
  };
  return { ports, calls, said };
}

describe("kukulu reads the lag on every raise and lays the workbench on the owner's yes", () => {
  it("RED: the lag line names both gaps: canon behind the canon source (it fills through promote), and each workbench behind the checkout's wikis/", async () => {
    const f = fakes({ yes: false });
    await riteKukulu(f.ports, {});
    const text = f.said.join("\n");
    expect(text).toMatch(/canon lags the canon source by 2 carrier\(s\) \(1 new, 1 changed\) in \/workspace\/bags; canon fills through promote and the floor's sealed cut, never from a raise/);
    // The lag line names the two commands that fill canon, so the cure sits on the line that names the lag.
    const lagLine = f.said.find((l) => l.includes("canon lags the canon source"))!;
    expect(lagLine).toContain("`lares meme offer promote <cid>`");
    expect(lagLine).toContain("`lares nexus release <manifest-file> --cut`");
    expect(text).toMatch(/the workbenches lag the checkout's \/workspace\/wikis by 3 carrier\(s\): sdm 2, lares 1/);
    expect(text).toMatch(/workbench lares does not mount under the worn face \(the worn face holds no writer's seat there\); nothing of it lays/);
  });

  it("RED: the owner's terminal over a checkout previews the workbench lay (each title a mounted workbench takes, canon untouched) before the yes, then lays it", async () => {
    const f = fakes({ yes: true });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls.map((c) => c.split(" ")[0])).toEqual(["raise", "house-lag", "ask", "lay-workbench"]);
    const text = f.said.join("\n");
    expect(text).toMatch(/the workbench lay carries each file under \/workspace\/wikis\/<slug> into that wiki's working layer; canon stays as it stands:/);
    expect(text).toMatch(/sdm -> lar:\/\/\/ha\.ka\.ba\/wikis\/sdm\/working: 2/);
    expect(text).toMatch(/lar:\/\/\/ha\.ka\.ba\/sdm\/notes\/one/);
    expect(text).not.toMatch(/lar:\/\/\/ha\.ka\.ba\/lares\/docs\/x/);
    expect(f.calls[2]).toMatch(/lay these 2 carrier\(s\) into the workbench now\?/);
    expect(out).toMatchObject({ code: 0, data: { raised: true, lag: { canon: 2, workbench: 3 }, workbench: { offered: 2, laid: true } } });
  });

  it("RED: no prompt ever writes the canon bag: a lag in canon alone asks nothing and lays nothing", async () => {
    const f = fakes({ lag: { ...LAG, benches: [], benchLag: 0 }, yes: true });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise", "house-lag"]);
    expect(out.data).not.toHaveProperty("canon");
    expect(f.said.join("\n")).toMatch(/the checkout's workbenches stand level with \/workspace\/wikis/);
  });

  it("RED: no yes, no lay: a no (or a Ctrl+C at the question) leaves every layer untouched and names the line that lays it later", async () => {
    const f = fakes({ yes: false });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).not.toContain("lay-workbench");
    expect(f.said.join("\n")).toMatch(/nothing laid; the workbench stands as it stood: lares vessel lay --workbench --apply lays it later/);
    expect(out).toMatchObject({ code: 0, data: { workbench: { laid: false } } });
  });

  it("RED: a seat with no terminal names the lag and never asks, never lays", async () => {
    const f = fakes({ tty: false, yes: true });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise", "house-lag"]);
    expect(f.said.join("\n")).toMatch(/this seat holds no terminal, so nothing lays; your hand: lares rite kukulu on a terminal \(or lares vessel lay --workbench --apply\)/);
    expect(out).toMatchObject({ code: 0, data: { workbench: { laid: false, seat: true } } });
  });

  it("RED: an AI launcher on a terminal is a seat too", async () => {
    const f = fakes({ seat: true, yes: true });
    await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise", "house-lag"]);
    expect(f.said.join("\n")).toMatch(/an AI seat launched this rite, so nothing lays/);
  });

  it("RED: a canon source in no checkout names the lag and offers nothing", async () => {
    const f = fakes({ lag: { ...LAG, source: "/elsewhere/bags", checkout: false }, yes: true });
    await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise", "house-lag"]);
    expect(f.said.join("\n")).toMatch(/\/elsewhere\/bags stands in no checkout, so the raise offers no lay/);
  });

  it("RED: a newer seed's floor names the seed offer by its own word, the card's title and the runnable line; CONTROL: a seed that stands the same names nothing", async () => {
    const CARD = "lar:///ha.ka.ba/lares/floor/0123456789ab";
    const offer = (floor: string) => async () => ({ record: { engine: "e", grammar: "g", plugins: "p", floor: "f1" }, seed: { cid: "bafyseed", digests: { engine: "e", grammar: "g", plugins: "p", floor } } });
    const f = fakes({ lag: { ...LAG, benches: [], benchLag: 0, holdings: [], lag: 0 } });
    const out = await riteKukulu({ ...f.ports, seedOffer: offer("f2"), floorCard: async () => ({ title: CARD }) } as RitePorts, {});
    const text = f.said.join("\n");
    expect(text).toContain("the seed offer waits (the seed's floor moved)");
    expect(text).toContain(CARD);
    expect(text).toContain("`lares vessel floor status --grain seed`");
    expect(text).not.toMatch(/newer sealed floor/);
    expect(out).toMatchObject({ data: { lag: { floor: "moved", card: CARD } } });
    // A vessel that answers no card still names the runnable line.
    const bare = fakes({ lag: { ...LAG, benches: [], benchLag: 0, holdings: [], lag: 0 } });
    await riteKukulu({ ...bare.ports, seedOffer: offer("f2"), floorCard: async () => null } as RitePorts, {});
    expect(bare.said.join("\n")).toContain("`lares vessel floor status --grain seed`");
    const same = fakes({ lag: { ...LAG, benches: [], benchLag: 0, holdings: [], lag: 0 } });
    await riteKukulu({ ...same.ports, seedOffer: offer("f1"), floorCard: async () => ({ title: CARD }) } as RitePorts, {});
    expect(same.said.join("\n")).not.toMatch(/seed offer waits/);
  });

  it("RED: level, and unread: each says so and asks nothing", async () => {
    const level = fakes({ lag: { ...LAG, holdings: [], lag: 0, benches: [], benchLag: 0 } });
    await riteKukulu(level.ports, {});
    expect(level.calls).toEqual(["raise", "house-lag"]);
    expect(level.said.join("\n")).toMatch(/canon stands level with \/workspace\/bags/);
    const unread = fakes({ lag: null });
    expect(await riteKukulu(unread.ports, {})).toMatchObject({ code: 0, data: { lag: { read: false } } });
    expect(unread.said.join("\n")).toMatch(/the lag reads nowhere/);
  });

  it("RED: a par landing reads green when the workbench lay after the yes answers non-zero: the lay waits, named, with its cure", async () => {
    const f = fakes({ yes: true, lay: 1 });
    const out = await riteKukulu(f.ports, {});
    // THE BALANCE ALREADY STANDS: the house landed par, so the lay's refusal reads as a warning, never the rite's red.
    expect(out).toMatchObject({ code: 0, data: { workbench: { laid: false }, warnings: ["workbench-lay-waits"] } });
    expect(out.data).not.toHaveProperty("refusal");
    expect(f.said.join("\n")).toMatch(/the workbench lay answered 1/);
    expect(f.said.join("\n")).toContain("lares vessel lay --workbench --apply runs again safely");
  });

  it("RED: a Ctrl+C during the workbench lay (exit 130) reads as interrupted, never failed", async () => {
    const f = fakes({ yes: true, lay: 130 });
    const out = await riteKukulu(f.ports, {});
    // The --json answer names it by its own code (`refusal` feeds the error code), never `rite-stopped-at-landing` nor the failed lay's.
    expect(out).toMatchObject({ code: 1, data: { workbench: { laid: false, interrupted: true }, refusal: "kukulu-workbench-lay-interrupted" } });
    expect(f.said.join("\n")).toMatch(/something interrupted the workbench lay; the house stands, and the lay reads diff-gated, so lares vessel lay --workbench --apply picks it up/);
  });

  it("CONTROL: a raise that fails reads no lag; ports with no lag read leave the answer as it stood", async () => {
    const f = fakes({ raise: 9, yes: true });
    await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise"]);
    const { houseLag: _l, ask: _a, layWorkbench: _w, ...bare } = fakes().ports;
    const out = await riteKukulu(bare, {});
    expect(out.data).not.toHaveProperty("lag");
  });
});

describe("the vessel half: `vessel lay --lag` and `vessel lay --workbench`", () => {
  let root: string;
  const prior = { root: process.env["LAR_ROOT"], bags: process.env["LAR_BAGS"] };
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lares-kukulu-lag-")); });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (prior.root === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior.root;
    if (prior.bags === undefined) delete process.env["LAR_BAGS"]; else process.env["LAR_BAGS"] = prior.bags;
  });

  /** A scratch corpus: `<root>/corpus/{bags,wikis}/notes/ha.ka.ba/notes/…`, the house root at `<root>/lar`. */
  function corpus(checkout: boolean): string {
    const dir = join(root, "corpus");
    mkdirSync(join(dir, "bags", "notes", "ha.ka.ba", "notes"), { recursive: true });
    writeFileSync(join(dir, "bags", "notes", "ha.ka.ba", "notes", "one.tid"), "title: lar:///ha.ka.ba/notes/one\n\nthe first\n");
    mkdirSync(join(dir, "wikis", "notes", "ha.ka.ba", "notes"), { recursive: true });
    writeFileSync(join(dir, "wikis", "notes", "ha.ka.ba", "notes", "two.tid"), "title: lar:///ha.ka.ba/notes/two\n\nthe second\n");
    if (checkout) writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages: []\n");
    process.env["LAR_ROOT"] = join(root, "lar");
    process.env["LAR_BAGS"] = join(dir, "bags");
    return dir;
  }

  /** The live doors with the vessel-side reads answered here: the seat, the faces, and every write door refusing. */
  async function doors(seat: { writeSlot: "working" | "personal" | null; bound: boolean }, waves: MirrorWave[] = []): Promise<MirrorDoors> {
    const { LIVE_MIRROR_DOORS } = await import("../src/seed-mirrors.js");
    const refuse = (name: string) => async () => { throw new Error(`${name} must not run`); };
    return {
      ...LIVE_MIRROR_DOORS,
      faces: async () => [],
      heldSlugs: async () => new Set<string>(),
      benchSeat: async () => seat,
      lay: async (wave, apply) => { waves.push(wave); return LIVE_MIRROR_DOORS.lay(wave, false).then((r) => (apply ? { ...r, landed: r.planned } : r)); },
      mintBag: refuse("mintBag"), kahuaLift: refuse("kahuaLift"), landShares: refuse("landShares"),
      shareRows: () => [{ kind: "wiki", slug: "shared", owner: "someone" } as never],
    };
  }

  it("RED (owner gate): worn face \"me\", sourced notes unbound, a share row naming another owner: the workbench lay waits it by name, and the lag never offers it", async () => {
    const { cmdLay, readHouseLag } = await import("../src/commands/lay.js");
    corpus(true);
    const waves: MirrorWave[] = [];
    const base = await doors({ writeSlot: null, bound: false }, waves);
    const owned: MirrorDoors = {
      ...base,
      faces: async () => [{ handleIndex: 1, petname: "me", relation: "f".repeat(64), handle: null, seat: false, chair: null, kahua: [], mounted: true }],
      shareRows: () => [{ kind: "wiki", slug: "notes", owner: "someone-else" } as never],
    };
    const out: string[] = [];
    const log = console.log;
    console.log = (...a: unknown[]) => { out.push(a.map(String).join(" ")); };
    try {
      expect(await cmdLay({ command: "vessel", positional: [], options: {}, flags: { workbench: true, apply: true } } as unknown as ParsedArgs, owned)).toBe(0);
    } finally { console.log = log; }
    expect(waves).toEqual([]);
    expect(out.join("\n")).toMatch(/the wiki notes re-stands at its owner's wear: wear someone-else/);
    const lag = await readHouseLag(owned);
    expect(lag.benches[0]).toMatchObject({ slug: "notes", mounts: false, why: expect.stringMatching(/someone-else/) });
  });

  it("RED: the lag reads canon behind the source, the workbench behind wikis/, and whether the worn face mounts it; CONTROL: no checkout reads checkout false", async () => {
    const { readHouseLag } = await import("../src/commands/lay.js");
    const dir = corpus(true);
    const lag = await readHouseLag(await doors({ writeSlot: "working", bound: true }));
    expect(lag).toMatchObject({ source: join(dir, "bags"), checkout: true, lag: 1, wikis: join(dir, "wikis"), benchLag: 1 });
    expect(lag.holdings).toEqual([{ holding: "notes", toBag: "lar:///ha.ka.ba/bags/notes", new: ["lar:///ha.ka.ba/notes/one"], changed: [] }]);
    expect(lag.benches).toEqual([{ slug: "notes", toBag: "lar:///ha.ka.ba/wikis/notes/working", planned: ["lar:///ha.ka.ba/notes/two"], mounts: true }]);
    const sealed = await readHouseLag(await doors({ writeSlot: null, bound: true }));
    expect(sealed.benches[0]).toMatchObject({ slug: "notes", mounts: false, why: expect.stringMatching(/no writer's seat/) });
    rmSync(join(dir, "pnpm-workspace.yaml"));
    expect(await readHouseLag(await doors({ writeSlot: "working", bound: true }))).toMatchObject({ checkout: false });
  });

  it("RED: `vessel lay --lag --json` answers the reading as one JSON line and writes nothing", async () => {
    const { cmdLay } = await import("../src/commands/lay.js");
    corpus(true);
    const waves: MirrorWave[] = [];
    const written: string[] = [];
    const write = process.stdout.write;
    process.stdout.write = ((chunk: unknown) => { written.push(String(chunk)); return true; }) as typeof process.stdout.write;
    try {
      expect(await cmdLay({ command: "vessel", positional: [], options: {}, flags: { lag: true, json: true } } as unknown as ParsedArgs, await doors({ writeSlot: "working", bound: true }, waves))).toBe(0);
    } finally { process.stdout.write = write; }
    const answer = JSON.parse(written.join("").trim().split("\n").at(-1)!) as { ok: boolean; data: HouseLag };
    expect(answer).toMatchObject({ ok: true, data: { checkout: true, lag: 1, benchLag: 1 } });
    const { cmdIngest } = await import("../src/commands/ingest.js");
    expect(cmdIngest).not.toHaveBeenCalled();
  });

  it("RED: `vessel lay --lag --json` names the floor's drift as its own field, never folded into lag; CONTROL: an unread drift reads null, not zero", async () => {
    const { cmdLay } = await import("../src/commands/lay.js");
    corpus(true);
    const CREST = "lar:///ha.ka.ba/lararium/mesh/wave-crest";
    const drift = { manifest: "f".repeat(64), count: 1, carriers: [CREST], slugs: [{ slug: "lararium", missing: [CREST], older: [] }], unread: [] };
    const answer = async (read: () => Promise<unknown>): Promise<{ ok: boolean; data: HouseLag & { floorDrift: unknown } }> => {
      const written: string[] = [];
      const write = process.stdout.write;
      process.stdout.write = ((chunk: unknown) => { written.push(String(chunk)); return true; }) as typeof process.stdout.write;
      try {
        expect(await cmdLay({ command: "vessel", positional: [], options: {}, flags: { lag: true, json: true } } as unknown as ParsedArgs, await doors({ writeSlot: "working", bound: true }), read as never)).toBe(0);
      } finally { process.stdout.write = write; }
      return JSON.parse(written.join("").trim().split("\n").at(-1)!) as { ok: boolean; data: HouseLag & { floorDrift: unknown } };
    };
    const read = await answer(async () => ({ drift }));
    expect(read.data).toMatchObject({ lag: 1, floorDrift: drift });
    expect(read.data).not.toHaveProperty("floorDriftWhy");
    const unread = await answer(async () => ({ drift: null, why: "no standing vessel answers the floor read" }));
    expect(unread.data).toMatchObject({ lag: 1, floorDriftWhy: "no standing vessel answers the floor read" });
    expect(unread.data).toHaveProperty("floorDrift", null);
    const thrown = await answer(async () => { throw new Error("the socket went"); });
    expect(thrown.data).toMatchObject({ floorDrift: null, floorDriftWhy: "the floor read faulted: the socket went" });
  });

  it("RED: the human lag names the floor's drift on its own line, by carrier; CONTROL: an unread drift says so", async () => {
    const { cmdLay } = await import("../src/commands/lay.js");
    corpus(true);
    const CREST = "lar:///ha.ka.ba/lararium/mesh/wave-crest";
    const human = async (read: () => Promise<unknown>): Promise<string[]> => {
      const out: string[] = [];
      const log = console.log;
      console.log = (...a: unknown[]) => { out.push(a.map(String).join(" ")); };
      try {
        expect(await cmdLay({ command: "vessel", positional: [], options: {}, flags: { lag: true, json: false } } as unknown as ParsedArgs, await doors({ writeSlot: "working", bound: true }), read as never)).toBe(0);
      } finally { console.log = log; }
      return out;
    };
    const lines = await human(async () => ({ drift: { manifest: "f".repeat(64), count: 1, carriers: [CREST], slugs: [{ slug: "lararium", missing: [CREST], older: [] }], unread: [] } }));
    expect(lines.some((l) => /^lay: canon lags .* by 1 carrier\(s\)/.test(l))).toBe(true);
    expect(lines).toContain("floor: the floor this vessel serves trails live canon by 1 carrier(s) · lararium 1 missing, 0 older");
    expect(lines).toContain(`  missing: ${CREST}`);
    expect(await human(async () => ({ drift: null, why: "no standing vessel answers the floor read" }))).toContain("floor: drift unread (no standing vessel answers the floor read)");
  });

  it("RED: `vessel lay --workbench --apply` lays the checkout's workbench waves alone: no holdings ingest, no face root, no share, no kahua", async () => {
    const { cmdLay } = await import("../src/commands/lay.js");
    const dir = corpus(true);
    // A face root under the projections root that the full mirror leg would read (and refuse: no face carries its pet name).
    mkdirSync(join(root, "lar", "projections", "faces", "ghost", "wikis", "daemon"), { recursive: true });
    writeFileSync(join(root, "lar", "projections", "faces", "ghost", "wikis", "daemon", "x.tid"), "title: x\n\nx\n");
    const waves: MirrorWave[] = [];
    const log = console.log;
    console.log = () => {};
    try {
      expect(await cmdLay({ command: "vessel", positional: [], options: {}, flags: { workbench: true, apply: true } } as unknown as ParsedArgs, await doors({ writeSlot: "working", bound: true }, waves))).toBe(0);
    } finally { console.log = log; }
    expect(waves.map((w) => [w.source, w.toBag])).toEqual([[join(dir, "wikis", "notes"), "lar:///ha.ka.ba/wikis/notes/working"]]);
    const { cmdIngest } = await import("../src/commands/ingest.js");
    expect(cmdIngest).not.toHaveBeenCalled();
  });
});
