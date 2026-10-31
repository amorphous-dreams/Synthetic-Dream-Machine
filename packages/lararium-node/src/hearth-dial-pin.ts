/**
 * hearth-dial-pin — THE PIN NAMES THE DIAL.
 *
 * A joinee founded by a fleet-join landing (`lares fleet join land`) boots for years after it spent its answer,
 * and the one address it cannot derive from anything it holds is where its hearth LISTENS: the `ws://` sync
 * url the hearth's `fleet join answer --sync-url` named, and the hearth's gate key — the anti-relay binding the
 * gate proof commits to, known out-of-band (the root-signed answer carries both; a key read off the wire would
 * bind the proof to whoever answered). `HEARTH_DAEMON_URL_TIDDLER` keeps the hearth's daemon DOC
 * url (an `automerge:` address) and dials nothing.
 *
 * So the two ride the bootstrap beside the sentinel ids, packed at admission (`hearthDialTiddlers`) and read
 * at boot (`readHearthDialPin`): the hearth the dial names (an explicit option outranks it). Beside them rides the
 * document the admit named for the dial to ask for (`fleet join answer --doc-url`), at open and on each return.
 * Absent on a vessel that founded its own face — such a vessel IS the hearth. FAIL CLOSED: a torn pin (one
 * half), a malformed key, an unreadable bootstrap → no pin → no dial (byte-identical to a vessel never admitted).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/hearth-dial-pin
 */

import { readFileSync } from "node:fs";
import { DAEMON_BAG_ID, readAdmitGatePin, type GateBundlePin } from "@lararium/mesh";

/** The hearth's `ws://…/ws` relay — where this joinee dials. */
export const HEARTH_SYNC_URL_TIDDLER = `${DAEMON_BAG_ID}/hearth/sync-url`;
/** The hearth's gate verifying-key hex: the signing key of the pin below, kept as the one key the anchor and the hosting address read. */
export const HEARTH_GATE_KEY_TIDDLER = `${DAEMON_BAG_ID}/hearth/gate-key`;
/** The hearth's FULL sovereign sync pin (JSON): what the joinee files in its pair index and knocks with. Its signing key IS the gate key above. */
export const HEARTH_GATE_PIN_TIDDLER = `${DAEMON_BAG_ID}/hearth/gate-pin`;
/** The document the dial asks the hearth for (an `automerge:` url), as the admit named it. */
export const HEARTH_DOC_URL_TIDDLER = `${DAEMON_BAG_ID}/hearth/doc-url`;
/** The founder's RESOLVED NexusIdentity kind at admit time — a SNAPSHOT, never re-resolved live. */
export const HEARTH_ISLAND_KIND_TIDDLER  = `${DAEMON_BAG_ID}/hearth/island-kind`;
/** The scope that kind names — the genesis epoch string for `charter`, else the founder's own key. */
export const HEARTH_ISLAND_SCOPE_TIDDLER = `${DAEMON_BAG_ID}/hearth/island-scope`;

const KEY_RE  = /^[0-9a-f]{64}$/;
const KIND_RE = /^(own|anchor|charter|explicit)$/;

export interface HearthDialPin {
  readonly syncUrl:    string;
  readonly gatePubKey: string;
  /** The full pin the admit carried, when it carried one; its `signingKey` is `gatePubKey`. */
  readonly gatePin?: GateBundlePin;
  /** The founder's resolved island kind/scope at admit time, when the admit carried one. Absent on an
   *  older payload — a reader without it falls back to anchor-by-gate-key, unchanged from before this
   *  pin existed. */
  readonly islandKind?:  "own" | "anchor" | "charter" | "explicit";
  readonly islandScope?: string;
  /** The document the admit named for the dial to ask for, when it named one. */
  readonly docUrl?: string;
}

/** The bootstrap tiddlers an admission packs — empty when the payload named no dial. The island half is
 *  OPTIONAL: an admit that carried no resolved kind/scope (an older payload) packs the sync/gate pair
 *  alone, byte-identical to before this pin existed. */
export function hearthDialTiddlers(
  syncUrl: string | null | undefined,
  gatePubKey: string | null | undefined,
  island?: { readonly kind?: string | null | undefined; readonly scope?: string | null | undefined } | null,
  gatePin?: GateBundlePin | null,
  docUrl?: string | null,
): Record<string, { title: string; text: string; kind: string }> {
  if (!syncUrl || !gatePubKey) return {};
  const base = {
    ...(gatePin ? { [HEARTH_GATE_PIN_TIDDLER]: { title: HEARTH_GATE_PIN_TIDDLER, text: JSON.stringify(gatePin), kind: "hearth-door" } } : {}),
    ...(docUrl ? { [HEARTH_DOC_URL_TIDDLER]: { title: HEARTH_DOC_URL_TIDDLER, text: docUrl, kind: "hearth-door" } } : {}),
    [HEARTH_SYNC_URL_TIDDLER]: { title: HEARTH_SYNC_URL_TIDDLER, text: syncUrl, kind: "hearth-door" },
    [HEARTH_GATE_KEY_TIDDLER]: { title: HEARTH_GATE_KEY_TIDDLER, text: gatePubKey.toLowerCase(), kind: "hearth-door" },
  };
  if (!island?.kind || !island?.scope) return base;
  return {
    ...base,
    [HEARTH_ISLAND_KIND_TIDDLER]:  { title: HEARTH_ISLAND_KIND_TIDDLER,  text: island.kind,  kind: "hearth-door" },
    [HEARTH_ISLAND_SCOPE_TIDDLER]: { title: HEARTH_ISLAND_SCOPE_TIDDLER, text: island.scope, kind: "hearth-door" },
  };
}

/** Read the pin off a bootstrap file — null when the vessel holds none (fail-closed on any tear).
 *  FAIL-CLOSED ON THE ISLAND HALF TOO: if either island tiddler is present, BOTH must read valid or the
 *  WHOLE pin refuses (returns null) — exactly the same policy already held for the sync/gate pair. A
 *  torn island half never silently degrades to "no island carried" (which would read as an older,
 *  harmless payload); it degrades to "no dial at all", the honest refusal. */
export function readHearthDialPin(bootstrapPath: string): HearthDialPin | null {
  try {
    const plugin = JSON.parse(readFileSync(bootstrapPath, "utf8")) as { text?: string };
    const packed = JSON.parse(plugin.text ?? "{}") as { tiddlers?: Record<string, { text?: unknown }> };
    const syncUrl = packed.tiddlers?.[HEARTH_SYNC_URL_TIDDLER]?.text;
    const gate    = packed.tiddlers?.[HEARTH_GATE_KEY_TIDDLER]?.text;
    if (typeof syncUrl !== "string" || typeof gate !== "string") return null;
    const gatePubKey = gate.trim().toLowerCase();
    if (!/^wss?:\/\//.test(syncUrl.trim()) || !KEY_RE.test(gatePubKey)) return null;

    const kindRaw  = packed.tiddlers?.[HEARTH_ISLAND_KIND_TIDDLER]?.text;
    const scopeRaw = packed.tiddlers?.[HEARTH_ISLAND_SCOPE_TIDDLER]?.text;
    const islandPresent = kindRaw !== undefined || scopeRaw !== undefined;
    if (islandPresent && (typeof kindRaw !== "string" || !KIND_RE.test(kindRaw) ||
        typeof scopeRaw !== "string" || scopeRaw.trim().length === 0)) {
      return null;   // a torn island half — the whole pin refuses, never a silent partial read
    }
    const island = islandPresent
      ? { islandKind: kindRaw as "own" | "anchor" | "charter" | "explicit", islandScope: (scopeRaw as string).trim() }
      : null;

    // The full pin, when the bootstrap holds one, reads as an ADMIT's pin (`readAdmitGatePin`): the sovereign tier, the
    // sovereign sync route, and the Nexus where the bootstrap names it (a charter island's scope is its genesis, the
    // Nexus its hearth's gate stands at). It must be the pin of the carried key. A torn, foreign or misplaced pin
    // refuses the whole dial, never a silent fall back to the key alone.
    const pinRaw = packed.tiddlers?.[HEARTH_GATE_PIN_TIDDLER]?.text;
    let gatePin: GateBundlePin | undefined;
    if (pinRaw !== undefined) {
      if (typeof pinRaw !== "string") return null;
      const nexus = island?.islandKind === "charter" ? island.islandScope : undefined;
      const reading = readAdmitGatePin(JSON.parse(pinRaw), nexus !== undefined ? { nexus } : {});
      if (!("pin" in reading) || reading.pin.signingKey !== gatePubKey) return null;
      gatePin = reading.pin;
    }
    // The doc url, when the bootstrap holds one, is an `automerge:` url; a torn one refuses the whole dial.
    const docRaw = packed.tiddlers?.[HEARTH_DOC_URL_TIDDLER]?.text;
    if (docRaw !== undefined && (typeof docRaw !== "string" || !/^automerge:[1-9A-HJ-NP-Za-km-z]+$/.test(docRaw.trim()))) return null;
    const docUrl = typeof docRaw === "string" ? docRaw.trim() : undefined;
    return { syncUrl: syncUrl.trim(), gatePubKey, ...(gatePin ? { gatePin } : {}), ...(island ?? {}), ...(docUrl ? { docUrl } : {}) };
  } catch { return null; }
}
