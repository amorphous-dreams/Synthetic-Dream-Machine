// custody-census — read a root's custody the way a person does (`lares vault status --json`, the built CLI) and
// name what it holds against the carrier table's law (lar:///ha.ka.ba/lararium/mesh/custody#/the-table).
//
// `custodyReading` answers the command's own `custody` object: one reading of each standing file the table names,
// and every private file it does not name. `custodyBreaches` turns a reading into one line per breach:
//   · a serving, hot or cold row that reads anything but sealed (an outbox row reads its own seal, so its fault mark alone speaks);
//   · a file outside the vessel key that breaks its own row's law (a seal no rotation re-seals, a name its bytes fail);
//   · a row outside the vessel key that names no law for resting bare;
//   · a private file no row names (an owner-only file, a file under the vessel key's seal, a writer's sidecar).
// The status only reads, so this module opens no key and writes nothing. The custody census witness and the live
// door tests share it, so each founded scratch vessel a harness stands answers to the same reading.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");

/** The `custody` object `lares vault status --json` answers for `root`. `env` adds a standing vessel's own settings. */
export function custodyReading(root, env = {}) {
  const r = spawnSync(process.execPath, [cli, "vault", "status", "--json"], { cwd: repo, encoding: "utf8", env: { ...process.env, LAR_ROOT: root, ...env } });
  if (r.status !== 0) throw new Error(`lares vault status exited ${r.status}: ${r.stdout}${r.stderr}`);
  const answer = JSON.parse(r.stdout.trim().split("\n").pop());
  const custody = answer?.data?.custody;
  if (!custody || !Array.isArray(custody.rows) || !Array.isArray(custody.outside)) {
    throw new Error(`lares vault status answered no custody reading with rows and an outside list: ${r.stdout.slice(0, 400)}`);
  }
  return custody;
}

/** What a custody reading holds against the law: one line per breach, none when it stands clean. */
export function custodyBreaches(custody) {
  const out = [];
  for (const r of custody.rows) {
    // A face row rests under its own face custody key: sealed like a VK row, and it names no bare law.
    const underVk = r.custody === "serving" || r.custody === "hot" || r.custody === "cold" || r.custody === "face-hot" || r.custody === "face-cold";
    // An outbox parcel rests under the outbox key the vessel key wraps: under a key, yet framed by its own seal.
    const underKey = underVk || r.custody === "outbox";
    if (underVk && r.reading !== "sealed") out.push(`unsealed: ${r.home}/${r.file} (${r.custody}) reads ${r.reading}`);
    if (underKey !== (r.bare === null)) out.push(`no law: ${r.home}/${r.file} (${r.custody}) ${underKey ? "names a law for resting bare" : "rests outside the vessel key and names no law"}`);
    if (underVk && !r.fault && r.reading !== "sealed") out.push(`fault misread: ${r.home}/${r.file} (${r.custody}, ${r.reading}) reads fault=${r.fault}`);
    if (!underVk && r.fault) out.push(`fault: ${r.home}/${r.file} (${r.custody}) reads ${r.reading} and breaks its row's law`);
  }
  for (const o of custody.outside) out.push(`outside: ${o.home}/${o.file} (${o.why})`);
  return out;
}
