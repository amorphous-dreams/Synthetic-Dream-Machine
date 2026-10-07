/**
 * THE QUOTEBLOCK FLOOR, WHOLE-CHUNK GRAIN (`ahu.mem#/quoteblock-floor`) — a carrier whose family split
 * leaves an ERROR (a closer that closes nothing) or a MISSING (an opener whose closer never arrives)
 * arrives at the ingest gate and fences its WHOLE body as one quoteblock: one record, zero slots, the
 * bytes kept, the fence named on the receipt and on the alert rail. Never a drop, never a refuse.
 *
 * CONTROLS: a torn frame still refuses (no fence repairs a tear); a clean carrier decomposes as
 * before; the stock-syncer path (a framed root landed natively, re-placed by the backstop) lands and
 * never refuses; the child gate's in-place grain still fences ONE ahu body and leaves the family whole.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { decideIngest, memeticIngestOps, quoteblockFence, QUOTEBLOCKED_CODE } from "../src/ingest-gate.js";
import { placeMeme, readMeme, wikiMemeSink, memeAlertTitle } from "../src/place-meme.js";
import { canonicalizeCarrierText } from "../src/carrier-canonical.js";
import { startup } from "../src/modules/meme-backstop.js";
import { verdict } from "@lararium/memetic-frame";
import { carrierHash } from "@lararium/mesh/crypto";
import type { TiddlerFields } from "../src/deserializer.js";

const URI = "lar:///t/floor";
const CARRIER = "text/memetic-wikitext+tiddlywiki";

/** A framed carrier over an authored body (the meta stays outside the body, as the frame law reads it). */
const carrier = (body: string, uri = URI): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${uri.slice(7)}"\n\`\`\`\n\n` +
  `${body}\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

const SOUND = "<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\n<<~ ahu #/b>>\n\n! b\n\n<<~/ahu>>";
/** One ahu's closer gone: `#/b` never closes — a MISSING closer in the family split. */
const UNCLOSED = "<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\n<<~ ahu #/b>>\n\n! b";
/** A closer no opener claims — an ERROR in the family split. */
const ORPHAN = "<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\nstray prose\n\n<<~/ahu>>";

/** A Map-backed sink with a rail, so the surfacing is observable. */
function mapSink() {
  const store = new Map<string, TiddlerFields>();
  const alerts: Array<{ root: string; codes: readonly string[] } | null> = [];
  return {
    store,
    alerts,
    sink: {
      titles: () => [...store.keys()],
      read: (t: string) => store.get(t),
      land: (f: TiddlerFields) => { store.set(String(f.title), f); },
      tombstone: (t: string) => { store.delete(t); },
      surface: (root: string, finding: { codes: readonly string[] } | null) => {
        alerts.push(finding ? { root, codes: finding.codes } : null);
      },
    },
  };
}

describe("★ the quoteblock floor fences a whole un-decomposable chunk at the ingest gate ★", () => {
  for (const [name, body, fault] of [["unclosed opener", UNCLOSED, "ahu-unbalanced-open"], ["orphan closer", ORPHAN, "ahu-orphan-close"]] as const) {
    test(`a carrier with one ${name} lands as ONE fenced record, zero phantom slots, and the surfacing names it`, async () => {
      const { store, alerts, sink } = mapSink();
      const receipt = await placeMeme({ uri: URI, text: carrier(body) }, sink);

      expect(receipt.decision).toBe("ingest");
      // One record, no slot child: the fenced span declares nothing the split could cut.
      expect(receipt.landed).toEqual([URI]);
      expect([...store.keys()].filter((t) => t.includes("#"))).toEqual([]);
      // The bytes are kept, whole, inside the fence — a demotion, never a drop.
      expect(String(store.get(URI)!["text"])).toBe(quoteblockFence(body));
      const render = (await readMeme(URI, sink))!.text;
      expect(memeticIngestOps.declaredStructure(render).size).toBe(0);
      expect(render).toContain(body);
      // The rendered frame still stands sound (its check re-stamped over the fenced body).
      expect(verdict(render).kind).toBe("match");

      // Surfaced: the receipt names the fence and the fault on every door, and the rail raises it.
      const floor = receipt.diagnostics.filter((d) => d.code === QUOTEBLOCKED_CODE);
      expect(floor).toHaveLength(1);
      expect(floor[0]!.severity).toBe("warning");
      expect(floor[0]!.message).toContain(fault);
      expect(receipt.warnings.join(" ")).toContain(fault);
      expect(alerts).toEqual([{ root: URI, codes: [QUOTEBLOCKED_CODE] }]);
    });
  }

  test("the gate itself fences (every door converges on it): one record, and a re-ingest of the same bytes reads NOOP", () => {
    const disk = carrier(UNCLOSED);
    const first = decideIngest({ uri: URI, diskText: disk, diskHash: carrierHash(disk), syncedHash: null, currentRenderHash: carrierHash(""), hash: carrierHash });
    expect(first.kind).toBe("ingest");
    if (first.kind !== "ingest") return;
    expect(first.records.map((r) => r.title)).toEqual([URI]);
    // The same un-decomposable disk against the fenced records it landed: framing only, no loop.
    const again = decideIngest({
      uri: URI, diskText: disk, diskHash: carrierHash(disk + "x"), syncedHash: carrierHash(first.canonicalText),
      currentRenderHash: carrierHash(first.canonicalText), hash: carrierHash,
    });
    expect(again).toEqual({ kind: "noop", reason: "canonical-equivalent" });
  });

  test("the projecting leg reads the SAME fence: `canonicalizeCarrierText` answers the fenced render, never null", () => {
    const disk = carrier(ORPHAN);
    const canonical = canonicalizeCarrierText(URI, disk);
    expect(canonical).not.toBeNull();
    expect(canonical).toContain(quoteblockFence(ORPHAN));
  });

  test("CONTROL: a torn frame still REFUSES — no fence repairs a tear", async () => {
    const torn = carrier(UNCLOSED).replace(`<<^ code="&#x0003;">>\n\n`, "");
    expect(verdict(torn).kind).toBe("torn");
    const { store, alerts, sink } = mapSink();
    const receipt = await placeMeme({ uri: URI, text: torn }, sink);
    expect(receipt.decision).toBe("refuse");
    expect(receipt.diagnostics.map((d) => d.code)).not.toContain(QUOTEBLOCKED_CODE);
    expect(store.size).toBe(0);
    expect(alerts).toEqual([]);
  });

  test("CONTROL: a clean carrier decomposes as before — every slot its own record, no fence, the rail cleared", async () => {
    const { store, alerts, sink } = mapSink();
    const receipt = await placeMeme({ uri: URI, text: carrier(SOUND) }, sink);
    expect(receipt.decision).toBe("ingest");
    expect(receipt.landed).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
    expect(String(store.get(URI)!["text"])).toBe("<<~ kahea ahu #/a>>\n\n<<~ kahea ahu #/b>>");
    expect(receipt.diagnostics.map((d) => d.code)).not.toContain(QUOTEBLOCKED_CODE);
    expect(receipt.warnings).toEqual([]);
    expect(alerts).toEqual([null]);
    expect(memeticIngestOps.declaredStructure(carrier(SOUND))).toEqual(new Set(["#/a", "#/b"]));
  });
});

// ---------------------------------------------------------------------------
// The stock-syncer path and the in-place grain, over the backstop's change bus
// ---------------------------------------------------------------------------

type Changes = Record<string, { modified?: boolean; deleted?: boolean }>;

function fakeWiki() {
  const store = new Map<string, TiddlerFields>();
  const listeners: Array<(c: Changes) => void> = [];
  let pending: Changes = {};
  let scheduled = false;
  const flush = () => { scheduled = false; const c = pending; pending = {}; for (const l of listeners) l(c); };
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

describe("★ the stock-syncer path lands the fenced chunk and never refuses; the in-place grain stands ★", () => {
  let wiki: ReturnType<typeof fakeWiki>;
  const lines: string[] = [];
  beforeEach(() => {
    wiki = fakeWiki();
    lines.length = 0;
    (globalThis as Record<string, unknown>)["$tw"] = { node: true, wiki, boot: { files: {} } };
    startup({ log: (line: string) => { lines.push(line); } });
  });
  afterEach(() => { delete (globalThis as Record<string, unknown>)["$tw"]; });

  test("CONTROL: a framed root landed natively with an orphan closer re-stamps as one fenced record, and the wiki's alert names it", async () => {
    wiki.addTiddler({ title: URI, type: CARRIER, text: carrier(ORPHAN) });
    await settle();
    expect(lines).toEqual([`[memetic-wikitext] re-stamped ${URI} (landed via a native write)`]);
    expect([...wiki.store.keys()].filter((t) => t.startsWith(URI))).toEqual([URI]);
    expect(String(wiki.store.get(URI)!["text"])).toBe(quoteblockFence(ORPHAN));
    const alert = wiki.store.get(memeAlertTitle(URI));
    expect(alert?.["tags"]).toBe("$:/tags/Alert");
    expect(String(alert?.["codes"])).toContain(QUOTEBLOCKED_CODE);
    expect(String(alert?.["text"])).toContain("ahu-orphan-close");
  });

  test("CONTROL: the child gate's in-place grain is unchanged — ONE ahu body fences, the family and the root's refs stand", async () => {
    await placeMeme({ uri: URI, text: carrier(SOUND) }, wikiMemeSink(wiki));
    await settle();
    const unclosed = "! a\n\n<<~ ahu #/a/z>>\n\nnever closes";
    wiki.addTiddler({ ...wiki.store.get(`${URI}#/a`)!, text: unclosed });
    await settle();
    await settle();
    expect(String(wiki.store.get(`${URI}#/a`)!["text"])).toBe(quoteblockFence(unclosed));
    expect(String(wiki.store.get(`${URI}#/b`)!["text"])).toBe("! b");
    expect(String(wiki.store.get(URI)!["text"])).toBe("<<~ kahea ahu #/a>>\n\n<<~ kahea ahu #/b>>");
    expect(String(wiki.store.get(memeAlertTitle(URI))?.["child"])).toBe(`${URI}#/a`);
  });
});
