/**
 * ONE ALERT PER STAND-OFF (operator ruling, 2026-11-23): through the island's own mount (`mountDiskProjection`), a memetic
 * carrier's stand-off loads its drafts and raises the keeper's awaiting alert in the wiki's temp layer, and the ward rail
 * files its audit row with no live alert of its own. The keeper's alert supersedes the rail's.
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
import { standoffAlertTitle, standoffDraftTitle } from "../src/standoff-drafts.js";
import { coreBlobSkip } from "./shore-rig.js";

const REPO = new URL("../../..", import.meta.url).pathname;
const SLUG = "notes";
const BAG = bagUri("lares");
const TEMP = wikiSlotUri(SLUG, "temp");
const URI = "lar:///ha.ka.ba/lares/api/pono/tick";
const ORIGIN = { kind: "operator-import" as const, sessionId: "test" };

describe.skipIf(coreBlobSkip)("one alert per stand-off, through the island's mount", () => {
  test("a memetic carrier's stand-off raises the keeper's alert; the rail files its row and raises none", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "standoff-one-alert-"));
    const mirrorRoot = join(scratch, "bags", "lares");
    const file = join(mirrorRoot, "ha.ka.ba/lares/api/pono/tick.mem");
    const words = readFileSync(`${REPO}bags/lares/ha.ka.ba/lares/api/pono/tick.mem`, "utf8");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, words.replace("Device lifecycle hook:", "Device lifecycle hook (the operator's own words):"));

    const store = new MemoryTiddlerStore(BAG);
    const temp = new MemoryTiddlerStore(TEMP);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: BAG, store, writable: true });
    composite.addLayer({ bagId: TEMP, store: temp, writable: true });
    const engine = new TW5Engine();
    await engine.boot(vendoredCore(), [LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>], undefined, { modulePins: grammarPins() });
    const $tw = engine.$tw as unknown as { Tiddler: new (...f: Array<Record<string, unknown>>) => unknown; wiki: { addTiddler(t: unknown): void; getTiddler(t: string): { fields: Record<string, unknown> } | undefined } };
    for (const fields of carrierRecords(URI, words)!) {
      await store.put({ tiddler: fields as never }, ORIGIN);
      $tw.wiki.addTiddler(new $tw.Tiddler(fields as Record<string, unknown>, { "$origin-bag": BAG }));
    }

    const posted: Array<Record<string, unknown>> = [];
    const stop = mountDiskProjection({ recipe: { wikiSlug: SLUG }, diskMirrors: [{ bagId: BAG, mirrorRoot, scope: "lares" }] } as never,
      { tw5: engine, composite, post: (m: { payload?: Record<string, unknown> }) => { if (m.payload) posted.push(m.payload); }, wikiUri: "test" } as never)!;
    try {
      const projector = mountedDiskProjector()!;
      await projector.idle();
      const key = projector.standing().find((s) => s.uri === URI)?.standoff;
      expect(key, "the stand-off entered").toBeDefined();
      // The keeper's weighing runs past the projector's idle: settle on its own alert landing.
      for (let i = 0; i < 1000 && temp.readNow(standoffAlertTitle(key!)).record === null; i++) await new Promise((r) => setImmediate(r));

      const alert = temp.readNow(standoffAlertTitle(key!)).record?.tiddler as Record<string, unknown> | undefined;
      expect(alert, "the keeper's alert stands in the wiki's temp layer").toBeDefined();
      expect(alert!["carrier"]).toBe(URI);
      expect(String(alert!["drafts"])).toContain(standoffDraftTitle(`${URI}#/head`));
      expect(JSON.stringify(alert)).not.toContain("the operator's own words");
      expect($tw.wiki.getTiddler(standoffDraftTitle(`${URI}#/head`))?.fields["draft.of"]).toBe(`${URI}#/head`);

      const rail = posted.filter((p) => p["verb"] === "ward-alert" && p["wardKind"] === "projection-conflict" && p["resolved"] !== true);
      expect(rail, "the rail hears the stand-off once").toHaveLength(1);
      expect(rail[0]!["auditOnly"], "the rail files its row and raises no alert of its own").toBe(true);
      expect(readFileSync(file, "utf8"), "the operator's words stand on disk").toContain("the operator's own words");
    } finally {
      await stop();
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
