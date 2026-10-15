/**
 * A WAVE NO PERSON STANDS BEHIND NEVER ADOPTS OVER DIFFERING RECORDS.
 *
 * A person edits a carrier by hand while the vessel rests, and the vessel boots holding no base. The file
 * holds the person's words and the records hold other ones, and nothing says which moved last. A watcher
 * hears the file and settles a wave by itself. That wave lands nothing for the carrier: the gate answers
 * `conflict`, `no-base`. The watcher hands the carrier to the vessel's shore, where the projector weighs the
 * same states and raises the one keyed alert. A person then settles it by name: `lares ingest` of the file
 * adopts the disk's words, since a person's gesture names that act.
 *
 * Controls: an unattended wave over a file that says what the records say pins a base and raises nothing;
 * an unattended wave over a file at an address whose records hold nothing lands it; an unattended wave
 * with a base lands a clean disk edit.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { ShoreRig, RIG_BAG, coreBlobSkip } from "./shore-rig.js";
import { syncedTreeKey } from "../src/synced-tree.js";

const EDIT = "A HAND WROTE THIS LINE WHILE THE VESSEL RESTED.";
const LATER = "A HAND WROTE THIS LINE WHILE THE VESSEL STOOD.";
const addLine = (text: string, line: string): string => text.replace(/\n! ([^\n]*)\n/, (m) => `${m}\n${line}\n`);

describe.skipIf(coreBlobSkip)("an unattended wave meets a file that holds no base", () => {
  let rig: ShoreRig;
  const wikiSays = (uri: string, words: string): boolean =>
    rig.titlesOf(uri).some((t) => String((rig.engine.$tw as unknown as { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } } }).wiki.getTiddler(t).fields["text"] ?? "").includes(words));

  beforeAll(async () => {
    rig = await ShoreRig.stand(4);
    await rig.ingest();
    await rig.boot();
    await rig.rest();
    // The vessel rests; a hand edits one file; the vessel boots with a tree that names no base.
    rig.write(rig.uris[0]!, addLine(rig.read(rig.uris[0]!), EDIT));
    rig.newTree();
  }, 300_000);
  afterAll(async () => { await rig?.close(); });

  test("★ the wave lands nothing for the edited carrier and names the standoff `no-base` ★", async () => {
    const [uri] = rig.uris;
    const edited = rig.read(uri!);
    const settled = await rig.ingest(rig.bagDir, { unattended: true });
    expect(settled.conflicts.map((c) => c.uri), "the wave adopted a file that holds no base over records that say something else").toEqual([uri]);
    expect(settled.conflicts[0]!.why).toMatch(/no-base/);
    expect(settled.named.get(uri!)?.["reason"]).toBe("no-base");
    expect(wikiSays(uri!, EDIT)).toBe(false);
    expect(rig.read(uri!)).toBe(edited);
    // A standoff pins nothing: a base names an agreement, and none stands.
    expect(rig.tree.base(syncedTreeKey(RIG_BAG, uri!))).toBeNull();
  });

  test("CONTROL: the three untouched carriers pinned their base on that same wave and stand in no conflict", () => {
    for (const uri of rig.uris.slice(1)) expect(rig.tree.base(syncedTreeKey(RIG_BAG, uri))).not.toBeNull();
  });

  test("the vessel's shore, handed that carrier, raises one keyed alert", async () => {
    const [uri] = rig.uris;
    await rig.boot();
    await rig.projector.sense([uri!]);
    expect(rig.conflicts.map((c) => c.uri)).toEqual([uri]);
    expect(rig.conflicts[0]!.reason).toMatch(/no base/i);
    expect(rig.projector.standing().map((s) => s.uri)).toEqual([uri]);
  });

  test("a person's `lares ingest` of that file names the adoption: the disk's words land and the alert clears", async () => {
    const [uri] = rig.uris;
    const key = rig.conflicts[0]!.standoff;
    const settled = await rig.ingest();
    expect(settled.conflicts).toEqual([]);
    expect(settled.refused).toEqual([]);
    expect(wikiSays(uri!, EDIT)).toBe(true);
    expect(rig.resolved).toEqual([{ bagId: RIG_BAG, uri, standoff: key }]);
  });

  test("CONTROL: an unattended wave with a base lands a clean disk edit", async () => {
    const uri = rig.uris[1]!;
    rig.write(uri, addLine(rig.read(uri), LATER));
    const settled = await rig.ingest(rig.bagDir, { unattended: true });
    expect(settled.conflicts).toEqual([]);
    expect(wikiSays(uri, LATER)).toBe(true);
  });

  test("CONTROL: an unattended wave lands a file at an address whose records hold nothing", async () => {
    const fresh = "lar:///ha.ka.ba/lares/api/pono/an-arrival-with-no-records";
    rig.write(fresh, rig.read(rig.uris[2]!).replaceAll(rig.uris[2]!.slice("lar:///".length), fresh.slice("lar:///".length)));
    const settled = await rig.ingest(rig.bagDir, { unattended: true });
    expect(settled.conflicts).toEqual([]);
    expect(settled.refused).toEqual([]);
    expect(rig.titlesOf(fresh).length).toBeGreaterThan(0);
  });
});
