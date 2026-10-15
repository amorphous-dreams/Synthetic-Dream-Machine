/**
 * ONE STANDOFF, TWO DOORS: A PERSON TAKES THE DISK'S WORDS UNDER THE STANDOFF'S KEY.
 *
 * A person edits a mirrored carrier by hand, and an ingest from a holding copy moves the records. Both
 * sides moved past the mirror's base, so the carrier stands off as `both-moved` under one key and one
 * alert. `lares ingest` of the mirror file reads that conflict and lands nothing. `take-records` settles
 * the standoff toward the records. Its twin, `take-disk`, settles it toward the disk: under the key, the
 * file's words land in the records, the file's bytes stay as the hand left them, the base pins and the
 * alert clears.
 *
 * The key reaches the one state its giver read, on both sides: another key, a file that moved since, and
 * records that moved since each refuse by name and land nothing. No wave takes this door by itself.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ShoreRig, RIG_BAG, coreBlobSkip } from "./shore-rig.js";
import { syncedTreeKey } from "../src/synced-tree.js";
import { answerShore } from "../src/shore-verb.js";
import { takeDisk, type TakeDiskDeps } from "../../lares-cli/src/shore-take-disk.js";
import type { ShoreAnswer } from "../../lares-cli/src/shore-core.js";
import { scanSource } from "../../lares-cli/src/ingest-core.js";

const HOLDING_LINE = "A LINE ADDED IN THE HOLDING COPY.";
const HAND_LINE = "A HAND WROTE THIS LINE IN THE MIRROR FILE.";
const LATER_LINE = "A LATER LINE ADDED IN THE HOLDING COPY.";
const addLine = (text: string, line: string): string => text.replace(/\n! ([^\n]*)\n/, (m) => `${m}\n${line}\n`);

describe.skipIf(coreBlobSkip)("a both-moved standoff settles toward the disk under its key", () => {
  let rig: ShoreRig;
  const holdingOf = (uri: string): string => path.join(rig.scratch, "wikis", "inbox", `${uri.slice("lar:///".length)}.mem`);
  const wikiSays = (uri: string, words: string): boolean =>
    rig.titlesOf(uri).some((t) => String((rig.engine.$tw as unknown as { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } } }).wiki.getTiddler(t).fields["text"] ?? "").includes(words));
  /** The island's shore, as `askShore` reads it. */
  const ask = async (args: Readonly<Record<string, unknown>>): Promise<ShoreAnswer> => {
    const output = await answerShore(rig.projector, args);
    const ok = output["ok"] === true;
    return { ok, output, refusal: ok ? null : String(output["refusal"]), why: ok ? null : String(output["why"]) };
  };
  const deps = (over: Partial<TakeDiskDeps> = {}): TakeDiskDeps => ({ ask, tree: rig.tree, root: rig.scratch, did: "did:test", submit: rig.submitWave, ...over });
  /** A hand's edit in the mirror, then a holding ingest that moves the records: the carrier stands off. */
  const standOff = async (uri: string, holdingLine: string): Promise<{ hand: string; key: string }> => {
    const before = rig.read(uri);
    const hand = before.includes(HAND_LINE) ? before : addLine(before, HAND_LINE);
    rig.write(uri, hand);
    const holding = holdingOf(uri);
    mkdirSync(path.dirname(holding), { recursive: true });
    writeFileSync(holding, addLine(before.replace(`\n${HAND_LINE}\n`, ""), holdingLine), "utf8");
    await rig.ingest(holding);
    const standing = rig.projector.standing().find((s) => s.uri === uri);
    if (standing === undefined) throw new Error(`rig: ${uri} stands in no standoff`);
    return { hand, key: standing.standoff };
  };

  beforeAll(async () => {
    rig = await ShoreRig.stand(4);
    await rig.ingest();
    await rig.boot();
  }, 300_000);
  afterAll(async () => { await rig?.close(); });

  test("the standoff reads both-moved, and its one alert names both doors under its key", async () => {
    const uri = rig.uris[0]!;
    const { key } = await standOff(uri, HOLDING_LINE);
    const alert = rig.conflicts.filter((c) => c.uri === uri);
    expect(alert).toHaveLength(1);
    expect(alert[0]!.reason).toMatch(/both-moved/);
    expect(alert[0]!.reason, "the alert names no door that lands the disk's words").toContain(`lares shore take-disk ${uri} --key ${key}`);
    expect(alert[0]!.reason).toContain(`lares shore take-records ${uri} --key ${key}`);
    expect(wikiSays(uri, HOLDING_LINE)).toBe(true);
    expect(wikiSays(uri, HAND_LINE)).toBe(false);
  });

  test("`lares ingest` of the mirror file reads the conflict by name and lands nothing", async () => {
    const uri = rig.uris[0]!;
    const settled = await rig.ingest(rig.fileOf(uri));
    expect(settled.conflicts.map((c) => c.uri)).toEqual([uri]);
    expect(settled.named.get(uri)?.["reason"]).toBe("both-moved");
    expect(wikiSays(uri, HAND_LINE)).toBe(false);
  });

  test("CONTROL: another key takes nothing and names the key that stands", async () => {
    const uri = rig.uris[0]!;
    const key = rig.projector.standing().find((s) => s.uri === uri)!.standoff;
    const wrong = await takeDisk({ uri, key: "0".repeat(24) }, deps());
    expect(wrong).toMatchObject({ ok: false, refusal: "standoff-key-moved" });
    expect((wrong as { why: string }).why).toContain(key);
    expect(await takeDisk({ uri: `${uri}-other`, key }, deps())).toMatchObject({ ok: false, refusal: "no-standoff-stands" });
    expect(wikiSays(uri, HAND_LINE)).toBe(false);
  });

  test("★ take-disk under the standing key lands the file's words, keeps the file's bytes, pins the base and clears the alert ★", async () => {
    const uri = rig.uris[0]!;
    const hand = rig.read(uri);
    const key = rig.projector.standing().find((s) => s.uri === uri)!.standoff;
    const taken = await takeDisk({ uri, key }, deps());
    expect(taken).toMatchObject({ ok: true, uri, bag: RIG_BAG, key, path: rig.fileOf(uri) });
    await rig.land();
    expect(wikiSays(uri, HAND_LINE)).toBe(true);
    expect(wikiSays(uri, HOLDING_LINE), "the records kept the words the person chose the disk over").toBe(false);
    expect(rig.read(uri)).toBe(hand);
    expect(rig.projector.standing().filter((s) => s.uri === uri)).toEqual([]);
    expect(rig.resolved.some((r) => r.uri === uri && r.standoff === key)).toBe(true);
    expect(rig.tree.baseAt(syncedTreeKey(RIG_BAG, uri), rig.fileOf(uri))).not.toBeNull();
    // The next look at the same file reads it unchanged: the standoff left nothing behind.
    expect(scanSource(rig.scratch, rig.fileOf(uri), RIG_BAG, rig.tree)!.rows.map((r) => r.status)).toEqual(["unchanged"]);
  });

  test("★ a key read before the records moved again lands nothing: the answer reaches the one state its giver read ★", async () => {
    const uri = rig.uris[1]!;
    const first = await standOff(uri, HOLDING_LINE);
    // The person read `first.key`. Then the holding copy moved the records once more.
    const stale = await ask({ op: "list", uris: [uri] });
    const second = await standOff(uri, LATER_LINE);
    expect(second.key).not.toBe(first.key);
    // The door asks the island afresh, and the island names the key that stands.
    expect(await takeDisk({ uri, key: first.key }, deps())).toMatchObject({ ok: false, refusal: "standoff-key-moved" });
    // And where the records move between the island's answer and the wave (the listing the person's key
    // matched arrives stale), the gate itself stands off: the wave's base names records that moved.
    const raced = await takeDisk({ uri, key: first.key }, deps({ ask: async () => stale }));
    expect(raced).toMatchObject({ ok: false, refusal: "standoff-key-moved" });
    await rig.land();
    expect(wikiSays(uri, HAND_LINE)).toBe(false);
    expect(wikiSays(uri, LATER_LINE)).toBe(true);
    expect(rig.projector.standing().find((s) => s.uri === uri)?.standoff).toBe(second.key);
  });

  test("a file that moved since the key was read lands nothing", async () => {
    const uri = rig.uris[1]!;
    const key = rig.projector.standing().find((s) => s.uri === uri)!.standoff;
    const stale = await ask({ op: "list", uris: [uri] });
    rig.write(uri, addLine(rig.read(uri), "A SECOND HAND LINE, WRITTEN AFTER THE KEY WAS READ."));
    const moved = await takeDisk({ uri, key }, deps({ ask: async () => stale }));
    expect(moved).toMatchObject({ ok: false, refusal: "standoff-key-moved" });
    expect((moved as { why: string }).why).toMatch(/moved since the key was read/);
    await rig.land();
    expect(wikiSays(uri, HAND_LINE)).toBe(false);
  });

  test("CONTROL: take-records still settles the same kind of standoff toward the records", async () => {
    const uri = rig.uris[1]!;
    await rig.projector.sense([uri]);
    const key = rig.projector.standing().find((s) => s.uri === uri)!.standoff;
    expect(await answerShore(rig.projector, { op: "take-records", uri, key })).toMatchObject({ ok: true, took: "records" });
    expect(rig.read(uri)).toContain(LATER_LINE);
    expect(rig.read(uri)).not.toContain(HAND_LINE);
    expect(rig.projector.standing().filter((s) => s.uri === uri)).toEqual([]);
  });

  test("the shore lists a standoff with the states its key folds, and answers for named carriers alone", async () => {
    const uri = rig.uris[2]!;
    const { key } = await standOff(uri, HOLDING_LINE);
    const all = await answerShore(rig.projector, { op: "list" });
    const one = await answerShore(rig.projector, { op: "list", uris: [uri] });
    expect(one["standoffCount"]).toBe(1);
    expect((one["standoffs"] as Array<Record<string, unknown>>)[0]).toMatchObject({ uri, bagId: RIG_BAG, standoff: key, kind: "sides", path: rig.fileOf(uri) });
    expect(typeof (one["standoffs"] as Array<Record<string, unknown>>)[0]!["records"]).toBe("string");
    expect((all["standoffs"] as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(await answerShore(rig.projector, { op: "list", uris: ["lar:///nowhere"] })).toMatchObject({ ok: true, standoffCount: 0, pendingCount: 0 });
  });
});
