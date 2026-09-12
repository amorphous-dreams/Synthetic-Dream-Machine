/**
 * SOCKET FIRST. `lares vessel stand` against a daemon that already answers ATTACHES and reports — the
 * reading half of the door — and a reading never earns a rebuild. The freshness gate asks the socket
 * before it asks the tree: a daemon that answers means nothing here founds or boots, so the build step
 * never runs (measured: the gate fired on an attach, `pnpm -r build` re-emitted every dist under the
 * running daemon). On a MISS the tree is asked as before, and a stale tree still builds and re-execs.
 * The probes and the build ride as injected deps so this witness fakes the socket, never a daemon.
 */
import { describe, test, expect } from "vitest";
import { freshBuildGate } from "../src/build-freshness.js";
import type { ParsedArgs } from "../src/parse-args.js";

const args = (flags: Record<string, boolean>, positional: string[] = []): ParsedArgs =>
  ({ command: "vessel", positional, flags, options: {} } as unknown as ParsedArgs);

function deps(alive: boolean, stale: boolean) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      alive: async () => { calls.push("alive"); return alive; },
      stale: () => { calls.push("stale"); return stale; },
      build: () => { calls.push("build"); return 0; },
      reexec: () => { calls.push("reexec"); return 0; },
    },
  };
}

describe("★ the gate reads the socket before the tree ★", () => {
  test("a reachable socket: `stand` attaches in-process and the build step never runs, however stale the tree", async () => {
    const d = deps(true, true);
    expect(await freshBuildGate(["vessel", "stand"], args({}, ["stand"]), d.deps)).toBeNull();
    expect(d.calls).toEqual(["alive"]);
  });

  test("CONTROL: a MISS keeps the gate — a stale tree builds and re-execs; a fresh tree runs in-process", async () => {
    const miss = deps(false, true);
    expect(await freshBuildGate(["vessel", "stand"], args({}, ["stand"]), miss.deps)).toBe(0);
    expect(miss.calls).toEqual(["alive", "stale", "build", "reexec"]);
    const fresh = deps(false, false);
    expect(await freshBuildGate(["vessel", "stand"], args({}, ["stand"]), fresh.deps)).toBeNull();
    expect(fresh.calls).toEqual(["alive", "stale"]);
  });

  test("CONTROL: a restart, and every verb that founds or boots regardless of what answers, never asks the socket", async () => {
    for (const [flags, sub] of [[{ restart: true }, "stand"], [{}, "found"], [{}, "clear"], [{}, "bake"]] as const) {
      const d = deps(true, true);
      expect(await freshBuildGate(["vessel", sub], args({ ...flags }, [sub]), d.deps)).toBe(0);
      expect(d.calls, sub).toEqual(["stale", "build", "reexec"]);
    }
  });
});
