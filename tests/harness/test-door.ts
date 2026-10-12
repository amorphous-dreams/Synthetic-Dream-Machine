import { execFileSync } from "node:child_process";
import { join } from "node:path";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

/**
 * The custody test door, driven the way every harness drives it: STAGE the root (write the scratch marker the door
 * demands), then found its custody under the published test route. The door refuses a root without the marker, so a
 * harness that skips the staging step cannot found anything.
 */
export function seedTestCustody(root: string, stdio: "pipe" | "ignore" = "pipe"): void {
  execFileSync(process.execPath, [join(REPO_ROOT, "tools", "test-scratch-marker.mjs"), root], { stdio });
  execFileSync(process.execPath, [join(REPO_ROOT, "tools", "seed-test-custody.mjs"), root], { stdio });
}

/** What the unlock door's daemon answered: the parsed answer, the door's exit code, and its stderr. */
export interface TestUnlock { readonly code: number; readonly answer: Record<string, unknown> | null; readonly stderr: string }

/**
 * Unlock a STAGED vessel that stands, through the test door (`tools/unlock-test-custody.mjs`): the door refuses a
 * root without the scratch marker before any socket opens, then sends the daemon the unlock frame under the
 * published test route. `act` also drives the door's `--lock` and `--status`. Never throws on a refusal: the
 * caller reads the code (0 opened · 1 the daemon answered otherwise · 2 unmarked · 3 no daemon).
 */
export function unlockTestCustody(root: string, act: "unlock" | "lock" | "status" = "unlock"): TestUnlock {
  const args = [join(REPO_ROOT, "tools", "unlock-test-custody.mjs"), root, ...(act === "unlock" ? [] : [`--${act}`])];
  try {
    const out = execFileSync(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    return { code: 0, answer: JSON.parse(out.trim().split("\n").pop() ?? "null") as Record<string, unknown>, stderr: "" };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    let answer: Record<string, unknown> | null = null;
    try { answer = JSON.parse((err.stdout ?? "").trim().split("\n").pop() ?? "null") as Record<string, unknown> | null; } catch { /* no answer */ }
    return { code: err.status ?? 1, answer, stderr: err.stderr ?? "" };
  }
}
