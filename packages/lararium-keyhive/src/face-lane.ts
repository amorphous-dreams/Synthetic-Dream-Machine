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
 * A LIT FACE RECEIVES VISITS (`crossFaceReactor`, operator ruling 2026-11-20, state/decisions "the cross-face reach"): a read
 * or render verb (`CROSS_FACE_READ_VERBS`) naming another face as its `target` keeps the session's worn face (its presenter
 * and asker stay its own) and answers from the TARGET's cross-face view (`composeCrossFaceView`: its daemon canon and working
 * layer, the shared libraries and the floor, never its personal layer), with no lei, under the target's own standing read; no
 * admin ask passes there. The door's order: a `bag` naming a PRIVATE layer refuses `cross-face-private` first; a verb outside
 * the read set refuses `cross-face-write-refused` (the cross-face write rite rides a lei, in a later lane); a target neither
 * mounted nor lit refuses `face-not-open`; a named wiki or a realm refuses `cross-face-wiki-unreached` (a sibling's named
 * wikis compose under its own catalog and workbench seat, which this island reads for the worn face alone). The answer names
 * the face it read (`face`) and the face worn (`worn`), and carries `visit: true`, which the vessel's receipt doors read to
 * withhold a visit's body from every retrieval but the answer itself. A target naming the face worn reads as no target.
 * A VISIT BINDS TO THE TARGET'S OPENING on this island (`opening`: each light of a face names a fresh one, and a drop names
 * none): it captures the opening before it reads and reads it again before it answers, so a lock, or a lock and re-light,
 * while the read runs refuses `face-not-open` and hands no body back.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { CROSS_FACE_READ_VERBS, VerbRefusal, bagUri, crossFacePrivateRefusal, CROSS_FACE_PRIVATE, type LarTiddlerStore } from "@lararium/mesh";
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

/** The ports a visit reads: who the presenter names, which faces stand lit, a target's cross-face view and its standing read. */
export interface CrossFacePorts extends Pick<FaceLanePorts, "mountedKey" | "mountedOrdinal" | "lit"> {
  /** The opening `face` stands under on this island (the mount, or a lit sibling: each light names a fresh one), or null where
   *  it stands shut. */
  opening(face: number): string | null;
  /** The target's cross-face view over its daemon wiki, or null where none composes. */
  view(face: number): Promise<Pick<FaceEngine, "tw5" | "composite"> | null>;
  /** The target's standing read: the cap a visit's door asks, which answers a read alone. */
  readAs(face: number): VerbContext["cap"];
}

/** The face a call's `target` names as the vessel's door resolved it (a whole handle index, or `h<N>`), or null. */
function targetOrdinal(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) return raw;
  if (typeof raw === "string" && /^h?(0|[1-9]\d*)$/.test(raw)) return Number(raw.replace(/^h/, ""));
  return null;
}

/**
 * Wrap a verb so a read naming another lit face as its `target` answers from that face's CROSS-FACE VIEW, keeping the worn
 * face; `routed` (the face's own route: the mount's reactor, or a sibling's lane or engine) answers every call that names no
 * other face. See the module comment for the door's order.
 */
export function crossFaceReactor(
  verb: string,
  routed: VerbReactor,
  viewOf: (view: Pick<FaceEngine, "tw5" | "composite">) => VerbReactor,
  ports: CrossFacePorts,
): VerbReactor {
  return async (args, ctx) => {
    if (args["target"] === undefined) return routed(args, ctx);
    const { target: raw, ...rest } = args;
    // PRIVATE FIRST: a bag naming a private layer refuses before anything else reads the call.
    if (typeof rest["bag"] === "string") {
      const named = rest["bag"].startsWith("lar:") ? rest["bag"] : bagUri(rest["bag"]);
      const refusal = crossFacePrivateRefusal(named);
      if (refusal !== null) throw new VerbRefusal(CROSS_FACE_PRIVATE, `${refusal}; ${verb} moved nothing.`);
    }
    const target = targetOrdinal(raw);
    if (target === null) {
      throw new VerbRefusal("target-unresolved", `target-unresolved: ${verb} — the target ${JSON.stringify(raw)} names no face by handle index; the vessel's door resolves a pet name before the call reaches this island, and nothing ran.`);
    }
    const wearing = presenterFace(verb, ctx, ports);
    const worn = wearing === "mounted" ? ports.mountedOrdinal() : wearing.handleIndex;
    if (target === worn) return routed(rest, ctx);
    if (!CROSS_FACE_READ_VERBS.has(verb)) {
      throw new VerbRefusal("cross-face-write-refused", `cross-face-write-refused: ${verb} names face h${target} while the session wears ${worn === null ? "no face" : `h${worn}`}; a seat reads and renders another lit face (${[...CROSS_FACE_READ_VERBS].join(", ")}), and a write to another face waits on the cross-face write rite, so nothing moved.`);
    }
    const opened = ports.opening(target);
    if (opened === null) {
      throw new VerbRefusal("face-not-open", `face-not-open: ${verb} — face h${target} stands shut on this island; a visit reads a lit face alone, and nothing ran.`);
    }
    if (rest["realm"] !== undefined || (rest["recipe"] !== undefined && rest["recipe"] !== "default")) {
      throw new VerbRefusal("cross-face-wiki-unreached", `cross-face-wiki-unreached: ${verb} — a visit to face h${target} reads its daemon wiki (\`--recipe default\`, or one of its daemon bags); its named wikis compose under its own catalog and workbench seat, which this island reads for the worn face alone, and nothing ran.`);
    }
    const view = await ports.view(target);
    if (view === null) {
      throw new VerbRefusal("face-not-open", `face-not-open: ${verb} — face h${target} composes no cross-face view on this island; nothing ran.`);
    }
    const out = await viewOf(view)(rest, { ...ctx, cap: ports.readAs(target) });
    // THE SAME OPENING, OR NO ANSWER: a face that shut, or shut and lit again, while the visit read hands no body back.
    if (ports.opening(target) !== opened) {
      throw new VerbRefusal("face-not-open", `face-not-open: ${verb} — face h${target} shut while the visit read (its opening moved), so the read answers nothing.`);
    }
    return { ...withFace(out, target), ...(worn !== null ? { worn } : {}), visit: true };
  };
}
