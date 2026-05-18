import { describe, expect, test } from "vitest";
import { planPromoteUris } from "../src/modules/lar-promote.js";

type Fields = Record<string, string>;

class FakeTiddler {
  fields: Fields;

  constructor(...parts: Array<{ fields?: Fields } | Fields>) {
    const merged: Fields = {};
    for (const part of parts) {
      const fields = "fields" in part ? part.fields ?? {} : part;
      Object.assign(merged, fields);
    }
    this.fields = merged;
  }
}

class FakeWiki {
  private readonly store = new Map<string, Map<string, Fields>>();

  constructor(seed: Record<string, Fields>) {
    for (const [title, fields] of Object.entries(seed)) {
      const bag = fields["bag"] ?? "__default__";
      this.store.set(title, new Map([[bag, { ...fields }]]));
    }
  }

  getTiddler(title: string): { fields: Fields } | undefined {
    const fields = this.visibleFields(title);
    return fields ? { fields: { ...fields } } : undefined;
  }

  filterTiddlers(filter: string): string[] {
    const prefixMatch = /^\[prefix\[(.*)\]\]$/.exec(filter);
    if (prefixMatch) {
      const prefix = prefixMatch[1] ?? "";
      return [...this.store.keys()].filter((title) => title.startsWith(prefix) && this.visibleFields(title)).sort();
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
  }

  addTiddler(tiddler: { fields: Fields }): void {
    const title = tiddler.fields["title"];
    const bag = tiddler.fields["bag"] ?? "__default__";
    const copies = this.store.get(title) ?? new Map<string, Fields>();
    copies.set(bag, { ...tiddler.fields });
    this.store.set(title, copies);
  }

  deleteTiddler(title: string): void {
    const copies = this.store.get(title);
    if (!copies) return;
    if (copies.has("lar:///ha.ka.ba/@scratch")) {
      copies.delete("lar:///ha.ka.ba/@scratch");
    } else if (copies.has("__default__")) {
      copies.delete("__default__");
    } else {
      const first = copies.keys().next();
      if (!first.done) copies.delete(first.value);
    }
    if (copies.size === 0) this.store.delete(title);
  }

  field(title: string, field: string): string | undefined {
    return this.visibleFields(title)?.[field];
  }

  has(title: string): boolean {
    return this.visibleFields(title) !== undefined;
  }

  private visibleFields(title: string): Fields | undefined {
    const copies = this.store.get(title);
    if (!copies || copies.size === 0) return undefined;
    const preferredBags = ["lar:///ha.ka.ba/@lares", "lar:///ha.ka.ba/@scratch", "__default__"];
    for (const bag of preferredBags) {
      const fields = copies.get(bag);
      if (fields) return fields;
    }
    return copies.values().next().value;
  }
}

describe("lar-promote", () => {
  test("promotes root and fragment children through the TW5 wiki surface", () => {
    const rootUri = "lar:///ha.ka.ba/docs/lares/the-lares-protocols";
    const childUri = `${rootUri}#house-law`;
    const wiki = new FakeWiki({
      "lar:///ha.ka.ba/@lares": {
        title: "lar:///ha.ka.ba/@lares",
        "path-filter": "lar-bag-path[lares]",
        "mirror-root": "bags/@lares",
      },
      [rootUri]: {
        title: rootUri,
        bag: "lar:///ha.ka.ba/@lararium/wikis/scratch",
        text: "root",
      },
      [childUri]: {
        title: childUri,
        bag: "lar:///ha.ka.ba/@lararium/wikis/scratch",
        text: "child",
      },
    });

    const result = planPromoteUris(wiki, [rootUri], "lar:///ha.ka.ba/@lares");

    expect(result.error).toBeUndefined();
    expect(result.promoted).toEqual([rootUri, childUri]);
    expect(result.childrenPromoted).toEqual([childUri]);
    expect(result.promotedTo).toBe("lar:///ha.ka.ba/@lares");
    expect(result.tombstones).toEqual([rootUri, childUri]);
    expect(result.copies.map((copy) => copy.title)).toEqual([rootUri, childUri]);
    expect(result.copies[0]?.fields["bag"]).toBe("lar:///ha.ka.ba/@lares");
    expect(result.copies[1]?.fields["bag"]).toBe("lar:///ha.ka.ba/@lares");
    expect(result.copies[0]?.fields["file-path"]).toBe("bags/@lares/docs/lares/the-lares-protocols.md");
    expect(result.copies[1]?.fields["file-path"]).toBe("bags/@lares/docs/lares/the-lares-protocols/house-law.md");
  });
});