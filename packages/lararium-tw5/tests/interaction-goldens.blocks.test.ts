import { afterEach, describe, expect, test, vi } from "vitest";
import { goldenScripts, type EngineRunHooks, type GoldenScript } from "./goldens/interaction/engine-runner.js";
import { runBlocksGolden } from "./goldens/interaction/blocks-runner.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise<void>(resolve => process.nextTick(resolve)); };
function hooks(): EngineRunHooks {
  let faked = false;
  const fake = (): void => { if (!faked) { vi.useFakeTimers(); faked = true; } };
  return {
    settle: async () => { fake(); await settle(); },
    advance: async () => { fake(); await settle(); vi.advanceTimersByTime(100); await settle(); },
  };
}
const scripts = goldenScripts();
const byNumber = (number: string): GoldenScript => scripts.find(({ file }) => file.startsWith(`${number}-`))!.script;
function mutate(script: GoldenScript, index: number, patch: Record<string, unknown>): GoldenScript {
  return { ...script, steps: script.steps.map((step, at) => at === index ? { expect: { ...(step["expect"] as object), ...patch } } : step) };
}

describe.skipIf(wikiSkip)(`interaction goldens, blocks sink${skipNote}`, () => {
  afterEach(() => vi.useRealTimers());
  for (const number of ["01", "02", "06", "11"]) {
    test(`${number}: blocks affordances carry the golden's writes and messages`, async () => {
      const run = await runBlocksGolden(byNumber(number), hooks());
      expect(run.failures, run.trace.join("\n")).toEqual([]);
      const named: Record<string, { step: number; refused: string }[]> = {
        "01": [2, 4, 6, 8].map(step => ({ step, refused: "page-state-unavailable" })).concat([{ step: 9, refused: "unclaimed" }, { step: 10, refused: "page-state-unavailable" }]),
        "02": [{ step: 7, refused: "page-state-unavailable" }],
        "06": [{ step: 11, refused: "page-state-unavailable" }, { step: 14, refused: "page-revision-unavailable" }, { step: 15, refused: "page-state-unavailable" }, { step: 17, refused: "page-state-unavailable" }],
        "11": [],
      };
      expect(run.refusals).toEqual(named[number]);
    }, 120_000);
  }
  test("CONTROL 02: a false button write reads red while the lawful write passes", async () => {
    const script = byNumber("02");
    const at = script.steps.findIndex(step => JSON.stringify(step["expect"] ?? {}).includes('"text":"ctrl"'));
    expect(at).toBeGreaterThan(0);
    const lawful = await runBlocksGolden(script, hooks());
    expect(lawful.failures).toEqual([]);
    vi.useRealTimers();
    const falseWrite = await runBlocksGolden(mutate(script, at, { writes: [{ title: "lar:///t/button/target", text: "normal" }] }), hooks());
    expect(falseWrite.failures.join("\n")).toMatch(/holds text="ctrl", expected "normal"/);
  }, 120_000);
  test("CONTROL 01: a false story write reads red while ordinary navigation passes", async () => {
    const script = byNumber("01");
    expect((await runBlocksGolden(script, hooks())).failures).toEqual([]);
    vi.useRealTimers();
    const altered = mutate(script, 3, { writes: [{ title: "$:/StoryList", list: ["lar:///t/link/alpha"] }] });
    const falseStory = await runBlocksGolden(altered, hooks());
    expect(falseStory.failures.join("\n")).toMatch(/\$:\/StoryList holds list=/);
  }, 120_000);
  test("CONTROL 06: a false select field reads red while the chosen option passes", async () => {
    const script = byNumber("06");
    expect((await runBlocksGolden(script, hooks())).failures).toEqual([]);
    vi.useRealTimers();
    const altered = mutate(script, 12, { writes: [{ title: "lar:///t/toggle/rec", size: "s" }] });
    const falseSelect = await runBlocksGolden(altered, hooks());
    expect(falseSelect.failures.join("\n")).toMatch(/holds size="l", expected "s"/);
  }, 120_000);
  test("CONTROL 11: a false delete reads red while the lawful confirm passes", async () => {
    const script = byNumber("11");
    expect((await runBlocksGolden(script, hooks())).failures).toEqual([]);
    vi.useRealTimers();
    const falseDelete = await runBlocksGolden(mutate(script, script.steps.length - 1, { writes: [{ title: "lar:///t/confirm/x", tombstone: true }] }), hooks());
    expect(falseDelete.failures.join("\n")).toMatch(/lar:\/\/\/t\/confirm\/x still stands/);
  }, 120_000);
  test("CONTROL: an unknown affordance fails closed while the named button resolves", async () => {
    const script = byNumber("02");
    const lawful = await runBlocksGolden(script, hooks());
    expect(lawful.failures).toEqual([]);
    vi.useRealTimers();
    const altered: GoldenScript = { ...script, steps: script.steps.map((step, index) => index === 1 ? { act: { ...(step["act"] as object), control: "button.absent" } } : step) };
    const unknown = await runBlocksGolden(altered, hooks());
    expect(unknown.failures.join("\n")).toMatch(/unknown affordance button.absent/);
    expect(unknown.refusals).toContainEqual({ step: 2, refused: "unknown-affordance" });
  }, 120_000);
});
