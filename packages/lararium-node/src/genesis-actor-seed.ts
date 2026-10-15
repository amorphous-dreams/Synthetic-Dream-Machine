/**
 * genesis-actor-seed — the genesis bake's deterministic actor seed.
 *
 * THE KUPONO LAW: the actor seed folds ONLY what every Lararium shares and boots alike. That means the TW5
 * engine core, the vendored plugin blobs the bake packs (every one of them boots in every vessel's
 * islands), and the plugin build attestation the bake reads. It folds nothing per-operator or per-place:
 * no working copy under `bags/`, no draft, no local state, and no stray file that stands on one machine
 * alone. The descriptor and recipe tiddlers the seed also carries come from the mesh builder's code, not
 * from files, so they fold through the code that mints them.
 *
 * WHY. The `.mem` carriers under `bags/` are the operator's working copies of what becomes public or
 * crossroads material, and genesis carries none of them. A seed that folded them tied the genesis actor,
 * and so `seedCid`, to every draft edit on one machine. That is a name every Lararium reads, moving on
 * one operator's private act.
 *
 * ONE READER OF THE PACKED SET. `genesisPackedPluginFiles` names the plugin blobs the bake packs, and the
 * bake's own collector reads the same function. The seed and the bake cannot drift apart: a file the
 * bake would not pack never reaches the seed, and a file it packs always does.
 *
 * THE LABEL NAMES THE FILE WITHIN THE TREE, NEVER ON THE MACHINE. A label reads the path RELATIVE to the
 * tree root, spelled with `/`, so one commit bakes one seed from any checkout location or platform.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep }                   from "node:path";
import { sha256HexBytesSync, utf8Bytes }         from "@lararium/mesh";

export interface ActorSeedInputs {
  /** The tree root every label reads relative to (the repo). */
  readonly root:             string;
  /** The vendored TW5 core blob. Folds by bytes alone; absent folds nothing. */
  readonly corePath:         string;
  /** The vendored plugin directory; its packed set reads through `genesisPackedPluginFiles`. */
  readonly pluginsRoot:      string;
  /** The plugin build attestations the bake reads, by path. An absent path folds nothing. */
  readonly attestationPaths: readonly string[];
}

/**
 * The plugin blobs the genesis bake packs: every `.json` standing at the TOP of the plugins directory,
 * sorted by name. A nested directory (the standalone distribution, say) never packs, so it never folds.
 */
export function genesisPackedPluginFiles(pluginsRoot: string): string[] {
  if (!existsSync(pluginsRoot)) return [];
  return readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => e.name)
    .sort()
    .map((name) => join(pluginsRoot, name));
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
  const { root, corePath, pluginsRoot, attestationPaths } = inputs;
  const chunks: Uint8Array[] = [];

  if (existsSync(corePath)) {
    chunks.push(utf8Bytes("tw5-core:"));
    chunks.push(new Uint8Array(readFileSync(corePath)));
  }

  for (const f of genesisPackedPluginFiles(pluginsRoot)) {
    chunks.push(utf8Bytes(`plugin:${treeLabel(root, f)}:`));
    chunks.push(new Uint8Array(readFileSync(f)));
  }

  for (const f of [...attestationPaths].sort()) {
    if (!existsSync(f)) continue;
    chunks.push(utf8Bytes(`attestation:${treeLabel(root, f)}:`));
    chunks.push(new Uint8Array(readFileSync(f)));
  }

  return sha256HexBytesSync(concatBytes(chunks));
}
