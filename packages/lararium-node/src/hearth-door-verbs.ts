/**
 * hearth-door-verbs — the hosting and walking doors, served INSIDE the running vessel.
 *
 * ONE STORE, ONE HOLDER. While a vessel stands, its process holds the store: the Repo its peers sync, the walk
 * records its walk client writes, the hosting state its sorter reads. A CLI that opened a second Repo beside it
 * changed bytes the running replica never saw — a roll's act sat on disk while the walkers' next dial read the
 * replica without it. So `lares host` and `lares walk` route here over the local socket whenever the vessel stands,
 * and each door runs against the live holder; with no vessel standing, the CLI runs the same door itself.
 *
 *   host-state · host-roll · host-invite      the hearth's hosting (`commands/host`)
 *   walk-state · walk-take · walk-invite      this vessel's walking (`commands/walk`)
 *
 * A REFUSAL is an answer, never a fault: it comes back as `{ refused }`, so the CLI names it exactly as the direct
 * path does.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import type { Repo } from "@automerge/automerge-repo";
import type { VerbReactor } from "@lararium/tw5";
import { runHostState, runHostRoll, runHostInvite, HostRefusal } from "./commands/host.js";
import { runWalkState, runWalkTake, runWalkInvite, WalkRefusal } from "./commands/walk.js";

/** What the doors read off the running vessel. */
export interface HearthDoorDeps {
  readonly storageDir: string;
  readonly sealHome:   string;
  /** The running vessel's own Repo — the replica its peers sync. */
  readonly repo:       Repo;
  /** The gate key the vessel's standing hearth dial pins, or null when it dials no hearth. */
  readonly dialGate:   () => string | null;
  /** A roll landed a new act on the hosting doc of `nexusAid`. */
  readonly onRolled?:  (nexusAid: string) => void;
}

/** The six door verbs, by name — the CLI's routed calls name exactly these. */
export const HEARTH_DOOR_VERBS = ["host-state", "host-roll", "host-invite", "walk-state", "walk-take", "walk-invite"] as const;

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

/** Run a door, answering a refusal as `{ refused }`. */
async function answer(verb: string, run: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
  try { return { verb, ...(await run()) }; }
  catch (err) {
    if (err instanceof HostRefusal || err instanceof WalkRefusal) return { verb, refused: err.message };
    throw err;
  }
}

/** The door reactors over a running vessel, by verb. */
export function hearthDoorReactors(deps: HearthDoorDeps): Record<(typeof HEARTH_DOOR_VERBS)[number], VerbReactor> {
  const { storageDir, sealHome } = deps;
  return {
    "host-state": () => answer("host-state", async () => ({ nexuses: await runHostState({ sealHome, storageDir }) })),
    "host-roll": (args) => answer("host-roll", async () => {
      const nexusAid = str(args["nexusAid"]);
      const cap = typeof args["cap"] === "number" ? args["cap"] : undefined;
      const r = await runHostRoll({ sealHome, storageDir, repo: deps.repo, ...(nexusAid ? { nexusAid } : {}), ...(cap !== undefined ? { cap } : {}) });
      deps.onRolled?.(r.nexusAid);
      return { ...r };
    }),
    "host-invite": (args) => answer("host-invite", async () => {
      const nexusAid = str(args["nexusAid"]);
      const relay = str(args["relay"]);
      return { ...(await runHostInvite({ sealHome, storageDir, ...(nexusAid ? { nexusAid } : {}), ...(relay ? { relay } : {}) })) };
    }),
    "walk-state": () => answer("walk-state", async () => ({ walks: runWalkState({ storageDir }) })),
    "walk-take": (args) => answer("walk-take", async () => {
      const carried = str(args["invite"]);
      if (!carried) throw new WalkRefusal("walk-take needs the carried invite");
      return { ...(await runWalkTake({ carried, storageDir, dialGate: deps.dialGate() })) };
    }),
    "walk-invite": () => answer("walk-invite", async () => ({ ...(await runWalkInvite({ storageDir })) })),
  };
}
