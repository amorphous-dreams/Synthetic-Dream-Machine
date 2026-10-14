// custody-census-witness — the body of `tools/custody-census-witness.sh`: found a vessel on a marked scratch root
// with the BUILT tree, stand it, unlock it, and hold `lares vault status` to the carrier table.
//
// THE LAW IT HOLDS (lar:///ha.ka.ba/lararium/mesh/custody#/the-table). Every private file a vessel keeps at rest
// answers to one row of the carrier table. `vault status` derives its whole reading from that table, so this
// witness reads the command's own answer and refuses a vessel that holds:
//   · a hot or cold row that reads anything but sealed (a fault);
//   · a row outside the vessel key that names no law for resting bare;
//   · a private file no row names: an owner-only file, a file under the vessel key's seal, a writer's sidecar.
//
// EVERY ZERO HERE CARRIES A KNOWN POSITIVE. The clean reading runs first as the CONTROL; then the witness plants
// each kind of stray, reads it named, removes it, and reads clean again. A reading that names nothing only counts
// beside a reading, from the same instrument, that named something.
//
// THE ROTATION RIDES THE SAME TABLE. With a sealed file no row names standing in the storage home, an unbind that
// rotates refuses by name and leaves both slots bound; with the stray gone the same act completes, the removed
// route opens nothing, and the vessel stands again and unlocks under the route that stayed.
//
// Usage: node tools/custody-census-witness.mjs      (exit 0 = every step held; 1 = a step failed, named on stdout)
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { custodyBreaches, custodyReading } from "./custody-census.mjs";
import { bindTestCustody, routesOfTestCustody, unbindTestCustody } from "./unbind-test-custody.mjs";
import { unlockTestCustody } from "./unlock-test-custody.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");
const nodeMain = join(repo, "packages/lararium-node/dist/src/main.js");

let failed = 0;
const step = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : `\n         ${detail}`}`);
  if (!ok) failed++;
};

const freePort = () => new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

function lares(root, args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
}

/** Stand the built daemon on `root`; resolves once it reads live. */
async function stand(root) {
  const port = await freePort();
  const env = { ...process.env, LAR_ROOT: root, LAR_PORT: String(port), LAR_SAME_ORIGIN: "true" };
  const child = spawn(process.execPath, [nodeMain, "--root", root, "--port", String(port)], { cwd: join(repo, "packages/lararium-node"), env });
  let log = "";
  child.stdout.on("data", (d) => { log += String(d); });
  child.stderr.on("data", (d) => { log += String(d); });
  await new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      if (/phase → live/.test(log)) { clearInterval(poll); resolve(); }
      else if (child.exitCode !== null) { clearInterval(poll); reject(new Error(`daemon exited ${child.exitCode} before live:\n${log.slice(-3000)}`)); }
    }, 200);
  });
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
  return { stop, env: { LAR_PORT: String(port), LAR_SAME_ORIGIN: "true" } };
}

const census = custodyReading;
const breaches = custodyBreaches;

const root = mkdtempSync(join(tmpdir(), "lares-custody-census-"));
let vessel = null;
try {
  for (const script of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    const r = spawnSync(process.execPath, [join(repo, "tools", script), root], { encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
    if (r.status !== 0) throw new Error(`${script}: ${r.stderr}`);
  }
  cpSync(join(repo, "genesis"), join(root, "genesis"), { recursive: true });
  for (const args of [["vessel", "found", "--root", root, "--skip-build"], ["persona", "new", "0", "--name", "the census keeper"]]) {
    const r = lares(root, args);
    if (r.status !== 0) throw new Error(`lares ${args.join(" ")}: ${r.stdout}${r.stderr}`);
  }
  const identity = join(root, "data/lares/identity");
  const storage = join(root, "data/lares/vessel");

  // ── the vessel stands, a person unlocks it: every row the unlock seeds rests on disk ──────────────────────
  vessel = await stand(root);
  const unlocked = await unlockTestCustody(root);
  step("the founded vessel stands and unlocks", unlocked?.reading === "opens" && unlocked?.held === true, JSON.stringify(unlocked));
  const standing = census(root, vessel.env);
  step("CONTROL: the standing, unlocked vessel reads no fault and no private file outside the table", breaches(standing).length === 0, breaches(standing).join("; "));
  await vessel.stop();
  vessel = null;

  // ── CONTROL: the clean reading, and proof that it reads rows of both kinds ────────────────────────────────
  const clean = census(root);
  step("CONTROL: the stopped vessel reads no fault and no private file outside the table", breaches(clean).length === 0, breaches(clean).join("; "));
  const sealed = clean.rows.filter((r) => r.reading === "sealed");
  const byLaw = clean.rows.filter((r) => r.bare !== null);
  step("the reading holds rows under the vessel key and rows outside it by law", sealed.length >= 8 && byLaw.length >= 4 && sealed.length + byLaw.length === clean.rows.length,
    `${sealed.length} sealed, ${byLaw.length} by law, ${clean.rows.length} rows`);
  step("each bare row names its law: the vessel key, its log, the slot tree, the serving tree, the contact card",
    ["vessel-key", "vessel-kel", "vk-slots", "sk-slots", "vessel-card"].every((row) => byLaw.some((r) => r.row === row && r.reading === "bare")),
    byLaw.map((r) => r.row).join(", "));

  // ── RED: an owner-only file no row names ──────────────────────────────────────────────────────────────────
  const sideKey = join(identity, "side-key.json");
  writeFileSync(sideKey, "{}", { mode: 0o600 });
  let got = breaches(census(root));
  step("RED: an owner-only file no row names reads outside the table", got.length === 1 && got[0] === "outside: identity/side-key.json (owner-only)", got.join("; "));
  rmSync(sideKey);

  // ── RED: an orphan sidecar ────────────────────────────────────────────────────────────────────────────────
  const sidecar = join(identity, "custody-root.bin.vk-sealing");
  copyFileSync(join(identity, "custody-root.bin"), sidecar);
  got = breaches(census(root));
  step("RED: an orphan sidecar reads outside the table", got.length === 1 && got[0] === "outside: identity/custody-root.bin.vk-sealing (sidecar)", got.join("; "));
  rmSync(sidecar);

  // ── RED: a file spelled like a plain row answers to that row's law ────────────────────────────────────────
  const restStray = join(storage, "sealed", "lockbox", "aa.bb.00000000000000000000000000000000");
  mkdirSync(join(storage, "sealed", "lockbox"), { recursive: true });
  writeFileSync(restStray, "a private key a hand dropped under a rest's spelling", { mode: 0o600 });
  got = breaches(census(root));
  step("RED: a file under a rest row's spelling that fails its own name reads as a fault", got.length === 1 && got[0].startsWith("fault: storage/sealed/lockbox/aa.bb."), got.join("; "));
  rmSync(restStray);
  const sealedPlain = join(root, "data/lares/nexus/nexus/carriage-consent/planted.json");
  mkdirSync(join(root, "data/lares/nexus/nexus/carriage-consent"), { recursive: true });
  copyFileSync(join(identity, "custody-root.bin"), sealedPlain);
  got = breaches(census(root));
  step("RED: a sealed file at a plain row's path reads as a fault", got.length === 1 && got[0] === "fault: seal/nexus/carriage-consent/planted.json (floor-plain) reads sealed and breaks its row's law", got.join("; "));
  rmSync(sealedPlain);

  // ── RED: a file under the vessel key's seal that no row names, and the rotation it refuses ────────────────
  const stray = join(storage, "stray.bin");
  copyFileSync(join(identity, "custody-root.bin"), stray);
  chmodSync(stray, 0o644);
  got = breaches(census(root));
  step("RED: a sealed file no row names reads outside the table", got.length === 1 && got[0] === "outside: storage/stray.bin (vk-seal)", got.join("; "));
  const bound = await bindTestCustody(root);
  step("a second route binds", bound.ok === true && bound.slots === 2, JSON.stringify(bound));
  const refusedRotation = await unbindTestCustody(root, { slotId: bound.slotId, rotate: true });
  step("RED: the unlisted sealed file refuses the rotation by name", refusedRotation.ok === false && refusedRotation.reason === "CensusRefusal", JSON.stringify(refusedRotation));
  let routes = await routesOfTestCustody(root);
  step("the refused rotation left both slots bound, and both routes open", routes.slots.length === 2 && routes.first === "opens" && routes.second === "opens", JSON.stringify(routes));
  rmSync(stray);

  // ── CONTROL: with the stray gone the same act completes, on the founded vessel ────────────────────────────
  step("CONTROL: the planted files left, and the reading stands clean again", breaches(census(root)).length === 0, breaches(census(root)).join("; "));
  const rotated = await unbindTestCustody(root, { slotId: bound.slotId, rotate: true });
  step("an unbind that rotates completes as one act", rotated.ok === true && rotated.rotated === true && rotated.slots.length === 1, JSON.stringify(rotated));
  routes = await routesOfTestCustody(root);
  step("the removed route opens nothing and the staying route opens", routes.first === "opens" && routes.second === "no-slot-opens" && routes.slots.length === 1, JSON.stringify(routes));
  const after = census(root);
  step("every row rests sealed under the new vessel key, and nothing stands outside the table", breaches(after).length === 0 && after.rows.length === clean.rows.length, breaches(after).join("; "));
  vessel = await stand(root);
  const again = await unlockTestCustody(root);
  step("the rotated vessel stands again and unlocks under the route that stayed", again?.reading === "opens" && again?.held === true && again?.standing === unlocked?.standing, JSON.stringify(again));
  await vessel.stop();
  vessel = null;
} catch (err) {
  step("the witness ran to its end", false, String(err?.stack ?? err));
} finally {
  await vessel?.stop();
  rmSync(root, { recursive: true, force: true });
}
console.log(failed === 0 ? "custody-census-witness: every step held" : `custody-census-witness: ${failed} step(s) FAILED`);
process.exit(failed === 0 ? 0 : 1);
