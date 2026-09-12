/**
 * THE TWO DOORS (b) — the client-side charm. A stock client saves through the tiddlyweb syncadaptor,
 * whose `saveTiddler` speaks `PUT /recipes/<recipe>/tiddlers/<title>` for every record. The charm
 * decorates the live adaptor instance at startup: a FRAMED MEME ROOT rides `PUT /recipes/<recipe>/
 * memes/<scheme>/<path>` (the door that splits it) and every other record rides the adaptor's own
 * save untouched. Driven here over a fake `$tw` — the adaptor's contract (`saveTiddler(tiddler,
 * callback, options)` · `$tw.utils.httpRequest`) is all the charm touches.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { startup, name, after } from "../src/modules/meme-door-charm.js";

const URI = "lar:///t/x";
const CARRIER = "text/memetic-wikitext+tiddlywiki";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

interface Request { url: string; type?: string; data?: unknown; headers?: Record<string, string>; callback: (err: unknown, data?: string, request?: unknown) => void }

function fakeTw(): { tw: Record<string, unknown>; requests: Request[]; native: unknown[] } {
  const requests: Request[] = [];
  const native: unknown[] = [];
  const adaptor = {
    name: "tiddlyweb",
    host: "http://host/",
    recipe: "default",
    isReadOnly: false,
    saveTiddler(tiddler: unknown, callback: (err: unknown, info?: unknown, rev?: unknown) => void) {
      native.push(tiddler);
      callback(null, { bag: "default" }, "7");
    },
  };
  const tw = {
    browser: {},
    syncadaptor: adaptor,
    utils: { httpRequest: (r: Request) => { requests.push(r); } },
  };
  return { tw, requests, native };
}

const tiddler = (fields: Record<string, unknown>) => ({ fields, getFieldString: (n: string) => String(fields[n] ?? "") });

describe("★ THE TWO DOORS (b): the charm routes a framed root to /memes/ ★", () => {
  let fake: ReturnType<typeof fakeTw>;
  beforeEach(() => {
    fake = fakeTw();
    (globalThis as Record<string, unknown>)["$tw"] = fake.tw;
    startup();
  });
  afterEach(() => { delete (globalThis as Record<string, unknown>)["$tw"]; });

  test("the module declares itself a startup module after `startup` (the adaptor instance exists by then)", () => {
    expect(name).toBe("lararium-meme-door-charm");
    expect(after).toContain("startup");
  });

  test("a framed root saves through PUT /recipes/default/memes/lar/t/x with the text as the body; the callback carries the ETag as the revision", async () => {
    const adaptor = fake.tw["syncadaptor"] as { saveTiddler(t: unknown, cb: (e: unknown, i?: unknown, r?: unknown) => void, o?: unknown): void };
    const done = new Promise<[unknown, unknown, unknown]>((res) => {
      adaptor.saveTiddler(tiddler({ title: URI, type: CARRIER, text: meme(["a"]) }), (e, i, r) => res([e, i, r]));
    });
    expect(fake.requests).toHaveLength(1);
    const r = fake.requests[0]!;
    expect(r.url).toBe("http://host/recipes/default/memes/lar/t/x");
    expect(r.type).toBe("PUT");
    expect(r.data).toBe(meme(["a"]));
    expect(fake.native).toHaveLength(0);
    r.callback(null, JSON.stringify({ decision: "ingest" }), { getResponseHeader: (h: string) => (h.toLowerCase() === "etag" ? '"sha256:abc"' : null) });
    const [err, info, rev] = await done;
    expect(err).toBeNull();
    expect(info).toEqual({ bag: "default" });
    expect(rev).toBe("sha256:abc");
  });

  test("CONTROL: a plain tiddler and a split root ride the adaptor's own save; a read-only adaptor saves nothing", () => {
    const adaptor = fake.tw["syncadaptor"] as { saveTiddler(t: unknown, cb: (e: unknown, i?: unknown, r?: unknown) => void, o?: unknown): void; isReadOnly: boolean };
    adaptor.saveTiddler(tiddler({ title: "plain", text: "prose" }), () => {});
    adaptor.saveTiddler(tiddler({ title: URI, type: CARRIER, text: "<<~ kahea ahu #/a>>" }), () => {});
    expect(fake.native).toHaveLength(2);
    expect(fake.requests).toHaveLength(0);
    adaptor.isReadOnly = true;
    let called: unknown[] = ["unset"];
    adaptor.saveTiddler(tiddler({ title: URI, type: CARRIER, text: meme(["a"]) }), (...args) => { called = args; });
    expect(fake.requests).toHaveLength(0);
    expect(called).toEqual([null]);
  });

  test("CONTROL: a `$tw` with no tiddlyweb adaptor (a node server, an island) leaves nothing decorated", () => {
    const bare = { browser: {}, utils: { httpRequest: () => {} } } as Record<string, unknown>;
    (globalThis as Record<string, unknown>)["$tw"] = bare;
    expect(() => startup()).not.toThrow();
    expect(bare["syncadaptor"]).toBeUndefined();
  });
});
