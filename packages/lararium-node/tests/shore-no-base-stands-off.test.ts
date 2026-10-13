/**
 * NO BASE AND A REAL DIFFERENCE: NEITHER LEG PICKS.
 *
 * A person edits a carrier by hand while the vessel rests. A fresh vessel boots with no base recorded.
 * The file holds the person's words and the records hold the earlier ones, and nothing says which moved
 * last. The projecting leg stands off: it writes nothing, and the difference surfaces once on the alert
 * rail. The person resolves it one of three ways: ingest the file, save in the wiki until both sides say
 * the same thing, or take the records' side by name.
 *
 * Controls: with no base, a disk that holds the records' render byte for byte pins the base, writes
 * nothing and raises nothing; a disk that says the same thing in another framing does the same.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { ShoreRig, RIG_BAG, coreBlobSkip } from "./shore-rig.js";
import { syncedTreeKey } from "../src/synced-tree.js";

const EDIT = "A HAND WROTE THIS LINE WHILE THE VESSEL RESTED.";
/** A hand edit inside the carrier's body: one line added under its first heading. */
const handEdit = (text: string): string => text.replace(/\n! ([^\n]*)\n/, (m) => `${m}\n${EDIT}\n`);

describe.skipIf(coreBlobSkip)("no base and a real difference stands off", () => {
  let rig: ShoreRig;
  beforeAll(async () => {
    rig = await ShoreRig.stand(4);
    // A vessel seeds from disk, projects once and rests.
    await rig.ingest();
    await rig.boot();
    await rig.rest();
  }, 300_000);
  afterAll(async () => { await rig?.close(); });

  test("CONTROL: the seed wrote no file and raised nothing", () => {
    expect(rig.conflicts).toEqual([]);
    expect(rig.refusals).toEqual([]);
  });

  test("a hand edit made while the vessel rested survives a fresh boot that holds no base, and one alert names it", async () => {
    const [uri] = rig.uris;
    const before = rig.read(uri!);
    const edited = handEdit(before);
    expect(edited).not.toBe(before);
    rig.write(uri!, edited);

    await rig.boot({ freshTree: true });

    expect(rig.read(uri!)).toBe(edited);
    expect(rig.conflicts.map((c) => c.uri)).toEqual([uri]);
    expect(rig.conflicts[0]!.reason).toMatch(/no base/i);
    // The standoff pins nothing: a base names an agreement, and none stands.
    expect(rig.tree.base(syncedTreeKey(RIG_BAG, uri!))).toBeNull();
    // A vessel that boots again over the same states stands in the same standoff, under the same key:
    // the rail files one row for a key however often it hears of it.
    await rig.rest();
    await rig.boot();
    expect(rig.read(uri!)).toBe(edited);
    expect(rig.conflicts.map((c) => c.standoff)).toEqual([rig.conflicts[0]!.standoff, rig.conflicts[0]!.standoff]);
  });

  test("CONTROL: the three untouched carriers pinned their base on that boot, wrote nothing and raised nothing", () => {
    for (const uri of rig.uris.slice(1)) expect(rig.tree.base(syncedTreeKey(RIG_BAG, uri))).not.toBeNull();
    expect(new Set(rig.conflicts.map((c) => c.uri))).toEqual(new Set([rig.uris[0]]));
  });

  test("resolution one: ingesting the file lands the hand's words in the records, and the alert clears", async () => {
    const [uri] = rig.uris;
    const key = rig.conflicts[0]!.standoff;
    const edited = rig.read(uri!);
    const settled = await rig.ingest();
    expect(settled.refused).toEqual([]);
    expect(settled.conflicts).toEqual([]);
    expect(rig.read(uri!)).toBe(edited);
    expect(rig.resolved).toEqual([{ bagId: RIG_BAG, uri, standoff: key }]);
    expect(rig.titlesOf(uri!).some((t) => String((rig.engine.$tw as unknown as { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } } }).wiki.getTiddler(t).fields["text"] ?? "").includes(EDIT))).toBe(true);
    expect(rig.tree.base(syncedTreeKey(RIG_BAG, uri!))).not.toBeNull();
    await rig.rest();
  });

  test("resolution two: taking the records' side by the standoff's key writes the records' render and clears the alert", async () => {
    const uri = rig.uris[1]!;
    const records = rig.read(uri);
    const edited = handEdit(records);
    rig.write(uri, edited);
    await rig.boot({ freshTree: true });
    const standoff = rig.conflicts.at(-1)!;
    expect(standoff.uri).toBe(uri);
    expect(rig.read(uri)).toBe(edited);

    // CONTROL: an answer that names another standoff takes nothing.
    const wrong = await rig.projector.takeRecords(RIG_BAG, uri, "0".repeat(24));
    expect(wrong.took).toBe(false);
    expect(rig.read(uri)).toBe(edited);

    const answer = await rig.projector.takeRecords(RIG_BAG, uri, standoff.standoff);
    expect(answer.took).toBe(true);
    expect(rig.read(uri)).not.toContain(EDIT);
    expect(rig.resolved.at(-1)).toEqual({ bagId: RIG_BAG, uri, standoff: standoff.standoff });
    expect(rig.tree.base(syncedTreeKey(RIG_BAG, uri))).not.toBeNull();
    await rig.rest();
  });

  test("resolution three: a save in the wiki that brings the records to say what the disk says clears the alert", async () => {
    const uri = rig.uris[2]!;
    // The hand on disk edits one slot's body; the fresh vessel stands off.
    const before = rig.read(uri);
    const edited = handEdit(before);
    rig.write(uri, edited);
    await rig.boot({ freshTree: true });
    const standoff = rig.conflicts.at(-1)!;
    expect(standoff.uri).toBe(uri);
    const raised = rig.conflicts.length;

    // The same hand writes the same line in the wiki, under the same heading.
    const wiki = (rig.engine.$tw as unknown as { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } } }).wiki;
    const slot = rig.titlesOf(uri).find((t) => /\n?! [^\n]*\n/.test(String(wiki.getTiddler(t).fields["text"] ?? "")));
    expect(slot).toBeDefined();
    await rig.save(slot!, handEdit(`\n${String(wiki.getTiddler(slot!).fields["text"])}`).slice(1));

    expect(rig.read(uri)).toBe(edited);
    expect(rig.resolved.at(-1)).toEqual({ bagId: RIG_BAG, uri, standoff: standoff.standoff });
    expect(rig.conflicts).toHaveLength(raised);
    await rig.rest();
  });

  test("CONTROL: no base and a disk in another framing pins the base, writes nothing and raises nothing", async () => {
    const uri = rig.uris[3]!;
    const before = rig.read(uri);
    // A blank margin the render would normalize: the same carrier in another framing.
    const reframed = before.replace(/\n<<~ ahu /, "\n\n<<~ ahu ");
    expect(reframed).not.toBe(before);
    rig.write(uri, reframed);
    const raised = rig.conflicts.length;
    await rig.boot({ freshTree: true });
    expect(rig.read(uri)).toBe(reframed);
    expect(rig.conflicts).toHaveLength(raised);
    const base = rig.tree.base(syncedTreeKey(RIG_BAG, uri));
    expect(base).not.toBeNull();
    expect(base!.disk).not.toBe(base!.records);
    await rig.rest();
  });
});
