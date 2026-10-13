/**
 * daemon-persona-store — the fleet-mirroring adapters for a human's OWN-persona names, and the local-first
 * floor beneath them.
 *
 * The pet-name and the declared Handle rest sealed on this vessel and ride the mounted face's persona plane,
 * which private-federates across that face's vessels and never reaches a stranger, so a rename lands on every
 * device of the one human. The `seat` claim does NOT ride: a Kahu chair names a seat on a PARTICULAR node, so
 * each node keeps its own.
 *
 * THE MIRROR RIDES THE CUSTODY DOOR, NEVER A STORE VERB. A store verb's outcome rests in the daemon's document
 * in the clear and the digest of its arguments rests in a receipt, so a name on that road would leave its
 * sealed row and its private plane for an unsealed document. Each move here sends one `act` frame instead
 * (`sealed-act-door`): `selves.read` answers what each face's plane holds, `selves.carry` names a face and which
 * of its two names to carry, and `selves.clear` clears a name whose sealed row holds it no more. The vessel reads
 * the name off its own sealed row and writes it onto that face's own plane from its main thread, so no mirror
 * frame holds a name at all.
 *
 * LOCAL-FIRST, NOT VESSEL-REQUIRED. A vessel FOUNDS before it breathes, so every write lands on the sealed row
 * FIRST and gets carried to the plane when a vessel with a lit face answers. A read prefers the fleet (a
 * fleet-mate's rename outranks this device's stale copy) and falls back to the sealed row.
 *
 * A MIRROR NEVER FAILS THE ACT IT MIRRORS. The sealed write already landed, so a plane nobody reaches leaves the
 * vessel correct and merely un-carried. A command running with no vessel standing reaches no plane at all: the
 * act refuses by name before it opens any row, and the caller reads NODE-LOCAL.
 *
 * THE REASON STILL TRAVELS. A read hands back a reached/why pair, so the caller prints WHY the names stayed
 * home. `lares persona sync` carries the names up once the hearth stands unlocked.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/persona-policy
 */

import type {
  OwnPersonaPetnameStore, PersonaDeclaration, PersonaDeclarationStore,
} from "@lararium/mesh";
import { sealedAct } from "./sealed-act-door.js";

/** One own persona as the fleet reads it: the two names that ride, keyed by handle-index. */
export interface FleetSelf {
  readonly handleIndex: number;
  readonly petname?: string;
  readonly handle?: string;
}

/** What a fleet read came back with: the names it read, or why they stayed home. */
export type FleetRead =
  | { readonly reached: true;  readonly selves: readonly FleetSelf[] }
  | { readonly reached: false; readonly why: string };

/** Which of a face's two riding names a carry moves. */
export type FleetName = "petname" | "handle";

/** Read the whole fleet multitude off the persona plane, or the reason the read did not land. */
export async function readFleetSelves(): Promise<FleetRead> {
  try {
    const { selves } = await sealedAct<{ selves?: unknown }>("selves.read");
    return { reached: true, selves: Array.isArray(selves) ? (selves as FleetSelf[]) : [] };
  } catch (err) {
    return { reached: false, why: err instanceof Error ? err.message : String(err) };
  }
}

/** How one mirror move ended: the plane took it, the plane kept what it held, or no plane took the frame. */
export type FleetCarry =
  | { readonly landed: true }
  /** The plane kept its own value: a newer write stands there, or (under `fill`) any write at all. */
  | { readonly landed: false; readonly kept: true }
  | { readonly landed: false; readonly kept: false; readonly why: string };

async function mirrorAct(act: "selves.carry" | "selves.clear", args: Record<string, unknown>, done: "carried" | "cleared"): Promise<FleetCarry> {
  try {
    const out = await sealedAct<Record<string, unknown>>(act, args);
    return out[done] === true ? { landed: true } : { landed: false, kept: true };
  } catch (err) {
    return { landed: false, kept: false, why: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Carry one name of one face from its sealed row up to that face's persona plane. `fill` lands it only where the
 * plane never held that name, so an old local name never replaces what another vessel of the face wrote since.
 * A carry reports; it never throws.
 */
export function carryOwnName(handleIndex: number, name: FleetName, opts: { readonly fill?: boolean } = {}): Promise<FleetCarry> {
  return mirrorAct("selves.carry", { handleIndex, name, ...(opts.fill === true ? { fill: true } : {}) }, "carried");
}

/** Clear one name of one face on its persona plane, once its sealed row holds that name no more. Reports; never throws. */
export function clearOwnName(handleIndex: number, name: FleetName): Promise<FleetCarry> {
  return mirrorAct("selves.clear", { handleIndex, name }, "cleared");
}

/**
 * Build the FLEET-mirroring pet-name store: every write lands on the sealed row FIRST and gets carried to the
 * persona plane when a vessel answers; every read prefers the fleet's copy. `local` supplies the sealed store
 * the mirror wraps.
 */
export function makeFleetPetnameStore(local: OwnPersonaPetnameStore): OwnPersonaPetnameStore {
  return {
    async get(handleIndex) {
      const read = await readFleetSelves();
      const fleet = read.reached ? read.selves.find((s) => s.handleIndex === handleIndex)?.petname : undefined;
      return fleet ?? await local.get(handleIndex);
    },
    async set(handleIndex, petname) {
      await local.set(handleIndex, petname);
      await carryOwnName(handleIndex, "petname");
    },
    async clear(handleIndex) {
      await local.clear(handleIndex);
      await clearOwnName(handleIndex, "petname");
    },
    async entries() {
      const read = await readFleetSelves();
      if (!read.reached) return local.entries();
      const selves = read.selves;
      // The fleet's view WINS where it names a persona, and the sealed row fills the rest: a persona this device
      // named while no plane stood still reads, and `persona sync` carries it up.
      const merged = new Map<number, string>(await local.entries());
      for (const s of selves) if (s.petname) merged.set(s.handleIndex, s.petname);
      return [...merged.entries()].map(([k, v]) => [k, v] as const).sort((a, b) => a[0] - b[0]);
    },
  };
}

/**
 * Build the FLEET-mirroring declaration store. The declared `handle` rides the persona plane; the `seat` claim
 * and the private `chair` label stay on this node. Reads compose them.
 */
export function makeFleetDeclarationStore(local: PersonaDeclarationStore): PersonaDeclarationStore {
  const compose = (localDecl: PersonaDeclaration | undefined, fleetHandle: string | undefined): PersonaDeclaration | undefined => {
    const handle = fleetHandle ?? localDecl?.handle;
    const seat   = localDecl?.seat;
    const chair  = localDecl?.chair;
    if (handle === undefined && seat === undefined && chair === undefined) return undefined;
    return { ...(handle !== undefined ? { handle } : {}), ...(seat !== undefined ? { seat } : {}), ...(chair !== undefined ? { chair } : {}) };
  };
  return {
    async get(handleIndex) {
      const read = await readFleetSelves();
      const fleetHandle = read.reached ? read.selves.find((s) => s.handleIndex === handleIndex)?.handle : undefined;
      return compose(await local.get(handleIndex), fleetHandle);
    },
    async set(handleIndex, declaration) {
      await local.set(handleIndex, declaration);
      if (declaration.handle !== undefined) await carryOwnName(handleIndex, "handle");
    },
    async clear(handleIndex) {
      await local.clear(handleIndex);
      await clearOwnName(handleIndex, "handle");
    },
    async entries() {
      const read = await readFleetSelves();
      const byIndex = new Map<number, PersonaDeclaration>(await local.entries());
      if (read.reached) {
        for (const s of read.selves) {
          const composed = compose(byIndex.get(s.handleIndex), s.handle);
          if (composed) byIndex.set(s.handleIndex, composed);
        }
      }
      return [...byIndex.entries()].map(([k, v]) => [k, v] as const).sort((a, b) => a[0] - b[0]);
    },
  };
}
