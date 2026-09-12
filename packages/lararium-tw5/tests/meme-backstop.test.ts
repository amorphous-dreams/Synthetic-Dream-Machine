/**
 * THE TWO DOORS (c) — the backstop. Whatever door a FRAMED MEME ROOT enters a server wiki by, the
 * placement law runs over it once it stands: a `change` listener finds a record still carrying its
 * SOH head under the carrier type, runs `placeMeme` over it, and logs one line naming the door as
 * far as the wiki can see it. A root that entered through `/memes/` stands split already and the
 * listener leaves it (CONTROL). Driven over a fake `$tw` whose wiki fires `change` on every write.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { startup, name, after } from "../src/modules/meme-backstop.js";
import { placeMeme, readMeme, wikiMemeSink } from "../src/place-meme.js";
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

/**
 * PHASE 5 · THE LEAN COLLIDED — a root re-placed from its own records grades NOTHING.
 *
 * The syncer-seams roundtable planned to close the ungated child (seam (b)) by widening this listener:
 * a slot child that moved re-places its ROOT, and the whole carrier grades as one. The mechanism the
 * plan named is `placeMeme(root, readMeme(root))`, and it cannot work — not for some inputs, for ANY.
 *
 * `readMeme` IS `render(records)`. Handing it back to `placeMeme` computes `render(parse(render(r)))`
 * and compares it to `render(r)` — the canonical form's own fixed point, reached by construction. The
 * Confluence gate's equivalence reading therefore answers NOOP whatever the child holds, and the
 * gradient gate above it sees only bytes the renderer just produced, so it grades `clean` with zero
 * diagnostics. A tautology cannot report a fault.
 *
 * MEASURED over seven child edits, each re-placed through its root: a clean edit, a stray ETX, a
 * nested `ahu` block, a whole pasted carrier frame, an unclosed `ahu`, a stray closer, and a malformed
 * meta fence. Seven of seven: `decision=noop`, `grade=clean`, `0 diagnostics`, `0 records landed`,
 * the record set unmoved.
 *
 * So seam (b) stands open and its cure is not this one. A child's save can only be graded against the
 * CHILD'S OWN AUTHORED TEXT — the bytes that never passed through the renderer — and this package has
 * no congruence that reads a fragment body as a gradeable unit. That is the operator's call, not this
 * hand's, and the probe below is the measurement it should be made against.
 */
describe("★ PHASE 5 REFUTED: re-placing a root from its records is a fixed point, so it grades nothing ★", () => {
  const sinkOf = (store: Map<string, TiddlerFields>) => ({
    allTitles: () => [...store.keys()],
    getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t)! } : undefined),
    addTiddler: (f: TiddlerFields) => { store.set(String(f.title), f); },
    deleteTiddler: (t: string) => { store.delete(t); },
  });

  /** Every shape a child's text can take that the widening was meant to catch. */
  const CHILD_EDITS: Record<string, string> = {
    "a clean edit":            "! a EDITED",
    "a stray ETX mark":        `! a\n\n<<^ code="&#x0003;">>\n\nstranded\n`,
    "a nested ahu block":      "! a\n\n<<~ ahu #/z>>\n\n! z\n\n<<~/ahu>>\n",
    "a whole pasted frame":    meme(["z"]),
    "an unclosed ahu":         "! a\n\n<<~ ahu #/z>>\n\nno closer\n",
    "a stray block closer":    "! a\n\n<<~/ahu>>\n\nafter\n",
    "a malformed meta fence":  "! a\n\n```toml meta\nbogus = [\n```\n",
  };

  for (const [what, text] of Object.entries(CHILD_EDITS)) {
    test(`the re-place reads NOOP over ${what} — nothing grades, nothing lands`, async () => {
      const store = new Map<string, TiddlerFields>();
      const sink = wikiMemeSink(sinkOf(store) as never);
      await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
      const before = [...store.keys()].sort();
      store.set(`${URI}#/a`, { ...store.get(`${URI}#/a`)!, text });

      const render = await readMeme(URI, sink);
      const receipt = await placeMeme({ uri: URI, text: render!.text }, sink);

      expect(receipt.decision).toBe("noop");
      expect(receipt.grade).toBe("clean");
      expect(receipt.diagnostics).toEqual([]);
      expect(receipt.landed).toEqual([]);
      expect([...store.keys()].sort()).toEqual(before);
      // And the author's bytes stand exactly as written — the one thing the plan got right.
      expect(String(store.get(`${URI}#/a`)!["text"])).toBe(text);
    });
  }

  test("CONTROL · the SAME gate refuses that text at the ROOT's own door, so the gate works and the INPUT is the lie", async () => {
    const store = new Map<string, TiddlerFields>();
    const sink = wikiMemeSink(sinkOf(store) as never);
    const stranded = meme(["a"]).replace(`<<^ code="&#x0003;">>\n`, `<<^ code="&#x0003;">>\n<<~ ahu #edges>>\n\n* x\n\n<<~/ahu>>\n`);
    const receipt = await placeMeme({ uri: URI, text: stranded }, sink);
    expect(receipt.decision).toBe("refuse");
    expect(receipt.grade).toBe("error");
  });
});
