// floor-unlock-door — the floor STANDS and the unlock mounts the marker's wiki, driven live through the built `lares` CLI
// over a scratch root a harness staged (stable-founding-road#/cold-start: every boot rests at the floor).
//
// A founded vessel's daemon active-wiki marker names a user wiki (the operator's last `lares wiki open`). A fresh boot
// holds no key, so the process composes at the floor and lives; `lares vault unlock` hands the key in on the custody
// door, and the composition that opens mounts the marker's wiki.
//
//   F0  the unlocked vessel takes `lares wiki init` + `lares wiki open`: the marker names the user wiki for the next boot.
//   F1  a fresh `lares vessel stand` stands the floor: the process lives, the custody door reads the key not held, and
//       the marker's wiki stands unmounted (`lares wiki active` names it not).
//   F2  `lares vault unlock` (the harness's test route, tools/unlock-test-custody.mjs) opens the key, the composition
//       stands as the hearth, `lares wiki active` names the marker's wiki, and the custody door names none waiting.
//   F1w TODO (an open operator call): the process floor composes as the HERM (`standAs`: a hearth whose archive opens
//       not stands at the floor, and the floor composes wiki-less), so `lares vault status` names no waiting wiki; the
//       in-process floor-wiki naming (tests/e2e/floor-user-wiki-refuses W2) runs only where a caller composes a
//       Lararium at the floor. Measured 2026-11-06: the door reads `standing: "herm"`, `wikiAwaits: null`.
//
// Run under bwrap with a scratch HOME and LAR_ROOT, LAR_BAGS unset: it stands real daemons.
import "./test-ward-env.mjs";   // the CLI processes this test spawns take the harness's explicit routes
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { unlockTestCustody } from "./unlock-test-custody.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");
const WIKI = "floor-witness";

const freePort = () => new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

test("the floor stands over the marker's user wiki and lives; the unlock mounts it", { timeout: 1_200_000 }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), "lares-floor-unlock-"));
  const port = await freePort();
  const env = { ...process.env, LAR_ROOT: root, LAR_PORT: String(port), LAR_SAME_ORIGIN: "true" };
  delete env.LAR_BAGS;
  const lares = (...args) => {
    const r = spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8", env, timeout: 300_000 });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const ok = (...args) => { const r = lares(...args); assert.equal(r.status, 0, `lares ${args.join(" ")}:\n${r.out}`); return r.out; };
  /** `lares vessel stand`: the daemon stands detached, and the report reads it up (a boot fault reads down). */
  const json = (out) => JSON.parse(out.slice(out.indexOf("{")));
  const stand = () => { const out = ok("vessel", "stand", "--port", String(port), "--skip-build", "--json"); assert.equal(json(out).data?.node?.up, true, `the daemon stands:\n${out}`); };
  /** What the standing vessel's custody door reads, through `lares vault status`. */
  const door = () => json(ok("vault", "status", "--json")).data?.door ?? null;
  try {
    for (const script of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
      const r = spawnSync(process.execPath, [join(repo, "tools", script), root], { encoding: "utf8", env });
      assert.equal(r.status, 0, `${script}: ${r.stderr}`);
    }
    cpSync(join(repo, "genesis"), join(root, "genesis"), { recursive: true });
    ok("vessel", "found", "--hearth", "--name", "floor witness", "--root", root, "--skip-build");

    // F0: the unlocked vessel takes `wiki open`, and the marker names the user wiki for the next boot.
    stand();
    const first = await unlockTestCustody(root);
    assert.equal(first?.reading, "opens", JSON.stringify(first));
    ok("wiki", "init", WIKI);
    ok("wiki", "open", WIKI);
    ok("vessel", "stop", "--port", String(port));

    // F1: a fresh boot holds no key, so it stands at the floor, and the process lives.
    stand();
    const atFloor = door();
    assert.equal(atFloor?.unlocked, false, `the vessel stands at the floor: ${JSON.stringify(atFloor)}`);
    assert.doesNotMatch(lares("wiki", "active").out, new RegExp(WIKI), "the floor mounts not the marker's wiki");
    await t.test("F1w the floor names the waiting wiki", { todo: "operator call: the process floor stands as the herm, wiki-less" }, () => {
      assert.match(String(atFloor?.wikiAwaits), new RegExp(`${WIKI}.*awaits your face.*lares vault unlock`), JSON.stringify(atFloor));
    });

    // F2: the unlock's composition mounts it.
    const opened = await unlockTestCustody(root);
    assert.equal(opened?.reading, "opens", JSON.stringify(opened));
    assert.equal(opened?.held, true, `the sovereign composition stood: ${JSON.stringify(opened)}`);
    assert.equal(opened?.standing, "hearth", JSON.stringify(opened));
    const active = ok("wiki", "active");
    assert.match(active, new RegExp(WIKI), `the unlock mounts the waiting wiki:\n${active}`);
    const after = door();
    assert.equal(after?.unlocked, true, JSON.stringify(after));
    assert.ok(after?.wikiAwaits == null, `nothing waits once the face stands: ${JSON.stringify(after)}`);
  } finally {
    lares("vessel", "stop", "--port", String(port));
    rmSync(root, { recursive: true, force: true });
  }
});
