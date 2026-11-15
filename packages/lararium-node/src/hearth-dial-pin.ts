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
 * THE ISLAND RESTS APART FROM THE DIAL. The admit also names the island its hearth resolved (the gate key, kind, scope), and
 * the landing seats the joinee's persona-KEL chain on that island's board. Those rows pack whether or not the answer named a
 * sync url, and the boot's island reads them through `readHearthIslandPin`; `readHearthDialPin` still answers a dial only
 * where a sync url and a gate key both rest.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/hearth-dial-pin
 */

import { readFileSync } from "node:fs";
import { DAEMON_BAG_ID, readAdmitGatePin, type GateBundlePin, ownEntry } from "@lararium/mesh";

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

/**
 * The bootstrap tiddlers an admission packs. TWO HALVES, EACH PACKED ON ITS OWN GROUNDS:
 *
 *   · THE ISLAND (the gate key, and the founder's resolved kind + scope) packs whenever the payload carried it. The landing
 *     seats the joinee's persona-KEL chain on `admittedJoineeIsland(payload)`, and every later boot resolves its island off
 *     these rows (`readHearthIslandPin`), so they rest whether or not the answer named a sync url: a restart reads
 *     the board the landing seeded.
 *   · THE DIAL (the sync url, the full pin, the doc url) packs only where the payload named a sync url and a gate key.
 *
 * An admit that carried no resolved kind/scope packs none (the anchor-by-gate-key reading stands), and a payload naming
 * neither a gate nor an island packs nothing at all.
 */
export function hearthDialTiddlers(
  syncUrl: string | null | undefined,
  gatePubKey: string | null | undefined,
  island?: { readonly kind?: string | null | undefined; readonly scope?: string | null | undefined } | null,
  gatePin?: GateBundlePin | null,
  docUrl?: string | null,
): Record<string, { title: string; text: string; kind: string }> {
  const row = (title: string, text: string) => ({ [title]: { title, text, kind: "hearth-door" } });
  return {
    ...(syncUrl && gatePubKey ? {
      ...(gatePin ? row(HEARTH_GATE_PIN_TIDDLER, JSON.stringify(gatePin)) : {}),
      ...(docUrl ? row(HEARTH_DOC_URL_TIDDLER, docUrl) : {}),
      ...row(HEARTH_SYNC_URL_TIDDLER, syncUrl),
    } : {}),
    ...(gatePubKey ? row(HEARTH_GATE_KEY_TIDDLER, gatePubKey.toLowerCase()) : {}),
    ...(island?.kind && island?.scope ? { ...row(HEARTH_ISLAND_KIND_TIDDLER, island.kind), ...row(HEARTH_ISLAND_SCOPE_TIDDLER, island.scope) } : {}),
  };
}

/** The island half of an admission, as it rests: the hearth's gate key where the admit named one, and the resolved island. */
export interface HearthIslandPin {
  readonly gatePubKey: string | null;
  readonly islandKind?:  "own" | "anchor" | "charter" | "explicit";
  readonly islandScope?: string;
}

type PackedTiddlers = Record<string, { text?: unknown }> | undefined;
const packedOf = (bootstrapPath: string): PackedTiddlers => {
  const plugin = JSON.parse(readFileSync(bootstrapPath, "utf8")) as { text?: string };
  return (JSON.parse(plugin.text ?? "{}") as { tiddlers?: Record<string, { text?: unknown }> }).tiddlers;
};

/** The island half off packed tiddlers: `undefined` where a row reads torn (one island half, a malformed key), `null` where none rests. */
function islandOf(tiddlers: PackedTiddlers): HearthIslandPin | null | undefined {
  const gate = ownEntry(tiddlers, HEARTH_GATE_KEY_TIDDLER)?.text;
  if (gate !== undefined && (typeof gate !== "string" || !KEY_RE.test(gate.trim().toLowerCase()))) return undefined;
  const kindRaw  = ownEntry(tiddlers, HEARTH_ISLAND_KIND_TIDDLER)?.text;
  const scopeRaw = ownEntry(tiddlers, HEARTH_ISLAND_SCOPE_TIDDLER)?.text;
  const islandPresent = kindRaw !== undefined || scopeRaw !== undefined;
  if (islandPresent && (typeof kindRaw !== "string" || !KIND_RE.test(kindRaw) ||
      typeof scopeRaw !== "string" || scopeRaw.trim().length === 0)) {
    return undefined;   // a torn island half refuses, never a silent partial read
  }
  if (gate === undefined && !islandPresent) return null;
  return {
    gatePubKey: typeof gate === "string" ? gate.trim().toLowerCase() : null,
    ...(islandPresent ? { islandKind: kindRaw as "own" | "anchor" | "charter" | "explicit", islandScope: (scopeRaw as string).trim() } : {}),
  };
}

/**
 * THE ISLAND THE ADMIT RESOLVED, read off a bootstrap file with or without a dial beside it: what `nodeNexusStandsAt`
 * resolves every boot's island from. Null when the vessel holds none (it founded its own face) and on any tear, which
 * leaves the boot on its own key, where the Binding Gate refuses a chain it cannot reach (fail-closed).
 */
export function readHearthIslandPin(bootstrapPath: string): HearthIslandPin | null {
  try { return islandOf(packedOf(bootstrapPath)) ?? null; } catch { return null; }
}

/** Read the pin off a bootstrap file — null when the vessel holds none (fail-closed on any tear).
 *  FAIL-CLOSED ON THE ISLAND HALF TOO: if either island tiddler is present, BOTH must read valid or the
 *  WHOLE pin refuses (returns null) — exactly the same policy already held for the sync/gate pair. A
 *  torn island half never silently degrades to "no island carried" (which would read as an older,
 *  harmless payload); it degrades to "no dial at all", the honest refusal. */
export function readHearthDialPin(bootstrapPath: string): HearthDialPin | null {
  try {
    const packed = { tiddlers: packedOf(bootstrapPath) };
    const syncUrl = ownEntry(packed.tiddlers, HEARTH_SYNC_URL_TIDDLER)?.text;
    // The island half reads through the one reader (`islandOf`): a torn half or a malformed key refuses the whole dial.
    const islandPin = islandOf(packed.tiddlers);
    if (typeof syncUrl !== "string" || !islandPin || islandPin.gatePubKey === null) return null;
    const gatePubKey = islandPin.gatePubKey;
    if (!/^wss?:\/\//.test(syncUrl.trim())) return null;
    const island = islandPin.islandKind !== undefined && islandPin.islandScope !== undefined
      ? { islandKind: islandPin.islandKind, islandScope: islandPin.islandScope }
      : null;

    // The full pin, when the bootstrap holds one, reads as an ADMIT's pin (`readAdmitGatePin`): the sovereign tier, the
    // sovereign sync route, and the Nexus where the bootstrap names it (a charter island's scope is its genesis, the
    // Nexus its hearth's gate stands at). It must be the pin of the carried key. A torn, foreign or misplaced pin
    // refuses the whole dial, never a silent fall back to the key alone.
    const pinRaw = ownEntry(packed.tiddlers, HEARTH_GATE_PIN_TIDDLER)?.text;
    let gatePin: GateBundlePin | undefined;
    if (pinRaw !== undefined) {
      if (typeof pinRaw !== "string") return null;
      const nexus = island?.islandKind === "charter" ? island.islandScope : undefined;
      const reading = readAdmitGatePin(JSON.parse(pinRaw), nexus !== undefined ? { nexus } : {});
      if (!("pin" in reading) || reading.pin.signingKey !== gatePubKey) return null;
      gatePin = reading.pin;
    }
    // The doc url, when the bootstrap holds one, is an `automerge:` url; a torn one refuses the whole dial.
    const docRaw = ownEntry(packed.tiddlers, HEARTH_DOC_URL_TIDDLER)?.text;
    if (docRaw !== undefined && (typeof docRaw !== "string" || !/^automerge:[1-9A-HJ-NP-Za-km-z]+$/.test(docRaw.trim()))) return null;
    const docUrl = typeof docRaw === "string" ? docRaw.trim() : undefined;
    return { syncUrl: syncUrl.trim(), gatePubKey, ...(gatePin ? { gatePin } : {}), ...(island ?? {}), ...(docUrl ? { docUrl } : {}) };
  } catch { return null; }
}
