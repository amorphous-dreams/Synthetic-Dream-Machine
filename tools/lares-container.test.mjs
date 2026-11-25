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
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SH = join(ROOT, "tools/lares-container.sh");
const PS1 = join(ROOT, "tools/lares-container.ps1");
const havePwsh = spawnSync("pwsh", ["-NoProfile", "-Command", "1"]).status === 0;

/**
 * THIS SUITE'S OWN HOST CHAIN, read the way the shim's `host_chain_kind` reads it (hitl-reads-a-hand): every shim this suite
 * runs descends from this process, so where a harness stands above the suite every act the shim runs carries the seat mark.
 * `run` folds that mark out of the recorded calls unless the case sets CLAUDECODE itself or asks for the raw calls
 * (`rawSeat`), so a run inside a harness reads as CI does; the seat-mark cases read the raw calls against this reading.
 */
function suiteChainKind() {
  const named = (n) => { const b = n.slice(n.lastIndexOf("/") + 1); return b === "claude" || b.startsWith("codex"); };
  const read = (path) => { try { return readFileSync(path, "utf8"); } catch { return null; } };
  for (let at = process.pid, n = 0; at > 0; n += 1) {
    if (n >= 64) return "unknown";
    const stat = read(`/proc/${at}/stat`);
    if (stat === null) return "unknown";
    const env = (read(`/proc/${at}/environ`) ?? "").split("\0");
    if (env.some((e) => e === "CLAUDECODE=1" || /^CODEX_SANDBOX(_NETWORK_DISABLED)?=.+/.test(e))) return "ai";
    if (named(stat.slice(stat.indexOf("(") + 1, stat.lastIndexOf(")")))) return "ai";
    if ((read(`/proc/${at}/cmdline`) ?? "").split("\0").slice(0, 2).some((a) => a !== "" && named(a))) return "ai";
    const ppid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
    if (!Number.isSafeInteger(ppid)) return "unknown";
    at = ppid;
  }
  return "hand";
}
const SUITE_SEAT = suiteChainKind() !== "hand";
const HAVE_UNSHARE = spawnSync("unshare", ["-U", "--map-current-user", "-p", "-f", "--mount-proc", "true"]).status === 0;

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
  // THE LOCAL WITNESS (ruling 2026-11-25-web2-annotates): a planted bench gate that names its call and writes the verdict a test
  // scripts (FAKE_BENCH green · red · none), over the tree it runs in, as `node tools/bench-gate.mjs --verdict <file>` does.
  await put("tools/bench-gate.mjs", `import { appendFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const a = process.argv.slice(2);
appendFileSync(process.env.CALL_LOG, "BENCH " + a.join(" ") + "\\n");
const how = process.env.FAKE_BENCH ?? "green";
const git = (r) => execFileSync("git", ["rev-parse", r], { encoding: "utf8" }).trim();
const code = how === "red" ? 1 : 0;
const line = code ? "BENCH GATE REFUSES: build (exit 1) · 4 s" : "BENCH GATE GREEN at " + git("HEAD").slice(0, 9) + " over develop - · 4 steps · 4 s";
if (how !== "none") writeFileSync(a[a.indexOf("--verdict") + 1], JSON.stringify({ kind: "lares-bench-verdict", v: 1, rev: git("HEAD"), tree: git("HEAD^{tree}"), code, line, steps: [{ name: "build", code, secs: 4 }], secs: 4 }));
console.log(line);
process.exit(code);
`);
}

async function run(shim, argv, { env = {}, envFile, envAt = "hearth", tty, checkout, wornFace, keepSeat, houseFiles = {}, viaHarnessShell = false, rawSeat = false, hostInput, input, refuseInput = false, hostName = "host.mem", hostSibling, fifo = false, hostCwd = false, origin = false, sync, readFiles = [] } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "lares-container-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\n[ -z "\${LAR_KUKULU_OFFER:-}" ] || printf 'LAR_KUKULU_OFFER=%s\\n' "$LAR_KUKULU_OFFER" >> "$CALL_LOG"\n` +
      `for a in "$@"; do case "$a" in -f) :;; *override*|/tmp/*) [ -f "$a" ] && cat "$a" >> "$CALL_LOG";; esac; done\n` +
      `case " $* " in *" down --remove-orphans"*|*" stop "*lares*) : > "$CALL_LOG.down";; esac\n` +
      `case " $* " in *" ps -q --status running lares "*) printf '%s' "\${FAKE_RUNNING_ID:-}"; exit "\${FAKE_PS_RC:-0}";; esac\n` +
      `case " $* " in *" ps -q --status paused lares "*) printf '%s' "\${FAKE_PAUSED_ID:-}"; exit "\${FAKE_PS_RC:-0}";; esac\n` +
      `case " $* " in *" ps -q --status restarting lares "*) printf '%s' "\${FAKE_RESTARTING_ID:-}"; exit "\${FAKE_PS_RC:-0}";; esac\n` +
      `case " $* " in *" ps -q --status running pulama "*) printf '%s' "\${FAKE_PULAMA_ID:-}"; exit "\${FAKE_PULAMA_PS_RC:-0}";; esac\n` +
      // THE SUCCESSOR KEEPER (the keeper tally): the second keeper service, and its container's closure label.
      `case " $* " in *" ps -q --status running pulama-b "*) if [ -e "$CALL_LOG.b" ] || [ -n "\${FAKE_PULAMA_B_RUNNING:-}" ]; then [ -e "$CALL_LOG.stopb" ] || printf '%s' "\${FAKE_PULAMA_B_ID:-}"; fi; exit 0;; esac\n` +
      `case " $* " in *" stop pulama-b"*) : > "$CALL_LOG.stopb";; esac\n` +
      `case " $* " in *" exec -T pulama-b node "*"pulama-main.js status"*) printf '%s\\n' "\${FAKE_PULAMA_B_STATUS:-{\\"op\\":\\"status\\",\\"lit\\":false,\\"fire\\":false}}"; exit 0;; esac\n` +
      `case " $* " in *" up -d --force-recreate pulama-b "*) : > "$CALL_LOG.b"; exit 0;; esac\n` +
      `last=''; for a in "$@"; do last=$a; done\n` +
      // THE OUTGOING IMAGE (L4): its id and its revision label, one line, before a build moves the tag.
      `case " $* " in *"image inspect --format {{.Id}}|"*) [ -n "\${FAKE_NO_OUTGOING:-}" ] && exit 1; printf '%s|%s\\n' "\${FAKE_IMAGE_ID:-sha256:feedface}" "\${FAKE_OUTGOING_REV:-}"; exit 0;; esac\n` +
      `case " $* " in *"image inspect --format {{.Created}} {{.Id}} "*) printf '%s\\n' "\${FAKE_TAG_INFO:-}" | awk -v t="\${last#*:}" '$1==t{print $2" "$3}'; exit 0;; esac\n` +
      `case " $* " in *" image ls --format {{.Tag}} "*) printf '%s\\n' "\${FAKE_IMAGE_TAGS:-}"; exit 0;; esac\n` +
      `case " $* " in *" ps -q --filter ancestor="*) id=\${last#ancestor=}; case " \${FAKE_RUNNING_IMAGES:-} " in *" $id "*) printf 'c1\\n';; esac; exit 0;; esac\n` +
      // THE PŪLAMA'S CODE CLOSURE: the image's label, and the label the running pūlama's container carries.
      `case " $* " in *"lares.pulama.closure"*) case " $* " in *"image inspect"*) printf '%s\\n' "\${FAKE_IMAGE_CLOSURE:-}";; *) if [ -n "\${FAKE_PULAMA_B_ID:-}" ] && [ "$last" = "\${FAKE_PULAMA_B_ID}" ]; then printf '%s\\n' "\${FAKE_IMAGE_CLOSURE:-}"; else printf '%s\\n' "\${FAKE_PULAMA_CLOSURE:-}"; fi;; esac; exit 0;; esac\n` +
      // A KEPT IMAGE (`<repo>:rev-<12 hex>`): its id, where a test names one apart from the tag's; its revision label, where a
      // test names one; none stands otherwise.
      `case " $* " in *"image inspect --format {{.Id}} "*":rev-"*) if [ -n "\${FAKE_KEPT_ID:-}" ]; then printf '%s\\n' "\${FAKE_KEPT_ID}"; exit 0; fi;; esac\n` +
      `case " $* " in *"image inspect"*"org.opencontainers.image.revision"*":rev-"*) [ -n "\${FAKE_KEPT_LABEL:-}" ] || exit 1; printf '%s\\n' "\${FAKE_KEPT_LABEL}"; exit 0;; esac\n` +
      // The vessel's own image (FAKE_VESSEL_IMAGE) reads FAKE_VESSEL_REV_LABEL where a test names one; every other image the tag's label.
      `case " $* " in *"image inspect"*"org.opencontainers.image.revision"*) if [ -n "\${FAKE_VESSEL_REV_LABEL:-}" ] && [ "$last" = "\${FAKE_VESSEL_IMAGE:-}" ]; then printf '%s\\n' "\${FAKE_VESSEL_REV_LABEL}"; exit 0; fi;; esac\n` +
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
      `case " $* " in *"pulama-main.js keeper-offer"*) printf '%s\\n' '{"op":"keeper-offer","reading":"offered","to":"${"ab".repeat(32)}"}'; exit 0;; esac\n` +
      `case " $* " in *"pulama-main.js keeper-vest"*) printf '%s\\n' "\${FAKE_VEST_ANSWER:-}"; exit "\${FAKE_VEST_RC:-0}";; esac\n` +
      `case " $* " in *"pulama-main.js keeper-receive"*) printf '%s\\n' "\${FAKE_RECEIVE_ANSWER:-{\\"reading\\":\\"landed\\"}}"; exit "\${FAKE_RECEIVE_RC:-0}";; esac\n` +
      `case " $* " in *"pulama-main.js status"*) lit='{"op":"status","lit":true}'; if [ -e "$CALL_LOG.lit" ] && [ -n "\${FAKE_PULAMA_STATUS_AFTER:-}" ]; then printf '%s\\n' "\${FAKE_PULAMA_STATUS_AFTER}"; else printf '%s\\n' "\${FAKE_PULAMA_STATUS-$lit}"; fi; exit 0;; esac\n` +
      // THE KUKULU LEI on a branch, as the standing vessel's `lei show --json` answers it (the kūkulu reading reads it).
      `case " $* " in *" lei show --rite kukulu "*) printf '%s\\n' "\${FAKE_LEI_SHOW:-}"; exit 0;; esac\n` +
      `case " $* " in *" nexus publish plugins "*" --terms "*) printf '%s\\n' "\${FAKE_PUBLISH_TERMS:-}"; exit "\${FAKE_TERMS_RC:-0}";; esac\n` +
      `case " $* " in *"pulama-main.js publish "*) case " $* " in *" exec --no-TTY=false pulama "*) ;; *) printf '%s\\n' '[pulama] an offering reads its route from a real terminal alone'; exit 1;; esac; printf '%s\\r\\n' 'pūlama route, to sign the plugin offering: '; [ -z "\${FAKE_PUBLISH_ANSWER:-}" ] || printf '%s\\n' "\${FAKE_PUBLISH_ANSWER}" | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2).split("\\n").join("\\r\\n")+"\\r\\n"))'; exit "\${FAKE_PUBLISH_RC:-0}";; esac\n` +
      // A KAHUA HAND ACT's terms (read on a pty: the preview's digest types back there) and the pūlama's `sign` (attached).
      `case " $* " in *" kahua "*" --terms "*) case " $* " in *" exec --no-TTY=false "*) ;; *) printf '%s\\n' '[lares kahua] the digest reads on a terminal alone'; exit 1;; esac; printf '%s\\r\\n' 'lift preview — T'; printf '%s\\r\\n' "\${FAKE_KAHUA_TERMS:-}"; exit "\${FAKE_TERMS_RC:-0}";; esac\n` +
      `case " $* " in *"pulama-main.js sign "*) case " $* " in *" exec --no-TTY=false pulama "*) ;; *) printf '%s\\n' '[pulama] a signing reads its route from a real terminal alone'; exit 1;; esac; printf '%s\\r\\n' 'pūlama route, to sign a kahua lift: '; [ -z "\${FAKE_SIGN_ANSWER:-}" ] || printf '%s\\n' "\${FAKE_SIGN_ANSWER}"; exit "\${FAKE_SIGN_RC:-0}";; esac\n` +
      `case " $* " in *" lei terms "*) printf '%s\\n' "\${FAKE_LEI_TERMS:-}"; exit "\${FAKE_TERMS_RC:-0}";; esac\n` +
      `case " $* " in *" rite receipts "*) printf '%s\\n' "\${FAKE_RECEIPTS:-}"; exit "\${FAKE_RECEIPTS_RC:-0}";; esac\n` +
      `case " $* " in *"pulama-main.js lei "*) case " $* " in *" exec --no-TTY=false pulama "*) ;; *) printf '%s\\n' '[pulama] a lei reads its route from a real terminal alone'; exit 1;; esac; printf '%s\\r\\n' 'pūlama route, to kui a push lei: '; [ -z "\${FAKE_LEI_ANSWER:-}" ] || printf '%s\\n' "\${FAKE_LEI_ANSWER}" | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2).split("\\n").join("\\r\\n")+"\\r\\n"))'; exit "\${FAKE_LEI_RC:-0}";; esac\n` +
      `case " $* " in *" vessel floor seed "*) [ -z "\${FAKE_SEED_FRAME:-}" ] || printf '%s\\n' "\${FAKE_SEED_FRAME}"; printf '%s\\n' 'rebuild chatter' >&2; exit "\${FAKE_SEED_RC:-0}";; esac\n` +
      `case " $* " in *" --observe --json "*) printf '%s\\n' "\${FAKE_OBSERVE_OUTPUT:-}"; exit "\${FAKE_OBSERVE_RC:-0}";; esac\n` +
      `case " $* " in *" intent show "*) printf '%s\\n' "\${FAKE_INTENT_SHOW:-}"; exit 0;; esac\n` +
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
      // THE VESSEL'S LIVE LOG (its tmpfs /lar/run/vessel-live.log): one JSON line per event change, as the sink writes them.
      `case " $* " in *" exec "*"/lar/run/vessel-live.log"*) [ -z "\${FAKE_VESSEL_LIVE:-}" ] || printf '%s\\n' "\${FAKE_VESSEL_LIVE}"; exit "\${FAKE_LIVE_RC:-0}";; esac\n` +
      `case " $* " in *" up -d --wait lares "*) [ "\${FAKE_UP_RC:-0}" = 0 ] || printf '%s\\n' 'compose readiness failed' >&2; exit "\${FAKE_UP_RC:-0}";; esac\n` +
      (refuseInput ? `case " $* " in *" tiddler put "*) printf "lares tiddler put: usage refusal\\n" >&2; exit 2;; esac\n` : "") +
      `case " $* " in *" tiddler put "*" --file - "*|*" tiddler put "*" --file=- "*|*" tiddler put "*" --append - "*|*" tiddler put "*" --append=- "*|*" spirit "*" --file - "*) cat > "$CALL_LOG.stdin";; esac\n` +
      // A WEAR the vessel answers as a test scripts (its prose and its exit); unscripted, it answers as any exec does.
      `case " $* " in *" wear "*) if [ -n "\${FAKE_WEAR_OUT:-}" ]; then printf '%s\\n' "\${FAKE_WEAR_OUT}" >&2; exit "\${FAKE_WEAR_RC:-0}"; fi;; esac\n` +
      `case " $* " in *" exec "*) exit "\${FAKE_EXEC_RC:-0}";; esac\n`);
    await chmod(join(dir, "docker"), 0o755);
    // The host's own build answers through pnpm: the fake names each call and fails where a test asks it to.
    await writeFile(join(dir, "pnpm"), `#!/bin/sh\nprintf 'PNPM %s\\n' "$*" >> "$CALL_LOG"\nexit "\${FAKE_PNPM_RC:-0}"\n`);
    await chmod(join(dir, "pnpm"), 0o755);
    // THE CI READ (the keeper lei's spend): gh answers the `--jq` line a test scripts, `<run id>:<status>:<conclusion>`.
    await writeFile(join(dir, "gh"), `#!/bin/sh\n[ -z "\${FAKE_NO_GH:-}" ] || exit 127\nprintf 'GH %s\\n' "$*" >> "$CALL_LOG"\nprintf '%s\\n' "\${FAKE_GH_RUN:-}"\nexit "\${FAKE_GH_RC:-0}"\n`);
    await chmod(join(dir, "gh"), 0o755);
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
      // THE FLOOR rides beside the shim too (mandate/floor-gate-1): an image build takes the floor lock through battery.sh's
      // lock path and floor-lock's ancestor read, as it does in the checkout.
      await writeFile(join(repo, "tools", "battery.sh"), await readFile(join(ROOT, "tools", "battery.sh"), "utf8"));
      await writeFile(join(repo, "tools", "floor-lock.mjs"), await readFile(join(ROOT, "tools", "floor-lock.mjs"), "utf8"));
      // "pulama": a clean checkout that carries a pūlama entry, so a build reads its code closure.
      if (checkout === "pulama") await plantPulamaTree(repo);
      gitEnv.GIT_CEILING_DIRECTORIES = dir;
      if (checkout !== "none") {
        const git = (...a) => spawnSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf8" });
        git("init", "-q"); git("add", "."); git("commit", "-qm", "seed");
        // `origin`: the revision reads as fetched from origin/develop (the keeper lei's reach).
        if (origin) git("update-ref", "refs/remotes/origin/develop", "HEAD");
        // `sync`: what the rite's fast-forward reads (`syncPlan`'s input): a detached head, or a branch following `up` with commits
        // behind it (outside the closure) and ahead of it, and a tracked edit uncommitted.
        if (sync?.branch === "HEAD") git("checkout", "-q", "--detach");
        else if (sync?.upstream) {
          git("branch", "up"); git("branch", "-q", "--set-upstream-to=up");
          for (let n = 0; n < sync.behind; n++) { git("checkout", "-q", "up"); await writeFile(join(repo, `upstream-${n}.txt`), `${n}\n`); git("add", "."); git("commit", "-qm", `up ${n}`); git("checkout", "-q", "-"); }
          for (let n = 0; n < sync.ahead; n++) { await writeFile(join(repo, `local-${n}.txt`), `${n}\n`); git("add", "."); git("commit", "-qm", `local ${n}`); }
          if (sync.dirty) await writeFile(join(repo, "tools", "pulama-closure.mjs"), (await readFile(join(repo, "tools", "pulama-closure.mjs"), "utf8")) + "\n// edited\n");
        }
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
    if (hostInput !== undefined) await writeFile(join(dir, hostName), hostInput);
    if (hostSibling !== undefined) await writeFile(join(dir, hostName === "-x:y" ? "-x" : "a"), hostSibling);
    if (fifo) spawnSync("mkfifo", [join(dir, hostName)]);
    const args = argv.map((a) => fill(a).replaceAll("@HOST_FILE@", join(dir, hostName)));
    const direct = shim === SH ? ["sh", [script, ...args]] : ["pwsh", ["-NoProfile", "-File", script, ...args]];
    // `viaHarnessShell`: a shell carrying the harness mark launches the shim with the mark stripped (`env -u CLAUDECODE`), and
    // `; true` keeps that shell its parent, so only the chain, never the shim's own environment, carries the harness.
    const cmd0 = viaHarnessShell ? ["sh", ["-c", 'env -u CLAUDECODE "$0" "$@"; true', direct[0], ...direct[1]]] : direct;
    // A standing vessel answers a steady verdict unless a test scripts another answer.
    const steady = '{"data":{"standing":{"act":"attach","reason":"steady"}}}';
    // Each run's floor lock stands in its own scratch dir: a build never queues on the box's real floor (a suite run under
    // floor-run holds it, and a run in a fresh pid namespace cannot see that ancestor, so it would wait forever).
    const base = { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: home, LARES_COMPOSE_FILE: compose, FAKE_OBSERVE_OUTPUT: steady, LARES_BATTERY_LOCK: join(dir, "floor.lock"), ...gitEnv };
    // `@HEAD@` (and `@HEAD12@`, its first twelve) in an env value names the scratch checkout's own HEAD.
    const head = checkout && checkout !== "none" ? spawnSync("git", ["-C", join(dir, "repo"), "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim() : "";
    const filled = Object.fromEntries(Object.entries(env).map(([k, v]) => [k, typeof v === "string" ? fill(v).replaceAll("@HEAD12@", head.slice(0, 12)).replaceAll("@HEAD@", head) : v]));
    // A run that is no seat case reads as a hand where a harness stands above the suite: the shim runs as pid 1 of a fresh pid
    // namespace, so its own host chain reaches pid 0 with no harness in it (the seat gate of the restand verbs reads that chain).
    const asHand = SUITE_SEAT && HAVE_UNSHARE && !rawSeat && !viaHarnessShell && filled.CLAUDECODE === undefined;
    const cmd = asHand ? ["unshare", ["-U", "--map-current-user", "-p", "-f", "--mount-proc", cmd0[0], ...cmd0[1]]] : cmd0;
    // `tty` names the bytes typed on a pseudo-terminal (`script`), which then carries stdout and stderr as one stream.
    const shellMark = viaHarnessShell ? { CLAUDECODE: "1" } : {};
    const r = tty === undefined
      ? spawnSync(cmd[0], cmd[1], { cwd: hostCwd ? dir : undefined, env: { ...base, ...filled, ...shellMark, PATH: `${dir}:${filled.PATH ?? process.env.PATH}` }, encoding: "utf8", timeout: 30000, input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] })
      : spawnSync("script", ["-qec", [cmd[0], ...cmd[1]].map((a) => `'${a}'`).join(" "), "/dev/null"], { env: { ...base, ...filled, PATH: `${dir}:${filled.PATH ?? process.env.PATH}` }, encoding: "utf8", input: tty });
    let calls = ""; try { calls = await readFile(log, "utf8"); } catch {}
    let received = null; try { received = await readFile(`${log}.stdin`); } catch {}
    if (SUITE_SEAT && !rawSeat && filled.CLAUDECODE === undefined && !viaHarnessShell) calls = calls.replaceAll(" -e CLAUDECODE", "");
    let worn = null; try { worn = (await readFile(join(house, "config", "last-worn-face"), "utf8")).trim(); } catch {}
    let seat = null; let seatMode = null; try { seat = JSON.parse(await readFile(join(house, "config", "keep-seat.json"), "utf8")); seatMode = (await stat(join(house, "config", "keep-seat.json"))).mode & 0o777; } catch {}
    const made = {};
    for (const c of ["hearth", "sensoriums", "projections", "library", "config", "pulama/socket"]) { try { await readdir(join(house, c)); made[c] = true; } catch { made[c] = false; } }
    let cacheLeft = null; try { cacheLeft = await readdir(join(house, "cache")); } catch {}
    let vesselLog = null; try { vesselLog = await readFile(join(house, "run", "vessel-last.log"), "utf8"); } catch {}
    const read = {}; for (const rel of readFiles) { try { read[rel] = await readFile(join(house, rel), "utf8"); read[`${rel}:mode`] = (await stat(join(house, rel))).mode & 0o777; } catch {} }
    let keepOwed = false; try { await stat(join(house, "run", "keep-owed")); keepOwed = true; } catch {}
    return { ...r, read, calls, received, dir, made, worn, seat, seatMode, cacheLeft, vesselLog, keepOwed, house };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

// ATTACHED: under a real pseudo-terminal the shim must NOT add -T, or the founding loses its human-route prompt.
// (Reading `-t 1` inside the `$(tty_flag)` substitution once always read false: stdout there is a pipe.)
const haveScript = spawnSync("script", ["--version"]).status === 0;

for (const [name, shim, skip] of [["sh", SH, false], ["ps1", PS1, !havePwsh]]) {
  test(`${name}: a named family file crosses as exact stdin bytes and an absent file refuses before exec`, { skip }, async () => {
    const bytes = Buffer.from("first\n\nlast\n", "utf8");
    const landed = await run(shim, ["tiddler", "put", "lar:///t/x", "--meme", "--recipe", "default", "--file", "@HOST_FILE@"],
      { env: { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w", FAKE_RUNNING_ID: "vessel" }, hostInput: bytes });
    assert.equal(landed.status, 0, landed.stderr);
    assert.deepEqual(landed.received, bytes);
    assert.match(landed.calls, /--file -/);
    const piped = await run(shim, ["tiddler", "put", "lar:///t/x", "--meme", "--recipe", "default", "--file", "-"],
      { env: { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w", FAKE_RUNNING_ID: "vessel" }, input: bytes });
    assert.deepEqual(piped.received, bytes);
    const absent = await run(shim, ["tiddler", "put", "lar:///t/x", "--meme", "--recipe", "default", "--file", "@HOST_FILE@"],
      { env: { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w", FAKE_RUNNING_ID: "vessel" } });
    assert.notEqual(absent.status, 0);
    assert.doesNotMatch(absent.calls, / node .* tiddler put /);
  });
}
for (const [name, shim, skip] of [["sh", SH, false], ["ps1", PS1, !havePwsh]]) {
  test(`${name}: a spirit verb streams a named host file whole as stdin, and a read verb streams none`, { skip }, async () => {
    const env = { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w", FAKE_RUNNING_ID: "vessel" };
    const bytes = Buffer.from("!! Open\n\n* a loop\n", "utf8");
    // The carry's verb reads from the built table (`spirit-words.ts`), so a rename of the word reaches this match too.
    const { COMPACTION_WORD } = await import("../packages/lares-cli/dist/src/spirit-words.js");
    for (const wire of [["spirit", "ah", "lares-alpha", "--slot", "#/open"], ["spirit", COMPACTION_WORD, "lares-alpha"], ["spirit", "residue", "om-wright"]]) {
      const r = await run(shim, [...wire, "--file", "@HOST_FILE@"], { env, hostInput: bytes });
      assert.equal(r.status, 0, `${wire.join(" ")}: ${r.stderr}`);
      assert.deepEqual(r.received, bytes, wire.join(" "));
      assert.match(r.calls, /--file -/);
    }
    const absent = await run(shim, ["spirit", "ah", "lares-alpha", "--slot", "#/open", "--file", "@HOST_FILE@"], { env });
    assert.notEqual(absent.status, 0);
    const read = await run(shim, ["spirit", "hum", "lares-alpha", "--fold", "#/open"], { env });
    assert.equal(read.received, null);
  });
}
for (const [name, shim, skip] of [["sh", SH, false], ["ps1", PS1, !havePwsh]]) {
  const standing = { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w", FAKE_RUNNING_ID: "vessel" };
  const crlf = Buffer.from("one\r\ntwo\r\n\r\n", "utf8");
  test(`${name}: a slot write streams a named host file whole, by --file, --file= or --append`, { skip }, async () => {
    const wire = ["tiddler", "put", "lar:///t/x", "--meme", "--recipe", "default", "--slot", "#/a", "--base", "sha256:1"];
    for (const [flag, sink] of [[["--file", "@HOST_FILE@"], /--file -/], ...(name === "sh" ? [[["--file=@HOST_FILE@"], /--file=-/]] : []), [["--append", "@HOST_FILE@"], /--append -/]]) {
      const r = await run(shim, [...wire, ...flag], { env: standing, hostInput: crlf });
      assert.equal(r.status, 0, `${flag.join(" ")}: ${r.stderr}`);
      assert.deepEqual(r.received, crlf, flag.join(" "));
      assert.match(r.calls, sink);
    }
  });
  test(`${name}: a plain put streams a named --append host file whole, passes --append - through, and refuses a missing one before exec`, { skip }, async () => {
    const wire = ["tiddler", "put", "Ledger", "--recipe", "default"];
    const landed = await run(shim, [...wire, "--append", "@HOST_FILE@"], { env: standing, hostInput: crlf });
    assert.equal(landed.status, 0, landed.stderr);
    assert.deepEqual(landed.received, crlf);
    assert.match(landed.calls, /--append -/);
    const piped = await run(shim, [...wire, "--append", "-"], { env: standing, input: crlf });
    assert.equal(piped.status, 0, piped.stderr);
    assert.deepEqual(piped.received, crlf);
    const missing = await run(shim, [...wire, "--append", "@HOST_FILE@"], { env: standing });
    assert.notEqual(missing.status, 0);
    assert.doesNotMatch(missing.calls, / node .* tiddler put /);
  });
  test(`${name}: a missing --append file, an empty source, a repeated source and a flag-shaped value refuse or pass as the CLI would`, { skip }, async () => {
    const wire = ["tiddler", "put", "lar:///t/x", "--meme", "--recipe", "default", "--slot", "#/a", "--base", "sha256:1"];
    const missing = await run(shim, [...wire, "--append", "@HOST_FILE@"], { env: standing });
    assert.notEqual(missing.status, 0);
    assert.doesNotMatch(missing.calls, / node .* tiddler put /);
    const empty = await run(shim, [...wire, "--file="], { env: standing });
    assert.notEqual(empty.status, 0);
    assert.doesNotMatch(empty.calls, / node .* tiddler put /);
    const twice = await run(shim, [...wire, "--file", "@HOST_FILE@", "--append", "@HOST_FILE@"], { env: standing, hostInput: crlf });
    assert.notEqual(twice.status, 0);
    assert.doesNotMatch(twice.calls, / node .* tiddler put /);
    // `--text --file` carries the words "--file" as a value: no source, nothing streamed.
    const value = await run(shim, [...wire, "--text", "--file"], { env: standing });
    assert.equal(value.status, 0, value.stderr);
    assert.equal(value.received, null);
    assert.match(value.calls, /--text --file/);
  });
}
test("sh: RED reset under an AI seat refuses hand-act-only by name before the terminal and the typed word, and the hearth keeps every entry", { skip: !haveScript }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "lares-reset-seat-"));
  try {
    const house = join(dir, "house"), workspace = join(dir, "workspace"), hearth = join(house, "hearth");
    await Promise.all([hearth, workspace].map((path) => mkdir(path, { recursive: true })));
    await writeFile(join(hearth, "entry"), "keep");
    await writeFile(join(dir, "docker"), "#!/bin/sh\nexit 0\n");
    await chmod(join(dir, "docker"), 0o755);
    const env = { PATH: `${dir}:${process.env.PATH}`, HOME: dir, LARES_HOUSE: house, LARES_WORKSPACE: workspace };
    for (const mark of [{ CLAUDECODE: "1" }, { CODEX_SANDBOX: "seatbelt" }]) {
      const r = spawnSync("script", ["-qec", `sh '${SH}' reset`, "/dev/null"], { env: { ...env, ...mark }, input: "re-found\n", encoding: "utf8" });
      assert.equal(r.status, 2, r.stdout);
      assert.match(r.stdout, /reset refused hand-act-only/);
      assert.match(r.stdout, /at their own terminal/);
      assert.doesNotMatch(r.stdout, /Type re-found/);
    }
    assert.deepEqual(await readdir(hearth), ["entry"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
// A reset under a harness refuses hand-act-only before its other refusals read, so the two cases below that walk those refusals
// and the clearing itself run where this suite's chain reads a person (CI, the operator's shell); the seat's own refusal runs
// everywhere, its mark carried in the shim's environment.
// THE RESTAND SPENDS THE LEI (course ai-restand-spends-lei): an AI seat's up, down, vessel stop, vessel stand and build refuse
// without a standing kukulu lei (a return left) on the checkout's branch, naming the cure; a hand passes untouched. The seat
// rides the mark in the shim's own environment; the hand control needs a suite chain that reads a person (CI, the operator).
{
  const MOUNT = { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w" };
  const AI = { CLAUDECODE: "1", ...MOUNT };
  const leiOf = (...faces) => JSON.stringify({ ok: true, data: { faces: faces.map((lei) => ({ lei })) } });
  const standingLei = { standing: true, returnsLeft: 2 };
  const verbs = [["up"], ["down"], ["vessel", "stop"], ["vessel", "stand"], ["build"]];
  const acted = (calls) => / up -d | down --remove-orphans| stop lares| build /.test(calls);
  for (const argv of verbs) {
    const label = argv.join(" ");
    test(`sh: RED ai-restand-spends-the-lei: ${label} refuses an AI seat with no standing kukulu lei, names the cure, and runs nothing`, async () => {
      for (const [lei, why] of [[undefined, /answered no reading/], [leiOf({ standing: false, refusal: "absent" }), /no standing kukulu lei on \S+ \(absent\)/], [leiOf({ standing: true, returnsLeft: 0 }), /no return left/]]) {
        const r = await run(SH, argv, { checkout: "clean", env: { ...AI, FAKE_RUNNING_ID: "cid", ...(lei ? { FAKE_LEI_SHOW: lei } : {}) }, rawSeat: true });
        assert.equal(r.status, 2, r.stderr);
        assert.match(r.stderr, new RegExp(`${label} refused to an AI seat`));
        assert.match(r.stderr, why);
        assert.match(r.stderr, /lares lei kui --rite kukulu --branch \S+ --returns <n> --all/);
        assert.equal(acted(r.calls), false, r.calls);
      }
    });
    test(`sh: RED ai-restand-spends-the-lei: ${label} under an AI seat with no vessel standing names that the lei reads nowhere`, async () => {
      const r = await run(SH, argv, { checkout: "clean", env: { ...AI }, rawSeat: true });
      assert.equal(r.status, 2, r.stderr);
      assert.match(r.stderr, new RegExp(`${label} refused to an AI seat`));
      assert.match(r.stderr, /the lei reads nowhere while no vessel stands; a hand runs/);
      assert.equal(acted(r.calls), false, r.calls);
    });
  }
  test("sh: ai-restand-spends-the-lei: one standing lei among the vessel's faces licenses an AI seat's vessel stop; the lei is read on the checkout's branch", async () => {
    const r = await run(SH, ["vessel", "stop"], { checkout: "clean", env: { ...AI, FAKE_RUNNING_ID: "cid", FAKE_LEI_SHOW: leiOf({ standing: false, refusal: "absent" }, standingLei) }, rawSeat: true });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, / lei show --rite kukulu --branch \S+ --json/);
    assert.match(r.calls, / stop lares/);
  });
  test("sh: ai-restand-spends-the-lei: a standing lei lets an AI seat's down, vessel stand and build through their own paths", async () => {
    const lei = { FAKE_RUNNING_ID: "cid", FAKE_LEI_SHOW: leiOf(standingLei) };
    const down = await run(SH, ["down"], { checkout: "clean", env: { ...AI, ...lei, FAKE_CENSUS_OUTPUT: "census: clean" }, rawSeat: true });
    assert.doesNotMatch(down.stderr, /refused to an AI seat/);
    const stand = await run(SH, ["vessel", "stand"], { checkout: "clean", env: { ...AI, ...lei }, rawSeat: true });
    assert.doesNotMatch(stand.stderr, /refused to an AI seat/);
    const build = await run(SH, ["build"], { checkout: "clean", env: { ...AI, ...lei }, rawSeat: true });
    assert.doesNotMatch(build.stderr, /refused to an AI seat/);
  });
  test("sh: ai-restand-spends-the-lei: a read verb stays open to an AI seat (vessel stand --observe asks no lei)", async () => {
    const r = await run(SH, ["vessel", "stand", "--observe", "--json"], { checkout: "clean", env: { ...AI, FAKE_RUNNING_ID: "cid" }, rawSeat: true });
    assert.doesNotMatch(r.stderr, /refused to an AI seat/);
  });
  test("sh: CONTROL a hand (a chain that reads a person) passes up, down, vessel stop and build with no lei", { skip: SUITE_SEAT }, async () => {
    const stop = await run(SH, ["vessel", "stop"], { checkout: "clean", env: { ...MOUNT, FAKE_RUNNING_ID: "cid" } });
    assert.equal(stop.status, 0, stop.stderr);
    assert.doesNotMatch(stop.stderr, /refused to an AI seat/);
    assert.doesNotMatch(stop.calls, / lei show /);
    for (const argv of [["up"], ["down"], ["build"]]) {
      const r = await run(SH, argv, { checkout: "clean", env: { ...MOUNT } });
      assert.doesNotMatch(r.stderr, /refused to an AI seat/);
    }
  });
}
test("sh: reset clears the hearth alone, after its refusals; sensoriums, projections, library, config and the env file stay", { skip: !haveScript || SUITE_SEAT }, async () => {
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
test("sh: reset refuses a hearth that resolves outside the house", { skip: !haveScript || SUITE_SEAT }, async () => {
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
    // A harness above this suite sends the seat mark on every act (SUITE_SEAT); folded out here as `run` folds it.
    const calls = (await readFile(log, "utf8")).replaceAll(SUITE_SEAT ? " -e CLAUDECODE" : "\u0000", "");
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

  // THE HOST CHAIN CROSSES AS THE MARK (hitl-reads-a-hand): inside the vessel an exec'd process has parent pid 0, so the shim
  // reads its own host chain before any act. A harness shell that strips the mark from the shim it launches still sends the
  // seat mark in, on the exec and on the offline run alike.
  test(`${name}: RED a harness shell that strips the mark still sends -e CLAUDECODE into the vessel (exec and offline run)`, { skip: name === "ps1" && !havePwsh }, async () => {
    const r = await run(shim, ["sense", "purge", "x", "--approve"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" }, viaHarnessShell: true });
    assert.equal(r.status, 0, r.stderr);
    const exec = r.calls.split("\n").find((l) => / exec /.test(l) && / sense purge x --approve$/.test(l));
    assert.ok(exec, r.calls);
    assert.match(exec, /(^| )-e CLAUDECODE( |$)/);
    const offline = await run(shim, ["wiki", "retire", "x"], { env: MOUNTS, viaHarnessShell: true });
    assert.match(offline.calls, /--profile offline run --rm --name lares-offline-[0-9a-f]+ (?:-e \S+ )*-e CLAUDECODE /);
  });

  test(`${name}: CONTROL the operator's shell carries the mark only where its own chain reads a harness`, { skip: name === "ps1" && !havePwsh }, async () => {
    const r = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" }, rawSeat: true });
    assert.equal(r.status, 0, r.stderr);
    const exec = r.calls.split("\n").find((l) => / exec /.test(l) && / vessel read$/.test(l));
    assert.ok(exec, r.calls);
    if (SUITE_SEAT) assert.match(exec, /(^| )-e CLAUDECODE( |$)/, "this suite runs under a harness, so its shims carry the mark");
    else assert.doesNotMatch(exec, /-e CLAUDECODE/, "an operator's shell with no harness on its chain carries none");
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
    assert.doesNotMatch(attached.calls, / wear \d+(?: --yes)?$/m);
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
    const r = await run(shim, ["tiddler", "get", "lar:///x", "--recipe", "default", "--meme"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "7" } });
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

  // THE RELEASE HOLDS THE STORE, SO IT RUNS ONLY WITH THE VESSEL STOPPED: a standing container refuses by name, naming the
  // exact stop, and nothing execs; a stopped one hands the act to the offline door, which claims the store for it.
  test(`${name}: vessel release refuses while a vessel stands, naming the stop, and execs nothing`, async () => {
    const r = await run(shim, ["vessel", "release", "4NMNnkMhL8jXrdJ9jamS2rUEaQDq", "--keep"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /`lares vessel stop`/);
    assert.doesNotMatch(r.calls, /compose .*exec/);
    assert.doesNotMatch(r.calls, /offline/);
  });

  test(`${name}: CONTROL vessel release with no vessel standing runs through the offline door`, async () => {
    const r = await run(shim, ["vessel", "release", "4NMNnkMhL8jXrdJ9jamS2rUEaQDq", "--fresh"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /--profile offline run --rm (?:--name lares-offline-[0-9a-f]+ )?-T offline vessel release 4NMNnkMhL8jXrdJ9jamS2rUEaQDq --fresh/);
  });

  // THE STEP-IN READ ANSWERS ON A FALLEN VESSEL: a fallen engine answers no standing verdict, so the read asks none; it
  // reads its files inside the container and returns what it read.
  test(`${name}: vessel read on a standing vessel asks no standing verdict after it`, async () => {
    const r = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_RC: "1" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec (?:-e LARES_EXEC_TAG )?-T lares node packages\/lares-cli\/bin\/lares\.mjs vessel read$/m);
    assert.doesNotMatch(r.calls, /vessel stand --observe/);
  });

  // THE STEP-IN READ ON THE HOST: where docker reaches no CLI, the shim reads the fall's files under the hearth bind itself.
  const FALLS = JSON.stringify({ falls: [{ life: "a", pid: 7, cause: "wasm-unreachable", path: "boot", since: "2026-11-23T01:00:00.000Z", inFlight: "docInFlight" }] }, null, 2) + "\n";
  const MANIFEST = JSON.stringify({ documentId: "4NMNnkMhL8jXrdJ9jamS2rUEaQDq", status: "torn", quarantinedAt: "2026-11-23T00:00:00.000Z", movedTo: "/lar/x" });
  const RELEASED = JSON.stringify({ documentId: "releasedDoc", status: "torn", quarantinedAt: "2026-11-22T00:00:00.000Z", movedTo: "/lar/y", released: { act: "kept" } });
  const fallen = {
    "hearth/vessel/.engine-falls": FALLS,
    "hearth/vessel/quarantine-torn-snapshots-2026-11-23/4N__MNnk.manifest.json": MANIFEST,
    "hearth/vessel/quarantine-torn-snapshots-2026-11-22/re__leased.manifest.json": RELEASED,
  };
  const hostRead = (r, why) => {
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, why);
    assert.match(r.stdout, /"cause": "wasm-unreachable"/);
    assert.match(r.stdout, /^held in flight: docInFlight$/m);
    assert.match(r.stdout, /^held in quarantine: 4NMNnkMhL8jXrdJ9jamS2rUEaQDq /m);
    assert.doesNotMatch(r.stdout, /releasedDoc/);
    assert.match(r.stdout, /`lares vessel stop`/);
  };

  test(`${name}: vessel read with docker's ps failing reads the falls on the host`, async () => {
    const r = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_PS_RC: "1" }, houseFiles: fallen });
    hostRead(r, /docker compose ps failed/);
    assert.doesNotMatch(r.calls, / exec | run /);
  });

  test(`${name}: vessel read with the container mid-restart reads the falls on the host`, async () => {
    const r = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_RESTARTING_ID: "cid" }, houseFiles: fallen });
    hostRead(r, /restarts/);
    assert.doesNotMatch(r.calls, / exec | run /);
  });

  test(`${name}: vessel read whose exec docker cannot run (126) reads the falls on the host`, async () => {
    const r = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "126" }, houseFiles: fallen });
    hostRead(r, /exit 126/);
  });

  test(`${name}: the host read names one line per held id, however many manifests hold it`, async () => {
    const again = JSON.stringify({ documentId: "4NMNnkMhL8jXrdJ9jamS2rUEaQDq", status: "torn", quarantinedAt: "2026-11-23T05:00:00.000Z", movedTo: "/lar/z" });
    const r = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_PS_RC: "1" }, houseFiles: { ...fallen, "hearth/vessel/quarantine-torn-snapshots-2026-11-23/4N__MNnk.1.manifest.json": again } });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.match(/^held in quarantine: 4NMNnkMhL8jXrdJ9jamS2rUEaQDq /gm)?.length, 1, r.stdout);
  });

  test(`${name}: the host read over a house with no store says the store stands absent, never "none resting"`, async () => {
    const r = await run(shim, ["vessel", "read"], { env: { ...MOUNTS, FAKE_PS_RC: "1" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^store absent: \S+\/hearth\/vessel/m);
    assert.doesNotMatch(r.stdout, /none resting/);
  });

  test(`${name}: vessel release refuses while the vessel stands paused, naming the stop`, async () => {
    const r = await run(shim, ["vessel", "release", "4NMNnkMhL8jXrdJ9jamS2rUEaQDq"], { env: { ...MOUNTS, FAKE_PAUSED_ID: "cid" } });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /`lares vessel stop`/);
    assert.doesNotMatch(r.calls, /offline|compose .*exec/);
  });

  test(`${name}: CONTROL a CLI refusal (exit 2) from the read stays the CLI's, and no host read runs`, async () => {
    const r = await run(shim, ["vessel", "read", "nolens"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "2" }, houseFiles: fallen });
    assert.equal(r.status, 2);
    assert.doesNotMatch(r.stdout, /engine falls/);
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

  // AN UNASKED ROW NEVER HIDES: down prints each `census: unasked` line (an unnamed document's sync states alone, no content)
  // on a clean census before the stop, and beside the items on a refusal, so the person sees all that memory holds.
  const UNASKED = "census: unasked  doc doc-heads  3 save(s), 6 byte(s), held across 9 later save(s): sync states alone, peers' heads and no change, so a stop drops no content here";
  test(`${name}: down-names-unasked-rows: a clean census beside an unasked row stops, printing each unasked line`, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CENSUS_ERR: UNASKED } });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(stopped(r.calls), r.calls);
    assert.ok(r.stderr.includes(UNASKED), r.stderr);
  });
  test(`${name}: down-names-unasked-rows-on-refusal: a census naming items beside an unasked row refuses, listing the items and the unasked line`, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_ERR: `${UNASKED}\ncensus: 2 item(s) rest nowhere yet; a stop now drops them`, FAKE_CENSUS_RC: "3" } });
    assert.notEqual(r.status, 0, r.stderr);
    assert.ok(!stopped(r.calls), r.calls);
    assert.match(r.stderr, /held-save  save-unbooked  doc doc-heron/);
    assert.ok(r.stderr.includes(UNASKED), r.stderr);
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

  // THE CLOSING SLICE: where the vessel folds its log into records (its live log, one JSON line per event change), the down
  // writes each event's last line to run/vessel-last.log, one per event in the order each last changed, and names it in one
  // line; the raw tail is read only where no live log answers.
  test(`${name}: down-saves-the-closing-slice: the vessel's live log lands in run/vessel-last.log as one line per event`, async () => {
    const live = [
      '{"key":"a","kind":"sealed-rest/save-unsealed","count":1,"boot":"b1"}',
      '{"key":"b","kind":"faces/skips","count":1,"boot":"b1"}',
      '{"key":"a","kind":"sealed-rest/save-unsealed","count":7,"boot":"b1"}',
    ].join("\n");
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_VESSEL_LIVE: live, FAKE_VESSEL_LOG: "[wire] raw line" }, houseFiles: { "run/vessel-last.log": "an older down's log\n" } });
    assert.equal(r.status, 0, r.stderr);
    const lines = (r.vesselLog ?? "").split("\n").filter((l) => l.trim() !== "");
    assert.deepEqual(lines, ['{"key":"b","kind":"faces/skips","count":1,"boot":"b1"}', '{"key":"a","kind":"sealed-rest/save-unsealed","count":7,"boot":"b1"}']);
    assert.doesNotMatch(r.vesselLog ?? "", /\[wire\] raw line/, "the raw tail stays unread where the live log answers");
    assert.doesNotMatch(r.calls, /^logs --tail/m);
    assert.equal(r.stderr.split("\n").filter((l) => /vessel-last\.log/.test(l)).length, 1, r.stderr);
    assert.match(r.stderr, /lares-container: the vessel's closing slice \(2 event\(s\), one line each\) rests at .*\/run\/vessel-last\.log/);
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
    assert.match(r.stderr, /keeping first \(rite keep --if-due\)/, "down says up front why it takes the time a keep takes");
  });
  test(`${name}: down-goes-on-past-a-refused-keep: the keep's refusal is named and the down still stops the vessel`, async () => {
    const cli = await fakeHostCli(1);
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, LARES_KEEP_WORKSPACE: "house-backup", LARES_HOST_CLI: cli } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /the keep did not complete/);
    assert.match(r.calls, /down --remove-orphans/);
  });
  test(`${name}: keep-leaves-its-words: a refused keep's stderr rests at run/keep-last.log, and still reaches the terminal`, async () => {
    const d = await mkdtemp(join(tmpdir(), "lares-keep-cli-"));
    const cli = join(d, "lares");
    await writeFile(cli, `#!/bin/sh\nprintf 'HOSTCLI %s\\n' "$*" >> "$CALL_LOG"\nprintf '%s\\n' 'keep: swarm-lei-returns-spent: the hand strings one' >&2\nexit 1\n`);
    await chmod(cli, 0o755);
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, LARES_KEEP_WORKSPACE: "house-backup", LARES_HOST_CLI: cli }, readFiles: ["run/keep-last.log"] });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /swarm-lei-returns-spent: the hand strings one/);
    assert.match(r.read?.["run/keep-last.log"] ?? "", /swarm-lei-returns-spent: the hand strings one/);
    if (name === "sh") { const m = (r.read["run/keep-last.log:mode"] ?? 0o777) & 0o077; assert.equal(m, 0, "the log carries no group or world access"); }
  });
  test(`${name}: CONTROL down with no keep workspace named runs no keep`, async () => {
    const cli = await fakeHostCli(0);
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, LARES_HOST_CLI: cli } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /HOSTCLI/);
    assert.doesNotMatch(r.stderr, /keeping first/);
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

  // THE FLOOR TAKES IMAGE BUILDS (mandate/floor-gate-1). RED-FIRST: written by floor-warden#2, run by the familiar.
  if (name === "sh") test(`${name}: build holds the floor lock around the compose build and prunes the build cache after; an unopenable lock refuses and builds nothing`, async () => {
    const held = await run(shim, ["build"], { env: MOUNTS, checkout: "clean" });
    assert.equal(held.status, 0, held.stderr);
    assert.match(held.stderr, /holding the floor for the image build/);
    assert.match(held.calls, /builder prune --all --force/);
    assert.doesNotMatch(held.calls, /(^|\s)(rmi|image prune|system prune)(\s|$)/m);
    const walled = await run(shim, ["build"], { env: { ...MOUNTS, LARES_BATTERY_LOCK: "/nonexistent-floor-dir/floor.lock" }, checkout: "clean" });
    assert.notEqual(walled.status, 0);
    assert.match(walled.stderr, /build refuses: the floor lock \/nonexistent-floor-dir\/floor\.lock cannot open here/);
    assert.doesNotMatch(walled.calls, /GIT_REV=/, "no compose build ran unlocked");
    // The refusal names itself under a POSIX sh: a failing `exec 8>` redirection there exits the shell silent, so the shim
    // probes the open in a subshell first (the 2026-11-25 red: dash died at the exec and printed nothing).
    assert.doesNotMatch(walled.stderr, /holding the floor/);
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
  // image its vessel runs.
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
  test(`${name}: keep-owed-names-a-face: the debt read names the face last worn (face 0, the keep's face, where none rests remembered), so a house with several faces open answers; a read that refuses names "wear a face"`, async () => {
    const env = { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, FAKE_CUSTODY_OUTPUT: HELD, LARES_KEEP_WORKSPACE: "house-backup", FAKE_RECEIPTS: '{"ok":true,"data":{"pending":[]}}' };
    const none = await run(shim, ["keep-owed"], { houseFiles: { "run/keep-owed": "" }, env: { ...env, LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.match(none.calls, /rite receipts --rite kukulu --face 0 --json/);
    const worn = await run(shim, ["keep-owed"], { houseFiles: { "run/keep-owed": "", "config/last-worn-face": "2\n" }, env: { ...env, LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.match(worn.calls, /rite receipts --rite kukulu --face 2 --json/);
    const refused = await run(shim, ["keep-owed"], { houseFiles: { "run/keep-owed": "" }, env: { ...env, FAKE_RECEIPTS: "", FAKE_RECEIPTS_RC: "2", LARES_HOST_CLI: await keepTwice(0, 0) } });
    assert.match(refused.stderr, /the debt read refused \(with several faces open and none worn, wear a face: `lares wear N`\)/);
    assert.equal(refused.keepOwed, true);
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
  test(`${name}: keep-marks-owed-on-the-first-failed-read (the eighth read): with no mark yet, a keep reply that reads as no real keep WRITES keep-owed; in sh a python3 that answers 127 (absent) names itself and marks the keep owed`, async () => {
    const env = { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN, LARES_KEEP_WORKSPACE: "house-backup" };
    for (const out of ["", '{"ok":1,"data":{"workspace":"house-backup"}}', '{"ok":true,"data":{"workspace":null}}']) {
      const d = await mkdtemp(join(tmpdir(), "lares-keep-cli-"));
      const cli = join(d, "lares");
      await writeFile(cli, `#!/bin/sh\nprintf 'HOSTCLI %s\\n' "$*" >> "$CALL_LOG"\nprintf '%s\\n' '${out}'\nexit 0\n`);
      await chmod(cli, 0o755);
      const r = await run(shim, ["down"], { env: { ...env, LARES_HOST_CLI: cli } });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.keepOwed, true, JSON.stringify(out));
    }
    if (name === "sh") {
      const d = await mkdtemp(join(tmpdir(), "lares-keep-py-"));
      await writeFile(join(d, "python3"), "#!/bin/sh\nexit 127\n");
      await chmod(join(d, "python3"), 0o755);
      const r = await run(shim, ["down"], { env: { ...env, LARES_HOST_CLI: await fakeHostCli(0), PATH: `${d}:${process.env.PATH}` } });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.keepOwed, true);
      assert.match(r.stderr, /python3 answers nowhere on this host, so the keep's answer reads unread; the keep stays owed/);
    }
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
test(`${name}: publish-hand-door-chain: under a pūlama, nexus publish plugins --apply reads the terms in the vessel, the pūlama signs the offering on this terminal, and the vessel lands it; a refused signing lands nothing; no pūlama or no --apply routes as before`, { skip }, async () => {
  const terms = '{"face":0,"offering":{"offeror":"aa","pluginsCid":"c","blobs":[]}}';
  const answer = '{"op":"publish","reading":"signed","face":0,"offering":{"kind":"k","sig":"s"}}';
  const argv = ["nexus", "publish", "plugins", "--source", "offerings/relink", "--face", "0", "--apply"];
  const r = await run(shim, argv, { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_PUBLISH_TERMS: terms, FAKE_PUBLISH_ANSWER: answer } });
  assert.equal(r.status, 0, r.stdout);
  const lines = r.calls.split("\n");
  // --apply never reaches the vessel: the terms read signs nothing, and the land carries the hand's signature.
  const read = lines.findIndex((l) => /exec (?:-e \S+ )*-T lares node \S+ nexus publish plugins --source offerings\/relink --face 0 --terms$/.test(l));
  const sign = lines.findIndex((l) => l.includes(`--profile pulama exec --no-TTY=false pulama node packages/lararium-node/dist/src/pulama-main.js publish ${terms}`));
  const land = lines.findIndex((l) => l.includes(" --land "));
  assert.ok(land >= 0, r.calls);
  assert.match(lines[land], /nexus publish plugins --source offerings\/relink --face 0 --land /);
  assert.deepEqual(JSON.parse(lines[land].slice(lines[land].indexOf(" --land ") + " --land ".length)), JSON.parse(answer), "the landed answer reads as the whole signed object");
  assert.ok(read >= 0 && sign > read && land > sign, `order terms, sign (attached), land:\n${r.calls}`);
  assert.doesNotMatch(r.calls, /--apply/);
  const refused = await run(shim, argv, { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_PUBLISH_TERMS: terms } });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stdout, /the pūlama signed nothing; nothing lands/);
  assert.doesNotMatch(refused.calls, / --land /);
  const noTty = await run(shim, argv, { envFile: PULAMA_ENV, env: { FAKE_RUNNING_ID: "cid", FAKE_PUBLISH_TERMS: terms, FAKE_PUBLISH_ANSWER: answer } });
  assert.notEqual(noTty.status, 0);
  assert.match(noTty.stderr, /nexus publish under a pūlama reads its route on a terminal/);
  const read2 = await run(shim, ["nexus", "publish", "plugins", "--source", "x"], { envFile: PULAMA_ENV, env: { FAKE_RUNNING_ID: "cid" } });
  assert.match(read2.calls, /lares node \S+ nexus publish plugins --source x/);
  assert.doesNotMatch(read2.calls, /pulama-main\.js publish/);
});
test(`${name}: kahua-sign-hand-chain: under a pūlama, kahua lift reads the terms in the vessel on a pty (its digest types back there), the pūlama signs the one record on this terminal, and the vessel lands it; a refused signing lands nothing; no pūlama, or another kahua act, routes as before`, { skip }, async () => {
  const terms = '{"face":1,"kind":"kahua-act","record":{"act":"lift","title":"T"}}';
  const answer = '{"op":"sign","reading":"signed","face":1,"kind":"kahua-act","record":{"body":{"act":"lift"},"signer":"s","sig":"x"}}';
  const argv = ["kahua", "lift", "T", "--face", "1", "--taint", "none"];
  const r = await run(shim, argv, { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_KAHUA_TERMS: terms, FAKE_SIGN_ANSWER: answer } });
  assert.equal(r.status, 0, r.stdout);
  const lines = r.calls.split("\n");
  const read = lines.findIndex((l) => /exec --no-TTY=false (?:-e \S+ )*lares node \S+ kahua lift T --face 1 --taint none --terms$/.test(l));
  const sign = lines.findIndex((l) => l.includes(`--profile pulama exec --no-TTY=false pulama node packages/lararium-node/dist/src/pulama-main.js sign ${terms}`));
  const land = lines.findIndex((l) => l.includes(" --land "));
  assert.ok(land >= 0, r.calls);
  assert.match(lines[land], /-T lares node \S+ kahua lift T --face 1 --taint none --land /);
  assert.deepEqual(JSON.parse(lines[land].slice(lines[land].indexOf(" --land ") + " --land ".length)), JSON.parse(answer));
  assert.ok(read >= 0 && sign > read && land > sign, `order terms, sign (attached), land:\n${r.calls}`);
  const refused = await run(shim, argv, { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_KAHUA_TERMS: terms } });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stdout, /the pūlama signed nothing; nothing lands/);
  assert.doesNotMatch(refused.calls, / --land /);
  const nothing = await run(shim, argv, { envFile: PULAMA_ENV, tty: "", env: { FAKE_RUNNING_ID: "cid", FAKE_SIGN_ANSWER: answer } });
  assert.notEqual(nothing.status, 0);
  assert.doesNotMatch(nothing.calls, /pulama-main\.js sign/);
  const noTty = await run(shim, argv, { envFile: PULAMA_ENV, env: { FAKE_RUNNING_ID: "cid", FAKE_KAHUA_TERMS: terms, FAKE_SIGN_ANSWER: answer } });
  assert.notEqual(noTty.status, 0);
  assert.match(noTty.stderr, /kahua lift under a pūlama reads its route on a terminal/);
  const staged = await run(shim, ["kahua", "get", "T"], { envFile: PULAMA_ENV, env: { FAKE_RUNNING_ID: "cid" } });
  assert.match(staged.calls, /lares node \S+ kahua get T/);
  assert.doesNotMatch(staged.calls, /pulama-main\.js sign/);
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
  assert.match(r.calls, /exec (?:-e \S+ )*-T lares node \S+ wear 2 --yes$/m);
  assert.match(r.stderr, /faces stand lent and none worn; wearing h2, the face last worn/);
  const worn = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: 2, env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: KEY_HELD, FAKE_CENSUS_JSON: WORN_JSON } });
  assert.equal(worn.status, 0, worn.stderr);
  assert.doesNotMatch(worn.calls, / wear 2(?: --yes)?$/m);
});
test(`${name}: rewear-after-vault-unlock: under a pūlama, an unlock that names no face and leaves none worn wears the face last worn`, { skip }, async () => {
  const r = await run(shim, ["vault", "unlock", "--all"], { envFile: PULAMA_ENV, wornFace: 1, env: { FAKE_RUNNING_ID: "cid", FAKE_CENSUS_JSON: NONE_WORN_JSON } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls, /vault unlock --all[\s\S]*vessel census --json[\s\S]*-T lares node \S+ wear 1 --yes$/m);
});
// AN EMPTY MEMORY TELLS THE PŪLAMA NOTHING. A `wear` writes the pūlama's `face.worn`, which it wears again after every
// restart: a house whose config/last-worn-face reads empty sends no `wear 0` (a face it never saw worn), so the vessel's
// own mount stands, and the shim says so.
test(`${name}: empty-worn-face-tells-the-pulama-nothing: a held key over none worn, and an unlock under a pūlama, send no wear when no face rests remembered`, { skip }, async () => {
  const held = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: "", env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: KEY_HELD, FAKE_CENSUS_JSON: NONE_WORN_JSON } });
  assert.equal(held.status, 0, held.stderr);
  assert.match(held.calls, /vessel census --json/);
  assert.doesNotMatch(held.calls, / wear \d+(?: --yes)?$/m);
  assert.match(held.stderr, /faces stand lent and none worn, and no face rests remembered \(config\/last-worn-face reads empty\); the shim wears none/);
  const shut = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: "", env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":false}}}' } });
  assert.equal(shut.status, 0, shut.stderr);
  assert.match(shut.calls, /-T lares node \S+ vault unlock --all/);
  assert.doesNotMatch(shut.calls, / wear \d+(?: --yes)?$/m);
  assert.match(shut.stderr, /no face rests remembered \(config\/last-worn-face reads empty\), so the shim wears none and the vessel's own mount stands/);
  const bare = await run(shim, ["vault", "unlock", "--all"], { envFile: PULAMA_ENV, env: { FAKE_RUNNING_ID: "cid", FAKE_CENSUS_JSON: NONE_WORN_JSON } });
  assert.equal(bare.status, 0, bare.stderr);
  assert.doesNotMatch(bare.calls, / wear \d+(?: --yes)?$/m);
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
  assert.doesNotMatch(refused.calls, / wear \d+(?: --yes)?$/m);
  assert.equal(refused.worn, "1");
});
// THE SHIM'S `--yes` SPEAKS FOR THE SHORE ALONE. A face whose light refused may hold saves no seat has sealed, and the wear
// that composes again would drop them: the vessel refuses `saves-held` whatever `--yes` says, and only a person's own
// `--accept-loss` turns. The shim never carries that word, and it names the refusal truly, with the vessel's own lines.
const SAVES_HELD = "lares wear: wearing h2 composes the vessel again, which would drop them, so nothing moved. face h1 holds 1 save(s) in memory that no seat has sealed (its light refused); recard it at your own terminal, keeping its identity: tools/lares-container.sh pulama recard 1 (the face's own passphrase), then lares vault recard --face 1, and its own seat seals them. Or drop them knowingly: wear again with --accept-loss (`lares wear 2 --accept-loss`)";
test(`${name}: RED shim-wear-never-drops-held-saves: the rebuild's wear carries --yes and no --accept-loss, and a saves-held refusal reads as itself, naming the held face's cure`, { skip }, async () => {
  const r = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: 2, env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":false}}}', FAKE_WEAR_OUT: SAVES_HELD, FAKE_WEAR_RC: "1" } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls, /-T lares node \S+ wear 2 --yes$/m);
  assert.doesNotMatch(r.calls, /accept-loss/);
  assert.match(r.stderr, /h2 did not turn: a face whose light refused holds saves no seat has sealed/);
  assert.match(r.stderr, /lares vault recard --face 1/);
  assert.match(r.stderr, /wear 2 --accept-loss/);
  assert.doesNotMatch(r.stderr, /outside the lent set or locked/);
  assert.doesNotMatch(r.stderr, /the shore's flush left records unwritten/);
});
// THE SHIM'S OWN WEARS TURN OVER THE SHORE'S FLUSH. A wear that turns the face flushes every shore first and refuses
// `shore-unwritten` where records stay unwritten; the shim's post-unlock wears turn a face that was just opened (no hand
// edited it), so they carry `--yes`. Should the refusal ever surface, the shim names it truly with the flush's reading,
// never "outside the lent set or locked".
const SHORE_UNWRITTEN = "lares wear: the shore's flush left records unwritten on the face this wear turns away from; they rest in the store, and their mirrors stay behind until a hand wears that face again:\n  shore: wiki:sdm wrote 0 owed carrier(s); 1 left unwritten: failed lar:///a.b.c/stuck (its reconcile threw)\nturn anyway: lares wear 2 --yes";
test(`${name}: RED shim-wears-turn-over-the-shore: the post-unlock wears carry --yes, and a shore-unwritten refusal reads as itself with the flush's reading`, { skip }, async () => {
  const shut = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: 2, env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":false}}}' } });
  assert.equal(shut.status, 0, shut.stderr);
  assert.match(shut.calls, /-T lares node \S+ vault unlock --all[\s\S]*-T lares node \S+ wear 2 --yes$/m);
  for (const env of [
    { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: KEY_HELD, FAKE_CENSUS_JSON: NONE_WORN_JSON },
    { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":false}}}' },
  ]) {
    const r = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: 2, env: { ...env, FAKE_WEAR_OUT: SHORE_UNWRITTEN, FAKE_WEAR_RC: "1" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /h2 did not turn: the shore's flush left records unwritten/);
    assert.match(r.stderr, /shore: wiki:sdm wrote 0 owed carrier\(s\); 1 left unwritten: failed lar:\/\/\/a\.b\.c\/stuck/);
    assert.doesNotMatch(r.stderr, /outside the lent set or locked/);
  }
  const lent = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: 2, env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: KEY_HELD, FAKE_CENSUS_JSON: NONE_WORN_JSON, FAKE_WEAR_OUT: "lares wear: the pūlama lends this vessel h0, and h2 stands outside that set", FAKE_WEAR_RC: "1" } });
  assert.match(lent.stderr, /h2 stands outside the lent set or locked/);
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
  // ONE COMPOSITION PER RAISE: the vessel reads config/last-worn-face through its config bind and wears that face from its
  // first composition where the pūlama forgot it, so the census reads it worn and the shim sends no second wear; no new env.
  test(`${name}: worn-face-rides-the-config-bind: pulama mode names no worn-face env, and a raise whose census reads the face worn sends no wear`, { skip }, async () => {
    const r = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: 1, env: { FAKE_IMAGE_ID: "sha256:abc123" } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /LAR_WORN_FACE/);
    const worn = await run(shim, ["up"], { envFile: PULAMA_ENV, wornFace: 1, env: { FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: KEY_HELD, FAKE_CENSUS_JSON: WORN_JSON } });
    assert.equal(worn.status, 0, worn.stderr);
    assert.doesNotMatch(worn.calls, / wear \d+(?: --yes)?$/m);
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
  assert.match(bad.stderr, /pulama takes up, down, restand, light/);
});
test(`${name}: pulama-rehive-reaches-the-hand-door: rehive forwards one face ordinal to the pūlama's own verb; a bare or malformed ordinal refuses and sends nothing`, { skip }, async () => {
  const ok = await run(shim, ["pulama", "rehive", "1"], { envFile: PULAMA_ENV });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.calls, /--profile pulama exec (-T )?pulama node packages\/lararium-node\/dist\/src\/pulama-main\.js rehive 1/);
  for (const argv of [["pulama", "rehive"], ["pulama", "rehive", "one"]]) {
    const bad = await run(shim, argv, { envFile: PULAMA_ENV });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /pulama rehive takes one face ordinal \(a number\)/);
    assert.doesNotMatch(bad.calls, /rehive/);
  }
});
test(`${name}: pulama-recard-reaches-the-hand-door: recard forwards one face ordinal to the pūlama's own verb; a bare or malformed ordinal refuses and sends nothing`, { skip }, async () => {
  const ok = await run(shim, ["pulama", "recard", "1"], { envFile: PULAMA_ENV });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.calls, /--profile pulama exec (-T )?pulama node packages\/lararium-node\/dist\/src\/pulama-main\.js recard 1/);
  for (const argv of [["pulama", "recard"], ["pulama", "recard", "one"]]) {
    const bad = await run(shim, argv, { envFile: PULAMA_ENV });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /pulama recard takes one face ordinal \(a number\)/);
    assert.doesNotMatch(bad.calls, /recard/);
  }
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
test(`${name}: rebuild-lights-a-moved-closure-in-the-same-run: on a terminal, build, down, pulama restand, ONE proof (the light attached admits the image), up, unlock, wear, one closing line`, { skip: skip || !haveScript }, async () => {
  const r = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, tty: "", checkout: "clean", wornFace: 2, env: { ...REBUILT, FAKE_IMAGE_CLOSURE: CL("b"), FAKE_PULAMA_CLOSURE: CL("a"), FAKE_PULAMA_STATUS_AFTER: ADMITTED } });
  assert.equal(r.status, 0, r.stdout);
  const lines = r.calls.split("\n");
  const at = (re) => lines.findIndex((l) => re.test(l));
  const build = at(/ build /), stop = at(/ stop lares$|down --remove-orphans/), lock = at(/pulama-main\.js lock$/), recreate = at(/up -d --force-recreate pulama/), light = at(/pulama-main\.js light --admit$/), up = at(/up -d --wait lares/), unlock = at(/ vault unlock --all$/), wear = at(/ wear 2 --yes$/);
  assert.ok(build >= 0 && stop > build && lock > stop && recreate > lock && light > recreate && up > light && unlock > up && wear > unlock, `order build, down, lock, recreate, light --admit, up, unlock, wear:\n${r.calls}`);
  assert.doesNotMatch(lines[light], / -T /, "the light reads the route on this terminal");
  // THE STRUCK FIRE ASKS THE PASSPHRASE ONCE: the light admitted the image, so no second admit reads a route.
  assert.equal(at(/pulama-main\.js admit$/), -1, `no second route:\n${r.calls}`);
  assert.match(r.stdout, /the pūlama's code closure moved; the pūlama lights on this terminal/);
  assert.match(r.stdout, /the house stands on revision 0123456789ab, wearing h2/);
  assert.doesNotMatch(r.stdout, /rebuild --resume|light it by hand/);
});
test(`${name}: CONTROL rebuild-still-admits-what-the-light-did-not: a light that admitted nothing leaves the admit owed, attached`, { skip: skip || !haveScript }, async () => {
  const r = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, tty: "", checkout: "clean", wornFace: 2, env: { ...REBUILT, FAKE_IMAGE_CLOSURE: CL("b"), FAKE_PULAMA_CLOSURE: CL("a") } });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.calls, /pulama-main\.js light --admit\n[\s\S]*pulama-main\.js admit\n/);
});
test(`${name}: RED F7 rebuild-lands-only-its-own-commit: a plain relight whose reported closure differs from the live commit's lands nothing (the commit stays for its own rite); CONTROL: a relight on the committed closure lands struck`, { skip: skip || !haveScript }, async () => {
  const after = (pending, closure) => `{"op":"status","lit":true,"admitted":["sha256:new"],"ended":[],"closure":"${closure}","keeper":{"successor":"${pending}"}}`;
  const other = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, tty: "", checkout: "clean", wornFace: 2, env: { ...REBUILT, FAKE_IMAGE_CLOSURE: CL("b"), FAKE_PULAMA_CLOSURE: CL("a"), FAKE_PULAMA_STATUS_AFTER: after(CL("c"), CL("b")) } });
  assert.equal(other.status, 0, other.stdout);
  assert.doesNotMatch(other.calls, /pulama-main\.js keeper-land/);
  const own = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, tty: "", checkout: "clean", wornFace: 2, env: { ...REBUILT, FAKE_IMAGE_CLOSURE: CL("b"), FAKE_PULAMA_CLOSURE: CL("a"), FAKE_PULAMA_STATUS_AFTER: after(CL("b"), CL("b")) } });
  assert.equal(own.status, 0, own.stdout);
  assert.match(own.calls, /pulama-main\.js keeper-land/);
});
const VEST_TO = "cd".repeat(32);
const VESTS = { ...REBUILT, FAKE_IMAGE_CLOSURE: CL("b"), FAKE_PULAMA_CLOSURE: CL("a"), FAKE_PULAMA_B_ID: "p2", FAKE_PULAMA_B_RUNNING: "1", FAKE_PULAMA_STATUS: `{"op":"status","lit":true,"admitted":["sha256:new"],"keeper":{"successor":"${CL("b")}"},"vestReady":"${CL("b")}","fire":true}`, FAKE_VEST_ANSWER: '{"op":"keeper-vest","reading":"vested","slot":{"body":{"act":"keeper-slot"},"signer":"s","sig":"g"}}' };
const RITE_OFFER = { "config/kukulu-offer.json": '{"lei":[],"unstrung":[],"vouch":[{"body":{"image":"sha256:new"}}]}\n' };
test(`${name}: RED keeper-stand-stands-the-successor: the rite's step before its offer stands pulama-b beside the lit keeper, reports its image and closure, and prints the key it offers`, { skip }, async () => {
  const r = await run(shim, ["keeper-stand"], { envFile: PULAMA_ENV, env: { ...VESTS, FAKE_PULAMA_B_RUNNING: "" } });
  assert.equal(r.status, 0, r.stderr);
  const lines = r.calls.split("\n");
  const at = (re) => lines.findIndex((l) => re.test(l));
  const stand = at(/up -d --force-recreate pulama-b/), image = at(/exec -T pulama-b node \S+ image sha256:new$/), closure = at(/exec -T pulama-b node \S+ closure sha256:b{64}$/), offer = at(/exec -T pulama-b node \S+ keeper-offer$/);
  assert.ok(stand >= 0 && image > stand && closure > image && offer > closure, `order:\n${r.calls}`);
  assert.deepEqual(JSON.parse(r.stdout.trim().split("\n").at(-1)), { op: "keeper-stand", to: "ab".repeat(32), closure: CL("b"), svc: "pulama-b" });
});
test(`${name}: RED rebuild-hands-the-living-fire: with the rite's move (--keeper-to) the lit keeper vests to the standing successor over the rite's offer, BEFORE the down; then the old keeper locks and stops, and the successor takes the fire; no route, no light`, { skip }, async () => {
  const r = await run(shim, ["rebuild", "--keeper-to", VEST_TO], { envFile: PULAMA_ENV, checkout: "clean", wornFace: 2, houseFiles: RITE_OFFER, env: VESTS });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lines = r.calls.split("\n");
  const at = (re) => lines.findIndex((l) => re.test(l));
  const vest = at(/exec -T pulama node \S+ keeper-vest \{"to":"(cd){32}","closure":"sha256:b{64}","offer":\{"lei":\[\],"unstrung":\[\],"vouch":/), receive = at(/exec -T pulama-b node \S+ keeper-receive \{"slot":/), down = at(/ stop lares$|down --remove-orphans/), lock = at(/exec -T pulama node \S+ lock$/), stop = at(/ stop pulama$/), take = at(/exec -T pulama-b node \S+ take-fire$/), up = at(/up -d --wait lares/);
  assert.ok(vest >= 0 && receive > vest && down > receive && lock > down && stop > lock && take > stop && up > take, `order:\n${r.calls}`);
  assert.equal(at(/pulama-main\.js light/), -1, "a handed fire asks no route");
  assert.equal(at(/up -d --force-recreate pulama/), -1, "no keeper is recreated: the rite stood the successor");
  assert.match(r.stderr.replace(/\s+/g, " "), /the keeper pair reads par; the successor \(pulama-b\) stands lit by vest, and asked no route/);
});
test(`${name}: CONTROL rebuild-without-the-rite's-move-relights-struck: a vest-ready reading with no --keeper-to stops the standing successor and lights by passphrase; no vest frame goes`, { skip }, async () => {
  const r = await run(shim, ["rebuild"], { envFile: PULAMA_ENV, tty: "", checkout: "clean", wornFace: 2, env: { ...VESTS, FAKE_PULAMA_STATUS_AFTER: ADMITTED } });
  assert.equal(r.status, 0, r.stdout);
  assert.doesNotMatch(r.calls, /keeper-vest/);
  assert.match(r.calls, / stop pulama-b[\s\S]*pulama-main\.js light --admit/);
});
test(`${name}: CONTROL rebuild-red-vest-leaves-the-old-fire: a refused vest (closure-differs) stops the successor, names the cure that runs, and moves nothing: no down, no lock, no take-fire`, { skip }, async () => {
  const r = await run(shim, ["rebuild", "--keeper-to", VEST_TO], { envFile: PULAMA_ENV, checkout: "clean", wornFace: 2, houseFiles: RITE_OFFER, env: { ...VESTS, FAKE_VEST_RC: "1", FAKE_VEST_ANSWER: '{"op":"keeper-vest","reading":"closure-differs"}' } });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr.replace(/\s+/g, " "), /the lit keeper refused the vest \(closure-differs\); the successor stopped and the old fire still burns, the vessel as it stood\. The cure that runs from here: `lares rite kukulu` on a terminal/);
  assert.match(r.calls, / stop pulama-b/);
  assert.doesNotMatch(r.calls, /keeper-receive|take-fire|pulama-main\.js lock|down --remove-orphans/);
});
test(`${name}: CONTROL rebuild-red-pair-locks-the-successor: a receive that reads the pair red stops the successor, and the old keeper stays lit and serving`, { skip }, async () => {
  const r = await run(shim, ["rebuild", "--keeper-to", VEST_TO], { envFile: PULAMA_ENV, checkout: "clean", wornFace: 2, houseFiles: RITE_OFFER, env: { ...VESTS, FAKE_RECEIVE_RC: "1", FAKE_RECEIVE_ANSWER: '{"op":"keeper-receive","reading":"faces-short"}' } });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr.replace(/\s+/g, " "), /the successor read the keeper pair red \(faces-short\) and locked; the old keeper passes the fire and writes nothing; the successor stopped/);
  assert.doesNotMatch(r.calls, /take-fire|pulama-main\.js lock/);
});
test(`${name}: RED keeper-settle-finishes-or-unwinds: two keepers with the successor lit and the holder passing finish (lock, stop, take-fire); a successor unlit and no move this run stops; one lit keeper holding no socket takes the fire`, { skip }, async () => {
  const two = { ...REBUILT, FAKE_PULAMA_B_ID: "p2", FAKE_PULAMA_B_RUNNING: "1", FAKE_IMAGE_REV_LABEL: "@HEAD@", FAKE_IMAGE_ID: "sha256:new", FAKE_PULAMA_IMAGE: "sha256:new", FAKE_PULAMA_STATUS: ADMITTED.replace("}", ',"fire":true,"passing":true}') };
  const finish = await run(shim, ["pulama", "take-fire"], { envFile: PULAMA_ENV, env: { ...two, FAKE_PULAMA_B_STATUS: '{"op":"status","lit":true,"fire":false}' } });
  assert.equal(finish.status, 0, finish.stderr);
  assert.match(finish.calls, /exec -T pulama node \S+ lock\n[\s\S]* stop pulama\n[\s\S]*exec -T pulama-b node \S+ take-fire/);
  const unwind = await run(shim, ["pulama", "take-fire"], { envFile: PULAMA_ENV, env: two });
  assert.equal(unwind.status, 0, unwind.stderr);
  assert.match(unwind.calls, / stop pulama-b/);
  assert.doesNotMatch(unwind.calls, /take-fire|pulama-main\.js lock/);
  // F5: the fire-holder restarted unlit (its passing lost with it) beside a successor that stands lit and landed par: the lit
  // successor takes the fire; the unlit holder never wins it.
  const restarted = await run(shim, ["pulama", "take-fire"], { envFile: PULAMA_ENV, env: { ...two, FAKE_PULAMA_STATUS: '{"op":"status","lit":false,"fire":true}', FAKE_PULAMA_B_STATUS: '{"op":"status","lit":true,"fire":false,"keeper":{"last":"par"}}' } });
  assert.equal(restarted.status, 0, restarted.stderr);
  assert.match(restarted.calls, /exec -T pulama-b node \S+ take-fire/);
  assert.doesNotMatch(restarted.calls, / stop pulama-b/);
  const alone = await run(shim, ["pulama", "take-fire"], { envFile: PULAMA_ENV, env: { ...REBUILT, FAKE_PULAMA_STATUS: '{"op":"status","lit":true,"fire":false}' } });
  assert.equal(alone.status, 0, alone.stderr);
  assert.match(alone.calls, /exec -T pulama node \S+ take-fire/);
});
test(`${name}: RED the fire's keeper serves: with two keepers running the verbs reach the one whose status holds the fire, and the operator's lock reaches both`, { skip }, async () => {
  const both = { ...REBUILT, FAKE_PULAMA_B_ID: "p2", FAKE_PULAMA_B_RUNNING: "1", FAKE_PULAMA_B_STATUS: '{"op":"status","lit":true,"fire":true}' };
  const status = await run(shim, ["pulama", "tessera"], { envFile: PULAMA_ENV, env: both });
  assert.match(status.calls, /exec (-T )?pulama-b node \S+ tessera/);
  const lock = await run(shim, ["pulama", "lock"], { envFile: PULAMA_ENV, env: both });
  assert.equal(lock.status, 0, lock.stderr);
  assert.match(lock.calls, /exec -T pulama node \S+ lock\n[\s\S]*exec -T pulama-b node \S+ lock/);
});
test(`${name}: rebuild-image-names-the-keeper: a moved closure a live commit names reads keeper vests; the struck fire due reads struck-due; CONTROL: no commit names no keeper`, { skip }, async () => {
  const vests = await run(shim, ["rebuild", "--image"], { envFile: PULAMA_ENV, checkout: "clean", env: VESTS });
  assert.match(vests.stdout, /"keeper":"vests"/);
  const due = await run(shim, ["rebuild", "--image"], { envFile: PULAMA_ENV, checkout: "clean", env: { ...VESTS, FAKE_PULAMA_STATUS: '{"op":"status","lit":true,"keeper":{"struckDue":true}}' } });
  assert.match(due.stdout, /"keeper":"struck-due"/);
  const none = await run(shim, ["rebuild", "--image"], { envFile: PULAMA_ENV, checkout: "clean", env: { ...VESTS, FAKE_PULAMA_STATUS: '{"op":"status","lit":true}' } });
  assert.doesNotMatch(none.stdout, /"keeper"/);
});
test(`${name}: pulama-name-successor-reads-a-terminal: with no terminal the successor naming refuses and names the lares verb; nothing reaches the pūlama`, { skip }, async () => {
  const r = await run(shim, ["pulama", "name-successor"], { envFile: PULAMA_ENV, checkout: "clean" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /pulama name-successor reads your route on a terminal; run `lares pulama name-successor` on one \(no successor named\)/);
  assert.doesNotMatch(r.calls, /name-successor/);
  const land = await run(shim, ["pulama", "keeper-land"], { envFile: PULAMA_ENV });
  assert.equal(land.status, 0, land.stderr);
  assert.match(land.calls, /exec -T pulama node \S+ keeper-land/);
});
test(`${name}: RED name-successor-lei-guards-the-spend: with no terminal and no route, a revision unreachable from origin/develop, an image label that differs from D′, a face of two devices, and a missing or red LOCAL bench verdict each refuse by name and send nothing to the pūlama; a green one sends one name-successor-lei frame naming D′, the branch, the revision, the verdict the host ran over that tree, the CI run as annotation and one device`, { skip: skip || shim !== SH }, async () => {
  const LEI = { ...REBUILT, FAKE_INTENT_SHOW: '{"devices":1}', FAKE_GH_RUN: "77:completed:success" };
  const spend = (env, origin = true) => run(shim, ["pulama", "name-successor", "--lei", "HEAD", "develop"], { envFile: PULAMA_ENV, checkout: "pulama", origin, env: { ...LEI, ...env } });
  const quiet = (r) => assert.doesNotMatch(r.calls, /name-successor-lei/);
  const far = await spend({ FAKE_IMAGE_CLOSURE: CL("b") }, false);
  assert.notEqual(far.status, 0);
  assert.match(far.stderr, /\(keeper-lei-unreachable\)[\s\S]*lares pulama name-successor/);
  quiet(far);
  const label = await spend({ FAKE_IMAGE_CLOSURE: CL("b") });
  assert.notEqual(label.status, 0);
  const d = label.stderr.match(/reads (sha256:[0-9a-f]{64}) \(keeper-lei-image-differs\)/)?.[1];
  assert.ok(d, label.stderr);
  quiet(label);
  // THE CHEAP GUARDS RUN FIRST: a face of two devices refuses before the bench gate runs at all.
  const two = await spend({ FAKE_IMAGE_CLOSURE: d, FAKE_INTENT_SHOW: '{"devices":2}' });
  assert.notEqual(two.status, 0);
  assert.match(two.stderr, /\(keeper-lei-cosign-owed\)[\s\S]*lares pulama name-successor/);
  assert.doesNotMatch(two.calls, /^BENCH /m);
  quiet(two);
  // THE LOCAL WITNESS DECIDES: a red verdict over the very tree refuses by name, quoting its line and the cure.
  const red = await spend({ FAKE_IMAGE_CLOSURE: d, FAKE_BENCH: "red" });
  assert.notEqual(red.status, 0);
  assert.match(red.calls, /^BENCH --verdict \S+\/cache\/bench\/[0-9a-f]{40}\.json$/m);
  assert.match(red.stderr.replace(/\s+/g, " "), /BENCH GATE REFUSES: build \(exit 1\)[\s\S]*\(keeper-lei-bench-red\)[\s\S]*lares rite kukulu again/);
  quiet(red);
  const none = await spend({ FAKE_IMAGE_CLOSURE: d, FAKE_BENCH: "none" });
  assert.notEqual(none.status, 0);
  assert.match(none.stderr.replace(/\s+/g, " "), /\(keeper-lei-bench-unread\)[\s\S]*node tools\/bench-gate\.mjs --verdict/);
  quiet(none);
  const green = await spend({ FAKE_IMAGE_CLOSURE: d });
  assert.equal(green.status, 0, green.stderr);
  const frame = green.calls.match(/exec -T pulama node \S+ name-successor-lei (\{.*\})/)?.[1];
  assert.ok(frame, green.calls);
  const f = JSON.parse(frame);
  assert.deepEqual({ ...f, rev: "r", tree: "t", bench: "v" }, { next: d, branch: "develop", rev: "r", tree: "t", recheck: "same", image: d, bench: "v", ci: "77:completed:success", devices: 1 });
  assert.match(f.rev, /^[0-9a-f]{40}$/);
  assert.deepEqual({ kind: f.bench.kind, rev: f.bench.rev, tree: f.bench.tree, code: f.bench.code }, { kind: "lares-bench-verdict", rev: f.rev, tree: f.tree, code: 0 });
  assert.match(green.stderr, /bench verdict sha256:[0-9a-f]{64} green/);
});
test(`${name}: RED web2-annotates-never-decides (ruling 2026-11-25): a red CI run prints loudly and still sends the frame, an unreachable gh reads unread and blocks nothing, and no gh on the PATH blocks nothing; the local verdict alone decides`, { skip: skip || shim !== SH }, async () => {
  const LEI = { ...REBUILT, FAKE_INTENT_SHOW: '{"devices":1}' };
  const first = await run(shim, ["pulama", "name-successor", "--lei", "HEAD", "develop"], { envFile: PULAMA_ENV, checkout: "pulama", origin: true, env: { ...LEI, FAKE_IMAGE_CLOSURE: CL("b") } });
  const d = first.stderr.match(/reads (sha256:[0-9a-f]{64}) \(keeper-lei-image-differs\)/)?.[1];
  assert.ok(d, first.stderr);
  const frameOf = (r) => JSON.parse(r.calls.match(/exec -T pulama node \S+ name-successor-lei (\{.*\})/)?.[1] ?? "null");
  const spend = (env) => run(shim, ["pulama", "name-successor", "--lei", "HEAD", "develop"], { envFile: PULAMA_ENV, checkout: "pulama", origin: true, env: { ...LEI, FAKE_IMAGE_CLOSURE: d, ...env } });
  const redCi = await spend({ FAKE_GH_RUN: "77:completed:failure" });
  assert.equal(redCi.status, 0, redCi.stderr);
  assert.match(redCi.stderr, /CI RED[\s\S]*77:completed:failure[\s\S]*annotation, never a gate/);
  assert.equal(frameOf(redCi)?.ci, "77:completed:failure");
  const down = await spend({ FAKE_GH_RC: "1", FAKE_GH_RUN: "" });
  assert.equal(down.status, 0, down.stderr);
  assert.equal(frameOf(down)?.ci, "unread");
  const noGh = await spend({ FAKE_NO_GH: "1" });
  assert.equal(noGh.status, 0, noGh.stderr);
  assert.equal(frameOf(noGh)?.ci, "unread");
  assert.doesNotMatch(noGh.calls, /^GH /m);
});
test(`${name}: RED name-successor-lei-stays-internal: the rite's own step refuses a person at a terminal and names the rite; nothing reaches the pūlama`, { skip: skip || shim !== SH || !haveScript }, async () => {
  const r = await run(shim, ["pulama", "name-successor", "--lei", "HEAD", "develop"], { envFile: PULAMA_ENV, checkout: "pulama", origin: true, tty: "", env: { ...REBUILT } });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /the rite's own step[\s\S]*lares rite kukulu/);
  assert.doesNotMatch(r.calls, /name-successor-lei/);
});
test(`${name}: RED rebuild-image-names-the-keeper-lei: a moved closure the keeper's lei could spend on reads keeper lei, a stale live commit too; CONTROL: a live, current hand commit or the struck fire due reads no lei`, { skip: skip || shim !== SH }, async () => {
  const lei = await run(shim, ["rebuild", "--image"], { envFile: PULAMA_ENV, checkout: "clean", env: { ...VESTS, FAKE_PULAMA_STATUS: '{"op":"status","lit":true,"keeper":{"v":1},"keeperLei":{"left":3,"floor":true},"leiReady":true}' } });
  assert.match(lei.stdout, /"keeper":"lei"/);
  const pending = await run(shim, ["rebuild", "--image"], { envFile: PULAMA_ENV, checkout: "clean", env: { ...VESTS, FAKE_PULAMA_STATUS: `{"op":"status","lit":true,"keeper":{"successor":"${CL("c")}"},"leiReady":true}` } });
  assert.doesNotMatch(pending.stdout, /"keeper":"lei"/);
  // A STALE live commit (the pūlama reads `staleSuccessor`) binds nothing current: the lei supersedes it, so the reading names lei.
  const stale = await run(shim, ["rebuild", "--image"], { envFile: PULAMA_ENV, checkout: "clean", env: { ...VESTS, FAKE_PULAMA_STATUS: `{"op":"status","lit":true,"keeper":{"successor":"${CL("c")}","staleSuccessor":true,"staleSuccessorWhy":"self-successor"},"leiReady":true}` } });
  assert.match(stale.stdout, /"keeper":"lei"/);
  const due = await run(shim, ["rebuild", "--image"], { envFile: PULAMA_ENV, checkout: "clean", env: { ...VESTS, FAKE_PULAMA_STATUS: '{"op":"status","lit":true,"keeper":{"struckDue":true},"leiReady":true}' } });
  assert.match(due.stdout, /"keeper":"struck-due"/);
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
  const wear = lines.findIndex((l) => / wear 2 --yes$/.test(l));
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
  assert.match(r.calls, /pulama-main\.js light --admit\n[\s\S]*up -d --wait lares[\s\S]*pulama-main\.js admit[\s\S]* wear 2/);
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

// THE CLOSURE NAMES ITS MEMBERS IN ONE ORDER (course pulama-unblur): `--list` prints each `<sha256>  <path>` it hashes, sorted by
// path, the same lines on every read, and the digest hashes exactly those lines.
test("pulama-closure: --list names every member it hashes, sorted by path and the same on each read, and the digest hashes those lines", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pulama-closure-"));
  try {
    await plantPulamaTree(dir);
    const read = (...a) => { const r = spawnSync("node", [join(ROOT, "tools/pulama-closure.mjs"), dir, ...a], { encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
    const list = read("--list");
    assert.equal(read("--list"), list, "two reads name the same members");
    const paths = list.trim().split("\n").map((l) => l.replace(/^[0-9a-f]{64}  /, ""));
    assert.deepEqual(paths, [...paths].sort(), "members print sorted by path");
    assert.deepEqual(paths, ["packages/lararium-mesh/package.json", "packages/lararium-mesh/src/index.ts", "packages/lararium-node/package.json", "packages/lararium-node/src/pulama-a.ts", "packages/lararium-node/src/pulama-main.ts"]);
    assert.equal(read().trim(), `sha256:${createHash("sha256").update(list).digest("hex")}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// A PULL REQUEST NAMES WHETHER IT MOVES THE CLOSURE (course pulama-unblur): tools/pulama-closure-moves.mjs reads two revisions of a
// checkout and prints `yes` with the members that moved, `no`, or `unread`; every reading exits 0, informational in CI.
test("pulama-closure-moves: a commit the pūlama never reaches reads no; one it reaches reads yes and names the member; an unknown revision reads unread; all exit 0", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pulama-closure-moves-"));
  try {
    await plantPulamaTree(dir);
    const git = (...a) => spawnSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf8" });
    git("init", "-q"); git("add", "."); git("commit", "-qm", "seed");
    await writeFile(join(dir, "packages/lararium-node/src/main.ts"), "export const vessel = 9;\n");
    git("commit", "-qam", "vessel only");
    await writeFile(join(dir, "packages/lararium-node/src/pulama-a.ts"), "export const a = 9;\n");
    git("commit", "-qam", "pulama");
    const moves = (...a) => spawnSync("node", [join(ROOT, "tools/pulama-closure-moves.mjs"), ...a], { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() } });
    const no = moves("HEAD~2", "HEAD~1");
    assert.equal(no.status, 0, no.stderr);
    assert.match(no.stdout, /^moves the pūlama closure: no \(sha256:[0-9a-f]{12}\)$/m);
    const yes = moves("HEAD~1", "HEAD");
    assert.equal(yes.status, 0, yes.stderr);
    assert.match(yes.stdout, /^moves the pūlama closure: yes \(sha256:[0-9a-f]{12} -> sha256:[0-9a-f]{12}\)/m);
    assert.match(yes.stdout, /^- `packages\/lararium-node\/src\/pulama-a\.ts` moves$/m);
    assert.doesNotMatch(yes.stdout, /main\.ts/);
    const unread = moves("no-such-rev", "HEAD");
    assert.equal(unread.status, 0);
    assert.match(unread.stdout, /^moves the pūlama closure: unread \(no-such-rev: /m);
    assert.equal(moves().status, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// THE KŪKULU READING (course pulama-unblur): `pulama status` names, from the checkout's closure against the running pūlama's, the
// pūlama's status and the kukulu lei on the checkout's branch, whether the next kūkulu runs alone or needs a hand. One table
// (packages/lares-cli/tests/fixtures/kukulu-hand.json) welds this line to rite-kukulu.ts `kukuluHand` and to the rite itself.
test("sh: pulama-status-names-the-kukulu-reading: each row of the shared table reads its one line behind `pulama status`", async () => {
  const table = JSON.parse(await readFile(join(ROOT, "packages/lares-cli/tests/fixtures/kukulu-hand.json"), "utf8"));
  const planted = await mkdtemp(join(tmpdir(), "pulama-closure-"));
  let mine;
  try { await plantPulamaTree(planted); mine = spawnSync("node", [join(ROOT, "tools/pulama-closure.mjs"), planted], { encoding: "utf8" }).stdout.trim(); }
  finally { await rm(planted, { recursive: true, force: true }); }
  const leiShow = { true: { standing: true, returnsLeft: 3 }, absent: { refusal: "absent" }, "returns-spent": { standing: true, returnsLeft: 0 } };
  for (const row of table.rows) {
    const f = { vessel: "standing", current: false, keeper: null, ...row.facts };
    // `admitted` and `offer` name the image the tag holds where it carries the head (its revision label), whatever the vessel runs;
    // `kept`: the tag holds an older revision, and a kept image `rev-<head12>` carries the head's, so they name that one.
    const himg = f.kept ? "sha256:kept" : "sha256:new";
    const status = { op: "status", ...(f.lit === null ? {} : { lit: f.lit }), ...(f.keeper === "struck-due" ? { keeper: { struckDue: true } } : {}), ...(f.keeper === "vests" ? { vestReady: mine } : {}), ...(f.keeper === "lei" ? { leiReady: true } : {}), ...(f.admitted ? { admitted: [himg] } : {}) };
    const env = {
      FAKE_IMAGE_ID: "sha256:new", FAKE_IMAGE_REV_LABEL: (f.admitted || f.offer) && !f.kept ? "@HEAD@" : "e".repeat(40),
      ...(f.kept ? { FAKE_KEPT_ID: himg, FAKE_KEPT_LABEL: "@HEAD@" } : {}),
      ...(f.pulama === "absent" ? {} : { FAKE_PULAMA_ID: "p1", FAKE_PULAMA_IMAGE: "sha256:old", FAKE_PULAMA_CLOSURE: f.pulama === "level" ? mine : `sha256:${"b".repeat(64)}`, FAKE_PULAMA_STATUS: JSON.stringify(status) }),
      ...(f.vessel === "standing" ? { FAKE_RUNNING_ID: "cid", FAKE_VESSEL_IMAGE: "sha256:vimg", FAKE_VESSEL_REV_LABEL: f.current ? "@HEAD@" : "f".repeat(40) } : {}),
      ...(f.lei === null ? {} : { FAKE_LEI_SHOW: JSON.stringify({ ok: true, data: { lei: leiShow[String(f.lei)] } }) }),
    };
    const houseFiles = f.offer ? { "config/kukulu-offer.json": `{"faces":[{"image":"${himg}"}]}\n` } : {};
    const r = await run(SH, ["pulama", "status"], { envFile: PULAMA_ENV, checkout: "pulama", env, houseFiles, ...(f.sync ? { sync: f.sync } : {}) });
    assert.equal(r.status, 0, `${row.name}: ${r.stderr}`);
    const said = /^lares-container: kūkulu at [0-9a-f]{12}: (.*?)(?: · closure (sha256:[0-9a-f]{12}) · pūlama (\S+))?$/m.exec(r.stderr);
    assert.ok(said, `${row.name}: no kūkulu line in ${r.stderr}`);
    assert.equal(said[1], row.line, `${row.name}\nCALLS ${r.calls}`);
    // A sync that stops names no closure: the rite stops before any image.
    const stops = row.line.includes("the rite stops at the sync") || row.line.endsWith("stands detached");
    if (stops) {
      assert.equal(said[2], undefined, row.name);
      assert.doesNotMatch(r.calls, /lei show/, `${row.name}: a sync that stops reads no lei (a detached head names no branch)`);
    } else assert.equal(said[2], mine.slice(0, 19), `${row.name}: the line names the checkout's closure`);
    if (f.lei !== null && f.vessel === "standing" && !stops) assert.match(r.calls, /exec -T lares node \S+ lei show --rite kukulu --branch \S+ --json/, row.name);
  }
  // No closure reads (a checkout with no pūlama entry): the line says so, and the status still answers.
  const bare = await run(SH, ["pulama", "status"], { envFile: PULAMA_ENV, checkout: "clean", env: { FAKE_PULAMA_ID: "p1" } });
  assert.equal(bare.status, 0, bare.stderr);
  assert.match(bare.stderr, /^lares-container: kūkulu at [0-9a-f]{12}: reads unknown: the checkout's pūlama closure reads nowhere/m);
  assert.match(bare.calls, /pulama-main\.js status/);
});

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

for (const [name, shim, skip] of [["sh", SH, false], ["ps1", PS1, !havePwsh]]) {
  const env = { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w", FAKE_RUNNING_ID: "vessel" };
  const wire = ["tiddler", "put", "T", "--recipe", "default"];
  const bytes = Buffer.from("one\r\ntwo\r\n\r\n");
  for (const [flag, expected] of [[["--file", "@HOST_FILE@"], /--file -/], ...(name === "sh" ? [[["--file=@HOST_FILE@"], /--file=-/]] : [])]) {
    test(`${name}: plain put carries ${flag[0]} host bytes`, { skip }, async () => {
      const r = await run(shim, [...wire, ...flag], { env, hostInput: bytes });
      assert.equal(r.status, 0, r.stderr); assert.deepEqual(r.received, bytes); assert.match(r.calls, expected);
    });
  }
  for (const [label, flags, hostInput] of [["missing file", ["--file", "@HOST_FILE@"]], ["empty file", ["--file="]], ["two files", ["--file", "@HOST_FILE@", "--file", "@HOST_FILE@"], bytes]]) {
    test(`${name}: plain put refuses ${label} before docker`, { skip }, async () => {
      const r = await run(shim, [...wire, ...flags], { env, hostInput });
      assert.notEqual(r.status, 0); assert.equal(r.calls, "");
    });
  }
  test(`${name}: plain put passes stdin and leaves a flag-shaped value alone`, { skip }, async () => {
    const piped = await run(shim, [...wire, "--file", "-"], { env, input: bytes });
    assert.deepEqual(piped.received, bytes);
    const value = await run(shim, [...wire, "--text", "--file", "--text", "--meme"], { env });
    assert.equal(value.status, 0, value.stderr); assert.equal(value.received, null);
    // `--text --meme` carries "--meme" as a value, so this put stays plain, and its `--append` streams the host file.
    const memeValue = await run(shim, [...wire, "--text", "--meme", "--slot", "#/a", "--append", "@HOST_FILE@"], { env, hostInput: bytes });
    assert.equal(memeValue.status, 0, memeValue.stderr); assert.deepEqual(memeValue.received, bytes);
    assert.match(memeValue.calls, /--append -/);
    const get = await run(shim, ["tiddler", "get", "T", "--file", "@HOST_FILE@"], { env, hostInput: bytes });
    assert.equal(get.status, 0, get.stderr); assert.equal(get.received, null);
    assert.match(get.calls, /--file .*host\.mem/);
  });
}


for (const [name, shim, skip] of [["sh", SH, false], ["ps1", PS1, !havePwsh]]) {
  const env = { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w", FAKE_RUNNING_ID: "vessel" };
  const wire = ["tiddler", "put", "T"];
  test(`${name}: a vessel refusal survives an unread host stream`, { skip }, async () => {
    for (const size of [10, 1024 * 1024]) {
      const r = await run(shim, [...wire, "--file", "@HOST_FILE@"], { env, hostInput: Buffer.alloc(size), refuseInput: true });
      assert.equal(r.status, 2, r.stderr); assert.match(r.stderr, /usage refusal/); assert.doesNotMatch(r.calls, / stop INT /);
    }
  });
  test(`${name}: non-regular host sources refuse before docker`, { skip }, async () => {
    for (const [path, fifo] of [["@HOST_FILE@", true], ["/dev/zero", false], ["/proc/self/stat", false]]) {
      const r = await run(shim, [...wire, "--file", path], { env, fifo });
      assert.equal(r.status, 2, r.stderr); assert.match(r.stderr, /cannot read host file/); assert.equal(r.calls, "");
    }
  });
  test(`${name}: option and command spelling keep case`, { skip }, async () => {
    for (const args of [[...wire, "--FILE", "@HOST_FILE@"], ["TIDDLER", "PUT", "T", "--file", "@HOST_FILE@"]]) {
      const r = await run(shim, args, { env, hostInput: "host" });
      assert.equal(r.status, 0, r.stderr); assert.equal(r.received, null); assert.match(r.calls, /host\.mem/);
    }
  });
  test(`${name}: an equals source carries a newline in its path`, { skip: skip || name === "ps1" }, async () => {
    const r = await run(shim, [...wire, "--file=@HOST_FILE@"], { env, hostName: "a\nb", hostInput: "host" });
    assert.equal(r.status, 0, r.stderr); assert.deepEqual(r.received, Buffer.from("host"));
  });
  test(`${name}: end of options leaves later sources untouched`, { skip }, async () => {
    const r = await run(shim, [...wire, "--", "--file", "@HOST_FILE@"], { env, hostInput: "host" });
    assert.equal(r.status, 0, r.stderr); assert.equal(r.received, null); assert.match(r.calls, /-- --file .*host\.mem/);
  });
  test(`${name}: valued options follow the CLI peek rule`, { skip }, async () => {
    for (const flag of ["--recipe", "--tag-add", "--slot", "--file"]) {
      const r = await run(shim, [...wire, flag, "--file", "@HOST_FILE@"], { env, hostInput: "host" });
      assert.equal(r.status, 0, `${flag}: ${r.stderr}`); assert.deepEqual(r.received, Buffer.from("host"), flag);
    }
    for (const flag of ["--fields", "--note", "--reason", "--text"]) {
      const r = await run(shim, [...wire, flag, "--file", "@HOST_FILE@"], { env, hostInput: "host" });
      assert.equal(r.status, 0, r.stderr); assert.equal(r.received, null, flag);
    }
  });
}


test("shim flag sets track the built CLI parser", async () => {
  const { BOOLEAN_FLAGS, VALUE_FLAGS } = await import("../packages/lares-cli/dist/src/parse-args.js");
  const sh = await readFile(SH, "utf8"), ps = await readFile(PS1, "utf8");
  const sorted = (xs) => [...xs].sort();
  const shBoolean = [...sh.matchAll(/\*=\*\|--no-\*\|(--accept-omissions[^)]*)\)/g)].map(m => m[1].split("|").map(x => x.slice(2)));
  const shValue = [...sh.matchAll(/(--fields\|--note\|--reason\|--text)\)/g)].map(m => m[1].split("|").map(x => x.slice(2)));
  const psList = (name) => [...ps.match(new RegExp(`\\$${name} = @\\(([^)]*)\\)`))[1].matchAll(/'([^']+)'/g)].map(m => m[1].replace(/^--/, ""));
  assert.equal(shBoolean.length, 2); assert.equal(shValue.length, 2);
  for (const flags of [...shBoolean, psList("boolean")]) assert.deepEqual(sorted(flags), sorted(BOOLEAN_FLAGS));
  for (const flags of [...shValue, psList("alwaysValued")]) assert.deepEqual(sorted(flags), sorted(VALUE_FLAGS));
});

for (const [name, shim, skip] of [["sh", SH, false], ["ps1", PS1, !havePwsh]]) {
  test(`${name}: a colon followed by dashes stays in the named file path`, { skip }, async () => {
    const r = await run(shim, ["tiddler", "put", "T", "--file", "@HOST_FILE@"], { env: { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w", FAKE_RUNNING_ID: "vessel" }, hostName: "x:--y", hostInput: "named" });
    assert.equal(r.status, 0, r.stderr); assert.deepEqual(r.received, Buffer.from("named"));
  });
}
test("ps1: equals sources refuse before a colon can select a different host file", { skip: !havePwsh }, async () => {
  for (const flag of ["--file", "--append"]) {
    const r = await run(PS1, ["tiddler", "put", "T", "--meme", "--slot", "#/a", `${flag}=@HOST_FILE@`], { env: { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w", FAKE_RUNNING_ID: "vessel" }, hostName: "a:b", hostInput: "named", hostSibling: "wrong" });
    assert.notEqual(r.status, 0); assert.match(r.stderr, /SeparateSourceToken/); assert.equal(r.received, null); assert.equal(r.calls, "");
  }
});

for (const [name, shim, skip] of [["sh", SH, false], ["ps1", PS1, !havePwsh]]) {
  const env = { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w", FAKE_RUNNING_ID: "vessel" };
  test(`${name}: dash-prefixed source paths preserve the host file or refuse before docker`, { skip }, async () => {
    for (const flag of ["--file", "--append"]) {
      for (const slot of [[], ["--meme", "--slot", "#/a"]]) {
        const r = await run(shim, ["tiddler", "put", "T", ...slot, flag, "-x:y"], { env, hostCwd: true, hostName: "-x:y", hostInput: "right", hostSibling: "wrong" });
        if (name === "ps1") {
          assert.notEqual(r.status, 0); assert.match(r.stderr, /path starts with \.\//); assert.equal(r.calls, "");
        } else {
          assert.equal(r.status, 0, r.stderr); assert.deepEqual(r.received, Buffer.from("right"));
        }
      }
    }
  });
  test(`${name}: equals stdin sources pass through`, { skip }, async () => {
    for (const flag of ["--file", "--append"]) {
      const r = await run(shim, ["tiddler", "put", "T", "--meme", "--slot", "#/a", `${flag}=-`], { env, input: "stdin bytes" });
      assert.equal(r.status, 0, r.stderr); assert.deepEqual(r.received, Buffer.from("stdin bytes"));
    }
  });
}

test("the hand verbs the shims send to the pūlama stay the names it dispatches (name-successor, name-successor-lei)", async () => {
  const { readFileSync } = await import("node:fs");
  const { handVerbExit } = await import("../packages/lararium-node/dist/src/pulama-verbs.js");
  const sh = readFileSync(new URL("./lares-container.sh", import.meta.url), "utf8");
  const ps = readFileSync(new URL("./lares-container.ps1", import.meta.url), "utf8");
  // The pūlama knows each op as an act that must land: its landing reading exits 0 and a refusal exits 1 (an op it never
  // dispatches exits 0 on any reading, so a renamed op reads red here).
  for (const op of ["name-successor", "name-successor-lei"]) {
    assert.equal(handVerbExit(op, { reading: "named" }), 0, `the pūlama lands ${op} on "named"`);
    assert.equal(handVerbExit(op, { reading: "pulama-locked" }), 1, `the pūlama dispatches ${op}`);
  }
  assert.match(sh, /node "\$PULAMA_MAIN" name-successor "/);
  assert.match(sh, /node "\$PULAMA_MAIN" name-successor-lei "/);
  assert.match(ps, /\$PulamaMain, 'name-successor'/);
});
