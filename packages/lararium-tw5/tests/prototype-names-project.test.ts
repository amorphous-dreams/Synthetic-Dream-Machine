/**
 * prototype-names-project — a tiddler titled `constructor` or `prototype` projects to disk and reads back.
 *
 * The narrowed key law (operator ruling 2026-11-02; mesh `prototype-names-stand.test.ts`) lets both words
 * stand as titles and field names. This suite walks the last leg the mesh suite cannot: the record the
 * store holds lands in the wiki, the disk projector's ONE render shore (`exportCarrierFile`) renders its
 * carrier file, and the wiki's own deserializer reads that file back to the same fields, byte for byte.
 */
import { describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { AutomergeDocStore, emptyLarDoc, type LarDoc, type Repo as RepoType } from "@lararium/mesh";
import { exportCarrierFile } from "../src/meme-write.js";
import { makeTw5Deserializer } from "../src/action-handler.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

/** The Repo mesh holds: tw5 names no CRDT dependency of its own. */
const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;
const sorted = (o: Record<string, unknown>): string => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1))));

describe.skipIf(wikiSkip).each(["constructor", "prototype"])(`RED: a tiddler titled \`%s\` projects and reads back${skipNote}`, (title) => {
  test("store → wiki → carrier file → deserializer: the same fields", async () => {
    const fields = { title, text: `the ${title} body`, constructor: "a field named constructor", prototype: "a field named prototype" };
    const repo = new Repo({ network: [] });
    try {
      const store = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()));
      await store.put({ tiddler: fields as never }, { kind: "lares-verb", requestId: "narrow" });
      const held = (await store.get(title))!;
      expect(sorted(held.tiddler as Record<string, unknown>)).toBe(sorted(fields));

      const engine = await bootTestWiki();
      engine.setTiddler(held.tiddler as Record<string, string>);
      const file = exportCarrierFile(engine, title);
      expect(file, "the render shore answers a carrier file").not.toBeNull();
      expect(file!.body).toContain("a field named constructor");

      const back = makeTw5Deserializer(engine).deserialize(file!.ext, file!.body, {});
      const read = back.find((t) => t["title"] === title);
      expect(read).toBeDefined();
      const projected = Object.fromEntries(Object.entries(read!).filter(([k]) => Object.hasOwn(fields, k)));
      expect(sorted(projected)).toBe(sorted(fields));
    } finally {
      await repo.shutdown();
    }
  });
});
