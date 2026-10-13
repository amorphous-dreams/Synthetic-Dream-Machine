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

/**
 * Seat a custody holder IN THIS PROCESS over the staged root `LAR_ROOT` names, opened under the published test
 * route, for a suite that drives a node function directly where a `lares` command would open its own key session
 * (a kindle, a key mint). The root gets its marker and its custody first. `drop()` locks the holder and clears its
 * seat. The modules load from source, the same modules the calling suite imports.
 */
export async function seatStagedCustody(root: string): Promise<{ drop(): Promise<void> }> {
  seedTestCustody(root);
  const { TEST_PASSPHRASE } = await import(join(REPO_ROOT, "tools", "test-custody-route.mjs")) as { TEST_PASSPHRASE: string };
  const { FsCustodyIo } = await import("../../packages/lararium-node/src/custody-io.js");
  const { makeCustodyHolder } = await import("../../packages/lararium-node/src/custody-holder.js");
  const { seatCustody, unseatCustody } = await import("../../packages/lararium-node/src/custody-seat.js");
  const { vesselCustodyHomes } = await import("../../packages/lararium-node/src/vault-carriers.js");
  const homes = vesselCustodyHomes();
  const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  const opened = await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
  if (opened.reading !== "opens") throw new Error(`the staged custody at ${root} reads ${opened.reading} under the test route`);
  seatCustody(holder);
  return { async drop() { await holder.lock(); unseatCustody(holder); } };
}
