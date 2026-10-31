/**
 * L11 · A content move requires unambiguous evidence: a rename/move/vanish pairs two carriers only
 * when the evidence (the content hash) matches exactly one candidate on each side; ambiguity pairs
 * nothing; a scan reports each real carrier as read.
 *
 * Three doors decide a pairing: the watcher's `pairedDeletions` (vanished set vs a wave's candidates),
 * the full scan's `resolveRenames` (Synced tree sources vs the wave's rows), and `scanSource` over a
 * real tree. Each runs over generated vanished/arrived sets with hashes drawn from a small alphabet
 * (so collisions occur), against a model: pair iff the hash stands unique on both sides. A metamorphic
 * check permutes the input order and expects the same pairing.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test as plain } from "vitest";
import { fc, test } from "@fast-check/vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SyncedTree, syncedTreeKey } from "@lararium/node";
import { carrierHash } from "@lararium/mesh";
import { pairedDeletions } from "../../src/commands/watch.js";
import { resolveRenames, scanSource, type ScanRow } from "../../src/ingest-core.js";

type Cand = { diskHash: string; status: string };
const hashes = fc.constantFrom("h0", "h1", "h2", "h3");
const statuses = fc.constantFrom("new", "changed");
const vanishedSet = fc.array(hashes, { maxLength: 6 });
const candidateSet = fc.array(fc.record({ diskHash: hashes, status: statuses }), { maxLength: 6 });

const vmap = (hs: readonly string[]) => new Map(hs.map((syncedHash, i) => [`lar:///x/v${i}`, { syncedHash, file: `/disk/v${i}.mem` }] as const));
const count = <T>(xs: readonly T[], f: (x: T) => boolean) => xs.filter(f).length;

/** The model: a vanished address rides iff its hash stands unique among vanished, unique among candidates, and that candidate arrived. */
function modelPairs(hs: readonly string[], cs: readonly Cand[]): string[] {
  return hs.flatMap((h, i) =>
    count(hs, (x) => x === h) === 1 && count(cs, (c) => c.diskHash === h) === 1 && cs.find((c) => c.diskHash === h)!.status === "new" ? [`lar:///x/v${i}`] : []);
}
const shuffle = <T>(xs: readonly T[], seed: number): T[] => {
  const a = [...xs]; let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};

describe("L11 · pairedDeletions pairs on exact, unique evidence", () => {
  test.prop([vanishedSet, candidateSet], { examples: [
    [["h-a", "h-b"], []],                                               // no arrival of its content
    [["h-a"], [{ diskHash: "h-other", status: "new" }]],
    [["h-a", "h-b"], [{ diskHash: "h-a", status: "new" }, { diskHash: "h-new", status: "new" }]],   // the true pair
    [["h-a"], [{ diskHash: "h-a", status: "new" }, { diskHash: "h-a", status: "new" }]],            // two arrivals
    [["h-a", "h-a"], [{ diskHash: "h-a", status: "new" }]],                                        // two vanished
    [["h-a"], [{ diskHash: "h-a", status: "changed" }]],                                           // hand-edited standing carrier
    [["h-a"], [{ diskHash: "h-a", status: "changed" }, { diskHash: "h-a", status: "new" }]],
  ] })("pairs iff the hash matches exactly one candidate on each side, and that candidate arrived", (hs, cs) => {
    const got = pairedDeletions(vmap(hs), cs).map((d) => d.uri);
    expect(got).toEqual(modelPairs(hs, cs));
  });

  test.prop([vanishedSet, candidateSet, fc.integer()])("permuting either input never changes the pairing", (hs, cs, seed) => {
    const named = hs.map((h, i) => [`lar:///x/v${i}`, h] as const);
    const mk = (rows: ReadonlyArray<readonly [string, string]>) =>
      new Map(rows.map(([uri, syncedHash]) => [uri, { syncedHash, file: `/disk/${uri}` }] as const));
    const base = pairedDeletions(mk(named), cs).map((d) => d.uri).sort();
    const permuted = pairedDeletions(mk(shuffle(named, seed)), shuffle(cs, seed + 1)).map((d) => d.uri).sort();
    expect(permuted).toEqual(base);
  });

  test.prop([vanishedSet, candidateSet])("each paired source carries the hash and file the watcher saw", (hs, cs) => {
    const v = vmap(hs);
    for (const d of pairedDeletions(v, cs)) {
      expect(d.syncedHash).toBe(v.get(d.uri)!.syncedHash);
      expect(d.file).toBe(v.get(d.uri)!.file);
    }
  });

  plain("CONTROL: a true one-to-one pair rides (the zero cases read against a positive)", () => {
    expect(pairedDeletions(vmap(["h0", "h1"]), [{ diskHash: "h0", status: "new" }]).map((d) => d.uri)).toEqual(["lar:///x/v0"]);
    expect(modelPairs(["h0"], [{ diskHash: "h0", status: "new" }])).toHaveLength(1);
  });

  plain("a mass vanish with no matching arrival sends nothing", () => {
    expect(pairedDeletions(vmap(Array.from({ length: 500 }, (_, i) => `u${i}`)), [{ diskHash: "x", status: "new" }])).toEqual([]);
  });
});

describe("L11 · resolveRenames pairs a tree source with a row only on unique evidence", () => {
  const TO = "lar:///ha.ka.ba/bags/x/notes";
  const srcUri = (i: number) => `lar:///ha.ka.ba/lares/api/gone${i}`;
  const rowUri = (i: number) => `lar:///ha.ka.ba/lares/api/arr${i}`;
  const row = (i: number, diskHash: string, status: ScanRow["status"]): ScanRow =>
    ({ uri: rowUri(i), file: `/disk/arr${i}.md`, diskHash, status } as ScanRow);

  /** The tree speaks real `sha256:` digests, so a generated label maps to the hash of a body that carries it. */
  const real = (label: string) => carrierHash(`# ${label}\n\nbody ${label}\n`);
  function run(sources: readonly string[], arrivals: ReadonlyArray<Cand>, order = 0) {
    const dir = mkdtempSync(join(tmpdir(), "l11-"));
    try {
      const tree = new SyncedTree(join(dir, "synced.json"));
      const src = order === 0 ? sources.map((h, i) => [i, h] as const) : shuffle(sources.map((h, i) => [i, h] as const), order);
      for (const [i, h] of src) tree.set(syncedTreeKey(TO, srcUri(i)), `/disk/gone${i}.md`, real(h));
      const rows = arrivals.map((c, i) => row(i, real(c.diskHash), c.status as ScanRow["status"]));
      const out = resolveRenames(order === 0 ? rows : shuffle(rows, order + 7), TO, tree);
      return { rows: out.rows.map((r) => [r.uri, r.status, r.renameFrom ?? null] as const).sort(), dels: out.renameDeletions.map((d) => d.uri).sort() };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  /** The model: a `new` row renames iff its hash stands unique among arrivals and among the tree's sources. */
  function expected(sources: readonly string[], arrivals: readonly Cand[]) {
    const rows: Array<readonly [string, string, string | null]> = arrivals.map((c, i) => {
      const from = sources.map((h, j) => [h, j] as const).filter(([h]) => h === c.diskHash);
      const ok = c.status === "new" && count(arrivals, (a) => a.diskHash === c.diskHash) === 1 && from.length === 1;
      return [rowUri(i), ok ? "renamed" : c.status, ok ? srcUri(from[0]![1]) : null] as const;
    });
    return { rows: rows.sort(), dels: rows.flatMap((r) => (r[2] === null ? [] : [r[2]])).sort() };
  }

  test.prop([vanishedSet, candidateSet], { numRuns: 40, examples: [
    [["h0"], [{ diskHash: "h0", status: "new" }]],                                              // the rename
    [["h0"], [{ diskHash: "h0", status: "new" }, { diskHash: "h0", status: "new" }]],           // two arrivals share content
    [["h0", "h0"], [{ diskHash: "h0", status: "new" }]],                                        // two sources share content
    [["h0"], [{ diskHash: "h0", status: "changed" }, { diskHash: "h0", status: "new" }]],       // edited standing carrier makes it ambiguous
  ] })("a row renames iff its hash matches exactly one source and exactly one arrival", (hs, cs) => {
    expect(run(hs, cs)).toEqual(expected(hs, cs));
  });

  test.prop([vanishedSet, candidateSet, fc.integer({ min: 1, max: 1e6 })], { numRuns: 40 })("permuting sources and rows never changes the pairing", (hs, cs, seed) => {
    // Sources keep their indices through the shuffle, so the pairing names the same carriers.
    expect(run(hs, cs, seed)).toEqual(run(hs, cs));
  });

  plain("CONTROL: a lone vanished source and a lone arrival of its bytes pair", () => {
    const r = run(["h0"], [{ diskHash: "h0", status: "new" }]);
    expect(r.dels).toEqual([srcUri(0)]);
    expect(r.rows).toEqual([[rowUri(0), "renamed", srcUri(0)]]);
  });
});

describe("L11 · scanSource reports each real carrier as read", () => {
  const TO = "lar:///ha.ka.ba/bags/x/notes";
  const uriOf = (stem: string) => `lar:///ha.ka.ba/lares/api/${stem}`;
  const body = (n: number) => `# note ${n}\n\nbody ${n}\n`;

  /** A landed carrier's fate in the wave: it vanishes, stands untouched, or a hand edits it to another content. */
  type Old = { readonly c: number; readonly fate: "vanish" | "stay" | number };

  /** Land `olds`, then run the wave: each old file meets its fate, each `news` content lands under a fresh name. */
  function scenario(olds: readonly Old[], news: readonly number[]) {
    const root = mkdtempSync(join(tmpdir(), "l11-scan-"));
    try {
      const dir = join(root, "bags", "@x", "ha.ka.ba", "lares", "api");
      mkdirSync(dir, { recursive: true });
      const src = join(root, "bags", "@x");
      const tree = new SyncedTree(join(root, "synced.json"));
      olds.forEach((o, i) => writeFileSync(join(dir, `old${i}.md`), body(o.c)));
      for (const r of scanSource(root, src, TO, tree)!.rows) tree.set(syncedTreeKey(TO, r.uri), r.file, r.diskHash);
      olds.forEach((o, i) => {
        if (o.fate === "vanish") rmSync(join(dir, `old${i}.md`));
        else if (typeof o.fate === "number") writeFileSync(join(dir, `old${i}.md`), body(o.fate));
      });
      news.forEach((c, i) => writeFileSync(join(dir, `new${i}.md`), body(c)));
      const observed = () => olds.map((_, i) => tree.get(syncedTreeKey(TO, uriOf(`old${i}`))));
      const before = observed();
      expect(before.every((h) => h !== null), "each landed carrier holds an observation to keep").toBe(true);
      const scan = scanSource(root, src, TO, tree)!;
      // A scan reads; it never moves an observation, and it names deletions only when a pair holds.
      expect(observed(), "the scan leaves every landed observation where it stood").toEqual(before);
      expect("renameDeletions" in scan, "renameDeletions rides only when a pair holds").toBe((scan.renameDeletions ?? []).length > 0);
      return {
        rows: scan.rows.map((r) => [r.uri, r.status, r.renameFrom ?? null] as const).sort(),
        dels: (scan.renameDeletions ?? []).map((d) => d.uri).sort(),
      };
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  /** What the disk holds after the wave for an old carrier, or null when it vanished. */
  const holds = (o: Old) => (o.fate === "vanish" ? null : o.fate === "stay" ? o.c : o.fate);
  /**
   * The model. A standing carrier reads `unchanged`, or `changed` when its bytes moved. A new file renames iff
   * exactly one carrier of the wave holds its content (the new and changed rows alike), exactly one landed
   * carrier observed that content, and that carrier vanished: a copy leaves its source standing and lands new.
   */
  const model = (olds: readonly Old[], news: readonly number[]) => {
    const standing = olds.flatMap((o, i) => {
      const now = holds(o);
      return now === null ? [] : [[uriOf(`old${i}`), now === o.c ? "unchanged" : "changed", null] as const];
    });
    const wave = [...news, ...olds.filter((o) => holds(o) !== null && holds(o) !== o.c).map((o) => holds(o)!)];
    const arrived = news.map((c, i) => {
      const from = olds.map((o, j) => [o, j] as const).filter(([o]) => o.c === c);
      const ok = count(wave, (w) => w === c) === 1 && from.length === 1 && from[0]![0].fate === "vanish";
      return [uriOf(`new${i}`), ok ? "renamed" : "new", ok ? uriOf(`old${from[0]![1]}`) : null] as const;
    });
    const rows = [...standing, ...arrived].sort();
    return { rows, dels: arrived.flatMap((r) => (r[2] === null ? [] : [r[2]])).sort() };
  };
  const content = fc.integer({ min: 0, max: 3 });
  const olds = fc.array(fc.record({ c: content, fate: fc.oneof(fc.constant<"vanish">("vanish"), fc.constant<"stay">("stay"), content) }), { maxLength: 4 });
  const news = fc.array(content, { maxLength: 4 });

  test.prop([olds, news], { numRuns: 20, examples: [
    [[{ c: 0, fate: "vanish" }], [0]],                               // the rename
    [[{ c: 0, fate: "vanish" }], [0, 0]],                            // two arrived files share the vanished carrier's content
    [[{ c: 0, fate: "vanish" }, { c: 0, fate: "vanish" }], [0]],     // two vanished carriers held it
    [[{ c: 0, fate: "vanish" }], [1]],                               // a different content lands as new
    [[{ c: 0, fate: "vanish" }, { c: 1, fate: 0 }], [0]],            // a standing carrier a hand edited into the vanished bytes: ambiguous, no deletion
    [[{ c: 0, fate: "stay" }], [0]],                                 // a copy: its source stands, so it lands new
    [[{ c: 0, fate: 1 }], []],                                       // an edit in place re-lands as changed
  ] })("a moved carrier pairs iff its content matches one vanished and one arriving carrier", (o, n) => {
    expect(scenario(o, n)).toEqual(model(o, n));
  });

  plain("CONTROL: one moved carrier reads renamed with its source named", () => {
    const r = scenario([{ c: 0, fate: "vanish" }], [0]);
    expect(r.dels).toEqual([uriOf("old0")]);
    expect(r.rows).toEqual([[uriOf("new0"), "renamed", uriOf("old0")]]);
  });
});
