/**
 * `lares vessel read` — the inspection surface, NAMESPACED into referents that never collide:
 *
 *   lares vessel read             NODE HEALTH — bootstrap presence, storage size, port in use. Pure
 *                                 local inspection, no vm boot.
 *   lares vessel read --palaces   PALACE ORGANS — the local organ health table.
 *   lares vessel read vessel      THE DEEP PROBE — every Automerge doc, mounted vs condemned.
 *   lares sense status            SENSORIUM TAXONOMY — what the Memory sensorium holds; the read rides
 *                                 the sense door over the daemon's composed caps.
 *
 * Each name resolves to ONE referent, so the isomorphism table holds no name reaching two things.
 *
 * `lares vessel stop` lives here beside it: both act on the same running node, one by looking and one
 * by ending it, and neither boots a vm.
 */

import { repoRoot } from "@lararium/mesh/node";
import { larDataDir, larPort, vesselDid, larBootstrapPath } from "../env.js";
import { stopIncumbent, probePort } from "../port-control.js";
import { udsAlive } from "../local-connector.js";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { palaceOrgans, organHealthy, guestMempalaceOrgan, readMemeticWikitextCoupling, runDoctor, formatDoctorReport, readFloorShadowFile, quarantineHolds, readEngineFalls, heldInFlight, QUARANTINE_RELEASE_ACT, ENGINE_DOWN_HAND_ACT, ENGINE_RESTART_CAP, HELD_HAND_ACT, type EngineMeterReading } from "@lararium/node";
import { floorShadowLine } from "@lararium/mesh";
import { read as readIntent, Ledger } from "../reality-tunnel/engine.js";
import { homeItems } from "../reality-tunnel/catalog.js";
import { resolveHomes } from "../reality-tunnel/homes.js";
import { homeLedgerDir } from "../reality-tunnel/places.js";
import { emit, proseFirst } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";


/**
 * `lares vessel read --palaces` — the palace-organ health table (re-runnable). Reads the SAME registry
 * `lares sense setup` stands up + `lares sense teardown` removes, so the health view never drifts
 * from what setup/teardown act on. Pure inspection (each organ's cheap probe), no vm boot.
 */
function cmdReadPalaces(args: ParsedArgs): number {
  const organs = palaceOrgans().map((o) => ({ name: o.name, dir: o.dir, healthy: organHealthy(o) }));
  const allHealthy = organs.every((o) => o.healthy);
  // The GUEST rides BESIDE the table, never inside it — `~/.mempalace` never stands as an organ of the
  // vessel (the comparator ruling), so its absence must never read as an unhealthy sovereign store.
  // Surfaced so the operator keeps sight of it: present or not, it is `lares mempalace setup`'s to raise.
  const g = guestMempalaceOrgan();
  const guest = { name: g.name, dir: g.dir, healthy: organHealthy(g) };
  // Read the memetic-wikitext coupling plane through the H¹ gate — makes `coupling.children`
  // load-bearing at the vessel surface (a fused reading OR a hold-open verdict, never a silent average).
  // Cheap + graceful: until the peer salience sidecars fill, it reports the honest no-coupling.
  let coupling: ReturnType<typeof readMemeticWikitextCoupling> | null = null;
  try { coupling = readMemeticWikitextCoupling(); } catch { coupling = null; }
  emit(args, {
    ok: true,
    data: {
      palaces: organs, allHealthy, guest,
      ...(coupling ? { coupling: { sensorium: coupling.sensorium, readable: coupling.readable, sharedUnits: coupling.sharedUnits, verdict: coupling.fusion?.verdict ?? null, note: coupling.note } } : {}),
    },
    human: () => {
      console.log("lares vessel read — palace organs (sovereign)");
      for (const o of organs) {
        console.log(`  ${o.healthy ? "ok     " : "ABSENT "} ${o.name.padEnd(22)} ${o.dir}`);
      }
      console.log("\n  guest (not an organ — the vessel never boots into it)");
      console.log(`  ${guest.healthy ? "ok     " : "absent "} ${guest.name.padEnd(22)} ${guest.dir}`);
      if (coupling) {
        const verdict = coupling.fusion ? coupling.fusion.verdict : "insufficient";
        console.log(`\n  coupling (${coupling.sensorium}): ${verdict} — ${coupling.note}`);
      }
      if (!allHealthy) console.log("\n  → stand up absent organs:  lares sense setup");
      if (!guest.healthy) console.log("  → raise the guest sidecar: lares mempalace setup");
    },
  });
  return 0;
}

function dirSizeHint(dir: string): string {
  if (!existsSync(dir)) return "(absent)";
  let bytes = 0;
  let count = 0;
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else { try { bytes += statSync(full).size; count++; } catch { /* race; skip */ } }
    }
  };
  try { walk(dir); } catch { return "(unreadable)"; }
  return `${count} files, ${(bytes / 1024).toFixed(1)} KiB`;
}

/**
 * `lares vessel stop` — halt the daemon on the port, the pair to `lares vessel stand`. Pure port-control
 * (no vm boot, no wipe): SIGTERM the incumbent and wait on its OWN real exit — never a forced SIGKILL, which
 * could tear a save the crash-atomic adapter's guarantee never promised to survive a deliberate kill. A free
 * port reads as already-stopped, not an error. A wedged daemon past its grace is NAMED, once, rather than
 * left to hang silently; the wait itself keeps going. It ENDS a vessel and nothing else — `vessel stand
 * --restart` stops then stands, `hooks pause` suppresses capture alone.
 *
 * `--cut` (M4) — past the already-reported grace, deliver the holder ONE further signal (never a
 * SIGKILL): the operator's own SECOND signal, which the vessel's own shutdown (main.ts) reads as the
 * event that cuts a hung teardown and exits 75. Without `--cut` this stays exactly as above — a report,
 * never a decision this door makes for the vessel.
 *
 * `stopped: true` waits on the HOLDER, never the port alone (H5). `main.ts`'s shutdown closes the http
 * listener — which frees this port — as its very FIRST step, well before main-flush, the wiki islands,
 * or the daemon island ever ack their own teardown; a port-only reading reported `stopped: true` over a
 * vessel that kept running for seconds afterward. `holderAlive` here reads the vessel's own UDS
 * rendezvous claim (`udsAlive`, released only with the holding process) instead.
 */
export async function cmdStop(args: ParsedArgs): Promise<number> {
  const port = larPort();
  const dataDir = larDataDir();
  const cut = args.flags["cut"] === true;
  const r = await stopIncumbent(port, {
    cut,
    holderAlive: () => udsAlive(dataDir, 300),
    onPastGrace: (pids) => console.log(
      pids.length > 0
        ? `[lares] :${port} runs past its grace, still held by pid(s) ${pids.join(", ")}${cut ? " — delivering the operator's cut signal now" : " — waiting on its own exit, never a forced kill"}`
        : `[lares] :${port} runs past its grace, held by no discoverable pid${cut ? " — cut has nobody to reach" : " — waiting on its own exit, never a forced kill"}`,
    ),
  });
  emit(args, {
    ok: true,
    data: { port, stopped: r.stopped },
    human: () => console.log(
      r.stopped
        ? `[lares] stopped the daemon on :${port} (graceful — SIGTERM)`
        : `[lares] :${port} already free — no daemon to stop`,
    ),
  });
  return 0;
}

/**
 * `lares vessel read vessel` — the DEEP health lens (the `git fsck` role, reached through the one
 * read door rather than a verb of its own): probes every Automerge doc in the vessel store through a
 * disposable child-process boundary and charts MOUNTED vs CONDEMNED (a torn doc that would
 * abort the WASM runtime on load). Read-only; a condemned doc can be laid again from its disk holding with `lares vessel lay --apply --yes`.
 * Exits non-zero on a tear, so a boot/CI gate reads health off the exit code.
 *
 * THE HELD IDS. The lens also names each id the store holds in quarantine: its bytes rest aside, and every boot mounts its
 * plane read-only until the hand releases it by the vessel door's own write, `lares vessel release <documentId>
 * [--keep|--fresh]`. The lens itself writes nothing.
 */
async function cmdReadVessel(args: ParsedArgs): Promise<number> {
  const storageDir = larDataDir();
  const report = await runDoctor(storageDir);
  const held = quarantineHolds(storageDir).map((h) => ({
    documentId: h.manifest.documentId, status: h.manifest.status, quarantinedAt: h.manifest.quarantinedAt, movedTo: h.manifest.movedTo,
  }));
  emit(args, {
    ok: true,
    data: {
      storageDir,
      total: report.total,
      healthy: report.healthy,
      sealed: report.sealed,
      condemned: report.condemned,
      degraded: report.degraded,
      entries: report.entries,
      held,
    },
    human: () => {
      console.log(formatDoctorReport(report, storageDir));
      if (held.length > 0) {
        console.log(`  held in quarantine (each plane mounts read-only at every boot until the hand releases it):`);
        for (const h of held) console.log(`    ${h.documentId}  [${h.status}]  since ${h.quarantinedAt} · bytes at ${h.movedTo}`);
        console.log(`  release: ${QUARANTINE_RELEASE_ACT}`);
      }
    },
  });
  return report.degraded || held.length > 0 ? 1 : 0;
}

export async function cmdRead(given: ParsedArgs): Promise<number> {
  // EVERY LENS ANSWERS A PIPE IN PROSE (render.ts `proseFirst`): the deep probe's JSON names every document in the store, so a
  // piped read prints the terminal's lines and only `--json` answers the envelope.
  const args = proseFirst(given);
  // An explicit --root moves the whole reading, as it does for `vessel found` (never a default).
  if (args.options["root"]) process.env["LAR_ROOT"] = args.options["root"];
  // The one named lens is `vessel`; any other positional names a door that does not exist (no alias stands),
  // so it refuses by name rather than answering as the bare node read.
  const lens = args.positional[0];
  if (lens !== undefined && lens !== "vessel") {
    console.error(`lares vessel read: unknown lens "${lens}" (the door answers one lens, \`vessel\`; bare \`read\` gives the node health reading)`);
    return 2;
  }
  // --palaces: the palace-organ health table (re-runnable; same registry as setup/teardown).
  if (args.flags["palaces"] === true) return cmdReadPalaces(args);
  // The named lens: the deep vessel probe (THE VESSEL DOOR: no aliases) — the sensorium taxonomy has exactly
  // one door, `lares sense status`.
  if (args.positional[0] === "vessel") return cmdReadVessel(args);
  // Bare `lares vessel read` — node health, the reading an operator wants most often.
  return cmdReadNode(args);
}

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;
const size = (bytes: number): string => (bytes >= GiB ? `${Number((bytes / GiB).toFixed(2))} GiB` : `${Math.round(bytes / MiB)} MiB`);

/** One line of the vessel's engine meter (`engine-meter`): the engine against its ceiling, node's heap, and the whole process's wasm. */
export function engineMeterLine(r: EngineMeterReading): string {
  const engine = r.wasm === null
    ? `${r.isolate} engine unread`
    : `${r.isolate} engine ${size(r.wasm.bytes)} of ${size(r.wasm.ceilingBytes)} (${Math.round(r.wasm.fraction * 100)}%, ${r.wasm.pages.toLocaleString("en-US")} pages)`;
  const parts = [
    engine,
    `heap ${size(r.node.heapUsed)} of ${size(r.node.heapTotal)}`,
    `external ${size(r.node.external)}`,
    `rss ${size(r.node.rss)} (peak ${size(r.node.maxRss)})`,
  ];
  if (r.process !== null) {
    parts.push("unread" in r.process
      ? `process wasm unread (${r.process.unread})`
      : `process wasm ${size(r.process.bytes)} in ${r.process.memories.length} memories, ${r.process.residentBytes === null ? "resident unread" : `${size(r.process.residentBytes)} resident`}`);
  }
  return parts.join(" · ");
}

/**
 * THE ENGINE METER, read off the vessel's health face (`readiness-face`): its `engine` reading, or null where no vessel answers
 * on the port, its answer carries none, or it answers past a short bound. A read that cannot reach it never fails.
 */
async function readEngineMeter(port: number): Promise<EngineMeterReading | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2_000) });
    const body = await res.json() as { engine?: unknown };
    const engine = body.engine as EngineMeterReading | null | undefined;
    return engine && typeof engine === "object" && typeof engine.node === "object" ? engine : null;
  } catch {
    return null;
  }
}

/** Node health — bootstrap presence, storage size, port probe, retention. Pure local inspection. */
async function cmdReadNode(args: ParsedArgs): Promise<number> {

  const storage   = larDataDir();   // runtime → <root>/hearth/vessel
  const bootstrap = larBootstrapPath();
  const portRaw   = process.env["LAR_PORT"] ?? "8080";
  const port      = Number(portRaw);

  const portInUse  = await probePort(port);
  const hasBoot    = existsSync(bootstrap);
  const storageStr = dirSizeHint(storage);

  // THE MEMORY GUARDS. Every harness's session store seeds the operator's memory, and each host prunes
  // by its own retention; `lares home` keeps each at its maximum. The read surfaces the guards' rows so a
  // lowered one (a hand, a host update) stays visible here as well as at the wake.
  // A TREE WITHOUT THE CATALOG (an older image against a newer checkout, or the reverse) names the skew and reads on: the
  // read never throws over the guards it cannot find.
  let guards: ReturnType<typeof readIntent> | null = null;
  let guardsUnread: string | null = null;
  try {
    guards = readIntent(
      homeItems({ repo: repoRoot, homes: resolveHomes(), mcp: null, claudeCli: false }).filter((i) => /\.retain/.test(i.id)),
      new Ledger(homeLedgerDir()),
    ).filter((r) => r.state !== "absent");
  } catch (e) {
    guardsUnread = `${e instanceof Error ? e.message : String(e)} under ${repoRoot}: this CLI and the tree it reads stand at different revisions; rebuild the image (or update the checkout) so both carry one catalog`;
  }
  const guardsHeld = guards === null ? null : guards.every((r) => r.state === "aligned");

  // Snapshot fields — the same data the prose renders, shaped for an agent.
  const data: Record<string, unknown> = {
    bootstrap: hasBoot ? "present" : "absent",
    storage:   storageStr,
    port,
    portInUse,
    memoryGuards: guards === null ? null : guards.map((r) => ({ id: r.id, path: r.path, state: r.state })),
    memoryGuardsHeld: guardsHeld,
    ...(guardsUnread !== null ? { memoryGuardsUnread: guardsUnread } : {}),
  };
  // THE FLOOR SHADOW COUNT (backlog-awakens 3a): the tally each boot's mounts keep beside the vessel store, read from the
  // file whether or not the vessel stands, keyed by floor: the line names the current floor's count and sets older floors
  // aside. The operator flips mounts onto the floor once the current floor reads clean.
  // THE ENGINE METER (`engine-meter`): where the vessel answers health on its port, its engine's wasm memory and node's heap.
  const engine = portInUse ? await readEngineMeter(port) : null;
  data["engine"] = engine;
  const shadow = readFloorShadowFile(storage);
  data["floorShadow"] = shadow;
  const shadowLine = floorShadowLine(shadow);
  // THE STEP-IN READING (`engine-fall`): a fallen vessel answers no verbs, so the falls resting beside the store and every id a
  // boot holds (in flight at a fall, or in quarantine) read from the files themselves, the same whether the vessel stands, has
  // fallen, or rests stopped.
  const falls = readEngineFalls(storage).map((f) => ({ life: f.life, pid: f.pid, cause: f.cause, path: f.path, since: f.since, inFlight: f.inFlight }));
  const held = [
    ...heldInFlight(falls).map((documentId) => ({ documentId, why: "in-flight" as const })),
    ...quarantineHolds(storage).map((h) => ({ documentId: h.manifest.documentId, why: "quarantine" as const })),
  ];
  data["engineFalls"] = falls;
  data["held"] = held;
  let residencyLine: string | null = null;

  // C.4 — when the daemon is reachable, ask it for a residency snapshot. The CLI
  // reaches the daemon through the UDS verb socket alone, so that — not the WS
  // relay port — gates the read. Cheap call; any failure falls through silently.
  const daemonReachable = await udsAlive();
  if (daemonReachable) {
    try {
      const { summaryOutput } = await import("../verb-result.js");
      const { runVerb } = await import("../verb-call.js");
      // One line over the sock (the lares↔lararium binding). Cheap probe; any failure
      // falls through silently — `lares vessel read` never errors. The residency verb is
      // cap-gated, so it needs the real VESSEL did (a non-did requestedBy cap-errors
      // quietly) — the Place is what asks.
      const did = await vesselDid();
      const r = await runVerb("residency", {}, did, { timeoutMs: 2000 });
      if (r.status === "done") {
        const stats   = summaryOutput(r) ?? {};
        const pinned  = (stats["pinned"] ?? []) as string[];
        const wela    = (stats["wela"]   ?? []) as Array<{ url: string }>;
        const anuCnt  = stats["anuCount"] as number;
        const hotCap  = stats["hotCap"]   as number;
        data["residency"] = { pinned: pinned.length, wela: wela.length, hotCap, anu: anuCnt };
        residencyLine = `${pinned.length} pinned · ${wela.length}/${hotCap} wela · ${anuCnt} anu`;
      }
    } catch {
      // Daemon up but residency probe failed — quiet.
    }
  }

  emit(args, {
    ok: true,
    data,
    human: () => {
      console.log("lares vessel read (local node)");
      console.log(`  bootstrap:   ${hasBoot ? "present" : "absent (run `lares vessel found`)"}`);
      console.log(`  storage:     ${storageStr}`);
      console.log(`  port ${port}:  ${portInUse ? "in use (node likely running)" : "free"}`);
      if (residencyLine) console.log(`  residency:   ${residencyLine}`);
      if (engine) console.log(`  engine:      ${engineMeterLine(engine)}`);
      console.log(`  ${shadowLine}`);
      if (falls.length > 0) {
        const last = falls[falls.length - 1]!;
        console.log(`  engine falls: ${falls.length} resting; the last ${last.cause} on the ${last.path} path since ${last.since}`);
        console.log(falls.length > ENGINE_RESTART_CAP
          ? `    hand act: ${ENGINE_DOWN_HAND_ACT}`
          : "    the vessel rose once; a clean stop (`lares vessel stop`) clears the count, and a second fall before one keeps it down");
      }
      for (const h of held) console.log(`  held:        ${h.documentId} (${h.why === "in-flight" ? "in flight at a fall" : "quarantine"})`);
      // Each hand act once, under the ids it frees.
      if (held.some((h) => h.why === "in-flight")) console.log(`    in flight: ${HELD_HAND_ACT}`);
      if (held.some((h) => h.why === "quarantine")) console.log(`    quarantine: ${QUARANTINE_RELEASE_ACT}`);
      console.log(guards === null
        ? `  memory:      the retention guards read nowhere: ${guardsUnread ?? "unread"}`
        : guardsHeld
        ? `  memory:      ${guards.length} retention guard(s) at their maximum`
        : `  memory:      ${guards.filter((r) => r.state !== "aligned").map((r) => r.id).join(", ")} below the maximum — \`lares home tend\` raises them`);
    },
  });
  return 0;
}
