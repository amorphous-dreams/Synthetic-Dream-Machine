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
