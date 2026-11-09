/**
 * projection-filter-engine — the projection filters read alike in TiddlyWiki's own engine and the house's evaluator.
 *
 *   P1  the plugin ships each filter as its `$:/config/` shadow, its text the one source (`PROJECTION_FILTER_TEXT`);
 *   P2  TiddlyWiki's `wiki.filterTiddlers` (with the plugin's `[lar-path[]]`) and `filterSelects` give one verdict per title;
 *   P3  the island INGEST guard reads the filter as the wiki holds it: an override that adds a family into the daemon
 *       filter refuses a carrier the shipped filter lets land.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, PROJECTION_FILTER, PROJECTION_FILTER_TEXT, projectionFilterTitle, filterSelects, isEffectRecordUri,
  type CapabilityAccess, type CapabilityVerifyResult, type ProjectionClass, type Verb, type VerbContext } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { registerActionReactors, makeTw5Deserializer } from "../src/action-handler.js";
import { VerbTable } from "../src/verb-dispatcher.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const TITLES = [
  "lar:///ha.ka.ba/bags/daemon/outcomes/o1", "lar:///ha.ka.ba/kahua/../bags/daemon/f", "lar:///ha.ka.ba/bags/%64aemon/x", "$:/lares/swarm/../x",
  "lar:///ha.ka.ba/bags/persona/group-secret/a", "lar:///ha.ka.ba/dreamnet/dyad/d", "lar:///lararium.local.vm/v", "lar:///ha.ka.ba/bags/g/ledger/residency/e",
  "lar:///ha.ka.ba/bags/garden", "lar:///ha.ka.ba/bags/garden/rose", "lar:///ha.ka.ba/dreamnet/realm-bag-announce/r", "lar:///ha.ka.ba/bags/nexus/n/handles",
  "$:/temp/x", "$:/StoryList", "lar:///ha.ka.ba/lararium/config/x", "lar:///ha.ka.ba/kahua/memory/heron", "A Plain Note",
];
const CLASSES: Array<"base" | ProjectionClass> = ["base", "daemon", "temp", "nexus-handles"];
const titleOf = (c: "base" | ProjectionClass) => (c === "base" ? PROJECTION_FILTER : projectionFilterTitle(c));

describe.skipIf(wikiSkip)(`the projection filters in TiddlyWiki's engine${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); }, 60_000);
  const wiki = () => engine.$tw.wiki as unknown as { getTiddlerText(t: string): string | undefined; filterTiddlers(f: string, w?: unknown, s?: unknown): string[]; getTiddler(t: string): unknown };

  test("P1 — the plugin ships each filter as its shadow, text for text", () => {
    for (const c of CLASSES) expect(wiki().getTiddlerText(titleOf(c))?.trim(), c).toBe(PROJECTION_FILTER_TEXT[c]);
  });

  test("P2 — TiddlyWiki's engine and the house's evaluator give one verdict per title and filter", () => {
    for (const c of CLASSES) {
      const text = PROJECTION_FILTER_TEXT[c];
      for (const t of TITLES) {
        const source = (fn: (tiddler: unknown, title: string) => void) => fn(wiki().getTiddler(t), t);
        const engineSays = wiki().filterTiddlers(text, undefined, source);
        expect(engineSays.some((r) => r.startsWith("Filter error")), `${c} ${t}: ${engineSays.join(",")}`).toBe(false);
        expect(engineSays.length > 0, `${c} ${t}`).toBe(filterSelects(text, t));
      }
    }
  });

  test("P3 — the island INGEST guard reads the daemon filter as the wiki holds it", async () => {
    const MEMORY = "lar:///ha.ka.ba/kahua/memory/heron";
    const base = makeTw5Deserializer(engine);
    const overridden = { ...base, configText: (t: string) => (t === projectionFilterTitle("daemon") ? `${PROJECTION_FILTER_TEXT.daemon}\n[prefix[lar:///ha.ka.ba/kahua/memory/]]` : base.configText!(t)) };
    const run = async (tw5: typeof base) => {
      const composite = new CompositeStore();
      const store = new MemoryTiddlerStore(DAEMON_BAG_ID);
      composite.addLayer({ bagId: DAEMON_BAG_ID, store, writable: true });
      const table = new VerbTable();
      registerActionReactors(table, { composite, tw5 });
      const text = `title: ${MEMORY}\ntype: text/vnd.tiddlywiki\n\nwords\n`;
      const args = { "source-uri": "file:///s", "to-bag": DAEMON_BAG_ID, "change-id": "c", carriers: [{ uri: MEMORY, file: "/s/m.tid", text, diskHash: carrierHash(text), syncedHash: null, ext: ".tid" }] };
      const allow = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
      const ctx: VerbContext = { daemon: composite, cap: allow, invocation: { requestId: "r", title: "lar:///lararium.local.vm/verbs/r", action: "INGEST", args, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "t", requestedAt: "2026-11-08T00:00:00Z" } as Verb };
      const rows = (await table.get("INGEST")!(args, ctx) as Record<string, unknown>)["carriers"] as Array<Record<string, unknown>>;
      return { row: rows[0]!, held: (await store.listVisible()).filter((t) => !isEffectRecordUri(t)) };
    };
    expect((await run(base)).row["decision"]).toBe("ingest");
    const refused = await run(overridden);
    expect(refused.row["code"]).toBe("daemon-withheld-title");
    expect(refused.held).toEqual([]);
  });
});
