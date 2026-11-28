/**
 * lei-terms — `lares lei terms kui|restring|unstring`: the one line of terms the pūlama's hand door takes.
 *
 * A vessel under a pūlama sends its lei acts to the pūlama (`pulama-main.js lei <act> '<terms>'`), which opens no document,
 * so the host hands it what the vessel knows: the face, and for a restring the line's tip as `after`. The host shim parses
 * no JSON, so this verb prints the terms whole, one stdout line, and writes nothing and asks no route. The face reads from
 * `--face`, else for a keep the keep's face (the face whose keep lei stands, else h0), else the vessel's daemon mount face.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

const seam = vi.hoisted(() => ({
  calls: [] as Array<[string, Record<string, unknown>]>,
  lines: {} as Record<number, Record<string, unknown>>,
  mount: 0,
  open: [0] as number[],
  shut: [] as number[],
}));
vi.mock("../src/store-door.js", () => ({
  storeVerb: async (verb: string, args: Record<string, unknown>, _refusal?: unknown, _standing?: unknown, route?: unknown) => {
    seam.calls.push([verb, route === undefined ? args : { ...args, route }]);
    if (verb === "swarm-lei-kui") return { output: { rite: args["rite"], branch: args["branch"], lei: `cid-h${String(args["face"])}` }, via: "vessel" };
    return { output: { lei: seam.lines[Number(args["face"])] ?? { standing: false, refusal: "absent", after: null } }, via: "vessel" };
  },
  storeFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  StoreDoorRefusal: class extends Error {},
}));
vi.mock("../src/sealed-act-door.js", () => ({
  sealedAct: async (act: string, args: Record<string, unknown>) => { seam.calls.push([act, args]); return { face: seam.mount }; },
}));
// ONE ROUTE per act: the every-face kui gathers it once and hands it to each face's row.
vi.mock("../src/ward-door.js", () => ({
  gatherWardRoute: async (what: string) => { seam.calls.push(["route", { what }]); return [{ kind: "passphrase", passphrase: "the-route" }]; },
}));
vi.mock("../src/custody-door.js", () => ({
  houseFaces: async () => { seam.calls.push(["census", {}]); return { open: seam.open, shut: seam.shut }; },
}));

import { it, test } from "../../lararium-node/tests/support/scratch-fixture.js";
import { cmdLei, leiTerms, LeiTermsRefused, LeiUsage, type LeiTermsPorts } from "../src/commands/lei.js";
import { helpLines } from "../src/command-help.js";
import { parseArgs } from "../src/parse-args.js";

const TIP = "b".repeat(64), CID = "c".repeat(64), HEAD = "d".repeat(40);
const lineAt = (after: string | null, extra: Record<string, unknown> = {}) => ({ standing: after !== null, reach: "wide", returnsLeft: 2, after, ...extra });

/** Fake ports over the seam: the swarm-show row by face, the census, the mount. */
const ports: LeiTermsPorts = {
  show: async (rite, branch, face) => { seam.calls.push(["swarm-show", { rite, branch, face }]); return { ok: true, output: { lei: seam.lines[face] ?? { standing: false, refusal: "absent", after: null } } }; },
  houseFaces: async () => ({ open: seam.open, shut: seam.shut }),
  mountFace: async () => { seam.calls.push(["mount", {}]); return seam.mount; },
};
const terms = (...line: string[]) => leiTerms(parseArgs(["lei", "terms", ...line]), ports);
const refusal = (run: Promise<unknown>): Promise<string> => run.then(() => "no refusal", (e: unknown) =>
  e instanceof LeiTermsRefused ? e.code : e instanceof LeiUsage ? "usage" : `threw ${String(e)}`);

beforeEach(() => { seam.calls = []; seam.lines = {}; seam.mount = 0; seam.open = [0]; seam.shut = []; });
afterEach(() => { vi.restoreAllMocks(); });

describe("lares lei terms prints the pūlama's terms, one line", () => {
  test("RED: kui wide names the face, rite, branch, returns and the after it follows (null for the line's first); the face reads the daemon mount where none is named", async () => {
    seam.mount = 2;
    expect(JSON.stringify(await terms("kui", "rite=push", "branch=feature/x", "returns=3")))
      .toBe(`{"face":2,"rite":"push","branch":"feature/x","returns":3,"after":null}`);
    expect(seam.calls).toEqual([["mount", {}], ["swarm-show", { rite: "push", branch: "feature/x", face: 2 }]]);
    // A named `after` that IS the line's tip passes; a named face asks no mount.
    seam.lines[1] = lineAt(CID); seam.calls = [];
    expect(JSON.stringify(await terms("kui", "rite=push", "branch=feature/x", "returns=40", "yes=true", `after=${CID}`, "face=1")))
      .toBe(`{"face":1,"rite":"push","branch":"feature/x","returns":40,"after":"${CID}","confirm":true}`);
    expect(seam.calls).toEqual([["swarm-show", { rite: "push", branch: "feature/x", face: 1 }]]);
  });

  test("RED: kui head pins one head and carries its reach", async () => {
    expect(JSON.stringify(await terms("kui", "rite=kukulu", "branch=main", "reach=head", `head=${HEAD}`, "face=0")))
      .toBe(`{"face":0,"rite":"kukulu","branch":"main","reach":"head","head":"${HEAD}","after":null}`);
  });

  test("RED: restring fills `after` from the line's tip, read through the swarm-show row at the face", async () => {
    seam.mount = 1;
    seam.lines[1] = lineAt(TIP);
    expect(JSON.stringify(await terms("restring", "rite=push", "branch=feature/x", "returns=2")))
      .toBe(`{"face":1,"rite":"push","branch":"feature/x","returns":2,"after":"${TIP}"}`);
    expect(seam.calls).toEqual([["mount", {}], ["swarm-show", { rite: "push", branch: "feature/x", face: 1 }]]);
    // A spent lei still holds the line's tip, and a restring follows it.
    seam.lines[1] = { standing: false, refusal: "swarm-lei-spent", after: TIP };
    expect((await terms("restring", "rite=push", "branch=feature/x", "reach=head", `head=${HEAD}`))["after"]).toBe(TIP);
  });

  test("RED: a kui with no --after takes the line's own tip, a spent line's tip too, so a spent line restrings by the same plain command", async () => {
    seam.lines[0] = { standing: false, refusal: "swarm-lei-returns-spent", after: TIP };
    expect(JSON.stringify(await terms("kui", "rite=keep", "branch=house-backup", "returns=6", "face=0")))
      .toBe(`{"face":0,"rite":"keep","branch":"house-backup","returns":6,"after":"${TIP}"}`);
  });

  test("RED: a named --after that is no tip refuses as the door would, BEFORE the pūlama asks a signature: forked on a standing line, after-moved where the line holds none, forked on a fork unless it names one of its tips", async () => {
    seam.lines[0] = lineAt(TIP);
    expect(await refusal(terms("kui", "rite=push", "branch=b", "returns=1", "face=0", `after=${CID}`))).toBe("swarm-lei-forked");
    expect(await refusal(terms("kui", "rite=push", "branch=b", "returns=1", "face=0", `after=${TIP}`))).toBe("no refusal");
    seam.lines[0] = lineAt(null);
    expect(await refusal(terms("kui", "rite=push", "branch=b", "returns=1", "face=0", `after=${CID}`))).toBe("swarm-lei-after-moved");
    seam.lines[0] = lineAt(null, { forks: [TIP, CID] });
    expect(await refusal(terms("kui", "rite=push", "branch=b", "returns=1", "face=0"))).toBe("swarm-lei-forked");
    expect(await refusal(terms("kui", "rite=push", "branch=b", "returns=1", "face=0", `after=${"e".repeat(64)}`))).toBe("swarm-lei-forked");
    expect(await refusal(terms("kui", "rite=push", "branch=b", "returns=1", "face=0", `after=${CID}`))).toBe("no refusal");
  });

  it("RED: `lares lei kui` with no pūlama strings after the line's own tip, and a named non-tip refuses before any route or row", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    seam.lines[0] = { standing: false, refusal: "swarm-lei-returns-spent", after: TIP };
    expect(await cmdLei(parseArgs(["lei", "kui", "rite=keep", "branch=house-backup", "returns=6", "face=0", "json=true"]))).toBe(0);
    expect(seam.calls.filter(([v]) => v === "swarm-lei-kui")).toEqual([["swarm-lei-kui", { rite: "keep", branch: "house-backup", returns: 6, after: TIP, face: 0 }]]);
    seam.calls = [];
    expect(await cmdLei(parseArgs(["lei", "kui", "rite=keep", "branch=house-backup", "returns=6", "face=0", `after=${CID}`, "json=true"]))).not.toBe(0);
    expect(seam.calls.filter(([v]) => v === "swarm-lei-kui" || v === "route")).toEqual([]);
  });

  it("RED: ONE ANSWER SHAPE: a terminal and a pipe both read the one-line envelope on stdout (a terminal adds one line of prose on stderr); json=false asks the prose", async () => {
    const was = process.stdout.isTTY;
    try {
      for (const tty of [true, false]) {
        Object.defineProperty(process.stdout, "isTTY", { value: tty, configurable: true });
        const written: string[] = [], said: string[] = [];
        vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => { written.push(String(chunk)); return true; });
        vi.spyOn(console, "log").mockImplementation((line: unknown) => { written.push(`log:${String(line)}\n`); });
        vi.spyOn(console, "error").mockImplementation((line: unknown) => { said.push(String(line)); });
        seam.lines[0] = lineAt(TIP);
        expect(await cmdLei(parseArgs(["lei", "show", "rite=push", "branch=b"]))).toBe(0);
        expect(written).toHaveLength(1);
        expect(written[0]!.startsWith("log:")).toBe(false);
        expect(written[0]!.trimEnd().split("\n")).toHaveLength(1);
        expect(JSON.parse(written[0]!).ok).toBe(true);
        expect(said).toHaveLength(tty ? 1 : 0);
        // A refusal reads the same shape: one envelope, no second record.
        written.length = 0; said.length = 0;
        expect(await cmdLei(parseArgs(["lei", "kui", "rite=push", "branch=b", "returns=1", "face=0", `after=${CID}`]))).not.toBe(0);
        expect(written).toHaveLength(1);
        expect(JSON.parse(written[0]!)).toMatchObject({ ok: false, error: { code: "swarm-lei-forked" } });
        vi.restoreAllMocks();
      }
    } finally { Object.defineProperty(process.stdout, "isTTY", { value: was, configurable: true }); }
  });

  test("RED: unstring carries the lei it revokes by cid", async () => {
    expect(JSON.stringify(await terms("unstring", "rite=push", "branch=feature/x", `lei=${CID}`, "face=3")))
      .toBe(`{"face":3,"rite":"push","branch":"feature/x","lei":"${CID}"}`);
    expect(seam.calls).toEqual([]);
  });

  test("RED: a keep names the keep's face: the face whose keep lei stands (h0 first, then each open face ascending), else h0; the mount never chooses it", async () => {
    seam.mount = 2; seam.open = [0, 2, 1];
    seam.lines[1] = lineAt(TIP);
    expect(JSON.stringify(await terms("kui", "rite=keep", "branch=house-backup", "returns=6")))
      .toBe(`{"face":1,"rite":"keep","branch":"house-backup","returns":6,"after":"${TIP}"}`);
    expect(seam.calls.map(([v, a]) => `${v} ${String(a["face"] ?? "")}`)).toEqual(["swarm-show 0", "swarm-show 1"]);
    // No keep line anywhere: h0, where a house strings its first.
    seam.lines = {}; seam.calls = [];
    expect((await terms("kui", "rite=keep", "branch=house-backup", "returns=6"))["face"]).toBe(0);
    // A keep restring follows the tip read at the keep's face, read once.
    seam.lines[1] = lineAt(TIP); seam.calls = [];
    expect(JSON.stringify(await terms("restring", "rite=keep", "branch=house-backup", "returns=4")))
      .toBe(`{"face":1,"rite":"keep","branch":"house-backup","returns":4,"after":"${TIP}"}`);
    expect(seam.calls.filter(([v]) => v === "swarm-show")).toHaveLength(2);
  });

  test("RED: refusals by name: a restring with no lei on the line, a forked line, a keep lei that may stand on a shut face", async () => {
    expect(await refusal(terms("restring", "rite=push", "branch=b", "returns=1"))).toBe("swarm-lei-nothing-to-restring");
    seam.lines[0] = lineAt(null, { forks: [TIP, CID] });
    expect(await refusal(terms("restring", "rite=push", "branch=b", "returns=1"))).toBe("swarm-lei-forked");
    seam.lines = {}; seam.shut = [3];
    expect(await refusal(terms("kui", "rite=keep", "branch=w", "returns=1"))).toBe("keep-lei-unseen");
    // CONTROL: a named face reads past the shut one.
    expect(await refusal(terms("kui", "rite=keep", "branch=w", "returns=1", "face=0"))).toBe("no refusal");
  });

  test("RED: usage refusals: no act, an act the pūlama holds none for, a missing rite or branch or lei, a count that reads as none, and a flag the act does not take", async () => {
    for (const line of [[], ["show"], ["land"], ["kui", "branch=b"], ["kui", "rite=push"], ["unstring", "rite=push", "branch=b"],
      ["kui", "rite=push", "branch=b", "returns=0"], ["kui", "rite=push", "branch=b", "face=x"],
      ["kui", "rite=push", "branch=b", `lei=${CID}`], ["restring", "rite=push", "branch=b", `after=${CID}`],
      ["restring", "rite=push", "branch=b", `lei=${CID}`], ["unstring", "rite=push", "branch=b", `lei=${CID}`, "returns=2"],
      ["unstring", "rite=push", "branch=b", `lei=${CID}`, "yes=true"], ["unstring", "rite=push", "branch=b", `lei=${CID}`, `head=${HEAD}`]]) {
      expect(await refusal(terms(...line)), line.join(" ")).toBe("usage");
    }
    // Nothing read for a usage refusal.
    expect(seam.calls).toEqual([]);
  });

  it("RED: the command prints ONE stdout line, the terms alone, through the live ports (the census, the swarm-show row, the mount)", async () => {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => { out.push(String(line)); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    seam.mount = 1; seam.lines[1] = lineAt(TIP);
    expect(await cmdLei(parseArgs(["lei", "terms", "restring", "rite=push", "branch=feature/x", "returns=2"]))).toBe(0);
    expect(out).toEqual([`{"face":1,"rite":"push","branch":"feature/x","returns":2,"after":"${TIP}"}`]);
    expect(seam.calls).toEqual([["face.resolve", { worn: true }], ["swarm-show", { rite: "push", branch: "feature/x", face: 1 }]]);
    out.length = 0; seam.calls = []; seam.open = [0, 1]; seam.lines = { 1: lineAt(TIP) };
    expect(await cmdLei(parseArgs(["lei", "terms", "kui", "rite=keep", "branch=w", "returns=6"]))).toBe(0);
    expect(out).toEqual([`{"face":1,"rite":"keep","branch":"w","returns":6,"after":"${TIP}"}`]);
    expect(seam.calls[0]).toEqual(["census", {}]);
    // A refusal prints nothing on stdout and exits non-zero.
    out.length = 0; seam.lines = {};
    expect(await cmdLei(parseArgs(["lei", "terms", "restring", "rite=push", "branch=b", "returns=1", "face=0"]))).not.toBe(0);
    expect(out).toEqual([]);
    // CONTROL: an explicit json=true asks the envelope.
    seam.lines = { 0: lineAt(TIP) };
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => { written.push(String(chunk)); return true; });
    expect(await cmdLei(parseArgs(["lei", "terms", "restring", "rite=push", "branch=b", "returns=1", "face=0", "json=true"]))).toBe(0);
    expect(JSON.parse(written.join(""))).toEqual({ ok: true, data: { face: 0, rite: "push", branch: "b", returns: 1, after: TIP } });
  });

  test("RED: kui --all names one terms object per open face, ascending, each following its own line's tip (null for a line's first); a fork on any face refuses by name", async () => {
    seam.open = [0, 2, 1]; seam.lines[1] = lineAt(TIP);
    expect(JSON.stringify(await terms("kui", "rite=kukulu", "branch=main", "returns=3", "all=true")))
      .toBe(`{"faces":[{"face":0,"rite":"kukulu","branch":"main","returns":3,"after":null},{"face":1,"rite":"kukulu","branch":"main","returns":3,"after":"${TIP}"},{"face":2,"rite":"kukulu","branch":"main","returns":3,"after":null}]}`);
    expect(seam.calls.map(([v, a]) => `${v} ${String(a["face"] ?? "")}`)).toEqual(["swarm-show 0", "swarm-show 1", "swarm-show 2"]);
    seam.lines[2] = lineAt(null, { forks: [TIP, CID] });
    expect(await refusal(terms("kui", "rite=kukulu", "branch=main", "returns=3", "all=true"))).toBe("swarm-lei-forked");
    seam.open = [];
    expect(await refusal(terms("kui", "rite=kukulu", "branch=main", "returns=3", "all=true"))).toBe("face-none-open");
  });

  test("RED: --all strings a kui alone, names no face and no after, and no keep (one per house) or exec (one writer) line; CONTROL: push and kukulu take it", async () => {
    for (const line of [["kui", "rite=kukulu", "branch=b", "returns=1", "all=true", "face=0"], ["kui", "rite=kukulu", "branch=b", "returns=1", "all=true", `after=${CID}`],
      ["kui", "rite=keep", "branch=b", "returns=1", "all=true"], ["kui", "rite=exec", `scope={"wiki":"w","writer":"x","class":"c"}`, "returns=1", "all=true"], ["restring", "rite=kukulu", "branch=b", "returns=1", "all=true"]]) {
      expect(await refusal(terms(...line)), line.join(" ")).toBe("usage");
    }
    expect(await refusal(terms("kui", "rite=push", "branch=b", "returns=1", "all=true"))).toBe("no refusal");
  });

  it("RED: `lares lei kui all=true` with no pūlama: ONE route for every open face, each face's kui at its own line's tip, and the answer names each face's cid", async () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => { out.push(String(chunk)); return true; });
    seam.open = [0, 1]; seam.lines[1] = lineAt(TIP);
    expect(await cmdLei(parseArgs(["lei", "kui", "rite=kukulu", "branch=main", "returns=2", "all=true", "json=true"]))).toBe(0);
    const route = [{ kind: "passphrase", passphrase: "the-route" }];
    expect(seam.calls.filter(([v]) => v === "route")).toHaveLength(1);
    expect(seam.calls.filter(([v]) => v === "swarm-lei-kui")).toEqual([
      ["swarm-lei-kui", { rite: "kukulu", branch: "main", returns: 2, after: null, face: 0, route }],
      ["swarm-lei-kui", { rite: "kukulu", branch: "main", returns: 2, after: TIP, face: 1, route }],
    ]);
    expect(JSON.parse(out.join("")).data).toEqual({ rite: "kukulu", branch: "main", faces: [{ face: 0, rite: "kukulu", branch: "main", lei: "cid-h0" }, { face: 1, rite: "kukulu", branch: "main", lei: "cid-h1" }] });
  });

  it("RED: `lares lei show rite=true branch=true` naming no face lists every open face's line; CONTROL: one face open, or a face named, reads the one line as it stood", async () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => { out.push(String(chunk)); return true; });
    seam.open = [1, 0]; seam.lines[1] = lineAt(TIP);
    expect(await cmdLei(parseArgs(["lei", "show", "rite=kukulu", "branch=main", "json=true"]))).toBe(0);
    expect(JSON.parse(out.join("")).data).toEqual({ rite: "kukulu", branch: "main", faces: [
      { face: 0, lei: { standing: false, refusal: "absent", after: null } }, { face: 1, lei: lineAt(TIP) }] });
    out.length = 0; seam.open = [0]; seam.calls = [];
    expect(await cmdLei(parseArgs(["lei", "show", "rite=kukulu", "branch=main", "json=true"]))).toBe(0);
    expect(seam.calls.filter(([v]) => v === "swarm-show")).toEqual([["swarm-show", { rite: "kukulu", branch: "main" }]]);
    out.length = 0; seam.open = [0, 1]; seam.calls = [];
    expect(await cmdLei(parseArgs(["lei", "show", "rite=kukulu", "branch=main", "face=1", "json=true"]))).toBe(0);
    expect(seam.calls).toEqual([["swarm-show", { rite: "kukulu", branch: "main", face: 1 }]]);
  });

  // The lei door flipped to its carriers (comms landings 10 + 23): the door's index names each verb, each carrier its lines.
  test("the lei help names land and terms, and kui strings every open face's lei", () => {
    const help = helpLines("lei").join("\n");
    expect(help).toMatch(/lares lei land /);
    expect(help).toMatch(/lares lei terms /);
    expect(helpLines("lei terms").join("\n")).toMatch(/kui/);
    expect(helpLines("lei kui").join("\n")).toMatch(/lares lei kui rite=kukulu branch=main .*all=true/);
  });
});
