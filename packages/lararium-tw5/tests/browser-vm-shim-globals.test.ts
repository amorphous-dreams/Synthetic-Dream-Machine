import { afterEach, describe, expect, test, vi } from "vitest";
import { bootGenesisWiki, genesisNote, genesisSkip } from "./genesis-boot.harness.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const globals = globalThis as Record<string, unknown>;
const names = ["workerExistingName", "workerExistingHandler", "leakedByModule"];
let engine: TW5Engine | undefined;
afterEach(() => {
  engine?.dispose();
  engine = undefined;
  for (const name of names) delete globals[name];
  vi.restoreAllMocks();
});

describe.skipIf(genesisSkip)(`browser VM module global detection${genesisNote}`, () => {
  test.each([
    ["clean module", "exports.ok = true;", []],
    ["new global", "globalThis.leakedByModule = 1;", ["leakedByModule"]],
  ])("%s reports only globals added during execution", async (_label, code, expected) => {
    Object.defineProperty(globals, names[0]!, { value: "worker", enumerable: true, configurable: true });
    Object.defineProperty(globals, names[1]!, { value: () => {}, enumerable: true, configurable: true });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    engine = await bootGenesisWiki({ path: "browser-worker" });
    log.mockClear();
    const tw = engine.$tw as unknown as { utils: { evalSandboxed: (code: string, context: object, filename: string) => unknown } };
    tw.utils.evalSandboxed(code, { exports: {} }, "global-probe.js");
    const warnings = log.mock.calls.filter((args) => String(args[0]).includes("Global assignment detected"));
    expect(warnings.map((args) => args[1])).toEqual(expected.length ? [expected] : []);
  }, 120_000);
});
