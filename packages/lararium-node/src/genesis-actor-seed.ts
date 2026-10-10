/**
 * genesis-actor-seed — the genesis bake's deterministic actor seed.
 *
 * actorSeed = sha256hex over the walked inputs: the TW5 core bytes, every `.mem` under the bags root,
 * every vendored plugin `.json`, and every plugin build attestation. Each file folds under a label that
 * names it, so a renamed or moved carrier moves the seed.
 *
 * THE LABEL NAMES THE FILE WITHIN THE TREE, NEVER ON THE MACHINE. A label reads the path RELATIVE to the
 * tree root, spelled with `/`, so one commit bakes one seed from any checkout location or platform. An
 * absolute label made the seed a reading of where the bake ran, and two clones of the same commit
 * disagreed on the seed — and so on `seedCid`, the name a herm serves.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep }                   from "node:path";
import { sha256HexBytesSync, utf8Bytes }         from "@lararium/mesh";

export interface ActorSeedInputs {
  /** The tree root every label reads relative to (the repo). */
  readonly root:          string;
  /** The vendored TW5 core blob. Folds by bytes alone; absent folds nothing. */
  readonly corePath:      string;
  /** The bags root walked for `.mem` carriers. */
  readonly bagsRoot:      string;
  /** The vendored plugin directory walked for `.json` blobs. */
  readonly pluginsRoot:   string;
  /** The plugin build output walked for `.attestation.json` files. */
  readonly distPluginDir: string;
}

function walkFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walkFiles(full, ext));
      else if (entry.name.endsWith(ext)) results.push(full);
    }
  } catch { /* absent — skip */ }
  return results.sort();
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out   = new Uint8Array(total);
  let offset  = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

/** A file's label: its path within the tree, `/`-separated on every platform. */
function treeLabel(root: string, file: string): string {
  return relative(root, file).split(sep).join("/");
}

export function deriveGenesisActorSeed(inputs: ActorSeedInputs): string {
  const { root, corePath, bagsRoot, pluginsRoot, distPluginDir } = inputs;
  const chunks: Uint8Array[] = [];

  if (existsSync(corePath)) {
    chunks.push(utf8Bytes("tw5-core:"));
    chunks.push(new Uint8Array(readFileSync(corePath)));
  }

  for (const f of walkFiles(bagsRoot, ".mem")) {
    chunks.push(utf8Bytes(`meme:${treeLabel(root, f)}:`));
    chunks.push(new Uint8Array(readFileSync(f)));
  }

  for (const f of walkFiles(pluginsRoot, ".json")) {
    chunks.push(utf8Bytes(`plugin:${treeLabel(root, f)}:`));
    chunks.push(new Uint8Array(readFileSync(f)));
  }

  for (const f of walkFiles(distPluginDir, ".attestation.json")) {
    chunks.push(utf8Bytes(`attestation:${treeLabel(root, f)}:`));
    chunks.push(new Uint8Array(readFileSync(f)));
  }

  return sha256HexBytesSync(concatBytes(chunks));
}
