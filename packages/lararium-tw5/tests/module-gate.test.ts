import { describe, test, expect, vi } from "vitest";
import * as fc from "fast-check";
import { createHash } from "crypto";
import { bootTrustedModules } from "../src/tw5-module-gate.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { stack } from "../src/filters/stack.js";
import type { TW5FilterOperator, TW5FilterSource } from "../src/types/tiddlywiki.js";

const MODULE_COMPONENT = "lar:///ha.ka.ba/lararium/tw5/tw5-module";
type Fields = Record<string, unknown>;

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Minimal TW5 stand-in: real stack filter, fake plumbing. */
function fakeTw(initial: Record<string, Fields>) {
  const tiddlers = new Map<string, Fields>(Object.entries(initial));
  const defined: string[] = [];

  const source: TW5FilterSource = (iter) => {
    for (const [title, fields] of tiddlers) {
      iter({ fields } as never, title);
    }
  };

  const wiki = {
    filterTiddlers: (expr: string): string[] => {
      const m = /^\[all\[tiddlers\]stack:has\[(.+)\]\]$/.exec(expr);
      if (!m) throw new Error(`fake wiki cannot run: ${expr}`);
      const op: TW5FilterOperator = { operator: "stack", suffix: "has", operand: m[1]! };
      return stack(source, op);
    },
    getTiddler: (title: string) => {
      const fields = tiddlers.get(title);
      return fields ? ({ fields } as never) : undefined;
    },
    addTiddler: (t: { fields?: Fields } & Fields) => {
      const fields = (t as { fields?: Fields }).fields ?? t;
      tiddlers.set(String(fields["title"]), fields);
    },
  };

  const tw = {
    wiki,
    Tiddler: class {
      fields: Fields;
      constructor(fields: Fields) { this.fields = fields; }
    },
    // TW5's own signature: define(name, moduleType, definition).
    modules: { define: (name: string, type: string, definition: string) => { defined.push(`${type}:${name}:${definition}`); } },
  };

  return { tw: tw as never, tiddlers, defined, titles: Object.keys(initial) };
}

const title = "lar:///ha.ka.ba/bags/test/modules/probe";
const body = "exports.probe = 1;";
function moduleMeme(overrides: Fields = {}): Fields {
  return { title, type: CARRIER_TYPE, tags: [MODULE_COMPONENT], "module-type": "library",
    "source-sha256": `sha256:${sha256(body)}`, text: body, ...overrides };
}
async function run(fields: Fields, grant: ReadonlySet<string>, preloaded = new Set([title])) {
  const fake = fakeTw({ [title]: fields });
  await bootTrustedModules(fake.tw, preloaded, new Map([...grant].map(t => [t, fields])));
  return fake;
}

describe("local module grants", () => {
  test("admits captured granted bytes when the live title holds a replacement", async () => {
    const replacement = "exports.probe = 2;";
    const fake = fakeTw({ [title]: moduleMeme({ text: replacement, "source-sha256": `sha256:${sha256(replacement)}` }) });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await bootTrustedModules(fake.tw, new Set([title]), new Map([[title, moduleMeme()]]));
      expect(fake.defined).toEqual([`library:${title}:${body}`]);
      expect(warn).toHaveBeenCalledExactlyOnceWith(`[module-gate] ignored a replacement at ${title}: only the granted bytes admit`);
    } finally { warn.mockRestore(); }
  });
  test.each([{ text: "" }, { "source-sha256": `sha256:${sha256("other")}` }])("refuses an invalid captured body despite a valid live record", async overrides => {
    const fake = fakeTw({ [title]: moduleMeme() });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await bootTrustedModules(fake.tw, new Set([title]), new Map([[title, moduleMeme(overrides)]]));
      expect(fake.defined).toEqual([]);
    } finally { warn.mockRestore(); }
  });
  test("refuses without a grant and warns once per title", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await run(moduleMeme(), new Set());
      expect(result.defined).toEqual([]);
      expect(result.tiddlers.get(title)?.["type"]).toBe(CARRIER_TYPE);
      expect(warn).toHaveBeenCalledExactlyOnceWith(`[module-gate] refused ${title}: no local grant (promote it by hand)`);
    } finally { warn.mockRestore(); }
  });
  test("admits a granted library", async () => {
    const result = await run(moduleMeme(), new Set([title]));
    expect(result.defined).toEqual([`library:${title}:${body}`]);
    expect(result.tiddlers.get(title)?.["type"]).toBe("application/javascript");
  });
  test("refuses another title and a non-preloaded title", async () => {
    expect((await run(moduleMeme(), new Set([title + "-other"]))).defined).toEqual([]);
    expect((await run(moduleMeme(), new Set([title]), new Set())).defined).toEqual([]);
  });
  test.each([
    ["modified body", { text: body + " " }],
    ["wrong hash", { "source-sha256": `sha256:${sha256("other")}` }],
    ["missing body", { text: "" }],
    ["unworn", { tags: [] }],
  ])("refuses %s despite a grant", async (_name, overrides) => {
    expect((await run(moduleMeme(overrides), new Set([title]))).defined).toEqual([]);
  });
  test.each(["startup", "widget"])("refuses %s by name", async type => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect((await run(moduleMeme({ "module-type": type }), new Set([title]))).defined).toEqual([]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`refused ${title}: module-type ${type}`));
    } finally { warn.mockRestore(); }
  });
  test("arbitrary extra fields never affect grant admission", async () => {
    const structural = new Set(["title", "text", "type", "module-type", "source-sha256", "tags", "stack"]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await fc.assert(fc.asyncProperty(fc.dictionary(fc.string().filter(k => !structural.has(k)), fc.string()), async fields => {
        expect((await run(moduleMeme(fields), new Set())).defined).toEqual([]);
        expect((await run(moduleMeme(fields), new Set([title]))).defined).toEqual([`library:${title}:${body}`]);
      }));
    } finally { warn.mockRestore(); }
  });
});

vi.mock("../src/tw5-host-bridge.js", () => ({
  normalizeCoreBootBlob: () => undefined,
  verifyCoreBootBlob: () => {},
  prepareHostBootInstance: async () => ({ instance: {}, isBrowser: false }),
  bootWithHostBridge: async (_instance: unknown, _browser: boolean, ready: () => Promise<void>) => ready(),
}));

describe("a walk that dies half-way", () => {
  test("RED: a throw on the 2nd of 3 granted modules admits exactly the 1st and names the fault with its title", async () => {
    const titles = [1, 2, 3].map((n) => `lar:///ha.ka.ba/bags/test/modules/walk-${n}`);
    const fake = fakeTw(Object.fromEntries(titles.map((t) => [t, moduleMeme({ title: t })])));
    const define = fake.tw.modules.define.bind(fake.tw.modules);
    fake.tw.modules.define = ((name: string, type: string, text: string) => {
      if (name === titles[1]) throw new Error("define exploded");
      return define(name, type, text);
    }) as never;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await bootTrustedModules(fake.tw, new Set(titles), new Map(titles.map(t => [t, moduleMeme({ title: t })])));
      expect(fake.defined.map((d) => d.split(":")[0] + ":" + d.split(":").slice(1).join(":").split(":exports")[0])).toEqual([`library:${titles[0]}`]);
      const said = warn.mock.calls.map((c) => c.join(" ")).filter((m) => m.includes("[module-gate]") && m.includes("walk stopped"));
      expect(said, "the half-admitted set stayed invisible").toHaveLength(1);
      expect(said[0]).toContain(titles[1]);
      expect(said[0]).toContain("define exploded");
    } finally { warn.mockRestore(); }
  });
});

describe("TW5Engine grant mapping", () => {
  test("maps only matching string-valued preload digests to titles", async () => {
    const { promoteDigest } = await import("../../lararium-mesh/src/promote.js");
    const gate = await import("../src/tw5-module-gate.js");
    const { TW5Engine } = await import("../src/tw5-vm.js");
    const spy = vi.spyOn(gate, "bootTrustedModules").mockResolvedValue();
    const entry = { title, text: body, extra: "value" };
    const other = { title: title + "-other", text: body, extra: "value" };
    const digest = promoteDigest({ title, text: body, fields: { extra: "value" } });
    try {
      await new TW5Engine().boot(undefined, [entry, other, { title: title + "-nonstring", text: body, extra: ["value"] }], undefined,
        { grantedDigests: new Set([digest]) });
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.any(Set), new Map([[title, entry]]));
      await new TW5Engine().boot(undefined, [entry, { ...entry, text: "replacement" }], undefined, { grantedDigests: new Set([digest]) });
      expect(spy).toHaveBeenLastCalledWith(expect.anything(), expect.any(Set), new Map());
      await new TW5Engine().boot(undefined, [entry], undefined, { grantedDigests: new Set(["other-digest"]) });
      expect(spy).toHaveBeenLastCalledWith(expect.anything(), expect.any(Set), new Map());
      await new TW5Engine().boot(undefined, [entry]);
      expect(spy).toHaveBeenLastCalledWith(expect.anything(), expect.any(Set), new Map());
    } finally { spy.mockRestore(); }
  });
});
