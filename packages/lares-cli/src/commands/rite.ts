/**
 * `lares rite kukulu | keep | begin | land | receipts` — the rite door.
 *
 *   kukulu     (kūkulu) on the HOST: raise the vessel again around its hearth. Begins the rite in the vessel, then calls the
 *              host shim to rebuild the image, take the vessel down and raise a new one, then lands the rite (`../rite-kukulu.ts`)
 *   keep       on the HOST: keep the house in the operator's repo. Guards the bound workspace, runs `keep-cut` in the vessel,
 *              then commits `<into>`, rebases, pushes, and lands the tessera at the bundle id the pushed tree holds
 *              (`--workspace <name> [--into <path>]`, `../rite-keep-host.ts`)
 *   keep-cut   IN THE VESSEL: the keep's vessel half: lay the house's authored memory, cut as a cleartext carry bundle, into the
 *              bound workspace, spending a return of the keep lei strung for that workspace (`../rite-keep.ts`)
 *   begin      `rite-begin` in the vessel: derive the head's tree, return the rite's lei, rest the guest half of the tessera
 *   land       `rite-land` in the vessel that stands after: rest the host half, naming the begun half and the head
 *   receipts   `rite-receipts`: every half that verifies (`data.receipts`) and conferre's read of them (`data.conferre`)
 *   offer      `rite-offer` in the STANDING vessel, between the build and the lowering: gather the line's lei, sign the vouch over
 *              the image the host built, and rest the offer the next vessel carries to the pūlama
 *   receipt    `rite-receipt`: the host battery hands the vessel its verdict over a tree, and the vessel signs `receipt/<tree>`.
 *              It notarises testimony: the vessel re-runs no check
 *
 * The lei carries the grant: the hand strung it (`lares lei kui --rite kukulu …`, `--rite keep --branch <workspace> …`), and any
 * seat holding the line may spend it.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import { riteKukulu, type RitePorts, type RiteRowAnswer } from "../rite-kukulu.js";
import { storeFailure, storeVerb } from "../store-door.js";
import { KeepRefused, keepWorkspaceDir, riteKeep, type KeepPorts } from "../rite-keep.js";
import { riteKeepHost, workspaceFromPairs, type GitAnswer, type KeepHostPorts } from "../rite-keep-host.js";
import { envValue, IN_CONTAINER_ENV, surfaceEnvPath } from "../surface-env.js";
import { carryExport, carryRefusal, LIVE_CARRY_DOORS } from "./carry.js";

export class RiteUsage extends Error {}

export type RiteVerb = "rite-begin" | "rite-land" | "rite-receipts" | "rite-receipt" | "rite-offer";
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
    if (rite === undefined || branch === undefined || head === undefined) throw new RiteUsage("begin names its rite, its branch and its head: --rite kukulu --branch <name> --head <commit>");
    return { verb: "rite-begin", args: { rite, branch, head, ...face } };
  }
  if (act === "receipt") {
    // `--tree` reads as a bare flag across this CLI (the parser's boolean list), so the tree itself rides the next word:
    // `receipt --tree <t>` and `receipt <t>` name it alike.
    const tree = args.flags["tree"] === false ? undefined : word(args.positional[1]);
    const verdict = word(args.options["verdict"]), definitions = word(args.options["definitions"]);
    const checks = (word(args.options["checks"]) ?? "").split(",").map((c) => c.trim()).filter((c) => c !== "");
    if (tree === undefined || verdict === undefined || definitions === undefined || checks.length === 0) throw new RiteUsage("receipt names its tree, its checks, its verdict and its definitions: --tree <t> --checks <a,b> --verdict pass|fail --definitions <hash>");
    return { verb: "rite-receipt", args: { tree, checks, verdict, definitions, ...face } };
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
export function keepPlan(args: ParsedArgs): { readonly workspace: string; readonly into?: string; readonly acceptOmissions: boolean; readonly face?: number } {
  const word = (raw: string | undefined): string | undefined => (typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined);
  const workspace = word(args.options["workspace"]), into = word(args.options["into"]), faceWord = word(args.options["face"]);
  if (workspace === undefined) throw new RiteUsage("keep names the workspace it lays the bundle into: --workspace <name> [--into <path>]");
  if (faceWord !== undefined && !/^(?:0|[1-9][0-9]*)$/.test(faceWord)) throw new RiteUsage("--face takes a whole persona index from 0");
  return { workspace, ...(into !== undefined ? { into } : {}), acceptOmissions: args.flags["accept-omissions"] === true, ...(faceWord !== undefined ? { face: Number(faceWord) } : {}) };
}

/** The keep's live ports: the vessel's rows through the store door, and the cut through the carry export. */
const KEEP_PORTS: KeepPorts = {
  row: async (verb, rowArgs) => {
    try { return { ok: true, output: (await storeVerb(verb, rowArgs)).output }; }
    catch (err) { const failure = storeFailure(err); return { ok: false, code: failure.code, message: failure.message }; }
  },
  cut: async (dest, opts) => (await carryExport(dest, { acceptOmissions: opts.acceptOmissions, doors: LIVE_CARRY_DOORS, workspace: opts.workspace })).manifest,
};

/** The vessel half alone (`rite keep-cut`): the cut, the return and the guest half, with no git. */
async function runKeepCut(args: ParsedArgs): Promise<number> {
  let plan: ReturnType<typeof keepPlan>;
  try { plan = keepPlan(args); }
  catch (err) {
    if (err instanceof RiteUsage) return refuseUsage(args, "rite", helpLines("rite"), err.message);
    throw err;
  }
  try {
    const out = await riteKeep(KEEP_PORTS, plan);
    emit(args, { ok: true, data: out, human: () => {
      if (!out.kept) { console.log(`keep: ${out.dest} already holds bundle ${out.bundleId.slice(0, 16)}; nothing spent and nothing moved`); return; }
      console.log(`keep: bundle ${out.bundleId.slice(0, 16)} rests at ${out.dest} (faces: ${out.faces.join(", ") || "(none)"}), return ${out.n} of the keep lei spent`);
      for (const o of out.omissions) console.log(`  left behind: ${o.kind}${o.count !== undefined ? ` (${o.count})` : ""} — ${o.detail}`);
      console.log(`keep: the bundle rests unencrypted (private memory as plain files); the host half commits and pushes it, then lands the rite: lares rite land --tessera ${out.tessera} --head ${out.bundleId}`);
    } });
    return 0;
  } catch (err) {
    if (err instanceof KeepRefused) {
      emit(args, { ok: false, error: { code: err.code, message: err.message }, human: () => console.error(`lares rite keep-cut: ${err.message}`) });
      return exitFor(err.code);
    }
    return carryRefusal(args, "rite keep-cut", err);
  }
}

async function runRow(args: ParsedArgs, plan: RitePlan): Promise<number> {
  try {
    const { output } = await storeVerb(plan.verb, plan.args);
    emit(args, { ok: true, data: output, human: () => console.log(JSON.stringify(output)) });
    return 0;
  } catch (err) {
    const failure = storeFailure(err);
    emit(args, { ok: false, error: failure, human: () => console.error(`lares rite: ${failure.message}`) });
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
const cliRow = (line: readonly string[]): Promise<RiteRowAnswer> => new Promise<RiteRowAnswer>((resolve) => {
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

/** One shim verb on this terminal; the answer carries its exit code (a spawn that never ran reads as a failure). */
const runShim = (shim: string, verb: string): Promise<number> => new Promise((resolve) => {
  const child = spawn(shim, [verb], { stdio: "inherit" });
  child.once("error", () => resolve(127));
  child.once("close", (code) => resolve(code ?? 1));
});

/** One shim verb whose answer the rite reads: its last line of stdout, or null where the shim names none. */
const readShim = (shim: string, verb: string): Promise<string | null> => new Promise((resolve) => {
  execFile(shim, [verb], { encoding: "utf8" }, (err, stdout) => resolve(err ? null : stdout.trim().split("\n").at(-1)?.trim() || null));
});

/** The shim verb that names the digest of the image the build left (the same digest the shim reports to a pūlama at `up`). */
export const SHIM_IMAGE_VERB = "image-digest";

/** The host's ports: git in this checkout, this CLI again for a vessel row (the bridge forwards it), and the checkout's shim. */
function hostPorts(runShim: (verb: string) => Promise<number>, face: string | undefined, say: (line: string) => void, image: () => Promise<string | null>): RitePorts {
  return {
    image,
    checkout: async () => ({ head: await git(["rev-parse", "HEAD"]), branch: await git(["rev-parse", "--abbrev-ref", "HEAD"]) }),
    row: (verb, rowArgs) => cliRow(["rite", verb === "rite-begin" ? "begin" : verb === "rite-offer" ? "offer" : "land", ...flagsOf(rowArgs), ...(face === undefined ? [] : ["--face", face])]),
    shim: (verb) => runShim(verb),
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
    emit(args, { ok: false, error: { code: "keep-host-half-in-vessel", message }, human: () => console.error(`lares rite: ${message}`) });
    return 2;
  }
  const ports: KeepHostPorts = {
    workspaceDir: hostWorkspaceDir,
    row: (verb, rowArgs) => cliRow(["rite", verb, ...flagsOf(rowArgs)]),
    git: gitIn,
    say: (line) => console.error(line),
  };
  const out = await riteKeepHost(ports, plan);
  const refusal = String(out.data["refusal"] ?? "keep-stopped");
  emit(args, out.code === 0
    ? { ok: true, data: out.data, human: () => console.log(JSON.stringify(out.data)) }
    : { ok: false, data: out.data, error: { code: refusal, message: String(out.data["message"] ?? "the keep rite did not complete") }, human: () => console.log(JSON.stringify(out.data)) });
  return out.code === 0 ? 0 : exitFor(refusal);
}

export async function cmdRite(args: ParsedArgs): Promise<number> {
  if (isKukulu(args.positional[0])) {
    // THE RITE NEEDS THE CONTAINER HOUSE: the shim rebuilds an image and raises a container, and a native house holds neither.
    // The same two files the host bridge reads: the checkout's shim, and the operator's surface env.
    const shim = join(CHECKOUT, "tools", "lares-container.sh"), envFile = join(homedir(), ".lares", "lares-surface.env");
    if ((process.env["LAR_ROOT"] ?? "").trim() !== "" || !existsSync(shim) || !existsSync(envFile)) {
      const message = "rite-needs-the-container-house: kūkulu rebuilds the vessel's image and raises its container through the host shim; run it on the host, with LAR_ROOT unset, where ~/.lares/lares-surface.env and tools/lares-container.sh stand";
      emit(args, { ok: false, error: { code: "rite-needs-the-container-house", message }, human: () => console.error(`lares rite: ${message}`) });
      return 2;
    }
    const branch = typeof args.options["branch"] === "string" && args.options["branch"].trim() !== "" ? args.options["branch"].trim() : undefined;
    const face = typeof args.options["face"] === "string" ? args.options["face"] : undefined;
    const out = await riteKukulu(hostPorts((verb) => runShim(shim, verb), face, (line) => console.error(line), async () => { const d = await readShim(shim, SHIM_IMAGE_VERB); return d !== null && /^[a-z0-9]+:[0-9a-f]{32,128}$/.test(d) ? d : null; }), branch === undefined ? {} : { branch });
    emit(args, out.code === 0
      ? { ok: true, data: out.data, human: () => console.log(JSON.stringify(out.data)) }
      : { ok: false, data: out.data, error: { code: String(out.data["refusal"] ?? `rite-stopped-at-${String(out.data["stopped"] ?? "landing")}`), message: "the kūkulu rite did not complete; the lines above name where it stopped" }, human: () => console.log(JSON.stringify(out.data)) });
    return out.code;
  }
  if (args.positional[0] === "keep") return runKeepHost(args);
  if (args.positional[0] === "keep-cut") return runKeepCut(args);
  let plan: RitePlan;
  try { plan = ritePlan(args); }
  catch (err) {
    if (err instanceof RiteUsage) return refuseUsage(args, "rite", helpLines("rite"), err.message);
    throw err;
  }
  return runRow(args, plan);
}
