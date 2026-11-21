/**
 * lent-faces — the set of faces a pūlama lends one vessel, and the one face a session wears inside it.
 *
 * Three acts stand apart: the human LIGHTS faces at the pūlama, the pūlama LENDS a vessel a set of them, a session WEARS one
 * face chosen inside that set. This core holds the lend and the wear as pure reads: no IO, no custody, no host. The node's
 * pūlama scope, guard and seat bind it, and a browser tab binds it over its own PersonaGroup memberships.
 *
 *   lentFacesOf(raw)           a wire value parses into the canonical set (sorted by ordinal), or refuses by class
 *   isLent(set, ordinal)       membership by ordinal
 *   servedOf(set, lit)         partial lighting: the lit faces the set lends serve, the dark ones wait by name
 *   wearInside(set, named, w)  the face a session wears: the named face if lent, else the worn face if lent, else the sole one
 *   renderLentFaces(set)       `h0, h2`, for refusal messages
 *
 * NO SET NEVER MEANS EVERY FACE. An empty or missing set refuses `lent-faces-empty`; a lend always names its faces.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/project/light-lend-wear
 */

/** One lent face: its ordinal, and its custody id where the admission records carry one (`AdmittedFace {fcid, ordinal}`). */
export interface LentFace { readonly ordinal: number; readonly fcid?: string }

declare const lentFacesBrand: unique symbol;
/** The canonical lent set: non-empty, sorted by ordinal, no ordinal or fcid twice. Only `lentFacesOf` makes one. */
export type LentFaces = readonly LentFace[] & { readonly [lentFacesBrand]: true };

/** The classes a wire value refuses by. */
export type LentFacesRefusal = "lent-faces-empty" | "lent-faces-duplicate" | "lent-faces-malformed";
export type LentFacesParse = { readonly ok: true; readonly faces: LentFaces } | { readonly ok: false; readonly refusal: LentFacesRefusal; readonly message: string };

/** The classes a session's wear refuses by. */
export type WearRefusal = "face-not-lent" | "face-not-named";
export type WearInside = { readonly ok: true; readonly face: LentFace } | { readonly ok: false; readonly refusal: WearRefusal; readonly message: string };

const isOrdinal = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const refuse = (refusal: LentFacesRefusal, message: string): LentFacesParse => ({ ok: false, refusal, message: `${refusal}: ${message}` });

function memberOf(v: unknown): LentFace | null {
  if (isOrdinal(v)) return { ordinal: v };
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const { ordinal, fcid } = v as Record<string, unknown>;
  if (!isOrdinal(ordinal)) return null;
  if (fcid === undefined) return { ordinal };
  return typeof fcid === "string" && fcid.length > 0 ? { fcid, ordinal } : null;
}

/** Parse a wire value (an array of ordinals, or of `{ordinal, fcid?}`) into the canonical lent set, or name its refusal. */
export function lentFacesOf(raw: unknown): LentFacesParse {
  if (raw === null || raw === undefined || (Array.isArray(raw) && raw.length === 0)) return refuse("lent-faces-empty", "a lend names at least one face");
  if (!Array.isArray(raw)) return refuse("lent-faces-malformed", "a lent set reads as an array of face ordinals");
  const faces: LentFace[] = [];
  for (const v of raw) {
    const face = memberOf(v);
    if (face === null) return refuse("lent-faces-malformed", "each lent face reads as a whole ordinal, or {ordinal, fcid} with a non-empty fcid");
    faces.push(face);
  }
  const ordinals = new Set<number>(), fcids = new Set<string>();
  for (const f of faces) {
    if (ordinals.has(f.ordinal)) return refuse("lent-faces-duplicate", `h${f.ordinal} stands twice in the set`);
    ordinals.add(f.ordinal);
    if (f.fcid === undefined) continue;
    if (fcids.has(f.fcid)) return refuse("lent-faces-duplicate", `one fcid stands under two ordinals`);
    fcids.add(f.fcid);
  }
  faces.sort((a, b) => a.ordinal - b.ordinal);
  return { ok: true, faces: Object.freeze(faces) as unknown as LentFaces };
}

/** The canonical wire form: each face with its keys in fixed order (`fcid` before `ordinal`), sorted by ordinal. */
export function lentFacesWire(set: LentFaces): readonly LentFace[] {
  return set.map(f => (f.fcid === undefined ? { ordinal: f.ordinal } : { fcid: f.fcid, ordinal: f.ordinal }));
}

/** Whether the set lends the face at this ordinal. */
export function isLent(set: LentFaces, ordinal: number): boolean {
  return set.some(f => f.ordinal === ordinal);
}

/** The set as refusal messages name it: `h0, h2`. */
export function renderLentFaces(set: readonly LentFace[]): string {
  return set.map(f => `h${f.ordinal}`).join(", ");
}

/** Partial lighting: the lent faces that stand lit serve, the lent faces still dark wait by name. Lit faces the set never lent drop. */
export function servedOf(set: LentFaces, lit: readonly number[]): { readonly served: readonly LentFace[]; readonly waiting: readonly LentFace[] } {
  const on = new Set(lit);
  return { served: set.filter(f => on.has(f.ordinal)), waiting: set.filter(f => !on.has(f.ordinal)) };
}

/**
 * The face a session wears inside the lent set. A named face passes where the set lends it and refuses `face-not-lent`
 * otherwise. With no face named: the worn face (the daemon mount) where the set lends it, else the set's sole face, else
 * `face-not-named`. Each refusal names the lent set.
 */
export function wearInside(set: LentFaces, named: number | null, worn: number | null): WearInside {
  const lentNames = renderLentFaces(set);
  if (named !== null) {
    const face = set.find(f => f.ordinal === named);
    return face !== undefined ? { ok: true, face }
      : { ok: false, refusal: "face-not-lent", message: `face-not-lent: this call names h${named}, and this vessel serves ${lentNames} alone` };
  }
  const wornFace = worn === null ? undefined : set.find(f => f.ordinal === worn);
  if (wornFace !== undefined) return { ok: true, face: wornFace };
  if (set.length === 1) return { ok: true, face: set[0]! };
  return { ok: false, refusal: "face-not-named", message: `face-not-named: this vessel serves ${lentNames}; name the face this session wears (\`--face N\`)` };
}
