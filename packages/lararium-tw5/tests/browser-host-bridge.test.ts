/**
 * Browser Worker host-bridge boundary.
 *
 * The island runtime is TW5's third runtime, but the boot bridge must still know that its
 * module evaluator is browser-hosted. Otherwise it lends the Node require shim to widget modules,
 * and a normal `$:/core/modules/widgets/widget.js` lookup is misread as a Node builtin request.
 */
import { describe, expect, test } from "vitest";
import { bootWithHostBridge, escapeCssIdentifier, LENT_WINDOW_NAMES, makeProjectedViewContract, makeScopedWindowLend, prepareHostBootInstance } from "../src/tw5-host-bridge.js";

const fixtureCore = new TextEncoder().encode(
  'exports.TiddlyWiki = () => ({ boot: {}, utils: {} });',
);

describe("prepareHostBootInstance — browser Worker bridge boundary", () => {
  test("projected navigator events receive a named confirm refusal without a global window", () => {
    const globals = globalThis as Record<string, unknown>;
    const priorWindow = globals["window"];
    if (priorWindow === undefined) delete globals["window"];
    const refusals: Array<[string, string]> = [];
    const view = makeProjectedViewContract((capability, message) => refusals.push([capability, message]));
    expect(typeof view.confirm).toBe("function");
    expect(globals["window"]).toBeUndefined();
    expect(view.confirm("overwrite" )).toBe(false);
    expect(refusals).toEqual([["view.confirm", "overwrite"]]);
    if (priorWindow !== undefined) globals["window"] = priorWindow;
  });

  test("core evaluation admits only the one window.sjcl initialization write and restores the descriptor", async () => {
    const globals = globalThis as Record<string, unknown>;
    const prior = Object.getOwnPropertyDescriptor(globals, "window");
    const core = new TextEncoder().encode(
      'window.sjcl = { ready: true }; exports.TiddlyWiki = () => ({ boot: {}, utils: {} });',
    );
    try {
      const result = await prepareHostBootInstance({ bytes: core });
      expect(result.instance).toBeDefined();
      expect(Object.getOwnPropertyDescriptor(globals, "window")).toEqual(prior);
    } finally {
      if (prior) Object.defineProperty(globals, "window", prior);
      else delete globals["window"];
    }
  });

  test("the window lend takes the engine's two names and refuses every other mutation by name", () => {
    const globals = globalThis as Record<string, unknown>;
    const priorSjcl = Object.getOwnPropertyDescriptor(globals, "sjcl");
    const priorTw = Object.getOwnPropertyDescriptor(globals, "$tw");
    let firstSjclWrites = 0;
    const lend = makeScopedWindowLend(() => { firstSjclWrites += 1; });
    try {
      expect([...LENT_WINDOW_NAMES].sort()).toEqual(["$tw", "sjcl"]);
      // A write of any other property refuses by name and leaves the worker global untouched.
      expect(() => { lend["larProbe"] = 1; }).toThrow(/CapabilityRefused: window\.larProbe \(write\)/);
      expect("larProbe" in globals).toBe(false);
      expect(() => Object.defineProperty(lend, "larProbe", { value: 1 })).toThrow(/CapabilityRefused: window\.larProbe \(define\)/);
      expect(() => Object.defineProperty(lend, "sjcl", { value: 1 })).toThrow(/CapabilityRefused: window\.sjcl \(define\)/);
      expect(() => { delete lend["sjcl"]; }).toThrow(/CapabilityRefused: window\.sjcl \(delete\)/);
      expect(firstSjclWrites).toBe(0);
      // CONTROL: the admitted names land on the global. The engine writes sjcl twice (the crypto module body,
      // then the bundle's loader); both land, and the first-write notice fires once.
      const crypto = { ready: true };
      lend["sjcl"] = crypto;
      lend["sjcl"] = crypto;
      expect(globals["sjcl"]).toBe(crypto);
      expect(firstSjclWrites).toBe(1);
      const instance = { boot: {} };
      lend["$tw"] = instance;
      expect(globals["$tw"]).toBe(instance);
      expect(firstSjclWrites).toBe(1);
      // A write of another property AFTER the admitted writes refuses as it did before them.
      expect(() => { lend["larSecond"] = 2; }).toThrow(/CapabilityRefused: window\.larSecond \(write\)/);
      expect("larSecond" in globals).toBe(false);
      // Reads pass through: the bundle probes what the worker global already holds.
      expect(lend["Uint32Array"]).toBe(Uint32Array);
    } finally {
      if (priorSjcl) Object.defineProperty(globals, "sjcl", priorSjcl); else delete globals["sjcl"];
      if (priorTw) Object.defineProperty(globals, "$tw", priorTw); else delete globals["$tw"];
    }
  });

  test("a core blob that writes a second window property fails its evaluation by name and leaves no window behind", async () => {
    const globals = globalThis as Record<string, unknown>;
    const prior = Object.getOwnPropertyDescriptor(globals, "window");
    const priorSjcl = Object.getOwnPropertyDescriptor(globals, "sjcl");
    const core = new TextEncoder().encode(
      'window.sjcl = { ready: true }; window.larSecond = 1; exports.TiddlyWiki = () => ({ boot: {}, utils: {} });',
    );
    try {
      await expect(prepareHostBootInstance({ bytes: core })).rejects.toThrow(/CapabilityRefused: window\.larSecond \(write\)/);
      expect("larSecond" in globals).toBe(false);
      expect(Object.getOwnPropertyDescriptor(globals, "window")).toEqual(prior);
    } finally {
      if (prior) Object.defineProperty(globals, "window", prior);
      else delete globals["window"];
      if (priorSjcl) Object.defineProperty(globals, "sjcl", priorSjcl);
      else delete globals["sjcl"];
    }
  });

  test("CSS identifiers use the CSS.escape contract without a browser global", () => {
    expect(escapeCssIdentifier("GettingStarted")).toBe("GettingStarted");
    expect(escapeCssIdentifier("1 title")).toBe("\\31 \\ title");
    expect(escapeCssIdentifier("a#b")).toBe("a\\#b");
  });

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

  test("unknown browser host modules refuse by name without entering the TW5 module table", async () => {
    const globals = globalThis as Record<string, unknown>;
    const prior = globals["require"];
    let resolver!: (name: string) => unknown;
    let executed = false;
    const instance = {
      modules: { execute: () => { executed = true; return {}; } },
      boot: { boot: (done: () => void) => { resolver = globals["require"] as typeof resolver; done(); } },
    } as never;
    try {
      await bootWithHostBridge(instance, true, () => {});
      expect(() => resolver("../../unlisted-host-module")).toThrow(/capability refused.*unlisted-host-module/);
      expect(executed).toBe(false);
    } finally {
      if (prior === undefined) delete globals["require"];
      else globals["require"] = prior;
    }
  });
});
