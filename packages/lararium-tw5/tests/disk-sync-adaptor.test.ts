import { describe, test, expect, afterEach } from "@jest/globals";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { LarDiskProjector } from "../src/disk-sync-adaptor.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Shared test helper — build a renderFn that returns pre-canned outputs keyed
// by parentUri.  Simulates the TW5 VM render path without requiring a live VM.
// ---------------------------------------------------------------------------

function makeRenderFn(
  outputs: Map<string, () => string>,
): (uri: string) => Promise<string | null> {
  return async (uri) => {
    const fn = outputs.get(uri);
    return fn ? fn() : null;
  };
}

describe("LarDiskProjector", () => {
  test("calls renderFn and writes output on store change", async () => {
    const root = mkdtempSync(join(tmpdir(), "lar-disk-projector-"));
    tempRoots.push(root);
    mkdirSync(join(root, "lararium-node"), { recursive: true });

    const parentUri = "lar:///lararium-node/test-carrier";
    const filePath  = join(root, "lararium-node", "test-carrier.md");

    let renderCount = 0;
    const outputs = new Map([
      [parentUri, () => { renderCount++; return "rendered-body"; }],
    ]);

    const store     = new MemoryTiddlerStore();
    const projector = new LarDiskProjector(root, makeRenderFn(outputs), 20);
    const stop      = projector.start(store);

    const origin = { kind: "tw-local" as const, instanceId: "test" };
    await store.put({ title: parentUri, fields: {}, text: "ignored" }, origin);

    await delay(80);
    stop();

    const written = readFileSync(filePath, "utf-8");
    expect(written).toBe("rendered-body");
    expect(renderCount).toBe(1);
  });

  test("debounces rapid sibling slot writes into one render call", async () => {
    const root = mkdtempSync(join(tmpdir(), "lar-disk-projector-"));
    tempRoots.push(root);
    mkdirSync(join(root, "lararium-node"), { recursive: true });

    const parentUri = "lar:///lararium-node/test-carrier";
    const filePath  = join(root, "lararium-node", "test-carrier.md");

    let renderCallCount = 0;
    const outputs = new Map([
      [parentUri, () => { renderCallCount++; return "one-new\ntwo-new"; }],
    ]);

    const store     = new MemoryTiddlerStore();
    const projector = new LarDiskProjector(root, makeRenderFn(outputs), 20);
    const stop      = projector.start(store);

    const origin = { kind: "tw-local" as const, instanceId: "test" };
    // Two rapid slot-child writes — should coalesce to one render.
    await store.put(
      { title: `${parentUri}#one`, fields: { "ahu-slot": "#one", "ahu-parent": parentUri }, text: "one-new" },
      origin,
    );
    await store.put(
      { title: `${parentUri}#two`, fields: { "ahu-slot": "#two", "ahu-parent": parentUri }, text: "two-new" },
      origin,
    );

    await delay(80);
    stop();

    const written = readFileSync(filePath, "utf-8");
    expect(written).toContain("one-new");
    expect(written).toContain("two-new");
    // Debounce collapses the two writes into one renderFn call.
    expect(renderCallCount).toBe(1);
  });

  test("skips write when renderFn returns null", async () => {
    const root = mkdtempSync(join(tmpdir(), "lar-disk-projector-"));
    tempRoots.push(root);
    mkdirSync(join(root, "lararium-node"), { recursive: true });

    const parentUri = "lar:///lararium-node/no-render";
    const filePath  = join(root, "lararium-node", "no-render.md");

    const nullRender = makeRenderFn(new Map()); // returns null for every URI

    const store     = new MemoryTiddlerStore();
    const projector = new LarDiskProjector(root, nullRender, 20);
    const stop      = projector.start(store);

    const origin = { kind: "tw-local" as const, instanceId: "test" };
    await store.put({ title: parentUri, fields: {}, text: "ignored" }, origin);

    await delay(80);
    stop();

    // File should NOT be written when renderFn returns null.
    expect(() => readFileSync(filePath, "utf-8")).toThrow();
  });

  test("writing Set is cleared after flush completes", async () => {
    const root = mkdtempSync(join(tmpdir(), "lar-disk-projector-"));
    tempRoots.push(root);
    mkdirSync(join(root, "lararium-node"), { recursive: true });

    const parentUri = "lar:///lararium-node/writing-guard";
    const filePath  = join(root, "lararium-node", "writing-guard.md");

    const projector = new LarDiskProjector(root, async () => "body", 20);
    const store     = new MemoryTiddlerStore();
    const stop      = projector.start(store);

    const origin = { kind: "tw-local" as const, instanceId: "test" };
    await store.put({ title: parentUri, fields: {}, text: "x" }, origin);

    await delay(80);
    stop();

    readFileSync(filePath, "utf-8"); // confirm written
    // writing Set is cleared after the disk write completes (not during renderFn).
    expect(projector.writing.has(parentUri)).toBe(false);
  });
});
