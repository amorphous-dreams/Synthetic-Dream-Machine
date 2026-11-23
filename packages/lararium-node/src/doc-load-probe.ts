/**
 * doc-load-probe (node) — the child_process implementation of the isomorphic
 * `DocLoadProbe` contract. It spawns the disposable boundary (`doc-load-probe-child`) to
 * materialize one doc, classifies how the child exited, and offers the
 * quarantine-not-delete recovery L2 (degraded boot) and L6 (doctor/repair) both call. It
 * runs the L5b framing gate FIRST: a torn framing gets caught cheaply, and only an
 * ambiguous-but-present doc pays the child-process round-trip.
 *
 * The classification carries the weight. A clean exit(0) reads `ok`. A catchable child
 * throw (exit 2, JSON reason) reads `load-error` — malformed, yet the runtime held. Any
 * OTHER exit — a signal, a non-zero-non-2 code, or a timeout kill — reads `aborted`: the
 * uncatchable WASM poison the whole design survives. `aborted` and `torn` (the pre-check
 * verdict) both condemn the doc; `load-error` condemns it too while staying distinct in
 * the ledger.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { from as from_, save } from "@automerge/automerge";
import { mkdirSync, renameSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, basename, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  emptyLarDoc,
  isFaceScopedBag,
  isCondemned,
  isUnresolved,
  type DocLoadProbe,
  type MountManifest,
  type ProbeOptions,
  type ProbeResult,
  type ProbeStatus,
  type QuarantineManifest,
  type StoreIntegrityReport,
} from "@lararium/mesh";
import { docStorePath, precheckDocStore } from "./store-integrity.js";
import { atomicWriteFileSync } from "./fs-atomic.js";

export { isCondemned, isUnresolved };
export type { DocLoadProbe, ProbeOptions, ProbeResult, ProbeStatus };

/**
 * H2 — a probe's boundary dying carries NO safety verdict unless it dies by its OWN abort
 * signature. A Rust `panic=abort` raises `SIGABRT` (POSIX) / exits 134 (128+SIGABRT) and the
 * child itself never gets to emit a line; THAT shape alone reads as the WASM poison. An
 * external SIGKILL (an operator, an OOM reaper, this very probe's own timeout kill) carries
 * no such signature — it says only "something outside this doc's own load ended the
 * boundary," never "this doc is torn." Treating that as `aborted` is exactly what quarantined
 * five healthy docs under a frozen child (H2, proven live) — so only the abort signature
 * condemns; everything else reads `unresolved` (liveness, no verdict).
 */
function isAbortSignature(code: number | null, signal: NodeJS.Signals | null, stderr: string): boolean {
  if (signal === "SIGABRT") return true;
  if (code === 134) return true; // 128 + SIGABRT(6) — POSIX uncaught-signal exit convention
  return /\babort\b/i.test(stderr);
}

const CHILD_URL = new URL("./doc-load-probe-child.js", import.meta.url);
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Resolve the COMPILED child entry the spawn hands to a bare `node`.
 *
 * The spawn crosses out of whatever loader the parent runs under: `spawn(process.execPath, …)`
 * starts plain node with no TypeScript hook, so the argv path must name a real `.js` on disk.
 * A parent running from `dist/` finds its sibling directly. A parent running the TS SOURCE
 * (`tsx src/main.ts`, the `pnpm dev` / `vessel stand --with-web` path) sees `import.meta.url`
 * point at `src/`, whose `.js` sibling exists only under `dist/src/` — so the source layout
 * maps to its compiled twin here.
 *
 * A missing child names a HARNESS fault, never a doc verdict: it throws, so the caller fails
 * loudly instead of reading every doc as `aborted` and quarantining sound data.
 */
export function resolveChildPath(): string {
  const sibling = fileURLToPath(CHILD_URL);
  if (existsSync(sibling)) return sibling;
  const marker = `${sep}src${sep}`;
  const cut = sibling.lastIndexOf(marker);
  if (cut >= 0) {
    const compiled = `${sibling.slice(0, cut)}${sep}dist${marker}${sibling.slice(cut + marker.length)}`;
    if (existsSync(compiled)) return compiled;
  }
  throw new Error(
    `doc-load-probe: the disposable child is missing (${sibling}) — run \`pnpm -r build\`. ` +
      `The probe refuses to report docs as aborted when it cannot run at all.`,
  );
}

interface ChildLine {
  ok?: boolean;
  heads?: string[];
  chunks?: number;
  reason?: string;
  /** L3 --clean-tail: the torn tail files the child excluded from the clean prefix. */
  tornTail?: string[];
  /** the records resting sealed, which the child read by envelope and never loaded. */
  sealed?: number;
}

/** Build a ProbeResult, omitting undefined optionals (exactOptionalPropertyTypes). */
function result(
  documentId: string,
  status: ProbeStatus,
  extra: { heads?: readonly string[]; chunks?: number; sealed?: number; reason?: string; integrity?: StoreIntegrityReport; cleanTail?: ProbeResult["cleanTail"]; held?: ProbeResult["held"] },
): ProbeResult {
  return {
    documentId,
    status,
    ...(extra.heads !== undefined ? { heads: extra.heads } : {}),
    ...(extra.chunks !== undefined ? { chunks: extra.chunks } : {}),
    ...(extra.sealed !== undefined && extra.sealed > 0 ? { sealed: extra.sealed } : {}),
    ...(extra.reason !== undefined ? { reason: extra.reason } : {}),
    ...(extra.integrity !== undefined ? { integrity: extra.integrity } : {}),
    ...(extra.cleanTail !== undefined ? { cleanTail: extra.cleanTail } : {}),
    ...(extra.held !== undefined ? { held: extra.held } : {}),
  };
}

/**
 * Probe one doc for a safe load. Runs the cheap L5b framing gate first; a torn framing
 * condemns WITHOUT spawning (the abort gets prevented, not merely contained). An intact
 * framing still pays the isolated child load, because a chunk parses well yet may still
 * drive automerge's op-set index to overflow when the incrementals assemble.
 */
export async function probeDocLoad(
  storageDir: string,
  documentId: string,
  opts: ProbeOptions = {},
): Promise<ProbeResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // AN ID IN QUARANTINE READS HELD, NEVER BLANK. Its bytes rest aside, so the store holds none under this id, and the
  // child would read zero chunks as a fresh document. The manifest the move wrote answers instead, on every boot.
  const hold = quarantineHoldOf(storageDir, documentId);
  if (hold) return heldVerdict(hold);

  let integrity: StoreIntegrityReport | undefined;
  if (!opts.skipPrecheck) {
    integrity = precheckDocStore(storageDir, documentId);
    if (!integrity.ok) {
      return result(documentId, "torn", {
        chunks: integrity.snapshots + integrity.incrementals,
        reason: integrity.torn.map((t) => `${t.kind}: ${t.reason}`).join("; "),
        integrity,
      });
    }
  }

  const childPath = resolveChildPath();
  return await new Promise<ProbeResult>((resolve) => {
    const child = spawn(process.execPath, [childPath, storageDir, documentId], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    let settled = false;
    const finish = (r: ProbeResult) => { if (!settled) { settled = true; resolve(r); } };

    // LIVENESS: the load child can hang on slow storage without emitting an exit.
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      // This door's OWN patience ran out — liveness, never a verdict on the doc. Quarantine
      // on a timeout is exactly the H2 fault: a slow disk, a loaded host, or a big doc read
      // as a data verdict and relocated five healthy docs (one the daemon doc itself).
      finish(result(documentId, "unresolved", { reason: `load exceeded ${timeoutMs}ms — no verdict`, ...(integrity ? { integrity } : {}) }));
    }, timeoutMs);
    timer.unref?.();

    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });

    child.on("error", (e) => {
      clearTimeout(timer);
      // The spawn itself never ran — a harness fault, not a verdict on this doc.
      finish(result(documentId, "unresolved", { reason: `spawn failed: ${e.message} — no verdict`, ...(integrity ? { integrity } : {}) }));
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (settled) return; // the timeout path already fired
      let line: ChildLine | null = null;
      const trimmed = out.trim();
      if (trimmed) { try { line = JSON.parse(trimmed.split("\n").pop() ?? "{}"); } catch { line = null; } }

      if (code === 0 && line?.ok) {
        finish(result(documentId, "ok", { heads: line.heads ?? [], ...(line.chunks !== undefined ? { chunks: line.chunks } : {}), ...(line.sealed !== undefined ? { sealed: line.sealed } : {}), ...(integrity ? { integrity } : {}) }));
      } else if (code === 2 && line && line.ok === false) {
        finish(result(documentId, "load-error", { ...(line.chunks !== undefined ? { chunks: line.chunks } : {}), ...(line.reason !== undefined ? { reason: line.reason } : {}), ...(integrity ? { integrity } : {}) }));
      } else if (isAbortSignature(code, signal, err)) {
        // The boundary died by its OWN abort signature — THE uncatchable WASM poison.
        const how = signal ? `signal ${signal}` : `exit ${code}`;
        finish(result(documentId, "aborted", {
          reason: `WASM abort on load (${how})${err.trim() ? ` — ${err.trim().split("\n").pop()}` : ""}`,
          ...(integrity ? { integrity } : {}),
        }));
      } else {
        // A signal or exit with NO abort signature — an external kill (operator, OOM,
        // a supervisor) ended the boundary. That names nothing about this doc: unresolved.
        const how = signal ? `signal ${signal}` : `exit ${code}`;
        finish(result(documentId, "unresolved", {
          reason: `boundary ended with no abort signature (${how}) — no verdict`,
          ...(integrity ? { integrity } : {}),
        }));
      }
    });
  });
}

/** The node child_process boundary, packaged as the isomorphic `DocLoadProbe`. */
export function makeChildProcessDocLoadProbe(storageDir: string): DocLoadProbe {
  return { probe: (documentId, o) => probeDocLoad(storageDir, documentId, o ?? {}) };
}

/** `runCleanTailChild`'s tagged outcome — so a patience-spent (or signal-less) death reads
 *  distinctly from "the child ran and said the prefix rejects", which is the only shape a
 *  caller may treat as an unrecoverable torn base. */
type CleanTailOutcome =
  | { readonly kind: "unresolved" }
  | { readonly kind: "rejected" }
  | { readonly kind: "line"; readonly line: ChildLine };

/**
 * Spawn the disposable child in --clean-tail mode. A clean `{ok:true,…}` line reads `line`; a
 * clean `{ok:false,…}` or an unparseable-but-complete exit reads `rejected` (the base itself is
 * torn — unrecoverable). This door's OWN patience spent, or the child dying with no verdict at
 * all, reads `unresolved` — NEVER folded into `rejected`, so a timeout never masquerades as a
 * torn base (H2). The child loads only framing-clean records, so this spawn is abort-resistant;
 * the child_process bulkhead still contains any residual poison.
 */
function runCleanTailChild(storageDir: string, documentId: string, timeoutMs: number): Promise<CleanTailOutcome> {
  const childPath = resolveChildPath();
  return new Promise<CleanTailOutcome>((resolve) => {
    const child = spawn(process.execPath, [childPath, storageDir, documentId, "--clean-tail"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let settled = false;
    const finish = (r: CleanTailOutcome) => { if (!settled) { settled = true; resolve(r); } };
    // LIVENESS: the clean-tail child can hang without emitting an exit.
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish({ kind: "unresolved" }); }, timeoutMs);
    timer.unref?.();
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.on("error", () => { clearTimeout(timer); finish({ kind: "unresolved" }); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (code !== 0) return finish({ kind: "rejected" });
      const trimmed = out.trim();
      if (!trimmed) return finish({ kind: "rejected" });
      try { finish({ kind: "line", line: JSON.parse(trimmed.split("\n").pop() ?? "{}") as ChildLine }); }
      catch { finish({ kind: "rejected" }); }
    });
  });
}

/**
 * L3 — clean-tail recovery of a condemned doc. Verifies the doc's clean record-PREFIX loads
 * in the disposable boundary (the child gates each record through the L5b framing check and
 * loads only the clean ones), then MOVES the torn tail files aside — a rename into a dated
 * `quarantine-torn-tail-<day>/` folder, never a delete, so the poisoned records stay for
 * forensics. With the tail gone, the on-disk store equals the verified prefix and the plane
 * mounts writable (PROMOTED). Returns a `status:"ok"` verdict carrying the cleanTail summary,
 * or null when the base record is torn / the prefix rejects (unrecoverable → whole-doc
 * quarantine). When the recovery attempt itself never reaches a verdict (this door's own
 * patience spent, or the child dying with no abort signature), returns a `status:"unresolved"`
 * `ProbeResult` instead of `null` — H2: a recovery-side timeout must not read as "the base is
 * torn" and fall into the SAME quarantine a true tear earns; the caller still quarantines on
 * the ORIGINAL condemn (real integrity evidence), but names the recovery attempt honestly.
 * Isomorphic peer to `quarantineDoc` — the node atom behind the mesh recipe hook.
 */
export async function recoverCleanTail(
  storageDir: string,
  condemned: ProbeResult,
  opts: ProbeOptions = {},
): Promise<ProbeResult | null> {
  const documentId = condemned.documentId;
  // An id already in quarantine holds no bytes to cut: a clean-tail child would read zero chunks as a clean prefix and
  // promote a blank. The hold answers first.
  if (condemned.held || quarantineHoldOf(storageDir, documentId)) return null;
  const outcome = await runCleanTailChild(storageDir, documentId, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (outcome.kind === "unresolved") {
    return result(documentId, "unresolved", { reason: "clean-tail recovery ran past its patience — no verdict" });
  }
  if (outcome.kind === "rejected") return null;
  const line = outcome.line;
  if (line.ok !== true || !Array.isArray(line.tornTail)) return null;

  const moved = moveTornTailAside(storageDir, documentId, line.tornTail);
  const kept = line.chunks ?? 0;
  return result(documentId, "ok", {
    heads: line.heads ?? [],
    chunks: kept,
    ...(line.sealed !== undefined ? { sealed: line.sealed } : {}),
    reason: `clean-tail: kept ${kept} record(s), moved ${moved.length} torn aside`,
    cleanTail: { kept, movedAside: moved },
  });
}

/**
 * Relocate a doc's torn tail files into a dated `quarantine-torn-tail-<day>/` folder beside
 * the store — a rename (never a delete), so the poisoned records survive for forensics while
 * the store keeps only the verified clean prefix. Returns the destination paths actually
 * moved. Idempotent-ish: a file already gone (moved by a prior pass) is skipped, and a name
 * collision suffixes. Pure fs — the tail-move actuator, testable without the spawned child.
 */
export function moveTornTailAside(storageDir: string, documentId: string, tornPaths: readonly string[]): string[] {
  const day = new Date().toISOString().slice(0, 10);
  const qroot = join(storageDir, `quarantine-torn-tail-${day}`);
  const moved: string[] = [];
  for (const src of tornPaths) {
    try {
      if (!existsSync(src)) continue;
      mkdirSync(qroot, { recursive: true });
      const flat = documentId.slice(0, 2) + "__" + documentId.slice(2) + "__" + basename(src);
      let dest = join(qroot, flat);
      let n = 1;
      while (existsSync(dest)) dest = join(qroot, `${flat}.${n++}`);
      renameSync(src, dest);
      moved.push(dest);
    } catch { /* a tail file that vanished mid-recovery is already gone — fine */ }
  }
  return moved;
}

/**
 * Quarantine a condemned doc — MOVE (never delete) its store dir into a dated quarantine
 * folder beside the store, with a manifest recording the verdict. The moved-aside bytes
 * stay for forensics (git fsck --lost-found discipline) and for L4 regenesis to reconcile
 * against. A second call for the same doc/day suffixes the destination.
 */
export function quarantineDoc(
  storageDir: string,
  probe: ProbeResult,
  opts: { readonly bagId?: string; readonly quarantineDir?: string } = {},
): string | null {
  const quarantineDir = opts.quarantineDir;
  const src = docStorePath(storageDir, probe.documentId);
  if (!existsSync(src)) return null;

  const day = new Date().toISOString().slice(0, 10);
  const qroot = quarantineDir ?? join(storageDir, `quarantine-torn-snapshots-${day}`);
  mkdirSync(qroot, { recursive: true });

  const flat = probe.documentId.slice(0, 2) + "__" + probe.documentId.slice(2);
  let dest = join(qroot, flat);
  let n = 1;
  while (existsSync(dest)) dest = join(qroot, `${flat}.${n++}`);

  const manifest: QuarantineManifest = {
    documentId: probe.documentId,
    status: probe.status,
    quarantinedAt: new Date().toISOString(),
    movedTo: dest,
    ...(opts.bagId !== undefined ? { bagId: opts.bagId } : {}),
    ...(probe.reason !== undefined ? { reason: probe.reason } : {}),
    ...(probe.chunks !== undefined ? { chunks: probe.chunks } : {}),
    ...(probe.integrity !== undefined ? { integrity: probe.integrity } : {}),
  };
  // THE MANIFEST RESTS BEFORE THE MOVE. It carries the hold every later boot reads (`quarantineHoldOf`), so a move with no
  // manifest beside it would return the id as a fresh blank. A move that fails takes its manifest back with it.
  const manifestPath = join(qroot, `${dest.slice(qroot.length + 1)}.manifest.json`);
  atomicWriteFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  try {
    renameSync(src, dest);
  } catch (err) {
    rmSync(manifestPath, { force: true });
    throw err;
  }
  return dest;
}

const QUARANTINE_DIR_RE = /^quarantine-torn-snapshots-/;

/** One quarantine manifest at rest, with the file it rests in. */
export interface QuarantineHold {
  readonly manifest: QuarantineManifest;
  readonly manifestPath: string;
}

const isManifest = (v: unknown): v is QuarantineManifest => {
  const r = v as Record<string, unknown> | null;
  return r !== null && typeof r === "object" && typeof r["documentId"] === "string" && typeof r["status"] === "string"
    && typeof r["quarantinedAt"] === "string" && typeof r["movedTo"] === "string";
};

/**
 * Every quarantine manifest resting beside the store, held or released, oldest first. A manifest that does not parse
 * names nothing and drops out (its bytes still sit aside, for the hand to read).
 */
export function readQuarantineManifests(storageDir: string): QuarantineHold[] {
  const out: QuarantineHold[] = [];
  let dirs: string[];
  try { dirs = readdirSync(storageDir).filter((name) => QUARANTINE_DIR_RE.test(name)); } catch { return out; }
  for (const dir of dirs.sort()) {
    let names: string[];
    try { names = readdirSync(join(storageDir, dir)).filter((name) => name.endsWith(".manifest.json")); } catch { continue; }
    for (const name of names.sort()) {
      const manifestPath = join(storageDir, dir, name);
      try {
        const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
        if (isManifest(parsed)) out.push({ manifest: parsed, manifestPath });
      } catch { /* unreadable: names nothing */ }
    }
  }
  return out.sort((a, b) => a.manifest.quarantinedAt.localeCompare(b.manifest.quarantinedAt));
}

/** The ids the store holds in quarantine with no hand act yet released, each with its newest manifest. */
export function quarantineHolds(storageDir: string): QuarantineHold[] {
  const newest = new Map<string, QuarantineHold>();
  for (const hold of readQuarantineManifests(storageDir)) {
    if (hold.manifest.released) continue;
    newest.set(hold.manifest.documentId, hold);
  }
  return [...newest.values()];
}

/** The hold on one id, or null where no unreleased manifest names it. */
export function quarantineHoldOf(storageDir: string, documentId: string): QuarantineHold | null {
  return quarantineHolds(storageDir).find((h) => h.manifest.documentId === documentId) ?? null;
}

/** The hand act that ends a hold, as the deep vessel lens takes it. */
export const QUARANTINE_RELEASE_ACT = "with the vessel stopped, `lares vessel read vessel --release <documentId>` returns the bytes (the next stand probes them again), `--release-keep <documentId>` keeps what stands under the id, or `--release-fresh <documentId>` starts a plane no sibling carries empty while the bytes stay aside";

function heldVerdict(hold: QuarantineHold): ProbeResult {
  const m = hold.manifest;
  // The verdict keeps the condemn class the move recorded, so every door that reads `isCondemned` reads the id held back.
  const status: ProbeStatus = isCondemned({ documentId: m.documentId, status: m.status }) ? m.status : "torn";
  return result(m.documentId, status, {
    reason: `held in quarantine since ${m.quarantinedAt} (${m.status}${m.reason ? `: ${m.reason}` : ""}); its bytes rest at ${m.movedTo}; hand act: ${QUARANTINE_RELEASE_ACT}`,
    held: { movedTo: m.movedTo, quarantinedAt: m.quarantinedAt },
  });
}

/** The three hand acts that end a hold. */
export type QuarantineReleaseAct = "restored" | "fresh" | "kept";

/** What a release did. */
export type QuarantineRelease =
  | { readonly ok: true; readonly documentId: string; readonly act: QuarantineReleaseAct; readonly from: string | null; readonly released: number }
  | { readonly ok: false; readonly documentId: string; readonly why: string };

/**
 * Where the moved-aside bytes rest, read beside the manifest's own file: the vessel records its own absolute path (`/lar/…`),
 * which a host shell reading the same store under another prefix cannot see, while the bytes always sit beside the manifest.
 */
function movedBytesOf(hold: QuarantineHold): string {
  return join(dirname(hold.manifestPath), basename(hold.manifest.movedTo));
}

/**
 * THE HAND'S RELEASE OF A HELD ID. Run it with the vessel stopped: a live Repo would not see bytes move under it. Each act
 * marks every unreleased manifest for the id released, so no later boot reads it held.
 *   `restored` moves the newest quarantined bytes back into the store; the next boot probes them again, so torn bytes
 *              condemn again.
 *   `fresh`    leaves the bytes aside and seeds one empty document under the same id. It refuses for a plane a sibling
 *              device carries (a face plane, `isFaceScopedBag`, the set the sibling gate governs) and for a plane the
 *              manifest never named: a second history under the same id would hide the sibling's real copy once the two
 *              merge. The daemon plane, which no sibling carries, takes it.
 *   `kept`     marks the hold released and leaves whatever bytes stand under the id where they stand; the moved-aside copy
 *              stays where it rests, for the hand. It frees an id a crash or a sibling's sync left held beside its bytes,
 *              and refuses where nothing stands under the id, since the next boot would mount a writable blank.
 * `restored` and `fresh` refuse where bytes already stand under the id, naming `kept`. Every refusal names only an act
 * that can land from the state it finds.
 */
export function releaseQuarantinedDoc(storageDir: string, documentId: string, act: QuarantineReleaseAct): QuarantineRelease {
  const held = readQuarantineManifests(storageDir).filter((h) => h.manifest.documentId === documentId && !h.manifest.released);
  if (held.length === 0) return { ok: false, documentId, why: "no quarantine hold names this id" };
  const live = docStorePath(storageDir, documentId);
  let from: string | null = null;
  if (act !== "kept" && existsSync(live)) {
    return { ok: false, documentId, why: `bytes already stand under this id at ${live}; \`--release-keep ${documentId}\` releases the hold and keeps them` };
  }
  const newest = held[held.length - 1]!.manifest;
  const freshLands = newest.bagId !== undefined && !isFaceScopedBag(newest.bagId);
  const moved = [...held].reverse().map(movedBytesOf).find((p) => existsSync(p));
  // NOTHING LEFT TO KEEP OR RETURN: name only the act that can land. Fresh for a plane no sibling carries; for one a sibling
  // carries, a known copy laid back under the id by hand (from a sibling or a keep bundle), then keep.
  const noBytesAnywhere = freshLands
    ? `\`--release-fresh ${documentId}\` starts the id empty`
    : `this plane rides to sibling devices, so lay a known copy (from a sibling or a keep bundle) at ${live}, then \`--release-keep ${documentId}\``;
  if (act === "kept" && !existsSync(live)) {
    return { ok: false, documentId, why: moved !== undefined
      ? `nothing stands under this id, so a keep would free a blank; \`--release ${documentId}\` returns the moved bytes`
      : `nothing stands under this id and the moved bytes no longer rest beside the manifest; ${noBytesAnywhere}` };
  }
  if (act === "fresh") {
    if (!freshLands) {
      const plane = newest.bagId === undefined ? "the manifest names no plane, so a sibling may carry it" : `${newest.bagId} rides to this face's sibling devices`;
      return { ok: false, documentId, why: `${plane}; a fresh history under the same id would hide a sibling's real copy. ${moved !== undefined ? `\`--release ${documentId}\` returns the moved bytes` : `Lay a known copy (from a sibling or a keep bundle) at ${live}, then \`--release-keep ${documentId}\``}` };
    }
    // THE ID STARTS EMPTY UNDER ITS OWN NAME. With no bytes the resolver would mint a blank under a NEW id, an orphan the
    // pointer never names; one empty snapshot under the held id keeps every write where the pointer reads.
    const empty = save(from_(emptyLarDoc() as unknown as Record<string, unknown>));
    const snapshotDir = join(live, "snapshot");
    mkdirSync(snapshotDir, { recursive: true });
    atomicWriteFileSync(join(snapshotDir, createHash("sha256").update(empty).digest("hex")), empty);
  } else if (act === "restored") {
    if (moved === undefined) return { ok: false, documentId, why: `the quarantined bytes no longer rest beside the manifest; ${noBytesAnywhere}` };
    mkdirSync(dirname(live), { recursive: true });
    renameSync(moved, live);
    from = moved;
  }
  for (const h of held) {
    const released: QuarantineManifest = { ...h.manifest, released: { act } };
    atomicWriteFileSync(h.manifestPath, `${JSON.stringify(released, null, 2)}\n`);
  }
  return { ok: true, documentId, act, from, released: held.length };
}

/** The line the boot that moves a document's bytes prints for the move alone; the plane's one DEGRADED line comes from
 *  the mount manifest (`heldPlaneLines`). */
export function quarantineMoveLine(verdict: ProbeResult, moved: string | null): string {
  return `[lararium] QUARANTINED ${verdict.documentId} (${verdict.status}: ${verdict.reason ?? "?"}) → ${moved ?? "already gone"}`;
}

/**
 * THE BOOT'S LINES FOR EVERY PLANE IT HOLDS BACK, at every boot, each naming only the act that releases it. A PENDING plane
 * (the probe answered no verdict, or a fall holds a sound document) mounted read-only with no bytes moved; the deep vessel
 * probe reads no fall, so it releases nothing, and the line names the stop and the stand. A DEGRADED plane stands on a
 * condemn; one held in quarantine names the release act, since no boot after the move releases it by itself.
 */
export function heldPlaneLines(prefix: string, manifest: MountManifest): string[] {
  const lines: string[] = [];
  for (const e of manifest.entries) {
    if (e.status === "pending") {
      lines.push(
        `${prefix} PENDING plane — ${e.documentId} (unresolved: ${e.reason ?? "?"}); ` +
        "mounted read-only, no bytes moved; a clean stop (exit 0) and a fresh stand re-probe it",
      );
    } else if (e.status === "degraded") {
      lines.push(
        `${prefix} DEGRADED plane — ${e.documentId} (${e.reason ?? "?"}); mounted read-only, the plane reads empty; ` +
        `hand act: ${QUARANTINE_RELEASE_ACT}`,
      );
    }
  }
  return lines;
}
