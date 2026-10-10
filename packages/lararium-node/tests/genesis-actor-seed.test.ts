/**
 * ONE COMMIT BAKES ONE SEED, WHEREVER IT IS CHECKED OUT. The genesis actor seed folds every walked input
 * under a label naming the file; the label reads the path within the tree, never on the machine. The same
 * tree baked from two locations yields the identical seed (and so the identical `seedCid`); a changed
 * carrier byte still moves it (control: the instrument reads content, not nothing).
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveGenesisActorSeed } from "../src/genesis-actor-seed.js";

const made: string[] = [];
afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });

function plantTree(): string {
  const root = mkdtempSync(join(tmpdir(), "actor-seed-a-"));
  made.push(root);
  mkdirSync(join(root, "bags", "lares", "doc"), { recursive: true });
  mkdirSync(join(root, "tw5-core"), { recursive: true });
  mkdirSync(join(root, "plugins"), { recursive: true });
  mkdirSync(join(root, "dist-plugin"), { recursive: true });
  writeFileSync(join(root, "bags", "lares", "doc", "one.mem"), "title: one\n\nbody one\n");
  writeFileSync(join(root, "bags", "lares", "two.mem"), "title: two\n\nbody two\n");
  writeFileSync(join(root, "tw5-core", "core.js"), "/* core */\n");
  writeFileSync(join(root, "plugins", "grammar.json"), "{\"title\":\"g\"}\n");
  writeFileSync(join(root, "dist-plugin", "grammar.attestation.json"), "{\"format\":\"x\"}\n");
  return root;
}

function copyTree(src: string): string {
  const dest = mkdtempSync(join(tmpdir(), "actor-seed-b-elsewhere-"));
  made.push(dest);
  cpSync(src, dest, { recursive: true });
  return dest;
}

function seedOf(root: string): string {
  return deriveGenesisActorSeed({
    root,
    corePath:      join(root, "tw5-core", "core.js"),
    bagsRoot:      join(root, "bags"),
    pluginsRoot:   join(root, "plugins"),
    distPluginDir: join(root, "dist-plugin"),
  });
}

describe("★ the genesis actor seed reads the tree, never the machine ★", () => {
  test("the same tree at two checkout locations bakes the identical seed", () => {
    const a = plantTree();
    const b = copyTree(a);
    expect(a).not.toBe(b);
    expect(seedOf(b)).toBe(seedOf(a));
  });

  test("CONTROL: one changed carrier byte moves the seed", () => {
    const a = plantTree();
    const before = seedOf(a);
    writeFileSync(join(a, "bags", "lares", "two.mem"), "title: two\n\nbody twO\n");
    expect(seedOf(a)).not.toBe(before);
  });

  test("CONTROL: a moved carrier moves the seed (the label still names the file)", () => {
    const a = plantTree();
    const before = seedOf(a);
    rmSync(join(a, "bags", "lares", "two.mem"));
    writeFileSync(join(a, "bags", "lares", "doc", "two.mem"), "title: two\n\nbody two\n");
    expect(seedOf(a)).not.toBe(before);
  });

  test("CONTROL: the core's bytes move the seed", () => {
    const a = plantTree();
    const before = seedOf(a);
    writeFileSync(join(a, "tw5-core", "core.js"), "/* core, advanced */\n");
    expect(seedOf(a)).not.toBe(before);
  });
});
