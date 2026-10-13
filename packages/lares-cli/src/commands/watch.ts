/**
 * lares watch — the disk→records gesture, fired on a settle instead of an
 * operator keystroke.
 *
 *   lares watch --source <dir> --to <bagUri> [--apply] [--debounce ms]
 *
 * A nalu-builder for the disk peer. Disk events are HINTS (Confluence); the watcher
 * coalesces a settle-window into ONE wave — one scan, one INGEST verb, one
 * projection — never per-file dribbles. Default posture previews (logs what a
 * wave WOULD carry); --apply submits each wave through the island's Confluence gate.
 *
 * Settle, by the Confluence law: a buffered path drains only after the events quiet
 * (trailing debounce) AND the scan's own hash gate confirms a real change — a
 * no-op save drops at the gate, never a timer alone. Every wave rides one line
 * over the daemon's sock — the watcher holds no replica of its own.
 *
 * A VANISHED FILE TOMBSTONES NOTHING HERE. A carrier whose file left the path its base names may
 * name a delete, a branch switch, a checkout or a slip, and no span of waiting tells them apart, so the
 * watcher holds no grace clock and no deletion fraction. It keeps each vanished address in memory, hands
 * it to the vessel's shore (`shore sense`), and there the carrier stands as a PENDING REMOVAL: nothing
 * writes it back and nothing tombstones it until a person answers (`lares shore remove | restore`). A
 * path that scans present again leaves the set, and the shore hears that too.
 *
 * A RENAME rides by content alone: one vanished address and one arrived file that share a hash, each
 * unique in the wave, ride together as a re-link (the island re-homes the records). A pair that reads
 * ambiguous on either side sends no deletion at all.
 *
 * OWED: the file-grain rolling backup (`.stversions`-style) belongs at the
 * PROJECTOR (backup-on-write) — content is gone from disk by the time a delete
 * is seen here. Tracked as a burr; the CRDT op-log covers recovery until epoch.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/handoff
 */

import { watch as fsWatch, writeFileSync, rmSync, type FSWatcher } from "node:fs";
import { join, isAbsolute } from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import { exitFor, emit } from "../render.js";
import { udsAlive, udsSocketPath } from "../local-connector.js";
import { larRoot, larBagsDir, larWikisDir, vesselDid } from "../env.js";
import { openSyncedTree, scanFiles, fileToUriForSource, candidatesOf, deletionsOf, settleIngest, applyConfirmedRenames, standingAfterWave, standingAfterFault, standsClean, NO_STANDING_ASKS, type ArmedDeletion, type StandingAsks } from "../ingest-core.js";
import { askShore } from "../shore-core.js";

const DEFAULT_DEBOUNCE_MS = 400;   // twillm's field-tested trailing window
const COOKIE_TIMEOUT_MS   = 2_000; // a live backend echoes our own write well under this

/**
 * Editor litter, our own observation state, and the `.meta` field-sidecar never
 * count as carrier events. The watcher fires on EVERY filetype the mirror holds
 * (the ruling: bags/wikis hold all TW5 filetypes); the scan's loci derivation
 * (`fileToUri`) skips anything that carries no stable name — no extension gate
 * here decides the filetype. A `.meta` rides with its content file, so its own
 * write never opens a fresh wave.
 */
function isNoise(rel: string): boolean {
  if (rel.endsWith(".meta")) return true;
  if (rel.includes(".lararium-projection")) return true;
  if (rel.includes("/.git/") || rel.startsWith(".git/")) return true;
  const base = rel.split("/").pop() ?? rel;
  if (base.startsWith(".") || base.endsWith("~") || base.endsWith(".swp") || base === "4913") return true;
  return false;
}

/**
 * Which vanished addresses ride THIS wave as a rename's source: PAIRED BY CONTENT, and by nothing else.
 * A vanished address pairs where exactly one vanished address holds its base hash, exactly one of the
 * wave's candidates holds that same hash, and that candidate ARRIVED (a file at an address that held no
 * base: `new`). A standing carrier a hand edited into the vanished one's bytes names no move, so it pairs
 * with nothing. Every other vanished address rides nowhere: no span of waiting turns a vanish into a
 * deletion. Pulled out of `cmdWatch`'s closure so it stands as one weldable fact.
 */
export function pairedDeletions(
  vanished:   ReadonlyMap<string, { readonly syncedHash: string; readonly file: string }>,
  candidates: ReadonlyArray<{ readonly diskHash: string; readonly status: string }>,
): ArmedDeletion[] {
  const gone = new Map<string, number>();
  for (const v of vanished.values()) gone.set(v.syncedHash, (gone.get(v.syncedHash) ?? 0) + 1);
  // Every candidate counts toward ambiguity (the island's delete gate reads them all); only an arrival pairs.
  const holding = new Map<string, { count: number; arrived: boolean }>();
  for (const c of candidates) {
    const h = holding.get(c.diskHash) ?? { count: 0, arrived: false };
    holding.set(c.diskHash, { count: h.count + 1, arrived: h.arrived || c.status === "new" });
  }
  const ride: ArmedDeletion[] = [];
  for (const [uri, v] of vanished) {
    const pair = holding.get(v.syncedHash);
    if (gone.get(v.syncedHash) === 1 && pair !== undefined && pair.count === 1 && pair.arrived) ride.push({ uri, syncedHash: v.syncedHash, file: v.file });
  }
  return ride;
}

/** The vanished sources a settled wave's deletion summary names as re-linked. */
export function confirmedRenames(deletions: Record<string, unknown> | undefined): Set<string> {
  const from = new Set<string>();
  if (deletions?.["decision"] === "apply" && Array.isArray(deletions["renames"])) {
    for (const r of deletions["renames"] as Array<Record<string, unknown>>) from.add(String(r["fromUri"]));
  }
  return from;
}

function printUsage(): void {
  console.log("usage: lares watch --source <dir> --to <bagUri> [--apply] [--debounce ms]");
  console.log("  default = preview (logs what each settle WOULD ingest, submits nothing);");
  console.log("  --apply submits each settled wave through the island's INGEST gate;");
  console.log("  a vanished file tombstones nothing: it stands pending at the vessel's shore until a person");
  console.log("  answers with `lares shore remove` or `lares shore restore`.");
}

export async function cmdWatch(args: ParsedArgs): Promise<number> {
  const source = args.options["source"];
  const toBag  = args.options["to"];
  if (!source || !toBag) { printUsage(); return 2; }

  const root      = larRoot();
  const apply     = Boolean(args.flags["apply"]);
  const debounceMs = args.options["debounce"] ? Number(args.options["debounce"]) : DEFAULT_DEBOUNCE_MS;

  // One operator identity for the whole life of the watch. Each wave submits over
  // the sock; the daemon holds the warm replica, so the watcher holds nothing.
  let did = "";
  if (apply) {
    try { did = await vesselDid(); } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit(args, { ok: false, error: msg, human: () => console.error(`lares watch: ${msg}`) });
      return 3;
    }
    if (!(await udsAlive())) {
      const msg = `no lares daemon at ${udsSocketPath()}`;
      emit(args, { ok: false, error: msg, human: () => { console.error(`lares watch: ${msg}`); console.error("  Start the daemon with `lares vessel stand --foreground` and try again."); } });
      return 3;
    }
  }

  // ── the drain seat — one wave at a time (recipe-watch kick, disk-side) ──
  const buffer = new Set<string>();        // absolute carrier paths pending a wave
  // Vanished carriers this watcher saw leave: each scanned gone from a path where a base stands. The set
  // holds what a later arrival may pair with (a rename) and what to re-stat at every drain, so a path that
  // returns leaves it. It decides nothing and no clock reads it.
  const vanished = new Map<string, { syncedHash: string; file: string }>();
  let busy  = false;
  let rerun = false;
  let timer: NodeJS.Timeout | null = null;
  let waveNo = 0;
  /** What still asks for a hand across the waves: read at the stop for the exit. */
  let standing: StandingAsks = NO_STANDING_ASKS;

  /** Addresses that vanished or returned and that the vessel's shore has not yet looked at. A look that
   *  fails leaves them here, so the next drain asks again. */
  const unsensed = new Set<string>();

  /** Hand the vessel's shore what the disk showed: each address that vanished or returned. */
  const tellShore = async (): Promise<void> => {
    if (unsensed.size === 0) return;
    const uris = [...unsensed];
    if (!apply) { unsensed.clear(); console.log(`    (preview: the vessel's shore would look at ${uris.length} carrier(s))`); return; }
    try {
      const answer = await askShore({ op: "sense", uris }, did);
      if (!answer.ok) { console.error(`    ⚠ the vessel's shore did not look (${answer.refusal}: ${answer.why}); \`lares shore\` looks again`); return; }
      for (const uri of uris) unsensed.delete(uri);
      const pending = typeof answer.output["pendingCount"] === "number" ? answer.output["pendingCount"] : null;
      if (pending !== null && pending > 0) console.log(`    ${pending} carrier(s) stand pending at the vessel's shore: answer with \`lares shore remove\` or \`lares shore restore\``);
    } catch (err) {
      console.error(`    ⚠ the vessel's shore did not look (${err instanceof Error ? err.message : String(err)}); \`lares shore\` looks again`);
    }
  };

  const drain = async (): Promise<void> => {
    // Every drain re-stats BOTH the freshly-touched paths AND every vanished address's own path: a lost fs
    // event (WSL's `fs.watch` drops them) never leaves a returned file reading as gone.
    const files = new Set(buffer);
    for (const v of vanished.values()) files.add(v.file);
    buffer.clear();

    const tree = openSyncedTree();     // fresh read — the projection moves under us
    const { rows, skipped } = scanFiles(root, [...files], toBag, tree, fileToUriForSource(root, source, { bags: larBagsDir(), wikis: larWikisDir() }));
    const candidates = candidatesOf(rows);

    // A vanished address whose path scans present again has RETURNED (a checkout that re-creates the
    // file, an editor's write-rename save): it leaves the set, and the shore hears it came back.
    const moved: string[] = [];
    for (const r of rows) if (r.status !== "deleted" && vanished.delete(r.uri)) moved.push(r.uri);
    for (const d of deletionsOf(rows)) {
      if (!vanished.has(d.uri)) { vanished.set(d.uri, { syncedHash: d.syncedHash, file: d.file }); moved.push(d.uri); }
    }

    // Which vanished addresses ride THIS wave: only a rename's source, paired by content, unique on both
    // sides. The island re-links the records; nothing here tombstones.
    // A paired source stays in the vanished set until the island confirms its re-link: a wave that fails or
    // declines the pair leaves it vanished, and the files it carried scan again at the next drain.
    const ride = pairedDeletions(vanished, candidates);
    const rode = new Set(ride.map((d) => d.uri));
    const unpaired = (): void => { if (ride.length > 0) for (const c of candidates) buffer.add(c.file); };
    for (const uri of moved) if (!rode.has(uri)) unsensed.add(uri);
    const nowGone = moved.filter((uri) => vanished.has(uri) && !rode.has(uri));

    if (candidates.length === 0 && ride.length === 0) {
      if (nowGone.length > 0) console.log(`  ${nowGone.length} carrier(s) vanished from disk · nothing tombstones (${vanished.size} stand vanished in all)`);
      else if (rows.length > 0) console.log(`  ${rows.length} touched · 0 changed (all match the Synced tree)`);
      await tellShore();
      return;
    }
    const n = ++waveNo;

    if (!apply) {
      console.log(`  wave ${n} (preview): ${candidates.length} change(s), ${ride.length} rename(s) of ${rows.length} touched`);
      for (const r of candidates) console.log(`    ${r.status.toUpperCase().padEnd(8)} ${r.uri}`);
      for (const d of ride)       console.log(`    RENAME-FROM ${d.uri}`);
      for (const uri of nowGone)  console.log(`    VANISHED ${uri}`);
      if (skipped.length) console.log(`    (${skipped.length} skipped — outside bags/ or unreadable)`);
      await tellShore();
      return;
    }

    try {
      // The settling gesture reads every row the wave needs, asking again under the outcome's row cap
      // where a flood crossed it, and pins what landed.
      const settled = await settleIngest({ source, toBag, candidates, did, deletions: ride }, tree);
      standing = standingAfterWave(standing, settled);
      const result = settled.first;
      if (result.status === "error") {
        console.error(`  wave ${n}: INGEST failed — ${result.errorMessage ?? "unknown"}`);
        unpaired();
        await tellShore();
        return;
      }
      const carriers = [...settled.named.values()];
      const del      = settled.deletions;
      // Each source the island re-linked leaves the vanished set; one it declined stays vanished, and the
      // shore hears of it like any other vanish.
      const relinked = confirmedRenames(del);
      for (const d of ride) {
        if (relinked.has(d.uri)) vanished.delete(d.uri);
        else { unsensed.add(d.uri); buffer.add(d.file); }
      }
      // The gesture pins what it landed; the projector pins what it projects;
      // both write the same key and the same base where they agree.
      // R2: a confirmed rename moves its observation to the new location, so a moved
      // carrier reads `unchanged` next settle instead of re-landing (echo-survival).
      const renamesMoved  = applyConfirmedRenames(tree, toBag, candidates, del);
      if (settled.recorded + renamesMoved > 0) tree.flush();
      console.log(`  wave ${n}: ${candidates.length} change(s) + ${ride.length} rename(s) submitted · audit lar:///ha.ka.ba/bags/daemon/outcomes/${result.requestId}`);
      for (const c of carriers) console.log(`    ${String(c["decision"]).toUpperCase().padEnd(10)} ${c["uri"]}`);
      for (const r of [...settled.refused, ...settled.conflicts]) console.error(`    ⚠ ${r.decision} ${r.uri}: ${r.why}`);
      if (settled.pageError !== undefined) console.error(`    ⚠ a later wave failed (${settled.pageError.message}); ${settled.pageError.unread} carrier(s) stay unread until the next settle`);
      // A file at an address whose records never project refuses by name; the hand removes the file.
      for (const c of carriers) if (c["code"] === "never-projected-path") console.error(`    ⚠ ${String(c["reason"] ?? c["uri"])}`);
      if (nowGone.length > 0) console.log(`    ${nowGone.length} carrier(s) vanished from disk · nothing tombstones`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      standing = standingAfterFault(standing, { asked: candidates.map((c) => c.uri), askedDeletions: ride.map((d) => d.uri) }, message);
      console.error(`  wave ${n}: ${message}`);
      unpaired();
    }
    await tellShore();
  };

  // Serialize: a settle arriving mid-drain queues exactly one rerun.
  const kick = (): void => {
    if (busy) { rerun = true; return; }
    busy = true;
    void (async () => {
      try { do { rerun = false; await drain(); } while (rerun); }
      finally { busy = false; }
    })();
  };

  const scheduleDrain = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(kick, debounceMs);
  };

  // ── the watch ──────────────────────────────────────────────────────────
  let watcher: FSWatcher;
  try {
    watcher = fsWatch(source, { recursive: true }, (_event, filename) => {
      if (!filename) return;                       // some backends omit the name — ignore
      const rel = filename.toString();
      if (isNoise(rel)) return;
      const abs = isAbsolute(rel) ? rel : join(source, rel);
      // Every event is a hint; the drain's scan is truth (it classifies the
      // path as add / unchanged / vanished). A vanished carrier enters the
      // grace window there, not here.
      buffer.add(abs);
      scheduleDrain();
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: msg, human: () => console.error(`lares watch: cannot watch "${source}": ${msg}`) });
    return 3;
  }

  // ── cookie self-test — a dead backend (WSL2 /mnt = no inotify) fails HERE ──
  const cookieLive = await cookieSelfTest(source, watcher);
  if (!cookieLive) {
    console.error(`  ⚠ watch self-test: no event for our own cookie write under "${source}".`);
    console.error(`    The backend looks dead (WSL2 /mnt emits no inotify events — keep the bag tree on ext4).`);
    console.error(`    Events will not arrive; a periodic full scan stays the only truth here.`);
  }

  console.log(`lares watch: ${apply ? "LIVE" : "preview"} · source "${source}" → ${toBag} · settle ${debounceMs}ms${cookieLive ? " · backend live" : " · BACKEND DEAD"}`);
  console.log("  watching… (Ctrl-C to stop)");

  // ── lifetime — hold until interrupted, drain a final wave on the way out ──
  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      watcher.close();
      if (timer) clearTimeout(timer);
      resolve();
    };
    process.once("SIGINT",  shutdown);
    process.once("SIGTERM", shutdown);
  });

  console.log(`\nlares watch: stopped after ${waveNo} wave(s).`);
  // WHAT STAYS OWED ENDS THE WATCHER NON-ZERO. A carrier a later wave landed left the set, and so did a
  // deletion a later wave applied; what remains never reached the records, and the exit says so beside the
  // lines each wave already printed.
  if (!standsClean(standing)) {
    for (const [uri, why] of standing.owed) console.error(`  ⚠ still owed: ${uri}: ${why}`);
    for (const [uri, why] of standing.owedDeletions) console.error(`  ⚠ deletion still owed: ${uri}: ${why}`);
    return exitFor("verb-error");
  }
  return 0;
}

/**
 * Write a cookie carrier under the source and await our OWN event for it within
 * a window (the Watchman cookie discipline). A live backend echoes the write;
 * a dead one (WSL2 /mnt, an unsupported FS) never does. The cookie sits outside
 * bags/ derivation so it never becomes an ingest candidate, and we remove it.
 */
function cookieSelfTest(source: string, watcher: FSWatcher): Promise<boolean> {
  const cookieName = `.lares-watch-cookie-${process.pid}-${Date.now()}`;
  const cookiePath = join(source, cookieName);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (live: boolean): void => {
      if (settled) return;
      settled = true;
      watcher.off("change", onChange);
      clearTimeout(timeout);
      try { rmSync(cookiePath, { force: true }); } catch { /* best effort */ }
      resolve(live);
    };
    const onChange = (_e: string, fn: string | Buffer | null): void => {
      if (fn && fn.toString().includes(cookieName)) finish(true);
    };
    watcher.on("change", onChange);
    const timeout = setTimeout(() => finish(false), COOKIE_TIMEOUT_MS);
    try { writeFileSync(cookiePath, "cookie"); } catch { finish(false); }
  });
}
