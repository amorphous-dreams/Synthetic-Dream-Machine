/**
 * worker-handle-exit — a node island's handle says when its worker exits (clock-sweep step 3).
 *
 * The daemon VM's asks wait on the island's answer; a worker that exits answers nothing further, and the handle's
 * `onExit` names that exit so every waiting ask refuses at once, never at a clock.
 */
import { Worker } from "node:worker_threads";
import { expect, test } from "vitest";
import { nodeWorkerHandle } from "../src/worker-handle.js";

test("RED (clock-sweep): a worker that exits fires the handle's onExit with its exit code", async () => {
  const handle = nodeWorkerHandle(new Worker("process.exit(3)", { eval: true }), { island: "session" });
  const why = await new Promise<string>((resolve) => { handle.onExit!(resolve); });
  expect(why).toMatch(/exited \(code 3\)/);
}, 10_000);

test("CONTROL: an unsubscribed listener hears no exit; the handle's terminate still ends the worker", async () => {
  const handle = nodeWorkerHandle(new Worker("setInterval(() => {}, 1 << 30)", { eval: true }), { island: "session" });
  const heard: string[] = [];
  const off = handle.onExit!((why) => heard.push(why));
  off();
  const exited = new Promise<string>((resolve) => { handle.onExit!(resolve); });
  handle.terminate();
  expect(await exited).toMatch(/exited/);
  expect(heard).toEqual([]);
}, 10_000);
