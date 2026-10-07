/**
 * THE TWO DOORS (c) — the backstop. Whatever door a FRAMED MEME ROOT enters a server wiki by, the
 * placement law runs over it once it stands: a `change` listener finds a record still carrying its
 * SOH head under the carrier type, runs `placeMeme` over it, and logs one line naming the door as
 * far as the wiki can see it. A root that entered through `/memes/` stands split already and the
 * listener leaves it (CONTROL). Driven over a fake `$tw` whose wiki fires `change` on every write.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { startup, name, after } from "../src/modules/meme-backstop.js";
import { quoteblockFence } from "../src/ingest-gate.js";
import { placeMeme, readMeme, wikiMemeSink } from "../src/place-meme.js";
import type { TiddlerFields } from "../src/deserializer.js";

const URI = "lar:///t/x";
const CARRIER = "text/memetic-wikitext+tiddlywiki";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

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
 * SEAM (b), THE FORWARD PATH — a child-slot save is gated too, but only to SURFACE.
 *
 * `framedRootOf` still answers null for a slot child and the listener still never lands or refuses
 * one (the CONTROL above already proves the child's own record goes untouched). This is the OTHER
 * half of the widening: a title shaped `root#/slot` re-grades its ROOT'S current recomposed render
 * through `evaluateMeme` (never `placeMeme` — nothing here ever lands) and raises or clears one
 * `$:/tags/Alert` tiddler, stable per root, naming the child, the root, and the diagnostic codes.
 */
describe("★ SEAM (b): a child-slot save re-grades its root and surfaces, never lands or refuses ★", () => {
  let wiki: ReturnType<typeof fakeWiki>;
  beforeEach(() => {
    wiki = fakeWiki();
    (globalThis as Record<string, unknown>)["$tw"] = { node: true, wiki, boot: { files: {} } };
    startup({ log: () => {} });
  });
  afterEach(() => { delete (globalThis as Record<string, unknown>)["$tw"]; });

  const alertTitle = `$:/temp/lares/alert/meme-child-gate/${URI}`;

  test("a clean child-slot save raises no alert", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: "! a EDITED" });
    await settle();
    expect(wiki.store.has(alertTitle)).toBe(false);
  });

  test("QUOTEBLOCK FLOOR: a child-slot save carrying a whole pasted frame gets FENCED, and the alert names `quoteblocked`", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    const pasted = meme(["z"]);
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: pasted });
    await settle();
    const alert = wiki.store.get(alertTitle);
    expect(alert?.["tags"]).toBe("$:/tags/Alert");
    expect(alert?.["root"]).toBe(URI);
    expect(alert?.["child"]).toBe(`${URI}#/a`);
    expect(String(alert?.["codes"] ?? "")).toContain("frame-malformed");
    expect(String(alert?.["codes"] ?? "")).toContain("quoteblocked");
    // The UNDECOMPOSABLE splice gets fenced into a quoteblock — identity (title) untouched, body
    // replaced by a fence the frame mask recognises, so the composed root reads clean again.
    expect(String(wiki.store.get(`${URI}#/a`)!["text"])).toBe(quoteblockFence(pasted));
  });

  test("QUOTEBLOCK FLOOR: a child-slot save carrying a stray ETX gets fenced too", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    const stray = `! a\n\n<<^ code="&#x0003;">>\n\nstranded\n`;
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: stray });
    await settle();
    const alert = wiki.store.get(alertTitle);
    expect(alert).toBeDefined();
    expect(String(alert?.["codes"] ?? "")).toContain("quoteblocked");
    expect(String(wiki.store.get(`${URI}#/a`)!["text"])).toBe(quoteblockFence(stray));
  });

  /**
   * WIDENING (#/quoteblock-floor, option (iv)) — an unclosed ahu and a stray block closer corrupt the
   * COMPOSED root (the dangling opener eats the parent's closer; the orphan closes the parent early)
   * but grade below error on `evaluateMeme`'s NOOP-equivalence leg, so that rail alone never surfaces
   * them. The ahu-scan stack already knows both shapes; the child gate raises them with named codes,
   * while a lawful nested ahu child and a clean child raise nothing — the widening is a REPORTING
   * addition, not a new refusal.
   */
  test("QUOTEBLOCK FLOOR: a child-slot save carrying an unclosed ahu is fenced, codes `ahu-unbalanced-open` + `quoteblocked`", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    const unclosed = "! a\n\n<<~ ahu #/a/z>>\n\nno closer\n";
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: unclosed });
    await settle();
    const alert = wiki.store.get(alertTitle);
    expect(alert).toBeDefined();
    expect(String(alert?.["codes"] ?? "")).toContain("ahu-unbalanced-open");
    expect(String(alert?.["codes"] ?? "")).toContain("quoteblocked");
    expect(String(wiki.store.get(`${URI}#/a`)!["text"])).toBe(quoteblockFence(unclosed));
  });

  test("QUOTEBLOCK FLOOR: a child-slot save carrying a stray block closer is fenced, codes `ahu-orphan-close` + `quoteblocked`", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    const orphan = "! a\n\n<<~/ahu>>\n\nafter\n";
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: orphan });
    await settle();
    const alert = wiki.store.get(alertTitle);
    expect(alert).toBeDefined();
    expect(String(alert?.["codes"] ?? "")).toContain("ahu-orphan-close");
    expect(String(alert?.["codes"] ?? "")).toContain("quoteblocked");
    expect(String(wiki.store.get(`${URI}#/a`)!["text"])).toBe(quoteblockFence(orphan));
  });

  test("a lawful nested ahu child raises no alert", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: "! a\n\n<<~ ahu #/a/z>>\n\n! z\n\n<<~/ahu>>\n" });
    await settle();
    expect(wiki.store.has(alertTitle)).toBe(false);
  });

  test("fixing the child clears the alert", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: meme(["z"]) });
    await settle();
    expect(wiki.store.has(alertTitle)).toBe(true);

    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: "! a CLEAN AGAIN" });
    await settle();
    expect(wiki.store.has(alertTitle)).toBe(false);
  });

  test("QUOTEBLOCK FLOOR · WRAPPER SURVIVAL: a fenced child still composes clean and still declares its slot", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: meme(["z"]) });
    await settle();
    // The composed root, re-read AFTER the fence lands, now reads clean — re-grading it independently
    // (the same way `runChildGate` does) finds no error-grade and no balance fault.
    const render = await readMeme(URI, wikiMemeSink(wiki));
    expect(render).not.toBeNull();
    const receipt = await (await import("../src/place-meme.js")).evaluateMeme({ uri: URI, text: render!.text }, wikiMemeSink(wiki));
    expect(receipt.grade).not.toBe("error");
    // The slot the child's record carries survives the fence — the `<<~ ahu #/a>>` wrapper is
    // synthesized at render, never stored, so fencing the body cannot drop the declaration.
    expect(render!.text).toContain("#/a");
  });

  test("QUOTEBLOCK FLOOR · ATTRIBUTION: two children save together, only the faulty one is fenced", async () => {
    await placeMeme({ uri: URI, text: meme(["a", "b"]) }, wikiMemeSink(wiki));
    await settle(); // let setup's own land-triggered child-gate churn settle before the real edits race it
    // Both child saves land in ONE change batch (no microtask boundary between them).
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: "! a CLEAN EDIT" });
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/b`)!, text: meme(["z"]) }); // the faulty splice
    await settle();
    const alert = wiki.store.get(alertTitle);
    expect(alert).toBeDefined();
    expect(alert?.["child"]).toBe(`${URI}#/b`);
    // The clean sibling is untouched; only the faulty child is fenced.
    expect(String(wiki.store.get(`${URI}#/a`)!["text"])).toBe("! a CLEAN EDIT");
    expect(String(wiki.store.get(`${URI}#/b`)!["text"])).toBe(quoteblockFence(meme(["z"])));
  });

  test("QUOTEBLOCK FLOOR · SELF-TERMINATION: the fence's own re-fire writes nothing further", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: meme(["z"]) });
    await settle();
    const fencedText = String(wiki.store.get(`${URI}#/a`)!["text"]);
    const alertBefore = JSON.stringify(wiki.store.get(alertTitle));
    // Let a further settle pass run with nothing new landing — no further write should occur, and the
    // alert this write raised should stand exactly as it was, never clobbered by a clean-composition
    // re-grade clearing it.
    await settle();
    expect(String(wiki.store.get(`${URI}#/a`)!["text"])).toBe(fencedText);
    expect(JSON.stringify(wiki.store.get(alertTitle))).toBe(alertBefore);
  });
});

/**
 * THE FENCE IS A WRITE, AND A HEARTH WRITES ONLY WHERE IT KEEPS. A child that arrived through the
 * envelope from a bag this hearth's cascade does not route it to (`$origin-bag` names that bag) is a
 * peer's record on a bag this hearth does not keep: fencing it would copy it up over the peer's own
 * and shadow every later edit there. So the gate surfaces `quoteblocked` and writes nothing. A
 * child this hearth wrote itself (no envelope stamp, or the stamp names the bag the cascade routes
 * it to) is still fenced.
 */
describe("★ the child gate writes only on a bag this hearth keeps ★", () => {
  const KEPT    = "lar:///ha.ka.ba/bags/test-wiki/working";
  const MOUNTED = "lar:///ha.ka.ba/bags/peer-library";
  const BAG_PATHS = "lar:///ha.ka.ba/lararium/config/bag-paths";
  let wiki: ReturnType<typeof fakeWiki> & {
    getTiddlerText: (t: string, fallback?: string) => string;
    filterTiddlers: (filter: string, widget?: unknown, source?: unknown) => string[];
  };
  const alertTitle = `$:/temp/lares/alert/meme-child-gate/${URI}`;

  beforeEach(() => {
    // The cascade this hearth's saves route by: every `lar:` title lands in KEPT.
    wiki = Object.assign(fakeWiki(), {
      getTiddlerText: (t: string, fallback = "") => (t === BAG_PATHS ? `[prefix[lar:]then[${KEPT}]]` : fallback),
      filterTiddlers: (filter: string, _w?: unknown, source?: unknown) => {
        let title = "";
        (source as ((fn: (t: unknown, ti: string) => void) => void) | undefined)?.((_t, ti) => { title = ti; });
        return filter === `[prefix[lar:]then[${KEPT}]]` && title.startsWith("lar:") ? [KEPT] : [];
      },
    });
    (globalThis as Record<string, unknown>)["$tw"] = { node: true, wiki, boot: { files: {} } };
    startup({ log: () => {} });
  });
  afterEach(() => { delete (globalThis as Record<string, unknown>)["$tw"]; });

  test("★ an inbound peer change on a bag this hearth does not keep raises `quoteblocked` and writes no fence ★", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    const pasted = meme(["z"]);
    const writes: string[] = [];
    const add = wiki.addTiddler;
    wiki.addTiddler = (f) => { writes.push(String(f.title)); add(f); };
    // The nalu lands a peer's child with the envelope's bag stamped on it.
    add({ ...wiki.store.get(`${URI}#/a`)!, text: pasted, "$origin-bag": MOUNTED });
    await settle();

    expect(String(wiki.store.get(`${URI}#/a`)!["text"])).toBe(pasted);
    expect(writes.filter((t) => t !== alertTitle)).toEqual([]);
    const alert = wiki.store.get(alertTitle);
    expect(alert?.["child"]).toBe(`${URI}#/a`);
    expect(String(alert?.["codes"] ?? "")).toContain("quoteblocked");
    expect(String(alert?.["text"] ?? "")).toContain(MOUNTED);
  });

  test("CONTROL — an own write (stamped with the bag the cascade routes it to) is still fenced", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    const pasted = meme(["z"]);
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: pasted, "$origin-bag": KEPT });
    await settle();
    expect(String(wiki.store.get(`${URI}#/a`)!["text"])).toBe(quoteblockFence(pasted));
    expect(String(wiki.store.get(alertTitle)?.["codes"] ?? "")).toContain("quoteblocked");
  });

  test("CONTROL — an own write with no envelope stamp is still fenced", async () => {
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    const pasted = meme(["z"]);
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: pasted });
    await settle();
    expect(String(wiki.store.get(`${URI}#/a`)!["text"])).toBe(quoteblockFence(pasted));
  });

  /**
   * A WITHHOLDING IS NOT A KEEP. The cascade's empty-operand form (`[match[x]then[]]`) routes the child
   * nowhere, so no bag of this hearth's holds it — a stamped child there reads UNKEPT exactly as a
   * gap does, and the gate surfaces without writing. The adaptor reads the same verdict as "withhold
   * the save"; the two hands share one walk, never two that could drift.
   */
  test("★ a stamped child whose only matching rule WITHHOLDS it surfaces and writes nothing ★", async () => {
    const child = `${URI}#/a`;
    const withhold = `[match[${child}]then[]]`;
    wiki.getTiddlerText = (t: string, fallback = "") => (t === BAG_PATHS ? withhold : fallback);
    wiki.filterTiddlers = (filter: string, _w?: unknown, source?: unknown) => {
      let title = "";
      (source as ((fn: (t: unknown, ti: string) => void) => void) | undefined)?.((_t, ti) => { title = ti; });
      return filter === withhold && title === child ? [""] : [];
    };
    await placeMeme({ uri: URI, text: meme(["a"]) }, wikiMemeSink(wiki));
    const pasted = meme(["z"]);
    const writes: string[] = [];
    const add = wiki.addTiddler;
    wiki.addTiddler = (f) => { writes.push(String(f.title)); add(f); };
    add({ ...wiki.store.get(child)!, text: pasted, "$origin-bag": KEPT });
    await settle();

    expect(String(wiki.store.get(child)!["text"])).toBe(pasted);
    expect(writes.filter((t) => t !== alertTitle)).toEqual([]);
    expect(String(wiki.store.get(alertTitle)?.["codes"] ?? "")).toContain("quoteblocked");
    expect(String(wiki.store.get(alertTitle)?.["text"] ?? "")).toContain(KEPT);
  });
});

/**
 * The round-trip `placeMeme(root, readMeme(root))` is not a fixed point everywhere, so it does not
 * surface every fault a slot child's save can carry. Closing seam (b) — a slot child that moved
 * re-places its ROOT, grading the whole carrier as one — relies on that mechanism: `readMeme` is
 * `render(records)`, handed back to `placeMeme`, so the Confluence gate reads
 * `render(parse(render(r)))` against `render(r)`. For FIVE of the seven shapes below that is the
 * canonical form's own fixed point: `decision=noop`, `grade=clean`, zero diagnostics, nothing
 * landed, the record set unmoved — a tautology, reporting no fault because none of its three reads
 * moved.
 *
 * TWO shapes break the tautology: a child holding a stray ETX, and a child holding a whole pasted
 * frame. Both mint a SECOND live ETX once rendered back into the root's own STX..ETX span (the root's
 * own close, plus the child's), and the frame reader refuses that shape before the Confluence gate
 * ever reaches an equivalence question — `decision=refuse`, `grade=error`, diagnostics named
 * `frame-malformed` ("2 live ETX marks follow the STX…") and, for the bare stray ETX,
 * `postamble-content` besides. The round-trip launders nothing the root's own door would not already
 * refuse (the CONTROL below), and these two shapes surface through it rather than passing silently.
 *
 * TWO MORE shapes now fence: an unclosed ahu and a stray block closer leave the rendered root
 * un-decomposable, and the quoteblock floor's whole-chunk grain (`ahu.mem#/quoteblock-floor`) reads the
 * re-placed root as a whole carrier arriving — `decision=ingest`, `grade=warning`, `quoteblocked` named,
 * the whole body fenced into the root, the slot child retired into that fence (its bytes kept inside
 * it). A re-place is a whole-carrier write, so the carrier is its grain; the child gate above is the
 * in-place grain that fences only the child's body.
 *
 * Seam (b) stands open for the OTHER three shapes: a child's save there can only be graded against
 * the CHILD'S OWN AUTHORED TEXT — the bytes that never pass through the renderer — and this package
 * carries no congruence that reads a fragment body as a gradeable unit on its own. That remains the
 * operator's call; the probe below is the measurement any such instrument must answer to.
 */
describe("★ PHASE 5 RE-MEASURED: re-placing a root from its records refuses two shapes, fences two, still misses three ★", () => {
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
    // CANON: a nested open carries its whole path from the carrier root — `#/a/z` nested inside
    // `#/a`, a strict descendant, never the bare relative leaf `#/z` a re-prefixing reader would need.
    "a nested ahu block":      "! a\n\n<<~ ahu #/a/z>>\n\n! z\n\n<<~/ahu>>\n",
    "a whole pasted frame":    meme(["z"]),
    "an unclosed ahu":         "! a\n\n<<~ ahu #/a/z>>\n\nno closer\n",
    "a stray block closer":    "! a\n\n<<~/ahu>>\n\nafter\n",
    "a malformed meta fence":  "! a\n\n```toml meta\nbogus = [\n```\n",
  };

  // The two shapes that mint a SECOND live ETX into the rendered root — re-measured 2026-10-04.
  const NOW_ERROR_GRADED = new Set(["a stray ETX mark", "a whole pasted frame"]);
  // The two shapes the family split cannot decompose — the whole-chunk floor fences them.
  const FLOOR_FENCED = new Set(["an unclosed ahu", "a stray block closer"]);

  for (const [what, text] of Object.entries(CHILD_EDITS)) {
    const errorGraded = NOW_ERROR_GRADED.has(what);
    if (FLOOR_FENCED.has(what)) {
      test(`the re-place reads INGEST over ${what} — the whole chunk fences, the bytes kept inside it`, async () => {
        const store = new Map<string, TiddlerFields>();
        const sink = wikiMemeSink(sinkOf(store) as never);
        await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
        store.set(`${URI}#/a`, { ...store.get(`${URI}#/a`)!, text });

        const render = await readMeme(URI, sink);
        const receipt = await placeMeme({ uri: URI, text: render!.text }, sink);

        expect(receipt.decision).toBe("ingest");
        expect(receipt.grade).toBe("warning");
        expect(receipt.diagnostics.map((d) => d.code)).toContain("quoteblocked");
        // No slot child lands (a `$`-carriage part of the rendered frame may ride beside the root).
        expect(receipt.landed.filter((t) => !t.includes("#/$"))).toEqual([URI]);
        expect(receipt.tombstoned).toEqual([`${URI}#/a`]);
        expect(String(store.get(URI)!["text"])).toContain(text.trim());
      });
      continue;
    }
    const title = errorGraded
      ? `the re-place reads ERROR over ${what} — a second live ETX, caught before any equivalence question`
      : `the re-place reads NOOP over ${what} — nothing grades, nothing lands`;
    test(title, async () => {
      const store = new Map<string, TiddlerFields>();
      const sink = wikiMemeSink(sinkOf(store) as never);
      await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
      const before = [...store.keys()].sort();
      store.set(`${URI}#/a`, { ...store.get(`${URI}#/a`)!, text });

      const render = await readMeme(URI, sink);
      const receipt = await placeMeme({ uri: URI, text: render!.text }, sink);

      if (errorGraded) {
        expect(receipt.decision).toBe("refuse");
        expect(receipt.grade).toBe("error");
        expect(receipt.diagnostics.map((d) => d.code)).toContain("frame-malformed");
        expect(receipt.landed).toEqual([]);
      } else {
        expect(receipt.decision).toBe("noop");
        expect(receipt.grade).toBe("clean");
        expect(receipt.diagnostics).toEqual([]);
        expect(receipt.landed).toEqual([]);
      }
      // Refused or noop, the store never moves — a root the gate catches stays exactly as it stood,
      // and so does one the gate waves through.
      expect([...store.keys()].sort()).toEqual(before);
      // And the author's bytes stand exactly as written — the one thing the plan got right either way.
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
