// keep-cold — THE KEEP WAKES COLD WIKIS (K1), over one real house: a page put into a wiki no island mounts rests in its layer
// and projects nowhere, so a keep that cut disk alone left it behind under `cold-wikis`.
//
//   W1  a scratch house mints four user wikis (each mint holds within the pin budget, the fourth names it full), restarts
//       so no hold outlives the daemon, then the steward holds `bravo` and puts one page into each. The other three stand
//       cold, so their pages reach no mirror. A keep lei strung, `rite keep-cut` holds each cold wiki in turn before it cuts:
//       every page rests in the staged tree as a `wiki-working` row, the manifest names none of the woken wikis cold, and the
//       held set reads as it stood before the cut (`bravo` alone).
//
// The house stands under its own marked scratch LAR_ROOT through the test custody doors; no LAR_BAGS, no docker.
import "./test-ward-env.mjs";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { unlockTestCustody } from "./unlock-test-custody.mjs";
import { daemonStood } from "./daemon-stood.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");
const nodeMain = join(repo, "packages/lararium-node/dist/src/main.js");
const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
async function standHouse(tag, name) {
  const root = mkdtempSync(join(tmpdir(), `lares-keep-cold-${tag}-`));
  for (const script of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    const r = spawnSync(process.execPath, [join(repo, "tools", script), root], { encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
    assert.equal(r.status, 0, `${script}: ${r.stderr}`);
  }
  cpSync(join(repo, "genesis"), join(root, "genesis"), { recursive: true });
  const port = await freePort();
  const env = { ...process.env, LAR_ROOT: root, LAR_PORT: String(port), LAR_SAME_ORIGIN: "true" };
  const lares = (args) => spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8", env });
  const found = lares(["vessel", "found", "--hearth", "--name", name, "--root", root, "--skip-build"]);
  assert.equal(found.status, 0, `found ${tag}: ${found.stdout}${found.stderr}`);
  // The daemon stands, then the custody opens; a restart walks both again (rotatable holds live in the daemon alone).
  let child;
  const boot = async () => {
    child = spawn(process.execPath, [nodeMain, "--root", root, "--port", String(port)], { cwd: join(repo, "packages/lararium-node"), env });
    let log = "";
    child.stdout.on("data", (d) => { log += String(d); }); child.stderr.on("data", (d) => { log += String(d); });
    const c = child;
    await new Promise((resolve, reject) => { const poll = setInterval(() => { if (daemonStood(log)) { clearInterval(poll); resolve(); } else if (c.exitCode !== null) { clearInterval(poll); reject(new Error(log.slice(-3000))); } }, 200); });
    const a = await unlockTestCustody(root, "unlock", 0);
    assert.ok(a?.held === true || a?.reading === "opens" || a?.reading === "already-unlocked", JSON.stringify(a));
  };
  await boot();
  const stop = () => new Promise((resolve) => { if (child.exitCode !== null) return resolve(); child.once("exit", () => resolve()); child.kill("SIGTERM"); });
  const restart = async () => { await stop(); await boot(); };
  const must = (args) => { const r = lares(args); assert.equal(r.status, 0, `lares ${args.join(" ")}\n${r.stdout}\n${r.stderr}`); return r; };
  const answer = (r) => JSON.parse(r.stdout.trim().split("\n").pop());
  return { root, port, lares, must, answer, stop, restart };
}
const memeText = (uri, body) => { const path = uri.slice("lar:///".length); return `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${path}"\n\`\`\`\n\n! ${path.split("/").pop()}\n\n${body}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`; };

const SLUGS = ["alpha", "bravo", "charlie", "delta"];
const pageUri = (slug) => `lar:///ha.ka.ba/notes/page/${slug}-one`;

test("W1 the keep wakes each cold wiki before it cuts, so a page put into a cold wiki rests in the staged tree, and the pins come back", { timeout: 900_000 }, async () => {
  const scratch = mkdtempSync(join(tmpdir(), "lares-keep-cold-files-"));
  const h = await standHouse("w1", "steward");
  try {
    // A mint holds the wiki it mints within the pin budget (three on node), so alpha, bravo and charlie stand held and
    // live and delta names the full budget. The holds live in the daemon alone: a restart lets every wiki go cold, and the
    // steward holds `bravo` alone, so the other three stand cold as the keep meets them in a house that ran a while.
    const minted = SLUGS.map((slug) => h.answer(h.must(["wiki", "init", slug, "--json"])).data);
    assert.deepEqual(minted.map((m) => m.held), [true, true, true, false], JSON.stringify(minted));
    await h.restart();
    h.must(["wiki", "hold", "bravo"]);
    for (const slug of SLUGS) {
      const file = join(scratch, `${slug}.mem`);
      writeFileSync(file, memeText(pageUri(slug), `a page in ${slug}`));
      h.must(["meme", "put", pageUri(slug), "--recipe", slug, "--file", file, "--json"]);
    }
    /** The rotatable pins `wiki active` marks, in its own order. */
    const held = () => h.must(["wiki", "active"]).stdout.split("\n").filter((l) => l.includes("📌")).map((l) => l.replace(/.*📌\s*/, "").split(/\s+/)[0]).sort();
    // A minted wiki stands in its own realm under its slug, the realm's default pet name, so its workbench mirror rests at
    // `projections/realms/<slug>/wikis/<slug>`.
    const mirrored = (slug) => existsSync(join(h.root, "projections", "realms", slug, "wikis", slug, "ha.ka.ba", "notes", "page", `${slug}-one.mem`));
    // THE RED STANDS: the cold wikis' pages reach no mirror.
    assert.deepEqual(SLUGS.filter(mirrored), ["bravo"], "a put into a cold wiki projects nowhere");
    assert.deepEqual(held(), ["bravo"]);

    mkdirSync(join(h.root, "workspaces", "backup", ".git"), { recursive: true });
    h.must(["lei", "kui", "--rite", "keep", "--branch", "backup", "--returns", "2", "--json"]);
    const kept = h.answer(h.must(["rite", "keep-cut", "--workspace", "backup", "--json"])).data;
    assert.equal(kept.kept, true, JSON.stringify(kept));
    const manifest = JSON.parse(readFileSync(join(kept.dest, "manifest.json"), "utf8"));
    const carried = (slug) => manifest.rows.filter((r) => r.layer === "wiki-working" && r.title === pageUri(slug)).map((r) => r.path);
    for (const slug of SLUGS) {
      assert.equal(carried(slug).length, 1, `the page put into ${slug} rides the keep: ${JSON.stringify(manifest.rows.map((r) => r.title))}`);
      assert.match(readFileSync(join(kept.dest, ...carried(slug)[0].split("/")), "utf8"), new RegExp(`a page in ${slug}`));
    }
    const cold = manifest.omissions.find((o) => o.kind === "cold-wikis");
    for (const slug of SLUGS) assert.ok(!(cold?.items ?? []).includes(slug), `the keep woke ${slug}, so it names it cold nowhere: ${JSON.stringify(cold)}`);
    assert.deepEqual(held(), ["bravo"], "the pins read as they stood before the cut");
  } finally {
    await h.stop();
    rmSync(h.root, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    rmSync(scratch, { recursive: true, force: true });
  }
});
