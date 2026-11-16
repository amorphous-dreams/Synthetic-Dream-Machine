/**
 * `lares rite kukulu | begin | land | receipts` — the rite door.
 *
 *   kukulu     (kūkulu) on the HOST: raise the vessel again around its hearth. Begins the rite in the vessel, then calls the
 *              host shim to rebuild the image, take the vessel down and raise a new one, then lands the rite (`../rite-kukulu.ts`)
 *   begin      `rite-begin` in the vessel: derive the head's tree, return the rite's lei, rest the guest half of the tessera
 *   land       `rite-land` in the vessel that stands after: rest the host half, naming the begun half and the head
 *   receipts   `rite-receipts`: every half that verifies (`data.receipts`) and conferre's read of them (`data.conferre`)
 *
 * The lei carries the grant: the hand strung it (`lares lei kui --rite kukulu …`), and any seat holding the line may spend it.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import { riteKukulu, type RitePorts, type RiteRowAnswer } from "../rite-kukulu.js";
import { storeFailure, storeVerb } from "../store-door.js";

export class RiteUsage extends Error {}

export type RiteVerb = "rite-begin" | "rite-land" | "rite-receipts";
export interface RitePlan { readonly verb: RiteVerb; readonly args: Record<string, unknown> }

/** The host sub-verb's two spellings. */
export const isKukulu = (word: string | undefined): boolean => word === "kukulu" || word === "kūkulu";

/** One vessel sub-verb's store row and args, or a `RiteUsage` naming what the line lacks. */
export function ritePlan(args: ParsedArgs): RitePlan {
  const act = args.positional[0];
  // Each flag reads by its own literal name, so the accepts law walks them.
  const word = (name: string, raw: string | undefined, bare: boolean | undefined): string | undefined => {
    if (bare !== undefined) throw new RiteUsage(`--${name} takes a value`);
    return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
  };
  const faceWord = word("face", args.options["face"], args.flags["face"]);
  if (faceWord !== undefined && !/^(?:0|[1-9][0-9]*)$/.test(faceWord)) throw new RiteUsage("--face takes a whole persona index from 0");
  const face = faceWord === undefined ? {} : { face: Number(faceWord) };
  const head = word("head", args.options["head"], args.flags["head"]);
  if (act === "receipts") return { verb: "rite-receipts", args: { ...face } };
  if (act === "begin") {
    const rite = word("rite", args.options["rite"], args.flags["rite"]), branch = word("branch", args.options["branch"], args.flags["branch"]);
    if (rite === undefined || branch === undefined || head === undefined) throw new RiteUsage("begin names its rite, its branch and its head: --rite kukulu --branch <name> --head <commit>");
    return { verb: "rite-begin", args: { rite, branch, head, ...face } };
  }
  if (act === "land") {
    const tessera = word("tessera", args.options["tessera"], args.flags["tessera"]);
    if (tessera === undefined || head === undefined) throw new RiteUsage("land names its tessera and the head the vessel stands at: --tessera <id> --head <commit>");
    return { verb: "rite-land", args: { tessera, head, ...face } };
  }
  throw new RiteUsage(isKukulu(act) ? "kukulu runs on the host and plans no single row" : "name a sub-verb: kukulu, begin, land or receipts");
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

/** One shim verb on this terminal; the answer carries its exit code (a spawn that never ran reads as a failure). */
const runShim = (shim: string, verb: string): Promise<number> => new Promise((resolve) => {
  const child = spawn(shim, [verb], { stdio: "inherit" });
  child.once("error", () => resolve(127));
  child.once("close", (code) => resolve(code ?? 1));
});

/** The host's ports: git in this checkout, this CLI again for a vessel row (the bridge forwards it), and the checkout's shim. */
function hostPorts(runShim: (verb: string) => Promise<number>, face: string | undefined, say: (line: string) => void): RitePorts {
  return {
    checkout: async () => ({ head: await git(["rev-parse", "HEAD"]), branch: await git(["rev-parse", "--abbrev-ref", "HEAD"]) }),
    row: (verb, rowArgs) => new Promise<RiteRowAnswer>((resolve) => {
      const line = ["rite", verb === "rite-begin" ? "begin" : "land", ...Object.entries(rowArgs).flatMap(([k, v]) => [`--${k}`, String(v)]), ...(face === undefined ? [] : ["--face", face]), "--json"];
      const child = spawn(process.execPath, [BIN, ...line], { stdio: ["inherit", "pipe", "inherit"] });
      let text = "";
      child.stdout.setEncoding("utf8").on("data", (chunk: string) => { text += chunk; });
      child.once("error", (err) => resolve({ ok: false, code: "rite-row-unreached", message: err.message }));
      child.once("close", (code) => {
        let answer: { ok?: boolean; data?: Record<string, unknown>; error?: { code?: string; message?: string } } | null = null;
        try { answer = JSON.parse(text.trim().split("\n").at(-1) ?? ""); } catch { answer = null; }
        if (answer?.ok === true && answer.data) resolve({ ok: true, output: answer.data });
        else resolve({ ok: false, code: answer?.error?.code ?? "rite-row-unreached", message: answer?.error?.message ?? `the row answered no reading (exit ${code ?? "none"})` });
      });
    }),
    shim: (verb) => runShim(verb),
    say,
  };
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
    const out = await riteKukulu(hostPorts((verb) => runShim(shim, verb), face, (line) => console.error(line)), branch === undefined ? {} : { branch });
    emit(args, out.code === 0
      ? { ok: true, data: out.data, human: () => console.log(JSON.stringify(out.data)) }
      : { ok: false, data: out.data, error: { code: String(out.data["refusal"] ?? `rite-stopped-at-${String(out.data["stopped"] ?? "landing")}`), message: "the kūkulu rite did not complete; the lines above name where it stopped" }, human: () => console.log(JSON.stringify(out.data)) });
    return out.code;
  }
  let plan: RitePlan;
  try { plan = ritePlan(args); }
  catch (err) {
    if (err instanceof RiteUsage) return refuseUsage(args, "rite", helpLines("rite"), err.message);
    throw err;
  }
  return runRow(args, plan);
}
