#!/usr/bin/env node
/**
 * browser-lamps — which browser tests run, which stand relit and unproven, and which stand dim; one account, counted off the tree.
 *
 * The operator dimmed every browser-run test on 2026-11-20 ("disable all browser tests for now, while we move quickly to
 * settle the road"). The Pono Browser (lar:///ha.ka.ba/kahua/memory/wave/pono-browser) replaces the browser hull plank by
 * plank, and a plank swapped under dim lamps proves nothing, so a thin lamp set relights against the hull that stands.
 *
 * THREE CLASSES, EVERY TEST FILE IN EXACTLY ONE:
 *   lit    the package's node project (`browser-node`, `web-node`): runs on every `pnpm test` and in CI.
 *   lamp   `BROWSER_LAMPS_LIT` below: a project of its own in the package's vitest config, which joins the run under
 *          `LAR_BROWSER_LAMPS=1`. The familiar's floor runs it; CI runs none until a floor run proves the set and ci.yml
 *          regains its engines and container (the account in `BROWSER_LAMPS_DIM`).
 *   dim    every other test file: in the tree, untouched, unrun.
 *
 * A LAMP CARRIES ITS PROOF. `relit-unproven`: wired, never yet run by the floor. `lit`: a floor run read it green. `red`: a
 * floor run read it red, and the lamp STAYS in the set with its finding in `note`; a red lamp reads as a finding and never
 * leaves the roster to hide.
 *
 *   node tools/browser-lamps.mjs            print the census
 *   node tools/browser-lamps.mjs --ticket   print the floor commands that run exactly the lamp set
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

export const LAMP_PROOFS = Object.freeze(["relit-unproven", "lit", "red"]);
/** The environment name that joins the lamp projects to a package's run. */
export const LAMPS_ENV = "LAR_BROWSER_LAMPS";

const unproven = (file) => Object.freeze({ file, proof: "relit-unproven" });
/** A lamp a floor run read green, with the run that read it. */
const lit = (file, note) => Object.freeze({ file, proof: "lit", note });
/** A lamp a floor run read red: it stays in the set, its finding in `note`. */
const red = (file, note) => Object.freeze({ file, proof: "red", note });

/**
 * THE LAMP SET. `project` names the lamp's own vitest project; `from` names the dark project whose settings it takes
 * (engines, timeouts, environment), so a lamp runs as its file ran before the dimming.
 */
export const BROWSER_LAMPS_LIT = Object.freeze([
  {
    pkg: "@lararium/web", dir: "packages/lararium-web", project: "lamp-vessel-host", from: "vessel-host",
    holds: "the vessel worker's host over a real engine: sessions, faces, the follower's brokered port, the console door, the place card, the reset gate",
    files: [
      lit("tests/vessel-host-console.test.ts", "floor run 2026-11-27 (#00001, adc8802dd + develop): lamp-vessel-host 72 passed / 4 skipped over 12 files"),
      lit("tests/vessel-host-faces.test.ts", "floor run 2026-11-27 (#00001, adc8802dd + develop): lamp-vessel-host 72 passed / 4 skipped over 12 files"),
      lit("tests/vessel-host-follower.test.ts", "floor run 2026-11-27 (#00001, adc8802dd + develop): lamp-vessel-host 72 passed / 4 skipped over 12 files"),
      lit("tests/vessel-host-place-card.test.ts", "floor run 2026-11-27 (#00001, adc8802dd + develop): lamp-vessel-host 72 passed / 4 skipped over 12 files"),
      lit("tests/vessel-host-reset-gate.test.ts", "floor run 2026-11-27 (#00001, adc8802dd + develop): lamp-vessel-host 72 passed / 4 skipped over 12 files"),
      lit("tests/vessel-host-surface.test.ts", "floor run 2026-11-27 (#00001, adc8802dd + develop): lamp-vessel-host 72 passed / 4 skipped over 12 files"),
      lit("tests/vessel-host-protocol.test.ts", "floor run 2026-11-27 (#00001, 103dd6daf + develop): lamp-vessel-host 78 passed / 4 skipped over 14 files"),
    ],
  },
  {
    pkg: "@lararium/web", dir: "packages/lararium-web", project: "lamp-vessel-e2e", from: "shore-writes-e2e",
    holds: "the second boot reads what the first wrote; the vessel runs on its own worker",
    files: [unproven("tests/e2e/shore-writes.e2e.test.ts"), lit("tests/e2e/second-boot.e2e.test.ts", "floor run 2026-11-27 (#00001, adc8802dd + develop): lamp-vessel-e2e 2/2"), lit("tests/e2e/vessel-worker.e2e.test.ts", "floor run 2026-11-27 (#00001, adc8802dd + develop): lamp-vessel-e2e 2/2")],
  },
  {
    pkg: "@lararium/web", dir: "packages/lararium-web", project: "lamp-ceremony-e2e", from: "ceremony-e2e",
    holds: "a founding, an unlock and one ward act through the ceremony document",
    files: [red("tests/e2e/ceremony.e2e.test.ts", "floor run 2026-11-27 (#00001, adc8802dd + develop): K3 waits 90 s for the page's load event and times out; the page never loads, likely behind the vessel's ~3-minute boot (the control and daemon slot loads, seal-manifest-diet)")],
  },
  {
    pkg: "@lararium/web", dir: "packages/lararium-web", project: "lamp-hearth-e2e", from: "golden-whole-road-e2e",
    holds: "two tabs, one house; a mirror boot that asks the network nothing",
    files: [lit("tests/e2e/glass-tabs.e2e.test.ts", "floor run 2026-11-27 (#00001, 103dd6daf + develop): lamp-hearth-e2e 3/3"), lit("tests/e2e/mirror-boot-makes-no-request.e2e.test.ts", "floor run 2026-11-27 (#00001, 103dd6daf + develop): lamp-hearth-e2e 3/3"), unproven("tests/e2e/golden-whole-road.e2e.test.ts"), unproven("tests/e2e/rest-before-reload.e2e.test.ts"), unproven("tests/e2e/glass-mirror.e2e.test.ts")],
  },
  {
    pkg: "@lararium/web", dir: "packages/lararium-web", project: "lamp-web-browser", from: "web-browser",
    holds: "the glass's page and projection tests in real engines: mirror boots, projection sinks, the ceremony page, the doors, the interaction goldens",
    files: [
      unproven("tests/phone-seat.test.ts"),
      unproven("tests/pane-label.page.test.ts"),
      unproven("tests/wiki-coherence-indicator.test.ts"),
      unproven("tests/live-status.test.ts"),
      unproven("tests/ceremony-page.test.ts"),
      unproven("tests/critical-gate.test.ts"),
      unproven("tests/fleet-root-door.page.test.ts"),
      unproven("tests/projection-morph.test.ts"),
      unproven("tests/projection-sink-cancel.test.ts"),
      unproven("tests/projection-sink-controls.test.ts"),
      unproven("tests/projection-sink-keyed.test.ts"),
      unproven("tests/projection-sink-offers.test.ts"),
      unproven("tests/projection-sink-services.test.ts"),
      unproven("tests/projection-sink-toggles.test.ts"),
      unproven("tests/projection-sink-unload-hold.test.ts"),
      unproven("tests/projection-sink-resend.test.ts"),
      unproven("tests/projection-sink.test.ts"),
      unproven("tests/engine-probes.page.test.ts"),
      unproven("tests/mirror-browser-mode.page.test.ts"),
      unproven("tests/mirror-plugin-gate.page.test.ts"),
      unproven("tests/mirror-savers.page.test.ts"),
      unproven("tests/glass-mirror.page.test.ts"),
      unproven("tests/glass-page-mirror.page.test.ts"),
      unproven("tests/glass-full-first.page.test.ts"),
      unproven("tests/glass-held-search.page.test.ts"),
      unproven("tests/glass-stepdown.page.test.ts"),
      unproven("tests/glass-theme.page.test.ts"),
      unproven("tests/glass-console-readings.page.test.ts"),
      unproven("tests/glass-boot.page.test.ts"),
      unproven("tests/glass-doors.page.test.ts"),
      unproven("tests/glass-walk.page.test.ts"),
      unproven("tests/interaction-goldens.page.test.ts"),
      unproven("tests/interaction-goldens-offers.page.test.ts"),
      unproven("tests/reset-ceremony.test.ts"),
    ],
  },
  {
    pkg: "@lararium/web", dir: "packages/lararium-web", project: "lamp-daemon-island-reopen-e2e", from: "daemon-island-reopen-e2e",
    holds: "the browser vessel re-opens its daemon island in process over a walk build",
    files: [unproven("tests/e2e/daemon-island-reopen.e2e.test.ts")],
  },
]);

/** The lamps of one package directory, as its vitest config reads them. */
export const lampsOf = (dir) => BROWSER_LAMPS_LIT.filter((lamp) => lamp.dir === dir);

/**
 * WHAT WENT DARK, AND HOW IT RELIGHTS. Each package's config keeps its dark projects exported and out of `projects`; the
 * census below counts the files, so no count rests here to go stale.
 */
export const BROWSER_LAMPS_DIM = Object.freeze({
  ruling: "operator, 2026-11-20: \"disable all browser tests for now, while we move quickly to settle the road\"",
  packages: Object.freeze([
    { pkg: "@lararium/browser", dir: "packages/lararium-browser", config: "vitest.config.ts", litProject: "browser-node", darkProjects: ["chromium", "firefox"] },
    {
      pkg: "@lararium/web", dir: "packages/lararium-web", config: "vitest.config.ts", litProject: "web-node",
      darkProjects: ["web-browser", "vessel-host", "shore-writes-e2e", "daemon-island-reopen-e2e", "ceremony-e2e", "golden-whole-road-e2e"],
    },
  ]),
  alsoDark: Object.freeze([
    "packages/lararium-web/vitest.crossing.config.ts (the floor crossing: its three e2e files and its ci.yml step)",
    "@lararium/tw5: the filter-cts-chromium, standalone-single-file and syncer-back-parity e2e files",
    ".github/workflows/ci.yml: the Chromium pull, and the `engines` and `container` of the web-tw5 and cli-mesh matrix rows",
    "tools/held-out-cells.mjs: the browser-weld driver",
  ]),
  relight: Object.freeze([
    "one lamp: add its file to a lamp of BROWSER_LAMPS_LIT (a new lamp names the dark project it takes its settings from); the floor runs it under LAR_BROWSER_LAMPS=1",
    "a whole package: add its exported `browserProjects` back into `projects` in its vitest config",
    "CI: restore the `engines` and `container` of the two matrix rows and the dropped quick-job steps in ci.yml, and the browser-weld driver in held-out-cells.mjs",
  ]),
});

// ── the census ───────────────────────────────────────────────────────────────────────────────────

const walk = (dir, under = "") => readdirSync(join(dir, under), { withFileTypes: true }).flatMap((entry) => {
  const path = under ? `${under}/${entry.name}` : entry.name;
  if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(dir, path);
  return entry.name.endsWith(".test.ts") ? [path] : [];
});

/** The files a config's node project includes: the quoted paths of the `include` list that follows the project's name. */
export function litFilesOf(configText, project) {
  const at = configText.indexOf(`name: "${project}"`);
  if (at < 0) throw new Error(`browser-lamps: the config names no project "${project}"`);
  const list = /include:\s*\[([\s\S]*?)\]/.exec(configText.slice(at));
  if (!list) throw new Error(`browser-lamps: project "${project}" carries no include list`);
  return [...list[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Count one package: every `*.test.ts` under its `tests/`, each in exactly one class. `problems` names every break of the
 * account (a listed file the tree lacks, a file in two classes, a lamp with an unknown proof, a dark project the config lacks).
 */
export function censusOf({ files, lit, lamps, configText, darkProjects = [] }) {
  const problems = [];
  const tree = new Set(files);
  const litSet = new Set(lit);
  const lampFiles = lamps.flatMap((lamp) => lamp.files.map((f) => ({ ...f, project: lamp.project })));
  for (const f of lit) if (!tree.has(f)) problems.push(`the lit list names ${f}, which the tree lacks`);
  if (litSet.size !== lit.length) problems.push("the lit list names a file twice");
  const seen = new Set();
  for (const f of lampFiles) {
    if (!tree.has(f.file)) problems.push(`lamp ${f.project} names ${f.file}, which the tree lacks`);
    if (litSet.has(f.file)) problems.push(`${f.file} stands both lit and in lamp ${f.project}`);
    if (seen.has(f.file)) problems.push(`${f.file} stands in two lamps`);
    seen.add(f.file);
    if (!LAMP_PROOFS.includes(f.proof)) problems.push(`${f.file} carries no known proof (${String(f.proof)})`);
  }
  for (const lamp of lamps) {
    if (!configText.includes(`name: "${lamp.from}"`)) problems.push(`lamp ${lamp.project} takes its settings from "${lamp.from}", which the config lacks`);
  }
  for (const name of darkProjects) if (!configText.includes(`name: "${name}"`)) problems.push(`the dim account names project "${name}", which the config lacks`);
  const dim = files.filter((f) => !litSet.has(f) && !seen.has(f));
  const byProof = Object.fromEntries(LAMP_PROOFS.map((p) => [p, lampFiles.filter((f) => f.proof === p).length]));
  return { total: files.length, lit: lit.length, lamp: lampFiles.length, dim: dim.length, byProof, dimFiles: dim, problems };
}

/** The census of the real tree, one row per package of the dim account. */
export function census(root = REPO_ROOT) {
  return BROWSER_LAMPS_DIM.packages.map((p) => {
    const configText = readFileSync(join(root, p.dir, p.config), "utf8");
    const files = existsSync(join(root, p.dir, "tests")) ? walk(join(root, p.dir), "tests") : [];
    return { pkg: p.pkg, ...censusOf({ files, lit: litFilesOf(configText, p.litProject), lamps: lampsOf(p.dir), configText, darkProjects: p.darkProjects }) };
  });
}

/** The floor commands that run exactly the lamp set, one per package. */
export function ticketLines() {
  const dirs = [...new Set(BROWSER_LAMPS_LIT.map((lamp) => lamp.dir))];
  return dirs.map((dir) => `(cd ${dir} && ${LAMPS_ENV}=1 pnpm exec vitest run ${lampsOf(dir).map((lamp) => `--project ${lamp.project}`).join(" ")})`);
}

if (process.argv[1] && basename(process.argv[1]) === "browser-lamps.mjs") {
  if (process.argv.includes("--ticket")) { for (const line of ticketLines()) console.log(line); }
  else {
    let broken = 0;
    for (const row of census()) {
      console.log(`${row.pkg}: ${row.total} test files · lit ${row.lit} · lamp ${row.lamp} (${LAMP_PROOFS.map((p) => `${p} ${row.byProof[p]}`).join(", ")}) · dim ${row.dim}`);
      for (const problem of row.problems) { console.error(`browser-lamps: ${row.pkg}: ${problem}`); broken += 1; }
    }
    if (broken > 0) process.exit(1);
  }
}
