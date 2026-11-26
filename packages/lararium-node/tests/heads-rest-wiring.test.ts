/**
 * heads-rest-wiring — the base pins what sealed, through the production wiring end to end: an island thread's own heads door
 * (`islandHeadsAsker`, over `parentPort`), the worker handle's answer (`attachHeadsAsk`, through `nodeWorkerHandle`), and the
 * vessel's reading off a real Repo's handle table (`repoHeadsRestAt`), keyed as an `AutomergeDocStore` names its document.
 * A document id the two sides spell apart would read `waiting` forever and fail closed in silence; this reads it whole.
 *
 * The island runs the BUILT module (`dist/heads-rest.js`), as a vessel's island thread runs it.
 *
 *   W1  an island asks its vessel for heads its Repo holds and its sealed rest keeps none waiting: `rested`; heads it lacks: `waiting`
 *   W2  the vessel's save-book word (`rest:rested`) reaches the island thread's listeners
 *   W3  a vessel whose record stands no `restsAt` answers `unread`, never `rested`
 */
import { Worker } from "node:worker_threads";
import { afterEach, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge";
import type { CapabilityRecord } from "@lararium/mesh/capability-record";
import { nodeWorkerHandle } from "../src/worker-handle.js";
import { repoHeadsRestAt } from "../src/heads-rest.js";

const BUILT = new URL("../dist/heads-rest.js", import.meta.url).href;

/** An island thread that asks once per `ask` message it hears, and reports each reading and each rested word it hears. */
const ISLAND = `
const { parentPort } = require("node:worker_threads");
import(${JSON.stringify(BUILT)}).then(({ islandHeadsAsker }) => {
  const heads = islandHeadsAsker();
  heads.rested((documentId) => parentPort.postMessage({ type: "test:rested", documentId }));
  parentPort.on("message", (m) => {
    if (m && m.type === "test:ask") heads.rests(m.documentId, m.heads).then((reading) => parentPort.postMessage({ type: "test:reading", id: m.id, reading }));
  });
  parentPort.postMessage({ type: "test:ready" });
});
`;

const workers: Array<{ terminate(): void }> = [];
afterEach(() => { for (const w of workers.splice(0)) w.terminate(); });

async function standIsland(caps: CapabilityRecord) {
  const handle = nodeWorkerHandle(new Worker(ISLAND, { eval: true }), { island: "wiki", caps });
  workers.push(handle);
  const heard: Array<Record<string, unknown>> = [];
  const waiters: Array<() => void> = [];
  handle.listen((raw) => { const m = raw as Record<string, unknown>; if (typeof m?.type === "string" && m.type.startsWith("test:")) { heard.push(m); for (const w of waiters.splice(0)) w(); } });
  const next = (pick: (m: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> => new Promise((resolve) => {
    const look = (): void => { const hit = heard.find(pick); if (hit) { heard.splice(heard.indexOf(hit), 1); resolve(hit); } else waiters.push(look); };
    look();
  });
  await next((m) => m.type === "test:ready");
  let seq = 0;
  const ask = async (documentId: string, heads: readonly string[]): Promise<unknown> => {
    const id = ++seq;
    handle.post({ type: "test:ask", id, documentId, heads: [...heads] });
    return (await next((m) => m.type === "test:reading" && m.id === id)).reading;
  };
  return { handle, ask, next };
}

test("W1 an island asks through the production door and reads the vessel's Repo by the document id a store names", async () => {
  const repo = new Repo({ network: [] });
  const doc = repo.create<{ note?: string }>();
  doc.change((d) => { d.note = "a heron stands"; });
  const heads = A.getHeads(doc.doc());
  const waiting = new Map<string, number>();
  const island = await standIsland({ restsAt: repoHeadsRestAt(repo as never, (id) => waiting.get(id) ?? 0) });
  // The id an AutomergeDocStore names (`handle.documentId`) reaches the vessel's handle table whole.
  expect(await island.ask(doc.documentId, heads)).toBe("rested");
  expect(await island.ask(doc.documentId, ["0".repeat(64)])).toBe("waiting");
  waiting.set(doc.documentId, 1);
  expect(await island.ask(doc.documentId, heads)).toBe("waiting");
  await repo.shutdown();
}, 20_000);

test("W2 the vessel's save-book word reaches the island thread's listeners", async () => {
  const listeners = new Set<(documentId: string) => void>();
  const island = await standIsland({ rested: (l) => { listeners.add(l); return () => listeners.delete(l); } });
  for (const l of listeners) l("doc-rested");
  expect(await island.next((m) => m.type === "test:rested")).toEqual({ type: "test:rested", documentId: "doc-rested" });
}, 20_000);

test("W3 a vessel whose record stands no restsAt answers unread, never rested", async () => {
  const island = await standIsland({});
  expect(await island.ask("doc-any", ["h1"])).toBe("unread");
}, 20_000);
