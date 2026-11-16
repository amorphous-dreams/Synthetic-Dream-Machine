/**
 * mcp-seat — the lares MCP seat binds the hearth (road L3, walk gap G4).
 *
 * The seat a harness spawns routes every verb over the daemon's socket, and `lares_uds.py` derives that
 * socket from `LAR_ROOT`. An entry that carries no `LAR_ROOT` binds whatever vessel the harness's own
 * environment names, which for a harness reads as none: the default XDG vessel, never the hearth. So the
 * resolved entry names the hearth's root in its env, in both forms a hearth stands in:
 *
 *   native     the hearth's root is `LAR_ROOT`; the entry spawns the main clone's `lares_mcp.py` with `LAR_ROOT`
 *              in its env
 *   container  the operator's `~/.lares` holds the surface env (`lares-surface.env`), so the hearth stands in the
 *              surface container; the entry names the aho (`lares mcp aho`), which execs the image's
 *              seat there as its child and forwards the container's own root, read from the compose file, by name
 *
 * The entry also aims at the MAIN clone, never at the worktree a command ran from, so a lane's removal
 * strands no seat. And a stored seat that drifted only in its env reads as drift, so `home tend`
 * re-aims a seat that lacks the root.
 *
 * Every root and every HOME here stands under a scratch directory (the native resolve alone reads the real `~/.venv`);
 * nothing reads or writes a real `~/.lares`.
 */
import { describe, it, expect, beforeEach, afterEach, onTestFinished } from "vitest";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memorySensoriumDir } from "@lararium/node";
import { IMAGE_SEAT, hearthSurfaceEnv, resolveLaresMcp, resolveLaresSurface, seatAbsentCause } from "../src/mcp-resolve.js";
import { homeItems, mainCloneOf } from "../src/reality-tunnel/catalog.js";
import { execFileSync } from "node:child_process";

const REPO = join(import.meta.dirname, "..", "..", "..");
const SEAT = join("packages", "lararium-sensorium", "scripts", "lares_mcp.py");

let dir: string;
let priorRoot: string | undefined;
let priorHome: string | undefined;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mcp-seat-"));
  priorRoot = process.env["LAR_ROOT"];
  priorHome = process.env["HOME"];
  process.env["HOME"] = join(dir, "operator");
});
afterEach(() => {
  process.env["HOME"] = priorHome;
  if (priorRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorRoot;
  rmSync(dir, { recursive: true, force: true });
});

/** A clone that carries the seat script, the mempalace import root and the surface compose file. */
function fakeClone(): string {
  const clone = join(dir, "clone");
  mkdirSync(join(clone, "packages", "lararium-sensorium", "scripts"), { recursive: true });
  writeFileSync(join(clone, SEAT), "# the seat\n");
  mkdirSync(join(clone, "mempalace"), { recursive: true });
  copyFileSync(join(REPO, "docker-compose.surface.yml"), join(clone, "docker-compose.surface.yml"));
  return clone;
}

/** The surface env at the scratch operator's `~/.lares`, where the hearth standing in the surface container names it. */
function surfaceEnv(): string {
  const file = join(process.env["HOME"]!, ".lares", "lares-surface.env");
  mkdirSync(join(process.env["HOME"]!, ".lares"), { recursive: true });
  writeFileSync(file, "LARES_HOUSE=/nowhere\n");
  return file;
}

/** A scratch hearth root with its memory sensorium stood, as `lares sense setup` leaves it. */
function scratchHearth(): string {
  const root = join(dir, "hearth");
  process.env["LAR_ROOT"] = root;
  mkdirSync(memorySensoriumDir(), { recursive: true });
  return root;
}

describe("the seat names the hearth's root", () => {
  it("native: a scratch LAR_ROOT rides the entry's env, and the entry aims at the clone it was handed", () => {
    // The interpreter the native form spawns rests in the real ~/.venv; name it by the operator override, so the scratch
    // HOME (which holds no surface env) keeps the form native.
    const priorPython = process.env["LARES_PYTHON"];
    process.env["LARES_PYTHON"] ??= join(priorHome ?? "", ".venv", "bin", "python3");
    onTestFinished(() => { if (priorPython === undefined) delete process.env["LARES_PYTHON"]; else process.env["LARES_PYTHON"] = priorPython; });
    const clone = fakeClone();
    const root = scratchHearth();
    const mcp = resolveLaresSurface(clone);
    expect(mcp, "the resolver found no interpreter holding mempalace (~/.venv); `lares mempalace install` stands one").not.toBeNull();
    expect(mcp!.env["LAR_ROOT"]).toBe(root);
    expect(mcp!.args).toEqual([join(clone, SEAT)]);
    expect(mcp!.env["PYTHONPATH"]).toBe(join(clone, "mempalace"));
  });

  it("container: the operator's surface env names the aho over the image's seat, and forwards the compose file's root by name", () => {
    const clone = fakeClone();
    delete process.env["LAR_ROOT"];          // the host shell names no house root; the surface env alone decides the form
    const file = surfaceEnv();
    const mcp = resolveLaresSurface(clone);
    expect(mcp).not.toBeNull();
    // The surface the aho spawns as its child: the image's seat, through the clone's compose file.
    expect(mcp!.command).toBe("docker");
    expect(mcp!.args).toEqual([
      "compose", "--env-file", file, "-f", join(clone, "docker-compose.surface.yml"),
      "exec", "-T", "-e", "LAR_ROOT", "lares", "python3", `/app/${SEAT}`,
    ]);
    // The container's root, read from the compose file the entry names, never typed here.
    expect(mcp!.env).toEqual({ LAR_ROOT: "/lar" });
  });

  it("the image seat the container form names stands where the Dockerfile lays the scripts", () => {
    expect(IMAGE_SEAT).toBe(`/app/${SEAT}`);
    const dockerfile = readFileSync(join(REPO, "Dockerfile"), "utf8");
    expect(dockerfile).toContain(`python3 /app/packages/lararium-sensorium/scripts/`);
    expect(dockerfile).toMatch(/^COPY --from=build \/app\/packages\/lararium-sensorium\/scripts \.\/packages\/lararium-sensorium\/scripts$/m);
  });

  it("control: with no sensorium stood under the hearth, the native form still refuses (null)", () => {
    const clone = fakeClone();
    process.env["LAR_ROOT"] = join(dir, "bare-hearth");
    expect(resolveLaresMcp(clone)).toBeNull();
  });
});

describe("harness-seat-records-the-lares-verb-alone", () => {
  it("RED: the entry a harness config records names `lares mcp aho` and nothing beneath it, in the container form and the native form alike; CONTROL: the surface the verb resolves still names the child", () => {
    const clone = fakeClone();
    delete process.env["LAR_ROOT"];
    surfaceEnv();
    const container = resolveLaresMcp(clone);
    // No clone path, no node, no docker, no compose file: the bare verb on PATH, and the house's own resolver finds the child at run time.
    expect(container).toEqual({ command: "lares", args: ["mcp", "aho"], env: {} });
    expect(JSON.stringify(container)).not.toMatch(/docker|compose|lares\.mjs|python|\/app\//);
    expect(resolveLaresSurface(clone)!.command).toBe("docker");
  });

  it("RED: the native entry carries the hearth's root for the verb to bind and names no interpreter or script; CONTROL: with no surface resolvable the entry stays null, so the cause still reads", () => {
    const priorPython = process.env["LARES_PYTHON"];
    process.env["LARES_PYTHON"] ??= join(priorHome ?? "", ".venv", "bin", "python3");
    onTestFinished(() => { if (priorPython === undefined) delete process.env["LARES_PYTHON"]; else process.env["LARES_PYTHON"] = priorPython; });
    const clone = fakeClone();
    const root = scratchHearth();
    expect(resolveLaresMcp(clone)).toEqual({ command: "lares", args: ["mcp", "aho"], env: { LAR_ROOT: root } });
    process.env["LAR_ROOT"] = join(dir, "bare-hearth");
    expect(resolveLaresMcp(clone)).toBeNull();
  });
});

describe("aho-child-honours-the-shim-overrides", () => {
  let prior: Record<string, string | undefined>;
  beforeEach(() => { prior = { file: process.env["LARES_COMPOSE_FILE"], project: process.env["COMPOSE_PROJECT_NAME"] }; });
  afterEach(() => {
    for (const [name, value] of [["LARES_COMPOSE_FILE", prior["file"]], ["COMPOSE_PROJECT_NAME", prior["project"]]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  /** Another house's compose file: its own project name and its own root inside the container. */
  const scopedCompose = (): string => {
    const file = join(dir, "scoped", "compose.yml");
    mkdirSync(join(dir, "scoped"), { recursive: true });
    writeFileSync(file, readFileSync(join(REPO, "docker-compose.surface.yml"), "utf8").replace(/^name: .*$/m, "name: scoped-house").replace(/^(\s+LAR_ROOT:\s*)\S+\s*$/m, "$1/scoped"));
    return file;
  };

  it("RED: with LARES_COMPOSE_FILE and COMPOSE_PROJECT_NAME set, the child execs through that file and carries that project, as the shim does, and never names the main clone's file; CONTROL: with neither set it names the clone's file and no project", () => {
    const clone = fakeClone();
    delete process.env["LAR_ROOT"];
    const envFile = surfaceEnv();
    delete process.env["LARES_COMPOSE_FILE"]; delete process.env["COMPOSE_PROJECT_NAME"];
    const plain = resolveLaresSurface(clone)!;
    expect(plain.args).toContain(join(clone, "docker-compose.surface.yml"));
    expect(plain.env).toEqual({ LAR_ROOT: "/lar" });

    const file = scopedCompose();
    process.env["LARES_COMPOSE_FILE"] = file;
    process.env["COMPOSE_PROJECT_NAME"] = "rehearsal-7";
    const scoped = resolveLaresSurface(clone)!;
    expect(scoped.args).toEqual(["compose", "--env-file", envFile, "-f", file, "exec", "-T", "-e", "LAR_ROOT", "lares", "python3", `/app/${SEAT}`]);
    expect(scoped.args).not.toContain(join(clone, "docker-compose.surface.yml"));
    // The root comes off the file the child execs through, and the project rides the child's env, where compose reads it.
    expect(scoped.env).toEqual({ LAR_ROOT: "/scoped", COMPOSE_PROJECT_NAME: "rehearsal-7" });
    // The file's own `name:` decides the project where the environment names none: the child passes no `-p` of its own.
    delete process.env["COMPOSE_PROJECT_NAME"];
    const named = resolveLaresSurface(clone)!;
    expect(named.env).toEqual({ LAR_ROOT: "/scoped" });
    expect(named.args).not.toContain("-p");
  });

  it("RED: the entry a harness records carries the two overrides the resolving shell named, the file made absolute, so a bare `lares mcp aho` under that harness reaches the same house; CONTROL: with neither set the entry carries none", () => {
    const clone = fakeClone();
    delete process.env["LAR_ROOT"];
    surfaceEnv();
    delete process.env["LARES_COMPOSE_FILE"]; delete process.env["COMPOSE_PROJECT_NAME"];
    expect(resolveLaresMcp(clone)).toEqual({ command: "lares", args: ["mcp", "aho"], env: {} });
    const file = scopedCompose();
    const priorCwd = process.cwd();
    process.chdir(join(dir, "scoped"));
    try {
      process.env["LARES_COMPOSE_FILE"] = "compose.yml";
      process.env["COMPOSE_PROJECT_NAME"] = "rehearsal-7";
      expect(resolveLaresMcp(clone)).toEqual({ command: "lares", args: ["mcp", "aho"], env: { LARES_COMPOSE_FILE: file, COMPOSE_PROJECT_NAME: "rehearsal-7" } });
      expect(resolveLaresSurface(clone)!.args).toContain(file);
    } finally { process.chdir(priorCwd); }
  });

  it("RED: an override that names no file resolves no seat, and the cause names that file, never the clone's", () => {
    const clone = fakeClone();
    delete process.env["LAR_ROOT"];
    surfaceEnv();
    process.env["LARES_COMPOSE_FILE"] = join(dir, "absent.yml");
    expect(resolveLaresSurface(clone)).toBeNull();
    expect(resolveLaresMcp(clone)).toBeNull();
    expect(seatAbsentCause()).toContain(join(dir, "absent.yml"));
  });
});

describe("a stored seat that lacks the root reads as drift", () => {
  const MCP = { command: "/usr/bin/python3", args: ["/clone/lares_mcp.py"], env: { PYTHONPATH: "/clone/mp", LAR_ROOT: "/hearth" } };
  const observe = (home: string) => {
    const item = homeItems({ repo: REPO, homes: { native: home, windows: null }, mcp: MCP })
      .find((i) => i.id === "claude.mcp-seat")!;
    return item.external!.observe();
  };
  const homeWith = (seat: unknown): string => {
    const home = join(dir, "home");
    mkdirSync(join(home, ".claude"), { recursive: true });
    writeFileSync(join(home, ".claude.json"), JSON.stringify({ mcpServers: { lares: seat } }));
    return home;
  };

  it("same command and args, no LAR_ROOT in env: drift, so tend re-aims it", () => {
    const home = homeWith({ type: "stdio", command: MCP.command, args: MCP.args, env: { PYTHONPATH: "/clone/mp" } });
    expect(observe(home).aligned).toBe(false);
  });

  it("control: the resolved seat whole reads aligned", () => {
    const home = homeWith({ type: "stdio", command: MCP.command, args: MCP.args, env: MCP.env });
    expect(observe(home).aligned).toBe(true);
  });
});

describe("a missing seat names its own form's cause", () => {
  const unreachable = (home: string): string => String(
    homeItems({ repo: REPO, homes: { native: home, windows: null }, mcp: null, claudeCli: false })
      .find((i) => i.id === "copilot.mcp-seat")!.unreachable ?? "",
  );
  const home = (): string => { const h = join(dir, "home"); mkdirSync(join(h, ".copilot"), { recursive: true }); return h; };

  it("native: the cause names python, the script or the sensorium, and no compose file", () => {
    process.env["LAR_ROOT"] = join(dir, "native-hearth");
    const said = unreachable(home());
    expect(said).toMatch(/sensorium/);
    expect(said).not.toMatch(/compose/);
  });

  it("container: the cause names the compose file's root, and no python or sensorium", () => {
    surfaceEnv();
    delete process.env["LAR_ROOT"];
    const said = unreachable(home());
    expect(said).toMatch(/docker-compose\.surface\.yml/);
    expect(said).toMatch(/LAR_ROOT/);
    expect(said).not.toMatch(/sensorium|python/);
  });
});

describe("every harness's seat carries the hearth's root", () => {
  const MCP = { command: "/usr/bin/python3", args: ["/clone/lares_mcp.py"], env: { PYTHONPATH: "/clone/mp", LAR_ROOT: "/hearth" } };
  const transformed = (id: string, home: string): string => {
    const item = homeItems({ repo: REPO, homes: { native: home, windows: null }, mcp: MCP, claudeCli: false }).find((i) => i.id === id)!;
    return item.transform!(null)!;
  };
  const homeWith = (sub: string): string => { const h = join(dir, "home"); mkdirSync(join(h, sub), { recursive: true }); return h; };

  it("codex: the toml seat's env names LAR_ROOT", () => {
    expect(transformed("codex.mcp-seat", homeWith(".codex"))).toMatch(/^env = \{ .*LAR_ROOT = "\/hearth".* \}$/m);
  });

  it("copilot: the json seat's env names LAR_ROOT", () => {
    const seat = (JSON.parse(transformed("copilot.mcp-seat", homeWith(".copilot"))) as { mcpServers: { lares: { env: Record<string, string> } } }).mcpServers.lares;
    expect(seat.env["LAR_ROOT"]).toBe("/hearth");
  });
});

describe("the hearth root reads absolute, or the seat refuses by name", () => {
  let priorCwd: string;
  beforeEach(() => { priorCwd = process.cwd(); });
  afterEach(() => { process.chdir(priorCwd); });

  it("an empty LAR_ROOT names no house: no seat resolves, a cwd-side surface env never flips the form, and the cause names LAR_ROOT", () => {
    const clone = fakeClone();
    const cwd = join(dir, "project");
    mkdirSync(cwd, { recursive: true });
    writeFileSync(join(cwd, "lares-surface.env"), "COMPOSE_PROJECT_NAME=elsewhere\n");
    process.chdir(cwd);
    process.env["LAR_ROOT"] = "";
    // No home directory stands in for the house root, so no seat binds and the cwd's file decides nothing.
    expect(resolveLaresMcp(clone)).toBeNull();
    expect(hearthSurfaceEnv()).toBeNull();
    expect(seatAbsentCause()).toMatch(/set LAR_ROOT/);
  });

  it("a relative LAR_ROOT refuses by name", () => {
    const clone = fakeClone();
    process.env["LAR_ROOT"] = "relative/hearth";
    expect(resolveLaresMcp(clone)).toBeNull();
    mkdirSync(join(dir, "home", ".copilot"), { recursive: true });
    const said = String(homeItems({ repo: REPO, homes: { native: join(dir, "home"), windows: null }, mcp: null, claudeCli: false })
      .find((i) => i.id === "copilot.mcp-seat")!.unreachable ?? "");
    expect(said).toMatch(/LAR_ROOT names a relative hearth \(relative\/hearth\)/);
  });
});

describe("a leaked git env never re-aims the seat's clone", () => {
  let prior: string | undefined;
  beforeEach(() => { prior = process.env["GIT_DIR"]; });
  afterEach(() => { if (prior === undefined) delete process.env["GIT_DIR"]; else process.env["GIT_DIR"] = prior; });

  it("GIT_DIR naming another repository leaves mainCloneOf on the tree it was handed", () => {
    const honest = mainCloneOf(REPO);
    const other = join(dir, "other");
    mkdirSync(other, { recursive: true });
    execFileSync("git", ["init", "-q", other]);
    process.env["GIT_DIR"] = join(other, ".git");
    expect(mainCloneOf(REPO)).toBe(honest);
  });
});
