/**
 * plugin-offering Crossroads announce — a public, additive projection of immutable signed gifts.
 *
 * The offering's own signature and content CID carry authority and integrity. This board record carries
 * the complete signed offering under its CID, so a peer can reannounce the exact bytes without a second
 * signing domain or a registry. Writes stay open; readers shape-filter first and then call the certified
 * consumer, which verifies the signature and recomputes the plugin region.
 */
import { PLUGIN_OFFERING_ANNOUNCE_DOMAIN, PLUGIN_OFFERING_DOMAIN } from "./domains.js";
import {
  pluginOfferingCid,
  verifyPluginOffering,
  type PluginOffering,
  type OfferingVerdict,
} from "./plugin-offering.js";
import { mutableLarRecord, type LarDoc } from "./base-doc.js";

/** The public Crossroads namespace for immutable offering records. */
export const PLUGIN_OFFERING_ANNOUNCE_PREFIX = "lar:///ha.ka.ba/dreamnet/plugin-offering-announces/" as const;

/** A board projection. The nested record remains the signed, content-addressed authority. */
export interface PluginOfferingAnnounce {
  readonly kind: typeof PLUGIN_OFFERING_ANNOUNCE_DOMAIN;
  readonly offeringCid: string;
  readonly offering: PluginOffering;
}

/** Key one announcement by its complete signed-record CID; same-region offerors therefore never collide. */
export function offeringAnnounceKey(offeringCid: string): string {
  return `${PLUGIN_OFFERING_ANNOUNCE_PREFIX}${encodeURIComponent(offeringCid)}`;
}

/** Build the exact public projection for one signed offering. */
export function pluginOfferingAnnounceOf(offering: PluginOffering): PluginOfferingAnnounce {
  return {
    kind: PLUGIN_OFFERING_ANNOUNCE_DOMAIN,
    offeringCid: pluginOfferingCid(offering),
    offering,
  };
}

/** Land an announcement on a LarDoc draft. Call inside the caller's `handle.change()` callback. */
export function writeOfferingAnnounce(draft: LarDoc, offering: PluginOffering): void {
  const announce = pluginOfferingAnnounceOf(offering);
  const key = offeringAnnounceKey(announce.offeringCid);
  draft.tiddlers[key] = mutableLarRecord(key, { text: JSON.stringify(announce) }, "plugin-offering");
}

function shapeOfferingAnnounce(value: unknown): PluginOfferingAnnounce | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.kind !== PLUGIN_OFFERING_ANNOUNCE_DOMAIN) return null;
  if (typeof raw.offeringCid !== "string" || raw.offeringCid.length === 0) return null;
  if (typeof raw.offering !== "object" || raw.offering === null) return null;
  const offering = raw.offering as Record<string, unknown>;
  if (offering.kind !== PLUGIN_OFFERING_DOMAIN) return null;
  if (typeof offering.offeror !== "string" || typeof offering.pluginsCid !== "string") return null;
  if (
    !Array.isArray(offering.blobs) ||
    offering.blobs.some((b) => typeof b !== "object" || b === null ||
      typeof (b as Record<string, unknown>).id !== "string" ||
      typeof (b as Record<string, unknown>).version !== "string" ||
      typeof (b as Record<string, unknown>).sha256 !== "string") ||
    typeof offering.sig !== "string"
  ) return null;
  return {
    kind: PLUGIN_OFFERING_ANNOUNCE_DOMAIN,
    offeringCid: raw.offeringCid,
    offering: raw.offering as PluginOffering,
  };
}

/** Read hostile board storage without delegating malformed `tiddler` shapes to the shared accessor. */
function safeTiddlerText(record: unknown): string | null {
  if (typeof record !== "object" || record === null) return null;
  const tiddler = (record as { tiddler?: unknown }).tiddler;
  if (typeof tiddler !== "object" || tiddler === null) return null;
  const text = (tiddler as { text?: unknown }).text;
  return typeof text === "string" ? text : null;
}

/** Shape-filter the board. This function certifies no signature and preserves no ordering claim. */
export function offeringAnnouncesFromDoc(doc: LarDoc | undefined | null): PluginOfferingAnnounce[] {
  const tiddlers = doc?.tiddlers;
  if (!tiddlers) return [];
  const out: PluginOfferingAnnounce[] = [];
  const seen = new Set<string>();
  for (const [title, record] of Object.entries(tiddlers)) {
    if (!title.startsWith(PLUGIN_OFFERING_ANNOUNCE_PREFIX)) continue;
    const text = safeTiddlerText(record);
    if (text === null) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    const announce = shapeOfferingAnnounce(parsed);
    if (announce === null || title !== offeringAnnounceKey(announce.offeringCid)) continue;
    if (seen.has(announce.offeringCid)) continue;
    seen.add(announce.offeringCid);
    out.push(announce);
  }
  return out;
}

/** Verify one board projection, including the CID, signature, and recomputed plugin region. */
export async function verifyOfferingAnnounce(announce: PluginOfferingAnnounce): Promise<OfferingVerdict> {
  if (announce?.kind !== PLUGIN_OFFERING_ANNOUNCE_DOMAIN) return { ok: false, reason: "not an offering announce" };
  try {
    if (pluginOfferingCid(announce.offering) !== announce.offeringCid) {
      return { ok: false, reason: "the announcement CID does not match its signed offering" };
    }
    return verifyPluginOffering(announce.offering);
  } catch {
    return { ok: false, reason: "malformed offering announce" };
  }
}

/** Read and certify all well-shaped board records; invalid records disappear from the trusted projection. */
export async function verifiedPluginOfferingsFromDoc(doc: LarDoc | undefined | null): Promise<PluginOffering[]> {
  const out: PluginOffering[] = [];
  const seen = new Set<string>();
  for (const announce of offeringAnnouncesFromDoc(doc)) {
    if (!(await verifyOfferingAnnounce(announce)).ok || seen.has(announce.offeringCid)) continue;
    seen.add(announce.offeringCid);
    out.push(announce.offering);
  }
  return out;
}

/** Compatibility-shaped reader name for callers that want the wrapper plus its later verdict. */
export const readOfferingAnnounces = offeringAnnouncesFromDoc;
