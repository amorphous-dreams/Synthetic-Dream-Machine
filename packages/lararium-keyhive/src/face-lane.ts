/**
 * face-lane — EACH HAT REACHED BY NAME on the daemon island (the hats: worn = the default reach · lit = reachable by name ·
 * shut = silent). A store verb runs as the face whose session placed it:
 *
 *   · THE MOUNTED FACE (or an ask that names no presenter) runs the verb as it always ran, over the mount's own wiki.
 *   · A LIT SIBLING runs it on ITS OWN LANE: the one bag of its own the lit set resolves for that face (`lit-face-target`,
 *     its daemon canon by its own relation, or a daemon slot its own wear named), whose document that face owns. Its session
 *     booked the call under its own face key, so whatever the verb writes seals under that face's own chain and holder
 *     (face-seat-table). A container naming anything else (a recipe, another bag, a realm, a lane another face owns) refuses
 *     `face-lane-holds-its-own`.
 *   · A PRESENTER NEITHER MOUNTED NOR LIT (a shut face) refuses `face-not-open`, and nothing runs.
 *
 * THE TIDDLER DOOR BY FACE (`faceEngineReactor`): the engine verbs (`FACE_ENGINE_VERBS`) answer through a live TiddlyWiki
 * engine. The mount's engine answers the mounted face; a LIT sibling's verb runs in THAT face's own engine (`face-engine`), the
 * anchor composition over its own daemon canon and the working, draft and personal slots its own wear named, so its read sees
 * its own wiki and its write lands in its own working document. A sibling names its own daemon wiki (`recipe: "default"`)
 * alone; any other container refuses `face-lane-holds-its-own`, and a shut face refuses `face-not-open`.
 *
 * Every answer names the face it acted as (`face`, its handle index), so a write says where it landed. No delegation stands
 * between faces: the face acts as itself, or not at all.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { VerbRefusal, type LarTiddlerStore } from "@lararium/mesh";
import type { FaceEngine, VerbContext, VerbReactor } from "@lararium/tw5";

/** The tiddler door's verbs a lit sibling reaches in its own engine (`faceEngineReactor`). */
export const FACE_ENGINE_VERBS: ReadonlySet<string> = new Set(["tiddler-get", "tiddler-put", "tiddler-delete", "wiki-filter", "wiki-render", "wiki-status", "oracle-cast"]);
/** The verbs a lit sibling reaches on its own lane: the meme verbs on its own document, the engine verbs in its own engine. */
export const FACE_LANE_VERBS: ReadonlySet<string> = new Set(["meme-put", "meme-get", "meme-list", "meme-delete", ...FACE_ENGINE_VERBS]);

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

/** The ports the engine verbs read: who the presenter names, and a lit face's own engine. */
export interface FaceEnginePorts extends Pick<FaceLanePorts, "mountedKey" | "mountedOrdinal" | "lit"> {
  /** The lit face's own engine over its own daemon documents, or null where none composes. */
  engine(face: number): Promise<Pick<FaceEngine, "tw5" | "composite"> | null>;
}

const bare = (did: string): string => did.trim().toLowerCase().replace(/^0x/, "");
const withFace = (out: unknown, face: number | null): Record<string, unknown> => {
  const answer = out !== null && typeof out === "object" && !Array.isArray(out) ? out as Record<string, unknown> : { value: out };
  return face === null ? answer : { ...answer, face };
};

/** The face a call's presenter names: the mount (or no presenter), a lit sibling, or a refusal for a shut face. */
function presenterFace(verb: string, ctx: VerbContext, ports: Pick<FaceLanePorts, "mountedKey" | "lit">): { readonly handleIndex: number } | "mounted" {
  const presenter = ctx.presenter === undefined ? null : bare(ctx.presenter);
  const mount = ports.mountedKey();
  if (presenter === null || (mount !== null && presenter === bare(mount))) return "mounted";
  const sibling = ports.lit(presenter);
  if (sibling === null) {
    throw new VerbRefusal("face-not-open", `face-not-open: ${verb} — face ${presenter.slice(0, 12)}… stands shut on this island; nothing ran.`);
  }
  return sibling;
}

/** Wrap a store verb so it runs as the face whose session placed it: the mount's reactor, or the sibling's own lane. */
export function faceLaneReactor(
  verb: string,
  mounted: VerbReactor,
  laneOf: (lane: { readonly bag: string; readonly store: LarTiddlerStore }) => VerbReactor,
  ports: FaceLanePorts,
): VerbReactor {
  return async (args, ctx) => {
    const sibling = presenterFace(verb, ctx, ports);
    if (sibling === "mounted") return withFace(await mounted(args, ctx), ports.mountedOrdinal());
    const holds = (why: string): VerbRefusal =>
      new VerbRefusal("face-lane-holds-its-own", `face-lane-holds-its-own: ${verb} — face h${sibling.handleIndex} reaches its own lane alone (its daemon canon, \`--bag lar:///ha.ka.ba/bags/daemon-<its relation>\`, or a daemon slot its own wear named); ${why}, and nothing moved.`);
    const bag = typeof args["bag"] === "string" ? args["bag"] : null;
    if (bag === null || args["recipe"] !== undefined || args["realm"] !== undefined) throw holds("this container names no bag of its own");
    const resolved = await ports.target(sibling.handleIndex, bag);
    if (resolved === null || resolved.owner !== sibling.handleIndex) throw holds(`${bag} names no document this face owns`);
    return withFace(await laneOf({ bag, store: resolved.store })(args, ctx), sibling.handleIndex);
  };
}

/** Wrap an engine verb so it runs in the engine of the face whose session placed it: the mount's, or the sibling's own. */
export function faceEngineReactor(
  verb: string,
  mounted: VerbReactor,
  engineOf: (engine: Pick<FaceEngine, "tw5" | "composite">) => VerbReactor,
  ports: FaceEnginePorts,
): VerbReactor {
  return async (args, ctx) => {
    const sibling = presenterFace(verb, ctx, ports);
    if (sibling === "mounted") return withFace(await mounted(args, ctx), ports.mountedOrdinal());
    if (args["recipe"] !== "default" || args["bag"] !== undefined || args["realm"] !== undefined) {
      throw new VerbRefusal("face-lane-holds-its-own", `face-lane-holds-its-own: ${verb} — face h${sibling.handleIndex} reaches its own daemon wiki alone (\`--recipe default\`, in its own engine); this container names another, and nothing moved.`);
    }
    const engine = await ports.engine(sibling.handleIndex);
    if (engine === null) {
      throw new VerbRefusal("face-not-open", `face-not-open: ${verb} — face h${sibling.handleIndex} composes no engine of its own on this island; nothing ran.`);
    }
    return withFace(await engineOf(engine)(args, ctx), sibling.handleIndex);
  };
}
