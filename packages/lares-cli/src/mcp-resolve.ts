/**
 * mcp-resolve — resolve the LARES MCP seat the harness-wire modules register, plus the shared
 * WireAction vocabulary.
 *
 * A harness reaches memory through the LARES surface (`lares_mcp.py` — FastMCP over the sensorium
 * lifecycle), and that surface holds NO STORE: every verb rides the daemon cap-wire (`lares_uds.py`)
 * to the one process that owns the palace holders.
 *
 * THE TOOL LIST LIVES IN `lares_mcp.py` AND NOWHERE ELSE. This header once named nine verbs while the
 * surface carried thirty — a hand-written list cannot notice what it missed, and it read as
 * authoritative to whoever found it. `tools/surface-parity-witness.sh` derives the count and holds the
 * invariant that matters: every MCP tool answers to a CLI door.
 *
 * THE CONVERSE IS A RULING, NOT A GAP. The CLI carries the KEY-HOLDING ceremonies — founding, persona
 * minting, the charter quorum, the vault past a status read, the raise — and MCP carries none of them.
 * MCP speaks stdio-per-client, so N sessions run N processes; handing that surface a signing verb would
 * put N unsynchronised holders on one operator's keys. The operator's hand keeps those.
 *
 * MCP speaks stdio-per-client, so N sessions run N of these processes. A surface that opened a chroma
 * client would therefore put N unsynchronized writers on one index — and no lock cures that, because
 * the serve-holders speak NDJSON on raw stdin and answer only their spawning parent. Exactly ONE OWNER
 * holds the palace, and everyone else asks it. All the compute stays py; the daemon only routes.
 *
 * The guest `~/.mempalace` holds no seat here. An operator raises it deliberately (`lares mempalace
 * setup`) and imports FROM it (`guest-import.ts`); the vessel never binds into it.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveLaresMcpSpawn } from "@lararium/mempalace";
import { larHome, memorySensoriumDir } from "@lararium/node";

export type WireAction = "wired" | "present" | "missing-script";

/** The resolved MCP server command a harness config records: argv + the env its import needs. */
export interface LaresMcpCommand {
  readonly command: string;
  readonly args: string[];
  readonly env: Record<string, string>;
}

/** The surface env a hearth root holds when its hearth stands in the surface container. */
export const SURFACE_ENV = "lares-surface.env";
/** The surface deployment's compose file, at the clone's root. */
export const SURFACE_COMPOSE = "docker-compose.surface.yml";
/** The seat inside the product image: the image's working root (`WORKDIR /app`) plus the repo-relative path. */
export const IMAGE_SEAT = "/app/packages/lararium-sensorium/scripts/lares_mcp.py";

/** The vessel's root inside the surface container, as the compose file's environment names it. */
function containerRoot(compose: string): string | null {
  if (!existsSync(compose)) return null;
  return /^\s+LAR_ROOT:\s*(\S+)\s*$/m.exec(readFileSync(compose, "utf8"))?.[1] ?? null;
}

/**
 * Resolve the `lares` MCP server invocation that binds THE HEARTH, or null when its pieces stand absent.
 *
 * THE ENTRY NAMES THE HEARTH'S ROOT. The seat routes every verb over the daemon socket, and `lares_uds.py`
 * derives that socket from `LAR_ROOT`. A harness spawns the seat with its own environment, which names no
 * root, so an entry without one binds the default XDG vessel and never the hearth. The hearth's root
 * derives from `larHome()` (`LAR_ROOT`, else `~/.lares`), and the entry carries it in BOTH forms:
 *
 *   container  the hearth root holds the surface env (`lares-surface.env`), so the hearth stands in the
 *              surface container. The entry execs the image's seat there through the clone's compose file
 *              and forwards `LAR_ROOT` by name (`exec -e LAR_ROOT`), its value the container's own root as
 *              the compose file names it. The image carries its own interpreter and pinned `mcp`.
 *   native     the entry spawns the clone's `lares_mcp.py` on THE venv (`~/.venv`, or `LARES_PYTHON`),
 *              with `LAR_ROOT` and the mempalace import root in its env; null while no sensorium stands
 *              under the hearth (`lares sense setup` stands it) or no interpreter holds mempalace.
 *
 * `clone` names the MAIN clone (`mainCloneOf`), never the worktree a command runs from, so a lane's removal
 * strands no seat. Every path runs absolute: a harness spawns this with no venv active and no cwd guarantee.
 */
export function resolveLaresMcp(clone: string): LaresMcpCommand | null {
  const hearth = larHome();
  const surfaceEnv = join(hearth, SURFACE_ENV);
  if (existsSync(surfaceEnv)) {
    const compose = join(clone, SURFACE_COMPOSE);
    const root = containerRoot(compose);
    if (root === null) return null;
    return {
      command: "docker",
      args: ["compose", "--env-file", surfaceEnv, "-f", compose, "exec", "-T", "-e", "LAR_ROOT", "lares", "python3", IMAGE_SEAT],
      env: { LAR_ROOT: root },
    };
  }
  const { python, script, submoduleRoot, scriptPresent } = resolveLaresMcpSpawn(clone);
  if (python === null || !scriptPresent) return null;
  if (!existsSync(memorySensoriumDir())) return null; // no sensorium stood — `lares sense setup` stands it
  return {
    command: python,
    args: [script],   // ROUTED: no --palace. The surface opens no store; it speaks to the daemon.
    env: { PYTHONPATH: submoduleRoot, LAR_ROOT: hearth },
  };
}
