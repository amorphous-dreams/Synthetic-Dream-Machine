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
import { readFileSync } from "node:fs";
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
  settle(): Promise<void>;
}

/** The keeper the island wires, over the rig's wiki and projector; the base's words read from `bases`. */
async function keep(r: ShoreRig, rules: ReadonlySet<CollapseRule>, bases: Map<string, string>): Promise<Kept> {
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
  });
  await r.boot({
    extra: {
      onConflict: (info) => { r.conflicts.push(info); pending.push(keeper.weigh(info).then((o) => outcomes.push(o))); },
      onConflictResolved: (info) => { r.resolved.push(info); pending.push(keeper.resolved(info)); },
    },
  });
  return {
    keeper, audits, alerts, outcomes,
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
