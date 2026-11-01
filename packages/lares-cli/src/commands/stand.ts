/**
 * `lares vessel stand` — the boot ENTRY POINT. Idempotent on every awakening: it ATTACHES to a live Lararium
 * node or STANDS one detached when none answers (never a restart), CHECKS the mempalace sidecar, and
 * emits a live-delta hydration frame for the waking session.
 *
 * IT CARRIES TWO CAPABILITIES, AND `--observe` WITHHOLDS THE SECOND. Observing reports what stands and
 * touches nothing; standing brings a node up and founds a vessel. An unattended
 * caller — a session hook, a cron, anything that only wants a reading — holds the first alone, so
 * looking never decides what stands.
 *
 * STANDING WRITES `LAR_ROOT` AND NOTHING ELSE (the radius law, lar:///ha.ka.ba/lares/cli/reality-tunnel). The
 * mempalace library and the sensorium organs keep their own doors (`lares mempalace install`, `lares sense
 * setup`), and every operator home rides `lares home`, so a founding stays inside the vessel root. A stand still REPORTS what stands, because naming a missing
 * tool serves the operator and installing one behind them does not.
 *
 * The static CLAUDE.md @-import carries the canonical seed; this frame carries
 * only what is true right now. A degraded wake still returns 0 — the entry point
 * never hard-fails the session (the `ok` field tells the truth).
 */

import { existsSync, mkdirSync, openSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { repoRoot } from "@lararium/mesh/node";
import { fatalLine, derivePronaosDeskInputs, originDeclaration } from "@lararium/node";
import { faceStandsOnDisk } from "../floor-cure.js";
import { engineHeldByHost } from "../port-control.js";
import { standingPath, standingVerdict } from "@lararium/mesh/rendezvous-path";
import { larRoot, larBootstrapPath, larDataDir, larCasDir, vesselDid } from "../env.js";
import { udsAlive } from "../local-connector.js";
import { readVesselStanding, conditionOk } from "../vessel-condition.js";
import { emit } from "../render.js";
import { summaryOutput } from "../verb-result.js";
import { runVerb } from "../verb-call.js";
import { checkMempalaceIntegration, standOk } from "../integration-check.js";
import { standPageEnv } from "../stand-page.js";
import { foundIfAbsent, type FoundStep } from "../standup.js";
import type { ParsedArgs } from "../parse-args.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** This project's wing slug, from the session's cwd (matches the harvest wing). */
function wakeWing(): string {
  const base = (process.cwd().replace(/\\/g, "/").split("/").pop() ?? "").toLowerCase().replace(/[ -]/g, "_").replace(/[^a-z0-9_]/g, "");
  return `wing_${base || "unsorted"}`;
}

interface WakeRecall {
  readonly ok: boolean;
  readonly wing: string;
  readonly drawers?: number;
  readonly recent?: ReadonlyArray<{ room: string; preview: string }>;
  readonly note?: string;
}

/**
 * recall-into-wake — pull this project's recent journey THROUGH the daemon seat so
 * the woken session climbs already-remembering. Best-effort by construction: any
 * miss (no identity, daemon unreachable, recall error) returns {ok:false,note} and
 * the wake proceeds. A short timeout keeps it inside the SessionStart hook budget.
 */
async function recallIntoWake(): Promise<WakeRecall> {
  const wing = wakeWing();
  let did: string;
  try { did = await vesselDid(); }
  catch { return { ok: false, wing, note: "no operator identity" }; }
  try {
    // One cold holder start can take ~8s; after that the daemon pool is warm and
    // recall is sub-second. Give the first wake room; warm wakes return instantly.
    const r = await runVerb("recall", { wing, limit: 5 }, did, { timeoutMs: 9000 });
    if (r.status !== "done") return { ok: false, wing, note: r.errorMessage ?? "recall error" };
    const out = summaryOutput(r) ?? {};
    const rows = Array.isArray(out["imagines"]) ? (out["imagines"] as Array<Record<string, unknown>>) : [];
    const recent = rows.slice(0, 5).map((d) => ({
      room: typeof d["room"] === "string" ? d["room"] : "",
      preview: String(d["content_preview"] ?? d["content"] ?? d["preview"] ?? d["text"] ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
    }));
    return { ok: true, wing, drawers: typeof out["total"] === "number" ? out["total"] : rows.length, recent };
  } catch (e) {
    return { ok: false, wing, note: e instanceof Error ? e.message : String(e) };
  }
}

/** The standing a running vessel published beside its socket, or null when it published none. */
function readStandingMarker(): string | null {
  try { return readFileSync(standingPath({ root: larDataDir(), uid: process.getuid?.() ?? 0 }), "utf8"); }
  catch { return null; }
}


/**
 * Free the port so the lift's next stand boots fresh, and say how it went.
 *
 * `stopIncumbent` polls until the port actually frees on the incumbent's OWN exit — a graceful SIGTERM,
 * never an escalation to SIGKILL, which could tear a save the crash-atomic adapter's guarantee never
 * promised to survive a deliberate kill. So nothing here waits BEHIND it; it simply waits OUT it. A daemon
 * that outlives its grace is NAMED, once, rather than left wedged in silence — the wait keeps going past
 * the name, because this door never decides for the caller with a second signal.
 */
async function freePortForLift(port: number): Promise<string | null> {
  const { stopIncumbent } = await import("../port-control.js");
  let wedged: string | null = null;
  await stopIncumbent(port, {
    onPastGrace: (pids) => {
      wedged = pids.length > 0
        ? `the incumbent on :${port} is past its grace, still held by pid(s) ${pids.join(", ")} — waiting on its own exit`
        : `the incumbent on :${port} is past its grace, held by no discoverable pid — waiting on its own exit`;
      console.log(`[lares vessel stand] ${wedged}`);
    },
  });
  return null;
}

export async function cmdStand(args: ParsedArgs): Promise<number> {
  const port = Number(args.options["port"] ?? process.env["LAR_PORT"] ?? "8080");
  const root = larRoot();
  const bootstrap = larBootstrapPath();

  // 1. Found-if-absent (the whole shebang) under --init; else just report the cheap check.
  //    Each step is a no-op when its artifact is present; genesis is never rebuilt; the
  //    keypair is never wiped; --init never passes --force.
  // TWO CAPABILITIES RIDE HERE, AND A CALLER MAY HOLD ONLY THE FIRST.
  //   observe — report what stands. It carries no side effects, so it runs safely unattended.
  //   stand   — bring the node up and found a vessel. ACTS, every one, inside LAR_ROOT.
  // Fused, they let a caller asking "what stands right now" CHANGE what stands: merely looking started a
  // daemon. `--observe` withholds the acting half ENTIRELY and OUTRANKS every acting flag rather than
  // sitting beside them, so no flag further down an argv can talk a reading into an act.
  const observeOnly = args.flags["observe"] === true;

  let founding: FoundStep[] | undefined;
  // `--init` founds a vessel where the root holds none; every step stays idempotent.
  const doStandup = !observeOnly && args.flags["init"] === true;
  if (doStandup) founding = await foundIfAbsent(args, { root, bootstrap });

  // A REFUSED FOUNDING ENDS THE STAND. `cmdFound` printed the refusal by name; carrying on would wake a daemon over a
  // root that holds no vessel, and exiting 0 would let a caller (a witness, a script) read a founding that never
  // happened as one that did.
  const refusedStep = founding?.find((s) => s.step === "init" && s.action === "failed");
  if (founding !== undefined && refusedStep !== undefined) {
    emit(args, {
      ok: false,
      error: { code: "FoundingRefused", message: `the founding refused (${refusedStep.detail}); nothing stands. The refusal leads the lines above.` },
      data: { founding, root, bootstrap: existsSync(bootstrap) ? "present" : "absent" },
      human: () => {
        console.error(`lares vessel stand: FoundingRefused: ${refusedStep.detail}; no vessel was founded and no daemon was started.`);
      },
    });
    return 1;
  }

  // THE MEMPALACE RIDES AS A SIDECAR, AND FOUNDING ASSUMES NOTHING OF IT (operator ruling).
  //
  // Standing the library or the sensorium organs from here reaches OUTSIDE the vessel root, so a founding
  // could never be isolated: a throwaway rehearsal writes into the operator's real Python environment.
  //
  // Founding stands the VESSEL and nothing else. The two sidecar lanes carry their own doors:
  //   · `lares mempalace install`  — the library deps (submodule + pip)
  //   · `lares sense setup`        — the sovereign sensorium organs
  // Both stay idempotent and both no-op when already done.
  //
  // The CHECK stays here and stays cheap: a wake still REPORTS what stands, because reporting a missing
  // tool serves the operator and installing one behind their back does not.
  const integration = checkMempalaceIntegration();

  // 2. Ensure the node is up — attach if healthy, start detached if down. NOT a restart.
  // "Up" for the CLI means the UDS verb socket answers — the CLI reaches the daemon there
  // alone (the WS relay is the browser vessel's channel, not the CLI's; the CLI carries
  // one transport, the sock — lares↔lararium binding).
  // LIVENESS CONNECTS. A file-existence check reported a long-dead vessel as serving, and THIS line
  // consulted it before deciding whether to stand the node — so the vessel stayed down BECAUSE the corpse
  // of its socket kept reporting it up. A stale inode reads as down. The vessel's own claim reaps it as it binds
  // the name (`claimStore`): one reaper per corpse, so no unlink here can land on a name a holder has since bound.
  let nodeUp = await udsAlive();
  let started = false;
  let nodeNote = nodeUp ? "attached (already serving)" : "";

  // IDEMPOTENT TO INTENT, NEVER MERELY TO PRESENCE. A vessel reads its standing once, at boot, from the
  // face it found then — so a face lit afterward leaves a daemon serving the public shelf and refusing
  // every persona-scoped act, while its own refusal counsels an act that only attaches. Reading the
  // published standing against the face on disk is what lets a stand mean "stand as this vessel's state
  // implies" rather than "answer if something answers".
  //
  // Absence never licenses this: no marker, an unreadable one, or a writer that is gone all read
  // `attach`, so an older vessel or a crash never becomes a restart nobody asked for. `--observe`
  // withholds it like every other acting half.
  let liftReason: string | null = null;
  let standingReason: string | null = null;
  let standingAct: "attach" | "restand" | null = null;
  let hostRefusal: { readonly code: string; readonly message: string } | undefined;
  if (nodeUp) {
    const verdict = standingVerdict({
      marker:     readStandingMarker(),
      faceOnDisk: existsSync(bootstrap) && faceStandsOnDisk(bootstrap),
    });
    // THE VERDICT SPEAKS EITHER WAY. A reading that only announces itself when it acts leaves the
    // common case — attach — indistinguishable from never having read at all. Measured: a rehearsal
    // step reported `ok` while the floor stayed down, and nothing on screen said whether the door had
    // decided to attach or had never reached the decision. The reason rides the payload always.
    standingReason = verdict.reason;
    standingAct = verdict.act;
    if (verdict.act === "restand" && !observeOnly) {
      if (engineHeldByHost()) {
        // THE HOST HOLDS THE ENGINE (`LAR_ENGINE=host`, set by the image). Inside a container the daemon is the
        // container's main process: this CLI neither stops it nor spawns a second one. The verdict rides the
        // payload, and the host shim performs the restart.
        hostRefusal = {
          code: "EngineHeldByHost",
          message: `${verdict.reason} — restart the vessel from the host: lares-container.sh vessel stand`,
        };
        console.error(`[lares vessel stand] EngineHeldByHost: ${hostRefusal.message}`);
        nodeNote = "attached; the standing asks for a re-stand and the host holds the engine";
      } else {
        liftReason = verdict.reason;
        console.log(`[lares vessel stand] lifting: ${verdict.reason}`);
        const forced = await freePortForLift(port);
        if (forced !== null) {
          liftReason = `${verdict.reason} — ${forced}`;
          console.log(`[lares vessel stand] ${forced}`);
        }
        nodeUp = false;
        nodeNote = "re-stood — the standing no longer matched the face on disk";
      }
    }
  }

  if (!nodeUp && observeOnly) {
    nodeNote = "down — `--observe` withholds the stand; run `lares vessel stand` to serve";
  } else if (!nodeUp && engineHeldByHost()) {
    // The host holds the engine: a daemon that does not answer yet is the host's to wait on or restart.
    nodeNote = "the container runs and its daemon has not answered yet — the host holds the engine (lares-container.sh logs)";
  } else if (!nodeUp) {
    const distMain = join(repoRoot, "packages", "lararium-node", "dist", "src", "main.js");
    if (!existsSync(distMain)) {
      nodeNote = "node dist not built — run `pnpm -r build`, then `lares vessel stand`";
    } else if (!existsSync(bootstrap)) {
      nodeNote = "no bootstrap — run `lares vessel found` (or point LAR_ROOT at an initialized instance)";
    } else {
      const dataDir = larDataDir();   // runtime → <lares>/vessel
      mkdirSync(dataDir, { recursive: true });
      const log = join(dataDir, "stand.log");
      // Readiness is SELF-ATTESTED, not requested (no web2 /health probe): the node
      // writes its boot phases to this log — `phase → vessel-ready` on success,
      // `fatal:` on a boot fault. We read that attestation, local-first, from the byte
      // offset we start appending at.
      //   Cross-peer presence (who is breathing in the mesh) is a SEPARATE organ and
      //   never lives in a persisted/synced doc — least of all the oracle plane, the cache-stable
      //   federation floor. Per canon (api/pono/ea#not-a-heartbeat;
      //   DREAMNET-FEDERATION-RESEARCH "never write presence into the Automerge document"):
      //   presence rides an EPHEMERAL channel — `ea` once at establishment, then CRDT
      //   sync / frame:ack, or an ephemeral broadcast() with TTL derived locally. Presence
      //   ≠ record. This local log-sentinel is exactly the right node-local readiness organ.
      const startOffset = existsSync(log) ? statSync(log).size : 0;
      const logFd = openSync(log, "a");
      // Detached + unref so the hook never blocks on the long-lived daemon.
      // `--page` (an explicit act) names the desk's prepared Web root for the child; the node's composition verifies it.
      let childEnv: NodeJS.ProcessEnv = { ...process.env, LAR_CAS: larCasDir() };
      if (args.flags["page"] === true) {
        const declared = originDeclaration();
        const page = standPageEnv(childEnv, derivePronaosDeskInputs(repoRoot),
          { originDeclared: declared.sameOrigin !== undefined || declared.webOrigin !== undefined || declared.flowOrigin !== undefined });
        childEnv = { ...page.env };
        if (page.note !== null) console.error(`lares vessel stand: ${page.note}`);
      }
      const child = spawn("node", [distMain, "--port", String(port), "--root", root], {
        cwd: join(repoRoot, "packages", "lararium-node"),
        detached: true,
        windowsHide: true, // no console window on Windows; harmless on Unix
        stdio: ["ignore", logFd, logFd],
        // Export the corpus CAS dir so the daemon worker's resolveByCid reads the SAME
        // dir the CLI stages carrier bodies to (larCasDir) — deterministic across the two
        // processes regardless of the LAR_ROOT default. A verb rides references, not bodies.
        env: childEnv,
      });
      child.unref();
      started = true;

      const readAttestation = (): string => {
        try { return readFileSync(log, "utf8").slice(startOffset); } catch { return ""; }
      };
      // The sd_notify WATCHDOG idiom: a healthy boot that keeps WRITING to the log is making
      // progress, however long the corpus/keyhive replay runs — so extend the window whenever
      // the log grows, and fail only on a genuine STALL (no output for the idle span) or the
      // absolute ceiling. The adaptive window holds a slow-but-live boot instead of false-timing
      // it at a fixed 15s deadline. (The real CPU cost is paced/deferred separately; this stops the watcher lying.)
      // This door's own liveness patience — never a safety verdict — reads a monotonic clock,
      // so an adversarial or operator wall-clock set-back/set-forward changes neither how long
      // this wait actually ran nor when it gives up.
      const IDLE_MS = 30_000; // headroom for a silent heavy stretch (Automerge corpus materialize)
      const hardCap = performance.now() + 180_000;
      let idleDeadline = performance.now() + IDLE_MS;
      let seenLen = 0;
      let phase: "starting" | "ready" | "fault" = "starting";
      while (performance.now() < idleDeadline && performance.now() < hardCap) {
        const tail = readAttestation();
        if (/fatal:/.test(tail)) { phase = "fault"; break; }
        if (tail.includes("vessel-ready")) { phase = "ready"; break; }
        if (tail.length > seenLen) { seenLen = tail.length; idleDeadline = performance.now() + IDLE_MS; } // progress → extend
        await sleep(200);
      }
      // `vessel-ready` is attested BEFORE the daemon-keyhive gates settle, so a gate
      // fault (e.g. the Binding Gate) surfaces as a LATE `fatal:`. After a ready attestation,
      // settle and re-read for that late fault — never report up for a node that died.
      if (phase === "ready") {
        await sleep(1500);
        if (/fatal:/.test(readAttestation())) phase = "fault";
      }
      // A verb rides the UDS SOCKET, which binds LATER than vessel-ready and later than the
      // WS port — on a cold boot after founding, tens of seconds later. "Ready" must mean
      // the socket answers, or a caller (the seed leg, a hook recall) fires into the gap and
      // gets DaemonUnreachable. Poll the socket up to a cold-boot-generous deadline, still
      // bailing on a late fatal.
      //
      // A BIND THAT REFUSED IS NOT A BIND THAT IS SLOW. The channel logs `uds error: <cause>` the instant
      // `listen` refuses, and that line is not a `fatal:` — the node keeps serving, only the verb socket
      // never arrives. Polling the generous cold-boot deadline against it spends two silent minutes and
      // then reports an unexplained `up: false`, while the answer sat in the log the whole time.
      //
      // The commonest cause has a cure the operator can act on: a Unix socket path is capped near 108
      // bytes, so a deep LAR_ROOT (a scratch dir, a nested worktree) fails EINVAL while everything else
      // about the vessel stands correctly.
      let udsRefusal: string | null = null;
      if (phase === "ready") {
        const sockDeadline = performance.now() + 120_000;
        while (performance.now() < sockDeadline && !(await udsAlive())) {
          const tail = readAttestation();
          if (/fatal:/.test(tail)) { phase = "fault"; break; }
          const refused = /uds error: (.+)/.exec(tail);
          if (refused) { udsRefusal = refused[1]!.trim(); break; }
          await sleep(500);
        }
      }
      // ONE READING, FROM ONE PLACE. `readVesselStanding` folds what this supervisor OBSERVED into the
      // four-state condition the whole house reports in, and `ok` derives from that state — so the note
      // and the flag cannot disagree, whatever either says. The constructor refuses a ready-claiming
      // message on a state that has not earned it, which is the original fault made unconstructible
      // rather than merely avoided.
      const condition = readVesselStanding({
        started:   true,
        attested:  phase === "ready",
        accepting: await udsAlive(),
        refusal:   udsRefusal,
      });
      nodeUp = conditionOk(condition);
      nodeNote = phase === "fault"
        // A BOOT FAULT KEEPS ITS OWN VOICE. The node writes a cure-naming line, and a report answering with a PATH sends the
        // operator to a file at the moment they least want a detour, while the caller downstream fails on
        // the symptom and buries the cause. The line that knows the answer belongs where the question got
        // asked, so it rides verbatim rather than through the condition's vocabulary.
        ? `started then attested a boot fault: ${fatalLine(readAttestation()) ?? "see " + log}`
        : condition.state === "rising" && phase !== "ready"
          ? `starting detached (pid ${child.pid ?? "?"}); boot stalled (no log progress for 15s) — see ${log}`
          : `${condition.message} (pid ${child.pid ?? "?"})`
            + (condition.reason === "uds-refused" && /EINVAL/.test(udsRefusal ?? "")
                ? "  (a Unix socket path caps near 108 bytes — LAR_ROOT sits too deep)" : "");
    }
  }

  // 2b. Recall-into-wake — pull this project's recent journey so the woken session
  //     climbs already-remembering. Best-effort: never breaks the wake; skipped when
  //     the node isn't up (verbatim-always / recall-eventual).
  const recall = nodeUp ? await recallIntoWake() : undefined;

  // 2c. The founding NEXT-STEP hint — naming EVERY kahu rides its OWN deliberate `lares persona new <i>
  //     --name` act, THREE SYMMETRIC commands. The founder-mint (h0) SIGNS the founding bind at standup, so
  //     `persona new 0` LOADS that pre-standing operator-root idempotently and sets its PRIVATE pet-name;
  //     `new 1`/`new 2` mint the remaining kahu. The seat joins persona→kahu BY pet-name, so all three names
  //     MUST land before `lares nexus seal seat` seats the 2-of-3 quorum the immune antigen reads.
  //     Surfaced only under standup.
  const foundingHint: string[] | undefined = founding === undefined ? undefined : [
    `Founder persona h0 stands as the operator-root — its root signs the founding bind; \`persona new 0\` names it (idempotent — loads the founder, sets its pet-name).`,
    // The founding names come from the OPERATOR, never from this build — the roster forms at the seat from
    // the personas that declared a Handle and stood for a chair. So the counsel shows the SHAPE and leaves
    // every name blank.
    "lares persona new 0 --name '<private label>' --handle '<Handle>' --seat",
    "lares persona new 1 --name '<private label>' --handle '<Handle>' --seat   # …one command per kahu",
    `Then seat the 2-of-3 quorum from the named personas: lares nexus seal seat`,
    `(These three name the founding KAHU QUORUM, never a limit on faces — this vessel's own slot ceiling rides LAR_PERSONA_SLOTS.)`,
    // WHAT THE VAULT HOLDS, said HERE: the founding sealed every private row under the vessel key, so nothing waits
    // on a sealing movement, and each boot rests at the floor until a person unlocks it.
    "This vessel's private rows rest sealed under its vessel key from the founding. Every boot stands at the floor until `lares vault unlock`; `lares vault status` gives one reading of each file.",
  ];

  // 3. Emit the live-delta frame (dual output). Graceful: never hard-fail the wake.
  // The vessel's stand answers for the vessel. The memory library keeps its own door, so its absence reads
  // as absent and never as a failed stand; a half-installed one reads as a fault (`standOk`).
  // A re-stand the host alone may perform reads `ok: false` beside its named refusal; the standing verdict
  // still rides `data.standing` for the host's shim.
  const ok = standOk(nodeUp, integration.standing, hostRefusal !== undefined);
  emit(args, {
    ok,
    ...(hostRefusal !== undefined ? { error: hostRefusal } : {}),
    data: {
      // `cap` names which half the caller HELD, so a reader tells a vessel that refused to stand from one
      // nobody asked. Without it `up:false` reads identically under both, and that difference carries the
      // whole point of holding one cap rather than two.
      // A LIFT NAMES ITSELF IN THE RECORD. Killing a daemon and booting another is the largest thing
      // this verb does, so a caller reading the JSON learns it happened and why.
      ...(liftReason !== null ? { lifted: liftReason } : {}),
      ...(standingAct !== null ? { standing: { act: standingAct, reason: standingReason } } : {}),
      node: { up: nodeUp, started, port, note: nodeNote, cap: observeOnly ? "observe" : "observe+stand" },
      ...(recall !== undefined ? { recall } : {}),
      mempalace: { ok: integration.ok, standing: integration.standing, checks: integration.checks },
      ...(founding !== undefined ? { founding } : {}),
      ...(foundingHint !== undefined ? { foundingHint } : {}),
      root,
      bootstrap: existsSync(bootstrap) ? "present" : "absent",
      timestamp: new Date().toISOString(),
    },
    human: () => {
      console.log("lares vessel stand");
      console.log(`  node:        ${nodeUp ? "up" : "down"} on :${port}${nodeNote ? ` — ${nodeNote}` : ""}`);
      console.log(`  mempalace:   ${integration.standing === "absent" ? "absent (an optional organ; the vessel stands without it)" : integration.standing}`);
      for (const c of integration.checks) {
        console.log(`    ${c.ok ? "ok     " : integration.standing === "absent" ? "absent " : "MISSING"} ${c.name}: ${c.detail}`);
      }
      if (recall?.ok) console.log(`  recall:      ${recall.drawers ?? 0} drawers in ${recall.wing} — recent journey surfaced into the wake`);
      else if (recall) console.log(`  recall:      skipped (${recall.note})`);
      // A missing sidecar reads as COUNSEL, never as a silent install. The vessel stands without it;
      // the operator decides whether this machine also carries the memory tooling.
      if (integration.checks.some((c) => !c.ok)) {
        console.log(integration.standing === "absent"
          ? "  the mempalace sidecar stands absent — it is a SEPARATE tool, never part of founding. To add it:"
          : "  the mempalace sidecar stands incomplete — it is a SEPARATE tool, never part of founding:");
        console.log("    → lares mempalace install    the library deps (submodule + pip)");
        console.log("    → lares sense setup          the sovereign sensorium organs");
      }
      if (founding !== undefined) {
        console.log("  founding (--init):");
        for (const s of founding) console.log(`    ${s.action.padEnd(6)} ${s.step}: ${s.detail}`);
      }
      if (foundingHint !== undefined) {
        console.log("  next — stand the founding kahu quorum:");
        for (const h of foundingHint) console.log(`    → ${h}`);
      }
      console.log(`  root:        ${root}`);
      console.log(`  bootstrap:   ${existsSync(bootstrap) ? "present" : "absent"}`);
    },
  });

  // The wake never blocks the session; `ok` in the payload carries the verdict. One refusal exits non-zero: an
  // acting stand the host alone may perform.
  return hostRefusal === undefined ? 0 : 3;
}
