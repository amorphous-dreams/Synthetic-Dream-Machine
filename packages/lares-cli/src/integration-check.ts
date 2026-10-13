/**
 * integration-check — verify (and, on demand, install) the mempalace integration
 * that `lares vessel stand` depends on. The CHECK is cheap and runs on every stand; the
 * INSTALL is one-time, behind `--install`, and touches the foundation.
 *
 * mempalace is a READ-ONLY sidecar submodule; we never edit it, only ensure it's
 * present and runnable so the witness organ is reachable.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { repoRoot } from "@lararium/mesh/node";
import { resolveMempalacePython } from "@lararium/mempalace";

const MEMPALACE_DIR = join(repoRoot, "mempalace");
const MEMPALACE_HOLDER_ENTRY = join(MEMPALACE_DIR, "mempalace", "mcp_server.py");
const MEMPALACE_PKG = join(repoRoot, "packages", "lararium-mempalace");
const MEMPALACE_PLUGIN = join(MEMPALACE_DIR, ".claude-plugin", "plugin.json");

/**
 * The Python interpreter that holds mempalace (venv-aware). ONE source of truth:
 * @lararium/mempalace owns the resolver; this re-export keeps `lares vessel stand`'s cheap
 * check on the exact same logic. A second copy kept "in lockstep" would drift.
 */
export const resolvePython = resolveMempalacePython;

export interface IntegrationCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
  /** True where the check fails while a PART of what it probes stands (a source directory that holds
   *  files and lacks its entry): a hand began something here, so the library never reads `absent`. */
  readonly partial?: boolean;
}

/**
 * How the memory library stands on this machine. The library keeps its own door (`lares mempalace install`)
 * and never rides a founding, so three readings stay apart:
 *
 *   · `integrated`: every check holds.
 *   · `absent`: no part of the library stands here: no submodule and no python that holds its deps. An
 *     optional organ nobody installed. The vessel stands whole without it.
 *   · `incomplete`: some part stands and another lacks: an install a hand began and something broke or
 *     stopped. That reads as a fault to cure.
 */
export type MempalaceStanding = "integrated" | "absent" | "incomplete";

export interface IntegrationReport {
  readonly ok: boolean;
  readonly standing: MempalaceStanding;
  readonly checks: readonly IntegrationCheck[];
}

/** The two checks that name the library itself: its source and the python that holds its deps. The
 *  integration package and the recall plugin ride the repository, so they say nothing of an install. */
const LIBRARY_CHECKS: ReadonlySet<string> = new Set(["submodule", "holder-deps"]);

/** Read the standing off the checks alone: pure, so a stand and a vector read one law. */
export function mempalaceStanding(checks: readonly IntegrationCheck[]): MempalaceStanding {
  if (checks.every((c) => c.ok)) return "integrated";
  const library = checks.filter((c) => LIBRARY_CHECKS.has(c.name));
  return library.length > 0 && library.every((c) => !c.ok && c.partial !== true) ? "absent" : "incomplete";
}

/**
 * WHAT `ok` MEANS ON A STAND: the vessel stands, no organ a hand installed stands broken, and the stand
 * refused no act its caller asked for. An absent memory library leaves a standing vessel `ok`; a
 * half-installed one does not, neither does a node that fails to answer, and neither does a re-stand the
 * host alone may perform (`refused`): the daemon answers there, and the act asked for did not happen.
 */
export function standOk(nodeUp: boolean, standing: MempalaceStanding, refused = false): boolean {
  return nodeUp && standing !== "incomplete" && !refused;
}

/** Cheap, every-stand-safe: file presence + a light `find_spec` (never a full import). */
export function checkMempalaceIntegration(): IntegrationReport {
  const checks: IntegrationCheck[] = [];

  const submoduleOk = existsSync(MEMPALACE_HOLDER_ENTRY);
  // A source directory that holds files and lacks its entry names a checkout a hand began: a part stands.
  // An empty directory (a submodule nobody initialized) and no directory at all both read as nothing here.
  const submodulePartial = !submoduleOk && (() => { try { return readdirSync(MEMPALACE_DIR).length > 0; } catch { return false; } })();
  checks.push({
    name: "submodule",
    ok: submoduleOk,
    detail: submoduleOk ? MEMPALACE_DIR : submodulePartial
      ? `${MEMPALACE_DIR} holds files and lacks its entry — \`lares mempalace install\` (submodule + pip)`
      : "absent — `lares mempalace install` (submodule + pip)",
    ...(submodulePartial ? { partial: true } : {}),
  });

  const pkgOk = existsSync(join(MEMPALACE_PKG, "package.json"));
  checks.push({
    name: "integration-package",
    ok: pkgOk,
    detail: pkgOk ? "@lararium/mempalace present" : "absent — the integration package is missing from packages/",
  });

  // find_spec does NOT execute the module (no heavy chromadb import) — stand-cheap.
  const py = resolvePython();
  let holderOk = false;
  let holderDetail = "no python (python3/python/py) on PATH — install Python to reach the holder";
  if (py !== null) {
    try {
      const probe = spawnSync(
        py,
        ["-c", "import importlib.util as u, sys; sys.exit(0 if (u.find_spec('mempalace') and u.find_spec('chromadb')) else 1)"],
        { cwd: MEMPALACE_DIR, timeout: 10_000 },
      );
      if (probe.error === undefined) {
        holderOk = probe.status === 0;
        holderDetail = holderOk
          ? `${py} -m mempalace.mcp_server importable`
          : "holder deps absent — `lares vessel stand --install` (pip install -e ./mempalace)";
      }
    } catch {
      /* leave the not-found default */
    }
  }
  checks.push({ name: "holder-deps", ok: holderOk, detail: holderDetail });

  const pluginOk = existsSync(MEMPALACE_PLUGIN);
  checks.push({
    name: "recall-plugin",
    ok: pluginOk,
    detail: pluginOk
      ? "mempalace .claude-plugin present (enable recall via `/plugin`)"
      : "mempalace .claude-plugin absent",
  });

  return { ok: checks.every((c) => c.ok), standing: mempalaceStanding(checks), checks };
}

export interface InstallStep {
  readonly step: string;
  readonly ran: boolean;
  readonly ok: boolean;
  readonly detail: string;
}

/** One-time installs a CLI can perform. Each step is idempotent (no-op if already done). */
export function installMempalaceIntegration(): InstallStep[] {
  const steps: InstallStep[] = [];

  if (!existsSync(MEMPALACE_HOLDER_ENTRY)) {
    try {
      execFileSync("git", ["submodule", "update", "--init", "mempalace"], { cwd: repoRoot, stdio: "pipe", timeout: 120_000 });
      steps.push({ step: "submodule-init", ran: true, ok: existsSync(MEMPALACE_HOLDER_ENTRY), detail: "git submodule update --init mempalace" });
    } catch (e) {
      steps.push({ step: "submodule-init", ran: true, ok: false, detail: errText(e) });
    }
  } else {
    steps.push({ step: "submodule-init", ran: false, ok: true, detail: "already present" });
  }

  const py = resolvePython();
  if (py === null) {
    steps.push({ step: "pip-install", ran: false, ok: false, detail: "no python (python3/python/py) on PATH — install Python first" });
    return steps;
  }

  let holderOk = false;
  try {
    holderOk =
      spawnSync(py, ["-c", "import importlib.util as u,sys; sys.exit(0 if u.find_spec('chromadb') else 1)"], {
        cwd: MEMPALACE_DIR,
        timeout: 10_000,
      }).status === 0;
  } catch {
    /* fall through to install */
  }
  if (!holderOk) {
    try {
      execFileSync(py, ["-m", "pip", "install", "-e", "."], { cwd: MEMPALACE_DIR, stdio: "pipe", timeout: 600_000 });
      steps.push({ step: "pip-install", ran: true, ok: true, detail: `${py} -m pip install -e ./mempalace` });
    } catch (e) {
      steps.push({ step: "pip-install", ran: true, ok: false, detail: errText(e).slice(0, 160) });
    }
  } else {
    steps.push({ step: "pip-install", ran: false, ok: true, detail: "holder deps already importable" });
  }

  return steps;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
