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
 * NO PERSON STANDS BEHIND A WAVE HERE, and every wave says so (`unattended`). The island's gate then never
 * adopts a file that holds no base over records that say something else: it stands off, as it does where
 * the disk and the records both moved past a base. The watcher hands each carrier that stood off to the
 * vessel's shore, where the projector weighs the same states, raises the one keyed alert, and a person
 * settles it by name (`lares shore`).
 *
 * OWED: the file-grain rolling backup (`.stversions`-style) belongs at the
 * PROJECTOR (backup-on-write) — content is gone from disk by the time a delete
 * is seen here. Tracked as a burr; the CRDT op-log covers recovery until epoch.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/working-procedures
 */

import { watch as fsWatch, type FSWatcher } from "node:fs";
import { join, isAbsolute } from "node:path";
import { drainSeat, isWatchNoise, cookieSelfTest, pairedDeletions } from "@lararium/node";
import type { ParsedArgs } from "../parse-args.js";
import { exitFor, emit } from "../render.js";
import { udsAlive, udsSocketPath } from "../local-connector.js";
import { larRoot, larBagsDir, larWikisDir, larProjectionsDirOrNone, vesselDid } from "../env.js";

/** The projections root when one stands, as the optional `MirrorDirs` field. */
const projectionsDirs = (): { projections?: string } => { const p = larProjectionsDirOrNone(); return p === undefined ? {} : { projections: p }; };
import { openSyncedTree, scanFiles, skipLines, fileToUriForSource, candidatesOf, deletionsOf, settleIngest, applyConfirmedRenames, standingAfterWave, standingAfterFault, standsClean, renamedSources, absentSources, NO_STANDING_ASKS, type StandingAsks } from "../ingest-core.js";
import { askShore } from "../shore-core.js";
import { OUTCOME_URI_PREFIX } from "@lararium/mesh";

const DEFAULT_DEBOUNCE_MS = 400;   // twillm's field-tested trailing window

// THE NOISE, THE SETTLE AND THE COOKIE stand once, in the drain seat (`@lararium/node` watch-core): editor litter, the
// `.meta` sidecar and every path HOUSE_IGNORED names open no wave; a burst of hints settles into one wave; one wave runs at a
// time; a backend that echoes no cookie names itself dead.

/** Which vanished addresses ride THIS wave as a rename's source: PAIRED BY CONTENT, and by nothing else (`pairedDeletions`,
 *  `@lararium/node` ingest-scan). The vessel's watch over a face's pool pairs its own vanished set by the same rule. */
export { pairedDeletions } from "@lararium/node";

/** The vanished sources a settled wave's deletion summary names as re-linked. */
export function confirmedRenames(deletions: Record<string, unknown> | undefined): Set<string> {
  return renamedSources(deletions);
}

function printUsage(): void {
  console.log("usage: lares watch --source <dir> --to <bagUri> [--apply] [--debounce ms]");
  console.log("  default = preview (logs what each settle WOULD ingest, submits nothing);");
  console.log("  --apply submits each settled wave through the island's INGEST gate;");
  console.log("  a vanished file tombstones nothing: it stands pending at the vessel's shore until a person");
  console.log("  answers with `lares shore remove` or `lares shore restore`;");
  console.log("  a file that holds no base never lands over records that say something else, and a file that");
  console.log("  moved while the records moved never lands: each stands off at the vessel's shore (`lares shore`).");
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

  // ── the drain seat — one wave at a time (`drainSeat`, watch-core), this watcher filling the wave ──
  // Vanished carriers this watcher saw leave: each scanned gone from a path where a base stands. The set
  // holds what a later arrival may pair with (a rename) and what to re-stat at every drain, so a path that
  // returns leaves it. It decides nothing and no clock reads it.
  const vanished = new Map<string, { syncedHash: string; file: string }>();
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

  const drain = async (touched: readonly string[]): Promise<void> => {
    // Every drain re-stats BOTH the freshly-touched paths AND every vanished address's own path: a lost fs
    // event (WSL's `fs.watch` drops them) never leaves a returned file reading as gone.
    const files = new Set(touched);
    for (const v of vanished.values()) files.add(v.file);

    const tree = openSyncedTree();     // fresh read — the projection moves under us
    const { rows, skipped } = scanFiles(root, [...files], toBag, tree, fileToUriForSource(root, source, { bags: larBagsDir(), wikis: larWikisDir(), ...projectionsDirs() }, tree));
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
    const unpaired = (): void => { if (ride.length > 0) for (const c of candidates) seat.carry(c.file); };
    for (const uri of moved) if (!rode.has(uri)) unsensed.add(uri);
    const nowGone = moved.filter((uri) => vanished.has(uri) && !rode.has(uri));
    // NO SILENT SKIPS: a file this drain read no carrier from says so by name, whether or not anything rides the wave.
    for (const line of skipLines(skipped)) console.error(`    ${line}`);

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
      await tellShore();
      return;
    }

    try {
      // The settling gesture reads every row the wave needs, asking again under the outcome's row cap
      // where a flood crossed it, and pins what landed.
      const settled = await settleIngest({ source, toBag, candidates, did, deletions: ride, unattended: true }, tree);
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
      const absent = absentSources(del);
      for (const d of ride) {
        if (relinked.has(d.uri)) vanished.delete(d.uri);
        // The records hold nothing under it: nothing pends, and the shore hears so its base leaves.
        else if (absent.has(d.uri)) { vanished.delete(d.uri); unsensed.add(d.uri); }
        else { unsensed.add(d.uri); seat.carry(d.file); }
      }
      // A CARRIER THAT STOOD OFF GOES TO THE SHORE. The gate landed nothing for it; the projector weighs
      // the same disk and records, raises the standoff's one keyed alert, and `lares shore` lists it.
      for (const c of settled.conflicts) unsensed.add(c.uri);
      // The gesture pins what it landed; the projector pins what it projects;
      // both write the same key and the same base where they agree.
      // R2: a confirmed rename moves its observation to the new location, so a moved
      // carrier reads `unchanged` next settle instead of re-landing (echo-survival).
      applyConfirmedRenames(tree, toBag, candidates, del);
      console.log(`  wave ${n}: ${candidates.length} change(s) + ${ride.length} rename(s) submitted · audit ${OUTCOME_URI_PREFIX}${result.requestId}`);
      for (const c of carriers) console.log(`    ${String(c["decision"]).toUpperCase().padEnd(10)} ${c["uri"]}`);
      for (const r of [...settled.refused, ...settled.conflicts]) console.error(`    ⚠ ${r.decision} ${r.uri}: ${r.why}`);
      if (settled.conflicts.length > 0) console.error(`    ${settled.conflicts.length} carrier(s) stand off: nothing landed for them; \`lares shore\` names each with its key`);
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

  // Serialize: a settle arriving mid-drain queues exactly one rerun; the seat holds that law, and a wave's fault names itself.
  const seat = drainSeat({ settleMs: debounceMs, wave: drain, onFault: (e) => console.error(`  a wave faulted: ${e instanceof Error ? e.message : String(e)}`) });

  // ── the watch ──────────────────────────────────────────────────────────
  let watcher: FSWatcher;
  try {
    watcher = fsWatch(source, { recursive: true }, (_event, filename) => {
      if (!filename) return;                       // some backends omit the name — ignore
      const rel = filename.toString();
      if (isWatchNoise(rel)) return;
      const abs = isAbsolute(rel) ? rel : join(source, rel);
      // Every event is a hint; the drain's scan is truth (it classifies the
      // path as add / unchanged / vanished). A vanished carrier enters the
      // grace window there, not here.
      seat.hint(abs);
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
      seat.close();
      resolve();
    };
    process.once("SIGINT",  shutdown);
    process.once("SIGTERM", shutdown);
  });
  // THE FINAL WAVE: what the settle window still held drains before the watcher stops.
  await seat.flush();

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
