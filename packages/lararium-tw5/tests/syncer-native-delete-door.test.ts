/**
 * THE NATIVE DELETE DOOR — driven through TW5's route contract with nothing beneath it but a Map.
 *
 * The stock syncer deletes ONE title (`tiddlywebadaptor.js` `deleteTiddler` → `DELETE
 * /bags/<bag>/tiddlers/<title>`), so a meme root deleted in a browser would leave its whole split
 * standing. This skin reads the standing record and sends a MEME ROOT through `removeMeme` — the one
 * removal law — while every other title reaches stock's handler untouched.
 *
 * The live measure of the same law rides `syncer-back-parity.e2e.test.ts` (c).
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as door from "../src/routes/native-delete-door.js";
import type { TiddlerFields } from "../src/deserializer.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

interface Reply { status: number; headers: Record<string, string>; body: string }

function wiki() {
  const store = new Map<string, TiddlerFields>();
  return {
    store,
    allTitles: () => [...store.keys()],
    getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t)! } : undefined),
    addTiddler: (f: TiddlerFields) => { store.set(String(f.title), f); },
    deleteTiddler: (t: string) => { store.delete(t); },
  };
}

/** What stock's handler would have been asked to do — the skin delegates rather than answering. */
let delegated: string[] = [];

beforeEach(() => {
  delegated = [];
  (globalThis as { $tw?: unknown }).$tw = {
    utils: { decodeURIComponentSafe: (s: string) => decodeURIComponent(s) },
    modules: {
      execute: (title: string) => ({
        handler: (_req: unknown, res: { writeHead(s: number, h: Record<string, string>): void; end(b?: string): void }, state: { params: readonly string[] }) => {
          delegated.push(`${title} ${state.params[0]}`);
          res.writeHead(204, { "Content-Type": "text/plain" });
          res.end();
        },
      }),
    },
  };
});

afterEach(() => { delete (globalThis as { $tw?: unknown }).$tw; });

/** Fire the handler the way TW5's server does and await its reply. */
function fire(w: ReturnType<typeof wiki>, title: string, ifMatch?: string): Promise<Reply> {
  return new Promise((resolve) => {
    const reply: Reply = { status: 0, headers: {}, body: "" };
    const response = {
      writeHead: (status: number, headers: Record<string, string>) => { reply.status = status; reply.headers = headers; },
      end: (body?: string) => { reply.body = body ?? ""; resolve(reply); },
    };
    const request = { headers: ifMatch ? { "if-match": ifMatch } : {} };
    const state = { wiki: w, params: [encodeURIComponent(title)] };
    door.handler(request as never, response as never, state as never);
  });
}

/** A root with two slot children and one `/path` child — the whole group the removal law names. */
function splitMeme(w: ReturnType<typeof wiki>): void {
  w.addTiddler({ title: "lar:///t/x", type: CARRIER_TYPE, text: "<<~ kahea ahu #/a>>\n\n<<~ kahea ahu #/b>>", "uri-path": "t/x" } as TiddlerFields);
  w.addTiddler({ title: "lar:///t/x#/a", type: CARRIER_TYPE, text: "! a", "$fragment-parent": "lar:///t/x", $slot: "#/a" } as unknown as TiddlerFields);
  w.addTiddler({ title: "lar:///t/x#/b", type: CARRIER_TYPE, text: "! b", "$fragment-parent": "lar:///t/x", $slot: "#/b" } as unknown as TiddlerFields);
  w.addTiddler({ title: "lar:///t/x/child", type: CARRIER_TYPE, text: "a child carrier", "uri-path": "t/x/child" } as TiddlerFields);
}

describe("★ DELETE /bags/default/tiddlers/:title — the group leaves together ★", () => {
  test("the skin stands on stock's own path, above stock's priority", () => {
    expect(door.methods).toEqual(["DELETE"]);
    expect(door.path.exec("/bags/default/tiddlers/lar%3A%2F%2F%2Ft%2Fx")?.[1]).toBe("lar%3A%2F%2F%2Ft%2Fx");
    expect(door.info.priority).toBeGreaterThan(100);
    // A recipe address is stock's 404 floor, not this skin's — the same posture `DELETE …/memes/…` keeps.
    expect(door.path.test("/recipes/default/tiddlers/lar%3A%2F%2F%2Ft%2Fx")).toBe(false);
  });

  test("a meme root's delete takes the root, its slot fragments and its `/path` children", async () => {
    const w = wiki();
    splitMeme(w);
    w.addTiddler({ title: "lar:///t/other", type: CARRIER_TYPE, text: "another meme", "uri-path": "t/other" } as TiddlerFields);
    const r = await fire(w, "lar:///t/x");
    expect(r.status).toBe(204);
    expect(delegated).toEqual([]);
    expect([...w.store.keys()]).toEqual(["lar:///t/other"]);
  });

  test("CONTROL: a plain tiddler reaches stock's handler and takes nothing else with it", async () => {
    const w = wiki();
    splitMeme(w);
    w.addTiddler({ title: "lar:///t/x-plain", text: "prose" } as TiddlerFields);
    const r = await fire(w, "lar:///t/x-plain");
    expect(r.status).toBe(204);
    expect(delegated).toEqual(["$:/core/modules/server/routes/delete-tiddler.js lar%3A%2F%2F%2Ft%2Fx-plain"]);
    // The skin removed nothing itself — stock's handler owns the act, and this Map never saw it run.
    expect([...w.store.keys()]).toContain("lar:///t/x-plain");
  });

  test("CONTROL: a slot child is no root — its delete reaches stock, and the group around it stands", async () => {
    const w = wiki();
    splitMeme(w);
    const r = await fire(w, "lar:///t/x#/a");
    expect(r.status).toBe(204);
    expect(delegated).toEqual(["$:/core/modules/server/routes/delete-tiddler.js lar%3A%2F%2F%2Ft%2Fx%23%2Fa"]);
    expect([...w.store.keys()].sort()).toEqual(["lar:///t/x", "lar:///t/x#/a", "lar:///t/x#/b", "lar:///t/x/child"]);
  });

  test("CONTROL: a title the wiki never held reaches stock — the skin reads a record, never a name", async () => {
    const w = wiki();
    const r = await fire(w, "lar:///t/absent");
    expect(r.status).toBe(204);
    expect(delegated).toEqual(["$:/core/modules/server/routes/delete-tiddler.js lar%3A%2F%2F%2Ft%2Fabsent"]);
  });

  test("a stale `If-Match` answers 412 and the group stands whole", async () => {
    const w = wiki();
    splitMeme(w);
    const r = await fire(w, "lar:///t/x", '"sha256:0000000000000000000000000000000000000000000000000000000000000000"');
    expect(r.status).toBe(412);
    expect(JSON.parse(r.body).decision).toBe("conflict");
    expect(r.headers["ETag"]).toMatch(/^"sha256:/);
    expect([...w.store.keys()].sort()).toEqual(["lar:///t/x", "lar:///t/x#/a", "lar:///t/x#/b", "lar:///t/x/child"]);
  });
});
