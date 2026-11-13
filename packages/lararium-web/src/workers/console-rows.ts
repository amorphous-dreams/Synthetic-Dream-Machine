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
 */
import {
  browserJoinedFaces, loadBrowserPlaceKel, readBrowserCustody, readBrowserVesselFaces, readFaceCustody,
  type BrowserVesselResult, type VesselHouse, type VesselSession,
} from "@lararium/browser";
import { didFromVerifyingKey } from "@lararium/mesh";
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
        const [place, named, joined, custody, faceCustody, seed, floorPin] = await Promise.all([
          orWhy(loadBrowserPlaceKel(idbName).then((kel) => kel && kel.ok ? { aid: kel.aid, kel: "armed" as const } : { aid: null, kel: "unfounded" as const })),
          orWhy(readBrowserVesselFaces(idbName)),
          orWhy(browserJoinedFaces(idbName)),
          orWhy(readBrowserCustody(idbName).then((c) => c.reading === "sealed" ? { reading: c.reading, unlocked: c.unlocked, slots: c.slots.length } : c)),
          face === null ? null : orWhy(readFaceCustody(idbName, face)),
          orWhy(ctx.seedRest(face)),
          // THE FLOOR PIN rests in the control document the lit vessel stood, so a vessel at its floor names the refusal the pin door itself names.
          lit && worn
            ? orWhy(lit.floorStatus(ctx.readFace))
            : { ok: false as const, refusal: "floor-control-unread", detail: "this vessel stands at its floor for this tab, so it holds no pin to read: the pin rests in the control document a lit vessel stands" },
        ]);
        return {
          standing: house.floor(),
          place,
          session: session ? { admission: session.admission, admittedBy: session.admittedBy, face } : null,
          faces: { named, joined, worn: lit ? lit.face : null },
          relay: { dials: ctx.relayUrl(), connection: lit && worn ? lit.connectionState.getSnapshot() : null },
          floorPin,
          asks: ctx.asks(),
          custody: { place: custody, face: faceCustody, ...("unread" in seed ? { seed } : seed), held: house.census() },
          vessel: lit && worn ? { did: didFromVerifyingKey(lit.identity.verifyingKey), verifyingKey: lit.identity.verifyingKey, activeWikiId: lit.activeWikiId, ...(lit.wikiAwaitsFace ? { wikiAwaits: lit.wikiAwaitsFace.message } : {}) } : null,
        };
      },
    },
  ];
}
