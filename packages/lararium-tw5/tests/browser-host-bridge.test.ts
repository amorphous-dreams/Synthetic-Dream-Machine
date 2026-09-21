/**
 * Browser Worker host-bridge boundary.
 *
 * The island runtime is TW5's third runtime, but the boot bridge must still know that its
 * module evaluator is browser-hosted. Otherwise it lends the Node require shim to widget modules,
 * and a normal `$:/core/modules/widgets/widget.js` lookup is misread as a Node builtin request.
 */
import { describe, expect, test } from "vitest";
import { bootWithHostBridge, prepareHostBootInstance } from "../src/tw5-host-bridge.js";

const fixtureCore = new TextEncoder().encode(
  'exports.TiddlyWiki = () => ({ boot: {}, utils: {} });',
);

describe("prepareHostBootInstance — browser Worker bridge boundary", () => {
  test("browser Worker keeps the browser host-bridge branch for module evaluation", async () => {
    const globals = globalThis as Record<string, unknown>;
    const prior = globals["WorkerGlobalScope"];
    globals["WorkerGlobalScope"] = class WorkerGlobalScope {};
    try {
      const result = await prepareHostBootInstance({ bytes: fixtureCore });
      expect(result.isBrowser).toBe(true);
    } finally {
      if (prior === undefined) delete globals["WorkerGlobalScope"];
      else globals["WorkerGlobalScope"] = prior;
    }
  });

  test("CONTROL — without a Worker shore, Node keeps the Node bridge", async () => {
    const globals = globalThis as Record<string, unknown>;
    const prior = globals["WorkerGlobalScope"];
    delete globals["WorkerGlobalScope"];
    try {
      const result = await prepareHostBootInstance({ bytes: fixtureCore });
      expect(result.isBrowser).toBe(false);
    } finally {
      if (prior !== undefined) globals["WorkerGlobalScope"] = prior;
    }
  });

  test("CONTROL — forcing the Node branch still lends its require shim", async () => {
    const globals = globalThis as Record<string, unknown>;
    const prior = globals["require"];
    const nodeRequire = () => ({ node: true });
    let bootRequire: unknown;
    const instance = {
      __larariumRequireShim: nodeRequire,
      boot: { boot: (done: () => void) => {
        bootRequire = globals["require"];
        done();
      } },
    } as never;
    try {
      await bootWithHostBridge(instance, false, () => {});
      expect(bootRequire).toBe(nodeRequire);
    } finally {
      if (prior === undefined) delete globals["require"];
      else globals["require"] = prior;
    }
  });

  test("browser Worker modules resolve through the island TW5 table", async () => {
    const globals = globalThis as Record<string, unknown>;
    const prior = globals["require"];
    const resolved = { widget: class Widget {} };
    let seen: unknown;
    let bootRequire: unknown;
    const instance = {
      modules: { execute: (id: string) => { seen = id; return resolved; } },
      boot: { boot: (done: () => void) => {
        bootRequire = globals["require"];
        done();
      } },
    } as never;
    try {
      await bootWithHostBridge(instance, true, () => {
        expect(globals["require"]).toBeUndefined();
      });
      const requireFromIsland = bootRequire as (id: string) => unknown;
      expect(requireFromIsland("$:/core/modules/widgets/widget.js")).toBe(resolved);
      expect(seen).toBe("$:/core/modules/widgets/widget.js");
    } finally {
      if (prior === undefined) delete globals["require"];
      else globals["require"] = prior;
    }
  });
});
