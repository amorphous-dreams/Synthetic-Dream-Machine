/**
 * ONE ALERT PER STAND-OFF (operator ruling, 2026-11-23): through the island's own mount (`mountDiskProjection`), a memetic
 * carrier's stand-off loads its drafts, and its ONE awaiting alert rides the ward rail, which raises it where the daemon
 * face reads its alerts and files the audit row. Nothing lands in the wiki's own temp layer for it.
 *
 * At mount the keeper sweeps the drafts of stand-offs that stand no longer, save those a person kept. The person's rules
 * read from the daemon face's own working layer alone: a rule that stands only in the composed wiki enables nothing.
 *
 * The stand-off here stands with no base: the file says one thing and the records another, and nothing names which moved
 * last (`no-base`), so the island's first pass meets it at once.
 */
import { grammarPins, vendoredCore } from "../../lararium-tw5/tests/test-wiki.js";
import { describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CompositeStore, bagUri, wikiSlotUri } from "@lararium/mesh";
import { carrierRecords } from "@lararium/tw5/carrier-canonical";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { TW5Engine } from "../../lararium-tw5/src/tw5-vm.js";
import LARES_MEMETIC_WIKITEXT_PLUGIN from "../../lararium-tw5/plugins/lares-memetic-wikitext.json" with { type: "json" };
import { mountDiskProjection, mountedDiskProjector } from "../src/island-behaviors.js";
import { collapseRuleTitle } from "../src/standoff-collapse.js";
import { STANDOFF_FIELD, STANDOFF_KEPT_FIELD, STANDOFF_LOADED_FIELD, standoffDraftTitle, standoffLoadedDigest } from "../src/standoff-drafts.js";
import { coreBlobSkip } from "./shore-rig.js";

const SLUG = "notes";
const BAG = bagUri("lares");
const TEMP = wikiSlotUri(SLUG, "temp");
const DAEMON_WORKING = wikiSlotUri("daemon", "working");
const URI = "lar:///ha.ka.ba/lares/api/pono/tick";
const ORIGIN = { kind: "operator-import" as const, sessionId: "test" };

type Wiki = { Tiddler: new (...f: Array<Record<string, unknown>>) => unknown; wiki: { addTiddler(t: unknown): void; getTiddler(t: string): { fields: Record<string, unknown> } | undefined } };

/** One island over a scratch mirror whose file moved past the records; `before` writes the wiki and stores ahead of the mount. */
async function island(before: (s: { $tw: Wiki; working: MemoryTiddlerStore }) => Promise<void> = async () => {}) {
  const scratch = mkdtempSync(join(tmpdir(), "standoff-one-alert-"));
  const mirrorRoot = join(scratch, "bags", "lares");
  const file = join(mirrorRoot, "ha.ka.ba/lares/api/pono/tick.mem");
  const words = readFileSync(new URL("./fixtures/standoff-tick.mem", import.meta.url), "utf8");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, words.replace("Device lifecycle hook:", "Device lifecycle hook (the operator's own words):"));

  const store = new MemoryTiddlerStore(BAG);
  const temp = new MemoryTiddlerStore(TEMP);
  const working = new MemoryTiddlerStore(DAEMON_WORKING);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: BAG, store, writable: true });
  composite.addLayer({ bagId: DAEMON_WORKING, store: working, writable: true });
  composite.addLayer({ bagId: TEMP, store: temp, writable: true });
  const engine = new TW5Engine();
  await engine.boot(vendoredCore(), [LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>], undefined, { modulePins: grammarPins() });
  const $tw = engine.$tw as unknown as Wiki;
  for (const fields of carrierRecords(URI, words)!) {
    await store.put({ tiddler: fields as never }, ORIGIN);
    $tw.wiki.addTiddler(new $tw.Tiddler(fields as Record<string, unknown>, { "$origin-bag": BAG }));
  }
  await before({ $tw, working });

  const posted: Array<Record<string, unknown>> = [];
  const stop = mountDiskProjection({ recipe: { wikiSlug: SLUG }, diskMirrors: [{ bagId: BAG, mirrorRoot, scope: "lares" }] } as never,
    { tw5: engine, composite, post: (m: { payload?: Record<string, unknown> }) => { if (m.payload) posted.push(m.payload); }, wikiUri: "test" } as never,
    { rulesFromOwnWiki: true })!;
  const projector = mountedDiskProjector()!;
  await projector.idle();
  const key = projector.standing().find((s) => s.uri === URI)?.standoff;
  const rail = () => posted.filter((p) => p["verb"] === "ward-alert" && p["wardKind"] === "projection-conflict" && p["resolved"] !== true);
  // The keeper's weighing runs past the projector's idle: settle on the rail hearing it.
  for (let i = 0; i < 2000 && rail().length === 0; i++) await new Promise((r) => setImmediate(r));
  return {
    $tw, temp, posted, rail, key: key!, file,
    async close() { await stop(); rmSync(scratch, { recursive: true, force: true }); },
  };
}

describe.skipIf(coreBlobSkip)("one alert per stand-off, through the island's mount", () => {
  test("a memetic carrier's stand-off raises ONE alert on the ward rail, naming the drafts and the commands; the temp layer holds none", async () => {
    const s = await island();
    try {
      expect(s.key, "the stand-off entered").toBeDefined();
      const head = standoffDraftTitle(`${URI}#/head`, s.key);
      expect(s.$tw.wiki.getTiddler(head)?.fields["draft.of"]).toBe(`${URI}#/head`);
      const rail = s.rail();
      expect(rail, "the rail hears the stand-off once").toHaveLength(1);
      expect(rail[0]!["auditOnly"], "the rail's alert stands live").toBeUndefined();
      expect(rail[0]!["standoff"]).toBe(s.key);
      expect(String(rail[0]!["drafts"])).toContain(head);
      expect(String(rail[0]!["reason"])).toContain(`lares shore keep-both ${URI} --key ${s.key}`);
      expect(String(rail[0]!["reason"])).toContain(`lares shore keep-disk ${URI} --key ${s.key}`);
      expect(JSON.stringify(rail[0])).not.toContain("the operator's own words");
      expect((await s.temp.listVisible()).filter((t) => t.startsWith("$:/temp/lares/alert/")), "nothing in the wiki's own temp layer").toEqual([]);
      expect(readFileSync(s.file, "utf8"), "the operator's words stand on disk").toContain("the operator's own words");
    } finally { await s.close(); }
  });

  test("at mount the keeper sweeps the drafts of a stand-off that stands no longer, and keeps the one a person kept", async () => {
    const gone = "0123456789abcdef01234567";
    // The keeper's own draft of a stand-off gone: its words read as loaded (the digest it stamped at load).
    const loaded = { title: standoffDraftTitle(`${URI}#/edges`, gone), "draft.of": `${URI}#/edges`, "draft.title": `${URI}#/edges`, text: "stale", [STANDOFF_FIELD]: gone };
    const stale = { ...loaded, [STANDOFF_LOADED_FIELD]: standoffLoadedDigest(loaded) };
    const kept = { ...stale, title: standoffDraftTitle(URI, gone), "draft.of": URI, "draft.title": URI, [STANDOFF_KEPT_FIELD]: "yes" };
    const s = await island(async ({ $tw }) => {
      $tw.wiki.addTiddler(new $tw.Tiddler(stale));
      $tw.wiki.addTiddler(new $tw.Tiddler(kept));
    });
    try {
      for (let i = 0; i < 2000 && s.$tw.wiki.getTiddler(stale.title) !== undefined; i++) await new Promise((r) => setImmediate(r));
      expect(s.$tw.wiki.getTiddler(stale.title), "the stale draft left").toBeUndefined();
      expect(s.$tw.wiki.getTiddler(kept.title)?.fields["text"], "the kept draft stays").toBe("stale");
    } finally { await s.close(); }
  });

  test("the person's rules read from the daemon face's working layer alone: a rule standing only in the composed wiki enables nothing", async () => {
    const rule = { title: collapseRuleTitle("whitespace-only"), bags: BAG };
    const composed = await island(async ({ $tw }) => { $tw.wiki.addTiddler(new $tw.Tiddler(rule)); });
    try {
      expect(String(composed.rail()[0]!["reason"])).toContain("no collapse rule stands enabled");
    } finally { await composed.close(); }
    const own = await island(async ({ working }) => { await working.put({ tiddler: rule as never }, ORIGIN); });
    try {
      expect(String(own.rail()[0]!["reason"]), "the working layer's rule ran its reading").toContain("whitespace-only:");
    } finally { await own.close(); }
  });
});
