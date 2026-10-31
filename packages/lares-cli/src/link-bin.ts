/**
 * link-bin — link the mempalace console scripts into ~/.local/bin for `lares mempalace install`.
 * `lares` itself rides `lares home` (the `bin.lares` item). Idempotent; non-fatal.
 */

import { existsSync, mkdirSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface LinkResult {
  readonly ok: boolean;
  readonly detail: string;
}

/** Resolve a console script's source abs path. Checks the VENV bin first (where
 *  `pip install -e` writes the mempalace scripts — and the venv is usually NOT on
 *  PATH, the very gap this linking exists to bridge), then PATH (skipping
 *  ~/.local/bin so we never symlink to our own target). */
function resolveBin(name: string): string | null {
  const win = process.platform === "win32";
  const exe = win ? `${name}.exe` : name;
  const binSub = win ? "Scripts" : "bin";
  // venv source dirs first — pip-editable installs land here, off-PATH.
  const venvDirs: string[] = [];
  if (process.env["VIRTUAL_ENV"]) venvDirs.push(join(process.env["VIRTUAL_ENV"], binSub));
  venvDirs.push(join(homedir(), ".venv", binSub));
  for (const d of venvDirs) {
    const p = join(d, exe);
    if (existsSync(p)) return p;
  }
  const localBin = join(homedir(), ".local", "bin").replace(/[/\\]+$/, "").toLowerCase();
  for (const d of (process.env["PATH"] ?? "").split(win ? ";" : ":")) {
    if (!d || d.replace(/[/\\]+$/, "").toLowerCase() === localBin) continue;
    const p = join(d, exe);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Symlink a mempalace console script (mempalace / mempalace-mcp) into ~/.local/bin so
 * Claude's hook + MCP environment finds it WITHOUT the venv active — the venv-on-PATH
 * gap that broke the Stop hook and recall. The script's shebang pins the venv python
 * (with chromadb), so it still runs correctly. Idempotent; non-fatal.
 */
export function linkConsoleScript(name: string): LinkResult {
  const src = resolveBin(name);
  if (src === null) return { ok: false, detail: `${name} not on PATH — run \`lares mempalace install\` (submodule + pip)` };
  if (process.platform === "win32") {
    // pip writes <name>.exe into its Scripts dir (on PATH at install); not a symlink idiom.
    return { ok: true, detail: `${name} at ${src} (ensure its dir is on PATH)` };
  }
  const target = join(homedir(), ".local", "bin");
  mkdirSync(target, { recursive: true });
  const link = join(target, name);
  try {
    if (existsSync(link)) rmSync(link);
    symlinkSync(src, link);
    return { ok: true, detail: `symlinked ${link} -> ${src}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Link both mempalace console scripts so the keep-hooks + recall MCP resolve venv-free. */
export function linkMempalaceBins(): LinkResult[] {
  return ["mempalace", "mempalace-mcp"].map(linkConsoleScript);
}
