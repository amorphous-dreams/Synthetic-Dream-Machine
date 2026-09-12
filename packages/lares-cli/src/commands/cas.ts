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
import { listCasBlobs, readGenesisManifest, readCasPins, pinCas, releaseCas } from "@lararium/node";
import { parseCapTier, type PinCap } from "@lararium/mesh";
import { larCasDir, larBagsDir, larWikisDir, larGenesisDir, vesselDid } from "../env.js";
import { runVerb } from "../verb-call.js";
import { summaryOutput } from "../verb-result.js";
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
  /** The cids a STANDING pin holds (basket-one #/grace-and-pin) — never sweepable while the pin stands. */
  readonly pinned:       string[];
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
  const pins = readCasPins(opts.casDir);
  return {
    casDir: opts.casDir, ...summary,
    protected: entries.filter((e) => e.protected).map((e) => e.cid),
    pinned: pins.filter((p) => Date.now() < p.expiry).map((p) => p.cid),
    entries,
  };
}

/**
 * `lares bag cas --fetch <cid>` — THE FETCH DOOR's explicit read (basket-one #/the-fetch-door): ask the running
 * vessel to resolve a cid through its door — local `cid/` first, then the fleet holders over Socket B, verified,
 * write-through. A miss everywhere answers `held: false` and the pointer stays PENDING; nothing is fabricated.
 */
async function cmdCasFetch(args: ParsedArgs, cid: string): Promise<number> {
  const r = await runVerb("cas-fetch", { cid }, await vesselDid());
  if (r.status === "error") {
    emit(args, { ok: false, error: { code: "error", message: r.errorMessage ?? "cas-fetch failed" },
                 human: () => console.error(`lares bag cas --fetch: ${r.errorMessage ?? "failed"}`) });
    return 1;
  }
  const out = summaryOutput(r) ?? {};
  emit(args, {
    ok: true, data: out,
    human: () => {
      console.log(`lares bag cas --fetch ${cid.slice(0, 16)}… — held ${String(out["held"])} · fetched ${String(out["fetched"])} · ${String(out["bytes"])}B · door ${String(out["door"])} · holders ${String((out["holders"] as string[] | undefined)?.length ?? 0)}`);
      if (out["held"] !== true) console.log("  no fleet holder carried the bytes — the pointer stays PENDING (a later read re-asks)");
    },
  });
  return out["held"] === true ? 0 : 2;
}

/**
 * `lares bag cas --sweep [--dry-run]` — THE SWEEP, run where the composite stands (basket-one #/grace-and-pin):
 * the daemon derives the live reference count, reads its standing pins and the genesis protect set, and
 * sweeps the unreferenced blobs past their grace. The grace reads off the realm's own pace; a realm that
 * has not said its pace sweeps under the floor alone. `--dry-run` names what would sweep and moves nothing.
 */
async function cmdCasSweep(args: ParsedArgs): Promise<number> {
  const dryRun = args.flags["dry-run"] === true;
  const r = await runVerb("cas-sweep", { dryRun }, await vesselDid());
  if (r.status === "error") {
    emit(args, { ok: false, error: { code: "error", message: r.errorMessage ?? "cas-sweep failed" },
                 human: () => console.error(`lares bag cas --sweep: ${r.errorMessage ?? "failed"}`) });
    return 1;
  }
  const out = summaryOutput(r) ?? {};
  const swept = (out["swept"] as string[] | undefined) ?? [];
  const pinned = (out["pinned"] as string[] | undefined) ?? [];
  const retained = (out["retained"] as string[] | undefined) ?? [];
  emit(args, {
    ok: true, data: { dryRun, swept, pinned, retained, baselineMs: out["baselineMs"] ?? null },
    human: () => {
      console.log(`lares bag cas --sweep${dryRun ? " --dry-run" : ""} — swept ${swept.length} · pinned ${pinned.length} · retained ${retained.length}` +
                  (out["baselineMs"] ? ` · realm pace ${String(out["baselineMs"])}ms/roll` : " · realm pace unread (floor grace alone)"));
      for (const cid of swept) console.log(`  ${dryRun ? "would sweep" : "swept     "} ${cid.slice(0, 16)}…`);
    },
  });
  return 0;
}

/** A pin's expiry as the operator spells it: ms since the epoch, an ISO instant, or `<n>d` days from now. */
function parseExpiry(raw: string, now: number): number {
  const days = /^(\d+)d$/.exec(raw);
  if (days) return now + Number(days[1]) * 86_400_000;
  if (/^\d+$/.test(raw)) return Number(raw);
  const iso = Date.parse(raw);
  if (Number.isFinite(iso)) return iso;
  throw new Error(`--expiry: "${raw}" reads as neither ms, an ISO instant, nor <n>d`);
}

/**
 * `lares bag cas --pin <cid> [--tier <t>] [--expiry <ms|iso|Nd>] [--holder <name>]` / `--release <cid>` — PIN at
 * cid grain (basket-one #/grace-and-pin): a pin beside the bag's caps holds its blob past any grace until its
 * expiry; an expired pin releases it to the tier's grace. Pins live in the CAS dir's `.pins.json` sidecar (a
 * non-hex name the sweep never reads as a blob). Local, no daemon.
 */
function cmdCasPin(args: ParsedArgs, pin: string, release: string): number {
  const casDir = larCasDir();
  const now = Date.now();
  let pins: PinCap[];
  if (release) {
    pins = releaseCas(casDir, release);
  } else {
    const tier = parseCapTier(args.options["tier"] ?? "veil");
    const expiry = parseExpiry(args.options["expiry"] ?? "30d", now);
    const holder = args.options["holder"] ?? "operator";
    pins = pinCas(casDir, { cid: pin, tier, holder, expiry });
  }
  emit(args, {
    ok: true,
    data: { casDir, pins, standing: pins.filter((p) => now < p.expiry).length },
    human: () => {
      console.log(`lares bag cas — pins in ${casDir}: ${pins.length} (${pins.filter((p) => now < p.expiry).length} standing)`);
      for (const p of pins) console.log(`  ${now < p.expiry ? "pinned " : "expired"} ${p.cid.slice(0, 16)}… tier ${p.tier} · holder ${p.holder} · until ${new Date(p.expiry).toISOString()}`);
    },
  });
  return 0;
}

/** `lares bag cas [--all] [--fetch <cid>] [--pin <cid> | --release <cid>] [--sweep [--dry-run]]` — the summary;
 *  `--all` lists every blob; `--fetch` reads one through the door; `--pin`/`--release` hold or free one past
 *  the grace; `--sweep` runs the sweep where the composite stands. */
export function cmdCas(args: ParsedArgs): number | Promise<number> {
  const fetchCid = typeof args.options["fetch"] === "string" ? args.options["fetch"] : "";
  if (fetchCid) return cmdCasFetch(args, fetchCid);
  if (args.flags["sweep"] === true) return cmdCasSweep(args);
  const pin = typeof args.options["pin"] === "string" ? args.options["pin"] : "";
  const release = typeof args.options["release"] === "string" ? args.options["release"] : "";
  if (pin || release) return cmdCasPin(args, pin, release);
  const r = readCas({ casDir: larCasDir(), bagsDir: larBagsDir(), wikisDir: larWikisDir(), genesisDir: larGenesisDir() });
  emit(args, {
    ok: true,
    data: r as unknown as Record<string, unknown>,
    human: () => {
      console.log(`lares bag cas — ${r.casDir}`);
      console.log(`  blobs ${r.blobs} · referenced ${r.referenced} · unreferenced ${r.unreferenced} · pending ${r.pending} · bytes ${r.bytes} · protected (genesis) ${r.protected.length} · pinned ${r.pinned.length}`);
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
