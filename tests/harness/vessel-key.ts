/**
 * harness/vessel-key — mint a staged vessel's OWN per-Nexus key under ITS root.
 *
 * The identity dir resolves from `LAR_ROOT` at call time, never from a path argument; a test process
 * carries no `LAR_ROOT`, so calling a key mint in-process reaches the operator's home. The mint runs in
 * a subprocess under the vessel's env instead, inside the custody its staging founded.
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const NODE      = join(REPO_ROOT, "packages/lararium-node/dist/src/index.js");
const ROUTE     = join(REPO_ROOT, "tools/test-custody-route.mjs");

const FACE_KEYS = join(REPO_ROOT, "packages/lararium-node/dist/src/face-key-custody.js");

/**
 * Stand face `handleIndex` at the staged vessel's own (primary) Nexus: mint its per-Nexus key under `root`, as an
 * act that presents the face there would. Answers the scope it stands at. Runs in a subprocess under the
 * vessel's env, inside the custody its staging founded.
 */
export function mintStagedNexusKey(root: string, handleIndex = 0): Promise<{ readonly nexus: string; readonly faceKey: string }> {
  const script =
    `import { FsCustodyIo, makeCustodyHolder, seatCustody, vesselCustodyHomes, primaryNexusAid, larSealHome } from ${JSON.stringify(NODE)};\n` +
    `import { mintNexusKey, nexusKeyPublicOf } from ${JSON.stringify(FACE_KEYS)};\n` +
    `import { TEST_PASSPHRASE } from ${JSON.stringify(ROUTE)};\n` +
    `const homes = vesselCustodyHomes();\n` +
    `const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });\n` +
    `const opened = await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);\n` +
    `if (opened.reading !== "opens") throw new Error("the staged custody reads " + opened.reading + " under the test route");\n` +
    `seatCustody(holder);\n` +
    `const nexus = primaryNexusAid(larSealHome());\n` +
    `if (!nexus) throw new Error("no primary charter stands under this root");\n` +
    `const seed = await mintNexusKey(${handleIndex}, nexus);\n` +
    `await holder.lock();\n` +
    `process.stdout.write("SCOPE " + nexus + " " + nexusKeyPublicOf(seed) + "\\n");\n`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, LAR_ROOT: root }, cwd: REPO_ROOT });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += String(d); });
    child.stderr.on("data", (d) => { err += String(d); });
    child.on("close", (code) => {
      const m = /^SCOPE (\S+) ([0-9a-f]{64})$/m.exec(out);
      if (code === 0 && m) resolve({ nexus: m[1]!, faceKey: m[2]! });
      else reject(new Error(`mintStagedNexusKey(${root}) failed (${code})\n${out}\n${err}`));
    });
  });
}
