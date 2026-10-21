/**
 * persona-act — the signed acts of a face's `@persona` plane, and the projection a reader builds from them.
 *
 * Founding and admission acts, device edges, lease advances and plane URLs travel as `signed-act` records in the
 * face's `@persona` plane. Sync carries them; THIS reader decides which count. Seq 0 must be the founding act,
 * no later act may found again, and a lease advance counts only as a rise. The caller's `authorize` carries the
 * anchor's and the KEL's word on who may sign which act (the founding by the persona root's op-key; an admission
 * by the root or by an admitted atom). Everything the face planes hold downstream reads as this projection:
 * disposable, rebuilt, never the authority.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/identity-invariants-2026
 */

import { PERSONA_ACT_DOMAIN } from "./domains.js";
import { rosterAt, type HandLineage } from "./hand-lineage.js";
import { foldActs, type ActBody, type ActFold, type SignedAct } from "./signed-act.js";

export type PersonaActKind = "founding" | "admission" | "device-edge" | "lease-advance" | "plane";

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
  /** plane name -> the URL a verified act put there (the last verified `plane` act wins within ONE log; a fork stops the log). */
  readonly planes: Readonly<Record<string, string>>;
  /** device keys a verified admission act seated. */
  readonly devices: readonly string[];
  /** device key -> edge digest, from verified device-edge acts. */
  readonly edges: Readonly<Record<string, string>>;
  /** the highest lease epoch a verified lease-advance act carries. */
  readonly leaseEpoch: number;
  /** a fork the fold stopped at, else null. */
  readonly fork: ActFold["fork"];
  /** the verified head, for the anchor's frontier. */
  readonly head: { readonly seq: number; readonly cid: string } | null;
}

/** The act-specific word on who may sign it (an admission by the root or by an admitted atom, say). The signer's
 *  place in the root's roster at the act's OWN epoch is checked by the projection itself. */
export type PersonaAuthorize = (signer: string, body: PersonaActBody) => boolean;

/** Fold a carried set of `@persona` records into the verified projection. */
export function projectPersonaLog(records: readonly unknown[], opts: { readonly group: string; readonly lineage: HandLineage; readonly authorize: PersonaAuthorize }): PersonaProjection {
  const fold = foldActs(records, {
    domain: PERSONA_ACT_DOMAIN, group: opts.group,
    authorize: (signer, body) => {
      const b = body as PersonaActBody;
      if ((body.seq === 0) !== (b.act === "founding")) return false;   // the founding stands at seq 0 and nowhere else
      const roster = rosterAt(opts.lineage, b.epoch);
      if (!roster || !roster.signers.includes(signer)) return false;   // a link verifies under its own epoch's keys
      return opts.authorize(signer, b);
    },
    link: (body, prior) => prior === null || (body as PersonaActBody).epoch >= (prior as PersonaActBody).epoch,
  });
  let personaKelPrefix: string | null = null, rootCommitment: string | null = null, leaseEpoch = 0;
  const planes: Record<string, string> = {}, edges: Record<string, string> = {};
  const devices = new Set<string>();
  for (const { act } of fold.chain) {
    const b = act.body as PersonaActBody & Record<string, unknown>;
    switch (b.act) {
      case "founding":
        if (typeof b["personaKelPrefix"] === "string") personaKelPrefix = b["personaKelPrefix"];
        if (typeof b["rootCommitment"] === "string") rootCommitment = b["rootCommitment"];
        break;
      case "admission": if (typeof b["deviceKey"] === "string") devices.add(b["deviceKey"]); break;
      case "device-edge": if (typeof b["deviceKey"] === "string" && typeof b["edgeDigest"] === "string") edges[b["deviceKey"]] = b["edgeDigest"]; break;
      case "lease-advance": if (Number.isSafeInteger(b["leaseEpoch"])) leaseEpoch = Math.max(leaseEpoch, b["leaseEpoch"] as number); break;
      case "plane": if (typeof b["plane"] === "string" && typeof b["url"] === "string") planes[b["plane"]] = b["url"]; break;
    }
  }
  const last = fold.chain[fold.chain.length - 1];
  return {
    founded: fold.chain.length > 0, personaKelPrefix, rootCommitment, planes, devices: [...devices].sort(), edges, leaseEpoch,
    fork: fold.fork, head: last ? { seq: last.act.body.seq, cid: last.cid } : null,
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
