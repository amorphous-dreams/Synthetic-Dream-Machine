/**
 * orphan-projects-and-flags (wiki-surface-scout #/meme-aware-actions, the operator's fixed point).
 *
 * Operator, 2026-11-14: "Orphan meme slot children should get projected to disk as tiddlers & flag for the
 * operator/user (both node/browser)."
 *
 * A family whose root reads absent once unlinked the root's file and wrote nothing for its children: they
 * stayed in the store and the wiki, vanished from disk, and no flag rose. Here each orphan projects as a
 * plain `.tid` under `<root-stem>.orphans/`, the wiki raises `$:/temp/lares/alert/meme-orphan/<root>`, and a
 * root that returns takes the folder and the flag away again.
 *
 * The run: the real `LarDiskProjector` over a real wiki, a real `IslandAdaptor` and real documents. The
 * orphan arrives the way one arrives in the field: a PEER tombstones the root alone and the change merges.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { memeOrphanAlertTitle } from "@lararium/mesh/family";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { LarDiskProjector } from "../src/disk-projector.js";
import { exportCarrierFile } from "../../lararium-tw5/src/meme-write.js";
import { Repo, arrived, shoreRig, turns, workingBag, type Rig } from "../../lararium-tw5/tests/wiki-shore-rig.js";
import { wikiSkip, skipNote } from "../../lararium-tw5/tests/test-wiki.js";

const CARRIER = "text/memetic-wikitext+tiddlywiki";
const peer = { kind: "crdt-remote", edgeIsland: "peer" } as const;

let dir = "";
/** Every standoff or ward refusal the projector raised: a clean walk raises none. */
const surfaced: string[] = [];
afterEach(() => { surfaced.length = 0; });
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } });

const family = (root: string): LarTiddlerRecord[] => [
  { tiddler: { title: root, type: CARRIER, text: "intro\n\n<<~ kahea ahu slot=`#/a`>>\n\n<<~ kahea ahu slot=`#/b`>>\n\n<<~ kahea ahu slot=`#/c`>>\n" } },
  { tiddler: { title: `${root}#/a`, type: CARRIER, text: "a body\n\n<<~ kahea ahu slot=`#/a/deep`>>\n", "$fragment-parent": root, "$slot": "#/a" } },
  { tiddler: { title: `${root}#/a/deep`, type: CARRIER, text: "deep body", "$fragment-parent": `${root}#/a`, "$slot": "#/a/deep" } },
  { tiddler: { title: `${root}#/b`, type: CARRIER, text: "b body", "$fragment-parent": root, "$slot": "#/b" } },
  { tiddler: { title: `${root}#/c`, type: CARRIER, text: "c body", "$fragment-parent": root, "$slot": "#/c" } },
];

function stand(r: Rig): { readonly projector: LarDiskProjector; readonly stop: () => Promise<void> } {
  dir = mkdtempSync(join(tmpdir(), "lar-orphans-"));
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: workingBag, mirrorRoot: dir }],
    carrierFileFn: (uri) => { try { return Promise.resolve(exportCarrierFile(r.engine, uri)); } catch { return Promise.resolve(null); } },
    onConflict: (info) => { surfaced.push(`conflict ${info.uri}: ${info.reason}`); },
    onRefusal: (info) => { surfaced.push(`refusal ${info.uri}: ${info.reason}`); },
  });
  return { projector, stop: projector.start(r.engine as never) };
}

async function peerChange(r: Rig, write: (store: AutomergeDocStore) => Promise<void>, titles: readonly string[]): Promise<void> {
  const peerRepo = new Repo({ network: [] });
  const peerHandle = peerRepo.import<LarDoc>(r.saved().working);
  await write(new AutomergeDocStore(peerHandle, workingBag));
  const before = r.arrivals.length;
  r.handles[workingBag]!.merge(peerHandle);
  await arrived(r, before, titles);
  await r.adaptor.landingIdle();
  await turns(8);
  await peerRepo.shutdown();
}

/** Every file beneath `root`, relative and sorted. */
function tree(root: string, rel = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    const at = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) out.push(...tree(root, at)); else out.push(at);
  }
  return out.sort();
}

/** A `.tid` file as TiddlyWiki reads one: header fields, a blank line, the text. */
function readTid(path: string): Record<string, string> {
  const raw = readFileSync(path, "utf8");
  const cut = raw.indexOf("\n\n");
  const fields: Record<string, string> = { text: cut < 0 ? "" : raw.slice(cut + 2) };
  for (const line of (cut < 0 ? raw : raw.slice(0, cut)).split("\n")) {
    const at = line.indexOf(":");
    if (at > 0) fields[line.slice(0, at)] = line.slice(at + 1).trim();
  }
  return fields;
}

describe.skipIf(wikiSkip)(`orphan-projects-and-flags${skipNote}`, () => {
  test("★ a merge that kills the root projects each orphan as a plain .tid and raises the flag; the root's return clears both ★", async () => {
    const r = await shoreRig();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const root = "lar:///ha.ka.ba/test/orphans/root";
    const stem = "ha.ka.ba/test/orphans/root";
    const flag = memeOrphanAlertTitle(root);
    const p = stand(r);
    const records = family(root);

    // CONTROL: an intact family projects one carrier file, no orphan folder, and raises nothing.
    await peerChange(r, (store) => store.writeFamily(records, [], peer), records.map((x) => x.tiddler.title));
    await p.projector.idle();
    expect(tree(dir).filter((f) => !f.endsWith(".kapae"))).toEqual([`${stem}.mem`]);
    expect(r.wiki.getTiddler(flag), "a whole family raises nothing").toBeUndefined();

    // THE ORPHAN: a peer tombstones the root alone; the children stay live.
    await peerChange(r, (store) => store.tombstone(root, peer), [root]);
    await p.projector.idle();
    expect(r.wiki.getTiddler(root)).toBeUndefined();
    expect(r.wiki.getTiddler(`${root}#/a`), "the children stay live, never collected").toBeDefined();
    expect(tree(dir).filter((f) => f.includes(".orphans/"))).toEqual([
      `${stem}.orphans/a.tid`, `${stem}.orphans/a/deep.tid`, `${stem}.orphans/b.tid`, `${stem}.orphans/c.tid`,
    ]);
    expect(existsSync(join(dir, `${stem}.mem`)), "the root's own file leaves with the root").toBe(false);

    // Each orphan reads back as a plain record under its own title.
    const back = readTid(join(dir, `${stem}.orphans/a/deep.tid`));
    expect(back).toMatchObject({ title: `${root}#/a/deep`, text: "deep body", "$fragment-parent": `${root}#/a`, "$slot": "#/a/deep" });
    expect(back["$origin-bag"], "the host's stamp never reaches disk").toBeUndefined();

    // The flag: one alert per root, naming the orphans and a log cursor, never a clock.
    const alert = r.wiki.getTiddler(flag)?.fields as Record<string, unknown> | undefined;
    expect(alert, "the flag rises").toBeDefined();
    expect(alert!["root"]).toBe(root);
    expect(String(alert!["orphans"]).split(" ")).toEqual([`${root}#/a`, `${root}#/a/deep`, `${root}#/b`, `${root}#/c`]);
    expect(String(alert!["seen-at"])).toMatch(new RegExp(`^${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@\\d+$`));
    expect(alert!["ts"], "no wall clock rides the alert").toBeUndefined();

    // THE ROOT RETURNS: the children re-root, the folder leaves, the flag clears.
    await peerChange(r, (store) => store.put(records[0]!, peer), [root]);
    await p.projector.idle();
    expect(r.wiki.getTiddler(root), "the root stands again").toBeDefined();
    expect(surfaced, "the projector raised no standoff").toEqual([]);
    expect(tree(dir)).toEqual([`${stem}.mem`]);
    expect(r.wiki.getTiddler(flag), "the flag clears").toBeUndefined();
    await p.stop();
    await r.stop();
  }, 120_000);

  test("★ a lone child that lands with no root projects and flags the same way ★", async () => {
    const r = await shoreRig();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const root = "lar:///ha.ka.ba/test/orphans/never-stood";
    const child: LarTiddlerRecord = { tiddler: { title: `${root}#/lone`, type: CARRIER, text: "lone body", "$fragment-parent": root, "$slot": "#/lone" } };
    const p = stand(r);
    await peerChange(r, (store) => store.put(child, peer), [child.tiddler.title]);
    await p.projector.idle();
    expect(tree(dir)).toEqual(["ha.ka.ba/test/orphans/never-stood.orphans/lone.tid"]);
    expect(r.wiki.getTiddler(memeOrphanAlertTitle(root))?.fields["orphans"]).toBe(`${root}#/lone`);
    await p.stop();
    await r.stop();
  }, 120_000);

  test("★ the flag re-derives at boot: a projector that starts over standing orphans raises it and writes them ★", async () => {
    const r = await shoreRig();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const root = "lar:///ha.ka.ba/test/orphans/before-boot";
    const child: LarTiddlerRecord = { tiddler: { title: `${root}#/lone`, type: CARRIER, text: "lone body", "$fragment-parent": root, "$slot": "#/lone" } };
    await peerChange(r, (store) => store.put(child, peer), [child.tiddler.title]);
    expect(r.wiki.getTiddler(memeOrphanAlertTitle(root)), "nothing raised it before the projector stood").toBeUndefined();
    const p = stand(r);
    await p.projector.idle();
    expect(tree(dir)).toEqual(["ha.ka.ba/test/orphans/before-boot.orphans/lone.tid"]);
    expect(r.wiki.getTiddler(memeOrphanAlertTitle(root))).toBeDefined();
    await p.stop();
    await r.stop();
  }, 120_000);
});
