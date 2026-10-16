/**
 * genesis-boot.harness — one door to an engine booted from the GENESIS CAS, the bytes a founded vessel runs.
 *
 * ── WHY A SECOND DOOR BESIDE test-wiki ───────────────────────────────────────────────────────────
 * `test-wiki.ts` boots the vendored core blob with the grammar plugin alone: a gitignored build artifact,
 * absent on a fresh clone and in CI's `test` job. The genesis CAS (`genesis/seed.json`, `genesis/cas/<sha>`)
 * rides in git, so a suite over it runs wherever the tree stands, and it boots the engine the way the
 * sovereign kernel boots it: the core by its CID, every `application/json` blob the seed names as a preload,
 * shaped by the same `preloadsFromCasBlob` the kernel calls. What a vector reads here, a founded vessel runs.
 *
 * ── THE TWO PATHS ────────────────────────────────────────────────────────────────────────────────
 * The host bridge forges the island runtime on two paths: the Node `worker_thread` path (real builtins,
 * a real `vm` context) and the browser-Worker path (synthetic `vm`, `path` and `os` shims). The bridge
 * reads the browser path off one positive signal, `WorkerGlobalScope`, so a suite on Node walks that
 * path by lending the signal for the boot and withdrawing it after. Both paths run the same core bytes.
 *
 * The skip names itself and its cure, so an absent CAS never reads as a green run.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pluginCidsFromIslandBlobs } from "@lararium/mesh";
import { TW5Engine } from "../src/tw5-vm.js";
import { preloadsFromCasBlob } from "../src/cas-preloads.js";

/** The repository's tracked genesis directory, derived from this file's own path. */
export const GENESIS_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..", "genesis");
const SEED_PATH = path.join(GENESIS_DIR, "seed.json");

interface GenesisSeedShape {
  blobs: Record<string, { id: string; sha256: string; mimeType: string; version?: string }>;
}

function readSeed(): GenesisSeedShape | null {
  if (!existsSync(SEED_PATH)) return null;
  try { return JSON.parse(readFileSync(SEED_PATH, "utf8")) as GenesisSeedShape; }
  catch { return null; }
}

const casPath = (sha256: string): string => path.join(GENESIS_DIR, "cas", sha256);

function absentMembers(seed: GenesisSeedShape): string[] {
  return Object.values(seed.blobs).filter((b) => !existsSync(casPath(b.sha256))).map((b) => b.id);
}

/** False when the genesis CAS can boot an engine; otherwise the reason AND its cure. */
export const genesisSkip: false | string = (() => {
  const seed = readSeed();
  if (!seed) return `genesis seed absent at ${SEED_PATH} — run: pnpm --filter @lararium/node build:genesis`;
  const absent = absentMembers(seed);
  if (absent.length) return `genesis CAS members absent (${absent.join(", ")}) — run: pnpm --filter @lararium/node build:genesis`;
  return false;
})();

/** Suffix for a describe title, so a skipped suite says why in the reporter. */
export const genesisNote = genesisSkip ? ` [SKIPPED: ${genesisSkip}]` : "";

export type EnginePath = "node" | "browser-worker";

/** The core blob the seed names, with the sha256 the kernel's integrity gate checks. */
export function genesisCoreBlob(): { bytes: Uint8Array; sha256: string } {
  const seed = readSeed()!;
  const core = Object.values(seed.blobs).find((b) => b.id === "tiddlywikicore")!;
  return { bytes: new Uint8Array(readFileSync(casPath(core.sha256))), sha256: core.sha256 };
}

/** Every preload the kernel would hand the engine: the seed's json blobs, in the kernel's own selection and shape. */
export function genesisPreloads(): Record<string, unknown>[] {
  const seed = readSeed()!;
  return pluginCidsFromIslandBlobs(seed.blobs).flatMap((cid) => preloadsFromCasBlob(new Uint8Array(readFileSync(casPath(cid)))));
}

/**
 * Boot an engine from the genesis CAS on the named path. `tiddlers` seeds records the suite authors itself.
 */
export async function bootGenesisWiki(opts: { path?: EnginePath; tiddlers?: Array<Record<string, string | string[]>> } = {}): Promise<TW5Engine> {
  const g = globalThis as Record<string, unknown>;
  const lendSignal = opts.path === "browser-worker" && g["WorkerGlobalScope"] === undefined;
  if (lendSignal) g["WorkerGlobalScope"] = {};
  try {
    const engine = new TW5Engine();
    await engine.boot(genesisCoreBlob(), genesisPreloads());
    for (const t of opts.tiddlers ?? []) engine.setTiddler(t);
    return engine;
  } finally {
    if (lendSignal) delete g["WorkerGlobalScope"];
  }
}
