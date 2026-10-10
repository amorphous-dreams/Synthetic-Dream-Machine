/**
 * THE KUPONO LAW: THE GENESIS ACTOR SEED FOLDS ONLY WHAT EVERY LARARIUM SHARES AND BOOTS ALIKE. That means
 * the engine core, the plugin blobs the bake packs and the attestation it reads, each labelled by its path
 * within the tree, never on the machine. Nothing per-operator or per-place folds: an edited working copy
 * under `bags/`, a draft, or a stray file standing on one machine alone leaves the seed (and so `seedCid`)
 * where it stood. Controls: each universal input still moves it, and one tree baked from two locations
 * bakes one seed.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveGenesisActorSeed, genesisPackedPluginFiles } from "../src/genesis-actor-seed.js";

const made: string[] = [];
afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });

function plantTree(): string {
  const root = mkdtempSync(join(tmpdir(), "actor-seed-a-"));
  made.push(root);
  mkdirSync(join(root, "bags", "lares", "doc"), { recursive: true });
  mkdirSync(join(root, "tw5-core"), { recursive: true });
  mkdirSync(join(root, "plugins", "standalone"), { recursive: true });
  mkdirSync(join(root, "dist-plugin"), { recursive: true });
  writeFileSync(join(root, "bags", "lares", "doc", "one.mem"), "title: one\n\nbody one\n");
  writeFileSync(join(root, "bags", "lares", "two.mem"), "title: two\n\nbody two\n");
  writeFileSync(join(root, "tw5-core", "core.js"), "/* core */\n");
  writeFileSync(join(root, "plugins", "grammar.json"), "{\"title\":\"g\"}\n");
  writeFileSync(join(root, "plugins", "shadows.json"), "[{\"title\":\"s\"}]\n");
  writeFileSync(join(root, "plugins", "standalone", "grammar.attestation.json"), "{\"format\":\"copy\"}\n");
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
    corePath:         join(root, "tw5-core", "core.js"),
    pluginsRoot:      join(root, "plugins"),
    attestationPaths: [join(root, "dist-plugin", "grammar.attestation.json")],
  });
}

describe("★ the genesis actor seed folds only what every Lararium shares (kupono) ★", () => {
  test("an edited working copy under bags/ leaves the seed unchanged", () => {
    const a = plantTree();
    const before = seedOf(a);
    writeFileSync(join(a, "bags", "lares", "two.mem"), "title: two\n\nbody twO\n");
    expect(seedOf(a)).toBe(before);
  });

  test("a file standing on one machine alone never moves it: a stray draft, a nested json, a stray attestation", () => {
    const a = plantTree();
    const before = seedOf(a);
    writeFileSync(join(a, "bags", "lares", "doc", "stray-draft.mem"), "title: stray\n\nonly here\n");
    writeFileSync(join(a, "plugins", "standalone", "local-only.json"), "{\"title\":\"local\"}\n");
    writeFileSync(join(a, "dist-plugin", "stray.attestation.json"), "{\"format\":\"stray\"}\n");
    expect(seedOf(a)).toBe(before);
  });

  test("the packed set reads the top of the plugins directory alone", () => {
    const a = plantTree();
    expect(genesisPackedPluginFiles(join(a, "plugins")).map((f) => f.slice(a.length + 1)))
      .toEqual(["plugins/grammar.json", "plugins/shadows.json"]);
  });

  test("CONTROL: the same tree at two checkout locations bakes the identical seed", () => {
    const a = plantTree();
    const b = copyTree(a);
    expect(a).not.toBe(b);
    expect(seedOf(b)).toBe(seedOf(a));
  });

  test("CONTROL: the core's bytes move the seed", () => {
    const a = plantTree();
    const before = seedOf(a);
    writeFileSync(join(a, "tw5-core", "core.js"), "/* core, advanced */\n");
    expect(seedOf(a)).not.toBe(before);
  });

  test("CONTROL: one changed packed-plugin byte moves the seed", () => {
    const a = plantTree();
    const before = seedOf(a);
    writeFileSync(join(a, "plugins", "shadows.json"), "[{\"title\":\"S\"}]\n");
    expect(seedOf(a)).not.toBe(before);
  });

  test("CONTROL: one changed attestation byte moves the seed", () => {
    const a = plantTree();
    const before = seedOf(a);
    writeFileSync(join(a, "dist-plugin", "grammar.attestation.json"), "{\"format\":\"y\"}\n");
    expect(seedOf(a)).not.toBe(before);
  });

  test("CONTROL: a renamed packed plugin moves the seed (the label still names the file)", () => {
    const a = plantTree();
    const before = seedOf(a);
    rmSync(join(a, "plugins", "grammar.json"));
    writeFileSync(join(a, "plugins", "grammar-renamed.json"), "{\"title\":\"g\"}\n");
    expect(seedOf(a)).not.toBe(before);
  });
});
