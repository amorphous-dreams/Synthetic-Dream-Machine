/**
 * harness/instance — the ONE instance-targeting layer every e2e test uses.
 *
 * Two modes, selected by LAR_TARGET (the env contract: lares-cli/src/env.ts):
 *
 *   staged (default) — the harness OWNS the instance: ephemeral root under
 *     os.tmpdir(), random port, `lares vessel clear --force` → daemon boot → await
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
import { mkdtempSync, mkdirSync, rmSync, existsSync, cpSync } from "node:fs";

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

/** The real lares CLI under ONE instance's env pair — the same door `LarInstance.cli` opens. */
export function cliFor(env: Record<string, string>): (args: readonly string[]) => Promise<CliResult> {
  return (args) => runCli(env, args);
}

function runCli(env: Record<string, string>, args: readonly string[]): Promise<CliResult> {
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

/** How a staged vessel is founded and stood — the defaults are the hearth every suite inherits. */
export interface StageOptions {
  /** A name for the root, so two vessels in one run read apart on disk (`lares-staged-<tag>-`). */
  readonly tag?: string;
  /** A root already minted — for a vessel whose rite ran before it stands. Deleted at `stop` like any other. */
  readonly root?: string;
  /** A port already chosen — so a rite that names this vessel's dial (`--sync-url`) can run before it stands. */
  readonly port?: number;
  /**
   * The founding rite, run before the daemon stands. Defaults to `vessel clear --force` (a place) and
   * `persona new 0` (a face). A suite standing a JOINER performs its own rite here — admit, re-found —
   * against the same root and env the daemon will then read.
   */
  readonly found?: (cli: (args: readonly string[]) => Promise<CliResult>, root: string) => Promise<void>;
  /** Extra environment the DAEMON stands with (a peer to dial, a gate to bind to). The CLI env stays the pair. */
  readonly daemonEnv?: Record<string, string>;
}

/** The default rite: a place, then a face. */
async function foundHearth(cli: (args: readonly string[]) => Promise<CliResult>, root: string): Promise<void> {
  // Genesis — `lares vessel clear --force` seeds the root (init runs inside).
  //
  // ── A WITNESS BUILDS NOTHING ──────────────────────────────────────────────────────────────────
  // `vessel` doors carry a freshness gate that rebuilds the whole workspace (`pnpm -r build`) when any
  // source under `packages/` moved since the last stamp — re-emitting every dist, re-rendering the
  // engine, and writing into the shared tree beside whoever else is building there. A staged boot
  // measures the dist that STANDS: the suite names the missing dist on stderr and skips; it never
  // rebuilds. `--skip-build` is the gate's own sentinel for "already fresh — run the handler".
  const reset = await cli(["vessel", "clear", "--root", root, "--force", "--skip-build"]);
  if (reset.code !== 0) throw new Error(`staged reset failed (${reset.code}):\n${reset.stderr.slice(-800)}`);

  // ── THE RITE RUNS IN TWO STEPS, SO THE HARNESS PERFORMS BOTH ───────────────────────────────
  // `vessel clear` re-founds a PLACE: the daemon bag, the vessel's own Keyhive individual, the hearth
  // true-name. A place stands and serves while holding no face — which is correct, and which is
  // NOT what these suites test. They exercise a hearth: personas, wiki, catalog, the pairing the
  // boot path derives. So the staged instance lights its face here, and a suite that wants the
  // FLOOR asks for it deliberately rather than inheriting it from a founding that stopped early.
  const face = await cli(["persona", "new", "0", "--name", "staged"]);
  if (face.code !== 0) throw new Error(`staged face-founding failed (${face.code}):\n${face.stderr.slice(-800)}`);
}

/** Stand ONE staged vessel under its own root and port. `targetInstance` calls this with the defaults. */
export async function openStaged(opts: StageOptions = {}): Promise<LarInstance> {
  const root = opts.root ?? mkdtempSync(join(stageDir(), `lares-staged-${opts.tag ? `${opts.tag}-` : ""}`));
  // OS-assigned free port — each staged island its own port, collision-free
  // (causal-island isolation; was a PID-stride guess that only reduced collisions).
  const port = opts.port ?? await freePort();
  const env  = { LAR_ROOT: root, LAR_PORT: String(port) };
  const cli  = (args: readonly string[]) => runCli(env, args);

  try {
    await (opts.found ?? foundHearth)(cli, root);
  } catch (err) {
    removeStagedRoot(root);
    throw err;
  }

  // Boot the daemon from dist; capture its log; await `phase → live`.
  let log = "";
  const daemon: ChildProcess = spawn(process.execPath, [NODE_MAIN, "--root", root, "--port", String(port)], {
    cwd: NODE_CWD,
    env: { ...process.env, ...env, ...(opts.daemonEnv ?? {}) },
  });
  daemon.stdout?.on("data", (d) => { log += String(d); });
  daemon.stderr?.on("data", (d) => { log += String(d); });

  const liveAt = Date.now();
  await new Promise<void>((resolve, reject) => {
    const poll = setInterval(() => {
      if (log.includes("phase → live")) { clearInterval(poll); resolve(); }
      else if (daemon.exitCode !== null) { clearInterval(poll); reject(new Error(`staged daemon exited ${daemon.exitCode} before live:\n${log.slice(-6000)}`)); }
      else if (Date.now() - liveAt > 120_000) { clearInterval(poll); reject(new Error(`staged daemon never reached live (120s):\n${log.slice(-800)}`)); }
    }, 250);
  });

  return {
    mode: "staged",
    root,
    port,
    bootLog: () => log,
    cli,
    stop: async () => {
      daemon.kill();
      await new Promise((r) => setTimeout(r, 500));
      removeStagedRoot(root);
    },
    stopDaemonOnly: async () => {
      daemon.kill();
      await new Promise((r) => setTimeout(r, 800));
    },
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
 * a Lar wakes, acts and gives way, and `clear`, `bake` and `rebirth` reforge that substrate whole. What
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

/** Wait until this instance's daemon has BOUND its rendezvous — a name standing, not a listener answering. */
export async function awaitRendezvous(instance: LarInstance, timeoutMs = 60_000): Promise<boolean> {
  const sock = rendezvousSocket(instance);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (existsSync(sock)) return true;
    if (Date.now() > deadline) return false;
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
// (`LAR_HERM_SHORE`). The Herm lights NO face — `vessel clear` alone founds a PLACE, and a place with no face
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
  /** Tear all three down (C · A · Herm), deleting every staged root. A vessel already stopped is skipped. */
  readonly stop: () => Promise<void>;
}

/** Stand the fleet. Throws (and tears down what stood) when any of the three never reaches live. */
export async function openStagedFleet(opts: { readonly tag?: string } = {}): Promise<StagedFleet> {
  const tag = opts.tag ? `${opts.tag}-` : "";
  const [portHerm, portRelay] = await Promise.all([freePort(), freePort()]);
  const relayUrl  = `ws://127.0.0.1:${portRelay}`;
  const hermShore = `http://127.0.0.1:${portHerm}`;
  const stood: LarInstance[] = [];
  let pairRef: StagedJoinee | null = null;
  // C · A (through the pair's own stop, which also deletes C's staged root) · then the Herm.
  const teardown = async (): Promise<void> => {
    if (pairRef) { await pairRef.stop(); pairRef = null; }
    for (const v of stood.reverse()) await v.stop();
  };
  try {
    // The Herm: a place, no face; the crossroads relay on its own port; the read-face on `portHerm`.
    const herm = await openStaged({
      tag: `${tag}herm`, port: portHerm,
      daemonEnv: { LAR_RECIPE: "herm", LAR_HERM_RELAY_PORT: String(portRelay) },
      found: async (cli, root) => {
        const reset = await cli(["vessel", "clear", "--root", root, "--force", "--skip-build"]);
        if (reset.code !== 0) throw new Error(`herm: clear failed (${reset.code})\n${reset.stderr.slice(-800)}`);
      },
    });
    stood.push(herm);

    // A founds; C mints under its own root; A signs the edge naming its dial; C founds by that payload —
    // the joinee rite, one door, with both hearths dialing the Herm's crossroads and shore.
    const pair = await openStagedJoinee({
      tag: `${tag}fleet`,
      daemonEnv: { LAR_CARRIAGE_RELAY: relayUrl, LAR_HERM_SHORE: hermShore },
    });
    pairRef = pair;
    if (!pair.B) throw new Error(`C never stood: ${pair.joinGate ?? "(no line)"}`);
    const A = pair.A, C = pair.B, admitted = pair.admitted;
    return { herm, A, C, relayUrl, hermShore, admitted, stop: teardown };
  } catch (err) {
    await teardown();
    throw err;
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
  /** How B learns A's dial: `"env"` (LAR_JOIN_SYNC/GATE/DOC off A's log and registry) or `"pin"`
   *  (nothing — B boots by the hearth its signed edge names). Default `"env"`. */
  readonly dial?: "env" | "pin";
  /** Runs once A stands live and before B boots — the place a suite lands a record on A first. */
  readonly beforeB?: (A: LarInstance) => Promise<void>;
  /** Boot B at all? A suite measuring a founding alone passes false. Default true. */
  readonly bootB?: boolean;
}
export interface StagedJoinee {
  readonly A: LarInstance;
  /** null when B never reached live (its boot line rides in `joinGate`) or `bootB: false`. */
  readonly B: LarInstance | null;
  readonly rootB: string;
  readonly portA: number;
  readonly portB: number;
  /** What B's `vessel found --admit` said. */
  readonly admitted: CliResult;
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
  const cliB  = cliFor({ LAR_ROOT: rootB, LAR_PORT: String(portB) });
  const admit = join(rootB, "admit.json");
  let admitted: CliResult | null = null;
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
        const clear = await cliA(["vessel", "clear", "--root", rootA, "--force", "--skip-build"]);
        if (clear.code !== 0) throw new Error(`A: clear failed (${clear.code})\n${clear.stderr.slice(-800)}`);
        const face = await cliA(["persona", "new", "0", "--name", "alpha"]);
        if (face.code !== 0) throw new Error(`A: face failed (${face.code})\n${face.stderr.slice(-800)}`);
        // B founds by A's genesis, copied whole: `vessel found --admit` reads the hearth true-name off
        // `<root>/genesis`, and A's `clear` just derived it (the re-derive is an internal rite step).
        cpSync(join(rootA, "genesis"), join(rootB, "genesis"), { recursive: true });
        // The joinee mints FIRST, under its own root: admission signs a key the joiner already holds.
        const { mintVesselKey } = await import("./vessel-key.js");
        const keyB = await mintVesselKey(rootB);
        const edge = await cliA(["device-admit", "--joinee-key", keyB, "--sync-url", `ws://127.0.0.1:${portA}/ws`, "--out", admit]);
        if (edge.code !== 0) throw new Error(`A: device-admit failed (${edge.code})\n${edge.stderr.slice(-800)}`);
        admitted = await cliB(["vessel", "found", "--admit", admit]);
      },
    });
    stood.push(A);
    if (!(await awaitRendezvous(A))) throw new Error(`A reached live but bound no rendezvous:\n${A.bootLog().slice(-800)}`);
    await opts.beforeB?.(A);

    // A's gate key off A's own log, A's lares doc off A's registry — B's env dial, or a suite's own read.
    const gateA = /gate key: ([0-9a-f]{64})/.exec(A.bootLog())?.[1] ?? "";
    const { invokeLocal } = await import("../../packages/lares-cli/src/local-connector.js");
    const wl = await invokeLocal("list-wikis", {}, `0x${"0".repeat(64)}`, { dataDir: vesselStorageDir(A) }) as
      { results?: { summary?: { output?: { wikis?: Array<{ slug: string; automergeUrl: string | null }> } } } };
    const laresA = wl.results?.summary?.output?.wikis?.find((w) => w.slug === "lares")?.automergeUrl ?? "";

    let B: LarInstance | null = null, joinGate: string | null = null;
    if (opts.bootB !== false) {
      const dial = (opts.dial ?? "env") === "env"
        ? { LAR_JOIN_SYNC: `ws://127.0.0.1:${portA}/ws`, LAR_JOIN_GATE: gateA, LAR_JOIN_DOC: laresA }
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
        joinGate = (text.split("\n").find((l) => /nexus-join|fatal|ANERGIZED/.test(l)) ?? text.slice(-300)).trim();
        if (B) { await B.stop(); stood.pop(); }
        B = null;
      }
    }
    return { A, B, rootB, portA, portB, admitted: admitted!, joinGate, gateA, laresA, stop };
  } catch (err) {
    await stop();
    throw err;
  }
}
