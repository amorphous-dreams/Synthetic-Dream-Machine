/**
 * projection-conflict-surfaces — THE SECOND LEG OF THE CONFLUENCE.
 *
 * The disk→records leg reconciles (ingest-gate: noop · ingest · conflict ·
 * refuse). This pins the records→disk leg to the same discipline: where the
 * operator's hands moved the FILE and the doc moved the RECORDS since the last
 * projection, the projector REFUSES the write and surfaces a conflict on the
 * disk-ward's existing alert rail — it never overwrites, never auto-merges.
 *
 * The RED this replaces: with the gate unconsulted, the third case below writes
 * the doc's bytes straight over the operator's disk edit, silently, because the
 * content-hash gate can only ask "do the bytes I am about to write differ from
 * the bytes there" — never "did anyone else move this file".
 *
 * CONTROLs ride beside the cure: a clean project still projects · a byte-identical
 * carrier still noops with no mtime churn · a disk edit with the doc UNMOVED
 * surfaces nothing and writes nothing (the ingest leg owns that state and ADOPTS
 * the edit — the two legs must not disagree about one state) · and the real
 * 701-carrier `bags/` corpus reads zero conflicts in its steady state.
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import { decideProjection } from "../src/projection-gate.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const URI = "lar:///ha.ka.ba/confluence/leg-two";
const REL = "ha.ka.ba/confluence/leg-two.mem";

/** A minimal $tw whose wiki resolves one mutable carrier record. */
function fakeEngine(fields: Record<string, unknown>): TW5Engine {
  return {
    $tw: {
      wiki: {
        getTiddler: (title: string) => (title === URI ? { fields } : undefined),
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    },
  } as unknown as TW5Engine;
}

function reconcile(p: LarDiskProjector, uri: string): Promise<void> {
  return (p as unknown as { reconcile: (u: string) => Promise<void> }).reconcile(uri);
}

/** Build a projector over a temp mirror + a TEMP Synced tree. The shared
 *  `synced-tree.json` is NEVER touched by a test (it is one file, many writers). */
function makeProjector(body: () => string, refusals: { bagId: string; uri: string; reason: string }[]) {
  const syncedTree = new SyncedTree(join(root, ".projection", "synced-tree.json"), 0);
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: ".mem", body: body(), encoding: "utf8" }),
    debounceMs: 1,
    syncedTree,
    onRefusal: (info) => { refusals.push(info); },
  });
  return { projector, syncedTree };
}

describe("the projection leg reconciles — it never overwrites a moved disk file", () => {
  test("RED→GREEN: disk moved AND records moved → conflict surfaces, disk keeps the operator's bytes", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-projconflict-"));
    const abs = join(root, REL);
    let docBody = "the doc's first words\n";
    const refusals: { bagId: string; uri: string; reason: string }[] = [];
    const { projector } = makeProjector(() => docBody, refusals);
    const stop = projector.start(fakeEngine({ title: URI, text: docBody, "$origin-bag": BAG }));

    // 1 — first projection lays the merge base down.
    await reconcile(projector, URI);
    expect(readFileSync(abs, "utf-8")).toBe("the doc's first words\n");
    expect(refusals).toHaveLength(0);

    // 2 — the operator's hands move the FILE.
    const operatorBytes = "the doc's first words\nand the operator's own line\n";
    writeFileSync(abs, operatorBytes, "utf-8");

    // 3 — the doc moves too, independently.
    docBody = "the doc's SECOND words\n";
    await reconcile(projector, URI);

    // The cure: the operator's bytes stand untouched and the conflict surfaces.
    expect(readFileSync(abs, "utf-8")).toBe(operatorBytes);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]!.uri).toBe(URI);
    expect(refusals[0]!.bagId).toBe(BAG);
    expect(refusals[0]!.reason).toMatch(/conflict/i);

    // A repeat nudge on the SAME standoff surfaces once, not once per nudge —
    // an alert rail that repeats itself trains the operator to ignore it.
    await reconcile(projector, URI);
    expect(readFileSync(abs, "utf-8")).toBe(operatorBytes);
    expect(refusals).toHaveLength(1);

    // …and a MOVED standoff (the doc moves again) surfaces afresh.
    docBody = "the doc's THIRD words\n";
    await reconcile(projector, URI);
    expect(readFileSync(abs, "utf-8")).toBe(operatorBytes);
    expect(refusals).toHaveLength(2);

    stop();
  });

  test("CONTROL — a clean project still projects (no disk file, and disk-unmoved)", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-projclean-"));
    const abs = join(root, REL);
    let docBody = "first\n";
    const refusals: { bagId: string; uri: string; reason: string }[] = [];
    const { projector } = makeProjector(() => docBody, refusals);
    const stop = projector.start(fakeEngine({ title: URI, text: docBody, "$origin-bag": BAG }));

    await reconcile(projector, URI);                    // absent-on-disk → project
    expect(readFileSync(abs, "utf-8")).toBe("first\n");

    docBody = "second\n";
    await reconcile(projector, URI);                    // disk-unmoved → project
    expect(readFileSync(abs, "utf-8")).toBe("second\n");
    expect(refusals).toHaveLength(0);
    stop();
  });

  test("CONTROL — a byte-identical carrier noops: no write, no mtime churn, no alert", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-projnoop-"));
    const abs = join(root, REL);
    const refusals: { bagId: string; uri: string; reason: string }[] = [];
    const { projector } = makeProjector(() => "steady\n", refusals);
    const stop = projector.start(fakeEngine({ title: URI, text: "steady\n", "$origin-bag": BAG }));

    await reconcile(projector, URI);
    const first = statSync(abs).mtimeMs;
    await new Promise((r) => setTimeout(r, 12));
    await reconcile(projector, URI);
    expect(statSync(abs).mtimeMs).toBe(first);          // the write never fired
    expect(readFileSync(abs, "utf-8")).toBe("steady\n");
    expect(refusals).toHaveLength(0);
    stop();
  });

  test("CONTROL — a disk edit with the doc UNMOVED stands down: the ingest leg adopts it", async () => {
    // The ingest gate's rule 4 answers this exact state with INGEST (adopt the
    // disk edit). The projecting leg therefore refuses to race it — no write,
    // and no alert either: nothing disagrees, so nothing needs talking out.
    root = mkdtempSync(join(tmpdir(), "lar-projdiskonly-"));
    const abs = join(root, REL);
    const refusals: { bagId: string; uri: string; reason: string }[] = [];
    const { projector, syncedTree } = makeProjector(() => "steady\n", refusals);
    const stop = projector.start(fakeEngine({ title: URI, text: "steady\n", "$origin-bag": BAG }));

    await reconcile(projector, URI);
    const anchor = syncedTree.get(syncedTreeKey(BAG, URI));
    expect(anchor).toBeTruthy();

    writeFileSync(abs, "the operator's line alone\n", "utf-8");
    await reconcile(projector, URI);

    expect(readFileSync(abs, "utf-8")).toBe("the operator's line alone\n");
    expect(refusals).toHaveLength(0);
    // The anchor still names the last PROJECTION, so the ingest leg can still
    // see disk != synced and adopt. An anchor advanced here would blind it.
    expect(syncedTree.get(syncedTreeKey(BAG, URI))).toBe(anchor);
    stop();
  });
});

describe("the gate over the REAL corpus — bags/ holds 701 hand-authored carriers", () => {
  const repoBags = join(__dirname, "..", "..", "..", "bags");

  function everyMem(dir: string, out: string[] = []): string[] {
    for (const n of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, n.name);
      if (n.isDirectory()) everyMem(p, out);
      else if (n.name.endsWith(".mem")) out.push(p);
    }
    return out;
  }
  const hash = (s: string) => "sha256:" + createHash("sha256").update(s, "utf8").digest("hex");

  test("steady state (doc agrees with disk) reads ZERO conflicts over all 701", () => {
    const files = everyMem(repoBags);
    expect(files.length).toBeGreaterThan(600);
    const tally: Record<string, number> = {};
    for (const f of files) {
      const disk = hash(readFileSync(f, "utf-8"));
      // Post-ingest steady state: the records render to what the disk holds. The
      // anchor is deliberately STALE (a hash from some other projection) — the
      // echo gate rides FIRST precisely so a stale tree cannot manufacture 701
      // conflicts at first boot.
      const d = decideProjection({ diskHash: disk, syncedHash: hash("a stale anchor"), recordsHash: disk });
      tally[`${d.kind}:${d.reason}`] = (tally[`${d.kind}:${d.reason}`] ?? 0) + 1;
    }
    expect(tally).toEqual({ "noop:disk-matches-records": files.length });
  });

  test("with the doc moved off every carrier, a LIVE anchor conflicts and an absent one projects", () => {
    const files = everyMem(repoBags);
    let conflict = 0, project = 0;
    for (const f of files) {
      const disk = hash(readFileSync(f, "utf-8"));
      const moved = hash(readFileSync(f, "utf-8") + "\nthe doc moved\n");
      // A live-but-different anchor (the operator edited the file since the last
      // projection) + a moved doc = the standoff the operator must talk out.
      if (decideProjection({ diskHash: disk, syncedHash: hash("older"), recordsHash: moved }).kind === "conflict") conflict++;
      // No anchor at all = a fresh adoption; the write lands.
      if (decideProjection({ diskHash: disk, syncedHash: null, recordsHash: moved }).kind === "project") project++;
    }
    expect(conflict).toBe(files.length);
    expect(project).toBe(files.length);
  });
});
