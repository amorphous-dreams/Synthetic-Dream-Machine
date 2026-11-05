/**
 * persona-act — the signed acts of a face's `@persona` plane, and the projection a reader builds from them.
 *
 * Founding and admission acts, device edges and plane URLs travel as `signed-act` records in the
 * face's `@persona` plane. Sync carries them; THIS reader decides which count. Seq 0 must be the founding act,
 * no later act may found again. Lease advances ride per-writer signed slots (lease-advance), where concurrent writers never fork. The caller's `authorize` carries the
 * anchor's and the KEL's word on who may sign which act (the founding by the persona root's op-key; an admission
 * by the root or by an admitted atom). Everything the face planes hold downstream reads as this projection:
 * disposable, rebuilt, never the authority.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/identity-invariants-2026
 */

import { PERSONA_ACT_DOMAIN } from "./domains.js";
import { currentRoster, rosterAt, type HandLineage } from "./hand-lineage.js";
import { vesselFaceTagHolds } from "./vessel-face-tag.js";
import { foldActs, type ActBody, type ActFold, type SignedAct } from "./signed-act.js";

export type PersonaActKind = "founding" | "admission" | "device-edge" | "plane";

/** The body a `@persona` act signs; `act` names which of the five it is, its fields ride beside. */
export interface PersonaActBody extends ActBody {
  readonly kind: typeof PERSONA_ACT_DOMAIN;
  readonly act: PersonaActKind;
  /** The root-key epoch this act signs under; a chain's epochs only rise. */
  readonly epoch: number;
}

export interface PersonaProjection {
  /** The face stands founded: seq 0 verified as the founding act. */
  readonly founded: boolean;
  /** The founding act's persona-KEL prefix and root commitment. */
  readonly personaKelPrefix: string | null;
  readonly rootCommitment: string | null;
  /** plane name -> the URL the FIRST verified `plane` act put there (a fork stops the log). */
  readonly planes: Readonly<Record<string, string>>;
  /** Verified `plane` acts that tried to move a pinned plane, or to pin a plane after the founding span: they changed nothing, and the boot proof refuses by plane name. */
  readonly planeRewrites: readonly { readonly plane: string; readonly cid: string }[];
  /** device keys a verified admission act seated. */
  readonly devices: readonly string[];
  /** The blinded vessel tags the seated admissions carry, in chain order: one per vessel, so a second admission of one vessel refuses. */
  readonly vesselTags: readonly string[];
  /** Verified admission acts in chain order. */
  readonly admissions: readonly { readonly deviceKey: string; readonly cid: string }[];
  /** Verified admissions the fold seated no device for, each by name: `vessel-tag-absent`, `vessel-tag-invalid`, `vessel-already-admitted`. */
  readonly admissionRefusals: readonly { readonly refusal: "vessel-tag-absent" | "vessel-tag-invalid" | "vessel-already-admitted"; readonly cid: string }[];
  /** device key -> edge digest, from verified device-edge acts. */
  readonly edges: Readonly<Record<string, string>>;
  /** a fork the fold stopped at, else null. */
  readonly fork: ActFold["fork"];
  /** the verified head, for the anchor's frontier. */
  readonly head: { readonly seq: number; readonly cid: string } | null;
  /** the verified lineage's cids, by seq: what a pinned frontier is checked against. */
  readonly cids: readonly string[];
}

/** The act-specific word on who may sign it (an admission by the root or by an admitted atom, say). The signer's
 *  place in the root's roster at the act's OWN epoch is checked by the projection itself. */
export type PersonaAuthorize = (signer: string, body: PersonaActBody) => boolean;

/** Fold a carried set of `@persona` records into the verified projection. */
export function projectPersonaLog(records: readonly unknown[], opts: {
  readonly group: string; readonly lineage: HandLineage; readonly authorize: PersonaAuthorize;
  /**
   * THE RETIRED-KEY WINDOW: a reader that holds an accepted frontier passes its seq. An act beyond that seq signs under the
   * KEL's CURRENT epoch; a key the KEL has rotated past adds nothing new, whatever epoch it claims. What the reader already
   * accepted (seq at or below the pin) keeps its own epoch's roster.
   */
  readonly acceptedThrough?: number;
}): PersonaProjection {
  const fold = foldActs(records, {
    domain: PERSONA_ACT_DOMAIN, group: opts.group,
    authorize: (signer, body) => {
      const b = body as PersonaActBody;
      if ((body.seq === 0) !== (b.act === "founding")) return false;   // the founding stands at seq 0 and nowhere else
      const roster = rosterAt(opts.lineage, b.epoch);
      if (!roster || !roster.signers.includes(signer)) return false;   // a link verifies under its own epoch's keys
      if (opts.acceptedThrough !== undefined && body.seq > opts.acceptedThrough && b.epoch < currentRoster(opts.lineage).epoch) return false;   // a rotated-past epoch signs nothing new
      return opts.authorize(signer, b);
    },
    link: (body, prior) => prior === null || (body as PersonaActBody).epoch >= (prior as PersonaActBody).epoch,
  });
  let personaKelPrefix: string | null = null, rootCommitment: string | null = null;
  const planes: Record<string, string> = {}, edges: Record<string, string> = {};
  const planeRewrites: { plane: string; cid: string }[] = [];
  // The founding span: the founding act and its plane acts, up to the first admission. A plane takes its pin inside it and nowhere later.
  let foundingClosed = false;
  const devices = new Set<string>();
  const admissions: { deviceKey: string; cid: string }[] = [];
  const admissionRefusals: { refusal: "vessel-tag-absent" | "vessel-tag-invalid" | "vessel-already-admitted"; cid: string }[] = [];
  const tagsStanding = new Set<string>(), barred = new Set<string>();
  for (const { act, cid } of fold.chain) {
    const b = act.body as PersonaActBody & Record<string, unknown>;
    switch (b.act) {
      case "founding":
        if (typeof b["personaKelPrefix"] === "string") personaKelPrefix = b["personaKelPrefix"];
        if (typeof b["rootCommitment"] === "string") rootCommitment = b["rootCommitment"];
        break;
      case "admission": {
        foundingClosed = true;
        const deviceKey = b["deviceKey"];
        if (typeof deviceKey !== "string") break;
        const refuse = (refusal: (typeof admissionRefusals)[number]["refusal"]): void => { admissionRefusals.push({ refusal, cid }); if (!devices.has(deviceKey)) barred.add(deviceKey); };
        // THE TAG LAW: an admission seats a device only under a blinded vessel tag whose signature covers this face and that
        // atom, and one vessel never takes two seats in one face.
        if (b["vesselTag"] === undefined && b["vesselSig"] === undefined) { refuse("vessel-tag-absent"); break; }
        if (!vesselFaceTagHolds(opts.group, deviceKey, { vesselTag: b["vesselTag"], vesselSig: b["vesselSig"] })) { refuse("vessel-tag-invalid"); break; }
        const tag = b["vesselTag"] as string;
        if (tagsStanding.has(tag)) { refuse("vessel-already-admitted"); break; }
        tagsStanding.add(tag);
        barred.delete(deviceKey);
        devices.add(deviceKey); admissions.push({ deviceKey, cid });
        break;
      }
      case "device-edge": if (typeof b["deviceKey"] === "string" && !barred.has(b["deviceKey"]) && typeof b["edgeDigest"] === "string") edges[b["deviceKey"]] = b["edgeDigest"]; break;
      case "plane":
        if (typeof b["plane"] === "string" && typeof b["url"] === "string") {
          // A pinned plane takes its FIRST pin only: no code path re-pins a plane after the founding mints it (a rotation carries the pins forward),
          // so a later root-signed act over a pinned plane to another url reads as no act and surfaces by name.
          if (!(b["plane"] in planes) && !foundingClosed) planes[b["plane"]] = b["url"];
          else if (planes[b["plane"]] !== b["url"]) planeRewrites.push({ plane: b["plane"], cid });
        }
        break;
    }
  }
  const last = fold.chain[fold.chain.length - 1];
  return {
    founded: fold.chain.length > 0, personaKelPrefix, rootCommitment, planes, planeRewrites, devices: [...devices].sort(), vesselTags: [...tagsStanding], admissions, admissionRefusals, edges,
    fork: fold.fork, head: last ? { seq: last.act.body.seq, cid: last.cid } : null, cids: fold.chain.map((e) => e.cid),
  };
}

/** The planes a vessel may REGISTER: a bootstrap's plane URL registers only where a verified `plane` act put the
 *  same URL there. A URL with no signed act behind it never registers. */
export function registerablePlanes(bootstrap: Readonly<Record<string, string>>, projection: PersonaProjection): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, url] of Object.entries(bootstrap)) if (projection.planes[name] === url) out[name] = url;
  return out;
}

export type { SignedAct };
