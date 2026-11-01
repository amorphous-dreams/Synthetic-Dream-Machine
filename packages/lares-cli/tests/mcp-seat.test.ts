/**
 * mcp-seat — the lares MCP seat binds the hearth (road L3, walk gap G4).
 *
 * The seat a harness spawns routes every verb over the daemon's socket, and `lares_uds.py` derives that
 * socket from `LAR_ROOT`. An entry that carries no `LAR_ROOT` binds whatever vessel the harness's own
 * environment names, which for a harness reads as none: the default XDG vessel, never the hearth. So the
 * resolved entry names the hearth's root in its env, in both forms a hearth stands in:
 *
 *   native     the hearth's root is `LAR_ROOT` (or `~/.lares`); the entry spawns the main clone's
 *              `lares_mcp.py` with `LAR_ROOT` in its env
 *   container  the hearth root holds the surface env (`lares-surface.env`), so the hearth stands in the
 *              surface container; the entry execs the image's seat there and forwards the container's
 *              own root, read from the compose file, by name
 *
 * The entry also aims at the MAIN clone, never at the worktree a command ran from, so a lane's removal
 * strands no seat. And a stored seat that drifted only in its env reads as drift, so `home tend`
 * re-aims a seat that lacks the root.
 *
 * Every root here stands under a scratch directory; nothing reads or writes a real home.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memorySensoriumDir } from "@lararium/node";
import { IMAGE_SEAT, resolveLaresMcp } from "../src/mcp-resolve.js";
import { homeItems } from "../src/reality-tunnel/catalog.js";

const REPO = join(import.meta.dirname, "..", "..", "..");
const SEAT = join("packages", "lararium-sensorium", "scripts", "lares_mcp.py");

let dir: string;
let priorRoot: string | undefined;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mcp-seat-"));
  priorRoot = process.env["LAR_ROOT"];
});
afterEach(() => {
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

/** A scratch hearth root with its memory sensorium stood, as `lares sense setup` leaves it. */
function scratchHearth(): string {
  const root = join(dir, "hearth");
  process.env["LAR_ROOT"] = root;
  mkdirSync(memorySensoriumDir(), { recursive: true });
  return root;
}

describe("the seat names the hearth's root", () => {
  it("native: a scratch LAR_ROOT rides the entry's env, and the entry aims at the clone it was handed", () => {
    const clone = fakeClone();
    const root = scratchHearth();
    const mcp = resolveLaresMcp(clone);
    expect(mcp, "the resolver found no interpreter holding mempalace (~/.venv); `lares mempalace install` stands one").not.toBeNull();
    expect(mcp!.env["LAR_ROOT"]).toBe(root);
    expect(mcp!.args).toEqual([join(clone, SEAT)]);
    expect(mcp!.env["PYTHONPATH"]).toBe(join(clone, "mempalace"));
  });

  it("container: a hearth holding the surface env execs the image's seat and forwards the compose file's root by name", () => {
    const clone = fakeClone();
    const root = scratchHearth();
    writeFileSync(join(root, "lares-surface.env"), "LARES_STATE=/nowhere\n");
    const mcp = resolveLaresMcp(clone);
    expect(mcp).not.toBeNull();
    expect(mcp!.command).toBe("docker");
    expect(mcp!.args).toEqual([
      "compose", "--env-file", join(root, "lares-surface.env"), "-f", join(clone, "docker-compose.surface.yml"),
      "exec", "-T", "-e", "LAR_ROOT", "lares", "python3", `/app/${SEAT}`,
    ]);
    // The container's root, read from the compose file the entry names, never typed here.
    expect(mcp!.env).toEqual({ LAR_ROOT: "/state" });
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
    const root = join(dir, "container-hearth");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "lares-surface.env"), "LARES_STATE=/nowhere\n");
    process.env["LAR_ROOT"] = root;
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
