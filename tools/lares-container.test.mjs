/**
 * The host shims (lares-container.sh / .ps1) against a fake `docker` that records argv. The fake answers the two
 * questions the shim asks of a vessel: whether one runs (FAKE_RUNNING_ID) and what standing verdict the CLI reads
 * (FAKE_OBSERVE_OUTPUT); FAKE_PS_RC, FAKE_EXEC_RC and FAKE_OBSERVE_RC make each of the three calls fail. Nothing here starts
 * a container: the live proof (found, up, vessel read, ingest, restart, both holder refusals) runs against the
 * real image. This pins the shim's own contract: the verb routing, the refusals by name, the read-only capture
 * binds, and that no argv ever carries the docker socket.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile, chmod, rm, stat } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SH = join(ROOT, "tools/lares-container.sh");
const PS1 = join(ROOT, "tools/lares-container.ps1");
const havePwsh = spawnSync("pwsh", ["-NoProfile", "-Command", "1"]).status === 0;

/**
 * THE ENV FILE RESTS AT `~/.lares/lares-surface.env`, outside every bind, the same file `resolveLaresMcp` reads, and
 * never in the clone: a file beside the compose file would sit in the tracked checkout. Every run names a scratch HOME
 * and a scratch house root, so no test reads a real `~/.lares`. `envAt: "clone"` plants the file beside the compose
 * file instead, where the shim must not look. `@HOUSE@` in an env value or an env file names the run's scratch house.
 */
/** A small tree with a pūlama entry, one module it imports, a workspace package it imports, and a vessel-only module. */
async function plantPulamaTree(root) {
  const put = async (rel, text) => { await mkdir(join(root, rel, ".."), { recursive: true }); await writeFile(join(root, rel), text); };
  await put("packages/lararium-node/package.json", '{"name":"@lararium/node"}\n');
  await put("packages/lararium-node/src/pulama-main.ts", 'import { a } from "./pulama-a.js";\nimport { m } from "@lararium/mesh";\nimport { readFileSync } from "node:fs";\nexport const x = a + m;\n');
  await put("packages/lararium-node/src/pulama-a.ts", "export const a = 1;\n");
  await put("packages/lararium-node/src/main.ts", 'import { a } from "./pulama-a.js";\nexport const vessel = a;\n');
  await put("packages/lararium-mesh/package.json", '{"name":"@lararium/mesh"}\n');
  await put("packages/lararium-mesh/src/index.ts", "export const m = 2;\n");
  await put("packages/lararium-web/package.json", '{"name":"@lararium/web"}\n');
  await put("packages/lararium-web/src/index.ts", "export const w = 3;\n");
}

async function run(shim, argv, { env = {}, envFile, envAt = "hearth", tty, checkout, wornFace, keepSeat, houseFiles = {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "lares-container-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\n[ -z "\${LAR_KUKULU_OFFER:-}" ] || printf 'LAR_KUKULU_OFFER=%s\\n' "$LAR_KUKULU_OFFER" >> "$CALL_LOG"\n` +
      `for a in "$@"; do case "$a" in -f) :;; *override*|/tmp/*) [ -f "$a" ] && cat "$a" >> "$CALL_LOG";; esac; done\n` +
      `case " $* " in *" down --remove-orphans"*|*" stop "*lares*) : > "$CALL_LOG.down";; esac\n` +
      `case " $* " in *" ps -q --status running lares "*) printf '%s' "\${FAKE_RUNNING_ID:-}"; exit "\${FAKE_PS_RC:-0}";; esac\n` +
      `case " $* " in *" ps -q --status running pulama "*) printf '%s' "\${FAKE_PULAMA_ID:-}"; exit "\${FAKE_PULAMA_PS_RC:-0}";; esac\n` +
      `last=''; for a in "$@"; do last=$a; done\n` +
      // THE OUTGOING IMAGE (L4): its id and its revision label, one line, before a build moves the tag.
      `case " $* " in *"image inspect --format {{.Id}}|"*) [ -n "\${FAKE_NO_OUTGOING:-}" ] && exit 1; printf '%s|%s\\n' "\${FAKE_IMAGE_ID:-sha256:feedface}" "\${FAKE_OUTGOING_REV:-}"; exit 0;; esac\n` +
      `case " $* " in *"image inspect --format {{.Created}} {{.Id}} "*) printf '%s\\n' "\${FAKE_TAG_INFO:-}" | awk -v t="\${last#*:}" '$1==t{print $2" "$3}'; exit 0;; esac\n` +
      `case " $* " in *" image ls --format {{.Tag}} "*) printf '%s\\n' "\${FAKE_IMAGE_TAGS:-}"; exit 0;; esac\n` +
      `case " $* " in *" ps -q --filter ancestor="*) id=\${last#ancestor=}; case " \${FAKE_RUNNING_IMAGES:-} " in *" $id "*) printf 'c1\\n';; esac; exit 0;; esac\n` +
      // THE PŪLAMA'S CODE CLOSURE: the image's label, and the label the running pūlama's container carries.
      `case " $* " in *"lares.pulama.closure"*) case " $* " in *"image inspect"*) printf '%s\\n' "\${FAKE_IMAGE_CLOSURE:-}";; *) printf '%s\\n' "\${FAKE_PULAMA_CLOSURE:-}";; esac; exit 0;; esac\n` +
      // A KEPT IMAGE (`<repo>:rev-<12 hex>`): its revision label, where a test names one; none stands otherwise.
      `case " $* " in *"image inspect"*"org.opencontainers.image.revision"*":rev-"*) [ -n "\${FAKE_KEPT_LABEL:-}" ] || exit 1; printf '%s\\n' "\${FAKE_KEPT_LABEL}"; exit 0;; esac\n` +
      `case " $* " in *"image inspect"*"org.opencontainers.image.revision"*) printf '%s\\n' "\${FAKE_IMAGE_REV_LABEL:-}"; exit 0;; esac\n` +
      `case " $* " in *"image inspect"*) printf '%s\\n' "\${FAKE_IMAGE_ID:-sha256:feedface}"; exit 0;; esac\n` +
      // A container's image: the pūlama's (FAKE_PULAMA_ID) or the vessel's.
      `case " $* " in *"inspect --format {{.Image}} "*) if [ -n "\${FAKE_PULAMA_ID:-}" ] && [ "$last" = "\${FAKE_PULAMA_ID}" ]; then printf '%s\\n' "\${FAKE_PULAMA_IMAGE:-}"; exit "\${FAKE_PULAMA_INSPECT_RC:-0}"; fi; [ "\${FAKE_VESSEL_INSPECT_RC:-0}" = 0 ] || exit "\${FAKE_VESSEL_INSPECT_RC}"; printf '%s\\n' "\${FAKE_VESSEL_IMAGE:-}"; exit 0;; esac\n` +
      // A keep seat reads its route on a pty alone: the fake answers the pūlama's refusal unless the exec forces one, and
      // under one writes as a pty does, the prompt with no newline, then CRLF lines.
      `case " $* " in *"pulama-main.js keep-seat"*) case " $* " in *" exec --no-TTY=false pulama "*) ;; *) printf '%s\\n' '{"op":"keep-seat","reading":"refused","code":"route-needs-a-terminal","message":"a keep seat reads its route from a real terminal alone"}'; exit 1;; esac; printf '%s' 'pūlama route, to seat the house'"'"'s keep pair: '; printf '\\r\\n'; [ -z "\${FAKE_KEEP_SEAT_LINE:-}" ] || printf '%s\\r\\n' "\${FAKE_KEEP_SEAT_LINE}"; exit "\${FAKE_KEEP_SEAT_RC:-0}";; esac\n` +
      `case " $* " in *" pulama node -e "*) code=''; take=''; for a in "$@"; do if [ -n "$take" ]; then code=$a; take=''; elif [ "$a" = -e ]; then take=1; fi; done; exec node -e "$code";; esac\n` +
      // THE PŪLAMA'S STATUS (lit, the admitted set): lit and admitting nothing unless a test scripts another answer; a light
      // marks the run, and a status after it answers FAKE_PULAMA_STATUS_AFTER where a test names one.
      `case " $* " in *"pulama-main.js light"*) : > "$CALL_LOG.lit"; exit "\${FAKE_EXEC_RC:-0}";; esac\n` +
      `case " $* " in *"pulama-main.js status"*) lit='{"op":"status","lit":true}'; if [ -e "$CALL_LOG.lit" ] && [ -n "\${FAKE_PULAMA_STATUS_AFTER:-}" ]; then printf '%s\\n' "\${FAKE_PULAMA_STATUS_AFTER}"; else printf '%s\\n' "\${FAKE_PULAMA_STATUS-$lit}"; fi; exit 0;; esac\n` +
      `case " $* " in *" lei terms "*) printf '%s\\n' "\${FAKE_LEI_TERMS:-}"; exit "\${FAKE_TERMS_RC:-0}";; esac\n` +
      // THE ABANDON'S TERMS and the kūkulu's debt read, as the vessel answers them where a test scripts one.
      `case " $* " in *" rite abandon "*"--terms"*) printf '%s\\n' "\${FAKE_ABANDON_TERMS:-}"; exit "\${FAKE_ABANDON_TERMS_RC:-0}";; esac\n` +
      `case " $* " in *" rite receipts "*) printf '%s\\n' "\${FAKE_RECEIPTS:-}"; exit "\${FAKE_RECEIPTS_RC:-0}";; esac\n` +
      // THE REAL HAND VERB, where a test names its module: the pūlama's own `lei` verb (`runHandVerb`) reads the terms the shim
      // passes, over a door that signs what it is asked, so the chain's shapes walk end to end.
      `case " $* " in *"pulama-main.js lei "*) if [ -n "\${FAKE_REAL_HAND_VERB:-}" ]; then t1=""; t2=""; for a in "$@"; do if [ -n "$t2" ]; then terms=$a; t2=""; elif [ -n "$t1" ]; then act=$a; t1=""; t2=1; elif [ "$a" = lei ]; then t1=1; fi; done; exec node --input-type=module -e "\${FAKE_REAL_HAND_VERB}" "$act" "$terms"; fi;; esac\n` +
      `case " $* " in *"pulama-main.js lei "*) case " $* " in *" exec --no-TTY=false pulama "*) ;; *) printf '%s\\n' '[pulama] a lei reads its route from a real terminal alone'; exit 1;; esac; printf '%s\\r\\n' 'pūlama route, to kui a push lei: '; [ -z "\${FAKE_LEI_ANSWER:-}" ] || printf '%s\\n' "\${FAKE_LEI_ANSWER}" | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2).split("\\n").join("\\r\\n")+"\\r\\n"))'; exit "\${FAKE_LEI_RC:-0}";; esac\n` +
      `case " $* " in *" vessel floor seed "*) [ -z "\${FAKE_SEED_FRAME:-}" ] || printf '%s\\n' "\${FAKE_SEED_FRAME}"; printf '%s\\n' 'rebuild chatter' >&2; exit "\${FAKE_SEED_RC:-0}";; esac\n` +
      `case " $* " in *" --observe --json "*) printf '%s\\n' "\${FAKE_OBSERVE_OUTPUT:-}"; exit "\${FAKE_OBSERVE_RC:-0}";; esac\n` +
      `case " $* " in *" vessel census --json "*) printf '%s\\n' "\${FAKE_CENSUS_JSON:-}"; exit 0;; esac\n` +
      // After a stop (a down marks the run), the census answers FAKE_CENSUS_AFTER where a test names one: the new vessel's census.
      `case " $* " in *" vessel census "*) if [ -e "$CALL_LOG.down" ] && [ -n "\${FAKE_CENSUS_AFTER:-}" ]; then printf '%s\\n' "\${FAKE_CENSUS_AFTER}"; exit "\${FAKE_CENSUS_AFTER_RC:-0}"; fi; [ -z "\${FAKE_CENSUS_OUTPUT:-}" ] || printf '%s\\n' "\${FAKE_CENSUS_OUTPUT}"; [ -z "\${FAKE_CENSUS_ERR:-}" ] || printf '%s\\n' "\${FAKE_CENSUS_ERR}" >&2; exit "\${FAKE_CENSUS_RC:-0}";; esac\n` +
      `case " $* " in *" vault status --json "*) printf '%s\\n' "\${FAKE_CUSTODY_OUTPUT:-}"; exit 0;; esac\n` +
      `case " $* " in *" ps -q lares "*) printf '%s' "\${FAKE_STOOD_ID:-\${FAKE_RUNNING_ID:-}}"; exit 0;; esac\n` +
      `case " $* " in *"inspect --format"*) printf '%s\\n' "\${FAKE_IMAGE_REV:-}"; exit 0;; esac\n` +
      // A build lists its context (the folder the override names), so a test reads what rode into the image.
      `case " $* " in *" build "*) printf 'GIT_REV=%s\\n' "\${GIT_REV:-}" >> "$CALL_LOG"; for a in "$@"; do if [ -f "$a" ] && grep -q 'context:' "$a"; then ctx=$(sed -n "s/^ *context: '\\\\(.*\\\\)'$/\\\\1/p" "$a"); (cd "$ctx" && find . -type f | LC_ALL=C sort | sed 's/^/CTX /') >> "$CALL_LOG"; for f in "$ctx"/tools/lares-container.*; do [ ! -f "$f" ] || grep -c 'edited' "$f" | sed 's/^/EDITED /' >> "$CALL_LOG"; done; fi; done; exit "\${FAKE_BUILD_RC:-0}";; esac\n` +
      // THE VESSEL'S LOG before a down removes it: stdout and stderr both, as the engine writes them.
      `case " $* " in *" logs --tail "*) printf '%s\\n' "\${FAKE_VESSEL_LOG:-}"; printf '%s\\n' "\${FAKE_VESSEL_LOG_ERR:-}" >&2; exit "\${FAKE_LOGS_RC:-0}";; esac\n` +
      `case " $* " in *" up -d --wait lares "*) [ "\${FAKE_UP_RC:-0}" = 0 ] || printf '%s\\n' 'compose readiness failed' >&2; exit "\${FAKE_UP_RC:-0}";; esac\n` +
      `case " $* " in *" exec "*) exit "\${FAKE_EXEC_RC:-0}";; esac\n`);
    await chmod(join(dir, "docker"), 0o755);
    // The host's own build answers through pnpm: the fake names each call and fails where a test asks it to.
    await writeFile(join(dir, "pnpm"), `#!/bin/sh\nprintf 'PNPM %s\\n' "$*" >> "$CALL_LOG"\nexit "\${FAKE_PNPM_RC:-0}"\n`);
    await chmod(join(dir, "pnpm"), 0o755);
    const compose = join(dir, "docker-compose.surface.yml");
    await writeFile(compose, "services: {}\n");
    const house = join(dir, "house");
    // `wornFace` plants the face the shim last saw worn (`config/last-worn-face`), as a prior `vault unlock --face N` left it.
    if (wornFace !== undefined) { await mkdir(join(house, "config"), { recursive: true }); await writeFile(join(house, "config", "last-worn-face"), `${wornFace}\n`); }
    // `keepSeat` plants a keep seat already resting (`config/keep-seat.json`), as an earlier seating left it.
    // `houseFiles` plants files under the house root by relative path (a pūlama's state rows, a pending rebuild).
    for (const [rel, text] of Object.entries(houseFiles)) { await mkdir(join(house, rel, ".."), { recursive: true }); await writeFile(join(house, rel), text); }
    if (keepSeat !== undefined) { await mkdir(join(house, "config"), { recursive: true }); await writeFile(join(house, "config", "keep-seat.json"), JSON.stringify(keepSeat) + "\n", { mode: 0o600 }); }
    const fill = (v) => typeof v === "string" ? v.replaceAll("@HOUSE@", house) : v;
    const home = env.HOME ? fill(env.HOME) : join(dir, "home");
    await mkdir(join(home, ".lares"), { recursive: true });
    if (envFile) await writeFile(join(envAt === "clone" ? dir : join(home, ".lares"), "lares-surface.env"), fill(envFile));
    // `checkout` copies the shim into a scratch repo: "clean" (committed), "dirty" (a tracked change uncommitted) or
    // "none" (no git above it), so the revision the shim reads comes from that repo, never from this checkout.
    let script = shim;
    const gitEnv = {};
    if (checkout) {
      const repo = join(dir, "repo");
      await mkdir(join(repo, "tools"), { recursive: true });
      script = join(repo, "tools", shim === SH ? "lares-container.sh" : "lares-container.ps1");
      await writeFile(script, await readFile(shim, "utf8"));
      // The closure reader rides beside the shim, as it does in the checkout.
      await writeFile(join(repo, "tools", "pulama-closure.mjs"), await readFile(join(ROOT, "tools", "pulama-closure.mjs"), "utf8"));
      // "pulama": a clean checkout that carries a pūlama entry, so a build reads its code closure.
      if (checkout === "pulama") await plantPulamaTree(repo);
      gitEnv.GIT_CEILING_DIRECTORIES = dir;
      if (checkout !== "none") {
        const git = (...a) => spawnSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf8" });
        git("init", "-q"); git("add", "."); git("commit", "-qm", "seed");
        // "dirty": a tracked edit uncommitted and an untracked file beside it, neither of which may ride a build.
        if (checkout === "dirty") { await writeFile(script, (await readFile(script, "utf8")) + "\n# edited\n"); await writeFile(join(repo, "stray-untracked.txt"), "never built\n"); }
        // "submodule": a submodule pinned at one commit, whose own checkout has since moved past the pin.
        if (checkout === "submodule") {
          const sub = join(dir, "subsrc");
          await mkdir(sub, { recursive: true });
          const sgit = (cwd, ...a) => spawnSync("git", ["-C", cwd, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "protocol.file.allow=always", ...a], { encoding: "utf8" });
          sgit(sub, "init", "-q"); await writeFile(join(sub, "pinned.txt"), "pinned\n"); sgit(sub, "add", "."); sgit(sub, "commit", "-qm", "pin");
          sgit(repo, "submodule", "add", "-q", sub, "vendor/sub"); sgit(repo, "commit", "-qm", "sub");
          await writeFile(join(repo, "vendor/sub/moved.txt"), "past the pin\n"); sgit(join(repo, "vendor/sub"), "add", "."); sgit(join(repo, "vendor/sub"), "commit", "-qm", "moved");
        }
      }
    }
    // `@HOUSE@` in an argument names the run's scratch house too.
    const args = argv.map(fill);
    const cmd = shim === SH ? ["sh", [script, ...args]] : ["pwsh", ["-NoProfile", "-File", script, ...args]];
    // A standing vessel answers a steady verdict unless a test scripts another answer.
    const steady = '{"data":{"standing":{"act":"attach","reason":"steady"}}}';
    const base = { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: home, LARES_COMPOSE_FILE: compose, FAKE_OBSERVE_OUTPUT: steady, ...gitEnv };
    // `@HEAD@` (and `@HEAD12@`, its first twelve) in an env value names the scratch checkout's own HEAD.
    const head = checkout && checkout !== "none" ? spawnSync("git", ["-C", join(dir, "repo"), "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim() : "";
    const filled = Object.fromEntries(Object.entries(env).map(([k, v]) => [k, typeof v === "string" ? fill(v).replaceAll("@HEAD12@", head.slice(0, 12)).replaceAll("@HEAD@", head) : v]));
    // `tty` names the bytes typed on a pseudo-terminal (`script`), which then carries stdout and stderr as one stream.
    const r = tty === undefined
      ? spawnSync(cmd[0], cmd[1], { env: { ...base, ...filled }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      : spawnSync("script", ["-qec", [cmd[0], ...cmd[1]].map((a) => `'${a}'`).join(" "), "/dev/null"], { env: { ...base, ...filled }, encoding: "utf8", input: tty });
    let calls = ""; try { calls = await readFile(log, "utf8"); } catch {}
    let worn = null; try { worn = (await readFile(join(house, "config", "last-worn-face"), "utf8")).trim(); } catch {}
    let seat = null; let seatMode = null; try { seat = JSON.parse(await readFile(join(house, "config", "keep-seat.json"), "utf8")); seatMode = (await stat(join(house, "config", "keep-seat.json"))).mode & 0o777; } catch {}
    const made = {};
    for (const c of ["hearth", "sensoriums", "projections", "library", "config", "pulama/socket"]) { try { await readdir(join(house, c)); made[c] = true; } catch { made[c] = false; } }
    let cacheLeft = null; try { cacheLeft = await readdir(join(house, "cache")); } catch {}
    let vesselLog = null; try { vesselLog = await readFile(join(house, "run", "vessel-last.log"), "utf8"); } catch {}
    let keepOwed = false; try { await stat(join(house, "run", "keep-owed")); keepOwed = true; } catch {}
    return { ...r, calls, dir, made, worn, seat, seatMode, cacheLeft, vesselLog, keepOwed, house };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

// ATTACHED: under a real pseudo-terminal the shim must NOT add -T, or the founding loses its human-route prompt.
// (Reading `-t 1` inside the `$(tty_flag)` substitution once always read false: stdout there is a pipe.)
const haveScript = spawnSync("script", ["--version"]).status === 0;
test("sh: reset clears the hearth alone, after its refusals; sensoriums, projections, library, config and the env file stay", { skip: !haveScript }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "lares-reset-"));
  try {
    const house = join(dir, "house"), workspace = join(dir, "workspace"), hearth = join(house, "hearth");
    const kept = ["sensoriums", "projections", "library", "config"].map((c) => join(house, c));
    await Promise.all([hearth, ...kept, workspace, join(workspace, "nested"), join(dir, ".lares")].map((path) => mkdir(path, { recursive: true })));
    const calls = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "${calls}"\ncase " $* " in *" ps -q --status running lares "*) printf '%s' "\${FAKE_RUNNING_ID:-}";; *" ps -q --filter volume="*) printf '%s' "\${FAKE_HOLDER_ID:-}";; esac\n`);
    await chmod(join(dir, "docker"), 0o755);
    await writeFile(join(hearth, "entry"), "keep until confirmation");
    await writeFile(join(hearth, ".hidden"), "hidden");
    for (const k of kept) await writeFile(join(k, "keep"), "stays");
    await writeFile(join(dir, ".lares", "lares-surface.env"), "# stays\n");
    const base = { PATH: `${dir}:${process.env.PATH}`, HOME: dir, LARES_HOUSE: house, LARES_WORKSPACE: workspace };
    const reset = (env, input = "re-found\n") => spawnSync("script", ["-qec", `sh '${SH}' reset`, "/dev/null"], { env: { ...base, ...env }, input, encoding: "utf8" });
    const standing = reset({ FAKE_RUNNING_ID: "vessel" });
    assert.equal(standing.status, 2);
    assert.match(standing.stdout, /tools\/lares-container\.sh down first/);
    // The holder check reads the hearth bind, and a running holder of it refuses.
    const held = reset({ FAKE_HOLDER_ID: "founding-run" });
    assert.equal(held.status, 2);
    assert.match(held.stdout, /a running container binds .*hearth: founding-run/);
    assert.match(await readFile(calls, "utf8"), new RegExp(`ps -q --filter volume=${hearth.replaceAll("/", "\\/")}\\b`));
    const parentOfHome = reset({ HOME: join(house, "operator") });
    assert.equal(parentOfHome.status, 2);
    assert.match(parentOfHome.stdout, /containing HOME/);
    for (const unsafe of ["", "/", dir, workspace, join(workspace, "nested"), dir + "/house/../workspace", "relative/house"]) {
      const result = reset({ LARES_HOUSE: unsafe });
      assert.equal(result.status, 2, `${unsafe}: ${result.stdout}`);
    }
    // A house that holds the workspace refuses.
    const holding = reset({ LARES_WORKSPACE: join(house, "projections", "ws") });
    assert.equal(holding.status, 2);
    assert.match(holding.stdout, /containing LARES_WORKSPACE/);
    assert.equal(reset({}, "no\n").status, 2);
    assert.deepEqual((await readdir(hearth)).sort(), [".hidden", "entry"]);
    const done = reset({});
    assert.equal(done.status, 0, done.stdout);
    assert.match(done.stdout, /sensoriums, projections, library, config, the env file and the image stay/);
    // THE PROMPT SAYS PLAINLY that projections stay, private cleartext memory among them, and where a former face's folders go.
    assert.match(done.stdout, /projections stay, and with them the private memory of every face in cleartext/);
    assert.match(done.stdout, /the next export names those folders/);
    // A bundle under config stays across the reset, and so does its import journal, keyed by the faces it landed on.
    assert.match(done.stdout, /a bundle exported under .*\/config stays, and so does its import journal \(keyed by the faces it landed on, so the re-founded faces import it afresh\)/);
    assert.deepEqual(await readdir(hearth), []);
    for (const k of kept) assert.equal(await readFile(join(k, "keep"), "utf8"), "stays");
    assert.equal(await readFile(join(dir, ".lares", "lares-surface.env"), "utf8"), "# stays\n");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("sh: reset refuses a hearth that resolves outside the house", { skip: !haveScript }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "lares-reset-link-"));
  try {
    const house = join(dir, "house"), elsewhere = join(dir, "elsewhere"), workspace = join(dir, "workspace");
    await Promise.all([house, elsewhere, workspace].map((path) => mkdir(path, { recursive: true })));
    await writeFile(join(elsewhere, "precious"), "never cleared");
    spawnSync("ln", ["-s", elsewhere, join(house, "hearth")]);
    await writeFile(join(dir, "docker"), "#!/bin/sh\nexit 0\n");
    await chmod(join(dir, "docker"), 0o755);
    const r = spawnSync("script", ["-qec", `sh '${SH}' reset`, "/dev/null"], { env: { PATH: `${dir}:${process.env.PATH}`, HOME: dir, LARES_HOUSE: house, LARES_WORKSPACE: workspace }, input: "re-found\n", encoding: "utf8" });
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stdout, /resolves outside LARES_HOUSE/);
    assert.equal(await readFile(join(elsewhere, "precious"), "utf8"), "never cleared");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("sh: found under a TTY runs attached, with no -T", { skip: !haveScript }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "lares-container-tty-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\n`);
    await chmod(join(dir, "docker"), 0o755);
    const compose = join(dir, "docker-compose.surface.yml");
    await writeFile(compose, "services: {}\n");
    spawnSync("script", ["-qec", `sh ${SH} found`, "/dev/null"], {
      env: { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: join(dir, "home"), LARES_COMPOSE_FILE: compose, LARES_HOUSE: join(dir, "house"), LARES_WORKSPACE: "/w" },
      encoding: "utf8",
    });
    const calls = await readFile(log, "utf8");
    assert.match(calls, /--profile offline run --rm (?:--name lares-offline-[0-9a-f]+ )?offline vessel found --skip-build --root \/lar --genesis \/app\/genesis\s*$/m);
    assert.doesNotMatch(calls, /(^|\s)-T(\s|$)/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

const MOUNTS = { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w" };
const shims = [["sh", SH], ...(havePwsh ? [["ps1", PS1]] : [])];

for (const [name, shim] of shims) {
  test(`${name}: neither mount standing refuses by name, before docker runs`, async () => {
    const r = await run(shim, ["vessel", "read"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /LARES_HOUSE/);
    assert.equal(r.calls, "");
  });

  test(`${name}: a mount named in the hearth's lares-surface.env stands`, async () => {
    const r = await run(shim, ["vessel", "read"], { envFile: "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=/w\n" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /--env-file \S*\/home\/\.lares\/lares-surface\.env/);
  });

  test(`${name}: an env file beside the compose file goes unread: no hearth file, the mounts refuse by name`, async () => {
    const r = await run(shim, ["vessel", "read"], { envFile: "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=/w\n", envAt: "clone" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /LARES_HOUSE stands in neither the environment nor \S*\/home\/\.lares\/lares-surface\.env/);
    assert.equal(r.calls, "");
  });

  test(`${name}: with no hearth env file and the mounts from the shell, compose is pointed off the checkout's own .env`, async () => {
    const r = await run(shim, ["vessel", "read"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    // Compose auto-loads `.env` from the compose file's directory when no --env-file names one; the shim
    // names an empty one so a checkout .env never feeds the vessel's variables.
    assert.match(r.calls, /--env-file \/dev\/null|--env-file NUL/);
  });

  test(`${name}: CONTROL: a hearth env file stays the env file named`, async () => {
    const r = await run(shim, ["vessel", "read"], { envFile: "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=/w\n" });
    assert.match(r.calls, /--env-file \S*\/home\/\.lares\/lares-surface\.env/);
    assert.doesNotMatch(r.calls, /--env-file \/dev\/null/);
  });

  test(`${name}: any other argv with a running vessel runs the CLI by exec`, async () => {
    const r = await run(shim, ["vessel", "read", "--json"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /compose .*exec (?:-e LARES_EXEC_TAG )?-T lares node packages\/lares-cli\/bin\/lares\.mjs vessel read --json/);
  });

  test(`${name}: display and debug names cross into the vessel by name alone; no value and no other name`, async () => {
    const shown = { NO_COLOR: "1", TERM: "xterm-256color", COLORTERM: "truecolor", LARES_DEBUG: "1", SOME_TOKEN: "s3cret" };
    const r = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", ...shown } });
    assert.equal(r.status, 0, r.stderr);
    const exec = r.calls.split("\n").find((l) => / exec /.test(l) && / vessel read$/.test(l));
    assert.ok(exec, r.calls);
    for (const n of ["NO_COLOR", "TERM", "COLORTERM", "LARES_DEBUG"]) assert.match(exec, new RegExp(`(^| )-e ${n}( |$)`));
    assert.doesNotMatch(r.calls, /xterm-256color|truecolor|s3cret|SOME_TOKEN/);
    const offline = await run(shim, ["persona", "list"], { env: { ...MOUNTS, TERM: "dumb" } });
    assert.match(offline.calls, /--profile offline run --rm --name lares-offline-[0-9a-f]+ -e TERM -T offline persona list/);
  });

  test(`${name}: a harness mark crosses into the vessel by name, so an AI shell's CLI asks as a seat (#231); an unmarked shell carries none`, async () => {
    const marks = { CLAUDECODE: "1", CODEX_SANDBOX: "seatbelt", CODEX_SANDBOX_NETWORK_DISABLED: "1" };
    const r = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", ...marks } });
    assert.equal(r.status, 0, r.stderr);
    const exec = r.calls.split("\n").find((l) => / exec /.test(l) && / vessel read$/.test(l));
    assert.ok(exec, r.calls);
    for (const n of Object.keys(marks)) assert.match(exec, new RegExp(`(^| )-e ${n}( |$)`));
    assert.doesNotMatch(r.calls, /seatbelt/, "the value never rides argv");
    const offline = await run(shim, ["persona", "list"], { env: { ...MOUNTS, CLAUDECODE: "1" } });
    assert.match(offline.calls, /--profile offline run --rm --name lares-offline-[0-9a-f]+ (?:-e \S+ )*-e CLAUDECODE /);
    const bare = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.doesNotMatch(bare.calls, /-e (?:CLAUDECODE|CODEX_SANDBOX)/);
  });

  test(`${name}: an act carries its stop handle: an exec its LARES_EXEC_TAG by name, a run its lares-offline-<tag> name`, async () => {
    const standing = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.match(standing.calls, /exec -e LARES_EXEC_TAG -T lares node \S+ vessel read$/m);
    assert.doesNotMatch(standing.calls, /LARES_EXEC_TAG=/);
    const offline = await run(shim, ["persona", "list"], { env: MOUNTS });
    assert.match(offline.calls, /run --rm --name lares-offline-[0-9a-f]{16} -T offline persona list$/m);
  });

  test(`${name}: CONTROL with none of the names set, no -e rides`, async () => {
    const r = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.doesNotMatch(r.calls, /(^| )-e (?!LARES_EXEC_TAG )/m);
  });

  test(`${name}: a verb with no running vessel uses the offline door`, async () => {
    const r = await run(shim, ["persona", "new", "0", "--name", "ci-face"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /--profile offline run --rm (?:--name lares-offline-[0-9a-f]+ )?-T offline persona new 0 --name ci-face/);
    assert.doesNotMatch(r.calls, /compose .*exec/);
  });

  test(`${name}: found uses the offline CLI door`, async () => {
    const r = await run(shim, ["found", "--json"], { env: MOUNTS });
    assert.match(r.calls, /--profile offline run --rm (?:--name lares-offline-[0-9a-f]+ )?-T offline vessel found --skip-build --root \/lar --genesis \/app\/genesis --json\s*$/m);
  });

  test(`${name}: a successful exec with a restand verdict restarts and waits healthy`, async () => {
    const r = await run(shim, ["persona", "new", "0", "--name", "ci-face"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /restart lares[\s\S]*up -d --wait lares/);
    assert.match(r.stderr, /lares-container: face lit; restarting the vessel/);
  });

  // A VESSEL STANDS HOLDING NO KEY. With no TTY the shim names the one command that opens it, after every act
  // that stands or restarts the vessel; a vessel that already holds its key draws no line.
  // A vessel of several faces refuses a bare unlock, so the hint names every face the credential opens and the face to wear.
  // A house that remembers no face worn names no wear: the vessel mounts its own (face 0 where it stands open, else the
  // lowest face open or lent), and the shim never tells the vessel, or a pūlama, a face it never saw worn.
  const NAMES_UNLOCK = new RegExp(`the vessel stands holding no vessel key; open it on a terminal: lares-container\\.${name} vault unlock --all \\(every face the credential opens; no face rests remembered, so the vessel mounts its own; another face: wear N\\)`);
  test(`${name}: up names vault unlock when the vessel holds no key`, async () => {
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: '{"ok":true,"data":{"door":{"op":"custody","unlocked":false}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /up -d --wait lares[\s\S]*exec (?:-e LARES_EXEC_TAG )?-T lares node \S+ vault status --json/);
    assert.match(r.stderr, NAMES_UNLOCK);
    assert.doesNotMatch(r.calls, /vault unlock/, "no TTY: the shim sends no unlock, it only names it");
  });

  test(`${name}: empty-worn-face-names-no-wear: an empty config/last-worn-face draws no wear 0, on a terminal or off one`, async () => {
    const LOCKED = '{"data":{"door":{"unlocked":false}}}';
    const hint = await run(shim, ["up"], { wornFace: "", env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: LOCKED } });
    assert.equal(hint.status, 0, hint.stderr);
    assert.match(hint.stderr, NAMES_UNLOCK);
    assert.doesNotMatch(hint.stderr, /wear 0|wear h0/);
    const attached = await run(shim, ["up"], { wornFace: "", tty: "", env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: LOCKED } });
    assert.equal(attached.status, 0, attached.stdout);
    assert.match(attached.calls, /lares node \S+ vault unlock --all/);
    assert.doesNotMatch(attached.calls, / wear \d+$/m);
    assert.match(attached.stdout, /no face rests remembered \(config\/last-worn-face reads empty\), so the shim wears none and the vessel's own mount stands/);
  });

  test(`${name}: the unlock hint wears the face last worn through the shim, never the bare command`, async () => {
    const r = await run(shim, ["up"], { wornFace: 2, env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":false}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, new RegExp(`open it on a terminal: lares-container\\.${name} vault unlock --all, then lares-container\\.${name} wear 2 \\(every face the credential opens, then wear h2; another face: wear N\\)`));
    assert.doesNotMatch(r.stderr, new RegExp(`vault unlock(?! --all)(?! --face)\\s*$`, "m"));
  });

  test(`${name}: a vault unlock --face N that lands remembers the face to wear; a refused one, and a bare one, remember nothing`, async () => {
    const worn = await run(shim, ["vault", "unlock", "--face", "1"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(worn.status, 0, worn.stderr);
    assert.match(worn.calls, /exec (?:-e LARES_EXEC_TAG )?(?:-T )?lares node \S+ vault unlock --face 1/);
    assert.equal(worn.worn, "1");
    const refused = await run(shim, ["vault", "unlock", "--face", "2"], { wornFace: 1, env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "1" } });
    assert.notEqual(refused.status, 0);
    assert.equal(refused.worn, "1");
    const bare = await run(shim, ["vault", "unlock", "--all"], { wornFace: 1, env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(bare.worn, "1");
  });

  test(`${name}: wear N routes to the vessel's own wear and, when it lands, remembers the face; a refused wear remembers nothing`, async () => {
    const worn = await run(shim, ["wear", "2"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(worn.status, 0, worn.stderr);
    assert.match(worn.calls, /exec (?:-e LARES_EXEC_TAG )?(?:-T )?lares node \S+ wear 2/);
    assert.equal(worn.worn, "2");
    const refused = await run(shim, ["wear", "3"], { wornFace: 2, env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "1" } });
    assert.notEqual(refused.status, 0);
    assert.equal(refused.worn, "2");
  });

  test(`${name}: CONTROL a vessel that holds its key draws no unlock line`, async () => {
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: '{"ok":true,"data":{"door":{"op":"custody","unlocked":true}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /holding no vessel key/);
  });

  /** The commit the image's label reads against: HEAD alone (a build reads the commit, so changes never ride it). */
  const checkoutRev = () => spawnSync("git", ["-C", ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const checkoutDirty = () => spawnSync("git", ["-C", ROOT, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).stdout.trim() !== "";

  test(`${name}: up warns when the image's revision label differs from HEAD, naming both`, async () => {
    const head = checkoutRev();
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_IMAGE_REV: "0123456789abcdef0123456789abcdef01234567", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":true}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /image names revision 0123456789abcdef0123456789abcdef01234567 and the checkout /);
    if (!checkoutDirty()) {
      assert.ok(r.stderr.includes(head), "the warning names the checkout's head");
      assert.ok(r.stderr.includes(`rebuild with \`tools/lares-container.${name} build\``), "the hint names the shim's build verb, never a bare compose build");
    } else {
      assert.ok(r.stderr.includes(head), "the warning names the checkout's head");
      assert.match(r.stderr, /uncommitted changes no image carries/);
    }
    assert.doesNotMatch(r.stderr, /docker compose -f \S+ build|GIT_REV=/, "no hint names a bare compose build that skips the env file");
    assert.doesNotMatch(r.stderr, /rebuild the image \(`docker compose build`\)/);
  });

  test(`${name}: a label carrying control characters prints without them`, async () => {
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_IMAGE_REV: "\u001b[31mevil\u0085\u009b[0m", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":true}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /[\u001b\u0085\u009b]/);
  });

  test(`${name}: CONTROL up stays silent about the revision when the image names the checkout's rev`, async () => {
    const head = checkoutRev();
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_IMAGE_REV: head, FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":true}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /image names revision/);
    assert.doesNotMatch(r.stderr, /no git checkout/);
  });

  test(`${name}: every stand the shim performs reads the image's revision: the bare vessel stand and a restart warn as up warns`, async () => {
    const stale = "0123456789abcdef0123456789abcdef01234567";
    const unlocked = '{"data":{"door":{"unlocked":true}}}';
    // The bare stand, no vessel standing: the fake's `ps -q` answers the image once the stand ran (FAKE_STOOD_ID).
    const bare = await run(shim, ["vessel", "stand"], { env: { ...MOUNTS, FAKE_STOOD_ID: "cid", FAKE_IMAGE_REV: stale, FAKE_CUSTODY_OUTPUT: unlocked } });
    assert.equal(bare.status, 0, bare.stderr);
    assert.match(bare.stderr, new RegExp(`image names revision ${stale}`), "the bare stand warns");
    const restand = await run(shim, ["vessel", "stand"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_IMAGE_REV: stale, FAKE_CUSTODY_OUTPUT: unlocked, FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' },
    });
    assert.equal(restand.status, 0, restand.stderr);
    assert.match(restand.stderr, new RegExp(`image names revision ${stale}`), "a restart warns");
    // CONTROL: an image that names the checkout's rev stays silent on both paths.
    const head = checkoutRev();
    const same = await run(shim, ["vessel", "stand"], { env: { ...MOUNTS, FAKE_STOOD_ID: "cid", FAKE_IMAGE_REV: head, FAKE_CUSTODY_OUTPUT: unlocked } });
    assert.equal(same.status, 0, same.stderr);
    assert.doesNotMatch(same.stderr, /image names revision/);
  });

  test(`${name}: a workspace names a projection target, so a working checkout, a pinned clone and a plain corpus all stand silent; the shim names no canon clone and no dev-install switch`, async () => {
    const places = await mkdtemp(join(tmpdir(), "lares-workspace-places-"));
    try {
      const git = (repo, ...a) => spawnSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf8" });
      const checkout = join(places, "checkout"), clone = join(places, "clone"), corpus = join(places, "corpus");
      for (const d of [checkout, clone, corpus]) await mkdir(d, { recursive: true });
      git(checkout, "init", "-q"); git(clone, "init", "-q"); git(clone, "config", "lares.canonPin", "develop");
      const stand = (ws) => run(shim, ["up"], { env: { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: ws, FAKE_RUNNING_ID: "cid", FAKE_IMAGE_REV: checkoutRev(), FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":true}}}', GIT_CEILING_DIRECTORIES: places } });
      for (const ws of [checkout, clone, corpus]) {
        const r = await stand(ws);
        assert.equal(r.status, 0, r.stderr);
        assert.doesNotMatch(r.stderr, /names a working checkout|canon clone|house-canon|LARES_DEV_INSTALL|dev install/, `${ws} stands with no canon-clone warning`);
      }
      const source = await readFile(shim, "utf8");
      assert.doesNotMatch(source, /LARES_DEV_INSTALL|lares\.canonPin|warn_workspace_canon|WarnWorkspaceCanon|HOUSE CANON CLONE/, "the shim carries no canon-clone warning and no dev-install switch");
    } finally { await rm(places, { recursive: true, force: true }); }
  });

  test(`${name}: a restart the shim performs names vault unlock again`, async () => {
    const r = await run(shim, ["persona", "new", "0", "--name", "ci-face"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /restart lares[\s\S]*up -d --wait lares[\s\S]*vault status --json/);
    assert.match(r.stderr, NAMES_UNLOCK);
  });

  test(`${name}: vault lock routes to the CLI inside the standing vessel`, async () => {
    const r = await run(shim, ["vault", "lock"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec (?:-e LARES_EXEC_TAG )?-T lares node \S+ vault lock/);
  });

  test(`${name}: CONTROL attach verdict does not restart`, async () => {
    const r = await run(shim, ["persona", "list"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"attach","reason":"steady"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: vessel stand with no service stands and waits healthy`, async () => {
    const r = await run(shim, ["vessel", "stand"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /up -d --wait lares/);
    // The one exec a fresh stand makes: the custody door's read, after which the shim names the unlock.
    const execs = r.calls.split("\n").filter((line) => /compose .*exec /.test(line) || /^compose exec |(^| )exec /.test(line));
    assert.equal(execs.length, 1, r.calls);
    assert.match(execs[0], /exec (?:-e LARES_EXEC_TAG )?-T lares node \S+ vault status --json/);
    assert.match(r.stderr, NAMES_UNLOCK);
  });

  test(`${name}: vessel stand on a standing vessel whose verdict reads restand restarts it`, async () => {
    const r = await run(shim, ["vessel", "stand"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec (?:-e LARES_EXEC_TAG )?-T lares node \S+ vessel stand --observe --json[\s\S]*restart lares[\s\S]*up -d --wait lares/);
    // The acting stand never runs inside the container: the one exec carries --observe.
    assert.doesNotMatch(r.calls, /vessel stand\s*$/m);
  });

  test(`${name}: CONTROL vessel stand on a vessel whose verdict reads attach prints the reading and restarts nothing`, async () => {
    const r = await run(shim, ["vessel", "stand"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"attach","reason":"steady"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /"act":"attach"/);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: --observe anywhere in a vessel stand argv keeps it a reading`, async () => {
    const r = await run(shim, ["vessel", "stand", "--json", "--observe"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec (?:-e LARES_EXEC_TAG )?-T lares node \S+ vessel stand --json --observe/);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: vessel stand --observe passes through as a reading`, async () => {
    const r = await run(shim, ["vessel", "stand", "--observe", "--json"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"attach","reason":"steady"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec (?:-e LARES_EXEC_TAG )?-T lares node packages\/lares-cli\/bin\/lares\.mjs vessel stand --observe --json/);
    assert.equal((r.calls.match(/--observe --json/g) ?? []).length, 1);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: a failed state reading refuses, and opens neither door`, async () => {
    const r = await run(shim, ["persona", "list"], { env: { ...MOUNTS, FAKE_PS_RC: "1" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /cannot read the vessel's state/);
    assert.doesNotMatch(r.calls, /compose .*exec|run --rm/);
  });

  test(`${name}: a verb the CLI refuses keeps its exit status, and no standing check follows`, async () => {
    const r = await run(shim, ["meme", "get", "lar:///x", "--recipe", "default"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "7" } });
    assert.equal(r.status, 7);
    assert.doesNotMatch(r.calls, /--observe/);
  });

  test(`${name}: a standing check that fails after a verb landed exits non-zero and says so`, async () => {
    const r = await run(shim, ["persona", "new", "1", "--name", "probe"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_RC: "1" } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /the standing check after it answered no verdict/);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: a standing check that exits zero and names no verdict never passes as "no lift"`, async () => {
    for (const answer of ["", "not json", '{"data":{}}', '{"data":{"standing":{"act":"dance"}}}']) {
      const r = await run(shim, ["persona", "new", "1", "--name", "probe"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: answer } });
      assert.equal(r.status, 1, JSON.stringify(answer));
      assert.match(r.stderr, /answered no verdict/);
    }
  });

  test(`${name}: option-bearing host stand routes to the CLI`, async () => {
    const r = await run(shim, ["vessel", "stand", "--init"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec (?:-e LARES_EXEC_TAG )?-T lares node packages\/lares-cli\/bin\/lares\.mjs vessel stand --init/);
  });

  test(`${name}: vessel stop stops the container from the host, never from inside it`, async () => {
    const r = await run(shim, ["vessel", "stop"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /stop lares\s*$/m);
    assert.doesNotMatch(r.calls, /compose .*exec/);
  });

  test(`${name}: unknown vessel sub-doors are handed to the CLI`, async () => {
    for (const argv of [["vessel", "clear", "--force"], ["vessel", "rite", "rebirth"]]) {
      const r = await run(shim, argv, { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "2" } });
      assert.equal(r.status, 2, argv.join(" "));
      assert.match(r.calls, /exec (?:-e LARES_EXEC_TAG )?-T lares node packages\/lares-cli\/bin\/lares\.mjs/);
      assert.doesNotMatch(r.stderr, /no pave or wipe command/);
    }
  });

  test(`${name}: option-bearing vessel stand is validated by the CLI`, async () => {
    const argv = ["vessel", "stand", "--restart"];
    const r = await run(shim, argv, { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "2" } });
    assert.equal(r.status, 2, argv.join(" "));
    assert.match(r.calls, /exec (?:-e LARES_EXEC_TAG )?-T lares node packages\/lares-cli\/bin\/lares\.mjs vessel stand --restart\s*$/m);
    assert.doesNotMatch(r.stderr, /takes no option through this shim/);
  });

  test(`${name}: CONTROL another vessel rite still routes to the CLI`, async () => {
    const r = await run(shim, ["vessel", "rite", "quorum"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec (?:-e LARES_EXEC_TAG )?-T lares node \S+ vessel rite quorum/);
  });

  test(`${name}: a capture path holding a quote and a dollar sign rides the override as a literal`, async () => {
    const base = await mkdtemp(join(tmpdir(), "cap-odd-"));
    const odd = join(base, "it's $HOME");
    try {
      await mkdir(odd);
      const r = await run(shim, ["up", "--capture", odd], { env: MOUNTS });
      assert.equal(r.status, 0, r.stderr);
      assert.ok(r.calls.includes(`source: '${odd.replaceAll("'", "''").replaceAll("$", "$$$$")}'`), r.calls);
    } finally { await rm(base, { recursive: true, force: true }); }
  });

  test(`${name}: up stands the lares service detached; down removes it`, async () => {
    assert.match((await run(shim, ["up"], { env: MOUNTS })).calls, /up -d --wait lares/);
    assert.match((await run(shim, ["down"], { env: MOUNTS })).calls, /down --remove-orphans/);
  });

  // THE CENSUS BEFORE A STOP (operator ruling R3): a stop never drops content silently.
  const STANDING = { ...MOUNTS, FAKE_RUNNING_ID: "vessel" };
  const CLEAN = "census: clean — no save waits in memory, and the disk projector owes no carrier";
  const ITEMS = "held-save  save-unbooked  doc doc-heron  2 save(s) in memory  bag notes\ncarrier  pending  lar:///ha.ka.ba/notes/pond  bag notes  island wiki";
  const stopped = (calls) => /down --remove-orphans/.test(calls);

  test(`${name}: down over a standing vessel asks the census first, and a clean answer stops it`, async () => {
    const r = await run(shim, ["down", "--timeout", "5"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec (?:-e LARES_EXEC_TAG )?-T lares node packages\/lares-cli\/bin\/lares\.mjs vessel census --no-json/);
    assert.ok(r.calls.indexOf("vessel census") < r.calls.indexOf("down --remove-orphans"), r.calls);
    // down's own flags still pass through.
    assert.match(r.calls, /down --remove-orphans --timeout 5/);
  });

  // THE VESSEL'S LOG OUTLIVES THE DOWN. A down removes the container and its log with it (a captured repro once lost its
  // [wire] lines so), so down saves the last 20000 lines to the house's run/vessel-last.log first, overwritten each
  // down, and names the file in one line. A log that cannot be read never blocks the down.
  test(`${name}: down-saves-the-vessel-log: the container's log lands in run/vessel-last.log before the stop, named in one line; a refused read still stops`, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_VESSEL_LOG: "[wire] share verdict landed", FAKE_VESSEL_LOG_ERR: "[wire] stderr side" }, houseFiles: { "run/vessel-last.log": "an older down's log\n" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /^logs --tail 20000 vessel$/m);
    assert.ok(r.calls.indexOf("logs --tail") < r.calls.indexOf("down --remove-orphans"), r.calls);
    assert.match(r.vesselLog ?? "", /\[wire\] share verdict landed/);
    assert.match(r.vesselLog ?? "", /\[wire\] stderr side/);
    assert.doesNotMatch(r.vesselLog ?? "", /an older down's log/, "each down overwrites the file");
    assert.equal(r.stderr.split("\n").filter((l) => /vessel-last\.log/.test(l)).length, 1, r.stderr);
    assert.match(r.stderr, new RegExp(`lares-container: the vessel's log \\(its last 20000 lines\\) rests at ${r.house.replaceAll("/", "\\/")}\\/run\\/vessel-last\\.log`));
    const refused = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_LOGS_RC: "1" } });
    assert.equal(refused.status, 0, refused.stderr);
    assert.match(refused.stderr, /the vessel's log could not be read; the down goes on/);
    assert.match(refused.calls, /down --remove-orphans/);
    const none = await run(shim, ["down"], { env: { ...MOUNTS } });
    assert.doesNotMatch(none.calls, /logs --tail/, "no vessel stood, so no log is read");
  });

  // THE HOUSE KEEPS ITSELF: where a keep workspace stands named, down runs the host's `rite keep --if-due` while the vessel
  // still stands, before the census; a keep that refuses never blocks the down.
  const KEPT_ENVELOPE = '{"ok":true,"data":{"rite":"keep","due":true,"workspace":"house-backup"}}';
  const fakeHostCli = async (rc) => {
    const d = await mkdtemp(join(tmpdir(), "lares-keep-cli-"));
    const f = join(d, "lares");
    await writeFile(f, `#!/bin/sh\nprintf 'HOSTCLI %s\\n' "$*" >> "$CALL_LOG"\n${rc === 0 ? `printf '%s\\n' '${KEPT_ENVELOPE}'\n` : ""}exit ${rc}\n`);
    await chmod(f, 0o755);
    return f;
  };
  test(`${name}: down-keeps-the-house-first: a named keep workspace runs rite keep --if-due before the census`, async () => {
    const cli = await fakeHostCli(0);
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, LARES_KEEP_WORKSPACE: "house-backup", LARES_HOST_CLI: cli } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /HOSTCLI rite keep --if-due --json/);
    assert.ok(r.calls.indexOf("HOSTCLI rite keep") < r.calls.indexOf("vessel census"), r.calls);
  });
  test(`${name}: down-goes-on-past-a-refused-keep: the keep's refusal is named and the down still stops the vessel`, async () => {
    const cli = await fakeHostCli(1);
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, LARES_KEEP_WORKSPACE: "house-backup", LARES_HOST_CLI: cli } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /the keep did not complete/);
    assert.match(r.calls, /down --remove-orphans/);
  });
  test(`${name}: CONTROL down with no keep workspace named runs no keep`, async () => {
    const cli = await fakeHostCli(0);
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, LARES_HOST_CLI: cli } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /HOSTCLI/);
  });

  test(`${name}: a census naming items refuses with no terminal, listing each, and stops nothing`, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_RC: "3" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /held-save {2}save-unbooked {2}doc doc-heron/);
    assert.match(r.stderr, /carrier {2}pending {2}lar:\/\/\/ha\.ka\.ba\/notes\/pond/);
    assert.match(r.stderr, /vault unlock/);
    assert.match(r.stderr, /accept-loss/);
    assert.match(r.stderr, /no terminal/);
    assert.equal(stopped(r.calls), false, r.calls);
  });

  // THE WAY TO SETTLE READS THE VESSEL'S STATE: faces open and none worn wear one; a key not held unlocks; a worn face waits.
  const NONE_WORN = "census: no face worn (h0, h1, h2 stand open): wear one (`lares wear N`), then down\ncensus: 2 item(s) rest nowhere yet; a stop now drops them";
  const HELD = '{"ok":true,"data":{"door":{"op":"custody","unlocked":true}}}';
  test(`${name}: down-names-the-wear-when-none-worn: faces open and none worn name wear N, never vault unlock`, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_ERR: NONE_WORN, FAKE_CENSUS_RC: "3", FAKE_CUSTODY_OUTPUT: HELD } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /wear a face and let it settle: tools\/lares-container\.(sh|ps1) wear N \(faces stand open and none worn\), then tools\/lares-container\.(sh|ps1) down again/);
    assert.doesNotMatch(r.stderr, /vault unlock/);
    assert.equal(stopped(r.calls), false, r.calls);
  });
  test(`${name}: down-waits-on-a-worn-face: a key held under a worn face names the wait alone, never vault unlock`, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_ERR: "census: 2 item(s) rest nowhere yet; a stop now drops them", FAKE_CENSUS_RC: "3", FAKE_CUSTODY_OUTPUT: HELD } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /let it settle: give the vessel a moment, then tools\/lares-container\.(sh|ps1) down again/);
    assert.doesNotMatch(r.stderr, /vault unlock|wear N/);
  });

  test(`${name}: a census that cannot answer refuses by name, never a silent stop`, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_RC: "1", FAKE_CENSUS_ERR: "container wedged" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /could not answer/);
    assert.match(r.stderr, /check .*lares-container.* logs/i);
    assert.doesNotMatch(r.stderr, /container wedged/);
    assert.equal(stopped(r.calls), false, r.calls);
    // An exit of zero that names no clean verdict never reads clean.
    const mute = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_RC: "0" } });
    assert.equal(mute.status, 2);
    assert.equal(stopped(mute.calls), false, mute.calls);
  });

  test(`${name}: a locked hearth's census says unlock first, then down, never "could not answer"`, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_RC: "2", FAKE_CENSUS_ERR: "census: vessel locked: run `lares vault unlock`, then down" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /vessel locked: run tools\/lares-container\.(sh|ps1) vault unlock, then down/);
    assert.doesNotMatch(r.stderr, /could not answer/);
    assert.equal(stopped(r.calls), false, r.calls);
  });

  // L5 (RD4): A MOVED IMAGE NEVER RECREATES SILENTLY. `up`, or a lift, over a vessel whose image differs from the one the
  // tag names runs the down path first: the keep, the census, the refusal of a silent stop.
  const MOVED = { ...STANDING, FAKE_VESSEL_IMAGE: "sha256:old", FAKE_IMAGE_ID: "sha256:new", FAKE_CUSTODY_OUTPUT: HELD };
  test(`${name}: up-on-a-moved-image-runs-the-down-path: the census, then the stop, then the stand on the new image`, async () => {
    const cli = await fakeHostCli(0);
    const r = await run(shim, ["up"], { env: { ...MOVED, FAKE_CENSUS_OUTPUT: CLEAN, LARES_KEEP_WORKSPACE: "house-backup", LARES_HOST_CLI: cli } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /the vessel runs image sha256:old, and lares-surface:local stands at sha256:new; the down path runs first \(keep, census\), never a silent recreate/);
    const keep = r.calls.indexOf("HOSTCLI rite keep"), census = r.calls.indexOf("vessel census"), stop = r.calls.indexOf("down --remove-orphans"), up = r.calls.indexOf("up -d --wait lares");
    assert.ok(keep >= 0 && census > keep && stop > census && up > stop, `order keep, census, stop, up:\n${r.calls}`);
  });
  test(`${name}: up-on-a-moved-image-refuses-a-silent-stop: a census naming items stops nothing and stands nothing`, async () => {
    const r = await run(shim, ["up"], { env: { ...MOVED, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_RC: "3" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /accept-loss/);
    assert.equal(stopped(r.calls), false, r.calls);
    assert.doesNotMatch(r.calls, /up -d --wait lares/);
  });
  test(`${name}: a-lift-on-a-moved-image-runs-the-down-path: a restand verdict over a moved image takes the census, never a bare restart`, async () => {
    const r = await run(shim, ["persona", "new", "0", "--name", "ci-face"], { env: { ...MOVED, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /restart lares/);
    assert.ok(r.calls.indexOf("vessel census") >= 0 && r.calls.indexOf("vessel census") < r.calls.lastIndexOf("up -d --wait lares"), r.calls);
  });
  test(`${name}: CONTROL up over a vessel on the image that stands asks no census`, async () => {
    const r = await run(shim, ["up"], { env: { ...STANDING, FAKE_VESSEL_IMAGE: "sha256:same", FAKE_IMAGE_ID: "sha256:same", FAKE_CUSTODY_OUTPUT: HELD } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /vessel census --no-json/, "no stop census: the one census read names the mount");
    assert.equal(stopped(r.calls), false);
  });

  test(`${name}: up translates compose failure after its own error`, async () => {
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_UP_RC: "1" } });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /the vessel did not become ready — check tools\/lares-container\.sh logs; if it already runs, run up again/);
  });

  test(`${name}: a ps that fails refuses the stop with no terminal`, async () => {
    const r = await run(shim, ["down"], { env: { ...MOUNTS, FAKE_PS_RC: "1" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /reads unknown/);
    assert.equal(stopped(r.calls), false, r.calls);
  });

  test(`${name}: CONTROL down with no vessel standing asks no census`, async () => {
    const r = await run(shim, ["down"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /vessel census/);
    assert.ok(stopped(r.calls));
  });

  test(`${name}: on a terminal, accept-loss typed stops; another word refuses`, { skip: !haveScript }, async () => {
    const items = { ...STANDING, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_RC: "3" };
    const accepted = await run(shim, ["down"], { env: items, tty: "accept-loss\n" });
    assert.equal(accepted.status, 0, accepted.stdout);
    assert.match(accepted.stdout, /doc doc-heron/);
    assert.match(accepted.stdout, /Type accept-loss/);
    assert.ok(stopped(accepted.calls), accepted.calls);
    const wrong = await run(shim, ["down"], { env: items, tty: "yes\n" });
    assert.notEqual(wrong.status, 0, wrong.stdout);
    assert.match(wrong.stdout, /did not read accept-loss/);
    assert.equal(stopped(wrong.calls), false, wrong.calls);
  });

  test(`${name}: on a terminal, a census that cannot answer offers accept-loss`, { skip: !haveScript }, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_RC: "1" }, tty: "accept-loss\n" });
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /could not answer/);
    assert.ok(stopped(r.calls), r.calls);
  });

  test(`${name}: --capture binds read-only under /capture/<n>; a home directory whole refuses`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "cap-"));
    try {
      const r = await run(shim, ["up", "--capture", dir], { env: MOUNTS });
      assert.match(r.calls, /target: \/capture\/1/);
      assert.match(r.calls, /read_only: true/);
      const bad = await run(shim, ["up", "--capture", "/home"], { env: MOUNTS });
      assert.equal(bad.status, 2);
      assert.match(bad.stderr, /home directory/);
      assert.equal(bad.calls, "");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  test(`${name}: --workspace binds read-write under /lar/workspaces/<name>; LARES_WORKSPACES stands on every up`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "ws-"));
    const other = await mkdtemp(join(tmpdir(), "ws2-"));
    try {
      const r = await run(shim, ["up", "--workspace", `field-notes=${dir}`], { env: { ...MOUNTS, LARES_WORKSPACES: `drafts=${other}` } });
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.calls, /target: \/lar\/workspaces\/field-notes/);
      assert.match(r.calls, /target: \/lar\/workspaces\/drafts/);
      assert.doesNotMatch(r.calls, /workspaces\/field-notes\n\s+read_only/);
      const twice = await run(shim, ["up", "--workspace", `a=${dir}`, "--workspace", `a=${other}`], { env: MOUNTS });
      assert.equal(twice.status, 2);
      assert.match(twice.stderr, /binds once/);
      assert.equal(twice.calls, "");
    } finally { await rm(dir, { recursive: true, force: true }); await rm(other, { recursive: true, force: true }); }
  });

  test(`${name}: a restart keeps every LARES_WORKSPACES bind`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "ws-restart-"));
    try {
      const r = await run(shim, ["persona", "new", "0", "--name", "ci-face"], {
        env: { ...MOUNTS, LARES_WORKSPACES: `field-notes=${dir}`, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' },
      });
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.calls, /restart lares[\s\S]*up -d --wait lares/);
      assert.match(r.calls, /target: \/lar\/workspaces\/field-notes/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  test(`${name}: a workspace inside the hearth refuses by name, before docker runs; the checkout binds like any directory (rank 4j)`, async () => {
    const inCheckout = await run(shim, ["up", "--workspace", `tree=${join(ROOT, "tools")}`], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' } });
    assert.equal(inCheckout.status, 0, inCheckout.stderr);
    assert.match(inCheckout.calls, /target: \/lar\/workspaces\/tree/);
    const inHearth = await run(shim, ["up", "--workspace", "deep=@HOUSE@/hearth"], { env: MOUNTS });
    assert.equal(inHearth.status, 2);
    assert.match(inHearth.stderr, /inside the hearth/);
    assert.equal(inHearth.calls, "");
    const badName = await run(shim, ["up", "--workspace", `../x=${tmpdir()}`], { env: MOUNTS });
    assert.equal(badName.status, 2);
    assert.match(badName.stderr, /names no workspace/);
  });

  test(`${name}: a relative LARES_HOUSE refuses by name, before docker runs`, async () => {
    const r = await run(shim, ["vessel", "read"], { env: { LARES_HOUSE: "house", LARES_WORKSPACE: "/w" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /LARES_HOUSE \(house\) reads relative/);
    assert.equal(r.calls, "");
  });

  test(`${name}: an env file inside one of the house's binds refuses by name, before docker runs`, async () => {
    const inside = await run(shim, ["vessel", "read"], { env: { HOME: "@HOUSE@/config/operator", LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w" }, envFile: "# names nothing\n" });
    assert.equal(inside.status, 2, inside.stderr);
    assert.match(inside.stderr, /sits inside LARES_HOUSE's config bind/);
    assert.equal(inside.calls, "");
    // CONTROL: an env file beside the house root, in no bind, serves.
    const beside = await run(shim, ["vessel", "read"], { env: { HOME: "@HOUSE@/operator", LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w" }, envFile: "# names nothing\n" });
    assert.equal(beside.status, 0, beside.stderr);
  });

  test(`${name}: up, found and the offline door make the house's bound classes before a container stands, and never the pūlama's socket directory (a named volume holds it, out of the host's reach)`, async () => {
    for (const argv of [["up"], ["found"]]) {
      const r = await run(shim, argv, { env: MOUNTS });
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(r.made, { hearth: true, sensoriums: true, projections: true, library: true, config: true, "pulama/socket": false });
      assert.doesNotMatch(r.stderr, /pulama\/socket/);
    }
    const offline = await run(shim, ["vessel", "read"], { env: MOUNTS });
    assert.deepEqual(offline.made, { hearth: true, sensoriums: true, projections: true, library: true, config: true, "pulama/socket": false });
    // UNDER A PŪLAMA too: the shim makes its state directory and still no socket directory.
    const pulama = await run(shim, ["pulama", "up"], { env: { ...MOUNTS, LARES_PULAMA: "1" } });
    assert.equal(pulama.status, 0, pulama.stderr);
    assert.equal(pulama.made["pulama/socket"], false);
  });

  test(`${name}: a pūlama socket directory standing on the host gets named for the operator to remove, and the shim never removes it`, async () => {
    const r = await run(shim, ["up"], { env: MOUNTS, houseFiles: { "pulama/socket/pulama.sock": "" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /pulama\/socket mounts nowhere.*remove it by hand/);
    assert.equal(r.made["pulama/socket"], true, "the shim leaves the stale directory standing");
  });

  // THE IMAGE BUILDS THROUGH THE SHIM: a bare `docker compose build` reads no env file and fails on LARES_HOUSE.
  // L3 (RD2): IT BUILDS FROM THE COMMIT, unpacked from `git archive` in a scratch folder under the house's cache.
  test(`${name}: build runs compose build through the env file, from the commit's archive in the house's cache, baking that revision`, async () => {
    const r = await run(shim, ["build", "--no-cache"], { envFile: "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=/w\n", checkout: "clean" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /compose --env-file \S*\/home\/\.lares\/lares-surface\.env -f \S+ -f \S*\/house\/cache\/build-override\.\S+ build --no-cache lares/);
    assert.match(r.calls, /^GIT_REV=[0-9a-f]{40}$/m, r.calls);
    const stamped = r.calls.match(/^GIT_REV=([0-9a-f]{40})$/m)[1];
    // The override names the scratch context under the house's cache and carries the revision as a build arg.
    assert.match(r.calls, /context: '\S*\/house\/cache\/build\.[^']+'/);
    assert.ok(r.calls.includes(`GIT_REV: '${stamped}'`), r.calls);
    assert.match(r.calls, /^CTX \.\/tools\/lares-container\.(sh|ps1)$/m, "the archive unpacked into the context");
    assert.match(r.stderr, new RegExp(`building the vessel image \\(every package\\) from commit ${stamped.slice(0, 12)}`));
    assert.ok(r.stderr.includes(`stands rebuilt from ${stamped.slice(0, 12)} (revision ${stamped})`), "the done line names the revision it stamped");
    assert.doesNotMatch(r.stderr, /leaves them out/);
    assert.deepEqual(r.cacheLeft, [], "the scratch context and its override leave the cache");
  });

  test(`${name}: build over a dirty checkout builds from HEAD, names what it left out, and no uncommitted or untracked byte rides the image`, async () => {
    const r = await run(shim, ["build"], { env: MOUNTS, checkout: "dirty" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /^GIT_REV=[0-9a-f]{40}$/m, "the label names the commit, never -dirty");
    assert.match(r.stderr, /the checkout holds 2 uncommitted or untracked path\(s\); the image builds from [0-9a-f]{12} and leaves them out/);
    assert.match(r.stderr, /stray-untracked\.txt/);
    assert.match(r.stderr, /lares-container\.(sh|ps1)/);
    assert.doesNotMatch(r.calls, /^CTX \.\/stray-untracked\.txt$/m);
    assert.match(r.calls, /^EDITED 0$/m, "the context carries the committed shim, not the edit");
  });

  test(`${name}: build --at <rev> builds that commit; a name that reads no commit refuses before docker builds`, async () => {
    const r = await run(shim, ["build", "--at", "HEAD"], { env: MOUNTS, checkout: "clean" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /^GIT_REV=[0-9a-f]{40}$/m);
    const bad = await run(shim, ["build", "--at", "no-such-rev"], { env: MOUNTS, checkout: "clean" });
    assert.equal(bad.status, 2, bad.stderr);
    assert.match(bad.stderr, /build refuses: no-such-rev names no commit/);
    assert.doesNotMatch(bad.calls, / build /);
  });

  test(`${name}: build-builds-the-host: the checkout's own commit builds the host CLI after the image; another commit keeps the host's build and names both; a failed host build refuses by name`, async () => {
    const same = await run(shim, ["build"], { env: MOUNTS, checkout: "submodule" });
    assert.equal(same.status, 0, same.stderr);
    assert.match(same.calls, /PNPM --dir \S+ run --silent build:host/);
    const other = await run(shim, ["build", "--at", "HEAD~1"], { env: MOUNTS, checkout: "submodule" });
    assert.equal(other.status, 0, other.stderr);
    assert.doesNotMatch(other.calls, /PNPM /);
    assert.match(other.stderr, /the checkout stands at \w{12} and the image carries \w{12}, so the host CLI keeps its own build/);
    const failed = await run(shim, ["build"], { env: { ...MOUNTS, FAKE_PNPM_RC: "1" }, checkout: "clean" });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /the host CLI build failed \(above\); the image stands built from \w{12}/);
  });

  // L4 (RD3): THE OUTGOING IMAGE KEEPS A REVISION TAG, and the newest three revision tags stand; the rest prune.
  test(`${name}: build tags the outgoing image lares-surface:rev-<short rev> before it moves the tag; an unlabeled one by its id; none standing tags nothing`, async () => {
    const labeled = await run(shim, ["build"], { env: { ...MOUNTS, FAKE_OUTGOING_REV: "0123456789abcdef0123456789abcdef01234567" }, checkout: "clean" });
    assert.equal(labeled.status, 0, labeled.stderr);
    assert.match(labeled.calls, /^tag lares-surface:local lares-surface:rev-0123456789ab$/m);
    assert.ok(labeled.calls.indexOf("tag lares-surface:local") < labeled.calls.indexOf(" build "), labeled.calls);
    assert.match(labeled.stderr, /the outgoing image keeps the tag lares-surface:rev-0123456789ab/);
    const unlabeled = await run(shim, ["build"], { env: { ...MOUNTS, FAKE_IMAGE_ID: "sha256:" + "9a".repeat(32) }, checkout: "clean" });
    assert.match(unlabeled.calls, /^tag lares-surface:local lares-surface:rev-unlabeled-9a9a9a9a9a9a$/m);
    const none = await run(shim, ["build"], { env: { ...MOUNTS, FAKE_NO_OUTGOING: "1" }, checkout: "clean" });
    assert.equal(none.status, 0, none.stderr);
    assert.doesNotMatch(none.calls, /^tag /m);
  });

  test(`${name}: build keeps the newest three revision tags and prunes the rest, never a hand tag, an image a container runs, or the image the pūlama admitted last`, async () => {
    const id = (c) => "sha256:" + c.repeat(64);
    const tags = ["rev-aaaaaaaaaaaa", "rev-bbbbbbbbbbbb", "rev-cccccccccccc", "rev-dddddddddddd", "rev-eeeeeeeeeeee", "rev-ffffffffffff", "rev-111111111111", "keep-me", "rev-handmade", "local"];
    const info = [
      ["rev-aaaaaaaaaaaa", "2026-11-19T05:00:00Z", id("a")], ["rev-bbbbbbbbbbbb", "2026-11-18T05:00:00Z", id("b")],
      ["rev-cccccccccccc", "2026-11-17T05:00:00Z", id("c")], ["rev-dddddddddddd", "2026-11-16T05:00:00Z", id("d")],
      ["rev-eeeeeeeeeeee", "2026-11-15T05:00:00Z", id("e")], ["rev-ffffffffffff", "2026-11-14T05:00:00Z", id("f")],
      ["rev-111111111111", "2026-11-13T05:00:00Z", id("1")],
      ["keep-me", "2026-01-01T05:00:00Z", id("7")], ["rev-handmade", "2026-01-01T05:00:00Z", id("8")],
    ].map((r) => r.join(" ")).join("\n");
    const admitted = JSON.stringify({ title: "$:/lares/pulama/admitted/" + "0".repeat(64), text: JSON.stringify({ body: { act: "image-admitted", image: id("e") }, sig: "x" }) });
    const r = await run(shim, ["build"], {
      env: { ...MOUNTS, FAKE_IMAGE_TAGS: tags.join("\n"), FAKE_TAG_INFO: info, FAKE_RUNNING_IMAGES: id("d") },
      checkout: "clean",
      houseFiles: { [`pulama/state/records/${"ab".repeat(32)}.json`]: admitted, "pulama/state/image": id("1") + "\n" },
    });
    assert.equal(r.status, 0, r.stderr);
    const pruned = [...r.calls.matchAll(/^rmi (\S+)$/gm)].map((m) => m[1]);
    assert.deepEqual(pruned, ["lares-surface:rev-ffffffffffff"], r.calls);
    assert.ok(r.calls.indexOf(" build ") < r.calls.indexOf("rmi "), "the prune follows the build");
    assert.match(r.stderr, /pruned lares-surface:rev-ffffffffffff/);
    assert.match(r.stderr, /keeps lares-surface:rev-dddddddddddd: a container runs it/);
    assert.match(r.stderr, /keeps lares-surface:rev-eeeeeeeeeeee: the pūlama admitted it last/);
    assert.match(r.stderr, /keeps lares-surface:rev-111111111111: the image the pūlama last raised/);
    assert.doesNotMatch(r.calls, /rmi \S*(keep-me|handmade|:local)/);
    assert.doesNotMatch(r.calls, /rmi -f|pulama-main\.js unadmit/, "a prune only untags; the admission record stays");
    // A build that fails prunes nothing.
    const failed = await run(shim, ["build"], { env: { ...MOUNTS, FAKE_BUILD_RC: "1", FAKE_IMAGE_TAGS: tags.join("\n"), FAKE_TAG_INFO: info }, checkout: "clean" });
    assert.notEqual(failed.status, 0);
    assert.doesNotMatch(failed.calls, /^rmi /m);
  });

  // THE PŪLAMA'S CODE CLOSURE rides the image as a label, so a vessel-only build keeps the standing pūlama.
  test(`${name}: build labels the image with the pūlama's code closure, read from the archived tree`, async () => {
    const r = await run(shim, ["build"], { env: MOUNTS, checkout: "pulama" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /PULAMA_CLOSURE: 'sha256:[0-9a-f]{64}'/, r.calls);
    assert.match(r.stderr, /the pūlama's code closure reads sha256:[0-9a-f]{12}/);
    const bare = await run(shim, ["build"], { env: MOUNTS, checkout: "clean" });
    assert.equal(bare.status, 0, bare.stderr);
    assert.match(bare.calls, /PULAMA_CLOSURE: ''/);
    assert.match(bare.stderr, /no pūlama code closure reads from this tree/);
  });

  test(`${name}: build archives each submodule at its pinned commit, never where its checkout has moved`, async () => {
    const r = await run(shim, ["build"], { env: MOUNTS, checkout: "submodule" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /^CTX \.\/vendor\/sub\/pinned\.txt$/m, r.calls);
    assert.doesNotMatch(r.calls, /^CTX \.\/vendor\/sub\/moved\.txt$/m);
  });

  test(`${name}: a build that fails names it, and the scratch context leaves the house's cache`, async () => {
    const r = await run(shim, ["build"], { env: { ...MOUNTS, FAKE_BUILD_RC: "1" }, checkout: "clean" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /the build failed/);
    assert.deepEqual(r.cacheLeft, []);
  });

  test(`${name}: build with no checkout refuses by name, before docker builds`, async () => {
    const r = await run(shim, ["build"], { env: MOUNTS, checkout: "none" });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /build refuses: no git checkout answers/);
    assert.doesNotMatch(r.calls, / build /);
  });

  // L7, FOLDED UNDER `lares rite kukulu`: THE RESTAND makes the image first (the house keeps standing through the build),
  // then walks keep, down (census), up and the last face worn, and names the revision, the worn face and the keep in one
  // closing line. No branch moves.
  test(`${name}: rebuild-walks-the-rite: the build from the commit, then the down path (keep, census), up, the face worn, one closing line`, async () => {
    const cli = await fakeHostCli(0);
    const r = await run(shim, ["rebuild"], { checkout: "clean", wornFace: 2, env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CUSTODY_OUTPUT: HELD, FAKE_CENSUS_JSON: '{"ok":true,"data":{"facesLit":[0,2],"worn":2}}', FAKE_IMAGE_REV_LABEL: "0123456789abcdef0123456789abcdef01234567", LARES_KEEP_WORKSPACE: "house-backup", LARES_HOST_CLI: cli } });
    assert.equal(r.status, 0, r.stderr);
    const keep = r.calls.indexOf("HOSTCLI rite keep --if-due"), census = r.calls.indexOf("vessel census --no-json"), down = r.calls.indexOf("down --remove-orphans"), build = r.calls.indexOf(" build "), up = r.calls.indexOf("up -d --wait lares");
    assert.ok(build >= 0 && keep > build && census > keep && down > census && up > down, `order build, keep, census, down, up:\n${r.calls}`);
    assert.match(r.stderr, /the house stands on revision 0123456789ab, wearing h2; keep: kept \(rite keep --if-due\)/);
    // THE HOST BUILDS FROM THE SAME REVISION: the checkout stands at the commit the image built, so its CLI builds after
    // the image and before the vessel stands, and the line says so.
    const host = r.calls.indexOf("PNPM --dir ");
    assert.ok(host > build && up > host, `order build, host build, up:\n${r.calls}`);
    assert.match(r.calls, /PNPM --dir \S+ run --silent build:host/);
    assert.match(r.stderr, /the host CLI builds from \w{12}, the revision the image carries/);
    assert.doesNotMatch(r.calls, /checkout|switch|pulama-main/, "no branch moves, and no pūlama is touched");
    assert.equal(r.stdout, "", "the restand prints its lines on stderr alone");
  });
  test(`${name}: rebuild-stops-on-a-refused-census: the census naming items refuses, and nothing stands; the image built stays built`, async () => {
    const r = await run(shim, ["rebuild"], { checkout: "clean", env: { ...STANDING, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_RC: "3" } });
    assert.equal(r.status, 2);
    assert.doesNotMatch(r.calls, /up -d --wait lares|down --remove-orphans/);
  });
  // KŪKULU SURVIVES A CTRL+C (gate 2): the down path's keep refused `carry-unsettled` over the same census the stop then asked,
  // and the keep never ran again. Now the restand keeps AFTER the raise once the new vessel's census reads clean, and says so.
  const keepTwice = async (first, second) => {
    const d = await mkdtemp(join(tmpdir(), "lares-keep-cli-"));
    const f = join(d, "lares");
    // A keep that kept answers the CLI's envelope naming its workspace, as `rite keep --if-due --json` does.
    await writeFile(f, `#!/bin/sh\nprintf 'HOSTCLI %s\\n' "$*" >> "$CALL_LOG"\nif [ -e "$CALL_LOG.kept1" ]; then rc=${second}; else : > "$CALL_LOG.kept1"; rc=${first}; fi\n[ "$rc" -ne 0 ] || printf '%s\\n' '${KEPT_ENVELOPE}'\nexit $rc\n`);
    await chmod(f, 0o755);
    return f;
  };
  test(`${name}: rebuild-keeps-after-the-raise: a keep that refused before the down runs again after the up once the census reads clean, and the closing line names it; CONTROL: a keep that kept before the down runs once`, async () => {
    const env = { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CUSTODY_OUTPUT: HELD, FAKE_IMAGE_REV_LABEL: "0123456789abcdef0123456789abcdef01234567", LARES_KEEP_WORKSPACE: "house-backup" };
    const r = await run(shim, ["rebuild"], { checkout: "clean", env: { ...env, LARES_HOST_CLI: await keepTwice(1, 0) } });
    assert.equal(r.status, 0, r.stderr);
    const lines = r.calls.split("\n");
    const keeps = lines.flatMap((l, i) => (/HOSTCLI rite keep --if-due/.test(l) ? [i] : []));
    const up = lines.findIndex((l) => /up -d --wait lares/.test(l));
    assert.equal(keeps.length, 2, r.calls);
    assert.ok(keeps[0] < up && keeps[1] > up, `the second keep follows the up:\n${r.calls}`);
    assert.ok(lines.findLastIndex((l) => /vessel census --no-json/.test(l)) > up, `the census after the up asks before the keep:\n${r.calls}`);
    assert.match(r.stderr, /the keep before the down did not complete; the new vessel's census reads clean, so the keep runs now/);
    assert.match(r.stderr, /keep: kept after the raise \(rite keep --if-due\)/);
    const once = await run(shim, ["rebuild"], { checkout: "clean", env: { ...env, LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.equal(once.status, 0, once.stderr);
    assert.equal(once.calls.split("\n").filter((l) => /HOSTCLI rite keep/.test(l)).length, 1, once.calls);
    assert.match(once.stderr, /keep: kept \(rite keep --if-due\)/);
  });
  test(`${name}: rebuild-defers-the-keep-past-an-unsettled-census: a census after the raise that still names items keeps nothing and names the deferral, never silently`, async () => {
    const r = await run(shim, ["rebuild"], { checkout: "clean", env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CENSUS_AFTER: ITEMS, FAKE_CENSUS_AFTER_RC: "3", FAKE_CUSTODY_OUTPUT: HELD, FAKE_IMAGE_REV_LABEL: "0123456789abcdef0123456789abcdef01234567", LARES_KEEP_WORKSPACE: "house-backup", LARES_HOST_CLI: await keepTwice(1, 0) } });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.calls.split("\n").filter((l) => /HOSTCLI rite keep/.test(l)).length, 1, r.calls);
    assert.match(r.stderr, /keep: deferred: the census after the raise still names what rests nowhere yet; `lares rite keep` keeps once it reads clean/);
  });
  test(`${name}: down-names-a-held-saves-only-census-plainly: before the accept-loss offer, a census of held saves alone says so (how many, that no carrier or untracked file waits, that accept-loss drops exactly these); CONTROL: a census with a carrier says nothing of the kind`, async () => {
    const held = "held-save  save-unbooked  doc doc-heron  2 save(s) in memory  bag notes\nheld-save  save-unmapped  doc doc-wren  1 save(s) in memory  bag (none mapped)";
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: held, FAKE_CENSUS_RC: "3" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /the census names held saves alone \(2 documents\): each a save the sealed rest keeps in memory until a session books it in this vessel; no carrier and no untracked file waits, so accept-loss drops exactly these/);
    assert.ok(r.stderr.indexOf("held saves alone") < r.stderr.indexOf("Two ways on"), r.stderr);
    const mixed = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_RC: "3" } });
    assert.doesNotMatch(mixed.stderr, /held saves alone/);
  });
  test(`${name}: rebuild-image-names-when-the-offer-rested: an offer naming the image carries its time (UTC) in the reading; CONTROL: none resting names none`, async () => {
    const r = await run(shim, ["rebuild", "--image"], { checkout: "clean", houseFiles: { "config/kukulu-offer.json": '{"vouch":[{"body":{"image":"sha256:new"}}]}\n' }, env: { ...STANDING, FAKE_IMAGE_ID: "sha256:new", FAKE_VESSEL_IMAGE: "sha256:old" } });
    assert.equal(r.status, 0, r.stderr);
    const reading = JSON.parse(r.stdout.trim().split("\n").at(-1));
    assert.equal(reading.offer, true);
    assert.match(reading.offerAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
  // THE SECOND READ (gate 2): an offer carries an image only by its vouch's own `image` field, never a digest that merely
  // begins another; the keep a down left owed persists across invocations; and under the rite the keep waits for the landing.
  test(`${name}: offer-carries-the-image-by-its-field: an offer naming a longer digest that begins with the image's carries none of it`, async () => {
    const r = await run(shim, ["rebuild", "--image"], { checkout: "clean", houseFiles: { "config/kukulu-offer.json": '{"vouch":[{"body":{"image":"sha256:newer"}}]}\n' }, env: { ...STANDING, FAKE_IMAGE_ID: "sha256:new", FAKE_VESSEL_IMAGE: "sha256:old" } });
    assert.equal(r.status, 0, r.stderr);
    const reading = JSON.parse(r.stdout.trim().split("\n").at(-1));
    assert.equal(reading.offer, false);
    assert.equal("offerAt" in reading, false);
  });
  test(`${name}: keep-owed-persists: a down whose keep refused leaves run/keep-owed; the next raise from a down vessel (a Ctrl+C at the light stopped the last) keeps once the census reads clean and clears the mark; CONTROL: a keep that kept leaves no mark`, async () => {
    const owed = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, LARES_KEEP_WORKSPACE: "house-backup", LARES_HOST_CLI: await keepTwice(1, 1) } });
    assert.equal(owed.status, 0, owed.stderr);
    assert.equal(owed.keepOwed, true);
    const later = await run(shim, ["rebuild"], { checkout: "clean", houseFiles: { "run/keep-owed": "" }, env: { ...MOUNTS, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CUSTODY_OUTPUT: HELD, FAKE_IMAGE_REV_LABEL: "0123456789abcdef0123456789abcdef01234567", LARES_KEEP_WORKSPACE: "house-backup", LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.equal(later.status, 0, later.stderr);
    assert.match(later.calls, /HOSTCLI rite keep --if-due/);
    assert.match(later.stderr, /keep: kept after the raise \(rite keep --if-due\)/);
    assert.equal(later.keepOwed, false);
    const kept = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, LARES_KEEP_WORKSPACE: "house-backup", LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.equal(kept.keepOwed, false);
  });
  test(`${name}: keep-after-landing: under the rite (rebuild --keep-after-landing) the raise keeps nothing after the up and names the keep owed; the keep-owed verb then keeps once the census reads clean and clears the mark, or names the deferral and keeps the mark`, async () => {
    const env = { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CUSTODY_OUTPUT: HELD, FAKE_IMAGE_REV_LABEL: "0123456789abcdef0123456789abcdef01234567", LARES_KEEP_WORKSPACE: "house-backup", FAKE_RECEIPTS: '{"ok":true,"data":{"rite":"kukulu","standing":[],"pending":[],"offer":null}}' };
    const r = await run(shim, ["rebuild", "--keep-after-landing"], { checkout: "clean", env: { ...env, LARES_HOST_CLI: await keepTwice(1, 0) } });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.calls.split("\n").filter((l) => /HOSTCLI rite keep/.test(l)).length, 1, r.calls);
    assert.match(r.stderr, /keep: owed; it runs after the rite lands its halves/);
    assert.equal(r.keepOwed, true);
    const after = await run(shim, ["keep-owed"], { houseFiles: { "run/keep-owed": "" }, env: { ...env, LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.equal(after.status, 0, after.stderr);
    assert.match(after.calls, /HOSTCLI rite keep --if-due/);
    assert.match(after.stderr, /keep: kept after the raise \(rite keep --if-due\)/);
    assert.equal(after.keepOwed, false);
    const deferred = await run(shim, ["keep-owed"], { houseFiles: { "run/keep-owed": "" }, env: { ...env, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_RC: "3", LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.equal(deferred.status, 0, deferred.stderr);
    assert.doesNotMatch(deferred.calls, /HOSTCLI/);
    assert.match(deferred.stderr, /keep: deferred: the census after the raise still names what rests nowhere yet/);
    assert.equal(deferred.keepOwed, true);
    const none = await run(shim, ["keep-owed"], { env: { ...env, LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.equal(none.status, 0, none.stderr);
    assert.doesNotMatch(none.calls, /HOSTCLI|vessel census/);
  });
  // THE THIRD READ (gate 2): an owed keep waits for the landing. `keep-owed` refuses while any kūkulu half rests unlanded (or the
  // debt reads nowhere), keeping the mark; under the rite the down path keeps nothing while a mark is owed; a raise reports the
  // image its vessel runs; and under a pūlama `rite abandon` reads its terms in the vessel, signs at the hand door, and lands.
  test(`${name}: keep-owed-waits-for-the-landing: a half resting unlanded, or a debt read that fails, keeps nothing and keeps the mark; under the rite a down with a mark owed keeps nothing before the landing`, async () => {
    const env = { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CUSTODY_OUTPUT: HELD, FAKE_IMAGE_REV_LABEL: "0123456789abcdef0123456789abcdef01234567", LARES_KEEP_WORKSPACE: "house-backup" };
    const pending = '{"ok":true,"data":{"rite":"kukulu","standing":[],"pending":[{"tessera":"' + "c".repeat(64) + '","group":"g","branch":"main","head":"a"}],"offer":null}}';
    for (const extra of [{ FAKE_RECEIPTS: pending }, { FAKE_RECEIPTS: "", FAKE_RECEIPTS_RC: "2" }]) {
      const waits = await run(shim, ["keep-owed"], { houseFiles: { "run/keep-owed": "" }, env: { ...env, ...extra, LARES_HOST_CLI: await keepTwice(0, 0) } });
      assert.equal(waits.status, 0, waits.stderr);
      assert.doesNotMatch(waits.calls, /HOSTCLI/);
      assert.match(waits.stderr, /keep: owed; a kūkulu half rests unlanded \(or the debt reads nowhere\), so the keep waits for `lares rite kukulu` to land it/);
      assert.equal(waits.keepOwed, true);
    }
    const r = await run(shim, ["rebuild", "--keep-after-landing"], { checkout: "clean", houseFiles: { "run/keep-owed": "" }, env: { ...env, LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /HOSTCLI/);
    assert.match(r.stderr, /the keep a down left owed waits for the rite's landing/);
    assert.equal(r.keepOwed, true);
  });
  test(`${name}: keep-owed-reads-the-debt-whole (the fourth read): a debt read that exits non-zero waits even where its output names no pending half; a keep that resolves no workspace keeps the mark`, async () => {
    const env = { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CUSTODY_OUTPUT: HELD, LARES_KEEP_WORKSPACE: "house-backup" };
    const masked = await run(shim, ["keep-owed"], { houseFiles: { "run/keep-owed": "" }, env: { ...env, FAKE_RECEIPTS: '{"ok":true,"data":{"pending":[]}}', FAKE_RECEIPTS_RC: "2", LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.doesNotMatch(masked.calls, /HOSTCLI/);
    assert.equal(masked.keepOwed, true);
    const d = await mkdtemp(join(tmpdir(), "lares-keep-cli-"));
    const none = join(d, "lares");
    await writeFile(none, `#!/bin/sh\nprintf 'HOSTCLI %s\\n' "$*" >> "$CALL_LOG"\nprintf '%s\\n' '{"ok":true,"data":{"rite":"keep","due":false,"workspace":null,"why":"no keep workspace named"}}'\nexit 0\n`);
    await chmod(none, 0o755);
    const nothing = await run(shim, ["keep-owed"], { houseFiles: { "run/keep-owed": "" }, env: { ...env, FAKE_RECEIPTS: '{"ok":true,"data":{"pending":[]}}', LARES_HOST_CLI: none } });
    assert.match(nothing.calls, /HOSTCLI rite keep --if-due/);
    assert.equal(nothing.keepOwed, true);
    assert.match(nothing.stderr, /keep: no keep workspace resolved, so nothing kept; the keep stays owed/);
  });
  test(`${name}: keep-clears-on-a-real-keep (the fifth read): a keep that exits zero with no answer, or an answer that reads as no envelope naming its workspace, keeps the mark; CONTROL: the envelope naming the workspace clears it`, async () => {
    const env = { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CUSTODY_OUTPUT: HELD, LARES_KEEP_WORKSPACE: "house-backup", FAKE_RECEIPTS: '{"ok":true,"data":{"pending":[]}}' };
    for (const out of ["", "kept, probably", '{"ok":true,"data":{"rite":"keep","workspace":""}}', '{"ok":false,"data":{"workspace":"house-backup"}}', '{"ok":true,"data":{"workspace":"house-backup"', '{"ok":true,"note":"x","data":{"workspace":7},"also":{"workspace":"house-backup"}}', '{"ok":1,"data":{"workspace":"house-backup"}}', '[{"ok":true,"data":{"workspace":"house-backup"}}]', '{"ok":true,"data":{"workspace":"house-backup",},}', '{"ok":true,"n":NaN,"data":{"workspace":"house-backup"}}', '{"ok":true,"data":["house-backup"]}']) {
      const d = await mkdtemp(join(tmpdir(), "lares-keep-cli-"));
      const cli = join(d, "lares");
      await writeFile(cli, `#!/bin/sh\nprintf 'HOSTCLI %s\\n' "$*" >> "$CALL_LOG"\nprintf '%s\\n' '${out}'\nexit 0\n`);
      await chmod(cli, 0o755);
      const r = await run(shim, ["keep-owed"], { houseFiles: { "run/keep-owed": "" }, env: { ...env, LARES_HOST_CLI: cli } });
      assert.match(r.calls, /HOSTCLI rite keep --if-due/);
      assert.equal(r.keepOwed, true, JSON.stringify(out));
      assert.match(r.stderr, /keep: the keep answered no envelope naming its workspace, so nothing reads kept; the keep stays owed|keep: no keep workspace resolved/);
    }
    const kept = await run(shim, ["keep-owed"], { houseFiles: { "run/keep-owed": "" }, env: { ...env, LARES_HOST_CLI: await fakeHostCli(0) } });
    assert.equal(kept.keepOwed, false);
  });
  test(`${name}: vessel-image-fails-loud (the fourth read): an inspect that fails exits non-zero and prints nothing, never a digest`, async () => {
    const r = await run(shim, ["vessel-image"], { env: { ...STANDING, FAKE_VESSEL_IMAGE: "sha256:" + "ee".repeat(32), FAKE_VESSEL_INSPECT_RC: "1" } });
    assert.notEqual(r.status, 0);
    assert.equal(r.stdout.trim(), "");
  });
  test(`${name}: vessel-image-reads-the-running-image: it prints the image the running vessel runs, by digest; none running prints nothing`, async () => {
    const r = await run(shim, ["vessel-image"], { env: { ...STANDING, FAKE_VESSEL_IMAGE: "sha256:" + "ee".repeat(32) } });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "sha256:" + "ee".repeat(32));
    const none = await run(shim, ["vessel-image"], { env: MOUNTS });
    assert.equal(none.status, 0, none.stderr);
    assert.equal(none.stdout.trim(), "");
  });
  test(`${name}: rebuild-takes-at-or-prior: --at <rev> builds that commit; --resume, --prior beside --at, or a stray word, refuses before anything moves`, async () => {
    const at = await run(shim, ["rebuild", "--at", "HEAD"], { checkout: "clean", env: { ...MOUNTS, FAKE_CUSTODY_OUTPUT: HELD } });
    assert.equal(at.status, 0, at.stderr);
    assert.match(at.calls, /^GIT_REV=[0-9a-f]{40}$/m);
    for (const argv of [["rebuild", "--resume"], ["rebuild", "--prior", "--at", "HEAD"], ["rebuild", "now"]]) {
      const bad = await run(shim, argv, { checkout: "clean", env: MOUNTS });
      assert.equal(bad.status, 2, bad.stderr);
      assert.equal(bad.calls, "", bad.calls);
    }
  });
  // THE RESTAND READS WHERE THE HOUSE STANDS: an image the tag holds at the revision builds nothing, and a vessel already on
  // it stays standing (no keep, no census, no down, no up); the closing line still names the house.
  test(`${name}: rebuild-reads-the-house: the image at HEAD builds nothing, and a vessel on it stays standing; CONTROL: a vessel on another image takes the down path and up`, async () => {
    const quiet = await run(shim, ["rebuild"], { checkout: "clean", wornFace: 2, env: { ...STANDING, FAKE_IMAGE_REV_LABEL: "@HEAD@", FAKE_IMAGE_ID: "sha256:new", FAKE_VESSEL_IMAGE: "sha256:new", FAKE_CUSTODY_OUTPUT: HELD, FAKE_CENSUS_JSON: '{"ok":true,"data":{"facesLit":[0,2],"worn":2}}' } });
    assert.equal(quiet.status, 0, quiet.stderr);
    assert.doesNotMatch(quiet.calls, / build |vessel census --no-json|down --remove-orphans|up -d --wait lares/);
    assert.match(quiet.stderr, /holds the image of \w{12} already; no build/);
    assert.match(quiet.stderr, /the vessel runs sha256:new already and stays standing/);
    assert.match(quiet.stderr, /the house stands on revision \w{12}, wearing h2; keep: the vessel stayed standing, so no keep ran/);
    const moved = await run(shim, ["rebuild"], { checkout: "clean", env: { ...STANDING, FAKE_IMAGE_REV_LABEL: "@HEAD@", FAKE_IMAGE_ID: "sha256:new", FAKE_VESSEL_IMAGE: "sha256:old", FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CUSTODY_OUTPUT: HELD } });
    assert.equal(moved.status, 0, moved.stderr);
    assert.doesNotMatch(moved.calls, / build /);
    assert.match(moved.calls, /vessel census --no-json[\s\S]*down --remove-orphans[\s\S]*up -d --wait lares/);
  });
  // A KEPT IMAGE STANDS AGAIN WITH NO BUILD: a revision whose `rev-<12 hex>` tag still stands takes the tag back (the outgoing
  // image keeps its own tag first), and `--prior` names the newest kept image the tag does not hold now.
  test(`${name}: rebuild-takes-a-kept-image: a kept rev tag at the revision takes the tag (no build); --prior reads the newest kept image before the one that stands; none kept refuses before anything moves`, async () => {
    const kept = await run(shim, ["rebuild", "--image", "--at", "HEAD"], { checkout: "clean", env: { ...MOUNTS, FAKE_IMAGE_REV_LABEL: "0123456789abcdef0123456789abcdef01234567", FAKE_OUTGOING_REV: "0123456789abcdef0123456789abcdef01234567", FAKE_KEPT_LABEL: "@HEAD@", FAKE_IMAGE_ID: "sha256:new" } });
    assert.equal(kept.status, 0, kept.stderr);
    assert.doesNotMatch(kept.calls, / build /);
    const lines = kept.calls.split("\n");
    const outgoing = lines.findIndex((l) => /^tag lares-surface:local lares-surface:rev-0123456789ab$/.test(l));
    const back = lines.findIndex((l) => /^tag lares-surface:rev-[0-9a-f]{12} lares-surface:local$/.test(l));
    assert.ok(outgoing >= 0 && back > outgoing, `the outgoing image keeps its tag, then the kept one takes the tag:\n${kept.calls}`);
    assert.match(kept.stderr, /now holds the kept image lares-surface:rev-[0-9a-f]{12}; no build/);
    const prior = await run(shim, ["rebuild", "--image", "--prior"], { checkout: "clean", env: { ...MOUNTS, FAKE_IMAGE_ID: "sha256:new", FAKE_IMAGE_TAGS: "local\nrev-@HEAD12@\nrev-bbbbbbbbbbbb", FAKE_TAG_INFO: "rev-@HEAD12@ 2026-11-19T00:00:00Z sha256:old\nrev-bbbbbbbbbbbb 2026-11-20T00:00:00Z sha256:new", FAKE_KEPT_LABEL: "@HEAD@", FAKE_IMAGE_REV_LABEL: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" } });
    assert.equal(prior.status, 0, prior.stderr);
    assert.match(prior.calls, /^tag lares-surface:rev-[0-9a-f]{12} lares-surface:local$/m);
    const reading = JSON.parse(prior.stdout.trim().split("\n").at(-1));
    assert.match(reading.revision, /^[0-9a-f]{40}$/);
    assert.equal(reading.how, "kept");
    const none = await run(shim, ["rebuild", "--prior"], { checkout: "clean", env: { ...MOUNTS, FAKE_IMAGE_TAGS: "local" } });
    assert.equal(none.status, 2);
    assert.match(none.stderr, /rebuild --prior finds no kept image before the one lares-surface:local holds/);
    assert.doesNotMatch(none.calls, / build |^tag |down --remove-orphans|up -d --wait lares/m);
  });
  test(`${name}: rebuild-image-prints-the-reading: --image makes the image and prints one JSON line on stdout (where the house stands), moving no vessel`, async () => {
    const r = await run(shim, ["rebuild", "--image"], { checkout: "clean", env: { ...STANDING, FAKE_IMAGE_ID: "sha256:new", FAKE_VESSEL_IMAGE: "sha256:old" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, / build /);
    assert.doesNotMatch(r.calls, /vessel census --no-json|down --remove-orphans|up -d --wait lares/);
    const out = r.stdout.trim().split("\n");
    assert.equal(out.length, 1, r.stdout);
    const reading = JSON.parse(out[0]);
    assert.match(reading.revision, /^[0-9a-f]{40}$/);
    assert.deepEqual({ ...reading, revision: "R" }, { op: "rebuild-image", revision: "R", image: "sha256:new", how: "built", vessel: "standing", current: false, pulama: "off", lit: null, admitted: null, offer: false });
  });

  test(`${name}: the usage line names build and rebuild`, async () => {
    const r = await run(shim, [], { env: MOUNTS });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /usage: lares-container\.(sh|ps1) [^\n]*\|build\|rebuild\|/);
    assert.match(r.stderr, /build builds the vessel image, every package, from a commit; rebuild is the restand `lares rite kukulu` walks/);
    const head = await readFile(shim, "utf8");
    assert.match(head, /rebuild \[--at <rev> \| --prior\] \[--image\]/, "the shim's head names the rebuild verb");
    assert.match(head, /lares rite kukulu/);
    assert.doesNotMatch(head, /rebuild --resume|rebuild-pending/, "no file remembers a half-done run");
  });

  test(`${name}: no argv carries the docker socket`, async () => {
    for (const argv of [["up"], ["found"], ["vessel", "read"]]) {
      assert.doesNotMatch((await run(shim, argv, { env: MOUNTS })).calls, /docker\.sock/);
    }
  });
}

// A LONE SIGNAL TO THE SHIM: docker forwards none to an exec'd process and a killed `compose run` client leaves its
// container running (tests/host-bridge-real-docker.test.ts measured it), so the shim's own stop must run on a TERM,
// HUP or QUIT sent to its pid alone. The fake docker sleeps on the act and logs every call, the stop among them.
async function loneSignal(shim, sig, { standing }) {
  const dir = await mkdtemp(join(tmpdir(), "lares-container-sig-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\n` +
      `case " $* " in *" ps -q --status running lares "*) printf '%s' "\${FAKE_RUNNING_ID:-}"; exit 0;; esac\n` +
      `case " $* " in *" sh -c "*|*" stop "*|*" rm -f "*) exit 0;; esac\n` +
      `case " $* " in *" exec "*|*" run "*) echo $$ > "$CALL_LOG.pid"; exec sleep 30;; esac\nexit 0\n`);
    await chmod(join(dir, "docker"), 0o755);
    const compose = join(dir, "docker-compose.surface.yml");
    await writeFile(compose, "services: {}\n");
    const home = join(dir, "home");
    await mkdir(join(home, ".lares"), { recursive: true });
    const env = { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: home, LARES_COMPOSE_FILE: compose,
      LARES_HOUSE: join(dir, "house"), LARES_WORKSPACE: "/w", ...(standing ? { FAKE_RUNNING_ID: "cid" } : {}) };
    const cmd = shim === SH ? ["sh", [shim, "persona", "list"]] : ["pwsh", ["-NoProfile", "-File", shim, "persona", "list"]];
    const child = spawn(cmd[0], cmd[1], { env, stdio: "ignore" });
    const ended = new Promise((r) => child.on("exit", (code, signal) => r({ code, signal })));
    let pid = 0;
    for (let i = 0; i < 200 && !pid; i++) {
      try { pid = Number((await readFile(`${log}.pid`, "utf8")).trim()); } catch { await new Promise((r) => setTimeout(r, 50)); }
    }
    assert.ok(pid > 0, "the fake act never started");
    await new Promise((r) => setTimeout(r, 300));
    process.kill(child.pid, sig);
    const exit = await Promise.race([ended, new Promise((r) => setTimeout(() => r({ code: "hung", signal: null }), 20_000))]);
    await new Promise((r) => setTimeout(r, 300));
    let alive = true;
    try { process.kill(pid, 0); } catch { alive = false; }
    if (alive) process.kill(pid, "SIGKILL");
    if (exit.code === "hung") child.kill("SIGKILL");
    return { exit, alive, calls: await readFile(log, "utf8") };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

const CODE = { SIGTERM: 143, SIGHUP: 129, SIGQUIT: 131 };
for (const [name, shim] of shims) {
  for (const sig of ["SIGTERM", "SIGHUP"]) {
    test(`${name}: a lone ${sig} to the shim stops the tagged vessel process and leaves no compose client`, async () => {
      const { exit, alive, calls } = await lone(shim, sig, true);
      assert.ok(exit.signal === sig || exit.code === CODE[sig], JSON.stringify(exit));
      assert.equal(alive, false, "the fake compose client outlived the shim");
      assert.match(calls, new RegExp(`exec -T lares sh -c .* stop ${sig.slice(3)} [0-9a-f]{16}`));
    });
  }
  test(`${name}: a lone SIGTERM over the offline door stops and removes the named run container`, async () => {
    const { exit, alive, calls } = await lone(shim, "SIGTERM", false);
    assert.ok(exit.signal === "SIGTERM" || exit.code === 143, JSON.stringify(exit));
    assert.equal(alive, false);
    assert.match(calls, /stop -t 10 lares-offline-[0-9a-f]{16}/);
    assert.match(calls, /rm -f lares-offline-[0-9a-f]{16}/);
  });
}
async function lone(shim, sig, standing) { return loneSignal(shim, sig, { standing }); }

// ── THE PŪLAMA (road L47e): the house's custody holder standing in its own container beside the vessel ──
const PULAMA_ENV = "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=@HOUSE@/ws\nLARES_PULAMA=1\n";
for (const [name, shim, skip] of [["sh", SH, false], ["ps1", PS1, !havePwsh]]) {
test(`${name}: pulama-mode up stands the pūlama first, reports the image digest to it, then raises the vessel over its socket`, { skip }, async () => {
  const r = await run(shim, ["up"], { envFile: PULAMA_ENV, env: { FAKE_IMAGE_ID: "sha256:abc123" } });
  assert.equal(r.status, 0, r.stderr);
  const lines = r.calls.split("\n");
  const pul = lines.findIndex((l) => /--profile pulama up -d --no-recreate pulama/.test(l));
  const img = lines.findIndex((l) => /exec -T pulama node packages\/lararium-node\/dist\/src\/pulama-main\.js image sha256:abc123/.test(l));
  const ves = lines.findIndex((l) => /up -d --wait lares/.test(l));
  assert.ok(pul >= 0 && img > pul && ves > img, `order pūlama, digest, vessel:\n${r.calls}`);
});
test(`${name}: pulama-mode up reads the image's offered seed one-shot (no house mounted) and reports the whole frame; a read that prints nothing falls back to the bare digest`, { skip }, async () => {
  const frame = '{"digest":"sha256:abc123","seed":"seed bafkseed offered; the founding record reads at boot"}';
  const r = await run(shim, ["up"], { envFile: PULAMA_ENV, env: { FAKE_IMAGE_ID: "sha256:abc123", FAKE_SEED_FRAME: frame } });
  assert.equal(r.status, 0, r.stderr);
  const read = r.calls.split("\n").find((l) => / vessel floor seed /.test(l));
  assert.ok(read, r.calls);
  assert.match(read, /^run --rm -e LAR_ROOT=\/lar \S+ node packages\/lares-cli\/bin\/lares\.mjs vessel floor seed --genesis \/app\/genesis --image sha256:abc123$/);
  assert.doesNotMatch(read, / -v /, "the one-shot mounts no house");
  assert.ok(r.calls.includes(`pulama-main.js image ${frame}`), `the frame reaches the pūlama whole:\n${r.calls}`);
  const bare = await run(shim, ["up"], { envFile: PULAMA_ENV, env: { FAKE_IMAGE_ID: "sha256:abc123" } });
  assert.equal(bare.status, 0, bare.stderr);
  assert.match(bare.calls, /pulama-main\.js image sha256:abc123$/m);
});
test(`${name}: lei-hand-door-chain: under a pūlama, lei kui reads the terms in the vessel, the pūlama signs on this terminal, and the vessel lands the answer; a refused signing lands nothing`, { skip }, async () => {
  const terms = '{"face":1,"rite":"push","branch":"feature/x","returns":3,"after":null}';
  const answer = '{"op":"lei","reading":"signed","face":1,"record":{"body":{"act":"lei"}}}';
  const r = await run(shim, ["lei", "kui", "--rite", "push", "--branch", "feature/x", "--returns", "3"], { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_LEI_TERMS: terms, FAKE_LEI_ANSWER: answer } });
  assert.equal(r.status, 0, r.stdout);
  const lines = r.calls.split("\n");
  const read = lines.findIndex((l) => /exec (?:-e \S+ )*-T lares node \S+ lei terms kui --rite push --branch feature\/x --returns 3$/.test(l));
  // A captured stdout makes compose drop the pty, so the signing exec forces one: the route reads on the operator's terminal.
  const sign = lines.findIndex((l) => l.includes(`--profile pulama exec --no-TTY=false pulama node packages/lararium-node/dist/src/pulama-main.js lei kui ${terms}`));
  // The pūlama prints its answer as an indented object, as a pty carries it (CRLF): the shim lands the whole object.
  const land = lines.findIndex((l) => l.includes("lei land "));
  assert.ok(land >= 0, r.calls);
  assert.deepEqual(JSON.parse(lines[land].slice(lines[land].indexOf("lei land ") + "lei land ".length)), JSON.parse(answer), "the landed answer reads as the whole signed object");
  assert.ok(read >= 0 && sign > read && land > sign, `order terms, sign (attached), land:\n${r.calls}`);
  const refused = await run(shim, ["lei", "kui", "--rite", "push", "--branch", "feature/x"], { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_LEI_TERMS: terms } });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stdout, /the pūlama signed nothing; nothing lands/);
  assert.doesNotMatch(refused.calls, /lei land/);
  const noTty = await run(shim, ["lei", "kui", "--rite", "push", "--branch", "feature/x"], { envFile: PULAMA_ENV, env: { FAKE_RUNNING_ID: "cid", FAKE_LEI_TERMS: terms, FAKE_LEI_ANSWER: answer } });
  assert.notEqual(noTty.status, 0);
  assert.match(noTty.stderr, /lei under a pūlama reads its route on a terminal/);
  const plain = await run(shim, ["lei", "show", "--rite", "push", "--branch", "x"], { envFile: PULAMA_ENV, env: { FAKE_RUNNING_ID: "cid" } });
  assert.match(plain.calls, /lares node \S+ lei show --rite push --branch x/);
  assert.doesNotMatch(plain.calls, /pulama-main\.js lei/);
});
test(`${name}: rite-abandon-hand-door-chain: under a pūlama, rite abandon reads its terms in the vessel, the pūlama signs the marks on this terminal as the hand, and the vessel lands them; no terminal signs nothing; a signing that answers nothing lands nothing`, { skip }, async () => {
  const terms = '{"face":0,"rite":"kukulu","branch":"main","parts":[{"tessera":"' + "c".repeat(64) + '","group":"g","branch":"main"}]}';
  const answer = '{"op":"lei","act":"abandon","reading":"signed","face":0,"records":[{"body":{"act":"rite-abandoned"}}]}';
  const r = await run(shim, ["rite", "abandon", "--rite", "kukulu", "--branch", "main"], { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_ABANDON_TERMS: terms, FAKE_LEI_ANSWER: answer } });
  assert.equal(r.status, 0, r.stdout);
  const lines = r.calls.split("\n");
  const read = lines.findIndex((l) => /exec (?:-e \S+ )*-T lares node \S+ rite abandon --terms --rite kukulu --branch main$/.test(l));
  const sign = lines.findIndex((l) => l.includes(`--profile pulama exec --no-TTY=false pulama node packages/lararium-node/dist/src/pulama-main.js lei abandon ${terms}`));
  const land = lines.findIndex((l) => l.includes("rite abandon --signed "));
  assert.ok(read >= 0 && sign > read && land > sign, `order terms, sign (attached), land:\n${r.calls}`);
  assert.deepEqual(JSON.parse(lines[land].slice(lines[land].indexOf("--signed ") + "--signed ".length, lines[land].lastIndexOf(" --rite"))), JSON.parse(answer));
  const noTty = await run(shim, ["rite", "abandon", "--rite", "kukulu", "--branch", "main"], { envFile: PULAMA_ENV, env: { FAKE_RUNNING_ID: "cid", FAKE_ABANDON_TERMS: terms, FAKE_LEI_ANSWER: answer } });
  assert.notEqual(noTty.status, 0);
  assert.match(noTty.stderr, /an abandon under a pūlama reads its route on a terminal/);
  assert.doesNotMatch(noTty.calls, /pulama-main\.js lei/);
  const refused = await run(shim, ["rite", "abandon", "--rite", "kukulu", "--branch", "main"], { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_ABANDON_TERMS: terms } });
  assert.notEqual(refused.status, 0);
  assert.doesNotMatch(refused.calls, /rite abandon --signed/);
});
// THE FIFTH READ: terms the vessel refuses (none of this face's own, an unlent face) ask no route; an answer that reads anything
// but signed lands nothing.
test(`${name}: rite-abandon-chain-asks-nothing-it-cannot-sign: terms the vessel refuses never reach the pūlama; a pūlama answer that is not signed never lands`, { skip }, async () => {
  const terms = '{"face":0,"rite":"kukulu","branch":"main","parts":[{"tessera":"' + "c".repeat(64) + '","group":"g","branch":"main","begun":"' + "d".repeat(64) + '"}]}';
  const refused = await run(shim, ["rite", "abandon", "--rite", "kukulu", "--branch", "main"], { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_ABANDON_TERMS: "", FAKE_ABANDON_TERMS_RC: "2", FAKE_LEI_ANSWER: '{"op":"lei","act":"abandon","reading":"signed","records":[]}' } });
  assert.notEqual(refused.status, 0);
  assert.doesNotMatch(refused.calls, /pulama-main\.js lei|rite abandon --signed/);
  const unsigned = await run(shim, ["rite", "abandon", "--rite", "kukulu", "--branch", "main"], { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_ABANDON_TERMS: terms, FAKE_LEI_ANSWER: '{"op":"lei","act":"abandon","reading":"abandon-other-group","face":0}' } });
  assert.notEqual(unsigned.status, 0);
  assert.match(unsigned.calls, /pulama-main\.js lei abandon/);
  assert.doesNotMatch(unsigned.calls, /rite abandon --signed/);
  assert.match(unsigned.stdout, /the pūlama signed nothing \(abandon-other-group\); nothing lands/);
});
// THE CHAIN END TO END (the fourth read): the terms ride as the vessel CLI's own answer (its envelope, as `emitAnswer` writes it),
// the pūlama's own `lei` verb reads them, and the shim lands what it answers: the shapes cannot drift apart unseen.
test(`${name}: rite-abandon-chain-walks-the-real-shapes: the CLI's terms answer, through the shim, reaches the pūlama's own lei verb as a face and its parts, and the vessel lands the marks it signs`, { skip }, async () => {
  const { emitAnswer } = await import(join(ROOT, "packages/lares-cli/dist/src/render.js"));
  const { parseArgs } = await import(join(ROOT, "packages/lares-cli/dist/src/parse-args.js"));
  const data = { face: 0, rite: "kukulu", branch: "main", parts: [{ tessera: "c".repeat(64), group: "g0", branch: "main", begun: "d".repeat(64) }] };
  let text = "";
  const write = process.stdout.write;
  process.stdout.write = (chunk) => { text += String(chunk); return true; };
  try { emitAnswer(parseArgs(["rite", "abandon", "--terms"]), { ok: true, data, human: () => {} }, "terms"); } finally { process.stdout.write = write; }
  const hand = [
    `const { runHandVerb } = await import(${JSON.stringify(join(ROOT, "packages/lararium-node/dist/src/pulama-verbs.js"))});`,
    "const [act, terms] = process.argv.slice(1);",
    "const out = await runHandVerb('lei', [act, terms], { route: async () => 'a route', ask: async (f) => f.op === 'status' ? { op: 'status', lit: true }",
    "  : Number.isInteger(f.face) && Array.isArray(f.parts) && f.parts.length > 0 ? { op: 'lei', act: f.act, reading: 'signed', face: f.face, records: f.parts.map((p) => ({ body: { act: 'rite-abandoned', tessera: p.tessera, begun: p.begun } })) }",
    "  : { op: 'lei', reading: 'lei-malformed' } });",
    "console.log(JSON.stringify(out, null, 2));",
  ].join("\n");
  const r = await run(shim, ["rite", "abandon", "--rite", "kukulu", "--branch", "main"], { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_ABANDON_TERMS: text.trim(), FAKE_REAL_HAND_VERB: hand } });
  assert.equal(r.status, 0, r.stdout);
  const land = r.calls.split("\n").find((l) => l.includes("rite abandon --signed ")) ?? "";
  const answer = JSON.parse(land.slice(land.indexOf("--signed ") + "--signed ".length, land.lastIndexOf(" --rite")));
  assert.equal(answer.reading, "signed", land);
  assert.deepEqual(answer.records.map((x) => x.body.begun), ["d".repeat(64)]);
});
test(`${name}: pulama-keep-seat-writes-the-seat: the pūlama's seat line lands verbatim as config/keep-seat.json (0600), the signer never shown; an existing seat refuses without --reseat; a refusal writes nothing`, { skip }, async () => {
  const seat = { publicKey: "ab".repeat(32), stretchSalt: "11".repeat(16), tree: { slots: [{ kind: "passphrase", salt: "s1" }] }, verifyKey: "cd".repeat(32) };
  const signer = "ef".repeat(32);
  const line = JSON.stringify({ op: "keep-seat", reading: "seated", seat, signer });
  const env = (house) => ({ FAKE_KEEP_SEAT_LINE: line, LARES_HOUSE_PROBE: house });
  const r = await run(shim, ["pulama", "keep-seat"], { envFile: PULAMA_ENV, tty: "", env: env("") });
  assert.equal(r.status, 0, r.stdout);
  assert.doesNotMatch(r.stdout + (r.stderr ?? ""), new RegExp(signer), "the signer never shows");
  // A captured stdout makes compose drop the pty, so the exec forces one: the route reads on the operator's terminal.
  assert.match(r.calls, /--profile pulama exec --no-TTY=false pulama node packages\/lararium-node\/dist\/src\/pulama-main\.js keep-seat/);
  assert.match(r.stdout, /type it, then Enter/, "the shim's own line stands as the prompt the capture swallows");
  assert.deepEqual(r.seat, JSON.parse(line), "the line lands verbatim: the house CLI reads it whole");
  assert.equal(r.seatMode, 0o600);
  const again = await run(shim, ["pulama", "keep-seat"], { envFile: PULAMA_ENV, tty: "", env: env(""), keepSeat: r.seat });
  assert.notEqual(again.status, 0);
  assert.match(again.stdout, /a keep seat already rests/);
  assert.doesNotMatch(again.calls, /keep-seat/);
  const refused = await run(shim, ["pulama", "keep-seat"], { envFile: PULAMA_ENV, tty: "", env: { FAKE_KEEP_SEAT_LINE: JSON.stringify({ op: "keep-seat", reading: "refused", code: "pulama-unlit", message: "light it first" }), FAKE_KEEP_SEAT_RC: "1" } });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stdout, /pulama-unlit/);
  const noTty = await run(shim, ["pulama", "keep-seat"], { envFile: PULAMA_ENV, env: { FAKE_KEEP_SEAT_LINE: line } });
  assert.notEqual(noTty.status, 0);
  assert.match(noTty.stderr, /reads its route on a terminal/);
});
// RE-WEAR AFTER A STAND: the worn face lives in the vessel's process memory, so a re-stand under a pūlama can hold the key
// with faces lent and none worn. The shim reads the mount (the census frame's `worn`), not the key alone, and wears the
// face last worn through it.
const NONE_WORN_JSON = '{"ok":true,"data":{"clean":true,"items":[],"unanswered":[],"facesLit":[0,2],"worn":null}}';
const WORN_JSON = '{"ok":true,"data":{"clean":true,"items":[],"unanswered":[],"facesLit":[0,2],"worn":2}}';
const KEY_HELD = '{"ok":true,"data":{"door":{"op":"custody","unlocked":true}}}';
test(`${name}: rewear-after-up: under a pūlama, a held key with faces lent and none worn wears the face last worn; a worn face draws no wear`, { skip }, async () => {
  const r = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: 2, env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: KEY_HELD, FAKE_CENSUS_JSON: NONE_WORN_JSON } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls, /exec (?:-e \S+ )*-T lares node \S+ vessel census --json/);
  assert.match(r.calls, /exec (?:-e \S+ )*-T lares node \S+ wear 2$/m);
  assert.match(r.stderr, /faces stand lent and none worn; wearing h2, the face last worn/);
  const worn = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: 2, env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: KEY_HELD, FAKE_CENSUS_JSON: WORN_JSON } });
  assert.equal(worn.status, 0, worn.stderr);
  assert.doesNotMatch(worn.calls, / wear 2$/m);
});
test(`${name}: rewear-after-vault-unlock: under a pūlama, an unlock that names no face and leaves none worn wears the face last worn`, { skip }, async () => {
  const r = await run(shim, ["vault", "unlock", "--all"], { envFile: PULAMA_ENV, wornFace: 1, env: { FAKE_RUNNING_ID: "cid", FAKE_CENSUS_JSON: NONE_WORN_JSON } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls, /vault unlock --all[\s\S]*vessel census --json[\s\S]*-T lares node \S+ wear 1$/m);
});
// AN EMPTY MEMORY TELLS THE PŪLAMA NOTHING. A `wear` writes the pūlama's `face.worn`, which it wears again after every
// restart: a house whose config/last-worn-face reads empty sends no `wear 0` (a face it never saw worn), so the vessel's
// own mount stands, and the shim says so.
test(`${name}: empty-worn-face-tells-the-pulama-nothing: a held key over none worn, and an unlock under a pūlama, send no wear when no face rests remembered`, { skip }, async () => {
  const held = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: "", env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: KEY_HELD, FAKE_CENSUS_JSON: NONE_WORN_JSON } });
  assert.equal(held.status, 0, held.stderr);
  assert.match(held.calls, /vessel census --json/);
  assert.doesNotMatch(held.calls, / wear \d+$/m);
  assert.match(held.stderr, /faces stand lent and none worn, and no face rests remembered \(config\/last-worn-face reads empty\); the shim wears none/);
  const shut = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: "", env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":false}}}' } });
  assert.equal(shut.status, 0, shut.stderr);
  assert.match(shut.calls, /-T lares node \S+ vault unlock --all/);
  assert.doesNotMatch(shut.calls, / wear \d+$/m);
  assert.match(shut.stderr, /no face rests remembered \(config\/last-worn-face reads empty\), so the shim wears none and the vessel's own mount stands/);
  const bare = await run(shim, ["vault", "unlock", "--all"], { envFile: PULAMA_ENV, env: { FAKE_RUNNING_ID: "cid", FAKE_CENSUS_JSON: NONE_WORN_JSON } });
  assert.equal(bare.status, 0, bare.stderr);
  assert.doesNotMatch(bare.calls, / wear \d+$/m);
});
// THE UNLOCK'S FACE REACHES THE PŪLAMA. The pūlama keeps the face worn in its memory (`standing.worn`) and re-wears it
// after a restart, and only `wear` writes it, never the unlock: an unlock naming --face N that landed draws `wear N`,
// so the pūlama's memory and `config/last-worn-face` name one face. A refused unlock wears nothing.
test(`${name}: unlock-face-tells-the-pulama: under a pūlama, a vault unlock --face N that lands follows with wear N; a refused one wears nothing`, { skip }, async () => {
  for (const argv of [["vault", "unlock", "--face", "2"], ["vault", "unlock", "--face=2"]]) {
    const named = await run(shim, argv, { envFile: PULAMA_ENV, wornFace: 1, env: { FAKE_RUNNING_ID: "cid", FAKE_CENSUS_JSON: WORN_JSON } });
    assert.equal(named.status, 0, named.stderr);
    assert.match(named.calls, /vault unlock --face(?: |=)2[\s\S]*-T lares node \S+ wear 2$/m, argv.join(" "));
    assert.equal(named.worn, "2");
  }
  const refused = await run(shim, ["vault", "unlock", "--face", "2"], { envFile: PULAMA_ENV, wornFace: 1, env: { FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "1" } });
  assert.notEqual(refused.status, 0);
  assert.doesNotMatch(refused.calls, / wear \d+$/m);
  assert.equal(refused.worn, "1");
});
test(`${name}: CONTROL a house without LARES_PULAMA stands the vessel alone, and names no pūlama`, { skip }, async () => {
  const r = await run(shim, ["up"], { envFile: "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=@HOUSE@/ws\n" });
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.calls, /pulama/);
});
test(`${name}: pulama-follows-the-house: the env file's LARES_PULAMA=1 names its own house's pūlama, so a LARES_HOUSE naming another house stands that vessel alone and says so; CONTROL the env file's own house stands with its pūlama, and LARES_PULAMA in the environment speaks for any house`, { skip }, async () => {
  const other = await run(shim, ["up"], { envFile: PULAMA_ENV, env: { LARES_HOUSE: "@HOUSE@-next", FAKE_IMAGE_ID: "sha256:abc123" } });
  assert.equal(other.status, 0, other.stderr);
  assert.doesNotMatch(other.calls, /pulama|LAR_PULAMA_SOCKET|LAR_KUKULU_OFFER/);
  assert.match(other.stderr, /LARES_PULAMA=1 in .* names the pūlama of .*; this house \(.*-next\) holds its own custody/);
  const own = await run(shim, ["up"], { envFile: PULAMA_ENV, env: { FAKE_IMAGE_ID: "sha256:abc123" } });
  assert.equal(own.status, 0, own.stderr);
  assert.match(own.calls, /pulama/);
  const named = await run(shim, ["up"], { envFile: PULAMA_ENV, env: { LARES_HOUSE: "@HOUSE@-next", LARES_PULAMA: "1", FAKE_IMAGE_ID: "sha256:abc123" } });
  assert.equal(named.status, 0, named.stderr);
  assert.match(named.calls, /pulama/);
});
test(`${name}: kukulu-offer-path: pulama mode hands the vessel the offer file's path inside the config bind`, { skip }, async () => {
    const r = await run(shim, ["up"], { envFile: PULAMA_ENV, env: { FAKE_IMAGE_ID: "sha256:abc123" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /LAR_KUKULU_OFFER=\/lar\/config\/kukulu-offer\.json/);
  });
  test(`${name}: down-leaves-pulama-standing: with a pūlama running, down stops and removes the vessel alone`, { skip }, async () => {
  const r = await run(shim, ["down"], { envFile: PULAMA_ENV, env: { FAKE_PULAMA_ID: "p1" } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls, /stop lares/);
  assert.match(r.calls, /rm -f lares/);
  assert.doesNotMatch(r.calls, / down /);
});
test(`${name}: route-stays-out-of-the-vessel: under a pūlama, a stand on a terminal never attaches the vessel's unlock`, { skip: skip || !haveScript }, async () => {
  const locked = '{"ok":true,"data":{"door":{"op":"custody","unlocked":false}}}';
  const r = await run(shim, ["up"], { envFile: PULAMA_ENV, tty: "", env: { FAKE_IMAGE_ID: "sha256:abc123", FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: locked } });
  assert.equal(r.status, 0, r.stdout);
  const unlocks = r.calls.split("\n").filter((l) => / vault unlock/.test(l));
  assert.ok(unlocks.length > 0, `the stand ran no unlock:\n${r.calls}`);
  for (const line of unlocks) assert.match(line, / -T /, `an unlock reached the vessel attached:\n${line}`);
  const asked = await run(shim, ["vault", "unlock", "--face", "1"], { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid" } });
  assert.equal(asked.status, 0, asked.stdout);
  assert.match(asked.calls, /exec (?:-e \S+ )*-T lares node \S+ vault unlock --face 1/);
});
test(`${name}: CONTROL with no pūlama, a stand on a terminal still attaches the unlock for the operator's route`, { skip: skip || !haveScript }, async () => {
  const locked = '{"ok":true,"data":{"door":{"op":"custody","unlocked":false}}}';
  const r = await run(shim, ["up"], { envFile: "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=@HOUSE@/ws\n", tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: locked } });
  assert.equal(r.status, 0, r.stdout);
  const unlock = r.calls.split("\n").find((l) => / vault unlock --all/.test(l));
  assert.ok(unlock && !/ -T /.test(unlock), `the unlock should attach:\n${r.calls}`);
});
test(`${name}: pulama-admit-reaches-the-hand-door: admit forwards to the pūlama's own verb, as light does`, { skip }, async () => {
  const admit = await run(shim, ["pulama", "admit"], { envFile: PULAMA_ENV });
  assert.equal(admit.status, 0, admit.stderr);
  assert.match(admit.calls, /--profile pulama exec (-T )?pulama node packages\/lararium-node\/dist\/src\/pulama-main\.js admit/);
  const face = await run(shim, ["pulama", "admit", "2"], { envFile: PULAMA_ENV });
  assert.equal(face.status, 0, face.stderr);
  assert.match(face.calls, /pulama-main\.js admit 2/);
  const bad = await run(shim, ["pulama", "burn"], { envFile: PULAMA_ENV });
  assert.match(bad.stderr, /pulama takes up, down, restand, light, admit, unadmit, keep-seat, lock, status or tessera/);
});
test(`${name}: pulama-unadmit-reaches-the-hand-door: unadmit forwards one image digest to the pūlama's own verb; a bare or malformed digest refuses and sends nothing`, { skip }, async () => {
  const digest = "sha256:" + "ab".repeat(32);
  const ok = await run(shim, ["pulama", "unadmit", digest], { envFile: PULAMA_ENV });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.calls, new RegExp(`--profile pulama exec (-T )?pulama node packages/lararium-node/dist/src/pulama-main\\.js unadmit ${digest}`));
  for (const argv of [["pulama", "unadmit"], ["pulama", "unadmit", "not-a-digest"]]) {
    const bad = await run(shim, argv, { envFile: PULAMA_ENV });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /pulama unadmit takes one image digest \(sha256:<64 hex>\)/);
    assert.doesNotMatch(bad.calls, /unadmit/);
  }
});
test(`${name}: down-reads-the-pulama-whatever-the-flag: a running pūlama keeps the hearth lit through down, even where LARES_PULAMA no longer reads 1`, { skip }, async () => {
  const r = await run(shim, ["down"], { envFile: "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=@HOUSE@/ws\n", env: { FAKE_PULAMA_ID: "p1" } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls, /stop lares/);
  assert.doesNotMatch(r.calls, / down /);
});
test(`${name}: down-refuses-a-pulama-unknown: a failed ps for the pūlama stops nothing`, { skip }, async () => {
  const r = await run(shim, ["down"], { envFile: PULAMA_ENV, env: { FAKE_PULAMA_PS_RC: "1" } });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /whether the pūlama stands reads unknown/);
  assert.doesNotMatch(r.calls, / down |stop lares/);
});
test(`${name}: down-carries-its-options-beside-a-pulama: the vessel's stop takes down's options`, { skip }, async () => {
  const r = await run(shim, ["down", "--timeout", "5"], { envFile: PULAMA_ENV, env: { FAKE_PULAMA_ID: "p1" } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls, /stop --timeout 5 lares/);
});
test(`${name}: pulama-skew-names-the-old-image: up and pulama status name a pūlama running another image than the one that stands, and point at pulama restand; one image names nothing`, { skip }, async () => {
  const skewed = { FAKE_IMAGE_ID: "sha256:new", FAKE_PULAMA_ID: "p1", FAKE_PULAMA_IMAGE: "sha256:old" };
  const up = await run(shim, ["up"], { envFile: PULAMA_ENV, env: skewed });
  assert.equal(up.status, 0, up.stderr);
  assert.match(up.calls, /inspect --format \{\{\.Image\}\} p1/);
  assert.match(up.stderr, /the pūlama runs image sha256:old, and lares-surface:local stands at sha256:new/);
  assert.match(up.stderr, /pulama restand/);
  const status = await run(shim, ["pulama", "status"], { envFile: PULAMA_ENV, env: skewed });
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stderr, /the pūlama runs image sha256:old, and lares-surface:local stands at sha256:new/);
  assert.match(status.calls, /pulama-main\.js status/);
  // L6: ONE LINE NAMES THE PŪLAMA'S IMAGE BESIDE THE VESSEL'S, level as well as skewed; it names no restand when level.
  const level = { FAKE_IMAGE_ID: "sha256:new", FAKE_PULAMA_ID: "p1", FAKE_PULAMA_IMAGE: "sha256:new" };
  for (const argv of [["up"], ["pulama", "status"]]) {
    const r = await run(shim, argv, { envFile: PULAMA_ENV, env: level });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /the pūlama runs image sha256:new, and lares-surface:local stands at the same sha256:new$/m);
    assert.doesNotMatch(r.stderr, /stands at( \(|$)/m, "the level line names the id the tag stands at, never an empty one");
    assert.doesNotMatch(r.stderr, /pulama restand/);
  }
  // A vessel standing joins the line by its own image.
  const beside = await run(shim, ["pulama", "status"], { envFile: PULAMA_ENV, env: { ...skewed, FAKE_RUNNING_ID: "cid", FAKE_VESSEL_IMAGE: "sha256:mid" } });
  assert.match(beside.stderr, /the pūlama runs image sha256:old, and lares-surface:local stands at sha256:new \(the vessel runs sha256:mid\)/);
  const levelUp = await run(shim, ["up"], { envFile: PULAMA_ENV, env: { ...level, FAKE_RUNNING_ID: "cid", FAKE_VESSEL_IMAGE: "sha256:new", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":true}}}' } });
  assert.match(levelUp.stderr, /the pūlama runs image sha256:new, and lares-surface:local stands at the same sha256:new \(the vessel runs sha256:new\)/);
  assert.ok(levelUp.calls.indexOf("up -d --wait lares") < levelUp.calls.lastIndexOf("inspect --format {{.Image}} p1"), "up names the images once the vessel stands");
  // No pūlama running, or a pūlama inspect that fails, names nothing and never blocks the act.
  const none = await run(shim, ["pulama", "status"], { envFile: PULAMA_ENV, env: { FAKE_IMAGE_ID: "sha256:new" } });
  assert.doesNotMatch(none.stderr, /the pūlama runs image/);
  const blind = await run(shim, ["pulama", "status"], { envFile: PULAMA_ENV, env: { ...skewed, FAKE_PULAMA_INSPECT_RC: "1" } });
  assert.equal(blind.status, 0, blind.stderr);
  assert.doesNotMatch(blind.stderr, /the pūlama runs image/);
});
test(`${name}: pulama-skew-reads-the-closure: a pūlama on an older image whose code closure matches the new image's stands as lit, no restand named; a moved or unlabeled closure names the restand`, { skip }, async () => {
  const c = (h) => "sha256:" + h.repeat(64);
  const same = { FAKE_IMAGE_ID: "sha256:new", FAKE_PULAMA_ID: "p1", FAKE_PULAMA_IMAGE: "sha256:old", FAKE_IMAGE_CLOSURE: c("a"), FAKE_PULAMA_CLOSURE: c("a") };
  for (const argv of [["up"], ["pulama", "status"]]) {
    const r = await run(shim, argv, { envFile: PULAMA_ENV, env: same });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /the pūlama runs image sha256:old, and lares-surface:local stands at sha256:new; its code closure reads the same \(sha256:aaaaaaaaaaaa\), so it stands lit and owes no restand/);
    assert.doesNotMatch(r.stderr, /pulama restand/);
  }
  const moved = await run(shim, ["pulama", "status"], { envFile: PULAMA_ENV, env: { ...same, FAKE_IMAGE_CLOSURE: c("b") } });
  assert.match(moved.stderr, /its code closure moved[\s\S]*pulama restand/);
  const unlabeled = await run(shim, ["pulama", "status"], { envFile: PULAMA_ENV, env: { ...same, FAKE_PULAMA_CLOSURE: "" } });
  assert.match(unlabeled.stderr, /pulama restand/);
});
// L7 UNDER A PŪLAMA, FOLDED UNDER `lares rite kukulu`: the restand reads the pūlama each run. A moved closure re-stands it
// and lights it ATTACHED on this terminal in the same run; a lit pūlama on a closure that stands stays lit; the admit asks
// the route only where no admission and no kūkulu offer carries the image; with no terminal, a light or an admit owed stops
// the run before anything moves, and a day that owes neither flows through.
const CL = (h) => "sha256:" + h.repeat(64);
const REBUILT = { FAKE_PULAMA_ID: "p1", FAKE_PULAMA_IMAGE: "sha256:old", FAKE_IMAGE_ID: "sha256:new", FAKE_IMAGE_REV_LABEL: "0123456789abcdef0123456789abcdef01234567", FAKE_CUSTODY_OUTPUT: '{"ok":true,"data":{"door":{"op":"custody","unlocked":true}}}', FAKE_CENSUS_JSON: '{"ok":true,"data":{"facesLit":[0,2],"worn":null}}' };
const OFFER = { "config/kukulu-offer.json": '{"lei":[],"unstrung":[],"vouch":[{"body":{"image":"sha256:new"}}]}\n' };
const ADMITTED = '{"op":"status","lit":true,"admitted":["sha256:new"],"ended":[]}';
test(`${name}: rebuild-lights-a-moved-closure-in-the-same-run: on a terminal, build, down, pulama restand, the light attached, up, the admit attached, unlock, wear, one closing line`, { skip: skip || !haveScript }, async () => {
  const r = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, tty: "", checkout: "clean", wornFace: 2, env: { ...REBUILT, FAKE_IMAGE_CLOSURE: CL("b"), FAKE_PULAMA_CLOSURE: CL("a") } });
  assert.equal(r.status, 0, r.stdout);
  const lines = r.calls.split("\n");
  const at = (re) => lines.findIndex((l) => re.test(l));
  const build = at(/ build /), stop = at(/ stop lares$|down --remove-orphans/), lock = at(/pulama-main\.js lock$/), recreate = at(/up -d --force-recreate pulama/), light = at(/pulama-main\.js light$/), up = at(/up -d --wait lares/), admit = at(/pulama-main\.js admit$/), unlock = at(/ vault unlock --all$/), wear = at(/ wear 2$/);
  assert.ok(build >= 0 && stop > build && lock > stop && recreate > lock && light > recreate && up > light && admit > up && unlock > admit && wear > unlock, `order build, down, lock, recreate, light, up, admit, unlock, wear:\n${r.calls}`);
  assert.doesNotMatch(lines[light], / -T /, "the light reads the route on this terminal");
  assert.doesNotMatch(lines[admit], / -T /, "the admit reads the route on this terminal");
  assert.match(r.stdout, /the pūlama's code closure moved; the pūlama lights on this terminal/);
  assert.match(r.stdout, /the house stands on revision 0123456789ab, wearing h2/);
  assert.doesNotMatch(r.stdout, /rebuild --resume|light it by hand/);
});
test(`${name}: rebuild-stops-before-the-down-with-no-terminal: a moved closure, an unlit pūlama, or an image neither admitted nor offered names the hand act and moves nothing`, { skip }, async () => {
  for (const [env, why] of [
    [{ ...REBUILT, FAKE_IMAGE_CLOSURE: CL("b"), FAKE_PULAMA_CLOSURE: CL("a") }, /the pūlama's code closure moved, and its light reads your route on a terminal; your hand: lares rite kukulu on a terminal/],
    [{ ...REBUILT, FAKE_IMAGE_CLOSURE: CL("a"), FAKE_PULAMA_CLOSURE: CL("a"), FAKE_PULAMA_STATUS: '{"op":"status","lit":false}' }, /the pūlama stands unlit, and its light reads your route on a terminal; your hand: lares rite kukulu on a terminal/],
    [{ ...REBUILT, FAKE_IMAGE_CLOSURE: CL("a"), FAKE_PULAMA_CLOSURE: CL("a") }, /the pūlama has not admitted this image and no kūkulu offer carries it[\s\S]*your hand: lares rite kukulu on a terminal/],
  ]) {
    const r = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, checkout: "clean", env: { ...env, FAKE_RUNNING_ID: "vessel" } });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /rebuild stops before anything moves/);
    assert.match(r.stderr, why);
    assert.doesNotMatch(r.calls, / stop lares|down --remove-orphans|--force-recreate|pulama-main\.js (lock|light|admit)|up -d --wait lares|vault unlock/);
  }
});
test(`${name}: rebuild-flows-with-no-terminal-where-no-route-is-owed: a kūkulu offer naming the image, or an admission of it, raises the vessel with no admit; unlock and wear run detached`, { skip }, async () => {
  for (const [houseFiles, env] of [[OFFER, {}], [{}, { FAKE_PULAMA_STATUS: ADMITTED }]]) {
    const r = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, checkout: "clean", wornFace: 2, houseFiles, env: { ...REBUILT, ...env, FAKE_IMAGE_CLOSURE: CL("a"), FAKE_PULAMA_CLOSURE: CL("a") } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /--force-recreate|pulama-main\.js (lock|light|admit)/);
    assert.match(r.calls, /up -d --wait lares[\s\S]* vault unlock --all\n[\s\S]* wear 2/);
    assert.match(r.stderr, /the house stands on revision 0123456789ab, wearing h2/);
  }
});
// A CTRL+C AT THE ADMIT (gate 2) leaves the vessel standing on the image at the floor, the image unadmitted and no offer carrying
// it. The next run reads that house: the vessel stays, and the admit it never took is owed again, never a bare unlock that fails.
const FLOOR = '{"ok":true,"data":{"door":{"op":"custody","unlocked":false}}}';
test(`${name}: rebuild-owes-the-admit-a-ctrl-c-left: a vessel on the image at the floor, the image neither admitted nor offered, owes the admit (no terminal: the hand act, nothing moves); CONTROL: a vessel that holds its key, or an offer naming the image, owes none`, { skip }, async () => {
  const stays = { ...REBUILT, FAKE_IMAGE_REV_LABEL: "@HEAD@", FAKE_RUNNING_ID: "vessel", FAKE_VESSEL_IMAGE: "sha256:new", FAKE_IMAGE_CLOSURE: CL("a"), FAKE_PULAMA_CLOSURE: CL("a") };
  const r = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, checkout: "clean", env: { ...stays, FAKE_CUSTODY_OUTPUT: FLOOR } });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /rebuild stops before anything moves: the pūlama has not admitted this image and no kūkulu offer carries it[\s\S]*your hand: lares rite kukulu on a terminal/);
  assert.doesNotMatch(r.calls, /down --remove-orphans|up -d --wait lares|pulama-main\.js admit/);
  for (const [env, houseFiles] of [[{}, {}], [{ FAKE_CUSTODY_OUTPUT: FLOOR }, OFFER]]) {
    const ok = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, checkout: "clean", houseFiles, env: { ...stays, ...env } });
    assert.equal(ok.status, 0, ok.stderr);
    assert.doesNotMatch(ok.calls, /pulama-main\.js admit/);
    assert.match(ok.stderr, /the vessel runs sha256:new already and stays standing/);
  }
});
test(`${name}: rebuild-owes-the-admit-a-ctrl-c-left, on a terminal: the stayed vessel's admit runs attached, then the unlock`, { skip: skip || !haveScript }, async () => {
  const r = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, tty: "", checkout: "clean", env: { ...REBUILT, FAKE_IMAGE_REV_LABEL: "@HEAD@", FAKE_RUNNING_ID: "vessel", FAKE_VESSEL_IMAGE: "sha256:new", FAKE_IMAGE_CLOSURE: CL("a"), FAKE_PULAMA_CLOSURE: CL("a"), FAKE_CUSTODY_OUTPUT: FLOOR } });
  const lines = r.calls.split("\n");
  const admit = lines.findIndex((l) => /pulama-main\.js admit$/.test(l)), unlock = lines.findIndex((l) => / vault unlock/.test(l));
  assert.ok(admit >= 0 && unlock > admit, `order admit, unlock:\n${r.calls}`);
  assert.doesNotMatch(r.calls, /down --remove-orphans|up -d --wait lares/);
});
test(`${name}: rebuild-keeps-a-lit-pulama-on-a-vessel-only-build: no restand, no light; up, the pūlama's admit on this terminal, the last face worn, one closing line`, { skip: skip || !haveScript }, async () => {
  const r = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, tty: "", checkout: "clean", wornFace: 2, env: { ...REBUILT, FAKE_IMAGE_CLOSURE: CL("a"), FAKE_PULAMA_CLOSURE: CL("a") } });
  assert.equal(r.status, 0, r.stdout);
  assert.doesNotMatch(r.calls, /--force-recreate|pulama-main\.js (lock|light)/);
  const lines = r.calls.split("\n");
  const up = lines.findIndex((l) => /up -d --wait lares/.test(l));
  const admit = lines.findIndex((l) => /pulama-main\.js admit$/.test(l));
  const unlock = lines.findIndex((l) => / vault unlock --all$/.test(l));
  const wear = lines.findIndex((l) => / wear 2$/.test(l));
  assert.ok(up >= 0 && admit > up && unlock > admit && wear > unlock, `order up, admit, unlock, wear:\n${r.calls}`);
  assert.doesNotMatch(lines[admit], / -T /, "the admit reads the route on this terminal");
  assert.match(lines[unlock], / -T /, "the vessel's unlock reads nothing");
  assert.match(r.stdout, /the house stands on revision 0123456789ab, wearing h2; keep: /);
});
test(`${name}: rebuild-picks-up-where-the-house-stands: after a stop, the image at HEAD builds nothing and a pūlama re-stood but unlit lights on this terminal, then up, admit, wear; a light that does not take raises nothing`, { skip: skip || !haveScript }, async () => {
  const resumed = { ...REBUILT, FAKE_IMAGE_REV_LABEL: "@HEAD@", FAKE_PULAMA_IMAGE: "sha256:new", FAKE_PULAMA_STATUS: '{"op":"status","lit":false}' };
  const r = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, tty: "", checkout: "clean", wornFace: 2, env: { ...resumed, FAKE_PULAMA_STATUS_AFTER: '{"op":"status","lit":true}' } });
  assert.equal(r.status, 0, r.stdout);
  assert.doesNotMatch(r.calls, / build |--force-recreate|pulama-main\.js lock/);
  assert.match(r.calls, /pulama-main\.js light\n[\s\S]*up -d --wait lares[\s\S]*pulama-main\.js admit[\s\S]* wear 2/);
  assert.match(r.stdout, /the pūlama stands unlit; the pūlama lights on this terminal/);
  const dark = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, tty: "", checkout: "clean", env: resumed });
  assert.notEqual(dark.status, 0);
  assert.match(dark.stdout, /the pūlama did not light \(above\); run `lares rite kukulu` again on a terminal, and it picks up from here/);
  assert.doesNotMatch(dark.calls, /up -d --wait lares|pulama-main\.js admit/);
});
test(`${name}: rebuild-reads-the-pulama-into-the-reading: --image names the pūlama's closure, whether it stands lit, whether it admitted the image, and whether a kūkulu offer carries it`, { skip }, async () => {
  const r = await run(shim, ["rebuild", "--image"], { envFile: PULAMA_ENV, checkout: "clean", houseFiles: OFFER, env: { ...REBUILT, FAKE_IMAGE_CLOSURE: CL("a"), FAKE_PULAMA_CLOSURE: CL("a"), FAKE_PULAMA_STATUS: ADMITTED } });
  assert.equal(r.status, 0, r.stderr);
  const reading = JSON.parse(r.stdout.trim().split("\n").at(-1));
  assert.deepEqual({ pulama: reading.pulama, lit: reading.lit, admitted: reading.admitted, offer: reading.offer, vessel: reading.vessel }, { pulama: "closure-level", lit: true, admitted: true, offer: true, vessel: "down" });
  const moved = await run(shim, ["rebuild", "--image"], { envFile: PULAMA_ENV, checkout: "clean", env: { ...REBUILT, FAKE_IMAGE_CLOSURE: CL("b"), FAKE_PULAMA_CLOSURE: CL("a") } });
  assert.equal(JSON.parse(moved.stdout.trim().split("\n").at(-1)).pulama, "moved");
});
test(`${name}: pulama-restand-recreates-on-the-current-image: it locks a running pūlama, recreates it with --force-recreate, and names it unlit (light by hand, then up and pulama admit); it never lights or admits`, { skip }, async () => {
  const r = await run(shim, ["pulama", "restand"], { envFile: PULAMA_ENV, env: { FAKE_PULAMA_ID: "p1", FAKE_IMAGE_ID: "sha256:new" } });
  assert.equal(r.status, 0, r.stderr);
  const lines = r.calls.split("\n");
  const lock = lines.findIndex((l) => /--profile pulama exec -T pulama node packages\/lararium-node\/dist\/src\/pulama-main\.js lock$/.test(l));
  const recreate = lines.findIndex((l) => /--profile pulama up -d --force-recreate pulama$/.test(l));
  assert.ok(lock >= 0 && recreate > lock, `order lock, recreate:\n${r.calls}`);
  assert.doesNotMatch(r.calls, /--no-recreate/);
  assert.doesNotMatch(r.calls, /pulama-main\.js (light|admit|image)/, "restand reads no route and reports no image");
  assert.match(r.stderr, /stands unlit on sha256:new/);
  assert.match(r.stderr, /pulama light/);
  assert.match(r.stderr, /then `?(tools\/lares-container\.(sh|ps1) )?up`?/);
  assert.match(r.stderr, /pulama admit/);
  // A pūlama that stands stopped holds no key: nothing to lock, and it recreates.
  const stopped = await run(shim, ["pulama", "restand"], { envFile: PULAMA_ENV, env: { FAKE_IMAGE_ID: "sha256:new" } });
  assert.equal(stopped.status, 0, stopped.stderr);
  assert.doesNotMatch(stopped.calls, /pulama-main\.js lock/);
  assert.match(stopped.calls, /--profile pulama up -d --force-recreate pulama/);
});
test(`${name}: pulama-restand-refuses-beside-a-vessel: a standing vessel, an unknown vessel or pūlama, an argument, or a refused lock recreate nothing`, { skip }, async () => {
  const standing = await run(shim, ["pulama", "restand"], { envFile: PULAMA_ENV, env: { FAKE_RUNNING_ID: "cid", FAKE_PULAMA_ID: "p1" } });
  assert.notEqual(standing.status, 0);
  assert.match(standing.stderr, /pulama restand refuses while the lares vessel stands; run `?(tools\/lares-container\.(sh|ps1) )?down`? first/);
  const unknown = await run(shim, ["pulama", "restand"], { envFile: PULAMA_ENV, env: { FAKE_PS_RC: "1", FAKE_PULAMA_ID: "p1" } });
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /pulama restand refuses: .*reads unknown/);
  const pUnknown = await run(shim, ["pulama", "restand"], { envFile: PULAMA_ENV, env: { FAKE_PULAMA_PS_RC: "1" } });
  assert.notEqual(pUnknown.status, 0);
  assert.match(pUnknown.stderr, /pulama restand refuses: .*reads unknown/);
  const extra = await run(shim, ["pulama", "restand", "now"], { envFile: PULAMA_ENV });
  assert.notEqual(extra.status, 0);
  assert.match(extra.stderr, /pulama restand takes no arguments/);
  const refused = await run(shim, ["pulama", "restand"], { envFile: PULAMA_ENV, env: { FAKE_PULAMA_ID: "p1", FAKE_EXEC_RC: "1" } });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /the pūlama refused the lock; nothing recreated/);
  for (const r of [standing, unknown, pUnknown, extra, refused]) {
    assert.doesNotMatch(r.calls, /--force-recreate/);
    assert.doesNotMatch(r.calls, /pulama-main\.js (light|admit)/);
  }
});
test(`${name}: pulama light reaches the pūlama's hand verb, and pulama down stops it`, { skip }, async () => {
  const light = await run(shim, ["pulama", "light"], { envFile: PULAMA_ENV });
  assert.equal(light.status, 0, light.stderr);
  assert.match(light.calls, /--profile pulama exec (-T )?pulama node packages\/lararium-node\/dist\/src\/pulama-main\.js light/);
  const down = await run(shim, ["pulama", "down"], { envFile: PULAMA_ENV });
  assert.equal(down.status, 0, down.stderr);
  assert.match(down.calls, /--profile pulama stop pulama/);
  const bad = await run(shim, ["pulama", "burn"], { envFile: PULAMA_ENV });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /pulama takes/);
});
}

// THE PŪLAMA'S CODE CLOSURE (tools/pulama-closure.mjs): a vessel-only change keeps the digest; a change the pūlama reaches moves it.
test("pulama-closure: a vessel-only change keeps the digest; a module the entry imports, or a workspace package it imports, moves it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pulama-closure-"));
  try {
    await plantPulamaTree(dir);
    const digest = () => { const r = spawnSync("node", [join(ROOT, "tools/pulama-closure.mjs"), dir], { encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
    const first = digest();
    assert.match(first, /^sha256:[0-9a-f]{64}$/);
    await writeFile(join(dir, "packages/lararium-node/src/main.ts"), "export const vessel = 99;\n");
    await writeFile(join(dir, "packages/lararium-web/src/index.ts"), "export const w = 99;\n");
    assert.equal(digest(), first, "the vessel's own code and a package the pūlama never imports leave the closure");
    await writeFile(join(dir, "packages/lararium-node/src/pulama-a.ts"), "export const a = 2;\n");
    const moved = digest();
    assert.notEqual(moved, first, "a module the entry imports moves it");
    await writeFile(join(dir, "packages/lararium-mesh/src/index.ts"), "export const m = 3;\n");
    assert.notEqual(digest(), moved, "a workspace package the entry imports moves it");
    const list = spawnSync("node", [join(ROOT, "tools/pulama-closure.mjs"), dir, "--list"], { encoding: "utf8" }).stdout;
    assert.match(list, /  packages\/lararium-node\/src\/pulama-main\.ts$/m);
    assert.doesNotMatch(list, /  packages\/lararium-node\/src\/main\.ts$/m, "the vessel's entry rides outside the closure");
    const none = spawnSync("node", [join(ROOT, "tools/pulama-closure.mjs"), tmpdir()], { encoding: "utf8" });
    assert.notEqual(none.status, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// THE LABEL MOVES WHEN WHAT THE PŪLAMA RUNS MOVES: comments, the package modules it never imports, and the lock's other
// dependencies leave it; code it runs and a dependency it loads move it.
test("pulama-closure: comments, an unreached module of a reached package, an unreached package and an unloaded dependency keep the digest; code it runs and a loaded dependency move it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pulama-closure-"));
  try {
    await plantPulamaTree(dir);
    const put = async (rel, text) => { await mkdir(join(dir, rel, ".."), { recursive: true }); await writeFile(join(dir, rel), text); };
    await put("packages/lararium-mesh/package.json", '{"name":"@lararium/mesh","exports":{".":{"import":"./dist/index.js"}}}\n');
    await put("packages/lararium-mesh/src/index.ts", 'import { l } from "left-pad";\n// the mesh barrel\nexport const m = l + 2; // two\nexport const re = /a\\/\\//.test("a//") ? `x ${1} // not a comment` : "// kept";\n');
    await put("packages/lararium-mesh/src/unused.ts", "export const u = 1;\n");
    await put("packages/lararium-node/package.json", '{"name":"@lararium/node","dependencies":{"@lararium/mesh":"workspace:*"}}\n');
    const lock = (leftPad, other) => `lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies:\n      other:\n        specifier: ${other}\n        version: ${other}\n\n  packages/lararium-mesh:\n    dependencies:\n      left-pad:\n        specifier: ${leftPad}\n        version: ${leftPad}\n\npackages:\n\n  left-pad@${leftPad}:\n    resolution: {integrity: sha512-a}\n\n  other@${other}:\n    resolution: {integrity: sha512-b}\n\nsnapshots:\n\n  left-pad@${leftPad}: {}\n\n  other@${other}: {}\n`;
    await put("pnpm-lock.yaml", lock("1.0.0", "2.0.0"));
    const digest = () => { const r = spawnSync("node", [join(ROOT, "tools/pulama-closure.mjs"), dir], { encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
    const first = digest();
    await put("packages/lararium-mesh/src/index.ts", 'import { l } from "left-pad";\n/* a longer note\n   over two lines */\nexport const m = l + 2;\nexport const re = /a\\/\\//.test("a//") ? `x ${1} // not a comment` : "// kept"; // trailing\n');
    assert.equal(digest(), first, "a comment-only edit in a reached file keeps the label");
    await put("packages/lararium-mesh/src/unused.ts", "export const u = 99;\n");
    assert.equal(digest(), first, "an edit in a module of a reached package that nothing the pūlama imports reads keeps the label");
    await put("packages/lararium-web/src/index.ts", "export const w = 99;\n");
    await put("pnpm-lock.yaml", lock("1.0.0", "3.0.0"));
    assert.equal(digest(), first, "an edit in a package the pūlama never imports, and a lock change in a dependency it never loads, keep the label");
    await put("packages/lararium-mesh/src/index.ts", 'import { l } from "left-pad";\nexport const m = l + 3;\nexport const re = /a\\/\\//.test("a//") ? `x ${1} // not a comment` : "// kept";\n');
    const ran = digest();
    assert.notEqual(ran, first, "an edit to code the pūlama runs moves the label");
    await put("packages/lararium-mesh/src/index.ts", 'import { l } from "left-pad";\nexport const m = l + 3;\nexport const re = /a\\/\\//.test("a//") ? `x ${1} // not a comment` : "// moved";\n');
    assert.notEqual(digest(), ran, "a string that holds `//` is code, never a comment");
    await put("pnpm-lock.yaml", lock("1.1.0", "3.0.0"));
    assert.notEqual(digest(), ran, "a lock change to a dependency the pūlama loads moves the label");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
