/**
 * console-rows — the rows the vessel worker answers at the console door
 * (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-console-door).
 *
 * Each row carries the CLI's own argv path and answers public readings alone: a standing, a count, a name, a refusal. No row
 * takes an argument and none returns a key, a seed or a route. The host hands this module what it holds (`VesselConsoleCtx`),
 * so the rows read the live house and never a copy of it. A row answers a session that has not unlocked: a person reads what
 * the vessel waits on while it waits.
 */
import type { BrowserVesselResult, VesselHouse, VesselSession } from "@lararium/browser";
import { ConsoleRefused, type ConsoleVerbRow } from "../console-verbs.js";

/** What the host hands the rows: live readers over its own state, for the connection the call arrived on. */
export interface VesselConsoleCtx {
  /** The store this host stands over, or null before any tab's hello named one. */
  readonly idbName: () => string | null;
  /** The house over that store, or null where none stands (no hello yet, or the store refused this worker). */
  readonly house: () => Promise<VesselHouse<BrowserVesselResult> | null>;
  /** This connection's session, or null where it holds none. */
  readonly session: () => VesselSession | null;
}

/** The house this call reads, or the refusal that names why none stands. */
async function standingHouse(ctx: VesselConsoleCtx): Promise<VesselHouse<BrowserVesselResult>> {
  const house = await ctx.house();
  if (!house || ctx.idbName() === null) throw new ConsoleRefused("vessel-unstood", "this vessel worker stands no house yet: no tab's hello reached it, or another worker owns the store");
  return house;
}

export function vesselConsoleRows(ctx: VesselConsoleCtx): ConsoleVerbRow[] {
  return [
    {
      path: ["vessel", "read"],
      summary: "read this browser vessel's standing: its floor state and this tab's session",
      run: async () => {
        const house = await standingHouse(ctx);
        const session = ctx.session();
        return {
          standing: house.floor(),
          session: session ? { admission: session.admission, admittedBy: session.admittedBy, face: session.face } : null,
        };
      },
    },
  ];
}
