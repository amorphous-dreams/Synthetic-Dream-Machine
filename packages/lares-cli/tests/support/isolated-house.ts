import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface IsolatedHouse {
  readonly scratchDir: string;
  readonly root: string;
  readonly home: string | undefined;
  close(): void;
}

/** Own a temporary LAR_ROOT and, on request, HOME and GIT_CONFIG_GLOBAL. Close nested houses innermost first. */
export function openIsolatedHouse(options: { home?: boolean; gitConfig?: boolean } = {}): IsolatedHouse {
  const scratchDir = mkdtempSync(join(tmpdir(), "lar-house-"));
  const root = join(scratchDir, "root");
  const home = options.home ? join(scratchDir, "home") : undefined;
  const prior = new Map<string, string | undefined>();
  let closed = false;

  function set(key: string, value: string): void {
    prior.set(key, process.env[key]);
    process.env[key] = value;
  }

  function close(): void {
    if (closed) return;
    for (const [key, value] of prior) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    prior.clear();
    rmSync(scratchDir, { recursive: true, force: true });
    closed = true;
  }

  try {
    mkdirSync(root);
    if (home) mkdirSync(home);
    set("LAR_ROOT", root);
    if (home) set("HOME", home);
    if (options.gitConfig) set("GIT_CONFIG_GLOBAL", join(scratchDir, "gitconfig"));
    return { scratchDir, root, home, close };
  } catch (error) {
    close();
    throw error;
  }
}
