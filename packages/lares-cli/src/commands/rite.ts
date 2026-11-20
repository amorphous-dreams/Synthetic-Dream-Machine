/**
 * `lares rite kukulu | keep | begin | land | receipts` — the rite door.
 *
 *   kukulu     (kūkulu) on the HOST: the one verb that raises the house again around its hearth. Fast-forwards the checkout
 *              where it stands clean and behind, has the host shim make the image and read where the house stands, spends
 *              each face's kukulu lei where one stands (no prompt), then the shim's restand (the pūlama's light and admit on
 *              this terminal only where the day owes them), then lands the rite (`../rite-kukulu.ts`). `--rollback [<rev>]`
 *              stands the image that ran before, or an older revision's, with no checkout move
 *   keep       on the HOST: keep the house in the operator's repo. Guards the bound workspace, runs `keep-cut` in the vessel,
 *              then commits `<into>`, rebases, pushes, and lands the tessera at the bundle id the pushed tree holds
 *              (`--workspace <name> [--into <path>]`, `../rite-keep-host.ts`); `--if-due` keeps only where the house moved since
 *              the bundle its remote-tracking branch holds (or a keep still waits for its push or landing), and with no
 *              `--workspace` reads the configured keep workspace (`../keep-config.ts`): the one call `down` makes
 *   keep-cut   IN THE VESSEL: the keep's vessel half: lay the house's authored memory, cut as a cleartext house bundle, into the
 *              bound workspace, spending a return of the keep lei strung for that workspace (`../rite-keep.ts`); it holds each
 *              cold wiki the house lists in turn before the cut, then hands the pins back
 *   begin      `rite-begin` in the vessel: derive the head's tree, return the rite's lei (a kūkulu: each lent face's own),
 *              rest the guest half of the tessera
 *   land       `rite-land` in the vessel that stands after: rest the host half, naming the begun half and the head
 *   receipts   `rite-receipts`: every half that verifies (`data.receipts`) and conferre's read of them (`data.conferre`)
 *   offer      `rite-offer` in the STANDING vessel, between the build and the lowering: gather every lent face's line, sign one
 *              vouch per face over the image the host built, and rest the offer the next vessel carries to the pūlama
 *
 * The lei carries the grant: the hand strung it (`lares lei kui --rite kukulu …`, `--rite keep --branch <workspace> …`), and any
 * seat holding the line may spend it.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";
import { emitAnswer, exitFor, refuseUsage } from "../render.js";
import { priorImageRef, riteKukulu, syncPlan, type PriorImage, type RefillPort, type RefillReq, type RitePorts, type RiteVerbAnswer, type StageTarget, type StandReading, type SyncAnswer } from "../rite-kukulu.js";
import { foundingRecordFromStatus, hostSeedOfferPort } from "../seed-offered.js";
import { storeFailure, storeVerb } from "../store-door.js";
import { KeepRefused, keepWorkspaceDir, keepFaceLine, riteKeep, type KeepPorts } from "../rite-keep.js";
import { houseFaces } from "../custody-door.js";
import { riteKeepHost, workspaceFromPairs, type GitAnswer, type KeepHostPorts } from "../rite-keep-host.js";
import { envValue, IN_CONTAINER_ENV, surfaceEnvPath } from "../surface-env.js";
import { configuredKeepWorkspace } from "../keep-config.js";
import { houseExport, bundleRefusal, LIVE_BUNDLE_DOORS } from "./house-bundle.js";
import { runVerb } from "../verb-call.js";
import { summaryOutput } from "../verb-result.js";
import { vesselDid } from "../env.js";

export class RiteUsage extends Error {}

export type RiteVerb = "rite-begin" | "rite-land" | "rite-receipts" | "rite-offer";
export interface RitePlan { readonly verb: RiteVerb; readonly args: Record<string, unknown> }

/** The host sub-verb's two spellings. */
export const isKukulu = (word: string | undefined): boolean => word === "kukulu" || word === "kūkulu";

/** One vessel sub-verb's store row and args, or a `RiteUsage` naming what the line lacks. */
export function ritePlan(args: ParsedArgs): RitePlan {
  const act = args.positional[0];
  // Each flag reads by its own literal name, so the accepts law walks them.
  const word = (raw: string | undefined): string | undefined => (typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined);
  const faceWord = word(args.options["face"]);
  if (faceWord !== undefined && !/^(?:0|[1-9][0-9]*)$/.test(faceWord)) throw new RiteUsage("--face takes a whole persona index from 0");
  const face = faceWord === undefined ? {} : { face: Number(faceWord) };
  const head = word(args.options["head"]);
  if (act === "receipts") return { verb: "rite-receipts", args: { ...face } };
  if (act === "begin") {
    const rite = word(args.options["rite"]), branch = word(args.options["branch"]);
    if (rite === undefined || branch === undefined || head === undefined) throw new RiteUsage("begin names its rite, its branch and its head: --rite kukulu --branch <name> --head <commit> (a keep adds --staging <path>, the bundle it staged inside its workspace)");
    const staged = word(args.options["staging"]);
    return { verb: "rite-begin", args: { rite, branch, head, ...(staged === undefined ? {} : { staged }), ...face } };
  }
  if (act === "offer") {
    const branch = word(args.options["branch"]), image = word(args.options["image"]);
    if (branch === undefined || head === undefined || image === undefined) throw new RiteUsage("offer names its branch, its head and the image the host built: --branch <name> --head <commit> --image <digest>");
    return { verb: "rite-offer", args: { branch, head, image, ...face } };
  }
  if (act === "land") {
    const tessera = word(args.options["tessera"]);
    if (tessera === undefined || head === undefined) throw new RiteUsage("land names its tessera and the head the vessel stands at: --tessera <id> --head <commit>");
    return { verb: "rite-land", args: { tessera, head, ...face } };
  }
  throw new RiteUsage(isKukulu(act) ? "kukulu runs on the host and plans no single row" : act === "keep" || act === "keep-cut" ? `${act} runs several rows and plans no single one` : "name a sub-verb: kukulu, keep, keep-cut, begin, offer, land, receipts or receipt");
}

/** What a `rite keep` line names, or a `RiteUsage` naming what it lacks. */
export function keepPlan(args: ParsedArgs): { readonly workspace?: string; readonly into?: string; readonly acceptOmissions: boolean; readonly face?: number; readonly ifDue?: true; readonly sessions?: boolean } {
  const word = (raw: string | undefined): string | undefined => (typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined);
  const workspace = word(args.options["workspace"]), into = word(args.options["into"]), faceWord = word(args.options["face"]);
  // `--if-due` (keep alone) may leave the workspace to the house config (`../keep-config.ts`); every other line names it.
  const ifDue = args.positional[0] === "keep" && args.flags["if-due"] === true;
  if (workspace === undefined && !ifDue) throw new RiteUsage("keep names the workspace it lays the bundle into: --workspace <name> [--into <path>] (or `keep --if-due`, which reads LARES_KEEP_WORKSPACE)");
  if (faceWord !== undefined && !/^(?:0|[1-9][0-9]*)$/.test(faceWord)) throw new RiteUsage("--face takes a whole persona index from 0");
  // `--sessions` / `--no-sessions` (keep alone); with neither, the host half reads LARES_KEEP_SESSIONS and keeps them.
  const sessions = args.positional[0] === "keep" && typeof args.flags["sessions"] === "boolean" ? args.flags["sessions"] : undefined;
  return { ...(workspace !== undefined ? { workspace } : {}), ...(into !== undefined ? { into } : {}), acceptOmissions: args.flags["accept-omissions"] === true, ...(faceWord !== undefined ? { face: Number(faceWord) } : {}), ...(ifDue ? { ifDue: true as const } : {}), ...(sessions !== undefined ? { sessions } : {}) };
}

/** The keep's live ports: the vessel's rows through the store door, and the cut through the house export. */
const KEEP_PORTS: KeepPorts = {
  row: async (verb, rowArgs) => {
    try { return { ok: true, output: (await storeVerb(verb, rowArgs)).output }; }
    catch (err) { const failure = storeFailure(err); return { ok: false, code: failure.code, message: failure.message }; }
  },
  // A KEEP NAMING NO FACE ACTS AS THE KEEP'S FACE, read over the faces the house holds (the custody door's census, open and shut).
  houseFaces: async () => houseFaces(),
  cut: async (dest, opts) => (await houseExport(dest, { acceptOmissions: opts.acceptOmissions, doors: LIVE_BUNDLE_DOORS, workspace: opts.workspace, houseOnly: true, ...(opts.woken !== undefined ? { woken: opts.woken } : {}) })).manifest,
  // THE WIKI SWITCHER the wake walks: the catalog (`list-wikis`), the live state (`wiki-active`), and the rotatable pin.
  wikis: {
    read: async () => {
      const did = await vesselDid();
      const listed = await runVerb("list-wikis", {}, did), active = await runVerb("wiki-active", {}, did);
      if (listed.status === "error" || active.status === "error") throw new Error(listed.errorMessage ?? active.errorMessage ?? "the wiki switcher would not read");
      const strings = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : []);
      const live = (summaryOutput(active) ?? {}) as { active?: unknown; held?: unknown };
      return {
        listed: (((summaryOutput(listed) ?? {}) as { wikis?: Array<{ slug?: unknown }> }).wikis ?? []).map((w) => String(w.slug)),
        active: strings(live.active), held: strings(live.held),
      };
    },
    hold: async (slug) => {
      const r = await runVerb("wiki-hold", { slug }, await vesselDid(), { timeoutMs: 30_000 });
      return r.status !== "error" && (summaryOutput(r) as { held?: unknown } | null)?.held === true;
    },
    release: async (slug) => {
      const r = await runVerb("wiki-release", { slug }, await vesselDid());
      if (r.status === "error") throw new Error(r.errorMessage ?? `wiki-release ${slug} refused`);
    },
  },
};

/** The vessel half alone (`rite keep-cut`): the cut, the return and the guest half, with no git. */
async function runKeepCut(args: ParsedArgs): Promise<number> {
  let plan: ReturnType<typeof keepPlan> & { readonly workspace: string };
  try {
    const read = keepPlan(args);
    // keep-cut takes no `--if-due`, so its line always names the workspace.
    if (read.workspace === undefined) throw new RiteUsage("keep-cut names the workspace it lays the bundle into: --workspace <name> [--into <path>]");
    plan = { ...read, workspace: read.workspace };
  }
  catch (err) {
    if (err instanceof RiteUsage) return refuseUsage(args, "rite", helpLines("rite"), err.message);
    throw err;
  }
  try {
    const out = await riteKeep(KEEP_PORTS, plan);
    emitAnswer(args, { ok: true, data: out, human: () => {
      if (out.faceBy === "keep" && out.face !== undefined) console.log(`keep: ${keepFaceLine(out.face)}`);
      if (!out.kept) { console.log(`keep: ${out.dest} already holds bundle ${out.bundleId.slice(0, 16)}; nothing spent and nothing moved`); return; }
      console.log(`keep: bundle ${out.bundleId.slice(0, 16)} rests at ${out.dest} (faces: ${out.faces.join(", ") || "(none)"}), return ${out.n} of the keep lei spent`);
      for (const o of out.omissions) console.log(`  left behind: ${o.kind}${o.count !== undefined ? ` (${o.count})` : ""} — ${o.detail}`);
      console.log(`keep: the bundle rests unencrypted (private memory as plain files); the host half commits and pushes it, then lands the rite: lares rite land --tessera ${out.tessera} --head ${out.bundleId}`);
    } }, out.kept ? `keep: bundle ${out.bundleId.slice(0, 16)} rests at ${out.dest}, return ${out.n} of the keep lei spent; land it: lares rite land --tessera ${out.tessera} --head ${out.bundleId}` : `keep: ${out.dest} already holds bundle ${out.bundleId.slice(0, 16)}; nothing spent and nothing moved`);
    return 0;
  } catch (err) {
    if (err instanceof KeepRefused) {
      emitAnswer(args, { ok: false, error: { code: err.code, message: err.message }, human: () => console.error(`lares rite keep-cut: ${err.message}`) }, `lares rite keep-cut: ${err.message}`);
      return exitFor(err.code);
    }
    return bundleRefusal(args, "rite keep-cut", err);
  }
}

async function runRiteVerb(args: ParsedArgs, plan: RitePlan): Promise<number> {
  try {
    const { output } = await storeVerb(plan.verb, plan.args);
    emitAnswer(args, { ok: true, data: output, human: () => console.log(JSON.stringify(output)) }, `lares rite ${plan.verb}: done`);
    return 0;
  } catch (err) {
    const failure = storeFailure(err);
    emitAnswer(args, { ok: false, error: failure, human: () => console.error(`lares rite: ${failure.message}`) }, `lares rite: ${failure.message}`);
    return exitFor(failure.code);
  }
}

/** The checkout this CLI runs from: `packages/lares-cli/dist/src/commands` sits five levels beneath it. */
const CHECKOUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const BIN = join(CHECKOUT, "packages", "lares-cli", "bin", "lares.mjs");

const git = (argv: readonly string[]): Promise<string> => new Promise((resolve, reject) => {
  const env = { ...process.env };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[k];
  execFile("git", ["-C", CHECKOUT, ...argv], { encoding: "utf8", env }, (err, stdout) => (err ? reject(new Error(`git ${argv.join(" ")}: ${err.message}`)) : resolve(stdout.trim())));
});

/** One line of this CLI again, answered as a row: the bridge forwards it into the vessel where a container house stands. */
const cliVerb = (line: readonly string[]): Promise<RiteVerbAnswer> => new Promise<RiteVerbAnswer>((resolve) => {
  const child = spawn(process.execPath, [BIN, ...line, "--json"], { stdio: ["inherit", "pipe", "inherit"] });
  let text = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { text += chunk; });
  child.once("error", (err) => resolve({ ok: false, code: "rite-row-unreached", message: err.message }));
  child.once("close", (code) => {
    let answer: { ok?: boolean; data?: Record<string, unknown>; error?: { code?: string; message?: string } } | null = null;
    try { answer = JSON.parse(text.trim().split("\n").at(-1) ?? ""); } catch { answer = null; }
    if (answer?.ok === true && answer.data) resolve({ ok: true, output: answer.data });
    else resolve({ ok: false, code: answer?.error?.code ?? "rite-row-unreached", message: answer?.error?.message ?? `the row answered no reading (exit ${code ?? "none"})` });
  });
});

/** Row args as flags: `true` rides as a bare flag, every other value as the next word. */
const flagsOf = (rowArgs: Record<string, unknown>): string[] => Object.entries(rowArgs).flatMap(([k, v]) => (v === true ? [`--${k}`] : [`--${k}`, String(v)]));

/** One shim line on this terminal; the answer carries its exit code (a spawn that never ran reads as a failure). */
const runShim = (shim: string, argv: readonly string[]): Promise<number> => new Promise((resolve) => {
  const child = spawn(shim, [...argv], { stdio: "inherit" });
  child.once("error", () => resolve(127));
  child.once("close", (code) => resolve(code ?? 1));
});

/** The shim's image step (`rebuild --image`): its lines show on this terminal, and its last stdout line carries the reading. */
const stageShim = (shim: string, target: StageTarget): Promise<{ code: number; reading: StandReading | null }> => new Promise((resolve) => {
  const child = spawn(shim, ["rebuild", "--image", ...("prior" in target ? ["--prior"] : ["--at", target.at])], { stdio: ["inherit", "pipe", "inherit"] });
  let text = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { text += chunk; });
  child.once("error", () => resolve({ code: 127, reading: null }));
  child.once("close", (code) => {
    let reading: StandReading | null = null;
    try { const r = JSON.parse(text.trim().split("\n").at(-1) ?? "") as StandReading & { op?: unknown }; reading = r.op === "rebuild-image" ? r : null; } catch { reading = null; }
    resolve({ code: code ?? 1, reading });
  });
});

/**
 * THE CHECKOUT'S FAST-FORWARD: fetch, then `git merge --ff-only` on the checkout's own branch only where the tree stands clean
 * and behind its upstream (`syncPlan`). It never switches a branch, never stashes, and never merges anything but a
 * fast-forward. A fetch that fails goes on at the last fetch and says so.
 */
export async function syncCheckout(dir: string): Promise<SyncAnswer> {
  const out = async (argv: readonly string[]): Promise<string | null> => { const r = await gitIn(dir, argv); return r.code === 0 ? r.stdout.trim() : null; };
  const branch = (await out(["rev-parse", "--abbrev-ref", "HEAD"])) ?? "HEAD";
  const upstream = branch === "HEAD" ? null : await out(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  let fetched = "";
  if (upstream !== null) {
    const f = await gitIn(dir, ["fetch", "--quiet"]);
    if (f.code !== 0) fetched = `the fetch failed (${f.stderr.trim().split("\n").at(-1) || `exit ${f.code}`}), so the checkout reads its last fetch; `;
  }
  const counts = upstream === null ? null : await out(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
  const [ahead = 0, behind = 0] = (counts ?? "0 0").split(/\s+/).map(Number);
  const dirty = ((await out(["status", "--porcelain", "--untracked-files=no"])) ?? "") !== "";
  const plan = syncPlan({ branch, upstream, ahead, behind, dirty });
  if (plan.act !== "fast-forward") return { ok: plan.act === "stand", line: fetched + plan.line };
  const from = (await out(["rev-parse", "HEAD"])) ?? "";
  const merged = await gitIn(dir, ["merge", "--ff-only", "--quiet", "@{upstream}"]);
  if (merged.code !== 0) return { ok: false, line: `${fetched}the fast-forward of ${branch} to ${upstream} refused (${merged.stderr.trim().split("\n").at(-1) || `exit ${merged.code}`}); nothing moved` };
  const to = (await out(["rev-parse", "HEAD"])) ?? "";
  return { ok: true, line: `${fetched}${branch} fast-forwarded ${behind} commit(s) from ${upstream}: ${from.slice(0, 12)}..${to.slice(0, 12)}` };
}

/**
 * One vessel row as the host's CLI line. The begin and the offer gather every lent face in the vessel, so they name none;
 * each landing names the face its tessera began under in its own arguments.
 */
export const hostRowLine = (verb: "rite-begin" | "rite-land" | "rite-offer", rowArgs: Record<string, unknown>): string[] =>
  ["rite", verb === "rite-begin" ? "begin" : verb === "rite-offer" ? "offer" : "land", ...flagsOf(rowArgs)];

/**
 * The founding record beside the seed the image offers, through the host's one seed read (`../seed-offered.ts`, the read
 * `lares vessel floor seed` prints): the seed from this checkout's genesis dir (the shim builds the image from this clean
 * checkout, and the image carries that dir at `/app/genesis`), the record's digests from the vessel's own floor status (it
 * answers them charter-free). Null where either does not read. Reads only.
 */
const hostSeedOffer = hostSeedOfferPort({
  genesisDir: join(CHECKOUT, "genesis"),
  record: async () => {
    const status = await cliVerb(["vessel", "floor", "status"]);
    return status.ok ? foundingRecordFromStatus(status.output, "the vessel's floor status names no founding record") : { unread: status.message };
  },
});

/** The words of a spent line's refill: `lares lei kui` with the spent lei's own returns and the face (or every open face), naming no cid. */
export const refillArgs = (req: RefillReq, returns: number | null): string[] =>
  ["lei", "kui", "--rite", req.rite, "--branch", req.branch, "--returns", returns === null ? "<n>" : String(returns), ...(req.face !== undefined ? ["--face", String(req.face)] : req.all === true ? ["--all"] : [])];

/** The returns the spent line carried, read off `lei show` (one face's `lei`, or the first spent face's); null where none reads. */
async function spentReturns(req: RefillReq): Promise<number | null> {
  const shown = await cliVerb(["lei", "show", "--rite", req.rite, "--branch", req.branch, ...(req.face !== undefined ? ["--face", String(req.face)] : [])]);
  if (!shown.ok) return null;
  const lines = Array.isArray(shown.output["faces"]) ? (shown.output["faces"] as Array<{ lei?: { returns?: unknown } }>).map((f) => f.lei) : [shown.output["lei"] as { returns?: unknown } | undefined];
  const found = lines.find((l) => typeof l?.returns === "number");
  return found ? Number(found.returns) : null;
}

/**
 * THE INLINE REFILL: a rite stopped on a spent lei asks the person at a real terminal (stdin and stdout both) whether to string the
 * same returns again under their route, then runs the checkout shim's own `lei kui` (the hand door, under a pūlama or none). A pipe or
 * an AI seat is asked nothing and reads the plain line.
 */
export function hostRefill(ask: (q: string) => Promise<boolean>, run: (argv: readonly string[]) => Promise<number>, tty: () => boolean, readReturns: (req: RefillReq) => Promise<number | null> = spentReturns): RefillPort {
  return async (req) => {
    const returns = req.returns ?? await readReturns(req);
    const argv = refillArgs(req, returns);
    const remedy = `lares ${argv.join(" ")}`;
    if (returns === null || !tty()) return { strung: false, remedy };
    if (!(await ask(`the ${req.rite} lei for ${req.branch} is spent; string ${returns} more under your route?`))) return { strung: false, remedy };
    return { strung: (await run(argv)) === 0, remedy };
  };
}

const liveRefill: RefillPort = hostRefill(
  (q) => new Promise((resolve) => { const rl = createInterface({ input: process.stdin, output: process.stderr }); rl.question(`${q} [y/N] `, (a) => { rl.close(); resolve(/^y(es)?$/i.test(a.trim())); }); }),
  (argv) => new Promise((resolve) => { const c = spawn(join(CHECKOUT, "tools", "lares-container.sh"), [...argv], { stdio: "inherit" }); c.once("error", () => resolve(127)); c.once("close", (code) => resolve(code ?? 1)); }),
  () => process.stdin.isTTY === true && process.stdout.isTTY === true,
);

/**
 * The image the vessel stands from at the rite's start, read from the docker CLI (reads only): the image ref the shim reads
 * (`LARES_IMAGE`, else `lares-surface:local`), its revision label and id. Null where docker answers nothing.
 */
const readPriorImage = (): Promise<PriorImage | null> => new Promise((resolve) => {
  const ref = (process.env["LARES_IMAGE"] ?? "").trim() || "lares-surface:local";
  execFile("docker", ["image", "inspect", "--format", '{{.Id}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}', ref], { encoding: "utf8" }, (err, stdout) => {
    if (err) return resolve(null);
    const [id = "", revision = ""] = stdout.trim().split("|");
    resolve(id === "" ? null : priorImageRef(ref, revision.replace(/[^0-9a-z-]/g, ""), id));
  });
});

/** The host's ports: git in this checkout, this CLI again for a vessel row (the bridge forwards it), and the checkout's shim. */
function hostPorts(shim: string, say: (line: string) => void): RitePorts {
  return {
    refill: liveRefill,
    prior: readPriorImage,
    seedOffer: (head) => hostSeedOffer(head).catch(() => null),   // a read-only line never stops the rite
    sync: () => syncCheckout(CHECKOUT),
    checkout: async () => ({ head: await git(["rev-parse", "HEAD"]), branch: await git(["rev-parse", "--abbrev-ref", "HEAD"]) }),
    stage: (target) => stageShim(shim, target),
    raise: (revision) => runShim(shim, ["rebuild", "--at", revision]),
    tty: () => process.stdin.isTTY === true && process.stdout.isTTY === true,
    row: (verb, rowArgs) => cliVerb(hostRowLine(verb, rowArgs)),
    say,
  };
}

/** git in one directory, clear of any hook's own git env; never throws. */
const gitIn = (dir: string, argv: readonly string[]): Promise<GitAnswer> => new Promise((resolve) => {
  const env = { ...process.env };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[k];
  execFile("git", ["-C", dir, ...argv], { encoding: "utf8", env, maxBuffer: 256 * 1024 * 1024 }, (err, stdout, stderr) => {
    const code = err === null ? 0 : typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : 1;
    resolve({ code, stdout, stderr });
  });
});

/**
 * The workspace's directory as the host reads it: under a named house root, the one the vessel half reads too
 * (`<root>/workspaces/<name>`); beside the container house, the pair LARES_WORKSPACES names (the environment, else the
 * operator's surface env file), the same pairs the shim binds at `/lar/workspaces/<name>`.
 */
function hostWorkspaceDir(name: string): string {
  if ((process.env["LAR_ROOT"] ?? "").trim() !== "") return keepWorkspaceDir(name);
  const envFile = surfaceEnvPath(process.env);
  let text: string | null = null;
  try { text = envFile === null ? null : readFileSync(envFile, "utf8"); } catch { text = null; }
  return workspaceFromPairs(name, envValue("LARES_WORKSPACES", process.env, text));
}

/** The whole keep rite on the host (`rite keep`): the guard, the vessel half as a row, then git, then the landing. */
async function runKeepHost(args: ParsedArgs): Promise<number> {
  let plan: ReturnType<typeof keepPlan>;
  try { plan = keepPlan(args); }
  catch (err) {
    if (err instanceof RiteUsage) return refuseUsage(args, "rite", helpLines("rite"), err.message);
    throw err;
  }
  if ((process.env[IN_CONTAINER_ENV] ?? "").trim() !== "") {
    const message = "keep-host-half-in-vessel: the keep's host half commits and pushes the workspace with the host's git; run `lares rite keep` on the host, where the bridge reaches the vessel half (`lares rite keep-cut`) as a row";
    emitAnswer(args, { ok: false, error: { code: "keep-host-half-in-vessel", message }, human: () => console.error(`lares rite: ${message}`) }, `lares rite: ${message}`);
    return 2;
  }
  // `--if-due` with no workspace named reads the house config's keep workspace; a config naming none keeps nothing, and says so.
  const workspace = plan.workspace ?? configuredKeepWorkspace();
  if (workspace === null) {
    const data = { rite: "keep", due: false, workspace: null, why: "no keep workspace named (LARES_KEEP_WORKSPACE, or one LARES_WORKSPACES pair)" };
    emitAnswer(args, { ok: true, data, human: () => console.error(`keep: ${data.why}; nothing kept`) }, `keep: ${data.why}; nothing kept`);
    return 0;
  }
  const ports: KeepHostPorts = {
    workspaceDir: hostWorkspaceDir,
    row: (verb, rowArgs) => cliVerb(["rite", verb, ...flagsOf(rowArgs)]),
    git: gitIn,
    say: (line) => console.error(line),
    // The down path's `--if-due` keep asks nobody; a keep the operator runs by hand offers a spent lei's refill.
    ...(plan.ifDue === true ? {} : { refill: liveRefill }),
  };
  const out = await riteKeepHost(ports, { ...plan, workspace });
  const refusal = String(out.data["refusal"] ?? "keep-stopped");
  const keepSaid = String(out.data["message"] ?? "the keep rite did not complete");
  emitAnswer(args, out.code === 0
    ? { ok: true, data: out.data, human: () => console.log(JSON.stringify(out.data)) }
    : { ok: false, data: out.data, error: { code: refusal, message: keepSaid }, human: () => console.log(JSON.stringify(out.data)) },
  out.code === 0 ? "lares rite keep: kept" : `lares rite keep: ${keepSaid}`);
  return out.code === 0 ? 0 : exitFor(refusal);
}

/**
 * `--rollback` alone stands the image that ran before; `--rollback <rev>` an older revision's image (its kept tag, or a build
 * from that commit with no checkout move). Absent, the rite runs forward.
 */
export function rollbackOf(args: ParsedArgs): { readonly rollback?: true | string } {
  const word = typeof args.options["rollback"] === "string" ? args.options["rollback"].trim() : undefined;
  if (word !== undefined && word !== "") {
    if (!/^[A-Za-z0-9._/@^~][A-Za-z0-9._/@^~-]*$/.test(word)) throw new RiteUsage("--rollback takes a revision (a commit, or a kept image's 12 hex), or nothing for the image that ran before");
    return { rollback: word };
  }
  return args.flags["rollback"] === true || word === "" ? { rollback: true } : {};
}

export async function cmdRite(args: ParsedArgs): Promise<number> {
  if (isKukulu(args.positional[0])) {
    // THE RITE NEEDS THE CONTAINER HOUSE: the shim rebuilds an image and raises a container, and a native house holds neither.
    // The same two files the host bridge reads: the checkout's shim, and the operator's surface env.
    const shim = join(CHECKOUT, "tools", "lares-container.sh"), envFile = join(homedir(), ".lares", "lares-surface.env");
    if ((process.env["LAR_ROOT"] ?? "").trim() !== "" || !existsSync(shim) || !existsSync(envFile)) {
      const message = "rite-needs-the-container-house: kūkulu rebuilds the vessel's image and raises its container through the host shim; run it on the host, with LAR_ROOT unset, where ~/.lares/lares-surface.env and tools/lares-container.sh stand";
      emitAnswer(args, { ok: false, error: { code: "rite-needs-the-container-house", message }, human: () => console.error(`lares rite: ${message}`) }, `lares rite: ${message}`);
      return 2;
    }
    const branch = typeof args.options["branch"] === "string" && args.options["branch"].trim() !== "" ? args.options["branch"].trim() : undefined;
    const faceWord = typeof args.options["face"] === "string" ? args.options["face"].trim() : undefined;
    if (faceWord !== undefined && !/^(?:0|[1-9][0-9]*)$/.test(faceWord)) throw new RiteUsage("--face takes a whole persona index from 0");
    const out = await riteKukulu(hostPorts(shim, (line) => console.error(line)), { ...(branch === undefined ? {} : { branch }), ...(faceWord === undefined ? {} : { face: Number(faceWord) }), ...rollbackOf(args) });
    const kukuluMessage = "the kūkulu rite did not complete; the lines above name where it stopped";
    const settled = out.data["awaits"] === "hand" ? `lares rite kukulu: the house waits on your hand: ${String(out.data["hand"])} on a terminal` : out.data["awaits"] === "unlock" ? "lares rite kukulu: the house stands; the landing waits on the unlock" : "lares rite kukulu: the house stands";
    emitAnswer(args, out.code === 0
      ? { ok: true, data: out.data, human: () => console.log(JSON.stringify(out.data)) }
      : { ok: false, data: out.data, error: { code: String(out.data["refusal"] ?? `rite-stopped-at-${String(out.data["stopped"] ?? "landing")}`), message: kukuluMessage }, human: () => console.log(JSON.stringify(out.data)) },
    out.code === 0 ? settled : `lares rite kukulu: ${kukuluMessage}`);
    return out.code;
  }
  const sub = args.positional[0];
  if (sub === "keep") return runKeepHost(args);
  if (sub === "keep-cut") return runKeepCut(args);
  let plan: RitePlan;
  try { plan = ritePlan(args); }
  catch (err) {
    if (err instanceof RiteUsage) return refuseUsage(args, "rite", helpLines("rite"), err.message);
    throw err;
  }
  return runRiteVerb(args, plan);
}
