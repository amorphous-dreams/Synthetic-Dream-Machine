/**
 * THE TWO DOORS (c) — the backstop. Whatever door a FRAMED MEME ROOT enters a server wiki by, the
 * placement law runs over it once it stands: a `change` listener finds a record still carrying its
 * SOH head under the carrier type, runs `placeMeme` over it, and logs one line naming the door as
 * far as the wiki can see it. A root that entered through `/memes/` stands split already and the
 * listener leaves it (CONTROL). Driven over a fake `$tw` whose wiki fires `change` on every write.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { startup, name, after } from "../src/modules/meme-backstop.js";
import { placeMeme, wikiMemeSink } from "../src/place-meme.js";
import type { TiddlerFields } from "../src/deserializer.js";

const URI = "lar:///t/x";
const CARRIER = "text/memetic-wikitext+tiddlywiki";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

type Changes = Record<string, { modified?: boolean; deleted?: boolean }>;

/** The smallest wiki with a change bus: every write and delete dispatches `change` on a microtask. */
function fakeWiki() {
  const store = new Map<string, TiddlerFields>();
  const listeners: Array<(c: Changes) => void> = [];
  let pending: Changes = {};
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const changes = pending;
    pending = {};
    for (const l of listeners) l(changes);
  };
  const enqueue = (title: string, deleted: boolean) => {
    pending[title] = deleted ? { deleted: true } : { modified: true };
    if (!scheduled) { scheduled = true; queueMicrotask(flush); }
  };
  return {
    store,
    allTitles: () => [...store.keys()],
    getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t)! } : undefined),
    addTiddler: (f: TiddlerFields) => { store.set(String(f.title), f); enqueue(String(f.title), false); },
    deleteTiddler: (t: string) => { store.delete(t); enqueue(t, true); },
    addEventListener: (type: string, l: (c: Changes) => void) => { if (type === "change") listeners.push(l); },
  };
}

const settle = () => new Promise((res) => setTimeout(res, 20));

describe("★ THE TWO DOORS (c): the backstop re-stamps a framed root that landed unstamped ★", () => {
  let wiki: ReturnType<typeof fakeWiki>;
  const lines: string[] = [];
  beforeEach(() => {
    wiki = fakeWiki();
    lines.length = 0;
    (globalThis as Record<string, unknown>)["$tw"] = { node: true, wiki, boot: { files: {} } };
    startup({ log: (line: string) => { lines.push(line); } });
  });
  afterEach(() => { delete (globalThis as Record<string, unknown>)["$tw"]; });

  test("the module declares itself a node startup module after `startup`", () => {
    expect(name).toBe("lararium-meme-backstop");
    expect(after).toContain("startup");
  });

  test("a framed root landed straight into the store re-stamps into its records, and ONE line logs it", async () => {
    wiki.addTiddler({ title: URI, type: CARRIER, text: meme(["a", "b"]) });
    await settle();
    expect([...wiki.store.keys()].sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
    expect(wiki.store.get(URI)?.["text"]).toBe("<<~ kahea ahu #/a>>\n\n<<~ kahea ahu #/b>>");
    expect(lines).toEqual([`[memetic-wikitext] re-stamped ${URI} (landed via a native write)`]);
  });

  test("CONTROL: a root landed through /memes/ (placeMeme) triggers no re-stamp; a plain tiddler and a slot child trigger nothing", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    wiki.addTiddler({ title: "plain", text: "prose" });
    wiki.addTiddler({ title: "lar:///t/y#/a", type: CARRIER, text: "! a" });
    await settle();
    expect(lines).toEqual([]);
    expect([...wiki.store.keys()].sort()).toEqual([URI, `${URI}#/a`, "lar:///t/y#/a", "plain"]);
  });

  test("a root the gate REFUSES (error-graded) stays as it landed, and the line names the refusal", async () => {
    const stranded = meme(["a"]).replace("<<^ code=\"&#x0003;\">>\n", "<<^ code=\"&#x0003;\">>\n<<~ ahu #edges>>\n\n* x\n\n<<~/ahu>>\n");
    wiki.addTiddler({ title: URI, type: CARRIER, text: stranded });
    await settle();
    expect([...wiki.store.keys()]).toEqual([URI]);
    expect(wiki.store.get(URI)?.["text"]).toBe(stranded);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[memetic-wikitext\] refused to re-stamp lar:\/\/\/t\/x \(landed via a native write\): /);
  });
});
