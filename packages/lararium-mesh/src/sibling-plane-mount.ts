/**
 * sibling-plane-mount — A LIT SIBLING'S PROVEN PLANES MOUNT FOR ITS LIT LIFE, AND NOTHING ELSE DOES (operator ruling 2026-11-21).
 *
 * A face that stands lit beside the worn one answers its own vota on its own turn, so its door reads its own intent plane and
 * the persona plane its roster folds from. Those two documents, and no other kind, mount in the live Repo while the face
 * stands lit, and only as the face's own signed log names them under its anchor and verified KEL:
 *
 *   readSiblingFacePlanes(raw)        the carried pair, or a refusal: any slot kind beyond `persona` and `intents` refuses
 *   recheckSiblingPlanes(input)       the pair re-read against the face's own log and KEL: a pair the log does not name mounts nothing
 *   siblingPlaneMounts()              the vessel's mounts by group: each document files under its face while that face stands
 *                                     lit and under none once it goes dark; a drop takes the face's mount whole
 *
 * Pure: no Repo, no key, no clock, no IO. The node files its sealed map through the mounts, and the daemon island re-checks
 * the pair before its door reads a byte of either plane.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-intent-plane#/the-vow
 */
import type { FaceAnchor } from "./face-anchor.js";
import { proveFaceFromLog } from "./face-boot-proof.js";
import type { PersonaProjection } from "./persona-act.js";
import type { PersonaKelEvent } from "./persona-kel.js";
import { personaBagIdFor, personaSiblingBagIds } from "./persona-scope.js";

/** The two plane kinds a lit sibling mounts: its intent plane and the persona plane its roster folds from. */
export const SIBLING_PLANE_KINDS = ["persona", "intents"] as const;
export interface SiblingFacePlanes { readonly persona: string; readonly intents: string }
export type SiblingMountRefusal = "sibling-mount-slot-refused" | "sibling-mount-shape" | "sibling-mount-unproved";
export type SiblingMountReading<T> = { readonly ok: true } & T | { readonly ok: false; readonly refusal: SiblingMountRefusal; readonly detail: string };

const AUTOMERGE_URL = /^automerge:[1-9A-HJ-NP-Za-km-z]+$/;

/** The carried pair as a mount reads it: exactly `persona` and `intents`, each an automerge url; any other slot kind refuses by name. */
export function readSiblingFacePlanes(raw: unknown): SiblingMountReading<{ readonly planes: SiblingFacePlanes }> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, refusal: "sibling-mount-shape", detail: "the mount names no plane pair" };
  const stray = Object.keys(raw).filter((kind) => !(SIBLING_PLANE_KINDS as readonly string[]).includes(kind));
  if (stray.length > 0) return { ok: false, refusal: "sibling-mount-slot-refused", detail: `a lit sibling mounts its intents and persona planes alone; refused: ${stray.sort().join(", ")}` };
  const { persona, intents } = raw as Record<string, unknown>;
  if (typeof persona !== "string" || !AUTOMERGE_URL.test(persona) || typeof intents !== "string" || !AUTOMERGE_URL.test(intents) || persona === intents) {
    return { ok: false, refusal: "sibling-mount-shape", detail: "the pair names two distinct automerge urls, persona and intents" };
  }
  return { ok: true, planes: { persona, intents } };
}

/** The pair re-read against the face's own signed log under its anchor and verified KEL: both urls must stand in its `plane` acts. */
export function recheckSiblingPlanes(input: {
  readonly planes: unknown;
  readonly records: readonly unknown[];
  readonly chain: readonly PersonaKelEvent[] | null;
  readonly anchor: FaceAnchor | null;
  readonly group: string;
}): SiblingMountReading<{ readonly planes: SiblingFacePlanes; readonly projection: PersonaProjection }> {
  const read = readSiblingFacePlanes(input.planes);
  if (!read.ok) return read;
  if (!input.chain || input.chain.length === 0 || !input.anchor) return { ok: false, refusal: "sibling-mount-unproved", detail: "no anchor or verified KEL to read the face's log under" };
  const proof = proveFaceFromLog({ records: input.records, chain: input.chain, group: input.group, anchor: input.anchor, planes: { ...read.planes } });
  if (!proof.ok) return { ok: false, refusal: "sibling-mount-unproved", detail: `the face's own log refuses the pair: ${proof.refusal.why}${"plane" in proof.refusal ? ` ${proof.refusal.plane}` : ""}` };
  return { ok: true, planes: read.planes, projection: proof.projection };
}

/** One lit face as the mounts read it: its group and the subject its documents seal under. */
export interface LitPlaneFace { readonly group: string | null; readonly face: string | null }

/** The vessel's sibling plane mounts, by group. */
export interface SiblingPlaneMounts {
  /** Mount a face's proven pair; a refused pair mounts nothing and leaves any earlier mount of the face standing whole. */
  mount(group: string, proven: { readonly ok: true; readonly planes: SiblingFacePlanes } | { readonly ok: false } | null): SiblingMountReading<{ readonly bags: readonly string[] }>;
  /** The bag a document files under, and the face it seals under while that face stands lit (none once dark); null where no mount names it. */
  bagOf(documentId: string, lit: readonly LitPlaneFace[]): { readonly bagId: string; readonly face: string | null } | null;
  /** The face went dark (a close, a lock): its mount leaves whole, naming the documents it unmounts so each cache evicts them. */
  drop(group: string): readonly string[];
  /** Every group that holds a mount. */
  groups(): string[];
}

const documentIdOf = (url: string): string => url.slice("automerge:".length);

export function siblingPlaneMounts(): SiblingPlaneMounts {
  const mounts = new Map<string, readonly { readonly bagId: string; readonly documentId: string }[]>();
  return {
    mount(group, proven) {
      if (proven === null || !proven.ok) return { ok: false, refusal: "sibling-mount-unproved", detail: `no proof of ${group.slice(0, 12)}…'s planes stands; nothing mounts` };
      const read = readSiblingFacePlanes(proven.planes);
      if (!read.ok) return read;
      const ids = personaSiblingBagIds(personaBagIdFor(group));
      if (!ids) return { ok: false, refusal: "sibling-mount-shape", detail: "the group derives no plane names" };
      const rows = [{ bagId: personaBagIdFor(group), documentId: documentIdOf(read.planes.persona) }, { bagId: ids.intents, documentId: documentIdOf(read.planes.intents) }];
      mounts.set(group, rows);
      return { ok: true, bags: rows.map((r) => r.bagId) };
    },
    bagOf(documentId, lit) {
      for (const [group, rows] of mounts) {
        const row = rows.find((r) => r.documentId === documentId);
        if (row) return { bagId: row.bagId, face: lit.find((f) => f.group === group)?.face ?? null };
      }
      return null;
    },
    drop(group) {
      const rows = mounts.get(group) ?? [];
      mounts.delete(group);
      return rows.map((r) => r.documentId);
    },
    groups: () => [...mounts.keys()].sort(),
  };
}
