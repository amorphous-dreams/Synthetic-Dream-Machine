/**
 * module-gate-genesis-only — the module gate reads the preloaded set alone (genesis plugins and the device's promoted
 * rites), never the composite wiki a lifted stage item joins after boot.
 * Meme: lar:///ha.ka.ba/lararium/tw5/tw5-module-gate
 */
import { describe, expect, test } from "vitest";
import { createHash } from "crypto";
import { bootTrustedModules } from "../src/tw5-module-gate.js";
import { stack } from "../src/filters/stack.js";
import type { TW5FilterOperator, TW5FilterSource } from "../src/types/tiddlywiki.js";

const MODULE_COMPONENT = "lar:///ha.ka.ba/lararium/tw5/tw5-module";
type Fields = Record<string, unknown>;
const body = "exports.probe = 1;";
const meme = (title: string): Fields => ({
  title, tags: [MODULE_COMPONENT], "module-type": "library",
  "source-sha256": `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`, text: body,
});

function fakeTw(initial: Record<string, Fields>) {
  const tiddlers = new Map<string, Fields>(Object.entries(initial));
  const defined: string[] = [];
  const source: TW5FilterSource = (iter) => { for (const [title, fields] of tiddlers) iter({ fields } as never, title); };
  const wiki = {
    filterTiddlers: (expr: string): string[] => {
      const m = /^\[all\[tiddlers\]stack:has\[(.+)\]\]$/.exec(expr);
      if (!m) throw new Error(`fake wiki cannot run: ${expr}`);
      return stack(source, { operator: "stack", suffix: "has", operand: m[1]! } as TW5FilterOperator);
    },
    getTiddler: (title: string) => { const fields = tiddlers.get(title); return fields ? ({ fields } as never) : undefined; },
    addTiddler: (t: { fields?: Fields } & Fields) => { const f = t.fields ?? t; tiddlers.set(String(f["title"]), f); },
  };
  const tw = { wiki, Tiddler: class { fields: Fields; constructor(f: Fields) { this.fields = f; } }, modules: { define: (n: string, t: string) => { defined.push(`${t}:${n}`); } } };
  return { tw: tw as never, defined };
}

describe("bootTrustedModules reads the preloaded set alone", () => {
  test("RED: a module-gate tiddler outside the preloaded titles never defines; CONTROL: the same tiddler inside the preloaded titles defines", async () => {
    const composite = "lar:///ha.ka.ba/bags/kahua/lifted-module";
    const genesis = "lar:///ha.ka.ba/bags/test/genesis-module";
    const { tw, defined } = fakeTw({ [composite]: meme(composite), [genesis]: meme(genesis) });
    await bootTrustedModules(tw, new Set([genesis]), new Set([genesis]));
    expect(defined).toEqual([`library:${genesis}`]);
  });

  test("RED: an empty preloaded set defines nothing", async () => {
    const t = "lar:///ha.ka.ba/bags/test/m";
    const { tw, defined } = fakeTw({ [t]: meme(t) });
    await bootTrustedModules(tw, new Set(), new Set([t]));
    expect(defined).toEqual([]);
  });
});
