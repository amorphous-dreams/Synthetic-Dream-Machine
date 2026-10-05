/**
 * weave-doors — ONE TARGET LAW, read the same way through every door: the CLI's `--dialect`/
 * `--tongue`, the `meme-project` filter's second/third operand, and the `meme-project` daemon
 * verb's `dialect`/`tongue` args. This suite pins the law in `weave/index.ts` (profileOf,
 * recordedTargetOf, submissionTitleOf, resolveWeaveTarget, pinTargetsOf) and the two live doors
 * built on it (the filter's recorded-target read + live resolver, the verb's prefetch resolver).
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */
import { describe, test, expect, beforeAll } from "vitest";
import {
  profileOf, recordedTargetOf, submissionTitleOf, resolveWeaveTarget, pinTargetsOf,
  projectSubmission, PROFILES,
} from "../src/weave/index.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";
import { CompositeStore, bagUri, type LarTiddlerStore } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, makeMemeProjectReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

// ── unit pins: the extracted laws ──────────────────────────────────────────────────────────────
describe("profileOf / recordedTargetOf / resolveWeaveTarget / pinTargetsOf", () => {
  test("profileOf matches case-insensitively, including a bare lowercase \"gfm\"", () => {
    expect(profileOf("gfm")).toBe(PROFILES.GFM);
    expect(profileOf("CommonMark")).toBe(PROFILES.CommonMark);
    expect(profileOf("KRAMDOWN-RFC2629")).toBe(PROFILES["kramdown-rfc2629"]);
  });

  test("profileOf refuses an unknown name, naming every registered variant", () => {
    expect(() => profileOf("markdown-extra")).toThrow(/CommonMark.*GFM.*kramdown-rfc2629/);
  });

  test("recordedTargetOf reads variant/tongue off a .md.meta body; absent keys answer undefined", () => {
    expect(recordedTargetOf("title: x\nvariant: GFM\ntongue: en\n")).toEqual({ variant: "GFM", tongue: "en" });
    expect(recordedTargetOf("title: x\ntype: text/markdown\n")).toEqual({});
  });

  test("submissionTitleOf names the /submission suffix projectSubmission's own default title uses", () => {
    expect(submissionTitleOf("lar:///t/x")).toBe("lar:///t/x/submission");
    const p = projectSubmission('<<^ code="&#x0001;" from="?" -> to="lar:///t/x">>\n<<^ code="&#x0002;">>\n\nbody\n<<^ code="&#x0003;">>\n<<^ code="&#x0004;" -> to="?">>\n');
    expect(p.meta).toContain("title: lar:///t/x/submission");
  });

  test("resolveWeaveTarget: a flag wins over a recorded target, field by field", () => {
    const r = resolveWeaveTarget({ dialect: "GFM", recorded: { variant: "kramdown-rfc2629", tongue: "en" } });
    expect(r.profile).toBe(PROFILES.GFM);
    // dialect was given, tongue was not — each field defaults from the record independently.
    expect(r.tongue).toBe("en");
  });

  test("resolveWeaveTarget: absent flags fall to the recorded target", () => {
    const r = resolveWeaveTarget({ recorded: { variant: "GFM", tongue: "en" } });
    expect(r.profile).toBe(PROFILES.GFM);
    expect(r.tongue).toBe("en");
  });

  test("CONTROL: resolveWeaveTarget with no flags and no recorded target answers CommonMark, no tongue", () => {
    const r = resolveWeaveTarget({ recorded: {} });
    expect(r.profile).toBe(PROFILES.CommonMark);
    expect(r.tongue).toBeUndefined();
  });

  test("resolveWeaveTarget: an unknown dialect flag throws, naming the registered variants", () => {
    expect(() => resolveWeaveTarget({ dialect: "nope", recorded: {} })).toThrow(/CommonMark/);
  });

  const AKA_CARRIER = [
    '<<^ code="&#x0001;" from="?" -> to="lar:///t/akas">>',
    '<<^ code="&#x0002;">>',
    "",
    '<<~ aka "lar:///t/one">>',
    '<<~ kanawai "lar:///t/two#/slot">>',
    "",
    "```memetic-wikitext",
    '<<~ aka "lar:///t/fenced-out">>',
    "```",
    "",
    '<<^ code="&#x0003;">>',
    '<<^ code="&#x0004;" -> to="?">>',
    "",
  ].join("\n");

  test("pinTargetsOf: every aka/kanawai base URI, fragment and quotes stripped, fenced ones excluded", () => {
    expect(pinTargetsOf(AKA_CARRIER)).toEqual(["lar:///t/one", "lar:///t/two"]);
  });

  test("CONTROL: a carrier with no aka/kanawai pins answers an empty list", () => {
    expect(pinTargetsOf('<<^ code="&#x0001;" from="?" -> to="lar:///t/none">>\nbody\n')).toEqual([]);
  });
});

// ── the live filter door: recorded-target read + wikiResolver, read off a real wiki ──────────────
const URI = "lar:///t/weave-doors";
const PINNED_URI = "lar:///t/weave-doors-pinned";
const meme = (uri: string, body: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${uri.replace(/^lar:\/\/\//, "")}"\n\`\`\`\n\n${body}\n<<^ code="&#x0003;">>\n<<^ code="&#x0004;" -> to="?">>\n`;

describe.skipIf(wikiSkip)(`the meme-project filter's dialect/tongue operands + live resolver${skipNote}`, () => {
  let engine: TW5Engine;
  let face: LaresMemeFace;
  beforeAll(async () => {
    engine = await bootTestWiki();
    face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
    await face.place(PINNED_URI, meme(PINNED_URI, "! pinned content\n"));
    await face.place(URI, meme(URI, `! root\n\n<<~ aka "${PINNED_URI}">>\n`));
  });

  // A SECOND/THIRD operand of one operator rides its OWN bracket after a comma (`op[a],[b]`) — TW5's
  // own multi-operand grammar (`filters.js`'s "Check for multiple operands" clause): a bare comma with
  // no opening bracket right after it is a filter-syntax error, never a second value folded in.
  const filterMd = (dialect = ""): string =>
    (engine.wiki.filterTiddlers(`[[${URI}]] +[meme-project[md],[${dialect}]]`) as string[])[0] ?? "";
  const filterMeta = (dialect = ""): string =>
    (engine.wiki.filterTiddlers(`[[${URI}]] +[meme-project[md.meta],[${dialect}]]`) as string[])[0] ?? "";

  test("★ an explicit GFM operand weaves YAML frontmatter; the .md.meta sidecar carries variant: GFM ★", () => {
    expect(filterMd("GFM").startsWith("---\n")).toBe(true);
    expect(filterMeta("GFM")).toContain("variant: GFM");
  });

  test("CONTROL: a bare meme-project[md], no recorded target, stays CommonMark — no frontmatter", () => {
    expect(filterMd().startsWith("---\n")).toBe(false);
  });

  test("a recorded submission tiddler (variant: GFM) makes a BARE meme-project[md] weave GFM; an explicit CommonMark operand overrides it", () => {
    engine.wiki.addTiddler({ title: submissionTitleOf(URI), variant: "GFM" } as never);
    expect(filterMd().startsWith("---\n")).toBe(true);
    expect(filterMd("CommonMark").startsWith("---\n")).toBe(false);
    engine.wiki.deleteTiddler(submissionTitleOf(URI));
  });

  test("★ a frozen aka edge pins through the LIVE resolver — content inlines with its own check ★", () => {
    const md = filterMd();
    expect(md).toContain("pinned content");
    expect(md).toMatch(/pinned ni:\/\/\/sha-256;/);
  });

  test("CONTROL: an absent pin target falls back unresolved even with a live resolver attached", async () => {
    const lonely = "lar:///t/weave-doors-lonely";
    await face.place(lonely, meme(lonely, '! lonely\n\n<<~ aka "lar:///t/nowhere-at-all">>\n'));
    const md = (engine.wiki.filterTiddlers(`[[${lonely}]] +[meme-project[md]]`) as string[])[0] ?? "";
    expect(md).toContain("(unresolved — no corpus to pin)");
  });

  test("an unknown dialect operand throws, naming the registered variants", () => {
    expect(() => engine.wiki.filterTiddlers(`[[${URI}]] +[meme-project[md],[nope]]`)).toThrow(/CommonMark/);
  });
});

// ── the daemon verb's dialect/tongue args: store path (prefetch resolver) + non-md refusal ───────
const VERB_URI = "lar:///t/verb-dialect";
const capCalls: Array<{ access: string; bag: string }> = [];
const ctx = (): VerbContext => ({
  daemon: {} as CompositeStore,
  invocation: { requestId: "r1" } as VerbContext["invocation"],
  cap: async (access, bag) => { capCalls.push({ access, bag }); return { ok: true }; },
});

function fakeWiki() {
  const store = new Map<string, Record<string, unknown>>();
  return {
    getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t) } : undefined),
    getTiddlerText: (t: string, d = ""): string => (typeof store.get(t)?.["text"] === "string" ? String(store.get(t)!["text"]) : d),
    addTiddler: (f: Record<string, unknown>) => { store.set(String(f["title"]), f); },
    deleteTiddler: (t: string) => { store.delete(t); },
  };
}

function verbRig(): { opts: MemeVerbOptions; composite: CompositeStore } {
  const wiki = fakeWiki();
  const composite = new CompositeStore();
  composite.addLayer({ bagId: bagUri("sdm"), store: new MemoryTiddlerStore(bagUri("sdm")), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: bagUri("daemon"), store: new MemoryTiddlerStore(bagUri("daemon")), writable: true });
  const opts: MemeVerbOptions = {
    composite,
    tw5: { $tw: { wiki } } as unknown as MemeVerbOptions["tw5"],
    reach: async (): Promise<LarTiddlerStore | null> => null,
  };
  return { opts, composite };
}

describe("makeMemeProjectReactor — dialect/tongue args", () => {
  test("★ a store-target dialect flag weaves GFM frontmatter over the carrier text alone, resolving its pin by PREFETCH ★", async () => {
    const { opts } = verbRig();
    const PIN_URI = "lar:///t/verb-pinned";
    await makeMemePutReactor(opts)({ bag: "sdm", uri: PIN_URI, text: meme(PIN_URI, "! pin target\n") }, ctx());
    await makeMemePutReactor(opts)({ bag: "sdm", uri: VERB_URI, text: meme(VERB_URI, `! root\n\n<<~ aka "${PIN_URI}">>\n`) }, ctx());
    const out = await makeMemeProjectReactor(opts)({ bag: "sdm", uri: VERB_URI, to: "md", dialect: "GFM" }, ctx()) as { text: string };
    expect(out.text.startsWith("---\n")).toBe(true);
    expect(out.text).toContain("pin target");
  });

  test("--dialect/--tongue on a non-md target (html) refuses loud rather than silently ignoring it", async () => {
    const { opts } = verbRig();
    await expect(
      makeMemeProjectReactor(opts)({ uri: VERB_URI, to: "html", dialect: "GFM" }, ctx()),
    ).rejects.toThrow(/md.*alone/);
  });
});
