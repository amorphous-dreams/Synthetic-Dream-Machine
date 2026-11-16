#!/usr/bin/env node
/**
 * battery-legs — the heavy local battery as named legs, run through the one battery lock (tools/battery.sh,
 * mixed-model-swarm#/the-battery) in the checkout this tool stands in.
 *
 *   node tools/battery-legs.mjs [--legs a,b,c] [--out <dir>]     run the chosen legs (all of them by default)
 *   node tools/battery-legs.mjs --list                           print each leg and its command; no lock
 *
 * The run re-enters itself through `tools/battery.sh`, so no leg runs unlocked (an unopenable lock exits 64 and runs
 * nothing). Legs run in the table's order whatever order `--legs` names them, and every chosen leg runs past a red one.
 * Each prints `== <leg>`, `rc=<code>` and up to three tally lines off its tail; its whole output lands in
 * `<out>/<leg>.out` (`--out` defaults to a fresh dir under the passwd home's `.lares-scratch`). Every leg runs with
 * LAR_BAGS unset and LAR_ROOT at `<out>/lar-root`, so no leg writes the tracked tree's bags or the operator's house.
 *
 * Exit: 0 every leg green · 1 a leg red (named) · 2 usage or an unknown leg · 64 the lock refused.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = fileURLToPath(import.meta.url);

export const LEGS = [
  { name: "build", cmd: "bash", args: ["-c", "pnpm -r build && node tools/stamp-build.mjs ."] },
  { name: "mesh", cmd: "pnpm", args: ["--filter", "@lararium/mesh", "test"] },
  { name: "node", cmd: "pnpm", args: ["--filter", "@lararium/node", "test"] },
  { name: "browser", cmd: "pnpm", args: ["--filter", "@lararium/browser", "test"] },
  { name: "cli", cmd: "pnpm", args: ["--filter", "@lares/cli", "test"] },
  { name: "shims", cmd: "node", args: ["--test", "tools/lares-container.test.mjs", "tools/container-founding-seat.test.mjs", "tools/rite-walk.test.mjs"] },
  { name: "typecheck", cmd: "pnpm", args: ["-r", "typecheck"] },
  { name: "bcc", cmd: "bash", args: ["tools/bcc-witness.sh"] },
  { name: "evergreen", cmd: "bash", args: ["tools/evergreen-boundary-witness.sh"] },
  { name: "parity", cmd: "bash", args: ["tools/surface-parity-witness.sh"] },
  { name: "vparity", cmd: "bash", args: ["tools/vessel-parity-witness.sh"] },
  { name: "domains", cmd: "bash", args: ["tools/domain-registry-witness.sh"] },
  { name: "genesis", cmd: "bash", args: ["tools/genesis-parity-witness.sh"] },
];

/** The legs `spec` (a comma list, or nothing for all) names, in the table's order, and any name the table lacks. */
export function selectLegs(spec) {
  if (!spec) return { legs: LEGS, unknown: [] };
  const names = spec.split(",").map((s) => s.trim()).filter(Boolean);
  return { legs: LEGS.filter((l) => names.includes(l.name)), unknown: names.filter((n) => !LEGS.some((l) => l.name === n)) };
}

/** Up to three tally lines off the last six lines of a leg's output, colour codes stripped. */
export function countsOf(text) {
  // eslint-disable-next-line no-control-regex
  const lines = String(text).replace(/\u001b\[[0-9;]*m/g, "").split("\n").filter((l) => l.trim());
  return lines.slice(-6).filter((l) => /tests |pass |fail |ok /i.test(l)).slice(0, 3);
}

/** A leg's environment: LAR_BAGS unset, LAR_ROOT a scratch root under the run's out dir. */
export function legEnv(env, out) {
  const { LAR_BAGS: _bags, ...rest } = env;
  return { ...rest, LAR_ROOT: join(out, "lar-root") };
}

/** Runs each leg through `run(leg) -> {status, output}` and reports; answers the red legs. */
export function runLegs(legs, run, say = console.log) {
  const red = [];
  for (const leg of legs) {
    say(`== ${leg.name}`);
    const { status, output } = run(leg);
    say(`rc=${status}`);
    for (const line of countsOf(output)) say(line);
    if (status !== 0) red.push(`${leg.name} (rc=${status})`);
  }
  say(`battery-legs: ${legs.length - red.length} green · ${red.length} red${red.length ? `: ${red.join(", ")}` : ""}`);
  return { red };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  const take = (flag) => { const i = argv.indexOf(flag); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, 2); return v; };
  if (argv.includes("--list")) { for (const l of LEGS) console.log(`${l.name}\t${[l.cmd, ...l.args].join(" ")}`); process.exit(0); }
  const raw = [...argv];
  const spec = take("--legs"), outArg = take("--out");
  if (argv.length) { console.error("usage: battery-legs.mjs [--legs a,b,c] [--out <dir>] | --list"); process.exit(2); }
  const { legs, unknown } = selectLegs(spec);
  if (unknown.length) { console.error(`battery-legs: unknown leg: ${unknown.join(", ")} (legs: ${LEGS.map((l) => l.name).join(",")})`); process.exit(2); }
  if (!legs.length) { console.error("battery-legs: no leg chosen"); process.exit(2); }
  if (process.env.LARES_BATTERY_LEGS_HELD !== "1") {
    // Re-enter through the one lock; battery.sh passes the held run's exit code through, or refuses with 64.
    const r = spawnSync("bash", [join(ROOT, "tools/battery.sh"), process.execPath, SELF, ...raw], { stdio: "inherit", env: { ...process.env, LARES_BATTERY_LEGS_HELD: "1" } });
    process.exit(r.status ?? 1);
  }
  let out;
  if (outArg) { out = resolve(outArg); mkdirSync(out, { recursive: true }); }
  else { const base = join(userInfo().homedir, ".lares-scratch"); mkdirSync(base, { recursive: true }); out = mkdtempSync(join(base, "battery-legs-")); }
  console.log(`battery-legs: outputs under ${out}`);
  mkdirSync(join(out, "lar-root"), { recursive: true });
  const env = legEnv(process.env, out);
  const { red } = runLegs(legs, (leg) => {
    // One fd for both streams keeps the leg's own order, so its tally stays at the tail.
    const file = join(out, `${leg.name}.out`), fd = openSync(file, "w");
    const r = spawnSync(leg.cmd, leg.args, { cwd: ROOT, env, stdio: ["ignore", fd, fd] });
    closeSync(fd);
    if (r.error) appendFileSync(file, `\n${r.error.message}\n`);
    return { status: r.status ?? 1, output: readFileSync(file, "utf8") };
  });
  process.exit(red.length ? 1 : 0);
}
