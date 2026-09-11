/**
 * harness/vessel-key — mint (or load) a staged vessel's OWN key under ITS root.
 *
 * The identity dir resolves from `LAR_ROOT` at call time, never from a path argument; a test process
 * carries no `LAR_ROOT`, so calling the identity mint in-process reaches the operator's home key. The
 * mint runs in a subprocess under the joiner's env instead — the same function `lares vessel found`
 * loads from, so the key the founder admits is the key the joiner's daemon boots on.
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const IDENTITY  = join(REPO_ROOT, "packages/lararium-node/dist/src/node-vessel-identity.js");

/** The joiner's Ed25519 verifying key (hex), minted under `root` if absent. */
export function mintVesselKey(root: string): Promise<string> {
  const script =
    `import { generateOrLoadVesselIdentity } from ${JSON.stringify(IDENTITY)};\n` +
    `const id = await generateOrLoadVesselIdentity(process.env.LAR_ROOT + "/data/lares/vessel");\n` +
    `process.stdout.write("KEY " + id.verifyingKey + "\\n");\n`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
      env: { ...process.env, LAR_ROOT: root },
      cwd: REPO_ROOT,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += String(d); });
    child.stderr.on("data", (d) => { err += String(d); });
    child.on("close", (code) => {
      const key = /^KEY ([0-9a-f]{64})$/m.exec(out)?.[1];
      if (code === 0 && key) resolve(key);
      else reject(new Error(`mintVesselKey(${root}) failed (${code})\n${out}\n${err}`));
    });
  });
}
