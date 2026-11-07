/**
 * in-page-island-teardown — the holder's in-page island comes down on the island's own answer (clock-sweep step 3).
 *
 * The holder runs its island in the SharedWorker's own thread over a MessageChannel. Its `terminate` asks the island to
 * tear down and finishes (the island's stop hooks, both ports closed) on `teardown:ack`, or on the island's fault by
 * name, never on a clock.
 */
import { expect, test } from "vitest";
import { inPageIsland } from "../src/shared-holder-start.js";
import type { BrowserIslandScope } from "../src/browser-sovereign-island-model.js";

function island(answer: "ack" | "fault") {
  let stopped!: () => void;
  const stoppedP = new Promise<void>((resolve) => { stopped = resolve; });
  const handle = inPageIsland((scope: BrowserIslandScope) => {
    scope.onStop?.(() => stopped());
    scope.listen((raw) => {
      if ((raw as { type?: string })?.type !== "teardown") return;
      scope.post(answer === "ack" ? { type: "teardown:ack" } : { type: "fault", wikiUri: "lar:///ha.ka.ba/wikis/daemon", error: "teardown-fault: the adaptor would not stop" });
    });
  });
  return { handle, stopped: stoppedP };
}

test("RED (clock-sweep): an island whose teardown answers a fault comes down at once, never at a clock", async () => {
  const { handle, stopped } = island("fault");
  handle.terminate();
  await stopped;
}, 3_000);

test("CONTROL: an island whose teardown acks comes down", async () => {
  const { handle, stopped } = island("ack");
  handle.terminate();
  await stopped;
}, 3_000);
