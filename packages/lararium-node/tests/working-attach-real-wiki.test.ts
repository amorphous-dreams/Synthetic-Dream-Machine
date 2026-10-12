/**
 * working-attach-real-wiki — the daemon's real working-layer attach routes a real wiki's saves.
 *
 * The real `operatorDaemonOptions` boot runs over a founded face and a real TW5 wiki built by the real
 * island recipe. Before the attach the write-layer pointer reads empty; after it the wiki reads the working
 * slot, and a hand save lands in the working document and not in the daemon bag. Nothing replaces the
 * wiki's reader.
 */
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { CompositeStore, wikiBagUri, wikiSlotUri, type LarDoc } from "@lararium/mesh";
import { TW5Engine } from "../../lararium-tw5/src/tw5-vm.js";
import { bridgeWikiToAdaptor } from "../../lararium-tw5/src/outbound-bridge.js";
import { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } from "../../lararium-tw5/src/generated-tw5-version.js";
import { buildIslandRecipe, seedDrained } from "../../lararium-tw5/src/island-recipe.js";
import LARES_MEMETIC_WIKITEXT_PLUGIN from "../../lararium-tw5/plugins/lares-memetic-wikitext.json" with { type: "json" };
import { standFoundedIsland } from "./stand-founded-island.js";

const POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const CORE = join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
const teardown: Array<() => void> = [];
let engine: TW5Engine;

beforeAll(async () => {
  engine = new TW5Engine();
  await engine.boot(new Uint8Array(readFileSync(CORE)), [LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>]);
}, 60_000);
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });

describe("the real attach points a real wiki's saves at the working document", () => {
  test("before the attach the pointer reads empty; after it saves land in the working document", async () => {
    const composite = new CompositeStore();
    const st = await standFoundedIsland(teardown, { composite, tw5: engine });
    const { adaptor } = buildIslandRecipe({ tw5: engine, composite, recipe: { wikiSlug: "daemon" }, ready: [{ slot: wikiBagUri("daemon"), handle: st.daemonHandle }] });
    teardown.push(bridgeWikiToAdaptor(engine, adaptor));
    await seedDrained(engine);
    const wiki = engine.$tw.wiki as unknown as {
      getTiddlerText(t: string, d?: string): string; addEventListener(t: string, l: (c: Record<string, unknown>) => void): void;
      removeEventListener(t: string, l: (c: Record<string, unknown>) => void): void; addTiddler(t: unknown): void;
    };
    expect(wiki.getTiddlerText(POINTER, ""), "the pointer named a layer before the attach").toBe("");
    expect(composite.defaultWritableBagId()).toBeNull();

    const working = wikiSlotUri("daemon", "working");
    const pointerLands = new Promise<void>((resolve) => {
      const onChange = (changes: Record<string, unknown>): void => {
        if (POINTER in changes && wiki.getTiddlerText(POINTER, "") === working) { wiki.removeEventListener("change", onChange); resolve(); }
      };
      wiki.addEventListener("change", onChange);
    });
    const kh = await operatorDaemonOptions({ daemonAuth: st.daemonAuth } as never).verifierFactory!(st.ctx);
    teardown.push(() => { void (kh as { dispose?: () => Promise<void> }).dispose?.(); });
    await pointerLands;
    expect(composite.defaultWritableBagId()).toBe(working);

    const title = "lar:///ha.ka.ba/t/daemon/hand-save";
    const Tiddler = (engine.$tw as unknown as { Tiddler: new (f: unknown) => unknown }).Tiddler;
    wiki.addTiddler(new Tiddler({ title, text: "typed after the attach" }));
    // A barrier tiddler's change reaches the bridge after the hand save's; stopping the adaptor then drains every owed hand.
    await new Promise<void>((resolve) => {
      const onChange = (changes: Record<string, unknown>): void => {
        if ("$:/test/barrier" in changes) { wiki.removeEventListener("change", onChange); resolve(); }
      };
      wiki.addEventListener("change", onChange);
      wiki.addTiddler(new Tiddler({ title: "$:/test/barrier", text: "barrier" }));
    });
    await adaptor.stop();
    const workingHandle = (st.ctx as unknown as { handles: Map<string, { doc(): LarDoc }> }).handles.get(working)!;
    expect(workingHandle.doc().tiddlers[title], "the save missed the working document").toBeDefined();
    expect(st.daemonHandle.doc()?.tiddlers[title], "the save fell into the daemon bag").toBeUndefined();
  }, 60_000);
});
