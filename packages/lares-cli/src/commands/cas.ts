/**
 * `lares bag cas` — the inspection read over the cleartext `cid/` CAS tier.
 *
 * Pure local inspection, no daemon boot: lists the blobs the CAS dir holds and DERIVES which of them
 * the disk projection references — a `.tid` / `.meta` under bags/ or wikis/ carrying `textCid`, or a
 * `lar:///…/cid/<hash>` `_canonical_uri` (the same discrimination the lazy resolver and the mesh
 * `casReferences` reader make) — then reports blobs · referenced · unreferenced · pending · bytes and names the
 * genesis-manifest blobs as protected (the engine + plugins never sweep).
 *
 * THE PROJECTION IS AS-OF-LAST-PROJECTION. The authoritative count is `casReferences(composite.entries())`
 * over the live composite the daemon holds; the projection mirrors every locally-held record that
 * carries a loci path, so a pointer with no loci path reads unreferenced HERE while the daemon holds
 * it. This read therefore never sweeps — `casSweep` (@lararium/node) runs where the composite stands.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/tiddler-carriage#/pin-and-release
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { casReferences, summarizeCas, type CasReferenceEntry } from "@lararium/mesh";
import { listCasBlobs, readGenesisManifest } from "@lararium/node";
import { larCasDir, larBagsDir, larWikisDir, larGenesisDir } from "../env.js";
import { emit } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

/** Files the projection writes a pointer's fields into — TW5's own field-block forms. */
const FIELD_FILE_RE = /\.(tid|meta)$/;

/** Walk a projection tree for field files; an absent tree walks nothing. */
function* fieldFiles(root: string): Iterable<string> {
  let names: string[];
  try { names = readdirSync(root); } catch { return; }
  for (const n of names) {
    const p = join(root, n);
    let isDir = false;
    try { isDir = statSync(p).isDirectory(); } catch { continue; }
    if (isDir) yield* fieldFiles(p);
    else if (FIELD_FILE_RE.test(n)) yield p;
  }
}

/** Read a TW5 field block (`name: value` lines up to the first blank line) into fields. */
function fieldsOf(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") break;
    const at = line.indexOf(":");
    if (at <= 0) continue;
    fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return fields;
}

/** The references the projection carries — one entry per field file, addressed by its path under the root. */
function projectionEntries(dirs: { readonly bagsDir: string; readonly wikisDir: string }): CasReferenceEntry[] {
  const out: CasReferenceEntry[] = [];
  for (const [label, root] of [["bags", dirs.bagsDir], ["wikis", dirs.wikisDir]] as const) {
    for (const f of fieldFiles(root)) {
      let text = "";
      try { text = readFileSync(f, "utf8"); } catch { continue; }
      out.push({ title: `${label}/${relative(root, f)}`, record: { tiddler: fieldsOf(text) } });
    }
  }
  return out;
}

export interface CasReadOptions {
  readonly casDir:     string;
  readonly bagsDir:    string;
  readonly wikisDir:   string;
  readonly genesisDir: string;
}

export interface CasReadEntry {
  readonly cid:       string;
  readonly size:      number;
  /** The projection files referencing the blob (`bags/<bag>/<loci>.tid`). */
  readonly refs:      string[];
  readonly protected: boolean;
}

export interface CasRead {
  readonly casDir:       string;
  readonly blobs:        number;
  readonly referenced:   number;
  readonly unreferenced: number;
  readonly pending:      number;
  readonly bytes:        number;
  /** The genesis-manifest cids present in the CAS — never sweepable. */
  readonly protected:    string[];
  readonly entries:      CasReadEntry[];
}

/** The read itself — sited by explicit dirs so a test names its own. */
export function readCas(opts: CasReadOptions): CasRead {
  const blobs   = listCasBlobs(opts.casDir);
  const refs    = casReferences(projectionEntries(opts));
  const summary = summarizeCas(blobs, refs);
  const genesis = new Set((readGenesisManifest(opts.genesisDir)?.blobs ?? []).map((b) => b.cid));
  const entries = blobs.map((b) => ({
    cid: b.cid, size: b.size,
    refs: [...(refs.get(b.cid) ?? [])].sort(),
    protected: genesis.has(b.cid),
  }));
  return {
    casDir: opts.casDir, ...summary,
    protected: entries.filter((e) => e.protected).map((e) => e.cid),
    entries,
  };
}

/** `lares bag cas [--all]` — the summary; `--all` lists every blob with its references. */
export function cmdCas(args: ParsedArgs): number {
  const r = readCas({ casDir: larCasDir(), bagsDir: larBagsDir(), wikisDir: larWikisDir(), genesisDir: larGenesisDir() });
  emit(args, {
    ok: true,
    data: r as unknown as Record<string, unknown>,
    human: () => {
      console.log(`lares bag cas — ${r.casDir}`);
      console.log(`  blobs ${r.blobs} · referenced ${r.referenced} · unreferenced ${r.unreferenced} · pending ${r.pending} · bytes ${r.bytes} · protected (genesis) ${r.protected.length}`);
      console.log("  references derive from the disk projection (bags/ + wikis/), as of its last write");
      if (args.flags["all"]) {
        for (const e of r.entries) {
          const tag = e.protected ? "genesis " : e.refs.length > 0 ? "held    " : "orphan  ";
          console.log(`  ${tag} ${e.cid.slice(0, 16)}… ${String(e.size).padStart(9)}B  ${e.refs.join(" · ")}`);
        }
      }
    },
  });
  return 0;
}
