import type { TW5Tiddler, TW5TiddlerFields, TW5Wiki } from "../../../packages/lararium-tw5/src/types/tiddlywiki.d.ts";

export type TestLarariumFields = TW5TiddlerFields & Record<string, string>;

export interface TestLararium extends Pick<TW5Wiki, "getTiddler" | "filterTiddlers" | "addTiddler" | "deleteTiddler"> {
  field(title: string, field: string): string | undefined;
  has(title: string): boolean;
}

const DEFAULT_BAG = "__default__";
const PREFERRED_BAGS = ["lar:///ha.ka.ba/@lares", "lar:///ha.ka.ba/@scratch", DEFAULT_BAG];

export function createTestLararium(seed: Record<string, TestLarariumFields>): TestLararium {
  const store = new Map<string, Map<string, TestLarariumFields>>();

  for (const [title, fields] of Object.entries(seed)) {
    const bag = fields["bag"] ?? DEFAULT_BAG;
    store.set(title, new Map([[bag, { ...fields }]]));
  }

  const visibleFields = (title: string): TestLarariumFields | undefined => {
    const copies = store.get(title);
    if (!copies || copies.size === 0) return undefined;
    for (const bag of PREFERRED_BAGS) {
      const fields = copies.get(bag);
      if (fields) return fields;
    }
    return copies.values().next().value;
  };

  return {
    getTiddler(title: string): TW5Tiddler | undefined {
      const fields = visibleFields(title);
      return fields ? toTestTiddler(fields) : undefined;
    },

    filterTiddlers(filter: string): string[] {
      const prefixMatch = /^\[prefix\[(.*)\]\]$/.exec(filter);
      if (prefixMatch) {
        const prefix = prefixMatch[1] ?? "";
        return [...store.keys()].filter((title) => title.startsWith(prefix) && visibleFields(title)).sort();
      }

      const pathMatch = /^\[title\[([^\]]+)\](.*)\]$/.exec(filter);
      if (pathMatch) {
        const title = pathMatch[1] ?? "";
        const pathFilter = pathMatch[2] ?? "";
        if (pathFilter === "lar-bag-path[lares]") {
          return [title.replace("lar:///ha.ka.ba/", "") + ".md"].map((value) => value.replace(/#(.*)\.md$/, "/$1.md"));
        }
        return [];
      }

      return [];
    },

    addTiddler(tiddler: TW5Tiddler | TW5TiddlerFields | Record<string, unknown>): void {
      const fields = extractFields(tiddler);
      const title = String(fields["title"] ?? "");
      const bag = typeof fields["bag"] === "string" ? fields["bag"] : DEFAULT_BAG;
      if (!title) return;
      const copies = store.get(title) ?? new Map<string, TestLarariumFields>();
      copies.set(bag, normalizeFields(fields));
      store.set(title, copies);
    },

    deleteTiddler(title: string): void {
      const copies = store.get(title);
      if (!copies) return;
      if (copies.has("lar:///ha.ka.ba/@scratch")) {
        copies.delete("lar:///ha.ka.ba/@scratch");
      } else if (copies.has(DEFAULT_BAG)) {
        copies.delete(DEFAULT_BAG);
      } else {
        const first = copies.keys().next();
        if (!first.done) copies.delete(first.value);
      }
      if (copies.size === 0) store.delete(title);
    },

    field(title: string, field: string): string | undefined {
      return visibleFields(title)?.[field];
    },

    has(title: string): boolean {
      return visibleFields(title) !== undefined;
    },
  };
}

function toTestTiddler(fields: TestLarariumFields): TW5Tiddler {
  return {
    fields: { ...fields },
    cache: {},
    hasField: (field) => field in fields,
    isEqual: () => false,
    getFieldString: (field, defaultValue = "") => {
      const value = fields[field];
      return value == null ? defaultValue : String(value);
    },
    getFieldList: (field) => {
      const value = fields[field];
      return Array.isArray(value) ? value.map((entry) => String(entry)) : value == null ? [] : [String(value)];
    },
    getFieldStrings: () => ({ ...fields }),
    getFieldStringBlock: () => "",
    getFieldDay: () => 0,
    hasTag: (tag) => {
      const tags = fields["tags"];
      return Array.isArray(tags) ? tags.includes(tag) : tags === tag;
    },
    isPlugin: () => false,
    isDraft: () => false,
  };
}

function extractFields(tiddler: TW5Tiddler | TW5TiddlerFields | Record<string, unknown>): Record<string, unknown> {
  if ("fields" in tiddler && tiddler.fields && typeof tiddler.fields === "object") {
    return tiddler.fields as Record<string, unknown>;
  }
  return tiddler as Record<string, unknown>;
}

function normalizeFields(fields: Record<string, unknown>): TestLarariumFields {
  const title = String(fields["title"] ?? "");
  const normalized: TestLarariumFields = { title };
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    normalized[key] = Array.isArray(value) ? value.map((entry) => String(entry)).join(" ") : String(value);
  }
  return normalized;
}