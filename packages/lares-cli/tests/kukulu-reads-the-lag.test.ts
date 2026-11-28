/**
 * kukulu-reads-the-lag — every raise reads the house's lag, and a household's canon follows the head the raise stood (operator
 * ruling 2026-11-28: the disk stands as one more replica; ingest retires as scaffold).
 *
 * After the restand, `lares rite kukulu` reads the canon bags behind the canon source. WHERE THE CANON SOURCE STANDS IN A CHECKOUT
 * (a household), the rite asks the vessel to lay the checkout's holdings into their canon bags at this head (`canonFollow`, the
 * vessel's `lares vessel lay --canon`), under the license the rite's lei carries, so a seat's rite lays too, and every carrier the
 * head switch carried off tombstones; the lag line and its promote/cut hint burn for a household. A SHARED TIER (a canon source in no
 * checkout) keeps the lag line: its canon fills through promote and the floor's sealed cut. Where the release the vessel runs carries
 * a newer seed than it serves, the line names that by its own word, the floor card's title and the runnable line.
 *
 * The vessel half: `lares vessel lay --lag` reads the gaps off disk and the worn face's seats, writing nothing, and names the floor's
 * drift behind live canon beside them (`floorDrift`, its own field); and `lares vessel lay --canon` lays the holdings leg alone,
 * applied, then answers every pending removal in a bag it fed with one batch remove (fork 3), refusing a canon source in no checkout.
 *
 * Every rite port answers from a FAKE; the vessel half runs over a scratch LAR_ROOT (LAR_BAGS set per test, never globally).
 * Meme: lar:///ha.ka.ba/kahua/memory/wave/kukulu-carries-canon
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { riteKukulu, type CanonFollowReading, type HouseLag, type RitePorts, type StandReading } from "../src/rite-kukulu.js";
import type { ParsedArgs } from "../src/parse-args.js";
import type { MirrorDoors, MirrorWave } from "../src/seed-mirrors.js";

vi.mock("../src/commands/act.js", () => ({ cmdAct: vi.fn(async () => 0) }));
vi.mock("../src/commands/ingest.js", async (orig) => ({ ...(await orig<typeof import("../src/commands/ingest.js")>()), cmdIngest: vi.fn(async () => 0) }));

const HEAD = "a".repeat(40), IMAGE = "sha256:" + "ab".repeat(32);
const READING: StandReading = { revision: HEAD, image: IMAGE, how: "built", vessel: "standing", current: false, pulama: "off", lit: null, admitted: null, offer: false };
const ABSENT = { ok: false as const, code: "swarm-lei-absent", message: "no lei" };
const LARES = "lar:///ha.ka.ba/bags/lares";

const LAG: HouseLag = {
  source: "/workspace/bags",
  checkout: true,
  holdings: [{ holding: "lares", toBag: LARES, new: ["lar:///ha.ka.ba/lares/api/pono/fresh"], changed: ["lar:///ha.ka.ba/lares/api/pono/otakiage"] }],
  lag: 2,
  wikis: "/workspace/wikis",
  benches: [{ slug: "sdm", toBag: "lar:///ha.ka.ba/wikis/sdm/working", planned: ["lar:///ha.ka.ba/sdm/notes/one"], mounts: true }],
  benchLag: 1,
};

const FOLLOWED: CanonFollowReading = { holdings: [{ holding: "lares", toBag: LARES, exitCode: 0 }, { holding: "lararium", toBag: "lar:///ha.ka.ba/bags/lararium", exitCode: 0 }], tombstoned: { [LARES]: 3 }, refused: [] };

/** The rite's ports with the lag and canon-follow ports beside them; every call recorded in order. */
function fakes(over: { lag?: HouseLag | null; tty?: boolean; follow?: CanonFollowReading | null; raise?: number } = {}) {
  const calls: string[] = [], said: string[] = [];
  const ports: RitePorts = {
    checkout: async () => ({ head: HEAD, branch: "main" }),
    stage: async () => ({ code: 0, reading: READING }),
    raise: async () => { calls.push("raise"); return over.raise ?? 0; },
    tty: () => over.tty ?? true,
    row: async () => ABSENT,
    say: (line) => { said.push(line); },
    houseLag: async () => { calls.push("house-lag"); return over.lag === undefined ? LAG : over.lag; },
    canonFollow: async () => { calls.push("canon-follow"); return over.follow === undefined ? FOLLOWED : over.follow; },
  };
  return { ports, calls, said };
}

describe("kukulu: a household's canon follows the head the raise stood (wave/kukulu-carries-canon)", () => {
  it("RED: a raise over a checkout whose bags/ moved lays the checkout's holdings into canon at this head, and the head switch's vanishes tombstone", async () => {
    const f = fakes();
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise", "house-lag", "canon-follow"]);
    const text = f.said.join("\n");
    expect(text).toMatch(/canon follows the checkout at this head: 2\/2 holding\(s\) laid from \/workspace\/bags \(1 new, 1 changed before the lay\) · 3 carrier\(s\) the head switch carried off tombstone/);
    expect(text).toContain(`${LARES}: 3 tombstoned`);
    expect(out).toMatchObject({ code: 0, data: { raised: true, lag: { canon: 2, checkout: true }, canon: { followed: true, holdings: 2, failed: 0, tombstoned: 3 } } });
  });

  it("RED: a household burns the lag line and its promote/cut hint, and every workbench line: the checkout watch carries the benches", async () => {
    const f = fakes();
    await riteKukulu(f.ports, {});
    const text = f.said.join("\n");
    expect(text).not.toMatch(/canon lags the canon source/);
    expect(text).not.toMatch(/lares meme offer promote|--cut/);
    expect(text).not.toMatch(/workbench/);
  });

  it("RED: the lei licenses the follow: a seat with no terminal lays canon too", async () => {
    const f = fakes({ tty: false });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise", "house-lag", "canon-follow"]);
    expect(out).toMatchObject({ code: 0, data: { canon: { followed: true } } });
  });

  it("CONTROL: a shared tier (a canon source in no checkout) keeps the lag line with its promote/cut cure, and follows nothing", async () => {
    const f = fakes({ lag: { ...LAG, source: "/elsewhere/bags", checkout: false } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise", "house-lag"]);
    const lagLine = f.said.find((l) => l.includes("canon lags the canon source"))!;
    expect(lagLine).toMatch(/by 2 carrier\(s\) \(1 new, 1 changed\) in \/elsewhere\/bags; a shared tier's canon fills through promote and the floor's sealed cut, never from a raise/);
    expect(lagLine).toContain("`lares meme offer promote <cid>`");
    expect(lagLine).toContain("`lares nexus release <manifest-file> --cut`");
    expect(out.data).not.toHaveProperty("canon");
    const level = fakes({ lag: { ...LAG, checkout: false, holdings: [], lag: 0 } });
    await riteKukulu(level.ports, {});
    expect(level.said.join("\n")).toMatch(/canon stands level with \/workspace\/bags/);
  });

  it("RED: a par landing reads green when a holding's lay refuses: the follow waits, named, with its cure", async () => {
    const f = fakes({ follow: { holdings: [{ holding: "lares", toBag: LARES, exitCode: 4, reason: "kahu-reach" }], tombstoned: {}, refused: [`${LARES}: 2 pending removal(s) stand (hand-act-only); \`lares shore remove --all --count 2 --bag ${LARES}\` tombstones them`] } });
    const out = await riteKukulu(f.ports, {});
    expect(out).toMatchObject({ code: 0, data: { canon: { followed: false, failed: 1 }, warnings: ["canon-follow-waits"] } });
    expect(out.data).not.toHaveProperty("refusal");
    const text = f.said.join("\n");
    expect(text).toMatch(/lares: the lay answered 4 \(kahu-reach\)/);
    expect(text).toContain("lares shore remove --all --count 2");
    expect(text).toContain("lares vessel lay --canon runs again safely");
  });

  it("RED: a follow that answers no reading, and a rite that carries no follow port, each name the line that lays canon at this head", async () => {
    const silent = fakes({ follow: null });
    expect(await riteKukulu(silent.ports, {})).toMatchObject({ code: 0, data: { canon: { followed: false }, warnings: ["canon-follow-waits"] } });
    expect(silent.said.join("\n")).toMatch(/the canon follow answered no reading; .*lares vessel lay --canon lays canon at this head safely/);
    const { canonFollow: _c, ...bare } = fakes().ports;
    expect(await riteKukulu(bare, {})).toMatchObject({ code: 0, data: { canon: { followed: false } } });
  });

  it("RED: a newer seed's floor names the seed offer by its own word, the card's title and the runnable line; CONTROL: a seed that stands the same names nothing", async () => {
    const CARD = "lar:///ha.ka.ba/lares/floor/0123456789ab";
    const offer = (floor: string) => async () => ({ record: { engine: "e", grammar: "g", lararium: "l", plugins: "p", floor: "f1" }, seed: { cid: "bafyseed", digests: { engine: "e", grammar: "g", lararium: "l", plugins: "p", floor } } });
    const f = fakes({ lag: { ...LAG, holdings: [], lag: 0 } });
    const out = await riteKukulu({ ...f.ports, seedOffer: offer("f2"), floorCard: async () => ({ title: CARD }) } as RitePorts, {});
    const text = f.said.join("\n");
    expect(text).toContain("the seed offer waits (the seed's floor moved)");
    expect(text).toContain(CARD);
    expect(text).toContain("`lares vessel floor status --grain seed`");
    expect(out).toMatchObject({ data: { lag: { floor: "moved", card: CARD } } });
    const bare = fakes({ lag: { ...LAG, holdings: [], lag: 0 } });
    await riteKukulu({ ...bare.ports, seedOffer: offer("f2"), floorCard: async () => null } as RitePorts, {});
    expect(bare.said.join("\n")).toContain("`lares vessel floor status --grain seed`");
    const same = fakes({ lag: { ...LAG, holdings: [], lag: 0 } });
    await riteKukulu({ ...same.ports, seedOffer: offer("f1"), floorCard: async () => ({ title: CARD }) } as RitePorts, {});
    expect(same.said.join("\n")).not.toMatch(/seed offer waits/);
  });

  it("RED: an unread lag says so and follows nothing", async () => {
    const unread = fakes({ lag: null });
    expect(await riteKukulu(unread.ports, {})).toMatchObject({ code: 0, data: { lag: { read: false } } });
    expect(unread.calls).toEqual(["raise", "house-lag"]);
    expect(unread.said.join("\n")).toMatch(/the lag reads nowhere/);
  });

  it("CONTROL: a raise that fails reads no lag; ports with no lag read leave the answer as it stood", async () => {
    const f = fakes({ raise: 9 });
    await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["raise"]);
    const { houseLag: _l, canonFollow: _c, ...bare } = fakes().ports;
    const out = await riteKukulu(bare, {});
    expect(out.data).not.toHaveProperty("lag");
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

  it("RED (owner gate): worn face \"me\", sourced notes unbound, a share row naming another owner: the lag never offers its workbench", async () => {
    const { readHouseLag } = await import("../src/commands/lay.js");
    corpus(true);
    const base = await doors({ writeSlot: null, bound: false });
    const owned: MirrorDoors = {
      ...base,
      faces: async () => [{ handleIndex: 1, petname: "me", relation: "f".repeat(64), handle: null, seat: false, chair: null, kahua: [], mounted: true }],
      shareRows: () => [{ kind: "wiki", slug: "notes", owner: "someone-else" } as never],
    };
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

  /** A shore that lists `pending` and records each remove it answers. */
  function shoreOf(pending: Array<Record<string, unknown>>, removes: Array<Record<string, unknown>>, refuse?: string) {
    return async () => async (a: Readonly<Record<string, unknown>>) => {
      if (a["op"] === "list") return { ok: true, output: { standoffs: [], pending, standoffCount: 0, pendingCount: pending.length, mark: "m1" }, refusal: null, why: null };
      removes.push({ ...a });
      return refuse === undefined ? { ok: true, output: {}, refusal: null, why: null } : { ok: false, output: {}, refusal: refuse, why: "a hand answers" };
    };
  }

  it("RED: `vessel lay --canon` lays the holdings leg alone, applied, then tombstones each pending removal in a bag it fed with one batch remove", async () => {
    const { cmdLayCanon } = await import("../src/commands/lay.js");
    const { cmdIngest } = await import("../src/commands/ingest.js");
    const dir = corpus(true);
    const NOTES = "lar:///ha.ka.ba/bags/notes";
    const removes: Array<Record<string, unknown>> = [];
    const pending = [{ bagId: NOTES, uri: "lar:///ha.ka.ba/notes/gone-a" }, { bagId: NOTES, uri: "lar:///ha.ka.ba/notes/gone-b" }, { bagId: "lar:///ha.ka.ba/bags/elsewhere", uri: "lar:///x" }];
    const written: string[] = [];
    const write = process.stdout.write, log = console.log;
    process.stdout.write = ((chunk: unknown) => { written.push(String(chunk)); return true; }) as typeof process.stdout.write;
    console.log = () => {};
    try {
      expect(await cmdLayCanon({ command: "vessel", positional: [], options: {}, flags: { canon: true, json: true } } as unknown as ParsedArgs, join(dir, "bags"), shoreOf(pending, removes))).toBe(0);
    } finally { process.stdout.write = write; console.log = log; }
    expect(cmdIngest).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ source: join(dir, "bags", "notes"), to: NOTES }), flags: expect.objectContaining({ apply: true, yes: true }) }), expect.anything());
    // Only the fed bag's removals tombstone, in one batch naming the count the shore listed.
    expect(removes).toEqual([{ op: "remove", all: true, count: 2, bag: NOTES }]);
    const answer = JSON.parse(written.join("").trim().split("\n").at(-1)!) as { ok: boolean; data: CanonFollowReading };
    expect(answer).toMatchObject({ ok: true, data: { holdings: [{ holding: "notes", toBag: NOTES, exitCode: 0 }], tombstoned: { [NOTES]: 2 }, refused: [] } });
  });

  it("RED: a shore that refuses the batch remove names the cure and the follow exits 1, the answer still ok so the rite reads its rows", async () => {
    const { cmdLayCanon } = await import("../src/commands/lay.js");
    const dir = corpus(true);
    const NOTES = "lar:///ha.ka.ba/bags/notes";
    const removes: Array<Record<string, unknown>> = [];
    const written: string[] = [];
    const write = process.stdout.write, log = console.log;
    process.stdout.write = ((chunk: unknown) => { written.push(String(chunk)); return true; }) as typeof process.stdout.write;
    console.log = () => {};
    try {
      expect(await cmdLayCanon({ command: "vessel", positional: [], options: {}, flags: { canon: true, json: true } } as unknown as ParsedArgs, join(dir, "bags"), shoreOf([{ bagId: NOTES, uri: "lar:///ha.ka.ba/notes/gone" }], removes, "hand-act-only"))).toBe(1);
    } finally { process.stdout.write = write; console.log = log; }
    const answer = JSON.parse(written.join("").trim().split("\n").at(-1)!) as { ok: boolean; data: CanonFollowReading };
    expect(answer.ok).toBe(true);
    expect(answer.data.tombstoned).toEqual({});
    expect(answer.data.refused[0]).toContain(`lares shore remove --all --count 1 --bag ${NOTES}`);
  });

  it("CONTROL: a canon source in no checkout keeps a shared tier: `--canon` refuses canon-source-shared and lays nothing", async () => {
    const { cmdLayCanon } = await import("../src/commands/lay.js");
    const { cmdIngest } = await import("../src/commands/ingest.js");
    const dir = corpus(false);
    vi.mocked(cmdIngest).mockClear();
    const err = console.error;
    const said: string[] = [];
    console.error = (...a: unknown[]) => { said.push(a.map(String).join(" ")); };
    try {
      expect(await cmdLayCanon({ command: "vessel", positional: [], options: {}, flags: { canon: true } } as unknown as ParsedArgs, join(dir, "bags"), shoreOf([], []))).toBe(2);
    } finally { console.error = err; }
    expect(said.join("\n")).toMatch(/canon-source-shared: .* stands in no checkout/);
    expect(cmdIngest).not.toHaveBeenCalled();
  });
});
