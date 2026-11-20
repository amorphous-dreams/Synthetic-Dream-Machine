/**
 * face-lane — EACH HAT REACHED BY NAME on the daemon island (the hats: worn = the default reach · lit = reachable by name ·
 * shut = silent). A store verb runs as the face whose session placed it:
 *
 *   · THE MOUNTED FACE (or an ask that names no presenter) runs the verb as it always ran, over the mount's own wiki.
 *   · A LIT SIBLING runs it on ITS OWN LANE: the one bag of its own the lit set resolves for that face (`lit-face-target`,
 *     its daemon canon by its own relation), whose document that face owns. Its session booked the call under its own face
 *     key, so whatever the verb writes seals under that face's own chain and holder (face-seat-table). A container naming
 *     anything else (a recipe, another bag, a realm, a lane another face owns) refuses `face-lane-holds-its-own`.
 *   · A PRESENTER NEITHER MOUNTED NOR LIT (a shut face) refuses `face-not-open`, and nothing runs.
 *
 * Every answer names the face it acted as (`face`, its handle index), so a write says where it landed. No delegation stands
 * between faces: the face acts as itself, or not at all.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { VerbRefusal, type LarTiddlerStore } from "@lararium/mesh";
import type { VerbReactor } from "@lararium/tw5";

/** The verbs a lit sibling reaches on its own lane. */
export const FACE_LANE_VERBS: ReadonlySet<string> = new Set(["meme-put", "meme-get", "meme-list", "meme-delete"]);

export interface FaceLanePorts {
  /** The mounted face's bare atom key, or null at the floor. */
  mountedKey(): string | null;
  /** The mounted face's handle index, or null where it names none. */
  mountedOrdinal(): number | null;
  /** The lit sibling a bare presenter key names (its handle index), or null. */
  lit(key: string): { readonly handleIndex: number } | null;
  /** The lit set's resolution of `bag` for face `face`: a store over that face's own document and the face the control
   *  document names as its owner, or null where none resolves. */
  target(face: number, bag: string): Promise<{ readonly store: LarTiddlerStore; readonly owner: number | null } | null>;
}

const bare = (did: string): string => did.trim().toLowerCase().replace(/^0x/, "");
const withFace = (out: unknown, face: number | null): Record<string, unknown> => {
  const answer = out !== null && typeof out === "object" && !Array.isArray(out) ? out as Record<string, unknown> : { value: out };
  return face === null ? answer : { ...answer, face };
};

/** Wrap a store verb so it runs as the face whose session placed it: the mount's reactor, or the sibling's own lane. */
export function faceLaneReactor(
  verb: string,
  mounted: VerbReactor,
  laneOf: (lane: { readonly bag: string; readonly store: LarTiddlerStore }) => VerbReactor,
  ports: FaceLanePorts,
): VerbReactor {
  return async (args, ctx) => {
    const presenter = ctx.presenter === undefined ? null : bare(ctx.presenter);
    const mount = ports.mountedKey();
    if (presenter === null || (mount !== null && presenter === bare(mount))) return withFace(await mounted(args, ctx), ports.mountedOrdinal());
    const sibling = ports.lit(presenter);
    if (sibling === null) {
      throw new VerbRefusal("face-not-open", `face-not-open: ${verb} — face ${presenter.slice(0, 12)}… stands shut on this island; nothing ran.`);
    }
    const holds = (why: string): VerbRefusal =>
      new VerbRefusal("face-lane-holds-its-own", `face-lane-holds-its-own: ${verb} — face h${sibling.handleIndex} reaches its own lane alone (its daemon canon, \`--bag lar:///ha.ka.ba/bags/daemon-<its relation>\`); ${why}, and nothing moved.`);
    const bag = typeof args["bag"] === "string" ? args["bag"] : null;
    if (bag === null || args["recipe"] !== undefined || args["realm"] !== undefined) throw holds("this container names no bag of its own");
    const resolved = await ports.target(sibling.handleIndex, bag);
    if (resolved === null || resolved.owner !== sibling.handleIndex) throw holds(`${bag} names no document this face owns`);
    return withFace(await laneOf({ bag, store: resolved.store })(args, ctx), sibling.handleIndex);
  };
}
