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
import { INTERRUPTED, priorImageRef, riteKukulu, type HouseLag, syncPlan, type PriorImage, type RefillPort, type RefillReq, type RitePorts, type RiteVerbAnswer, type OfferVouch, type PendingBegin, type StageTarget, type StandingBegin, type StandReading, type SyncAnswer } from "../rite-kukulu.js";
import { foundingRecordFromStatus, hostSeedOfferPort } from "../seed-offered.js";
import { storeFailure, storeVerb } from "../store-door.js";
import { KeepRefused, keepWorkspaceDir, keepFaceLine, riteKeep, type KeepPorts } from "../rite-keep.js";
import { houseFaces } from "../custody-door.js";
import { riteKeepHost, workspaceFromPairs, type GitAnswer, type KeepHostPorts } from "../rite-keep-host.js";
import type { ShoreFlushReading } from "../shore-core.js";
import { envValue, IN_CONTAINER_ENV, surfaceEnvPath } from "../surface-env.js";
import { configuredKeepWorkspace } from "../keep-config.js";
import { houseExport, bundleRefusal, LIVE_BUNDLE_DOORS } from "./house-bundle.js";
import { runVerb } from "../verb-call.js";
import { summaryOutput } from "../verb-result.js";
import { vesselDid } from "../env.js";
import { readOwnHand } from "@lararium/node";

export class RiteUsage extends Error {}

export type RiteVerb = "rite-begin" | "rite-land" | "rite-receipts" | "rite-offer";
export interface RitePlan { readonly verb: RiteVerb; readonly args: Record<string, unknown> }

/** The host sub-verb's two spellings. */
/** Every verb the rite door answers (`kūkulu` reads as `kukulu`). */
export const RITE_VERBS = ["kukulu", "keep", "keep-cut", "begin", "offer", "land", "receipts"] as const;

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
  // A kūkulu's begin and landing name the image the host made, so a landing over another image never reads par.
  const imageWord = word(args.options["image"]);
  const image = imageWord === undefined ? {} : { image: imageWord };
  if (act === "receipts") {
    // `--rite kukulu` reads every lent face's begun halves resting unlanded (`--branch` narrows them to its line).
    const rite = word(args.options["rite"]), branch = word(args.options["branch"]);
    return { verb: "rite-receipts", args: { ...(rite === undefined ? {} : { rite }), ...(branch === undefined ? {} : { branch }), ...face } };
  }
  if (act === "begin") {
    const rite = word(args.options["rite"]), branch = word(args.options["branch"]);
    if (rite === undefined || branch === undefined || head === undefined) throw new RiteUsage("begin names its rite, its branch and its head: --rite kukulu --branch <name> --head <commit> (a keep adds --staging <path>, the bundle it staged inside its workspace)");
    const staged = word(args.options["staging"]);
    return { verb: "rite-begin", args: { rite, branch, head, ...(staged === undefined ? {} : { staged }), ...image, ...face } };
  }
  if (act === "offer") {
    const branch = word(args.options["branch"]), image = word(args.options["image"]);
    if (branch === undefined || head === undefined || image === undefined) throw new RiteUsage("offer names its branch, its head and the image the host built: --branch <name> --head <commit> --image <digest>");
    // THE KEEPER MOVE rides the offer as the vessel reads it (`keeperTo`, `keeperNext`): both or neither, each in its own shape.
    const keeperTo = word(args.options["keeper-to"]), keeperNext = word(args.options["keeper-next"]);
    if ((keeperTo === undefined) !== (keeperNext === undefined) || (keeperTo !== undefined && (!/^[0-9a-f]{64}$/.test(keeperTo) || !/^sha256:[0-9a-f]{64}$/.test(keeperNext ?? "")))) {
      throw new RiteUsage("a keeper move names the successor's key and the committed closure together: --keeper-to <64 hex> --keeper-next sha256:<64 hex>, as `keeper-stand` printed them (or neither, and the offer carries no move)");
    }
    return { verb: "rite-offer", args: { branch, head, image, ...face, ...(keeperTo === undefined ? {} : { keeperTo, keeperNext }) } };
  }
  if (act === "land") {
    const tessera = word(args.options["tessera"]);
    if (tessera === undefined || head === undefined) throw new RiteUsage("land names its tessera and the head the vessel stands at: --tessera <id> --head <commit>");
    return { verb: "rite-land", args: { tessera, head, ...image, ...face } };
  }
  throw new RiteUsage(isKukulu(act) ? "kukulu runs on the host and plans no single row" : act === "keep" || act === "keep-cut" ? `${act} runs several rows and plans no single one` : `name a sub-verb: ${RITE_VERBS.join(", ")}`);
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
  cut: async (dest, opts) => {
    const r = await houseExport(dest, { acceptOmissions: opts.acceptOmissions, doors: LIVE_BUNDLE_DOORS, workspace: opts.workspace, houseOnly: true, ...(opts.woken !== undefined ? { woken: opts.woken } : {}) });
    return { ...r.manifest, unreadFaces: r.unreadFaces };
  },
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
      if ((out.unreadFaces?.length ?? 0) > 0) console.log(`    standing heads left behind for ${out.unreadFaces!.map((i) => `h${i}`).join(", ")} (this terminal alone names them)`);
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

/**
 * The shore's flush through the existing hand door (`lares shore flush --json`, forwarded into the vessel by the bridge): its
 * reading rides the envelope's `data` whether every island wrote (exit 0) or one fell short (3, 4); null where no reading came.
 */
const shoreFlushRow = (): Promise<ShoreFlushReading | null> => new Promise((resolve) => {
  const child = spawn(process.execPath, [BIN, "shore", "flush", "--json"], { stdio: ["ignore", "pipe", "inherit"] });
  let text = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { text += chunk; });
  child.once("error", () => resolve(null));
  child.once("close", () => {
    try {
      const data = (JSON.parse(text.trim().split("\n").at(-1) ?? "") as { data?: { islands?: unknown } }).data;
      resolve(data !== undefined && Array.isArray(data.islands) ? data as unknown as ShoreFlushReading : null);
    } catch { resolve(null); }
  });
});

/** One shim read: its last stdout line, trimmed, or null where it answers nothing or fails. */
const shimRead = (shim: string, argv: readonly string[]): Promise<string | null> => new Promise((resolve) => {
  execFile(shim, [...argv], { encoding: "utf8" }, (err, stdout) => {
    const line = (stdout ?? "").trim().split("\n").at(-1)?.trim() ?? "";
    resolve(err || line === "" ? null : line);
  });
});

/** Row args as flags: `true` rides as a bare flag, every other value as the next word. */
/** A row's args as the CLI line that plans them back: a camelCase key crosses as its kebab flag (`keeperTo` -> `--keeper-to`). */
const flagsOf = (rowArgs: Record<string, unknown>): string[] => Object.entries(rowArgs).flatMap(([k, v]) => {
  const flag = `--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
  return v === true ? [flag] : [flag, String(v)];
});

/**
 * One shim line on this terminal; the answer carries its exit code (a spawn that never ran reads as a failure). A CTRL+C reaches
 * the shim, which shares this terminal's foreground group and stops what it started; this process holds SIGINT until the shim
 * ends, so the rite still says where the house stands, and a shim ended by the signal answers `INTERRUPTED`.
 */
const runShim = (shim: string, argv: readonly string[]): Promise<number> => new Promise((resolve) => {
  const hold = (): void => {};
  process.on("SIGINT", hold);
  const child = spawn(shim, [...argv], { stdio: "inherit" });
  child.once("error", () => { process.off("SIGINT", hold); resolve(127); });
  child.once("close", (code, signal) => { process.off("SIGINT", hold); resolve(signal === "SIGINT" ? INTERRUPTED : code ?? 1); });
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
  const dirty = ((await out(["status", "--porcelain", "--untracked-files=no", "--ignore-submodules=all"])) ?? "") !== "";
  const plan = syncPlan({ branch, upstream, ahead, behind, dirty });
  if (plan.act !== "fast-forward") {
    if (plan.act !== "stand") return { ok: false, line: fetched + plan.line };
    const kept = await keepPins(dir);
    return { ok: kept.ok, line: fetched + plan.line + kept.line + (kept.ok ? await heldWork(dir) : "") };
  }
  const from = (await out(["rev-parse", "HEAD"])) ?? "";
  const merged = await gitIn(dir, ["merge", "--ff-only", "--quiet", "@{upstream}"]);
  if (merged.code !== 0) return { ok: false, line: `${fetched}the fast-forward of ${branch} to ${upstream} refused (${merged.stderr.trim().split("\n").at(-1) || `exit ${merged.code}`}); nothing moved` };
  const to = (await out(["rev-parse", "HEAD"])) ?? "";
  const kept = await keepPins(dir);
  return { ok: kept.ok, line: `${fetched}${branch} fast-forwarded ${behind} commit(s) from ${upstream}: ${from.slice(0, 12)}..${to.slice(0, 12)}${kept.line}${kept.ok ? await heldWork(dir) : ""}` };
}

/**
 * WORK HELD AT A PIN. The superproject's clean reading (`--ignore-submodules=all`) passes a submodule whose pin did not move yet
 * holds local or untracked work, so the answer names each such submodule: it never blocks, and nothing it holds is touched. The
 * returned line (empty where none holds work) leads with `; `. A submodule the pins step stopped on never reaches here.
 */
async function heldWork(dir: string): Promise<string> {
  const listed = await gitIn(dir, ["submodule", "status", "--recursive"]);
  if (listed.code !== 0) return "";
  const held: string[] = [];
  for (const l of listed.stdout.split("\n")) {
    const m = /^([ +\-U])([0-9a-f]{40}) (\S+)/.exec(l);
    if (!m || m[1] === "-") continue;
    const status = await gitIn(join(dir, m[3]!), ["status", "--porcelain"]);
    if (status.code === 0 && status.stdout.trim() !== "") held.push(m[3]!);
  }
  if (held.length === 0) return "";
  return held.length === 1
    ? `; submodule ${held[0]} holds local or untracked changes at its pin, left as it stands`
    : `; submodules ${held.join(", ")} hold local or untracked changes at their pins, left as they stand`;
}

/**
 * THE SUBMODULES' PINS: each submodule sits at the commit the superproject records, never a newer one (`git submodule update
 * --init --recursive`, no `--remote`). A submodule that must move yet holds local or untracked changes stops the rite with
 * one line naming it, and its work stays. The returned line (empty where every pin already held) leads with `; ` and names
 * each submodule that moved, from..to in short shas.
 */
async function keepPins(dir: string): Promise<{ readonly ok: boolean; readonly line: string }> {
  const read = async (): Promise<{ code: number; rows: { mark: string; sha: string; path: string }[] }> => {
    const r = await gitIn(dir, ["submodule", "status", "--recursive"]);
    const rows = r.stdout.split("\n").flatMap((l) => { const m = /^([ +\-U])([0-9a-f]{40}) (\S+)/.exec(l); return m ? [{ mark: m[1]!, sha: m[2]!, path: m[3]! }] : []; });
    return { code: r.code, rows };
  };
  const before = await read();
  const owing = before.rows.filter((r) => r.mark !== " ");
  if (before.code !== 0 || owing.length === 0) return { ok: true, line: "" };
  const conflicted = owing.find((r) => r.mark === "U");
  if (conflicted) return { ok: false, line: `; submodule ${conflicted.path} stands in a merge conflict, so no submodule moved; settle it by hand, then run it again` };
  for (const r of owing.filter((x) => x.mark === "+")) {
    const status = await gitIn(join(dir, r.path), ["status", "--porcelain"]);
    if (status.code === 0 && status.stdout.trim() !== "") return { ok: false, line: `; submodule ${r.path} holds local or untracked changes, so it stays as it stands and no submodule moved; commit or set them aside by hand, then run it again` };
  }
  const updated = await gitIn(dir, ["submodule", "update", "--init", "--recursive"]);
  if (updated.code !== 0) return { ok: false, line: `; the submodule update refused (${updated.stderr.trim().split("\n").at(-1) || `exit ${updated.code}`}); the submodules stand as they stood` };
  const after = new Map((await read()).rows.map((r) => [r.path, r.sha] as const));
  const moved = owing.flatMap((r) => { const now = after.get(r.path) ?? r.sha; return r.mark === "-" ? [`${r.path} initialised at ${now.slice(0, 12)}`] : now === r.sha ? [] : [`${r.path} ${r.sha.slice(0, 12)}..${now.slice(0, 12)}`]; });
  return { ok: true, line: moved.length > 0 ? `; submodules kept at their pins: ${moved.join(", ")}` : "" };
}

/**
 * One vessel row as the host's CLI line. The begin and the offer gather every lent face in the vessel, so they name none;
 * each landing names the face its tessera began under in its own arguments.
 */
export const hostRowLine = (verb: "rite-begin" | "rite-land" | "rite-offer" | "rite-receipts", rowArgs: Record<string, unknown>): string[] =>
  ["rite", verb.slice("rite-".length), ...flagsOf(rowArgs)];

/**
 * The standing read's CLI line: it always names a face, the operator's where one is named, else face 0 (the keep's face), so a
 * house with several faces open never reads it as `FaceNotNamed`.
 */
export const standingRowLine = (branch: string, face?: number): string[] => hostRowLine("rite-receipts", { rite: "kukulu", branch, face: face ?? 0 });

/**
 * THE BEGIN THAT STANDS, from the vessel's `rite receipts --rite kukulu` answer: its `standing` rows, each naming its face and
 * ordinal. A vessel of an older image answers its worn face's receipts and conferre instead, so the host reads that conferre's
 * kūkulu halves resting unlanded on the line (each lands under the worn face): the vessel standing during the very next run
 * is the one that stopped, and it never begins over a half it already rests.
 */
export function standingOf(output: Record<string, unknown>, branch: string): { begins: StandingBegin[]; pending?: PendingBegin[]; offer?: OfferVouch[] | null } {
  const rows = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : []);
  const image = (r: Record<string, unknown>): { image?: string } => (typeof r["image"] === "string" ? { image: r["image"] } : {});
  if (Array.isArray(output["standing"])) {
    const begins = rows(output["standing"]).map((s) => ({ face: String(s["face"]), ...(Number.isSafeInteger(s["ordinal"]) ? { ordinal: s["ordinal"] as number } : {}), tessera: String(s["tessera"]), head: String(s["head"]), ...image(s) }));
    // A REPLY NAMING NO `pending` reads its debt as unread (the rite fills it from what it stands), never as empty.
    const pending = Array.isArray(output["pending"]) ? rows(output["pending"]).map((p) => ({ tessera: String(p["tessera"]), group: String(p["group"]), head: String(p["head"]), ...image(p), ...(typeof p["face"] === "string" ? { face: p["face"] } : {}) })) : undefined;
    const offer = Array.isArray(output["offer"]) ? rows(output["offer"]).map((v) => ({ ...(typeof v["face"] === "string" ? { face: v["face"] } : {}), group: String(v["group"]), branch: String(v["branch"]), head: String(v["head"]), image: String(v["image"]) })) : null;
    return { begins, ...(pending === undefined ? {} : { pending, offer }) };
  }
  // AN ANSWER THAT NAMES NO `standing` ROWS carries its worn face's receipts and conferre: its unlanded kūkulu halves on the line, with no raw debt read.
  const conf = output["conferre"];
  const red = typeof conf === "object" && conf !== null ? rows((conf as Record<string, unknown>)["red"]) : [];
  return { begins: red.filter((t) => t["red"] === "landed-absent" && t["rite"] === "kukulu" && t["branch"] === branch && typeof t["head"] === "string")
    .map((t) => ({ face: "the worn face", tessera: String(t["tessera"]), head: String(t["head"]) })) };
}

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
 * Whether a kukulu lei stands on the line with a return left, read off `lei show` (one face's `lei`, or any lent face's); null
 * where the line reads no answer (no vessel stands, or the door refused), so the rite goes on as it did.
 */
async function hostLeiStands(branch: string, face?: number): Promise<boolean | string | null> {
  const shown = await cliVerb(["lei", "show", "--rite", "kukulu", "--branch", branch, ...(face !== undefined ? ["--face", String(face)] : [])]);
  return shown.ok ? leiReading(shown.output) : null;
}

/** One `lei show` answer read into what the rite needs: see `hostLeiStands`. */
export function leiReading(output: Record<string, unknown>): boolean | string | null {
  const lines = Array.isArray(output["faces"]) ? (output["faces"] as Array<{ lei?: unknown }>).map((f) => f.lei) : [output["lei"]];
  const read = lines.filter((l): l is { standing?: unknown; returnsLeft?: unknown; refusal?: unknown } => typeof l === "object" && l !== null);
  if (read.length === 0) return null;
  if (read.some((l) => l.standing === true && Number(l.returnsLeft ?? 0) > 0)) return true;
  // None stands with a return left: carry the refusal code through. Only where every face reads `absent` does the line read absent;
  // else the first cause that is not absence names the line (a spent or forked line is not an unstrung one).
  const causes = read.map((l) => (l.standing === true ? "returns-spent" : typeof l.refusal === "string" ? l.refusal : null));
  if (causes.every((c) => c === null)) return null;
  return causes.find((c) => c !== null && c !== "absent") ?? "absent";
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
    const question = req.absent === true
      ? `no ${req.rite} lei stands on ${req.branch}; string a ${req.rite} lei (${returns} returns ${req.all === true ? "per lent face" : `as h${String(req.face)}`}) under this passphrase?`
      : `the ${req.rite} lei for ${req.branch} is spent; string ${returns} more under your route?`;
    if (!(await ask(question))) return { strung: false, remedy };
    return { strung: (await run(argv)) === 0, remedy };
  };
}

const liveRefill: RefillPort = hostRefill(
  // A CTRL+C at the refill's question reads as no: nothing strung, nothing spent, and the refusal names the plain line.
  (q) => new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.once("SIGINT", () => { rl.close(); process.stderr.write("\n"); resolve(false); });
    rl.question(`${q} [y/N] `, (a) => { rl.close(); resolve(/^y(es)?$/i.test(a.trim())); });
  }),
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

/** THE LAG as the host reads it: the vessel's `vessel lay --lag` answer, null where it answers no reading of that shape. */
export function houseLagOf(output: Record<string, unknown>): HouseLag | null {
  const holdings = output["holdings"], benches = output["benches"];
  if (typeof output["source"] !== "string" || typeof output["lag"] !== "number" || !Array.isArray(holdings) || !Array.isArray(benches)) return null;
  const titles = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  const bench = (b: Record<string, unknown>) => ({
    slug: String(b["slug"]), toBag: String(b["toBag"]), planned: titles(b["planned"]),
    mounts: b["mounts"] === true ? true : b["mounts"] === false ? false : null, ...(typeof b["why"] === "string" ? { why: b["why"] } : {}),
  });
  const read = (benches as Array<Record<string, unknown>>).map(bench);
  return {
    source: output["source"], checkout: output["checkout"] === true, lag: output["lag"],
    holdings: (holdings as Array<Record<string, unknown>>).map((h) => ({ holding: String(h["holding"]), toBag: String(h["toBag"]), new: titles(h["new"]), changed: titles(h["changed"]) })),
    wikis: typeof output["wikis"] === "string" ? output["wikis"] : null, benches: read, benchLag: read.reduce((n, b) => n + b.planned.length, 0),
  };
}

/** One yes-or-no on this terminal, asked on stderr; a Ctrl+C at the question reads as no. */
const askOnTerminal = (q: string): Promise<boolean> => new Promise((resolve) => {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  rl.once("SIGINT", () => { rl.close(); process.stderr.write("\n"); resolve(false); });
  rl.question(`${q} [y/N] `, (a) => { rl.close(); resolve(/^y(es)?$/i.test(a.trim())); });
});

/**
 * The workbench lay on this terminal, after the owner's yes: this CLI again (the bridge forwards it into the vessel), the checkout's
 * workbench folders alone. A Ctrl+C reaches the lay, which shares this terminal; this process holds SIGINT until it ends.
 */
const layWorkbenchOnTerminal = (): Promise<number> => new Promise((resolve) => {
  const hold = (): void => {};
  process.on("SIGINT", hold);
  const child = spawn(process.execPath, [BIN, "vessel", "lay", "--workbench", "--apply"], { stdio: "inherit" });
  child.once("error", () => { process.off("SIGINT", hold); resolve(127); });
  child.once("close", (code, signal) => { process.off("SIGINT", hold); resolve(signal === "SIGINT" ? INTERRUPTED : code ?? 1); });
});

/** The host's ports: git in this checkout, this CLI again for a vessel row (the bridge forwards it), and the checkout's shim. */
function hostPorts(shim: string, say: (line: string) => void): RitePorts {
  return {
    refill: liveRefill,
    leiStands: hostLeiStands,
    prior: readPriorImage,
    seedOffer: (head) => hostSeedOffer(head).catch(() => null),   // a read-only line never stops the rite
    sync: () => syncCheckout(CHECKOUT),
    checkout: async () => ({ head: await git(["rev-parse", "HEAD"]), branch: await git(["rev-parse", "--abbrev-ref", "HEAD"]) }),
    stage: (target) => stageShim(shim, target),
    raise: (revision, keeper) => runShim(shim, ["rebuild", "--at", revision, "--keep-after-landing", ...(keeper ? ["--keeper-to", keeper.to] : [])]),
    // THE KEEPER MOVE: the shim stands the successor and prints one JSON line naming its key and closure.
    keeperStand: async () => {
      const line = await shimRead(shim, ["keeper-stand"]);
      try {
        const read = JSON.parse(line ?? "null") as { to?: unknown; closure?: unknown } | null;
        return read !== null && typeof read.to === "string" && /^[0-9a-f]{64}$/.test(read.to) && typeof read.closure === "string" && /^sha256:[0-9a-f]{64}$/.test(read.closure) ? { to: read.to, closure: read.closure } : null;
      } catch { return null; }
    },
    // THE COMMIT THE KUKULU LEI LICENSES: the shim's guards, then the keeper rests it; its lines name any refusal.
    keeperLeiSpend: async (revision, branch) => (await runShim(shim, ["pulama", "keeper-commit", "--lei", revision, branch])) === 0,
    tty: () => process.stdin.isTTY === true && process.stdout.isTTY === true,
    row: (verb, rowArgs) => cliVerb(hostRowLine(verb, rowArgs)),
    standing: async (branch, face) => {
      const read = await cliVerb(standingRowLine(branch, face));
      return read.ok ? { ok: true, ...standingOf(read.output, branch) } : read;
    },
    ranImage: () => shimRead(shim, ["vessel-image"]),
    // THE KEEP AFTER THE LANDING: the raise defers the keep a down left owed (`--keep-after-landing`), and the rite runs it here.
    keepOwed: () => runShim(shim, ["keep-owed"]),
    // THE LAG AFTER THE RAISE: read in the vessel that stands; the workbench lay rides the owner's yes on this terminal, never canon.
    floorCard: async () => { const read = await cliVerb(["vessel", "floor", "status"]); const card = read.ok ? read.output["card"] as { title?: unknown } | undefined : undefined; return typeof card?.title === "string" ? { title: card.title } : null; },
    houseLag: async () => { const read = await cliVerb(["vessel", "lay", "--lag"]); return read.ok ? houseLagOf(read.output) : null; },
    ask: askOnTerminal,
    layWorkbench: layWorkbenchOnTerminal,
    // An AI launcher seats the rite: the house hand gate reads this command's branch (`readOwnHand`), and any refusal (a harness's
    // mark or chain, or a chain that reads no person's hand; the bridge marks it the same way) reads as a seat that never lays.
    seat: () => "refusal" in readOwnHand({ proveRoute: false }),
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
    // THE SHORE'S FLUSH BEFORE THE CUT rides the hand door that stands (daemon and active wiki alone); no reach widens for it.
    flush: shoreFlushRow,
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
