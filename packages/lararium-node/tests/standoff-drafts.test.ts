/**
 * A STAND-OFF COMES INSIDE AS DRAFTS (operator ruling, 2026-11-23): the disk side loads as drafts of its targets, the
 * person's collapse rules run against them, and what no rule collapses waits as drafts plus one alert that names them.
 *
 * The rig stands the real legs (`shore-rig.ts`): the ingest gesture, a booted wiki, the projector with the island's
 * congruences, and here the keeper the island wires beside it. The base's words come from the file as the gesture
 * landed it (the history a face pool's git would hold).
 *
 *   - THE MIDNIGHT STORY: a hand edits one slot of the file while the vessel's seat appends to another slot in the
 *     records. With `slot-disjoint` enabled for the bag, the stand-off collapses, both edits survive in the file and in
 *     the records, and no alert waits.
 *   - A same-slot conflict stays: the file's side stands as a draft, one alert names it, and the file keeps the
 *     operator's words.
 *   - A disabled rule collapses nothing.
 *   - The alert names the drafts and the carrier and carries no draft's words.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { makeTw5Deserializer } from "@lararium/tw5";
import { nativeCarrierLanding } from "../src/native-landing.js";
import { readCarrierAt, pointerBodyAt } from "../src/standoff-drafts.js";
import { canonicalizeCarrierText, carrierLanding, carrierRecords } from "@lararium/tw5/carrier-canonical";
import { contentHash } from "../src/synced-tree.js";
import { StandoffKeeper, keeperWikiOf, standoffAlertWords, standoffDraftTitle, type CollapseAudit, type KeeperOutcome, type StandoffAlert, type Tw5WikiLike } from "../src/standoff-drafts.js";
import type { CollapseRule } from "../src/standoff-collapse.js";
import { ShoreRig, RIG_BAG, coreBlobSkip } from "./shore-rig.js";

let rig: ShoreRig | null = null;
afterEach(async () => { await rig?.close(); rig = null; });

interface Kept {
  readonly keeper: StandoffKeeper;
  readonly audits: CollapseAudit[];
  readonly alerts: StandoffAlert[];
  readonly outcomes: KeeperOutcome[];
  /** The one line each keep of the disk printed. */
  readonly notices: string[];
  settle(): Promise<void>;
}

/** The history the rig's document holds, as the projector's `lineageOf` door answers it; and why its saves cannot rest, if they cannot. */
interface Told { lineage?: { heads: string[]; holds: string[]; quiet: boolean }; unrested?: string }

/** The keeper the island wires, over the rig's wiki and projector; the base's words read from `bases`. */
async function keep(r: ShoreRig, rules: ReadonlySet<CollapseRule>, bases: Map<string, string>, told: Told = {}): Promise<Kept> {
  const notices: string[] = [];
  const audits: CollapseAudit[] = [];
  const alerts: StandoffAlert[] = [];
  const outcomes: KeeperOutcome[] = [];
  const pending: Array<Promise<unknown>> = [];
  const keeper = new StandoffKeeper({
    wiki: keeperWikiOf(r.engine.$tw as unknown as Tw5WikiLike),
    standing: () => r.projector.standing(),
    render: (bag, uri, key) => r.projector.standoffRender(bag, uri, key),
    takeRecords: (bag, uri, key) => r.projector.takeRecords(bag, uri, key),
    rules: () => rules,
    baseText: (_path, hash) => [...bases.values()].find((t) => contentHash(t) === hash) ?? null,
    readDisk: (path) => { try { return readFileSync(path, "utf8"); } catch { return null; } },
    deserialize: carrierRecords,
    canonical: canonicalizeCarrierText,
    land: carrierLanding,
    // The rig's saves land in its one bag, under its one mirror.
    saveBag: () => RIG_BAG,
    grants: (bag) => bag === RIG_BAG,
    audit: (row) => { audits.push(row); },
    alert: (a) => { alerts.push(a); },
    notice: (line) => { notices.push(line); },
    readCarrier: readCarrierAt,
    pointerBody: pointerBodyAt,
    landNative: (uri, ext, body, meta) => nativeCarrierLanding(makeTw5Deserializer(r.engine), uri, ext, body, meta),
    unrested: () => told.unrested ?? null,
  });
  await r.boot({
    extra: {
      documentOf: () => "automerge:working",
      lineageOf: () => (told.lineage === undefined ? null : { heads: told.lineage.heads, quiet: told.lineage.quiet, holds: (named: readonly string[]) => named.every((h) => told.lineage!.holds.includes(h)) }),
      onConflict: (info) => { r.conflicts.push(info); pending.push(keeper.weigh(info).then((o) => outcomes.push(o))); },
      onConflictResolved: (info) => { r.resolved.push(info); pending.push(keeper.resolved(info)); },
    },
  });
  return {
    keeper, audits, alerts, outcomes, notices,
    async settle() {
      // Each weighing may start a reconcile that raises the next stand-off: settle until the shore stands quiet.
      for (let seen = -1; seen !== pending.length;) {
        seen = pending.length;
        await Promise.all(pending);
        await r.idle();
      }
    },
  };
}

/** A rig carrier with at least two slots, and its slot titles in the wiki. */
function twoSlots(r: ShoreRig): { uri: string; slots: string[] } {
  for (const uri of r.uris) {
    // The head slot first: it carries prose a hand edits; another slot takes the seat's append.
    const slots = r.titlesOf(uri).filter((t) => t.startsWith(`${uri}#/`)).sort((a, b) => Number(b.endsWith("#/head")) - Number(a.endsWith("#/head")) || (a < b ? -1 : 1));
    if (slots.length >= 2) return { uri, slots };
  }
  throw new Error("rig: no carrier holds two slots");
}

const wikiText = (r: ShoreRig, title: string): string => String((r.engine.$tw as unknown as Tw5WikiLike).wiki.getTiddler(title)?.fields["text"] ?? "");
const firstWords = (text: string): string => text.split("\n").find((l) => /^[A-Za-z'`]/.test(l.trim()) && l.trim().length > 12)!.trim();

describe.skipIf(coreBlobSkip)("a stand-off comes inside as drafts", () => {
  test("THE MIDNIGHT STORY: a hand's disk edit and a seat's append to different slots collapse slot-disjoint, and both survive", async () => {
    rig = await ShoreRig.stand(6);
    await rig.ingest();
    const { uri, slots } = twoSlots(rig);
    const bases = new Map([[uri, rig.read(uri)]]);
    const kept = await keep(rig, new Set(["slot-disjoint"]), bases);

    // The hand, at midnight, while the seat works: one line of the first slot, on disk.
    const handLine = firstWords(wikiText(rig, slots[0]!));
    rig.write(uri, rig.read(uri).replace(handLine, `${handLine} (the hand's midnight words)`));
    // The seat's append, to the records: the second slot.
    await rig.save(slots[1]!, `${wikiText(rig, slots[1]!)}\n\nThe seat appended this line.`);
    await kept.settle();

    expect(rig.conflicts.length, "the stand-off entered").toBeGreaterThan(0);
    expect(kept.audits.map((a) => a.rule)).toContain("slot-disjoint");
    expect(kept.alerts.filter((a) => a.clear !== true), "no alert waits").toEqual([]);
    expect(rig.projector.standing().filter((s) => s.uri === uri)).toEqual([]);
    const file = rig.read(uri);
    expect(file).toContain("(the hand's midnight words)");
    expect(file).toContain("The seat appended this line.");
    expect(wikiText(rig, slots[0]!)).toContain("(the hand's midnight words)");
    expect(wikiText(rig, slots[1]!)).toContain("The seat appended this line.");
    expect(kept.keeper.draftsOf(uri), "the drafts left with the save").toEqual([]);
  });

  test("a same-slot conflict stays a draft plus one alert, and the file keeps the operator's words", async () => {
    rig = await ShoreRig.stand(6);
    await rig.ingest();
    const { uri, slots } = twoSlots(rig);
    const kept = await keep(rig, new Set(["slot-disjoint"]), new Map([[uri, rig.read(uri)]]));

    const line = firstWords(wikiText(rig, slots[0]!));
    rig.write(uri, rig.read(uri).replace(line, `${line} (the operator's own words)`));
    const operatorFile = rig.read(uri);
    await rig.save(slots[0]!, wikiText(rig, slots[0]!).replace(line, `${line} (the seat's rival words)`));
    await kept.settle();

    expect(kept.audits).toEqual([]);
    expect(rig.read(uri), "the operator's disk words never get overwritten").toBe(operatorFile);
    const key = rig.projector.standing().find((s) => s.uri === uri)!.standoff;
    const drafts = kept.keeper.draftsOf(uri);
    expect(drafts.map((d) => d.of)).toContain(slots[0]);
    const draft = (rig.engine.$tw as unknown as Tw5WikiLike).wiki.getTiddler(standoffDraftTitle(slots[0]!, key))!.fields;
    expect(draft["draft.of"]).toBe(slots[0]);
    expect(String(draft["text"])).toContain("(the operator's own words)");
    const raised = kept.alerts.filter((a): a is Extract<StandoffAlert, { bagId: string }> => a.clear !== true);
    expect(raised).toHaveLength(1);
    expect(raised[0]!.drafts).toContain(standoffDraftTitle(slots[0]!, key));
    expect(raised[0]!.bagId).toBe(RIG_BAG);

    // THE ALERT NAMES, NEVER QUOTES: no draft's words ride it, and each action names a runnable command.
    const words = standoffAlertWords(raised[0]!);
    for (const value of Object.values(words)) {
      expect(value).not.toContain("the operator's own words");
      expect(value).not.toContain("the seat's rival words");
    }
    expect(words.reason).toContain(uri);
    expect(words.reason).toContain(`lares shore keep-disk ${uri} --key ${key}`);
    expect(words.reason).toContain(`lares shore keep-records ${uri} --key ${key}`);
    expect(words.reason).toContain(`lares shore keep-both ${uri} --key ${key}`);
    expect(words.reason).toContain(`lares shore drafts ${uri}`);
  });

  test("a disabled rule collapses nothing: the midnight story with no rule enabled waits for a person", async () => {
    rig = await ShoreRig.stand(6);
    await rig.ingest();
    const { uri, slots } = twoSlots(rig);
    const kept = await keep(rig, new Set(), new Map([[uri, rig.read(uri)]]));

    const handLine = firstWords(wikiText(rig, slots[0]!));
    rig.write(uri, rig.read(uri).replace(handLine, `${handLine} (the hand's midnight words)`));
    const operatorFile = rig.read(uri);
    await rig.save(slots[1]!, `${wikiText(rig, slots[1]!)}\n\nThe seat appended this line.`);
    await kept.settle();

    expect(kept.audits).toEqual([]);
    expect(rig.read(uri)).toBe(operatorFile);
    expect(kept.alerts.filter((a) => a.clear !== true)).toHaveLength(1);
    expect(kept.keeper.draftsOf(uri).map((d) => d.of)).toEqual([slots[0]]);
    expect(rig.projector.standing().filter((s) => s.uri === uri)).toHaveLength(1);
  });

  test("a resolution takes its drafts with it, save those a person kept", async () => {
    rig = await ShoreRig.stand(6);
    await rig.ingest();
    const { uri, slots } = twoSlots(rig);
    const kept = await keep(rig, new Set(), new Map([[uri, rig.read(uri)]]));
    const line = firstWords(wikiText(rig, slots[0]!));
    rig.write(uri, rig.read(uri).replace(line, `${line} (the operator's own words)`));
    await rig.save(slots[1]!, `${wikiText(rig, slots[1]!)}\n\nThe seat appended this line.`);
    await kept.settle();
    const key = rig.projector.standing().find((s) => s.uri === uri)!.standoff;

    // keep-both: the drafts stay, and the records take the file.
    expect(await kept.keeper.keep(uri, key)).toEqual([standoffDraftTitle(slots[0]!, key)]);
    expect((await rig.projector.takeRecords(RIG_BAG, uri, key)).took).toBe(true);
    await kept.settle();
    expect(kept.keeper.draftsOf(uri).map((d) => d.kept)).toEqual([true]);
    expect(kept.alerts.at(-1)).toEqual({ clear: true, standoff: key });
  });
});

describe.skipIf(coreBlobSkip)("records that fell behind their base keep the disk, with no hand", () => {
  // OPERATOR'S TALK-OUT (2026-11-25): a document that LACKS the heads its base names went backwards (an older document
  // loaded, a save lost), so it holds nothing newer than the base and the file carries the newest words the house holds.
  // The house keeps the disk by itself and says so in one line; a person hears only where the answer cannot be read.
  /** The file and the records agree at head `h2`; then the document reads back at `h1` with an older slot. */
  const fallBehind = async (told: Told): Promise<{ kept: Kept; uri: string; slot: string; newest: string; file: string }> => {
    rig = await ShoreRig.stand(6);
    await rig.ingest();
    const { uri, slots } = twoSlots(rig);
    told.lineage = { heads: ["h2"], holds: ["h1", "h2"], quiet: true };
    const kept = await keep(rig, new Set(), new Map([[uri, rig.read(uri)]]), told);
    await kept.settle();
    const file = rig.read(uri);
    const newest = wikiText(rig, slots[1]!);
    told.lineage = { ...told.lineage, heads: ["h1"], holds: ["h1"] };
    await rig.save(slots[1]!, "What the older document said, before the write the file still carries.");
    await kept.settle();
    return { kept, uri, slot: slots[1]!, newest, file };
  };

  test("the file's words land back in the records, the base moves, and one notice names the document and the heads", async () => {
    const { kept, uri, slot, newest, file } = await fallBehind({});
    expect(rig!.read(uri), "the older render never wrote over the file").toBe(file);
    expect(wikiText(rig!, slot), "the records say the file's words again").toBe(newest);
    expect(rig!.projector.standing().filter((s) => s.uri === uri)).toEqual([]);
    expect(kept.alerts.filter((a) => a.clear !== true), "no alert waits for a person").toEqual([]);
    expect(kept.audits.map((a) => `${a.rule} -> ${a.toward}`)).toEqual(["records-behind-base -> disk"]);
    expect(kept.notices).toHaveLength(1);
    expect(kept.notices[0]).toContain(uri);
    expect(kept.notices[0]).toContain("automerge:working");
    expect(kept.notices[0]).toContain("h2");
    expect(kept.notices[0]).toContain("kept the disk");
  });

  test("a write landed in that document since it mounted: it may hold words newer than the file, so a person picks", async () => {
    const told: Told = {};
    rig = await ShoreRig.stand(6);
    await rig.ingest();
    const { uri, slots } = twoSlots(rig);
    told.lineage = { heads: ["h2"], holds: ["h1", "h2"], quiet: true };
    const kept = await keep(rig, new Set(), new Map([[uri, rig.read(uri)]]), told);
    await kept.settle();
    const file = rig.read(uri);
    told.lineage = { heads: ["h9"], holds: ["h1", "h9"], quiet: false };
    await rig.save(slots[1]!, "Words a seat wrote into the document that fell behind.");
    await kept.settle();
    expect(rig.read(uri)).toBe(file);
    expect(wikiText(rig, slots[1]!)).toBe("Words a seat wrote into the document that fell behind.");
    expect(kept.notices).toEqual([]);
    const waits = kept.alerts.filter((a) => a.clear !== true);
    expect(waits).toHaveLength(1);
    expect(standoffAlertWords(waits[0] as Extract<StandoffAlert, { readonly bagId: string }>).reason).toContain("since it mounted");
  });

  test("the document's saves cannot rest: the keep answers owed with that reason, and claims nothing landed", async () => {
    const { kept, uri, slot, file } = await fallBehind({ unrested: "signer-refused: this face's saves of the document wait in memory" });
    expect(rig!.read(uri)).toBe(file);
    expect(wikiText(rig!, slot)).toBe("What the older document said, before the write the file still carries.");
    expect(kept.notices).toEqual([]);
    expect(kept.audits).toEqual([]);
    const last = kept.outcomes.at(-1)!;
    expect(last.kind).toBe("awaiting");
    expect((last as Extract<KeeperOutcome, { kind: "awaiting" }>).why).toMatch(/^owed: .*signer-refused/);
  });
});

describe.skipIf(coreBlobSkip)("one keeper for every carrier: a native carrier that fell behind keeps its disk too", () => {
  // OPERATOR'S RULING (2026-11-25, hand-edits-the-mirror 3): `.mem`, `.tid` and file+`.meta` land through one keeper, the
  // way the hand's `lares shore keep-disk` lands them: whole. A pointer body still refuses by name.
  const NOTE = "lar:///ha.ka.ba/probe/keeper/note";
  /** The one file under the mirror whose path names the probe, with the given extension. */
  const fileWith = (r: ShoreRig, ext: string): string => {
    const hit = (readdirSync(r.bagDir, { recursive: true }) as string[]).map((f) => path.join(r.bagDir, f))
      .filter((f) => statSync(f).isFile() && f.includes("keeper") && f.endsWith(ext));
    expect(hit, `one ${ext} file names the probe`).toHaveLength(1);
    return hit[0]!;
  };
  /** A native record projects, the file and the records agree at `h2`, then the document reads back at `h1` with older words. */
  const fallBehind = async (fields: Record<string, unknown>, ext: string): Promise<{ kept: Kept; file: string; bytes: string }> => {
    rig = await ShoreRig.stand(1);
    await rig.ingest();
    const told: Told = { lineage: { heads: ["h2"], holds: ["h1", "h2"], quiet: true } };
    const kept = await keep(rig, new Set(), new Map(), told);
    await rig.put({ title: NOTE, ...fields });
    await kept.settle();
    const file = fileWith(rig, ext);
    const bytes = readFileSync(file, "utf8");
    told.lineage = { heads: ["h1"], holds: ["h1"], quiet: true };
    await rig.save(NOTE, "What the older document said.");
    await kept.settle();
    return { kept, file, bytes };
  };

  test("a `.tid` lands whole: the records say the file's words again, and the audit row names the disk as writer", async () => {
    const { kept, file, bytes } = await fallBehind({ text: "The newest words, which only the file still carries.", tags: "probe", type: "text/vnd.tiddlywiki" }, ".tid");
    expect(readFileSync(file, "utf8"), "the older render never wrote over the file").toBe(bytes);
    expect(wikiText(rig!, NOTE)).toBe("The newest words, which only the file still carries.");
    expect(rig!.projector.standing().filter((s) => s.uri === NOTE)).toEqual([]);
    expect(kept.alerts.filter((a) => a.clear !== true)).toEqual([]);
    expect(kept.audits.map((a) => `${a.rule} -> ${a.toward} by ${a.writer}`)).toEqual(["records-behind-base -> disk by disk"]);
    expect(kept.notices).toHaveLength(1);
    expect(kept.notices[0]).toContain(NOTE);
  });

  test("a file with its `.meta` lands whole, body and sidecar as one carrier", async () => {
    const { kept, file, bytes } = await fallBehind({ text: "# The newest words\n\nOnly the file still carries them.\n", tags: "probe", type: "text/markdown" }, ".md");
    expect(existsSync(`${file}.meta`), "the carrier rides a sidecar").toBe(true);
    expect(readFileSync(file, "utf8")).toBe(bytes);
    expect(wikiText(rig!, NOTE)).toBe("# The newest words\n\nOnly the file still carries them.\n");
    expect(rig!.projector.standing().filter((s) => s.uri === NOTE)).toEqual([]);
    expect(kept.audits.map((a) => a.rule)).toEqual(["records-behind-base"]);
  });

  test("the blob law reads at the keeper as it reads at the hand's door: a picture rides a pointer, a `.tid` does not", () => {
    expect(pointerBodyAt("/mirror/a/picture.png", { body: "iVBORw0KGgo=", binary: true })).toBe(true);
    expect(pointerBodyAt("/mirror/a/note.tid", { body: "title: x\n\nwords", binary: false })).toBe(false);
  });
});

