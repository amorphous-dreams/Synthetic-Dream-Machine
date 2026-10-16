/**
 * interaction-goldens.engine — the engine half of every interaction golden beside the runner, walked through the
 * camera contract's doors over a real booted engine.
 *
 * The scripts this half carries (01, the blanket preventDefault; 02, a button's modifier and popup; 03, the textarea
 * revert; 04, a peer write into an open editor; 05, a toolbar operation over the carried pair; 06, the toggle family;
 * 08, the committing Enter after a composition; 12, the host doors; 13, the surface switch) read green only when the engine
 * answers every step the engine half reads; the page half's expectations stand SKIPPED by
 * name, and a frame line another slice's road paints stands OWED by its own words (and must still read red). Every other
 * script walks too and must still read red: its road has not landed, and a green there names one that did. A
 * control mutates each carried script into a claim the engine never makes and reads the runner red, so a green
 * from the runner carries information.
 *
 * Time rests on the test's hand: `setTimeout` stands faked once the worlds boot, so a frame flushes when the
 * script says and never at the machine's speed.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { goldenScripts, runEngineGolden, type EngineRunHooks, type GoldenScript } from "./goldens/interaction/engine-runner.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise<void>((resolve) => process.nextTick(resolve)); };
/** The worlds boot on real timers; the walk runs on faked ones. */
const hooks = (): EngineRunHooks => {
  let faked = false;
  const fake = (): void => { if (!faked) { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); faked = true; } };
  return {
    settle: async () => { fake(); await settle(); },
    advance: async () => { fake(); await settle(); vi.advanceTimersByTime(100); await settle(); },
  };
};

const scripts = goldenScripts();
/** The scripts whose every engine-half step this island answers today. */
const CARRIED = ["01", "02", "03", "04", "05", "06", "08", "12", "13"];
/**
 * The frame lines a carried script reads that another slice's road paints, by script number. Each one stays red by
 * its own words until that road lands, and nothing else may read red beside it; a line that reads green leaves.
 */
const OWED_ELSEWHERE: Readonly<Record<string, readonly RegExp[]>> = {};
const byNumber = (n: string): GoldenScript => scripts.find((s) => s.file.startsWith(`${n}-`))!.script;
/** A script whose `expect` at `index` takes `patch` in place of what it said. */
const mutate = (script: GoldenScript, index: number, patch: Record<string, unknown>): GoldenScript => ({
  ...script, steps: script.steps.map((s, i) => i === index ? { expect: { ...(s["expect"] as object), ...patch } } : s),
});

describe.skipIf(wikiSkip)(`interaction goldens, engine half${skipNote}`, () => {
  afterEach(() => { vi.useRealTimers(); });

  test("the runner finds the scripts the README names, the carried ones among them", () => {
    expect(scripts.map((s) => s.file.slice(0, 2))).toEqual(expect.arrayContaining([...CARRIED]));
  });

  for (const { file, script } of scripts.filter((s) => CARRIED.includes(s.file.slice(0, 2)))) {
    test(`${file}: ${script.pins}`, async () => {
      const run = await runEngineGolden(script, hooks());
      const owed = OWED_ELSEWHERE[file.slice(0, 2)] ?? [];
      expect(run.failures.filter((f) => !owed.some((o) => o.test(f))), run.trace.join("\n")).toEqual([]);
      // Each owed line still reads red: a green there names the road that landed, and its line leaves this table.
      for (const o of owed) expect(run.failures.some((f) => o.test(f)), `owed line ${o} reads green: drop it`).toBe(true);
      const pageExpects = script.steps.filter((s) => s["expect"] && "page" in (s["expect"] as object)).length;
      expect(run.skipped, "the page half's expectations stand skipped by name, and nothing else").toHaveLength(pageExpects);
      expect(run.skipped.every((s) => s.endsWith("expect.page (the page half)"))).toBe(true);
    }, 120_000);
  }

  test("UNBUILT: every script beyond the carried ones still reads red in the engine half — a green names a road that landed", async () => {
    const others = scripts.filter((s) => !CARRIED.includes(s.file.slice(0, 2)));
    expect(others.length, "the census walks the rest of the directory").toBeGreaterThan(0);
    const greened: string[] = [];
    for (const { file, script } of others) {
      let red: boolean;
      try { red = (await runEngineGolden(script, hooks())).failures.length > 0; } catch { red = true; }
      vi.useRealTimers();
      if (!red) greened.push(file);
    }
    expect(greened).toEqual([]);
  }, 600_000);

  test("CONTROL 03: a script claiming the frame after the sense names a revision the page never sent reads red", async () => {
    const script = byNumber("03");
    const at = script.steps.findIndex((s) => (s["expect"] as { frame?: { sensedRevision?: Record<string, number> } } | undefined)?.frame?.sensedRevision?.[".body"] === 1);
    expect(at, "the mutation found its step").toBeGreaterThan(0);
    const run = await runEngineGolden(mutate(script, at, { frame: { sensedRevision: { ".body": 2 } } }), hooks());
    expect(run.failures.join("\n")).toMatch(/sensedRevision \{"\.body":1\}, the script expects \{"\.body":2\}/);
  }, 120_000);

  test("CONTROL 13: a script claiming the stale act applied and wrote reads red on both counts", async () => {
    const script = byNumber("13");
    const at = script.steps.findIndex((s) => JSON.stringify(s["expect"]) === JSON.stringify({ answers: ["stale-target"], writes: [] }));
    expect(at, "the mutation found its step").toBeGreaterThan(0);
    const run = await runEngineGolden(mutate(script, at, { answers: ["applied"], writes: [{ title: "lar:///t/switch/beta", text: "beta-pressed" }] }), hooks());
    const text = run.failures.join("\n");
    expect(text).toMatch(/answers \["stale-target"\], the script expects \["applied"\]/);
    expect(text).toMatch(/lar:\/\/\/t\/switch\/beta holds text="0", the script expects "beta-pressed"/);
  }, 120_000);

  test("CONTROL 04: a script claiming the frame repainted the page's text as the store's value reads red", async () => {
    const script = byNumber("04");
    const at = script.steps.findIndex((s) => (s["expect"] as { frame?: { attributes?: unknown } } | undefined)?.frame?.attributes !== undefined);
    expect(at, "the mutation found its step").toBeGreaterThan(0);
    const run = await runEngineGolden(mutate(script, at, { frame: { attributes: { ".body": { "data-lar-value": "mine, edited" } } } }), hooks());
    expect(run.failures.join("\n")).toMatch(/\.body data-lar-value="theirs", the script expects "mine, edited"/);
  }, 120_000);

  test("CONTROL 05: a script claiming the stale toolbar act applied, and a want TW5 never computed, reads red", async () => {
    const script = byNumber("05");
    const stale = script.steps.findIndex((s) => JSON.stringify((s["expect"] as { answers?: unknown } | undefined)?.answers) === JSON.stringify(["stale-target"]));
    const wanted = script.steps.findIndex((s) => (s["expect"] as { want?: unknown } | undefined)?.want !== undefined);
    expect(Math.min(stale, wanted), "the mutations found their steps").toBeGreaterThan(0);
    const run = await runEngineGolden(mutate(mutate(script, stale, { answers: ["applied"] }), wanted, { want: { value: "wrap ''me'' please", selStart: 7, selEnd: 9 } }), hooks());
    const text = run.failures.join("\n");
    expect(text).toMatch(/answers \["stale-target"\], the script expects \["applied"\]/);
    expect(text).toMatch(/the answer wants \{"value":"wrap ''me'' please","selStart":5,"selEnd":11\}/);
  }, 120_000);

  test("CONTROL 08: a script claiming the committing Enter submitted reads red", async () => {
    const script = byNumber("08");
    const at = script.steps.findIndex((s) => (s["expect"] as { writes?: { title: string }[] } | undefined)?.writes?.[0]?.title === "lar:///t/ime/typed");
    expect(at, "the mutation found its step").toBeGreaterThan(0);
    const run = await runEngineGolden(mutate(script, at, { writes: [{ title: "lar:///t/ime/typed", text: "日本" }, { title: "lar:///t/ime/hit", text: "submitted" }] }), hooks());
    expect(run.failures.join("\n")).toMatch(/lar:\/\/\/t\/ime\/hit holds text="", the script expects "submitted"/);
  }, 120_000);

  test("CONTROL 01: a script claiming the link cancels every click, or that the bare span stands bound, reads red", async () => {
    const script = byNumber("01");
    const at = script.steps.findIndex((s) => JSON.stringify(s["expect"] ?? {}).includes("data-lar-cancel"));
    expect(at, "the mutation found its step").toBeGreaterThan(0);
    const run = await runEngineGolden(mutate(script, at, { frame: { stamps: {
      "a.tc-tiddlylink-resolves": { "data-lar-on": "click", "data-lar-cancel": "click" }, "span.plain": { "data-lar-on": "click" },
    } } }), hooks());
    expect(run.failures).toEqual([
      `step ${at + 1}: a.tc-tiddlylink-resolves carries data-lar-cancel="click:ordinary", the script expects "click"`,
      `step ${at + 1}: span.plain carries data-lar-on=none, the script expects "click"`,
    ]);
  }, 120_000);

  test("CONTROL 02: a script claiming the ctrl-click ran its actions unmodified reads red", async () => {
    const script = byNumber("02");
    const at = script.steps.findIndex((s) => JSON.stringify(s["expect"] ?? {}).includes('"text":"ctrl"'));
    expect(at, "the mutation found its step").toBeGreaterThan(0);
    const run = await runEngineGolden(mutate(script, at, { writes: [{ title: "lar:///t/button/target", text: "normal" }] }), hooks());
    expect(run.failures).toEqual([`step ${at + 1}: lar:///t/button/target holds text="ctrl", the script expects "normal"`]);
  }, 120_000);

  test("CONTROL 12: a script claiming print applied and asked its door reads red on both counts", async () => {
    const script = byNumber("12");
    const at = script.steps.findIndex((s) => JSON.stringify((s["expect"] as { answers?: string[] } | undefined)?.answers) === JSON.stringify(["refused:page-action-unavailable"]));
    expect(at, "the mutation found its step").toBeGreaterThan(0);
    const run = await runEngineGolden(mutate(script, at, { answers: ["applied"], services: [{ kind: "print", args: {} }] }), hooks());
    const text = run.failures.join("\n");
    expect(text).toMatch(/answers \["refused:page-action-unavailable"\], the script expects \["applied"\]/);
    expect(text).toMatch(/services \[\], the script expects \[\{"kind":"print","args":\{\}\}\]/);
  }, 120_000);

  test("CONTROL 12: a script claiming the copy asked for other text, or a frame painting what the island never said, reads red", async () => {
    const script = byNumber("12");
    const copy = script.steps.findIndex((s) => (s["expect"] as { services?: { kind: string }[] } | undefined)?.services?.[0]?.kind === "clipboard");
    const said = script.steps.findIndex((s) => (s["expect"] as { frame?: { contains?: string } } | undefined)?.frame?.contains === "Copied");
    expect(copy, "the mutation found its step").toBeGreaterThan(0);
    expect(said).toBeGreaterThan(copy);
    const run = await runEngineGolden(mutate(mutate(script, copy, { services: [{ kind: "clipboard", args: { text: "other" } }] }), said, { frame: { contains: "Not copied" } }), hooks());
    const text = run.failures.join("\n");
    expect(text).toMatch(/services \[\{"kind":"clipboard","args":\{"text":"copy me"\}\}\], the script expects/);
    expect(text).toMatch(/paints no "Not copied"/);
  }, 120_000);

  test("CONTROL: a verb the engine half never learned fails closed", async () => {
    const run = await runEngineGolden({ ...byNumber("03"), steps: [{ frame: "first" }, { expect: { messages: ["tm-save-tiddler"] } }, { wake: { surface: "lar:single" } }] }, hooks());
    expect(run.failures).toEqual(["step 2: the engine half reads no expect.messages", "step 3: the engine half knows no verb wake"]);
  }, 120_000);
});
