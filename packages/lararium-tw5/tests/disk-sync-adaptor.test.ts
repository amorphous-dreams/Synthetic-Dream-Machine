import { describe, test, expect, afterEach } from "@jest/globals";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { LarDiskProjector } from "../src/disk-sync-adaptor.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { splitCarrierToTiddlers } from "../src/carrier-split.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("LarDiskProjector", () => {
  test("coalesces sibling ahu child edits without dropping earlier slot writes", async () => {
    const root = mkdtempSync(join(tmpdir(), "lar-disk-projector-"));
    tempRoots.push(root);
    mkdirSync(join(root, "lararium-node"), { recursive: true });

    const parentUri = "lar:///lararium-node/test-carrier";
    const filePath = join(root, "lararium-node", "test-carrier.md");
    writeFileSync(filePath, [
      "<<~\u0001 ? -> lar:///lararium-node/test-carrier >>",
      "<<~\u0002>>",
      "",
      "<<~ ahu #one >>",
      "one-old",
      "<<~/ahu >>",
      "",
      "<<~ ahu #two >>",
      "two-old",
      "<<~/ahu >>",
      "",
      "<<~\u0004 -> ? >>",
      "",
    ].join("\n"), "utf-8");

    const store = new MemoryTiddlerStore();
    const projector = new LarDiskProjector(root, 20);
    const stop = projector.start(store);

    await store.put(
      { title: `${parentUri}#one`, fields: { "ahu-slot": "#one", "ahu-parent": parentUri }, text: "one-new" },
      { kind: "tw-local", instanceId: "test" },
    );
    await store.put(
      { title: `${parentUri}#two`, fields: { "ahu-slot": "#two", "ahu-parent": parentUri }, text: "two-new" },
      { kind: "tw-local", instanceId: "test" },
    );

    await delay(80);
    stop();

    const written = readFileSync(filePath, "utf-8");
    expect(written).toContain("one-new");
    expect(written).toContain("two-new");
    expect(written).not.toContain("one-old");
    expect(written).not.toContain("two-old");
  });

  test("preserves stripped child TOML prefix during slot write-back", async () => {
    const root = mkdtempSync(join(tmpdir(), "lar-disk-projector-"));
    tempRoots.push(root);
    mkdirSync(join(root, "lararium-node"), { recursive: true });

    const parentUri = "lar:///lararium-node/toml-child";
    const filePath = join(root, "lararium-node", "toml-child.md");
    const carrier = [
      "<<~\u0001 ? -> lar:///lararium-node/toml-child >>",
      "<<~\u0002>>",
      "",
      "<<~ ahu #panel >>",
      "```toml",
      "type = \"text/vnd.tiddlywiki\"",
      "```",
      "original body",
      "<<~/ahu >>",
      "",
      "<<~\u0004 -> ? >>",
      "",
    ].join("\n");
    writeFileSync(filePath, carrier, "utf-8");

    const split = splitCarrierToTiddlers(parentUri, carrier);
    const child = split.children.find((c) => c.title === `${parentUri}#panel`)!;
    expect(child.text).toBe("original body\n");
    expect(child.fields["ahu-body-prefix"]).toBe("```toml\ntype = \"text/vnd.tiddlywiki\"\n```\n");

    const store = new MemoryTiddlerStore();
    const projector = new LarDiskProjector(root, 20);
    const stop = projector.start(store);
    await store.put(
      { title: child.title, fields: child.fields as Record<string, string>, text: "edited body" },
      { kind: "tw-local", instanceId: "test" },
    );

    await delay(80);
    stop();

    const written = readFileSync(filePath, "utf-8");
    expect(written).toContain("```toml\ntype = \"text/vnd.tiddlywiki\"\n```\nedited body");
    expect(written).not.toContain("original body");
  });
});
