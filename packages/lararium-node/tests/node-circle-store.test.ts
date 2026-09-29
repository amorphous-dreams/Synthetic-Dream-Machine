import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HandleBook, mintPersonaGlamour, type LarDoc } from "@lararium/mesh";
import { loadNodeHandleBook, saveNodeHandleBook } from "../src/node-circle-store.js";
import { larIdentityDir } from "../src/vessel-paths.js";

const SEED = Uint8Array.from(Array.from({ length: 32 }, (_, i) => (i * 5 + 11) & 0xff));
const OWNER = "persona-" + "cd".repeat(32);
const saved: Record<string, string | undefined> = {};

function board(): { doc(): LarDoc; change(fn: (doc: LarDoc) => void): void } {
  const doc = { tiddlers: {} } as LarDoc;
  return { doc: () => doc, change: (fn) => fn(doc) };
}

describe("node HandleBook persistence crosses verified restore", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-circle-book-"));
    saved.LAR_ROOT = process.env.LAR_ROOT;
    process.env.LAR_ROOT = root;
  });
  afterEach(() => {
    if (saved.LAR_ROOT === undefined) delete process.env.LAR_ROOT;
    else process.env.LAR_ROOT = saved.LAR_ROOT;
    rmSync(root, { recursive: true, force: true });
  });

  test("tampered persisted closure is dropped before recognition", async () => {
    const card = (await mintPersonaGlamour({ board: board(), seed: SEED, handleIndex: 0, glamour: "A", store: {
      load: async () => null, save: async () => undefined, list: async () => [],
    }, ownerPersonaKelPrefix: OWNER })).card;
    const book = new HandleBook();
    expect((await book.ingest(card)).ok).toBe(true);
    saveNodeHandleBook(book);
    const snapshot = JSON.parse(readFileSync(join(larIdentityDir(), ".handle-book.json"), "utf8")) as ReturnType<HandleBook["snapshot"]>;
    const tampered = structuredClone(snapshot);
    (tampered.records[0]!.accepted[0] as { glamour: string }).glamour = "forged";
    writeFileSync(join(larIdentityDir(), ".handle-book.json"), JSON.stringify(tampered));
    const restored = await loadNodeHandleBook();
    expect(restored.nyms()).toEqual([]);
  });

  test("a valid persisted causal closure restores", async () => {
    const card = (await mintPersonaGlamour({ board: board(), seed: SEED, handleIndex: 1, glamour: "A", store: {
      load: async () => null, save: async () => undefined, list: async () => [],
    }, ownerPersonaKelPrefix: OWNER })).card;
    const book = new HandleBook();
    expect((await book.ingest(card)).ok).toBe(true);
    saveNodeHandleBook(book);
    const restored = await loadNodeHandleBook();
    expect(restored.nyms()).toEqual([card.nym]);
    expect(restored.isRecognized(card.nym)).toBe(true);
  });
});
