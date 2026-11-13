/** Node supervision for one disposable, mounted Sensorium serving operation. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { resolveMempalacePython } from "@lararium/mempalace";

export interface TrialServingOptions {
  operationRoot: string;
  modelHome?: string;
  freezeReceipt?: string;
  intent?: string;
  sourceHost?: string;
  device?: "auto" | "cpu" | "cuda";
}

/** The owned Content path passed to the same search cap used by ordinary `sense search`. */
export function trialContentDir(operationRoot: string): string {
  if (!isAbsolute(operationRoot)) throw new Error("trial operation root must be absolute");
  return join(operationRoot, "sensorium", "content");
}

export async function runTrialServing(op: "run" | "status" | "allowed-cids", opts: TrialServingOptions): Promise<Record<string, unknown>> {
  trialContentDir(opts.operationRoot);
  const python = resolveMempalacePython();
  if (!python) throw new Error("trial serving needs the pinned MemPalace Python interpreter");
  const script = join(repoRoot, "packages", "lararium-sensorium", "scripts", "trial_serving.py");
  if (!existsSync(script)) throw new Error(`trial serving script is absent: ${script}`);
  if (op === "run" && (!opts.freezeReceipt || !opts.intent || !opts.sourceHost || !opts.modelHome)) {
    throw new Error("trial run needs freeze receipt, intent, source host and model home");
  }
  const argv = [script, op, "--operation-root", opts.operationRoot];
  if (op === "run") {
    argv.push("--state-root", join(opts.operationRoot, "state"),
      "--sensorium-root", join(opts.operationRoot, "sensorium"));
    argv.push("--freeze-receipt", opts.freezeReceipt!, "--intent", opts.intent!,
      "--source-host", opts.sourceHost!, "--model-home", opts.modelHome!);
    if (opts.device) argv.push("--device", opts.device);
  }
  return runJsonPython(python, argv, opts.modelHome);
}

/** Refuse a recall query if its model cache differs from the pinned projection assets. */
export async function verifyTrialModel(modelHome: string): Promise<Record<string, unknown>> {
  const python = resolveMempalacePython();
  if (!python) throw new Error("trial search needs the pinned MemPalace Python interpreter");
  const script = join(repoRoot, "packages", "lararium-sensorium", "scripts", "trial_model_check.py");
  return runJsonPython(python, [script, "--state-root", modelHome], modelHome);
}

async function runJsonPython(python: string, argv: string[], modelHome?: string): Promise<Record<string, unknown>> {
  const env = { ...process.env, PYTHONPATH: join(repoRoot, "mempalace"),
    ...(modelHome ? { HOME: modelHome } : {}) };
  return await new Promise<Record<string, unknown>>((resolve, reject) => {
    const child = spawn(python, argv, { cwd: repoRoot, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const cap = 4 * 1024 * 1024;
    child.stdout.on("data", (b: Buffer) => {
      stdout += b.toString();
      if (stdout.length > cap) child.kill();
    });
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString();
      if (stderr.length > cap) child.kill();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`trial Python operation failed (${code}): ${stderr.trim() || stdout.trim()}`));
      try {
        const result: unknown = JSON.parse(stdout.trim());
        if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("expected JSON object");
        resolve(result as Record<string, unknown>);
      } catch (e) {
        reject(new Error(`trial Python operation gave invalid JSON: ${e instanceof Error ? e.message : String(e)}`));
      }
    });
  });
}
