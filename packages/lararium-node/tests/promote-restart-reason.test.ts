/**
 * An ordinary promote verb (commit, drop, orphan decision) restarts the daemon island under a ROUTINE reason; the kapae emergency alone
 * carries the brake. A refused prepare under a routine reason leaves the standing island running; under the emergency reason it closes it.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { KAPAE_EMERGENCY_REASON, PROMOTE_RESTART_REASON } from "@lararium/tw5";
import { standDaemonIsland } from "../src/daemon-island-reopen.js";

describe("promote restarts", () => {
  test("the routine reason is not the emergency reason", () => {
    expect(PROMOTE_RESTART_REASON).not.toBe(KAPAE_EMERGENCY_REASON);
  });

  test("RED: the deferred verb reload restarts under the routine reason; CONTROL: the kapae restart keeps the emergency reason", () => {
    const source = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
    const deferred = source.slice(source.indexOf("const restartDaemonDeferred"), source.indexOf("const restartWikiIsland"));
    expect(deferred).toContain("restartDaemonNow(PROMOTE_RESTART_REASON)");
    expect(deferred).not.toContain("KAPAE_EMERGENCY_REASON");
    const wiki = source.slice(source.indexOf("const restartWikiIsland"), source.indexOf("const reloadWikiAfterVerb"));
    expect(wiki).toContain("restartDaemonNow()");
    expect(source).toContain("restartDaemonNow = async (reason: string = KAPAE_EMERGENCY_REASON)");
  });

  test("a refused prepare: the routine reason leaves the island standing; the emergency reason closes it (fail closed)", async () => {
    let closed = 0; let refuse = false;
    const core = (): never => ({ close: () => { closed++; }, shutdown: async () => { closed++; } } as never);
    const holder = await standDaemonIsland({
      resolvePlugins: async () => refuse ? { ok: false, error: "cas missing" } : { ok: true, pluginCids: [] },
      readJoinedFaces: async () => [],
      open: async () => core(),
    });
    refuse = true;
    await expect(holder.restart(PROMOTE_RESTART_REASON)).rejects.toThrow();
    const afterRoutine = closed;
    await expect(holder.restart(KAPAE_EMERGENCY_REASON)).rejects.toThrow();
    expect(afterRoutine, "the routine refusal closed nothing").toBe(0);
    expect(closed, "the emergency refusal closed the island").toBeGreaterThan(0);
  });
});
