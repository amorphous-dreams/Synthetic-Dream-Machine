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

test("A4: a late slot fault before the teardown ack finishes nothing; the ack still finishes it — CONTROL: the named teardown-fault above finishes it unacked", async () => {
  let stopped = false;
  let ack!: () => void;
  const handle = inPageIsland((scope: BrowserIslandScope) => {
    scope.onStop?.(() => { stopped = true; });
    scope.listen((raw) => {
      if ((raw as { type?: string })?.type !== "teardown") return;
      scope.post({ type: "fault", wikiUri: "lar:///ha.ka.ba/wikis/daemon", error: "slot working unavailable — the Repo refused the ask" });
      ack = () => scope.post({ type: "teardown:ack" });
    });
  });
  handle.terminate();
  for (let i = 0; i < 10 && !ack; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(stopped, "a slot fault never cuts the island mid-flush").toBe(false);
  ack();
  for (let i = 0; i < 20 && !stopped; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  expect(stopped).toBe(true);
}, 3_000);
