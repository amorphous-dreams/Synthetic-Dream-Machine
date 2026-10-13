/**
 * keyhive-trace-flag — `--keyhive-trace` asks for Keyhive's tracing by name, and nothing else does.
 *
 * Keyhive's trace prints every step of its own work around an act's one answer, so it stays off unless a
 * person asks: this flag, or `LAR_KEYHIVE_TRACE=1` in the environment. The flag sets that environment
 * toggle in the CLI's own process before any command runs; the provider reads it when it stands
 * (`packages/lararium-keyhive/tests/keyhive-trace-stays-off.test.ts` holds the provider's half).
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { GLOBAL_FLAGS, KEYHIVE_TRACE_ENV, askKeyhiveTrace, dispatch } from "../src/bin/lares.js";

describe("the flag asks by name", () => {
  const prior = process.env[KEYHIVE_TRACE_ENV];
  afterEach(() => {
    if (prior === undefined) delete process.env[KEYHIVE_TRACE_ENV]; else process.env[KEYHIVE_TRACE_ENV] = prior;
    vi.restoreAllMocks();
  });

  test("the flag sets the toggle; its absence sets nothing", () => {
    const env: Record<string, string | undefined> = {};
    expect(askKeyhiveTrace({ "keyhive-trace": true }, env)).toBe(true);
    expect(env).toEqual({ [KEYHIVE_TRACE_ENV]: "1" });
    for (const flags of [{}, { "keyhive-trace": false }, { "keyhive-trace": "1" }, { json: true }]) {
      const none: Record<string, string | undefined> = {};
      expect(askKeyhiveTrace(flags, none)).toBe(false);
      expect(none).toEqual({});
    }
  });

  test("every command reads the flag: it stands among the global flags", () => {
    expect(GLOBAL_FLAGS).toContain("keyhive-trace");
  });

  test("the name the CLI sets equals the name the provider reads", () => {
    const provider = readFileSync(new URL("../../lararium-keyhive/src/keyhive-provider.ts", import.meta.url), "utf8");
    const named = /export const KEYHIVE_TRACE_ENV = "([^"]+)";/.exec(provider)?.[1];
    expect(named).toBe(KEYHIVE_TRACE_ENV);
  });

  test("`lares help` states the flag and the environment toggle; a run without the flag leaves the toggle unset", async () => {
    delete process.env[KEYHIVE_TRACE_ENV];
    const said: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { said.push(a.map(String).join(" ")); });
    expect(await dispatch(["help"])).toBe(0);
    const help = said.join("\n");
    expect(help).toContain("--keyhive-trace");
    expect(help).toContain(`${KEYHIVE_TRACE_ENV}=1`);
    expect(process.env[KEYHIVE_TRACE_ENV]).toBeUndefined();
  });

  test("a run with the flag sets the toggle in this process before the command answers", async () => {
    delete process.env[KEYHIVE_TRACE_ENV];
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await dispatch(["help", "--keyhive-trace"])).toBe(0);
    expect(process.env[KEYHIVE_TRACE_ENV]).toBe("1");
  });
});
