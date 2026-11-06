/**
 * THE SUBSTRATE SEAMS (browser-vessel-lift#/the-slices, slice 1): the vessel's module graph runs on a dedicated worker's thread
 * unchanged. The graph loads there, and its identity step founds, reloads the same key, and refuses a lost keystore by its
 * continuity row, all with no page global in reach.
 */
import { afterEach, describe, expect, test } from "vitest";
import { readyWorker } from "./fixtures/ready-worker.js";

type Reply = Record<string, unknown> & { op: string };

let worker: Worker | null = null;
afterEach(() => { worker?.terminate(); worker = null; });

function ask(w: Worker, msg: { op: string; idbName?: string }): Promise<Reply> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if ((event.data as Reply)?.op !== msg.op) return;
      w.removeEventListener("message", onMessage);
      resolve(event.data as Reply);
    };
    w.addEventListener("message", onMessage);
    w.postMessage(msg);
  });
}

function deleteIdb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

describe("the vessel graph on a worker's thread", () => {
  test("the graph loads with no page global in reach, and identity continuity founds, reloads and refuses a lost keystore", async () => {
    worker = await readyWorker(new URL("./fixtures/vessel-graph.worker.ts", import.meta.url));
    const globals = await ask(worker, { op: "globals" });
    // The setup took: the thread holds no page global, its `location` stands as a bare `href`, and the graph's entry stands.
    expect(globals["globals"]).toEqual({
      window: "undefined", document: "undefined", localStorage: "undefined", sessionStorage: "undefined",
      alert: "undefined", confirm: "undefined", prompt: "undefined",
    });
    expect(globals["location"]).toEqual(["href", "toString"]);
    expect(globals["opens"]).toBe("function");

    const idbName = `lares:test-worker-seams:${crypto.randomUUID()}`;
    try {
      const founded = await ask(worker, { op: "identity", idbName });
      expect(founded["refused"], "the identity founds on the worker's thread").toBeNull();
      expect(founded["verifyingKey"]).toMatch(/^[0-9a-f]{64}$/i);

      const reloaded = await ask(worker, { op: "identity", idbName });
      expect(reloaded["refused"]).toBeNull();
      expect(reloaded["verifyingKey"], "a reload loads the same key").toBe(founded["verifyingKey"]);

      // The keystore goes; the continuity row stands apart from it and refuses a blank re-found.
      await deleteIdb(idbName);
      const lost = await ask(worker, { op: "identity", idbName });
      expect(lost["verifyingKey"]).toBeNull();
      expect(String(lost["refused"])).toMatch(/continuity-lost/);
    } finally {
      await deleteIdb(idbName);
    }
  });
});

// The census over the package's source: no module the vessel worker would load names a page global. Comments strip first, so a
// docblock that names `document` to explain a seam reads as no reach.
const SOURCES = import.meta.glob<string>("../src/*.ts", { query: "?raw", import: "default", eager: true });
const PAGE_REACH = /\b(?:window|document|localStorage|sessionStorage)\s*[.[(]|\btypeof\s+(?:window|document|localStorage|sessionStorage)\b|["'](?:pagehide|visibilitychange)["']|\b(?:alert|prompt)\(/;
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

describe("the page-global census", () => {
  test("no browser vessel module reaches a page global", () => {
    const files = Object.keys(SOURCES);
    expect(files.length, "the census reads the package's source").toBeGreaterThan(40);
    // CONTROL: the strip leaves code standing, and the pattern bites a known reach.
    expect(stripComments(SOURCES["../src/open-browser-vessel.ts"]!).length).toBeGreaterThan(10_000);
    expect(PAGE_REACH.test(stripComments("const a = 1; // document.title\nconst b = localStorage.getItem('x');"))).toBe(true);
    expect(PAGE_REACH.test(stripComments("/* document.body */ const a = 1; // window.x"))).toBe(false);

    const reaches = files.flatMap((file) => stripComments(SOURCES[file]!).split("\n")
      .map((line, i) => ({ file: file.replace("../src/", ""), line: i + 1, text: line.trim() }))
      .filter(({ text }) => PAGE_REACH.test(text)));
    expect(reaches).toEqual([]);
  });
});
