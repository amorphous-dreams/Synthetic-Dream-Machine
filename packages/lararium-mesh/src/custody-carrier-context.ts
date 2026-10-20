/**
 * custody-carrier-context — the canonical bytes a custody seal authenticates beside its ciphertext.
 *
 * A carrier's class (D, F or S) names whose key opens it. The context binds a sealed row to the owner, the row
 * name, the row kind and the complete logical reference it rests under, so a ciphertext copied into another
 * face's slot, under another row name or as another kind fails to open. The caller supplies the expected
 * context from the authenticated row selector on open; a ciphertext never names its own face.
 *
 * Each field rides as a 4-byte big-endian length and then its UTF-8 bytes, in one fixed order, so no
 * boundary shifts between fields can spell the same bytes. The three class domains differ by name alone.
 *
 * The encoder seals nothing. `writeSealedCarrier` takes its bytes in a later step.
 */

import { CUSTODY_D_DOMAIN, CUSTODY_F_DOMAIN, CUSTODY_S_DOMAIN } from "./domains.js";

/** The custody class a context belongs to. */
export type CustodyContextClass = "D" | "F" | "S";

/** What a custody seal binds. */
export interface CarrierContextFields {
  /** One of the three class domains. */
  readonly domain: string;
  /** The vessel or store namespace the row rests in. */
  readonly store:  string;
  /** The canonical PersonaGroup id on D; the named node principal on S. */
  readonly owner:  string;
  /** The row's own name in the carrier table. */
  readonly row:    string;
  /** The row kind. */
  readonly kind:   string;
  /** The complete logical row reference. */
  readonly ref:    string;
}

const CLASS_OF_DOMAIN: ReadonlyMap<string, CustodyContextClass> = new Map([
  [CUSTODY_D_DOMAIN, "D"], [CUSTODY_F_DOMAIN, "F"], [CUSTODY_S_DOMAIN, "S"],
]);

const encoder = new TextEncoder();

/** The class a domain names, or null for a domain outside the three. */
export function custodyClassOfDomain(domain: string): CustodyContextClass | null {
  return CLASS_OF_DOMAIN.get(domain) ?? null;
}

/**
 * Encode one carrier context. Refuses a domain outside the three, an F context (F has no sealed-carrier writer),
 * and an empty field: an empty owner, store, row, kind or ref would let two different rows spell one context.
 */
export function encodeCarrierContext(fields: CarrierContextFields): Uint8Array {
  const cls = custodyClassOfDomain(fields.domain);
  if (cls === null) throw new Error("custody-carrier-context: the domain names no custody class");
  if (cls === "F") throw new Error("custody-carrier-context: an F row has no sealed-carrier writer, so no seal context");
  for (const name of ["store", "owner", "row", "kind", "ref"] as const) {
    if (typeof fields[name] !== "string" || fields[name].length === 0) {
      throw new Error(`custody-carrier-context: ${cls} context needs a non-empty ${name}`);
    }
  }
  const parts = [fields.domain, fields.store, fields.owner, fields.row, fields.kind, fields.ref].map((s) => encoder.encode(s));
  const out = new Uint8Array(parts.reduce((n, p) => n + 4 + p.length, 0));
  const view = new DataView(out.buffer);
  let at = 0;
  for (const p of parts) {
    view.setUint32(at, p.length, false);
    out.set(p, at + 4);
    at += 4 + p.length;
  }
  return out;
}
