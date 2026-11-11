/**
 * host-bridge — the host `lares` forwards a vessel verb to the container house when LAR_ROOT names no root.
 *
 * Two halves. `decideRoute` reads argv, env and a file probe and answers `local`, `forward` or a named refusal;
 * every branch stands below. Then the built binary runs with LAR_ROOT unset against a scratch HOME holding a
 * container env file, the REAL `tools/lares-container.sh`, and a fake `docker` on PATH that logs its argv, so the
 * whole bridge (argv fidelity, stdout passthrough, exit codes, TTY, env names, Ctrl+C) reads off one log. No
 * container stands and no real docker runs.
 */
import { describe, it, expect } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decideRoute, commandScope, CREDENTIAL_TTY_EXIT, HOUSE_ABSENT_EXIT, SHIM_ABSENT_EXIT, FORWARDED_ENV,
  PATH_OUTSIDE_EXIT, mountsOf, translatePaths, type Mount, type RouteInput,
} from "../src/host-bridge.js";
import { COMMAND_NAMES } from "../src/bin/lares.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const SHIM = join(REPO, "tools", "lares-container.sh");
const BIN = join(HERE, "..", "bin", "lares.mjs");

const HOME = "/home/op";
const ENV_FILE = `${HOME}/.lares/lares-surface.env`;

function input(argv: string[], over: Partial<RouteInput> = {}, files: string[] = [ENV_FILE, SHIM]): RouteInput {
  return {
    argv,
    env: { HOME },
    fsProbe: { exists: (p: string) => files.includes(p) },
    tty: true,
    shim: SHIM,
    commands: COMMAND_NAMES,
    ...over,
  };
}

describe("decideRoute — every branch", () => {
  it("LAR_ROOT named: always local, even for a vessel verb and a shim verb", () => {
    expect(decideRoute(input(["meme", "get", "x", "--bag", "b"], { env: { HOME, LAR_ROOT: "/h" } }))).toBe("local");
    expect(decideRoute(input(["up"], { env: { HOME, LAR_ROOT: "/h" } }))).toBe("local");
  });

  it("a blank LAR_ROOT reads as unset", () => {
    expect(decideRoute(input(["meme", "get", "x", "--bag", "b"], { env: { HOME, LAR_ROOT: "  " } }))).toBe("forward");
  });

  it("inside the vessel (the image's marker) never forwards, so a missing LAR_ROOT cannot loop", () => {
    expect(decideRoute(input(["meme", "get", "x", "--bag", "b"], { env: { HOME, LARES_IN_CONTAINER: "1" } }))).toBe("local");
  });

  it("a host that itself runs in a container (a CI job, a devcontainer: /.dockerenv stands) still forwards", () => {
    expect(decideRoute(input(["meme", "get", "x", "--bag", "b"], {}, [ENV_FILE, SHIM, "/.dockerenv"]))).toBe("forward");
  });

  it("a vessel verb with the container house standing forwards", () => {
    for (const argv of [["meme", "get", "x", "--bag", "b"], ["vault", "status"], ["vessel", "read"], ["vessel", "stand"], ["persona", "list"]]) {
      expect(decideRoute(input(argv)), argv.join(" ")).toBe("forward");
    }
  });

  it("the shim's own verbs forward (up, down, reset, found, logs, build)", () => {
    for (const v of ["up", "down", "reset", "found", "logs", "build"]) expect(decideRoute(input([v])), v).toBe("forward");
  });

  it("host verbs stay local: home, repo, help, wing-of, mempalace", () => {
    for (const argv of [["home", "read"], ["home", "tend"], ["repo", "tend"], ["help"], ["wing-of", "t.jsonl"], ["mempalace", "status"]]) {
      expect(decideRoute(input(argv)), argv.join(" ")).toBe("local");
    }
  });

  it("global and per-command help stays local, and so does bare `lares` and --version", () => {
    for (const argv of [[], ["--help"], ["-h"], ["--version"], ["meme", "--help"], ["vault", "unlock", "-h"]]) {
      expect(decideRoute(input(argv, {}, [])), argv.join(" ")).toBe("local");
    }
  });

  it("a `--help` after `--` reads as a positional and the verb forwards", () => {
    expect(decideRoute(input(["meme", "get", "x", "--bag", "b", "--", "--help"]))).toBe("forward");
  });

  it("meme's local seats stay local; its store seats forward", () => {
    expect(decideRoute(input(["meme", "normalize", "a.mem"]))).toBe("local");
    expect(decideRoute(input(["meme", "check", "a.mem", "--gradient"]))).toBe("local");
    expect(decideRoute(input(["meme", "project", "a.mem", "--to", "md"]))).toBe("local");
    expect(decideRoute(input(["meme", "project", "a.mem", "--to=md", "--bag", "b"]))).toBe("local");
    expect(decideRoute(input(["meme", "project", "lar:///x", "--to", "md", "--bag", "b"]))).toBe("forward");
    expect(decideRoute(input(["meme", "project", "a.mem", "--to", "html", "--bag", "b"]))).toBe("forward");
  });

  it("an unknown command stays local, so the CLI names it unknown rather than reaching for a house", () => {
    expect(decideRoute(input(["nosuchverb"], {}, []))).toBe("local");
  });

  it("argv the grammar refuses stays local, where the dispatcher names the refusal", () => {
    expect(decideRoute(input(["meme", "get", "x", "--bag", "b", "--=v"], {}, []))).toBe("local");
  });

  it("no env file: a vessel verb refuses with the distinct house-absent code, naming LAR_ROOT and the shim", () => {
    const r = decideRoute(input(["vault", "unlock"], {}, [SHIM]));
    expect(typeof r).toBe("object");
    if (typeof r !== "object") return;
    expect(r.error.code).toBe(HOUSE_ABSENT_EXIT);
    expect(r.error.lines.length).toBeLessThanOrEqual(3);
    const text = r.error.lines.join("\n");
    expect(text).toMatch(/^lares: no house root/);
    expect(text).toContain("LAR_ROOT");
    expect(text).toContain(ENV_FILE);
    expect(text).toContain(`${SHIM} up`);
  });

  it("no HOME: the env file cannot be named, so it reads as absent", () => {
    const r = decideRoute(input(["meme", "get", "x", "--bag", "b"], { env: {} }));
    expect(typeof r === "object" && r.error.code).toBe(HOUSE_ABSENT_EXIT);
  });

  it("the env file stands and the shim does not: the distinct shim-absent code", () => {
    const r = decideRoute(input(["meme", "get", "x", "--bag", "b"], {}, [ENV_FILE]));
    expect(typeof r === "object" && r.error.code).toBe(SHIM_ABSENT_EXIT);
    expect(typeof r === "object" && r.error.lines.join("\n")).toContain(SHIM);
  });

  it("no shim located at all (an installed CLI outside a checkout): shim-absent", () => {
    const r = decideRoute(input(["meme", "get", "x", "--bag", "b"], { shim: null }));
    expect(typeof r === "object" && r.error.code).toBe(SHIM_ABSENT_EXIT);
  });

  it("credential verbs refuse by name with no TTY, never falling back to -T", () => {
    for (const argv of [["vault", "unlock"], ["vault", "bind"], ["vault", "unbind"], ["found"], ["vessel", "found", "--hearth"]]) {
      const r = decideRoute(input(argv, { tty: false }));
      expect(typeof r === "object" && r.error.code, argv.join(" ")).toBe(CREDENTIAL_TTY_EXIT);
      expect(typeof r === "object" && r.error.lines.join("\n")).toMatch(/terminal/);
    }
  });

  it("CONTROL: credential verbs forward on a TTY; other verbs forward without one", () => {
    expect(decideRoute(input(["vault", "unlock"]))).toBe("forward");
    expect(decideRoute(input(["vault", "status"], { tty: false }))).toBe("forward");
    expect(decideRoute(input(["up"], { tty: false }))).toBe("forward");
  });
});

describe("translatePaths — a host path in a forwarded argv reads as the vessel spells it", () => {
  const H = "/home/op/lares-house", W = "/home/op/checkout";
  const mounts: Mount[] = mountsOf({ LARES_HOUSE: H, LARES_WORKSPACE: W }, null, (p) => p);
  const fs = { realpath: (p: string) => p, exists: () => true };
  const tr = (argv: string[], cwd = "/home/op") => translatePaths({ argv, cwd, home: "/home/op", mounts, fs });
  const ok = (argv: string[], cwd?: string) => { const r = tr(argv, cwd); if ("error" in r) throw new Error(r.error.lines.join("\n")); return r.argv; };

  it("the mount table: five house classes under /lar, the checkout under /workspace", () => {
    expect(mounts).toEqual(expect.arrayContaining([
      { host: `${H}/hearth`, container: "/lar/hearth" }, { host: `${H}/sensoriums`, container: "/lar/sensoriums" },
      { host: `${H}/projections`, container: "/lar/projections" }, { host: `${H}/library`, container: "/lar/library" },
      { host: `${H}/config`, container: "/lar/config" }, { host: W, container: "/workspace" },
    ]));
  });

  it("the env file names the mounts when the environment does not; the environment wins", () => {
    expect(mountsOf({}, `LARES_HOUSE=/a\nLARES_WORKSPACE=/b\nLARES_HOUSE=/c\n`, (p) => p)).toContainEqual({ host: "/c/config", container: "/lar/config" });
    expect(mountsOf({ LARES_WORKSPACE: "/env" }, "LARES_WORKSPACE=/file\n", (p) => p)).toContainEqual({ host: "/env", container: "/workspace" });
  });

  it("translation table: positional and option paths, both option spellings", () => {
    expect(ok(["export", `${H}/config/carry/b1`])).toEqual(["export", "/lar/config/carry/b1"]);
    expect(ok(["import", `${H}/config/carry/b1`, "--apply"])).toEqual(["import", "/lar/config/carry/b1", "--apply"]);
    expect(ok(["vault", "backup", "--face", "0", "--out", `${H}/config/f.bundle`])).toEqual(["vault", "backup", "--face", "0", "--out", "/lar/config/f.bundle"]);
    expect(ok(["ingest", `--source=${W}/notes`, "--to", "b"])).toEqual(["ingest", "--source=/workspace/notes", "--to", "b"]);
    expect(ok(["meme", "put", "lar:///x", "--bag", "b", "--file", `${W}/bags/x.mem`])).toEqual(["meme", "put", "lar:///x", "--bag", "b", "--file", "/workspace/bags/x.mem"]);
    expect(ok(["nexus", "admit-take", `${W}/admit.json`])).toEqual(["nexus", "admit-take", "/workspace/admit.json"]);
    expect(ok(["fleet", "join", "land", `${H}/config/answer.json`])).toEqual(["fleet", "join", "land", "/lar/config/answer.json"]);
    expect(ok(["nexus", "seal", "roll", "file", `${W}/r.mem`])).toEqual(["nexus", "seal", "roll", "file", "/workspace/r.mem"]);
    expect(ok(["circle", "card", `@${W}/card.txt`])).toEqual(["circle", "card", "@/workspace/card.txt"]);
  });

  it("a relative path reads from the cwd: inside the checkout it lands under /workspace", () => {
    expect(ok(["export", "./carry/b1"], `${H}/config`)).toEqual(["export", "/lar/config/carry/b1"]);
    expect(ok(["meme", "project", "bags/x.mem", "--to", "html", "--bag", "b"], W)).toEqual(["meme", "project", "/workspace/bags/x.mem", "--to", "html", "--bag", "b"]);
  });

  it("~ expands to HOME", () => {
    expect(ok(["export", "~/lares-house/config/b1"])).toEqual(["export", "/lar/config/b1"]);
  });

  it("realpath where the path exists: a symlinked spelling lands where it resolves", () => {
    const linked = translatePaths({ argv: ["export", "/home/op/link/b1"], cwd: "/", home: "/home/op", mounts,
      fs: { exists: () => true, realpath: (p: string) => p.replace("/home/op/link", `${H}/config`) } });
    expect(linked).toEqual({ argv: ["export", "/lar/config/b1"] });
  });

  it("a container spelling passes unchanged", () => {
    expect(ok(["export", "/lar/config/carry/b1"])).toEqual(["export", "/lar/config/carry/b1"]);
    expect(ok(["nexus", "seal", "import", "--carry", "/workspace/founding-roster.mem"])).toEqual(["nexus", "seal", "import", "--carry", "/workspace/founding-roster.mem"]);
    expect(ok(["vessel", "found", "--genesis", "/app/genesis"])).toEqual(["vessel", "found", "--genesis", "/app/genesis"]);
  });

  it("an argument that only looks like a path stays untouched", () => {
    expect(ok(["act", "REPACK", "--source", `${W}/b.tid`, "--from", "some/bag/like"])).toEqual(["act", "REPACK", "--source", "/workspace/b.tid", "--from", "some/bag/like"]);
    expect(ok(["meme", "get", "lar:///a/b", "--bag", "./not/a/path"])).toEqual(["meme", "get", "lar:///a/b", "--bag", "./not/a/path"]);
    expect(ok(["meme", "project", "lar:///x/y", "--to", "html", "--bag", "b"])).toEqual(["meme", "project", "lar:///x/y", "--to", "html", "--bag", "b"]);
    expect(ok(["persona", "new", "0", "--name", "/etc/passwd"])).toEqual(["persona", "new", "0", "--name", "/etc/passwd"]);
  });

  it("cabal --bundle translates a file that exists and leaves literal JSON alone", () => {
    const has = (p: string) => p === `${W}/b.json`;
    const r1 = translatePaths({ argv: ["cabal", "join", "--bundle", `${W}/b.json`], cwd: "/", home: "/home/op", mounts, fs: { exists: has, realpath: (p) => p } });
    expect(r1).toEqual({ argv: ["cabal", "join", "--bundle", "/workspace/b.json"] });
    const r2 = translatePaths({ argv: ["cabal", "join", "--bundle", '{"a":1}'], cwd: "/", home: "/home/op", mounts, fs: { exists: has, realpath: (p) => p } });
    expect(r2).toEqual({ argv: ["cabal", "join", "--bundle", '{"a":1}'] });
  });

  it("a host path outside every mount refuses by name, in three lines, with the distinct code", () => {
    const r = tr(["export", "/tmp/carry"]);
    expect("error" in r).toBe(true);
    if (!("error" in r)) return;
    expect(r.error.code).toBe(PATH_OUTSIDE_EXIT);
    expect(r.error.lines.length).toBeLessThanOrEqual(3);
    const text = r.error.lines.join("\n");
    expect(text).toContain("/tmp/carry");
    expect(text).toContain("/lar/config");
    expect(text).toContain(`${H}/config`);
    expect(text).toContain(W);
  });

  it("a prefix that only shares letters with a mount stays outside it", () => {
    expect("error" in tr(["export", `${H}/configs/b1`])).toBe(true);
    expect("error" in tr(["export", `${W}-old/b1`])).toBe(true);
  });
});

describe("commandScope — help marks every verb", () => {
  it("every command in the table carries a scope", () => {
    for (const name of COMMAND_NAMES) expect(["host", "vessel", "mixed"], name).toContain(commandScope(name));
  });
  it("home and repo read host; vault reads vessel; meme reads mixed", () => {
    expect(commandScope("home")).toBe("host");
    expect(commandScope("repo")).toBe("host");
    expect(commandScope("vault")).toBe("vessel");
    expect(commandScope("meme")).toBe("mixed");
  });
  it("the forwarded env names carry display and debug alone", () => {
    expect([...FORWARDED_ENV].sort()).toEqual(["COLORTERM", "LARES_DEBUG", "NO_COLOR", "TERM"]);
  });
});

// ── the built binary, the real shim, a fake docker ─────────────────────────────────────────────────

interface Bench { dir: string; home: string; log: string; env: Record<string, string> }

function bench(opts: { envFile?: boolean; running?: boolean } = {}): Bench {
  const dir = mkdtempSync(join(tmpdir(), "host-bridge-"));
  const home = join(dir, "home");
  mkdirSync(join(home, ".lares"), { recursive: true });
  const house = join(dir, "house");
  if (opts.envFile !== false) writeFileSync(join(home, ".lares", "lares-surface.env"), `LARES_HOUSE=${house}\nLARES_WORKSPACE=/w\n`);
  const log = join(dir, "calls.log");
  // One argv per call, each arg on its own line between markers, so quoting and empty strings read exact.
  writeFileSync(join(dir, "docker"), [
    "#!/bin/sh",
    `{ printf 'CALL\\n'; for a in "$@"; do printf '[%s]\\n' "$a"; done; } >> "$CALL_LOG"`,
    `case " $* " in *" ps -q --status running lares "*) printf '%s' "\${FAKE_RUNNING_ID:-}"; exit 0;; esac`,
    `case " $* " in *" --observe --json "*) printf '%s\\n' '{"data":{"standing":{"act":"attach","reason":"steady"}}}'; exit 0;; esac`,
    `case " $* " in *" sh -c "*|*" stop "*|*" rm -f "*) exit 0;; esac`,
    `case " $* " in *" exec "*|*" run "*) [ -n "\${FAKE_SLEEP:-}" ] && { echo $$ > "$CALL_LOG.pid"; exec sleep 30; }; printf 'stdout-from-the-vessel\\n'; printf 'stderr-from-the-vessel\\n' >&2; exit "\${FAKE_EXEC_RC:-0}";; esac`,
    "exit 0",
  ].join("\n") + "\n");
  chmodSync(join(dir, "docker"), 0o755);
  writeFileSync(join(dir, "compose.yml"), "services: {}\n");
  const env: Record<string, string> = {
    PATH: `${dir}:${process.env.PATH ?? ""}`,
    HOME: home,
    CALL_LOG: log,
    LARES_COMPOSE_FILE: join(dir, "compose.yml"),
    ...(opts.running !== false ? { FAKE_RUNNING_ID: "cid" } : {}),
  };
  return { dir, home, log, env };
}

const calls = (b: Bench): string[][] => {
  if (!existsSync(b.log)) return [];
  return readFileSync(b.log, "utf8").split("CALL\n").filter(Boolean)
    .map((c) => c.split("\n").filter(Boolean).map((l) => l.slice(1, -1)));
};
const execCall = (b: Bench): string[] | undefined => calls(b).find((c) => c.includes("exec") && !c.includes("--observe"));

const builtExists = existsSync(join(HERE, "..", "dist", "src", "host-bridge.js"));
const haveScript = spawnSync("script", ["--version"]).status === 0;

describe.skipIf(!builtExists)("the built `lares` forwards through the real shim", () => {
  it("a vessel verb forwards: argv faithful (quotes, spaces, empty, --), stdout untouched, -T off a TTY", () => {
    const b = bench();
    try {
      const argv = ["meme", "get", "lar:///a b", "--bag", "", "it's", "--", "--json"];
      const r = spawnSync(process.execPath, [BIN, ...argv], { env: b.env, encoding: "utf8" });
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toBe("stdout-from-the-vessel\n");
      expect(r.stderr).toContain("stderr-from-the-vessel");
      const exec = execCall(b);
      expect(exec).toBeDefined();
      const at = exec!.indexOf("packages/lares-cli/bin/lares.mjs");
      expect(exec!.slice(at + 1)).toEqual(argv);
      expect(exec).toContain("-T");
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });

  it("the vessel's exit code returns unchanged", () => {
    const b = bench();
    try {
      const r = spawnSync(process.execPath, [BIN, "meme", "get", "x", "--bag", "b"], { env: { ...b.env, FAKE_EXEC_RC: "4" }, encoding: "utf8" });
      expect(r.status).toBe(4);
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });

  it("display and debug env ride by NAME alone; nothing else crosses", () => {
    const b = bench();
    try {
      spawnSync(process.execPath, [BIN, "meme", "get", "x", "--bag", "b"], {
        env: { ...b.env, NO_COLOR: "1", TERM: "xterm-256color", LARES_DEBUG: "1", SOME_TOKEN: "s3cret" }, encoding: "utf8",
      });
      const exec = execCall(b)!;
      const named = exec.flatMap((a, i) => a === "-e" ? [exec[i + 1]] : []);
      expect(named.sort()).toEqual(["LARES_DEBUG", "LARES_EXEC_TAG", "NO_COLOR", "TERM"]);
      expect(exec.join(" ")).not.toMatch(/xterm-256color|s3cret|SOME_TOKEN/);
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });

  it("with no vessel standing the offline door carries the same argv and names", () => {
    const b = bench({ running: false });
    try {
      const r = spawnSync(process.execPath, [BIN, "persona", "list"], { env: { ...b.env, TERM: "dumb" }, encoding: "utf8" });
      expect(r.status, r.stderr).toBe(0);
      const run = calls(b).find((c) => c.includes("run"))!;
      expect(run.slice(-2)).toEqual(["persona", "list"]);
      expect(run).toContain("TERM");
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });

  it("a host path under the house reaches the vessel as /lar/<class>; a path outside every mount refuses before docker runs", () => {
    const b = bench();
    try {
      const house = join(b.dir, "house");
      mkdirSync(join(house, "config"), { recursive: true });
      const r = spawnSync(process.execPath, [BIN, "export", "carry/b1"], { env: b.env, cwd: join(house, "config"), encoding: "utf8" });
      expect(r.status, r.stderr).toBe(0);
      expect(execCall(b)!.slice(-2)).toEqual(["export", "/lar/config/carry/b1"]);
      const b2 = bench();
      try {
        const out = spawnSync(process.execPath, [BIN, "export", join(b2.dir, "elsewhere")], { env: b2.env, encoding: "utf8" });
        expect(out.status).toBe(PATH_OUTSIDE_EXIT);
        expect(out.stderr.trim().split("\n").length).toBeLessThanOrEqual(3);
        expect(out.stderr).toContain(join(b2.dir, "elsewhere"));
        expect(calls(b2)).toEqual([]);
      } finally { rmSync(b2.dir, { recursive: true, force: true }); }
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });

  it("a host verb stays local: no docker call", () => {
    const b = bench();
    try {
      spawnSync(process.execPath, [BIN, "home", "--help"], { env: b.env, encoding: "utf8" });
      expect(calls(b)).toEqual([]);
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });

  it("no env file and LAR_ROOT unset: the short refusal, no stack, the distinct code; LARES_DEBUG adds nothing secret", () => {
    const b = bench({ envFile: false });
    try {
      const r = spawnSync(process.execPath, [BIN, "vault", "unlock"], { env: b.env, encoding: "utf8" });
      expect(r.status).toBe(HOUSE_ABSENT_EXIT);
      expect(r.stdout).toBe("");
      expect(r.stderr).toMatch(/^lares: no house root/);
      expect(r.stderr.trim().split("\n").length).toBeLessThanOrEqual(3);
      expect(r.stderr).not.toMatch(/\n\s+at /);
      expect(calls(b)).toEqual([]);
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });

  it("a credential verb with no TTY refuses by name before docker runs", () => {
    const b = bench();
    try {
      const r = spawnSync(process.execPath, [BIN, "vault", "unlock"], { env: b.env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
      expect(r.status).toBe(CREDENTIAL_TTY_EXIT);
      expect(r.stderr).toMatch(/vault unlock/);
      expect(calls(b)).toEqual([]);
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });

  it.skipIf(!haveScript)("on a pseudo-terminal the exec runs attached (no -T)", () => {
    const b = bench();
    try {
      spawnSync("script", ["-qec", `'${process.execPath}' '${BIN}' vault unlock`, "/dev/null"], { env: b.env, encoding: "utf8" });
      const exec = execCall(b)!;
      expect(exec).toBeDefined();
      expect(exec).not.toContain("-T");
      expect(exec.slice(-2)).toEqual(["vault", "unlock"]);
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });

  it("Ctrl+C ends the host process with the child: no orphan", async () => {
    const b = bench();
    try {
      const child = spawn(process.execPath, [BIN, "meme", "get", "x", "--bag", "b"], { env: { ...b.env, FAKE_SLEEP: "1" }, stdio: "ignore", detached: true });
      const pidFile = `${b.log}.pid`;
      for (let i = 0; i < 100 && !existsSync(pidFile); i++) await new Promise((r) => setTimeout(r, 50));
      expect(existsSync(pidFile)).toBe(true);
      const sleeper = Number(readFileSync(pidFile, "utf8").trim());
      // The terminal's Ctrl+C reaches the whole foreground group: this test's own child group, never -1.
      process.kill(-child.pid!, "SIGINT");
      const ended = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((r) => child.on("exit", (code, signal) => r({ code, signal })));
      expect(ended.signal === "SIGINT" || ended.code === 130).toBe(true);
      let alive = true;
      try { process.kill(sleeper, 0); } catch { alive = false; }
      expect(alive).toBe(false);
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });
});

describe.skipIf(!builtExists)("a lone SIGTERM to the host process leaves nothing running", () => {
  async function lone(sig: NodeJS.Signals, running: boolean): Promise<{ b: Bench; ended: { code: number | null; signal: NodeJS.Signals | null }; sleeperAlive: boolean }> {
    const b = bench({ running });
    const child = spawn(process.execPath, [BIN, "persona", "list"], { env: { ...b.env, FAKE_SLEEP: "1" }, stdio: "ignore" });
    const pidFile = `${b.log}.pid`;
    for (let i = 0; i < 100 && !existsSync(pidFile); i++) await new Promise((r) => setTimeout(r, 50));
    expect(existsSync(pidFile)).toBe(true);
    const sleeper = Number(readFileSync(pidFile, "utf8").trim());
    // The host node pid ALONE: no terminal, no group.
    process.kill(child.pid!, sig);
    const ended = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((r) => child.on("exit", (code, signal) => r({ code, signal })));
    await new Promise((r) => setTimeout(r, 200));
    let sleeperAlive = true;
    try { process.kill(sleeper, 0); } catch { sleeperAlive = false; }
    if (sleeperAlive) process.kill(sleeper, "SIGKILL");
    return { b, ended, sleeperAlive };
  }

  it("standing vessel: the compose client ends, and the shim stops the tagged process inside the vessel", async () => {
    const { b, ended, sleeperAlive } = await lone("SIGTERM", true);
    try {
      expect(ended.signal === "SIGTERM" || ended.code === 143).toBe(true);
      expect(sleeperAlive).toBe(false);
      const exec = execCall(b)!;
      expect(exec).toContain("LARES_EXEC_TAG");
      const cleanup = calls(b).find((c) => c.includes("sh") && c.includes("-c"));
      expect(cleanup, JSON.stringify(calls(b))).toBeDefined();
      expect(cleanup).toContain("TERM");
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });

  it("offline door: the compose client ends, and the shim removes the named run container", async () => {
    const { b, ended, sleeperAlive } = await lone("SIGHUP", false);
    try {
      expect(ended.signal === "SIGHUP" || ended.code === 129).toBe(true);
      expect(sleeperAlive).toBe(false);
      const run = calls(b).find((c) => c.includes("run"))!;
      const name = run[run.indexOf("--name") + 1];
      expect(name).toMatch(/^lares-offline-[0-9a-f]+$/);
      expect(calls(b).some((c) => c.includes("rm") && c.includes(name))).toBe(true);
    } finally { rmSync(b.dir, { recursive: true, force: true }); }
  });
});

describe("crashReading — an unnamed house root reads in two lines, no stack", () => {
  it("names the cure; LARES_DEBUG=1 hands back the whole error", async () => {
    const { crashReading } = await import("../src/bin/lares.js");
    const err = Object.assign(new Error("LAR_ROOT names no house root"), { name: "HouseRootUnnamed" });
    const short = crashReading(err, {});
    expect(typeof short).toBe("string");
    expect(String(short).split("\n").length).toBe(2);
    expect(String(short)).toMatch(/^lares: no house root/);
    expect(crashReading(err, { LARES_DEBUG: "1" })).toBe(err);
    const other = new Error("other");
    expect(crashReading(other, {})).toBe(other);
  });
});

describe.skipIf(!builtExists)("a local verb that reaches for the root inside the vessel", () => {
  it("exits with the house-absent code and the short reading", () => {
    const env = { ...process.env, LARES_IN_CONTAINER: "1" } as Record<string, string>;
    delete env["LAR_ROOT"];
    const r = spawnSync(process.execPath, [BIN, "hooks", "status"], { env, encoding: "utf8" });
    expect(r.status).toBe(HOUSE_ABSENT_EXIT);
    expect(r.stderr).toMatch(/^lares: no house root/);
    expect(r.stderr).not.toMatch(/\n\s+at /);
  });
});
