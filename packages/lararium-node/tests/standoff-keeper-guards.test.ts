/**
 * THE KEEPER'S GUARDS: a collapse lands only where the landing reads as an honest edit, in the bag the stand-off names,
 * and a person's own drafts and the alert's words stay true.
 *
 *   - Words the ingest grade refuses (an unterminated fence) load no draft and land nothing: every record stays.
 *   - A native carrier (`.tid`) collapses only toward the records: its raw bytes never overwrite a record's fields.
 *   - A landing whose save would land outside the stand-off's own bag (the cascade's working layer over canon) waits
 *     for a person, and the drafts stay.
 *   - A later stand-off never overwrites a kept draft, nor a draft a hand edited.
 *   - Where the records' side cannot land after a collapse toward the records, the drafts stay and the alert names them.
 *   - The alert offers `keep-both` only where drafts stand.
 *
 * The keeper reads a wiki the test holds in a map; the texts are a tracked carrier's own words.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { canonicalizeCarrierText, carrierLanding, carrierRecords } from "@lararium/tw5/carrier-canonical";
import { contentHash } from "../src/synced-tree.js";
import { memeSealer, type CollapseRule } from "../src/standoff-collapse.js";
import {
  StandoffKeeper, STANDOFF_FIELD, STANDOFF_KEPT_FIELD, standoffActions, standoffAlertWords, standoffDraftTitle,
  type CollapseAudit, type KeeperStandoff, type KeeperWiki, type StandoffAlert, type StandoffKeeperDeps,
} from "../src/standoff-drafts.js";

const URI = "lar:///ha.ka.ba/lares/api/pono/tick";
const BAG = "lar:///ha.ka.ba/bags/lares";
const KEY = "a1b2c3d4e5f6a7b8c9d0e1f2";
const PATH = "/scratch/bags/lares/ha.ka.ba/lares/api/pono/tick.mem";
const BASE = readFileSync(new URL("./fixtures/standoff-tick.mem", import.meta.url), "utf8");
const sealed = (t: string): string => { const s = memeSealer(t); if (!s.ok) throw new Error(s.why); return s.text; };
const DISK = sealed(BASE.replace("Device lifecycle hook: run this block once per //nalu//", "Device lifecycle hook (the hand's midnight words): run this block once per //nalu//"));
const RECORDS = sealed(BASE.replace("<<~ loulou uri=`lar:///ha.ka.ba/lares/api/pono/nalu`>>\n", "<<~ loulou uri=`lar:///ha.ka.ba/lares/api/pono/nalu`>>\n\nThe seat appended this line.\n"));

type Fields = Readonly<Record<string, unknown>>;

/** A wiki the test holds: TW5's reads and writes over a map, each act counted. */
function mapWiki(seed: readonly Fields[]): KeeperWiki & { readonly rows: Map<string, Fields>; writes: number } {
  const rows = new Map<string, Fields>(seed.map((f) => [String(f["title"]), f]));
  const wiki = {
    rows, writes: 0,
    get: (t: string) => rows.get(t),
    titles: () => [...rows.keys()],
    act: async (write: Parameters<KeeperWiki["act"]>[0]) => {
      write((f) => { wiki.writes++; rows.set(String(f["title"]), f); }, (t) => { wiki.writes++; rows.delete(t); });
    },
  };
  return wiki;
}

interface Stood {
  readonly keeper: StandoffKeeper;
  readonly wiki: ReturnType<typeof mapWiki>;
  readonly audits: CollapseAudit[];
  readonly alerts: StandoffAlert[];
  readonly took: string[];
}

function stand(o: {
  readonly disk?: string; readonly records?: string; readonly path?: string; readonly uri?: string;
  readonly rules?: readonly CollapseRule[]; readonly seed?: readonly Fields[]; readonly base?: string | null;
  readonly deps?: Partial<StandoffKeeperDeps>;
  /** Whether the stand-off still stands in the projector's set (a vector flips it to end the stand-off). */
  readonly stands?: { value: boolean };
} = {}): Stood {
  const uri = o.uri ?? URI;
  const disk = o.disk ?? DISK;
  const records = o.records ?? RECORDS;
  const path = o.path ?? PATH;
  const base = o.base === undefined ? BASE : o.base;
  const entry: KeeperStandoff = {
    bagId: BAG, uri, standoff: KEY, kind: "sides", path, disk: contentHash(disk), records: contentHash(records),
    ...(base !== null ? { base: { disk: contentHash(base), records: contentHash(base) } } : {}),
  };
  const wiki = mapWiki(o.seed ?? (carrierRecords(uri, records) ?? []));
  const audits: CollapseAudit[] = [];
  const alerts: StandoffAlert[] = [];
  const took: string[] = [];
  const keeper = new StandoffKeeper({
    wiki,
    standing: () => (o.stands?.value === false ? [] : [entry]),
    render: () => ({ text: records }),
    takeRecords: async (_b, _u, key) => { took.push(key); return { took: true }; },
    rules: () => new Set(o.rules ?? []),
    baseText: () => base,
    readDisk: () => disk,
    deserialize: carrierRecords,
    canonical: canonicalizeCarrierText,
    land: carrierLanding,
    saveBag: () => BAG,
    grants: (bag, p) => bag === BAG && p === path,
    audit: (row) => { audits.push(row); },
    alert: (a) => { alerts.push(a); },
    ...o.deps,
  });
  return { keeper, wiki, audits, alerts, took };
}

const raised = (alerts: readonly StandoffAlert[]) => alerts.filter((a): a is Extract<StandoffAlert, { bagId: string }> => a.clear !== true);

describe("the keeper lands nothing the ingest grade refuses", () => {
  test("an unterminated fence in the file's words loads no draft, deletes no record and waits for a person", async () => {
    const torn = BASE.replace("Device lifecycle hook:", "Device lifecycle hook:\n```\n");
    expect(carrierRecords(URI, torn), "the ingest grade refuses these words").toBeNull();
    const s = stand({ disk: torn, rules: ["slot-disjoint", "line-three-way", "whitespace-only"] });
    const before = new Map(s.wiki.rows);
    const outcome = await s.keeper.weigh({ bagId: BAG, uri: URI, standoff: KEY });
    expect(outcome.kind).toBe("awaiting");
    expect(s.wiki.writes, "nothing written").toBe(0);
    expect([...s.wiki.rows.keys()].sort()).toEqual([...before.keys()].sort());
    expect(s.audits).toEqual([]);
    expect(s.took).toEqual([]);
    expect(raised(s.alerts)).toHaveLength(1);
  });
});

describe("a native carrier collapses toward the records alone", () => {
  const TID = "lar:///ha.ka.ba/x/note";
  const TID_PATH = "/scratch/bags/lares/ha.ka.ba/x/note.tid";
  const tidRecords = `title: ${TID}\ntype: text/vnd.tiddlywiki\n\nhello\n`;
  const seed = [{ title: TID, type: "text/vnd.tiddlywiki", text: "hello" }];

  test("whitespace-only toward the disk writes no record field from a .tid's raw bytes, and waits", async () => {
    const s = stand({ uri: TID, path: TID_PATH, records: tidRecords, disk: `${tidRecords}\n\n\n`, base: null, rules: ["whitespace-only"], seed });
    const outcome = await s.keeper.weigh({ bagId: BAG, uri: TID, standoff: KEY });
    expect(outcome.kind).toBe("awaiting");
    expect(s.wiki.writes).toBe(0);
    expect(s.wiki.rows.get(TID)).toEqual(seed[0]);
    expect(s.audits).toEqual([]);
  });
});

describe("a landing stays inside the stand-off's own bag", () => {
  test("where a save of a target would land in another layer, the collapse waits and the drafts stay", async () => {
    const s = stand({ rules: ["slot-disjoint"], deps: { saveBag: () => "lar:///ha.ka.ba/wikis/notes/working" } });
    const records = new Map([...s.wiki.rows].filter(([t]) => !t.startsWith("Draft of")));
    const outcome = await s.keeper.weigh({ bagId: BAG, uri: URI, standoff: KEY });
    expect(outcome.kind).toBe("awaiting");
    if (outcome.kind === "awaiting") expect(outcome.why).toMatch(/working/);
    for (const [title, fields] of records) expect(s.wiki.rows.get(title), title).toEqual(fields);
    expect(s.keeper.draftsOf(URI).length, "the drafts stay").toBeGreaterThan(0);
    expect(s.audits).toEqual([]);
    expect(raised(s.alerts)[0]!.drafts.length).toBeGreaterThan(0);
  });

  test("CONTROL: the same stand-off whose saves land in its own bag collapses slot-disjoint", async () => {
    const s = stand({ rules: ["slot-disjoint"] });
    const outcome = await s.keeper.weigh({ bagId: BAG, uri: URI, standoff: KEY });
    expect(outcome).toMatchObject({ kind: "collapsed", rule: "slot-disjoint" });
    expect(String(s.wiki.rows.get(`${URI}#/head`)?.["text"])).toContain("the hand's midnight words");
  });

  test("a path the bag's grant does not reach lands nothing", async () => {
    const s = stand({ rules: ["slot-disjoint"], deps: { grants: () => false } });
    const outcome = await s.keeper.weigh({ bagId: BAG, uri: URI, standoff: KEY });
    expect(outcome.kind).toBe("awaiting");
    expect(s.audits).toEqual([]);
  });
});

describe("a person's drafts stay theirs", () => {
  test("a later stand-off never overwrites a kept draft of the same target", async () => {
    const oldKey = "ffffeeeeddddccccbbbbaaaa";
    const kept = { title: standoffDraftTitle(`${URI}#/head`, oldKey), "draft.of": `${URI}#/head`, "draft.title": `${URI}#/head`, text: "the words a person kept", [STANDOFF_FIELD]: oldKey, [STANDOFF_KEPT_FIELD]: "yes" };
    const s = stand({ seed: [...(carrierRecords(URI, RECORDS) ?? []), kept] });
    await s.keeper.weigh({ bagId: BAG, uri: URI, standoff: KEY });
    expect(s.wiki.rows.get(kept.title)).toEqual(kept);
    const fresh = s.keeper.draftsOf(URI).filter((d) => d.standoff === KEY).map((d) => d.title);
    expect(fresh).toContain(standoffDraftTitle(`${URI}#/head`, KEY));
    expect(fresh).not.toContain(kept.title);
  });

  test("a draft a hand edited stays as the hand left it when its stand-off weighs again", async () => {
    const s = stand();
    await s.keeper.weigh({ bagId: BAG, uri: URI, standoff: KEY });
    const title = standoffDraftTitle(`${URI}#/head`, KEY);
    const edited = { ...s.wiki.rows.get(title)!, text: "the hand's own edit of the draft" };
    s.wiki.rows.set(title, edited);
    await s.keeper.weigh({ bagId: BAG, uri: URI, standoff: KEY });
    expect(s.wiki.rows.get(title)).toEqual(edited);
  });
});

describe("the mount's sweep keeps a hand's words", () => {
  test("a draft a hand edited stays when the sweep finds its stand-off gone; an untouched draft leaves", async () => {
    const stands = { value: true };
    const s = stand({ stands, disk: sealed(DISK.replace("<<~ loulou uri=`lar:///ha.ka.ba/lares/api/pono/nalu`>>\n", "<<~ loulou uri=`lar:///ha.ka.ba/lares/api/pono/nalu`>>\n\nThe file's second words.\n")) });
    await s.keeper.weigh({ bagId: BAG, uri: URI, standoff: KEY });
    const drafts = s.keeper.draftsOf(URI).map((d) => d.title);
    expect(drafts.length, "two drafts load").toBe(2);
    const [edited, untouched] = drafts as [string, string];
    s.wiki.rows.set(edited, { ...s.wiki.rows.get(edited)!, text: "the hand's own edit of the draft" });
    stands.value = false;
    await s.keeper.sweep();
    expect(s.wiki.rows.get(edited)?.["text"], "the hand's edit stays").toBe("the hand's own edit of the draft");
    expect(s.wiki.rows.get(untouched), "the untouched draft leaves").toBeUndefined();
  });
});

describe("the alert stays truthful", () => {
  test("where the records' side cannot land after a collapse toward the records, the drafts stay and the alert names them", async () => {
    const s = stand({
      base: null, rules: ["canonical-equivalent"],
      deps: {
        // Both sides say one thing through the congruence, while the file's root field reads otherwise.
        canonical: () => "one canonical view",
        deserialize: (_u, text) => [{ title: URI, text: text === DISK ? "the file's words" : "the records' words" }],
        takeRecords: async () => ({ took: false, why: "the states moved" }),
      },
      seed: [{ title: URI, text: "the records' words" }],
    });
    const outcome = await s.keeper.weigh({ bagId: BAG, uri: URI, standoff: KEY });
    expect(outcome.kind).toBe("awaiting");
    const drafts = s.keeper.draftsOf(URI).map((d) => d.title);
    expect(drafts).toEqual([standoffDraftTitle(URI, KEY)]);
    expect(raised(s.alerts).at(-1)!.drafts).toEqual(drafts);
  });

  test("the alert offers keep-both only where drafts stand", () => {
    expect(standoffActions(URI, KEY, false).map((a) => a.action)).toEqual(["keep-disk", "keep-records"]);
    expect(standoffActions(URI, KEY, true).map((a) => a.action)).toEqual(["keep-disk", "keep-records", "keep-both", "open-drafts"]);
    const none = standoffAlertWords({ standoff: KEY, bagId: BAG, uri: URI, path: PATH, drafts: [], why: "no rule" });
    expect(none.reason).not.toContain("keep-both");
    expect(none.reason).toContain(`lares shore keep-disk ${URI} --key ${KEY}`);
    const some = standoffAlertWords({ standoff: KEY, bagId: BAG, uri: URI, path: PATH, drafts: ["Draft of 'x' by disk"], why: "no rule" });
    expect(some.reason).toContain(`lares shore keep-both ${URI} --key ${KEY}`);
  });
});
