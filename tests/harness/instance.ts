/**
 * harness/instance — the ONE instance-targeting layer every e2e test uses.
 *
 * Two modes, selected by LAR_TARGET (the env contract: lares-cli/src/env.ts):
 *
 *   staged (default) — the harness OWNS the instance: ephemeral root under
 *     os.tmpdir(), random port, `lares vessel found` on a marked scratch root → daemon boot → await
 *     `phase → live` → tests run → daemon killed, root deleted. QA isolation
 *     by construction; every run starts from genesis.
 *
 *   live — the harness ATTACHES to a running lararium (LAR_ROOT + LAR_PORT
 *     required). It NEVER resets, never stops, never deletes — read-and-gesture
 *     only. Tests that mutate or assume genesis state MUST guard on
 *     `instance.mode === "staged"`.
 *
 * The harness drives the REAL `lares` CLI binary with the instance's env —
 * the same surface an operator's hands touch (tests/TEST-ARCHITECTURE.md:
 * exercise the live model, not fixtures).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { rendezvousPath } from "../../packages/lararium-mesh/src/rendezvous-path.js";
import { ed25519VerifyingKeyFromSeed } from "../../packages/lararium-mesh/src/auth-wire.js";
import { randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, existsSync, cpSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

/**
 * Remove a staged root, and WAIT OUT THE DAEMON'S LAST WRITES.
 *
 * A kill is a signal, never a barrier: the child is still flushing its store when the parent reaches for the
 * directory, so a plain recursive remove races the exit and throws `ENOTEMPTY` — the tree emptied, then the
 * daemon wrote one more file into it. Measured on the whole-set run: `face-grant-unseated-joinee` red on
 * `ENOTEMPTY, Directory not empty: …/lares-staged-pin-B-…`, a teardown fault reported as a suite failure.
 *
 * `maxRetries` is node's own answer to exactly this (it retries `EBUSY`/`EMFILE`/`ENFILE`/`ENOTEMPTY`/`EPERM`
 * with a linear backoff), so the cure adds no loop of ours to drift. `force` still swallows an absent path, so
 * a root already gone costs nothing.
 */
function removeStagedRoot(root: string): void {
  rmSync(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}
import { seedTestCustody, unlockTestCustody } from "./test-door.js";
import { join } from "node:path";
import { tmpdir } from "node:os";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");
const NODE_CWD  = join(REPO_ROOT, "packages/lararium-node");

export interface CliResult {
  readonly code:   number;
  readonly stdout: string;
  readonly stderr: string;
  /** Last JSON object on stdout when --json was passed (null when none parsed). */
  readonly json:   Record<string, unknown> | null;
}

export interface LarInstance {
  readonly mode: "staged" | "live";
  readonly root: string;
  readonly port: number;
  /** Daemon stdout+stderr captured so far (staged mode only). */
  readonly bootLog: () => string;
  /** Each `phase → <name>` line the daemon printed, stamped with monotonic ms since the founding began. */
  readonly bootPhases: () => readonly BootPhase[];
  /** Run the real lares CLI against THIS instance. */
  readonly cli: (args: readonly string[]) => Promise<CliResult>;
  /** Staged: kill daemon + delete root. Live: no-op (never touch a live hearth). */
  readonly stop: () => Promise<void>;
  /**
   * Staged: kill the daemon but PRESERVE the root — for reboot vectors that
   * boot a second daemon on the same fed store. Live: no-op.
   */
  readonly stopDaemonOnly: () => Promise<void>;
}

/** One boot phase, stamped on a monotonic clock — elapsed ms from the start of this vessel's founding. */
export interface BootPhase {
  readonly phase: string;
  readonly ms: number;
}

/**
 * Stop a child and WAIT FOR ITS EXIT — never a fixed pause.
 *
 * A kill is a signal, not a barrier. The daemon's SIGTERM path flushes its stores durably and then exits, and
 * how long that takes depends on what it wrote. A fixed sleep after the signal races that flush: a re-stand on
 * the same root meets a store the dying process still holds, and a teardown removes a tree it is still writing.
 * The child's own `exit` event is the barrier. A child that outlives `graceMs` (the daemon's own shutdown
 * budget is 6 s) meets SIGKILL, and the wait still ends on its exit.
 */
export async function stopChild(child: ChildProcess, graceMs = 15_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const outlived = await Promise.race([
    exited.then(() => false),
    new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(true), graceMs); }),
  ]);
  clearTimeout(timer);
  if (outlived) {
    child.kill("SIGKILL");
    await exited;
  }
}

/**
 * Append one record to this run's boot-phase timeline (`<LAR_E2E_RUN_DIR>/boot-phases.jsonl`), beside the JSON
 * report the e2e config writes. A run with no run directory named keeps its timeline on the instance alone.
 */
function recordTimeline(record: Record<string, unknown>): void {
  const dir = process.env["LAR_E2E_RUN_DIR"];
  if (!dir) return;
  try { appendFileSync(join(dir, "boot-phases.jsonl"), `${JSON.stringify(record)}\n`); } catch { /* a measurement, never a fault */ }
}

/** The real lares CLI under ONE instance's env pair — the same door `LarInstance.cli` opens. */
export function cliFor(env: Record<string, string>): (args: readonly string[]) => Promise<CliResult> {
  return (args) => runCli(env, args);
}

/**
 * A founding seals custody from birth and gathers its human route from a TTY alone, so a scripted harness names the
 * route EXPLICITLY: before `vessel found` it stages the scratch root and founds its custody with a fixed test
 * passphrase (`tools/seed-test-custody.mjs`, idempotent). The product carries no bypass for this.
 */
const FOUNDING_VERBS = new Set(["found"]);
function seedCustodyFor(env: Record<string, string>, args: readonly string[]): void {
  if (args[0] !== "vessel" || !FOUNDING_VERBS.has(args[1] ?? "")) return;
  const at = args.findIndex((a) => a === "--root" || a.startsWith("--root="));
  const named = at < 0 ? undefined : args[at]!.includes("=") ? args[at]!.split("=").slice(1).join("=") : args[at + 1];
  const root = named ?? env["LAR_ROOT"] ?? process.env["LAR_ROOT"];
  if (!root) return;
  stageGenesis(root);
  seedTestCustody(root);
}

function runCli(env: Record<string, string>, args: readonly string[]): Promise<CliResult> {
  seedCustodyFor(env, args);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI_BIN, ...args], {
      env: { ...process.env, ...env },
      cwd: REPO_ROOT,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += String(d); });
    child.stderr.on("data", (d) => { stderr += String(d); });
    child.on("close", (code) => {
      let json: Record<string, unknown> | null = null;
      for (const line of stdout.trim().split("\n").reverse()) {
        try { json = JSON.parse(line) as Record<string, unknown>; break; } catch { /* not json */ }
      }
      resolve({ code: code ?? -1, stdout, stderr, json });
    });
  });
}

/**
 * A carriage crossroads the rig stands, PINNED: its gate seed chosen here, so the address every hearth dials
 * carries the relay's gate key in its fragment (`ws://127.0.0.1:<port>#<gate key>`) — the pin the dial knocks
 * with and reads the relay's verdict under. The herm takes the seed as `LAR_HERM_RELAY_SEED`.
 */
export async function pinnedCarriageRelay(port: number): Promise<{ readonly url: string; readonly seedHex: string; readonly gatePubKey: string }> {
  const seed = new Uint8Array(randomBytes(32));
  const gatePubKey = await ed25519VerifyingKeyFromSeed(seed);
  return { url: `ws://127.0.0.1:${port}#${gatePubKey}`, seedHex: Buffer.from(seed).toString("hex"), gatePubKey };
}

/** An OS-assigned free port (bind :0 → read the assigned port → close). Collision-
 *  FREE at that instant — strictly better than the old PID-stride guess (which only
 *  reduced collisions). Tiny TOCTOU before the daemon binds; acceptable for tests. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const p = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => (p ? resolve(p) : reject(new Error("freePort: no port assigned"))));
    });
  });
}

/**
 * Where a staged root is minted. `LAR_STAGE_DIR` names it; else the OS temp dir. A run beside an
 * operator's live hearth stages under its own directory so nothing it mints sits next to the hearth's.
 */
export function stageDir(): string {
  const named = process.env["LAR_STAGE_DIR"];
  if (named) { mkdirSync(named, { recursive: true }); return named; }
  return tmpdir();
}

/** Copy the tracked seed island into an isolated root before its founding rite. */
export function stageGenesis(root: string): void {
  const target = join(root, "genesis");
  if (existsSync(join(target, "seed.json")) && existsSync(join(target, "cas"))) return;
  cpSync(join(REPO_ROOT, "genesis"), target, { recursive: true });
}

/** How a staged vessel is founded and stood — the defaults are the hearth every suite inherits. */
export interface StageOptions {
  /** A name for the root, so two vessels in one run read apart on disk (`lares-staged-<tag>-`). */
  readonly tag?: string;
  /** A root already minted — for a vessel whose rite ran before it stands. Deleted at `stop` like any other. */
  readonly root?: string;
  /** A port already chosen — so a rite that names this vessel's dial (`--sync-url`) can run before it stands. */
  readonly port?: number;
  /**
   * The founding rite, run before the daemon stands. Defaults to the Stable founding act on the marked scratch root
   * (`vessel found --hearth`: the place, persona zero, the seed charter, the face). A suite standing a JOINER or a
   * HERM performs its own rite here against the same root and env the daemon will then read.
   */
  readonly found?: (cli: (args: readonly string[]) => Promise<CliResult>, root: string) => Promise<void>;
  /** Extra environment the DAEMON stands with (a peer to dial, a gate to bind to). The CLI env stays the pair. */
  readonly daemonEnv?: Record<string, string>;
  /**
   * Leave the vessel's custody LOCKED once it stands. By default the harness unlocks every staged vessel through
   * the test door the moment its daemon answers; a suite that measures the floor, or performs its own unlock
   * walk, asks for the lock here.
   */
  readonly locked?: boolean;
}

/**
 * Unlock a staged vessel a suite stood by its own hand. A vessel stands holding no vessel key; this opens it
 * through the test door and returns once the daemon has composed again. A root holding no custody tree has nothing
 * to unlock. Any other refusal throws, naming the door's answer.
 */
export function unlockStaged(root: string): void {
  // The door answers rc 3 while no daemon holds the root's rendezvous name yet: a stand a suite just asked for may
  // still open its claim. The wait COUNTS looks (a short pause between them) and never compares a clock.
  let last = unlockTestCustody(root);
  for (let look = 0; last.code === 3 && look < UNLOCK_LOOKS; look++) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    last = unlockTestCustody(root);
  }
  const { code, answer, stderr } = last;
  if (code !== 0 && answer?.["reading"] !== "tree-absent") {
    throw new Error(`staged vessel never unlocked (door rc ${code}): ${JSON.stringify(answer)} ${stderr.slice(-400)}`);
  }
}

/** How many looks `unlockStaged` gives a daemon that does not answer yet. */
const UNLOCK_LOOKS = 240;

/**
 * The cold-key card each staged hearth's founding printed, by root. On a staged root the read-back stands in and the
 * founding's JSON answer carries the card's code; a rite that grows the quorum reveals it to roll the seed charter.
 * Test roots alone: a live card never rests anywhere but on its paper.
 */
const hearthCards = new Map<string, string>();

/**
 * THE STABLE FOUNDING ACT on a staged root: the place, persona zero under `name`, its one-seat seed charter and the
 * face that binds its AID, in one CLI act. Answers the card's code (the stand-in printed it into the JSON answer).
 */
export async function foundStagedHearth(cli: (args: readonly string[]) => Promise<CliResult>, root: string, name: string): Promise<string> {
  const found = await cli(["vessel", "found", "--hearth", "--name", name, "--root", root, "--skip-build", "--json"]);
  if (found.code !== 0) throw new Error(`staged hearth founding failed (${found.code}):\n${found.stdout.slice(-400)}\n${found.stderr.slice(-800)}`);
  const data = (found.json?.["data"] ?? {}) as { cards?: Array<{ code?: string }> };
  const code = data.cards?.[0]?.code ?? "";
  if (!code) throw new Error(`staged hearth founding printed no card code (the read-back stand-in answers it on a staged root):\n${found.stdout.slice(-600)}`);
  hearthCards.set(root, code);
  return code;
}

/**
 * GROW A STAGED HEARTH'S QUORUM by the roll its seed charter armed: each handle stands for a chair on a face of its
 * own (h1, h2, …) beside the seed chair persona zero holds, then the seed card reveals and `seal rotate` rolls the
 * charter to every chair that stands, under a majority rule. The AID the founding minted stays the hearth's name.
 */
export async function growStagedQuorum(cli: (args: readonly string[]) => Promise<CliResult>, root: string, handles: readonly string[]): Promise<void> {
  const code = hearthCards.get(root);
  if (!code) throw new Error(`no staged hearth card stands for ${root}: found it with foundStagedHearth first`);
  let i = 1;
  for (const handle of handles) {
    const k = await cli(["persona", "new", String(i), "--name", `kahu-${i}`, "--handle", handle, "--seat"]);
    if (k.code !== 0) throw new Error(`kahu ${i} failed (${k.code})\n${k.stderr.slice(-800)}`);
    i += 1;
  }
  const chairs = handles.length + 1;
  const roll = await cli(["nexus", "seal", "rotate", "--cold-key", code, "--threshold", String(Math.floor(chairs / 2) + 1), "--json"]);
  if (roll.code !== 0) throw new Error(`seal rotate failed (${roll.code})\n${roll.stdout.slice(-400)}\n${roll.stderr.slice(-800)}`);
  const next = ((roll.json?.["data"] ?? {}) as { cards?: Array<{ code?: string }> }).cards?.map((c) => c.code ?? "").filter((c) => c.length > 0) ?? [];
  hearthCards.set(root, next.join(","));
}

/** The default rite: the Stable founding act. */
async function foundHearth(cli: (args: readonly string[]) => Promise<CliResult>, root: string): Promise<void> {
  await foundStagedHearth(cli, root, "staged");
}

/** Stand ONE staged vessel under its own root and port. `targetInstance` calls this with the defaults. */
export async function openStaged(opts: StageOptions = {}): Promise<LarInstance> {
  const root = opts.root ?? mkdtempSync(join(stageDir(), `lares-staged-${opts.tag ? `${opts.tag}-` : ""}`));
  stageGenesis(root);
  // OS-assigned free port — each staged island its own port, collision-free
  // (causal-island isolation; was a PID-stride guess that only reduced collisions).
  const port = opts.port ?? await freePort();
  const env  = { LAR_ROOT: root, LAR_PORT: String(port) };
  const cli  = (args: readonly string[]) => runCli(env, args);
  // ONE MONOTONIC ORIGIN for every stamp this vessel carries. The timeline is a measurement read by a human
  // deciding where boot time goes; it decides nothing, and it never reads a wall clock.
  const t0 = performance.now();
  const since = (): number => Math.round(performance.now() - t0);

  try {
    await (opts.found ?? foundHearth)(cli, root);
  } catch (err) {
    // A root the caller handed in stays the caller's to remove, here as at a failed unlock below.
    if (opts.root === undefined) removeStagedRoot(root);
    throw err;
  }
  const foundMs = since();

  // Boot the daemon from dist; capture its log; await `phase → live`. Each `phase →` line is stamped as it
  // arrives; the log itself stays byte-whole, because suites read it.
  let log = "";
  let partial = "";
  const phases: BootPhase[] = [];
  const capture = (d: unknown): void => {
    const text = String(d);
    log += text;
    const lines = (partial + text).split("\n");
    partial = lines.pop() ?? "";
    for (const line of lines) {
      const m = /phase → (\S+)/.exec(line);
      if (m) phases.push({ phase: m[1]!, ms: since() });
    }
  };
  const daemon: ChildProcess = spawn(process.execPath, [NODE_MAIN, "--root", root, "--port", String(port)], {
    cwd: NODE_CWD,
    env: { ...process.env, ...env, ...(opts.daemonEnv ?? {}) },
  });
  daemon.stdout?.on("data", capture);
  daemon.stderr?.on("data", capture);

  const liveBy = performance.now() + 120_000;
  await new Promise<void>((resolve, reject) => {
    const poll = setInterval(() => {
      if (log.includes("phase → live")) { clearInterval(poll); resolve(); }
      else if (daemon.exitCode !== null) { clearInterval(poll); reject(new Error(`staged daemon exited ${daemon.exitCode} before live:\n${log.slice(-6000)}`)); }
      else if (performance.now() > liveBy) { clearInterval(poll); reject(new Error(`staged daemon never reached live (120s):\n${log.slice(-800)}`)); }
    }, 250);
  });
  const name = root.split("/").pop() ?? root;
  recordTimeline({ vessel: name, event: "live", foundMs, phases });

  // THE UNLOCK. A vessel stands holding no vessel key; the harness opens it through the test door (the marked
  // root's published route) the moment the daemon answers. The door returns once the daemon has composed again
  // with what the key opens, so a suite meets the vessel in the standing it will keep. A root that holds no
  // custody tree has nothing to unlock and stands as it stood.
  if (!opts.locked) {
    try {
      unlockStaged(root);
    } catch (err) {
      // THE DAEMON'S OWN WORDS RIDE THE REFUSAL. The looks above hold this process's event loop, so the daemon's
      // pipe and its exit both wait unread until a turn passes: give one, then say how the daemon stands and what
      // it last said. A door that reads "no daemon answers" names a symptom; the log names the fault.
      await new Promise((r) => setTimeout(r, 500));
      const stands = daemon.exitCode !== null ? `exited ${daemon.exitCode}`
        : daemon.signalCode !== null ? `died on ${daemon.signalCode}` : "still stands";
      await stopChild(daemon);
      // A root the caller handed in stays the caller's to remove: its own teardown owns it, and a suite that reads
      // what a founding left there still finds it.
      if (opts.root === undefined) removeStagedRoot(root);
      const why = err instanceof Error ? err.message : String(err);
      throw new Error(`${why}\n  the daemon ${stands}; its log ends:\n${log.slice(-6000)}`);
    }
    recordTimeline({ vessel: name, event: "unlocked", unlockMs: since() });
  }

  const halt = async (removeRoot: boolean): Promise<void> => {
    const from = since();
    await stopChild(daemon);
    recordTimeline({ vessel: name, event: removeRoot ? "stop" : "stop-daemon-only", stopMs: since() - from });
    if (removeRoot) removeStagedRoot(root);
  };

  return {
    mode: "staged",
    root,
    port,
    bootLog: () => log,
    bootPhases: () => phases,
    cli,
    stop: () => halt(true),
    stopDaemonOnly: () => halt(false),
  };
}

function attachLive(): LarInstance {
  const root = process.env["LAR_ROOT"];
  const port = Number(process.env["LAR_PORT"] ?? 8080);
  if (!root) throw new Error("LAR_TARGET=live requires LAR_ROOT (and usually LAR_PORT) to name the instance");
  // A FOUNDED vessel proves itself by its own address book, which lives with the store it addresses —
  // never in genesis/, where only the shared seed rides. Under LAR_ROOT the store sites at
  // <root>/data/lares/vessel: every directory under an isolated root names an XDG KIND, and the two
  // HOUSES nest inside the data kind exactly as they do under XDG.
  if (!existsSync(join(root, "data", "lares", "vessel", "social-bootstrap.json"))) {
    throw new Error(`LAR_TARGET=live: no social bootstrap at ${root}/data/lares/vessel — has this root been founded?`);
  }
  const env = { LAR_ROOT: root, LAR_PORT: String(port) };
  return {
    mode: "live",
    root,
    port,
    bootLog: () => "",                 // a live hearth's log belongs to its operator
    bootPhases: () => [],
    cli: (args) => runCli(env, args),
    stop: async () => { /* NEVER stop, reset, or delete a live instance */ },
    stopDaemonOnly: async () => { /* NEVER touch a live hearth's daemon */ },
  };
}

/** Target an instance per LAR_TARGET: "live" attaches; anything else stages. */
export async function targetInstance(): Promise<LarInstance> {
  return process.env["LAR_TARGET"] === "live" ? attachLive() : openStaged();
}

/**
 * The vessel's Automerge STORE on disk — the one path a raw-storage read may open.
 *
 * It rides in the SPIRITS' house (`<root>/data/lares/vessel`) because a vessel substrate is the spirits':
 * a Lar wakes, acts and gives way, and `bake` re-derives the genesis engine while the staged root starts from a fresh scratch directory. What
 * belongs to the HOUSE — the acquired shelf, the sensoriums — stands beside it at `<root>/data/lararium`,
 * and `<root>/state` keeps watermarks alone. A house never stands where a kind belongs, so an isolated
 * root reads as the real disk with a different prefix.
 *
 * NAME THE ADDRESS EXACTLY. A wrong path here does not fail loudly — it opens an absent directory, finds
 * no chunks, and reports the document "unavailable", which reads as a replication fault.
 */
/**
 * The rendezvous socket a staged instance's daemon binds — DERIVED, never hunted.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
 * Two suites walked the instance ROOT looking for a file named `lares.sock`, and the rendezvous is
 * neither there nor called that: `rendezvousPath` mints `/tmp/lares-<uid>/<sha256(root)[0..12]>.sock`
 * so the whole path stays a fixed 40 bytes however deep a root runs, and so two roots on one machine
 * stay apart. The hunt returned nothing, every vector downstream failed on an empty string, and
 * NINE e2e reds read as broken civic ceremonies when the ceremonies were never reached.
 *
 * Both sides of a rendezvous MUST derive it from one function — the CLI's own connector says so, and
 * `rendezvous-parity-witness` gates the TS and python spellings against each other. A harness that
 * greps for a filename is a third spelling nobody gated.
 *
 * Returns the DIRECTORY, which is what `invokeLocal({ dataDir })` wants: the connector re-derives the
 * socket from the root, so handing it the instance root is the honest answer.
 */
export function rendezvousSocket(instance: LarInstance): string {
  // THE DIGEST IS OVER THE SUBSTRATE DIR, NOT THE INSTANCE ROOT. `local-connector` derives
  // `rendezvousPath({ root: dataDir ?? larDataDir() })`, and `larDataDir()` resolves to
  // `<LAR_ROOT>/data/lares/vessel` — so hashing the bare root names a socket nothing ever binds.
  return rendezvousPath({ root: vesselStorageDir(instance), uid: process.getuid?.() ?? 0 });
}

/**
 * Wait until this instance's daemon SERVES its rendezvous — its verb channel has taken the store's claim over.
 *
 * A vessel binds the name before its Repo opens (`claimStore`) and holds callers there until its channel serves, so a
 * name standing says only that a vessel holds the store. A staged daemon names the moment its channel serves in its
 * own log; a live hearth already serves. Every boot rests at the floor and serves its channel there, before a person
 * unlocks, so that line stands ahead of the hearth's own banner: a caller that needs the gate key a joinee dials waits
 * for it by `awaitOwnGateKey`, never by this.
 */
export async function awaitRendezvous(instance: LarInstance, timeoutMs = 60_000): Promise<boolean> {
  const sock = rendezvousSocket(instance);
  const deadline = performance.now() + timeoutMs;
  const serves = (): boolean => instance.mode !== "staged" || instance.bootLog().includes("uds verb-channel on");
  for (;;) {
    if (existsSync(sock) && serves()) return true;
    if (performance.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, 250));
  }
}

export function vesselStorageDir(instance: LarInstance): string {
  return join(instance.root, "data", "lares", "vessel");
}

/** Read a `key: automerge:...` line from the staged boot log (e.g. "lararium", "catalog"). */
export function bootDocUrl(instance: LarInstance, key: string): string | null {
  const m = instance.bootLog().match(new RegExp(`${key}:\\s+(automerge:[A-Za-z0-9]+)`));
  return m?.[1] ?? null;
}

// ── THE FLEET — a Herm at the crossroads, a founder A, a same-operator joiner C ─────────────────────────────
//
// The three-vessel shape basket-one #/the-fetch-door names: a HERM stands the carriage crossroads (Socket B)
// and the public read-face (`/bulb/…` · `/cas/<cid>`); A founds a hearth and dials the Herm's crossroads; C
// founds by A's signed device edge (the admit rite `meme-two-vessel-bag` proves), dials A's `/ws` for the CRDT
// (Socket A) and the Herm's crossroads for bytes (Socket B), and names the Herm's read-face as its public shore
// (`LAR_HERM_SHORE`). The Herm lights NO face — `vessel found` founds a PLACE, and a place with no face
// stands at the waking floor as a Herm by class.

export interface StagedFleet {
  readonly herm: LarInstance;
  readonly A:    LarInstance;
  readonly C:    LarInstance;
  /** The Herm's carriage crossroads (Socket B) both hearths dial. */
  readonly relayUrl: string;
  /** The Herm's public read-face (`http://127.0.0.1:<port>`) — `/cas/<cid>` answers here. */
  readonly hermShore: string;
  /** What C's `vessel found --admit` said. */
  readonly admitted: CliResult;
  /** Every line of the carriage crossing (export · import · carry-for · carry · re-stand · public registration). */
  readonly crossing: string;
  /** Tear all three down (C · A · Herm), deleting every staged root. A vessel already stopped is skipped. */
  readonly stop: () => Promise<void>;
}

/** Stand the fleet. Throws (and tears down what stood) when any of the three never reaches live. */
export async function openStagedFleet(opts: { readonly tag?: string } = {}): Promise<StagedFleet> {
  const tag = opts.tag ? `${opts.tag}-` : "";
  const [portHerm, portRelay] = await Promise.all([freePort(), freePort()]);
  const relay     = await pinnedCarriageRelay(portRelay);
  const relayUrl  = relay.url;
  const hermShore = `http://127.0.0.1:${portHerm}`;
  const stood: LarInstance[] = [];
  let pairRef: StagedJoinee | null = null;
  // C · A (through the pair's own stop, which also deletes C's staged root) · then the Herm.
  const teardown = async (): Promise<void> => {
    if (pairRef) { await pairRef.stop(); pairRef = null; }
    for (const v of stood.reverse()) await v.stop();
  };
  const hermEnv = { LAR_RECIPE: "herm", LAR_HERM_RELAY_PORT: String(portRelay), LAR_HERM_RELAY_SEED: relay.seedHex };
  const hermFound = async (cli: (a: readonly string[]) => Promise<CliResult>, root: string): Promise<void> => {
    const found = await cli(["vessel", "found", "--root", root, "--skip-build"]);
    if (found.code !== 0) throw new Error(`herm: founding failed (${found.code})\n${found.stderr.slice(-800)}`);
  };
  const crossing: string[] = [];
  try {
    // The Herm: a place, no face; the crossroads relay on its own port; the read-face on `portHerm`.
    let herm = await openStaged({ tag: `${tag}herm`, port: portHerm, daemonEnv: hermEnv, found: hermFound });
    stood.push(herm);

    // A founds (seating a founding quorum, so a charter exists to carry FOR); C mints under its own root; A
    // signs the edge naming its dial; C founds by that payload — the joinee rite, one door, with both hearths
    // dialing the Herm's crossroads and shore.
    const pair = await openStagedJoinee({
      tag: `${tag}fleet`,
      daemonEnv: { LAR_CARRIAGE_RELAY: relayUrl, LAR_HERM_SHORE: hermShore },
      riteA: async (cliA, rootA) => {
        // A registers a realm bag below, and a steward seals with the face she WEARS (`realm-steward`).
        const wear = await cliA(["persona", "wear", "0"]);
        if (wear.code !== 0) throw new Error(`A: persona wear 0 failed (${wear.code})\n${wear.stderr.slice(-800)}`);
        // The seed charter grows to three chairs by the roll its founding armed; its AID stays A's hearth.
        await growStagedQuorum(cliA, rootA, ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"]);
      },
      // ── THE CARRIAGE CROSSING, run while A stands live and C has not yet booted ──────────────────────
      // A Herm holds no face by class (`personaSlotCeiling("herm") === 0`), so it enters a Nexus by the
      // CARRIER relation and never the member one: A's charter crosses by `seal export`/`seal import`, the
      // place signs "I carry for this Nexus" with its OWN vessel key (`nexus carry-for` — no persona read),
      // and A's quorum seats that seal (`nexus carry <key> --carrier <hex>`). Then the place stands again
      // DIALING A on Socket A, so the realm doc A's charter names reaches the Herm's own replica and its
      // standing fold answers; A registers the book at PUBLIC, which is the one tier the carrier leg opens.
      beforeB: async (A) => {
        const exp = await A.cli(["nexus", "seal", "export", "--no-json"]);
        crossing.push(`A nexus seal export → ${exp.code} (${exp.stdout.length} chars)`);
        if (exp.code !== 0 || !exp.stdout.trim()) throw new Error(`fleet: A exported no charter (${exp.code})\n${exp.stderr.slice(-600)}`);
        const charter = join(herm.root, "a-charter.mem");
        writeFileSync(charter, exp.stdout, "utf8");
        const imp = await herm.cli(["nexus", "seal", "import", charter, "--json"]);
        crossing.push(`herm nexus seal import → ${imp.code}: ${imp.stdout.trim().slice(0, 160)}`);
        if (imp.code !== 0) throw new Error(`fleet: the Herm refused the charter (${imp.code})\n${imp.stderr.slice(-600)}`);
        const carryFor = await herm.cli(["nexus", "carry-for", "--json"]);
        crossing.push(`herm nexus carry-for → ${carryFor.code}: ${carryFor.stdout.trim().slice(0, 160)}`);
        const cf = (carryFor.json?.["data"] ?? carryFor.json ?? {}) as Record<string, unknown>;
        const nym = typeof cf["nym"] === "string" ? cf["nym"] : "";
        const sig = typeof cf["carrierSig"] === "string" ? cf["carrierSig"] : "";
        if (!nym || !sig) throw new Error(`fleet: carry-for minted no seal\n${carryFor.stdout}\n${carryFor.stderr.slice(-600)}`);
        const carry = await A.cli(["nexus", "carry", nym, "--carrier", sig, "--json"]);
        crossing.push(`A nexus carry ${nym.slice(0, 12)}… → ${carry.code}: ${carry.stdout.trim().slice(0, 160)}`);
        if (carry.code !== 0) throw new Error(`fleet: A refused the carrier seal (${carry.code})\n${carry.stderr.slice(-600)}`);
        // L1: `nexus refresh` is a RETIRED verb — `nexus carry` already ran as a `nexus-contract` door row
        // against A's standing vessel, which fires the SAME `afterRoll` hook every board write fires.

        // The DIAL is a boot reading — `LAR_JOIN_SYNC`/`LAR_JOIN_GATE` mount the client adapter as the vessel
        // opens, and no running verb seats one. So the place stands again on its own root, carrying the dial.
        const gateA = await awaitOwnGateKey(A);
        await herm.stopDaemonOnly();
        herm = await openStaged({
          root: herm.root, port: portHerm, found: async () => { /* founded above; the store stands */ },
          daemonEnv: { ...hermEnv, LAR_JOIN_SYNC: `ws://127.0.0.1:${A.port}/ws`, LAR_JOIN_GATE: gateA },
        });
        stood[0] = herm;
        crossing.push(`herm re-stood dialing A: ${herm.bootLog().includes("[nexus-join]") ? "[nexus-join] seen" : "no [nexus-join] line"}`);

        // The book registers at PUBLIC — the tier the carrier leg reads, and the only one it reads.
        const reg = await A.cli(["nexus", "realm-bag", "lares", "--tier", "public", "--json"]);
        crossing.push(`A nexus realm-bag lares --tier public → ${reg.code}: ${reg.stdout.trim().slice(0, 200)}`);
        if (reg.code !== 0) throw new Error(`fleet: A registered no public book (${reg.code})\n${reg.stderr.slice(-600)}`);
      },
    });
    pairRef = pair;
    if (!pair.B) throw new Error(`C never stood: ${pair.joinGate ?? "(no line)"}`);
    const A = pair.A, C = pair.B, admitted = pair.admitted;
    return { herm, A, C, relayUrl, hermShore, admitted, crossing: crossing.join("\n  "), stop: teardown };
  } catch (err) {
    await teardown();
    throw err;
  }
}

/**
 * The gate key a vessel's OWN `/ws` gate stands behind, read off its boot log: the `[lararium] gate key:` line a
 * hearth prints once it composes. A vessel that also stands a carriage crossroads (`LAR_HERM_RELAY_PORT`) prints a
 * second key under `[herm]   gate key:`, the RELAY's, and prints it first, because every boot rests at the floor
 * before the unlock composes the hearth. A joiner handed the relay's key as `LAR_JOIN_GATE` resolves its Nexus
 * island under that key, finds no board there, and halts at its Binding Gate. So the reader names the hearth's
 * line and never the first `gate key:` in the log.
 */
export function ownGateKey(bootLog: string): string | null {
  return /^\[lararium\] gate key: ([0-9a-f]{64})$/m.exec(bootLog)?.[1] ?? null;
}

/**
 * A staged hearth's own gate key, once its log names it. The hearth prints the line a beat after it composes, so
 * the read looks until the line stands, inside its own budget, and a hearth that never names a key throws by name:
 * a joiner never boots dialing an empty or a borrowed gate.
 */
export async function awaitOwnGateKey(instance: LarInstance, timeoutMs = 60_000): Promise<string> {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const key = ownGateKey(instance.bootLog());
    if (key) return key;
    if (performance.now() > deadline) throw new Error(`the hearth's log named no gate key of its own:\n${instance.bootLog().slice(-800)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

// ── THE JOINEE RITE — one door, four suites ─────────────────────────────────────────────────────
/**
 * A founds and signs; B mints under its own root and founds by the payload; B boots dialing A (by env,
 * or by the PIN its edge carries). Four suites wrote this rite by hand, 67–158 lines each, and drifted
 * one at a time (a retired `vessel bake` door broke two of them a day apart). One spelling, here.
 */
export interface JoineeOptions {
  /** Tag prefix for the two roots (`<tag>A-` · `<tag>B-`). */
  readonly tag?: string;
  /** Env both daemons carry (a carriage relay, a Herm shore). */
  readonly daemonEnv?: Record<string, string>;
  /** Env A alone carries (e.g. `LAR_HERM_RELAY_PORT`). */
  readonly daemonEnvA?: Record<string, string>;
  /**
   * The one document B should ask for after its Socket A crossing. By default the harness asks for A's
   * Lararium document; a board-level witness may name A's deterministic Crossroads document instead.
   * This changes only the requested read, never the admission or gate relation.
   */
  readonly joinDocUrl?: string | ((A: LarInstance) => string | null | Promise<string | null>);
  /** A's own rite BEYOND the Stable founding act, run while NO daemon stands — where a suite grows the seed
   *  charter to a founding quorum (`growStagedQuorum`: chairs stand, the seed card reveals, `seal rotate`). */
  readonly riteA?: (cli: (args: readonly string[]) => Promise<CliResult>, root: string) => Promise<void>;
  /** How B learns A's dial: `"env"` (LAR_JOIN_SYNC/GATE/DOC off A's log and registry) or `"pin"`
   *  (nothing — B boots by the hearth its signed edge names). Default `"env"`. */
  readonly dial?: "env" | "pin";
  /** Runs once A stands live and before B boots — the place a suite lands a record on A first. */
  readonly beforeB?: (A: LarInstance) => Promise<void>;
  /** Boot B at all? A suite measuring a founding alone passes false. Default true. */
  readonly bootB?: boolean;
  /**
   * Which door B joins by. `"fleet-join"` (the default): B founds a PLACE, then the three files cross by hand
   * (`fleet join offer` on A, `request` on B, `answer` on A) and B lands the answer onto its place. `admitted`
   * then holds the land's result. `"device-admit"`: B mints its key, A signs an edge, B founds by it.
   */
  readonly door?: "device-admit" | "fleet-join";
  /** On the fleet-join door, runs once the answer stands on disk and before B lands it (a suite's tamper vector). */
  readonly beforeLand?: (cliB: (args: readonly string[]) => Promise<CliResult>, files: FleetJoinFiles) => Promise<void>;
}

/** Where the fleet-join door's three files rest under B's root. */
export interface FleetJoinFiles { readonly offer: string; readonly request: string; readonly answer: string }
/** The device edge B's join carried: the signed edge inside the fleet-join answer, or the one B's `admit.json` named. */
export function joinedDeviceEdge(pair: Pick<StagedJoinee, "fleet" | "rootB">): unknown {
  if (pair.fleet) return (JSON.parse(readFileSync(pair.fleet.answer, "utf8")) as { edge?: { deviceEdge?: unknown } }).edge?.deviceEdge;
  return (JSON.parse(readFileSync(join(pair.rootB, "admit.json"), "utf8")) as { deviceEdge?: unknown }).deviceEdge;
}
export interface StagedJoinee {
  readonly A: LarInstance;
  /** null when B never reached live (its boot line rides in `joinGate`) or `bootB: false`. */
  readonly B: LarInstance | null;
  readonly rootB: string;
  readonly portA: number;
  readonly portB: number;
  /** What B's `vessel found --admit` said, or on the fleet-join door, its `fleet join land`. */
  readonly admitted: CliResult;
  /** The fleet-join door's three files, on that door. */
  readonly fleet: FleetJoinFiles | null;
  /** The line B's daemon died on, when it did. */
  readonly joinGate: string | null;
  /** A's gate key and lares doc url, as B's env dial reads them. */
  readonly gateA: string;
  readonly laresA: string;
  readonly stop: () => Promise<void>;
}

export async function openStagedJoinee(opts: JoineeOptions = {}): Promise<StagedJoinee> {
  const tag = opts.tag ? `${opts.tag}-` : "";
  const [portA, portB] = await Promise.all([freePort(), freePort()]);
  const rootB = mkdtempSync(join(stageDir(), `lares-staged-${tag}B-`));
  stageGenesis(rootB);
  seedTestCustody(rootB);
  const cliB  = cliFor({ LAR_ROOT: rootB, LAR_PORT: String(portB) });
  const admit = join(rootB, "admit.json");
  let admitted: CliResult | null = null;
  let fleet: FleetJoinFiles | null = null;
  const stood: LarInstance[] = [];
  const stop = async (): Promise<void> => {
    for (const v of stood.reverse()) await v.stop();
    if (existsSync(rootB)) removeStagedRoot(rootB);
  };
  try {
    // ①–④ run while NO daemon stands: `device-admit` opens A's store directly, and a store has one owner.
    const A = await openStaged({
      tag: `${tag}A`, port: portA, daemonEnv: { ...(opts.daemonEnv ?? {}), ...(opts.daemonEnvA ?? {}) },
      found: async (cliA, rootA) => {
        await foundStagedHearth(cliA, rootA, "alpha");
        await opts.riteA?.(cliA, rootA);
        // B founds by A's genesis, copied whole: `vessel found --admit` reads the hearth true-name off
        // `<root>/genesis`, and A's founding derived it (the re-derive is an internal rite step).
        cpSync(join(rootA, "genesis"), join(rootB, "genesis"), { recursive: true });
        if ((opts.door ?? "fleet-join") === "fleet-join") {
          // THE FLEET-JOIN DOOR: B stands as a place first, so its own custody holds the keys it mints for the face.
          const place = await cliB(["vessel", "found", "--skip-build"]);
          if (place.code !== 0) throw new Error(`B: vessel found (a place) failed (${place.code})\n${place.stderr.slice(-2500)}`);
          const files = { offer: join(rootB, "fleet-offer.json"), request: join(rootB, "fleet-request.json"), answer: join(rootB, "fleet-answer.json") };
          const offer = await cliA(["fleet", "join", "offer", "--out", files.offer]);
          if (offer.code !== 0) throw new Error(`A: fleet join offer failed (${offer.code})\n${offer.stderr.slice(-2500)}`);
          const request = await cliB(["fleet", "join", "request", files.offer, "--out", files.request]);
          if (request.code !== 0) throw new Error(`B: fleet join request failed (${request.code})\n${request.stderr.slice(-2500)}`);
          const answer = await cliA(["fleet", "join", "answer", files.request, "--sync-url", `ws://127.0.0.1:${portA}/ws`, "--out", files.answer]);
          if (answer.code !== 0) throw new Error(`A: fleet join answer failed (${answer.code})\n${answer.stderr.slice(-2500)}`);
          await opts.beforeLand?.(cliB, files);
          admitted = await cliB(["fleet", "join", "land", files.answer]);
          fleet = files;
          return;
        }
        // The joinee mints FIRST, under its own root: admission signs a key the joiner already holds.
        const { mintVesselKey } = await import("./vessel-key.js");
        const keyB = await mintVesselKey(rootB);
        const edge = await cliA(["device-admit", "--joinee-key", keyB, "--sync-url", `ws://127.0.0.1:${portA}/ws`, "--out", admit]);
        if (edge.code !== 0) throw new Error(`A: device-admit failed (${edge.code})\n${edge.stderr.slice(-800)}`);
        admitted = await cliB(["vessel", "found", "--admit", admit, "--skip-build"]);
      },
    });
    stood.push(A);
    if (!(await awaitRendezvous(A))) throw new Error(`A reached live but bound no rendezvous:\n${A.bootLog().slice(-800)}`);
    await opts.beforeB?.(A);

    // A's gate key off A's own log, A's lares doc off A's registry — B's env dial, or a suite's own read.
    const gateA = await awaitOwnGateKey(A);
    const { invokeLocal } = await import("../../packages/lares-cli/src/local-connector.js");
    const wl = await invokeLocal("list-wikis", {}, `0x${"0".repeat(64)}`, { dataDir: vesselStorageDir(A) }) as
      { results?: { summary?: { output?: { wikis?: Array<{ slug: string; automergeUrl: string | null }> } } } };
    const laresA = wl.results?.summary?.output?.wikis?.find((w) => w.slug === "lares")?.automergeUrl ?? "";

    let B: LarInstance | null = null, joinGate: string | null = null;
    if (opts.bootB !== false) {
      const requestedDoc = typeof opts.joinDocUrl === "function"
        ? await opts.joinDocUrl(A)
        : opts.joinDocUrl ?? laresA;
      const dial = (opts.dial ?? "env") === "env"
        ? { LAR_JOIN_SYNC: `ws://127.0.0.1:${portA}/ws`, LAR_JOIN_GATE: gateA, ...(requestedDoc ? { LAR_JOIN_DOC: requestedDoc } : {}) }
        : {};
      try {
        B = await openStaged({
          tag: `${tag}B`, root: rootB, port: portB, found: async () => { /* founded by A's edge above */ },
          daemonEnv: { ...(opts.daemonEnv ?? {}), ...dial },
        });
        stood.push(B);
        if (!(await awaitRendezvous(B))) throw new Error(`B reached live but bound no rendezvous:\n${B.bootLog().slice(-800)}`);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        // A stand that never unlocked carries the daemon's log tail: keep it whole, since one matched line would hide the fault.
        joinGate = text.includes("never unlocked")
          ? text.slice(-6500).trim()
          : (text.split("\n").find((l) => /nexus-join|fatal|ANERGIZED/.test(l)) ?? text.slice(-300)).trim();
        if (B) { await B.stop(); stood.pop(); }
        B = null;
      }
    }
    return { A, B, rootB, portA, portB, admitted: admitted!, fleet, joinGate, gateA, laresA, stop };
  } catch (err) {
    await stop();
    throw err;
  }
}
