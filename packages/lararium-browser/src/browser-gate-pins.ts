/**
 * browser-gate-pins — the browser vessel's pair index of gate pins and its dial clock.
 *
 * A dial reaches only the gate it pinned. This vessel makes ONE `hearthPinIndex` at boot and hands it to the relay
 * dial and to the flow reader; no module holds a second. The index holds what a full `GateBundlePin` carrier hands
 * it: the sovereign pin and floor pins a joined face's fleet join carried inside the root's signature, and the flow's
 * floor pin CLAIM a floor card carries by hand against an anchor conveyed apart from it. A HEX64 key stands for no pin.
 *
 * NAMED: `hearthNameOf` files a hearth by its URL's origin (the page is handed no other true name for it). What the
 * vessel presents at a gate composes in `browser-face-presentation`; this file reads no custody.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-gate-pins
 */
import { fileHearthFloorCard, hearthPinIndex, readHearthFloorPins, type FloorAnchor, type FloorCardFiling, type GateBundlePin, type HearthFloorCard, type HearthPinIndex, type LarWSClientOptions } from "@lararium/mesh";

export type BrowserFacePresentation = LarWSClientOptions["presentation"];

/** The vessel's pair index: one per boot. */
export function browserGatePins(): HearthPinIndex {
  return hearthPinIndex();
}

/** The hearth's name as the pair index files it, off the URL it dials. */
export function hearthNameOf(url: string): string {
  try { return new URL(url).origin; } catch { return url.replace(/[\r\n]/g, ""); }
}

/**
 * File the page's OWN hearth's pins, as the root-signed fleet-join answer carried them, under the relay's name: the
 * sovereign pin the relay dial knocks with, and the floor pins at that pin's Nexus (house ruling "The admit's gate pin", carrier
 * (b)), so the flow read at this hearth holds its pin before any crossing. A floor set that fails its read (another
 * Nexus, a non-floor tier, a route twice) files none of it; without a relay or a sovereign pin nothing files. Returns
 * how many the index took.
 */
export function fileOwnHearthPins(
  index: HearthPinIndex,
  relayUrl: string | null | undefined,
  carried: { readonly hearthGatePin?: GateBundlePin | null; readonly hearthFloorPins?: readonly GateBundlePin[] | null },
): number {
  const sovereign = carried.hearthGatePin ?? null;
  if (!relayUrl || sovereign === null) return 0;
  const hearth = hearthNameOf(relayUrl);
  let taken = index.put(hearth, sovereign) ? 1 : 0;
  const floor = carried.hearthFloorPins ? readHearthFloorPins(carried.hearthFloorPins, sovereign.nexus) : null;
  for (const pin of floor ?? []) if (index.put(hearth, pin)) taken += 1;
  return taken;
}

/**
 * The Nexus an flow read at `baseUrl` dials under: the relay's own Nexus where `baseUrl` names the relay's hearth, and
 * none (null) for any other hearth. The page knows one hearth's Nexus; a read elsewhere never borrows it.
 */
export function flowNexusFor(baseUrl: string, relay: { readonly relayUrl: string | null | undefined; readonly nexus: string | null | undefined }): string | null {
  if (!relay.relayUrl || !relay.nexus) return null;
  const place = (url: string): string | null => {
    try {
      const u = new URL(url);
      const secure = u.protocol === "https:" || u.protocol === "wss:";
      if (!secure && u.protocol !== "http:" && u.protocol !== "ws:") return null;
      return `${secure ? "s" : ""}//${u.host}`;      // one hearth answers http(s) and ws(s) on one host
    } catch { return null; }
  };
  const here = place(baseUrl);
  return here !== null && here === place(relay.relayUrl) ? relay.nexus : null;
}

/** A dial's deadline source over the page's timer: `lapse` runs once after `ms`, unless cancelled. */
export function dialDeadlines(ms = 15_000): { draw(lapse: () => void): { cancel(): void } } {
  return {
    draw(lapse) {
      const timer = setTimeout(lapse, ms);
      return { cancel: () => clearTimeout(timer) };
    },
  };
}

/**
 * File the flow's floor pin CLAIM a floor card carried, under the relay's name, against the anchor conveyed apart from the card
 * (`fileHearthFloorCard`): the floor tier on the flow route alone, so it seats no face. The card verifies whole before it files:
 * an unanchored card, a forged claim, a head its rows cannot fold and another place's claim each refuse by name. KEL descent
 * orders it against what the index holds: a descendant replaces, a card at a known older head refuses `rollback` and the newer
 * head keeps serving, and a fork holds the last accepted pin. Without a relay nothing files.
 */
export function fileFloorCard(index: HearthPinIndex, relayUrl: string | null | undefined, card: HearthFloorCard | null, anchor: FloorAnchor | null | undefined): FloorCardFiling {
  if (!relayUrl) return { filed: false, refusal: "index-refused" };
  return fileHearthFloorCard(index, hearthNameOf(relayUrl), card, anchor);
}
