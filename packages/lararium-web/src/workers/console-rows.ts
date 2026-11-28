/**
 * console-rows — the rows the vessel worker answers at the console door
 * (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-console-door).
 *
 * Each row carries the CLI's own argv path and answers public readings alone: a standing, a count, a name, a refusal. No row
 * takes an argument and none returns a key, a seed or a route. The host hands this module what it holds (`VesselConsoleCtx`),
 * so the rows read the live house and never a copy of it. A row answers a session that has not unlocked: a person reads what
 * the vessel waits on while it waits.
 *
 * `vessel read` (the node's `lares vessel read`, the vessel's own health reading): the place AID and whether its KEL stands
 * armed; the standing (floor, lighting or lit); the faces this store names, the faces joined here, and the face worn; the relay
 * this vessel dials and the crossing as it stands; the floor pin; every ask this tab's session still waits on, with its kind
 * and whether its ceremony window holds its port; custody at rest.
 *
 * `vault status` (the node's `lares vault status`): custody at rest for the place and for each face the store names, and what
 * this tab's session holds open. `vault lock` stands in no row: a browser vessel locks when its face's last tab leaves (each
 * tab holds its own unlock), and the door says so by name.
 *
 * WHAT A SESSION THAT HAS NOT UNLOCKED READS. Custody AT REST reaches it: how the place and each face rest (`reading`), the
 * roster, the seed's resting state. All of that rests in the clear in this browser's own store, so the door discloses nothing
 * a reader of that store lacks. What the vessel holds OPEN NOW does not reach it until its own unlock admits it: whether the
 * place or any face stands unlocked, the census of sessions and held keys, and the face the lit vessel wears. Each answer
 * names what it withholds (`withheld`), so the person reads why a field stands absent. The standing (floor, lighting, lit)
 * stays: the host already tells every session's hello its floor state.
 */
import {
  browserJoinedFaces, loadBrowserPlaceKel, readBrowserCustody, readBrowserVesselFaces, readFaceCustody,
  type BrowserVesselResult, type VesselHouse, type VesselSession,
} from "@lararium/browser";
import { didFromVerifyingKey } from "@lararium/mesh/lar-did";
import type { CeremonyAskKind } from "../ceremony-protocol.js";
import { ConsoleRefused, type ConsoleVerbRow } from "../console-verbs.js";

/** An ask a session's ceremony door still holds: public words, and whether a ceremony window claimed its port. */
export interface StandingAsk { readonly askId: string; readonly kind: CeremonyAskKind; readonly act: string; readonly face: string | null; readonly ceremony: "unopened" | "open" }

/** What the host hands the rows: live readers over its own state, for the connection the call arrived on. */
export interface VesselConsoleCtx {
  /** The store this host stands over, or null before any tab's hello named one. */
  readonly idbName: () => string | null;
  /** The house over that store, or null where none stands (no hello yet, or the store refused this worker). */
  readonly house: () => Promise<VesselHouse<BrowserVesselResult> | null>;
  /** This connection's session, or null where it holds none. */
  readonly session: () => VesselSession | null;
  /** The lit vessel, or null at the floor. */
  readonly lit: () => BrowserVesselResult | null;
  /** Whether this connection's session stands admitted wearing the lit vessel's face. */
  readonly wearsLit: () => boolean;
  /** The asks this connection's ceremony door still holds. */
  readonly asks: () => readonly StandingAsk[];
  /** The relay the first hello named, or null for a local boot. */
  readonly relayUrl: () => string | null;
  /** The seed's resting state for a face (null: this browser itself), named and never its bytes. */
  readonly seedRest: (face: string | null) => Promise<{ readonly seedRest: string; readonly seedWrapClass?: string }>;
  /** The origin the page reads its hearth's porch at. */
  readonly readFace: string;
}

/** The house this call reads and its store, or the refusal that names why none stands. */
async function standing(ctx: VesselConsoleCtx): Promise<{ readonly house: VesselHouse<BrowserVesselResult>; readonly idbName: string }> {
  const house = await ctx.house();
  const idbName = ctx.idbName();
  if (!house || idbName === null) throw new ConsoleRefused("vessel-unstood", "this vessel worker stands no house yet: no tab's hello reached it, or another worker owns the store");
  return { house, idbName };
}

/** A custody reading as it rests: its `unlocked` flag (what stands open now) left out. */
const atRest = <T extends object>(reading: T): Omit<T, "unlocked"> => {
  const { unlocked: _open, ...rest } = reading as T & { unlocked?: unknown };
  return rest as Omit<T, "unlocked">;
};

/** A reading that names its own failure instead of failing the whole answer. */
const orWhy = <T>(read: Promise<T>): Promise<T | { readonly unread: string }> =>
  read.catch((err: unknown) => ({ unread: err instanceof Error ? err.message : String(err) }));

export function vesselConsoleRows(ctx: VesselConsoleCtx): ConsoleVerbRow[] {
  return [
    {
      path: ["vessel", "read"],
      summary: "read this browser vessel: its place, standing, faces, relay, floor pin, pending asks and custody at rest",
      run: async () => {
        const { house, idbName } = await standing(ctx);
        const session = ctx.session();
        const lit = ctx.lit();
        const worn = ctx.wearsLit();
        const face = session?.face ?? null;
        const admitted = session?.admission === "admitted";
        const [place, named, joined, custody, faceCustody, seed, floorPin] = await Promise.all([
          orWhy(loadBrowserPlaceKel(idbName).then((kel) => kel && kel.ok ? { aid: kel.aid, kel: "armed" as const } : { aid: null, kel: "unfounded" as const })),
          orWhy(readBrowserVesselFaces(idbName)),
          orWhy(browserJoinedFaces(idbName)),
          orWhy(readBrowserCustody(idbName).then((c) => c.reading === "sealed" ? { reading: c.reading, ...(admitted ? { unlocked: c.unlocked } : {}), slots: c.slots.length } : c)),
          face === null ? null : orWhy(readFaceCustody(idbName, face).then((c) => admitted ? c : atRest(c))),
          orWhy(ctx.seedRest(face)),
          // THE FLOOR PIN rests in the fixed-title state the lit vessel opened, so a vessel at its floor names the refusal the pin door itself names.
          lit && worn
            ? orWhy(lit.floorStatus(ctx.readFace))
            : { ok: false as const, refusal: "floor-state-unread", detail: "this vessel stands at its floor for this tab, so it holds no pin to read: the pin rests in the fixed-title state a lit vessel opens" },
        ]);
        return {
          standing: house.floor(),
          place,
          session: session ? { admission: session.admission, admittedBy: session.admittedBy, face } : null,
          faces: { named, joined, ...(admitted ? { worn: lit ? lit.face : null } : {}) },
          relay: { dials: ctx.relayUrl(), connection: lit && worn ? lit.connectionState.getSnapshot() : null },
          floorPin,
          asks: ctx.asks(),
          custody: { place: custody, face: faceCustody, ...("unread" in seed ? { seed } : seed), ...(admitted ? { held: house.census() } : {}) },
          vessel: lit && worn ? { did: didFromVerifyingKey(lit.identity.verifyingKey), verifyingKey: lit.identity.verifyingKey, activeWikiId: lit.activeWikiId, ...(lit.wikiAwaitsFace ? { wikiAwaits: lit.wikiAwaitsFace.message } : {}) } : null,
          withheld: admitted ? [] : ["faces.worn", "custody.place.unlocked", "custody.face.unlocked", "custody.held"],
        };
      },
    },
    {
      // The node's `lares vault status` answers `{custody, door}`: custody at rest, and what the standing vessel holds. The same two halves read here.
      path: ["vault", "status"],
      summary: "read custody: how this browser's place and each face it names rest (clear, sealed, bound), and what this tab's session holds open",
      run: async () => {
        const { house, idbName } = await standing(ctx);
        const session = ctx.session();
        const admitted = session?.admission === "admitted";
        const named = await orWhy(readBrowserVesselFaces(idbName));
        const faces = "unread" in named ? named : await Promise.all(named.map(async (face) => ({ face, ...(await orWhy(readFaceCustody(idbName, face).then((c) => admitted ? c : atRest(c)))) })));
        const place = await orWhy(readBrowserCustody(idbName).then((c) => c.reading === "sealed" ? { reading: c.reading, ...(admitted ? { unlocked: c.unlocked } : {}), slots: c.slots.map((slot) => slot.kinds) } : c));
        return {
          custody: { place, faces, seed: await orWhy(ctx.seedRest(session?.face ?? null)) },
          // The door's own `unlocked` names THIS session alone, so it reads at every admission.
          door: { standing: house.floor(), unlocked: admitted, admittedBy: session?.admittedBy ?? null, face: session?.face ?? null, ...(admitted ? { held: house.census() } : {}) },
          withheld: admitted ? [] : ["custody.place.unlocked", "custody.faces[].unlocked", "door.held"],
        };
      },
    },
  ];
}
