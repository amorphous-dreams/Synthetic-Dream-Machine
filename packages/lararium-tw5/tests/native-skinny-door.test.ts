/**
 * THE NATIVE SKINNY DOOR — a meme's group arrives whole, or a reader sees a hollow document.
 *
 * `getSkinnyTiddlers` fetches `GET /recipes/default/tiddlers.json` and the syncer walks the answer in
 * ONE synchronous stretch, which TiddlyWiki coalesces into ONE `change` dispatch; then
 * `LoadTiddlerTask` fattens the titles one at a time, chaining immediately (`syncer.js:654-696` ·
 * `:440`, and the throttle at `:480` gates SAVES only). So the window is N HTTP round trips where N is
 * the group's size, and through it a meme ROOT — whose whole text is `kahea` calls — stands fat over
 * children that hold no text: every section header with an empty body.
 *
 * Stock makes the answer skinny on one line: `(state.queryParameters.exclude || "text")`
 * (`core-server/server/routes/get-tiddlers-json.js:34`). This skin lets stock build the whole answer
 * under its own filter, its own `ExternalFilters` guard and its own system clause, and re-inflates the
 * SLOT CHILDREN on the way out. The root needs no fattening — by the time it arrives, its children
 * already hold their text.
 *
 * `$:/config/lares/memes/fat-children` (default `yes`) is the dial: `no` hands back stock's answer
 * untouched, for a shelf that has grown past the payload's comfort.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as door from "../src/routes/native-skinny-door.js";
import type { TiddlerFields } from "../src/deserializer.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

const ROOT = "lar:///t/a";

function wiki(dial?: string) {
  const store = new Map<string, TiddlerFields>();
  store.set(ROOT, { title: ROOT, type: CARRIER_TYPE, text: "<<~ kahea ahu #/p>>", "uri-path": "t/a" });
  store.set(`${ROOT}#/p`, { title: `${ROOT}#/p`, type: CARRIER_TYPE, text: "! p", "$fragment-parent": ROOT, "$slot": "#/p" });
  store.set("lar:///t/plain", { title: "lar:///t/plain", text: "prose" });
  if (dial !== undefined) store.set("$:/config/lares/memes/fat-children", { title: "$:/config/lares/memes/fat-children", text: dial });
  return {
    store,
    allTitles: () => [...store.keys()],
    getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t)! } : undefined),
    getTiddlerText: (t: string, d?: string) => (store.has(t) ? String(store.get(t)!["text"] ?? "") : d),
    addTiddler: (f: TiddlerFields) => { store.set(String(f.title), f); },
    deleteTiddler: (t: string) => { store.delete(t); },
  };
}

/** Every `exclude` stock was asked to honour — the skin must never re-derive stock's own reading. */
let stockSaw: Array<string | undefined> = [];

beforeEach(() => {
  stockSaw = [];
  (globalThis as { $tw?: unknown }).$tw = {
    modules: {
      execute: () => ({
        // Stock's own shape, reduced to the one line that matters: it strips the excluded fields and
        // answers through `state.sendResponse`.
        handler: (_req: unknown, _res: unknown, state: {
          wiki: ReturnType<typeof wiki>;
          queryParameters: Record<string, string | undefined>;
          sendResponse(s: number, h: Record<string, string>, b: string, e: string): void;
        }) => {
          const exclude = state.queryParameters["exclude"];
          stockSaw.push(exclude);
          const drop = (exclude ?? "text").split(",");
          const rows = state.wiki.allTitles().map((t) => {
            const out: Record<string, unknown> = { ...state.wiki.getTiddler(t)!.fields, revision: 1 };
            for (const f of drop) delete out[f];
            return out;
          });
          state.sendResponse(200, { "Content-Type": "application/json" }, JSON.stringify(rows), "utf8");
        },
      }),
    },
  };
});

afterEach(() => { delete (globalThis as { $tw?: unknown }).$tw; });

function fire(w: ReturnType<typeof wiki>, queryParameters: Record<string, string | undefined> = {}): Promise<Record<string, unknown>[]> {
  return new Promise((resolve) => {
    const state = {
      wiki: w, queryParameters,
      sendResponse: (_s: number, _h: Record<string, string>, body: string) => { resolve(JSON.parse(body) as Record<string, unknown>[]); },
    };
    door.handler({} as never, {} as never, state as never);
  });
}

const byTitle = (rows: Record<string, unknown>[], t: string) => rows.find((r) => r["title"] === t)!;

describe("★ the skinny answer carries a meme's SLOT CHILDREN fat ★", () => {
  test("the skin stands in front of stock's own path, above its priority", () => {
    expect(door.methods).toEqual(["GET"]);
    expect(door.info.priority).toBeGreaterThan(100);
    expect(door.path.test("/recipes/default/tiddlers.json")).toBe(true);
    expect(door.path.test("/recipes/default/tiddlers/lar%3A%2F%2F%2Ft%2Fa")).toBe(false);
  });

  test("★ a slot child arrives FAT, so the group lands in ONE batch and no render sees a hollow root ★", async () => {
    const rows = await fire(wiki());
    expect(byTitle(rows, `${ROOT}#/p`)["text"]).toBe("! p");
  });

  test("CONTROL · a plain tiddler still arrives SKINNY — the skinny sync keeps its reason for existing", async () => {
    const rows = await fire(wiki());
    expect(byTitle(rows, "lar:///t/plain")["text"]).toBeUndefined();
  });

  test("CONTROL · a meme ROOT still arrives SKINNY — only children fatten", async () => {
    const rows = await fire(wiki());
    expect(byTitle(rows, ROOT)["text"]).toBeUndefined();
  });

  test("CONTROL · stock's own `filter`/`exclude` reading is never re-derived, and an EXPLICIT exclude is honoured", async () => {
    const rows = await fire(wiki(), { exclude: "text,type" });
    expect(stockSaw).toEqual(["text,type"]);
    // A caller who ASKED for no text gets no text, child or not.
    expect(byTitle(rows, `${ROOT}#/p`)["text"]).toBeUndefined();
  });

  test("CONTROL · the dial `no` hands back stock's answer untouched; `yes` and an absent dial both fatten", async () => {
    expect(byTitle(await fire(wiki("no")), `${ROOT}#/p`)["text"]).toBeUndefined();
    expect(byTitle(await fire(wiki("yes")), `${ROOT}#/p`)["text"]).toBe("! p");
    expect(byTitle(await fire(wiki()), `${ROOT}#/p`)["text"]).toBe("! p");
  });

  test("CONTROL · a body stock did not answer as JSON passes through untouched", async () => {
    (globalThis as { $tw?: { modules: { execute(): { handler(r: unknown, s: unknown, st: { sendResponse(a: number, b: Record<string, string>, c: string, d: string): void }): void } } } }).$tw = {
      modules: { execute: () => ({ handler: (_r, _s, st) => { st.sendResponse(500, {}, "not json", "utf8"); } }) },
    };
    const body = await new Promise<string>((resolve) => {
      door.handler({} as never, {} as never, {
        wiki: wiki(), queryParameters: {},
        sendResponse: (_s: number, _h: Record<string, string>, b: string) => resolve(b),
      } as never);
    });
    expect(body).toBe("not json");
  });
});
