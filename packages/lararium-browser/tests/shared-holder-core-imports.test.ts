/**
 * The holder core loads inside a SharedWorker whose first greeting a tab waits for (five seconds), so the core
 * reaches the mesh through narrow subpaths only: the bare `@lararium/mesh` barrel pulls the whole mesh (automerge and
 * every codec) into the worker before it can greet, and a loaded CI machine reads the holder as absent.
 */
import { describe, expect, test } from "vitest";
import coreSource from "../src/shared-holder-core.ts?raw";
import doorSource from "../src/shared-holder.ts?raw";

const importsOf = (source: string): string[] =>
  [...source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";?/gms)].map((m) => m[1]!);

describe("the holder core's reach into the mesh stays narrow", () => {
  test("shared-holder-core imports no mesh barrel", () => {
    expect(importsOf(coreSource).filter((from) => from === "@lararium/mesh")).toEqual([]);
  });

  test("CONTROL: the scan reads the core's imports, and the tab-side door may use the barrel", () => {
    expect(importsOf(coreSource)).toContain("./holder-routes.js");
    expect(importsOf(doorSource).length).toBeGreaterThan(0);
  });
});
