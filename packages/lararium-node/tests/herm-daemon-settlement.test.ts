/**
 * THE HERM'S DAEMON SETTLES ITS RECEIPTS IN ONE ROUND (L29, the vessel-lift mirror). A herm composes no wiki pool; its one
 * island, the daemon, runs the sovereign kernel and answers receipts through the node daemon door. This file pins that
 * door on the herm's own call chain and drives it over a REAL worker thread: the island asks a receipt for an owed write,
 * says `receipt:asks-done`, and the door answers, then closes. A resting write answers issued; a write the vessel cannot
 * keep answers issued:false (the kernel then names its title unsaved, tw5 kernel-teardown-drain), and the close still comes.
 *
 * What stays unproven here: a whole herm boot (composeHerm over a scratch LAR_ROOT, http face and carriage standing) that
 * tears down with an owed write; this file stands the herm's daemon door, not the herm.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { nodeSpawnDaemonWorker } from "../src/worker-handle.js";
import type { CapabilityRecord, VesselWorkerHandle } from "@lararium/mesh";

const src = (file: string): string => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

// The island side: one owed write's receipt ask, then asks-done; it reports what it heard and leaves on the close.
const ISLAND = `
import { parentPort } from "node:worker_threads";
const heard = [];
parentPort.on("message", (msg) => {
  heard.push(msg.type === "receipt:issued" ? "issued:" + String(msg.issued) : msg.type);
  if (msg.type === "receipt:issued") parentPort.postMessage({ type: "receipt:asks-done" });
  if (msg.type === "receipt:close") { parentPort.postMessage({ type: "island:heard", heard }); parentPort.close(); }
});
parentPort.postMessage({ type: "receipt:request", requestId: "owed-1", documentIds: ["doc-owed"] });
`;

const dirs: string[] = [];
const handles: VesselWorkerHandle[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.terminate();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function island(caps: CapabilityRecord): Promise<string[]> {
  const dir = mkdtempSync(join(tmpdir(), "herm-settle-"));
  dirs.push(dir);
  const file = join(dir, "island.mjs");
  writeFileSync(file, ISLAND);
  const handle = nodeSpawnDaemonWorker(pathToFileURL(file), caps);
  handles.push(handle);
  return new Promise((resolve, reject) => {
    handle.onError(reject);
    handle.listen((msg) => { const m = msg as { type?: string; heard?: string[] }; if (m.type === "island:heard") resolve(m.heard ?? []); });
  });
}

describe("the herm's daemon door settles the receipt round", () => {
  test("PIN: the herm's daemon reaches the node daemon door (composeHerm -> daemonCap -> openDaemonVm -> nodeSpawnDaemonWorker -> attachReceipt)", () => {
    const herm = src("node-caps.ts");
    expect(herm.slice(herm.indexOf("export async function composeHerm"))).toMatch(/daemonCap\(d\)/);
    expect(src("open-node-vessel.ts")).toMatch(/openDaemonVm\(\{/);
    expect(src("open-daemon-vm.ts")).toMatch(/spawnWorker:\s*\(url\) => nodeSpawnDaemonWorker\(url, caps/);
    const door = src("worker-handle.ts");
    expect(door.slice(door.indexOf("export function nodeWorkerHandle"))).toMatch(/opts\.island === "daemon"[\s\S]*attachReceipt\(w, caps\)/);
  });

  test("a resting write answers issued, then asks-done brings the close", async () => {
    const rested: string[][] = [];
    expect(await island({ receipt: async (ids) => { rested.push([...ids]); } })).toEqual(["issued:true", "receipt:close"]);
    expect(rested).toEqual([["doc-owed"]]);
  }, 30_000);

  test("CONTROL: a write the vessel cannot keep answers issued:false, and the close still comes", async () => {
    expect(await island({ receipt: async () => { throw new Error("the vessel's store refused"); } })).toEqual(["issued:false", "receipt:close"]);
  }, 30_000);
});
