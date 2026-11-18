import type { BrowserConnectionSnapshot, BrowserConnectionState } from "@lararium/browser/page";
import type { FloorAnchor, HearthFloorCard } from "@lararium/mesh";
import { ARRIVAL_FORMAT } from "@lararium/mesh/wire-names";

export interface ServedLocation {
  readonly origin: string;
  readonly protocol: string;
  readonly host: string;
}

/** The read face a served page reads by default: the origin that served it. */
export function defaultReadFace(location: Pick<ServedLocation, "origin">): string {
  return location.origin;
}

export function sameOriginRelayUrl(location: Pick<ServedLocation, "protocol" | "host">): string {
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location.host}/ws`;
}

/**
 * The relay a page dials: the one its own origin answers with, where that origin stands as a lararium's Pronaos. No URL names a relay.
 *
 * The proof stands on a capability, never a host: the same-origin arrival descriptor (`/.well-known/lar`)
 * answers JSON whose `format` reads `lar-arrival`. A Vite dev server answers every unknown path with its
 * index.html at 200, so the status proves nothing and the format decides; a file page has no origin to ask.
 * Every miss reads undefined, the pure local boot. No timer decides: the origin answers or fails on its own.
 *
 * `bootLocal` is the person's own word: a promise a "boot local" button resolves. It races the probe, and its press
 * aborts the fetch and reads undefined, so a probe that never answers never holds the boot.
 */
export const ARRIVAL_DESCRIPTOR_PATH = "/.well-known/lar";
export async function arrivalRelayUrl(
  location: Pick<ServedLocation, "origin" | "protocol" | "host">,
  fetchFn: (input: string, init?: { readonly signal: AbortSignal }) => Promise<Response>,
  bootLocal?: Promise<void>,
): Promise<string | undefined> {
  if (location.protocol !== "http:" && location.protocol !== "https:") return undefined;
  const abort = new AbortController();
  const probe = async (): Promise<string | undefined> => {
    try {
      const response = await fetchFn(`${location.origin}${ARRIVAL_DESCRIPTOR_PATH}`, { signal: abort.signal });
      if (!response.ok) return undefined;
      const body: unknown = JSON.parse(await response.text());
      return (body as { format?: unknown } | null)?.format === ARRIVAL_FORMAT ? sameOriginRelayUrl(location) : undefined;
    } catch {
      return undefined;
    }
  };
  if (bootLocal === undefined) return probe();
  const pressed = bootLocal.then((): undefined => { abort.abort(); return undefined; });
  return Promise.race([probe(), pressed]);
}

/**
 * WHAT THE FLOOR'S CARRIAGE DOOR TAKES (paste, file or QR; never a URL): the hearth's floor card as its carried file
 * (the mesh's `floorCardCarriageText`, read by its `readFloorCardCarriage`: the place's signed floor pin claim for the flow route and the KEL rows that fold to its head, read by
 * the mesh's one reader), or the place AID alone (W14 first contact: a deliberate person-to-person transfer, conveyed APART from
 * the card). A torn card reads as a card that does not read; any other text reads as nothing. The card never anchors itself: a
 * card file that carries a second key refuses whole, so no anchor rides beside it.
 */
export type FloorCarriage =
  | { readonly kind: "card"; readonly text: string; readonly card: HearthFloorCard | null }
  | { readonly kind: "anchor"; readonly aid: string };
export function readFloorCarriage(
  text: string,
  read: { readonly file: (text: string) => string | null; readonly card: (text: string) => HearthFloorCard | null },
): FloorCarriage | null {
  const carried = text.trim();
  if (/^[0-9a-f]{64}$/.test(carried)) return { kind: "anchor", aid: carried };
  const card = read.file(carried);
  return card === null ? null : { kind: "card", text: card, card: read.card(card) };
}

/**
 * What this origin KEPT from the carriage door (and, for the anchor, from an authenticated admit): the card through the one reader,
 * and the anchor where its AID reads. Each stands alone; the card adds no weight toward the anchor.
 */
export function keptFloorOf(
  kept: { readonly card: string | null; readonly anchor: { readonly aid: string; readonly via: "admit" | "transfer" | "genesis" } | null },
  read: (text: string) => HearthFloorCard | null,
): { readonly floor: { readonly text: string; readonly card: HearthFloorCard | null } | null; readonly anchor: FloorAnchor | null } {
  return {
    floor: kept.card ? { text: kept.card, card: read(kept.card) } : null,
    anchor: kept.anchor && /^[0-9a-f]{64}$/.test(kept.anchor.aid) ? { aid: kept.anchor.aid, via: kept.anchor.via } : null,
  };
}

export interface ConnectionPresentation {
  readonly connection: string;
  readonly mode: string;
  readonly tone: "ok" | "warn" | "err" | "veil";
}

export function connectionPresentation(snapshot: BrowserConnectionSnapshot, authenticatedBefore = false): ConnectionPresentation {
  switch (snapshot.status) {
    case "local":
      return { connection: "local only — no node pin", mode: "browser vessel · local wiki", tone: "veil" };
    case "floor":
      return { connection: `at the floor — ${snapshot.reason}`, mode: "browser vessel · standing at the floor · no face", tone: "veil" };
    case "missing-pin":
      return { connection: `not attached — ${snapshot.reason}`, mode: "crossing idle · no gate pin", tone: "warn" };
    case "blocked":
      return {
        connection: `blocked — ${snapshot.reason}`,
        mode: `crossing to ${snapshot.gatePubKey} is blocked`,
        tone: "warn",
      };
    case "pinned":
      return { connection: "gate pinned", mode: `crossing pinned to ${snapshot.gatePubKey}`, tone: "warn" };
    case "connecting":
      return { connection: "authenticating", mode: `crossing to ${snapshot.gatePubKey}`, tone: "warn" };
    case "refused":
      return { connection: `refused — ${snapshot.reason}`, mode: `crossing refused by ${snapshot.gatePubKey}`, tone: "err" };
    case "connected":
      return { connection: `connected — gate ${snapshot.peer.gatePubKey}`, mode: `attached to ${snapshot.peer.gatePubKey}`, tone: "ok" };
    case "disconnected":
      if (!authenticatedBefore) {
        return {
          connection: `no sovereign gate answered — ${snapshot.gatePubKey}: the hearth rests at its floor until a person unlocks it, or stands out of reach`,
          mode: `local path to ${snapshot.gatePubKey} did not reach a gate`,
          tone: "warn",
        };
      }
      return { connection: `disconnected from ${snapshot.gatePubKey}`, mode: `node ${snapshot.gatePubKey} disconnected`, tone: "warn" };
  }
}

/**
 * What the connection row publishes as data, for a reader that must not parse prose:
 *   data-standing      the crossing's standing, one word (`local`, `floor`, `missing-pin`, `blocked`, `pinned`,
 *                      `connecting`, `refused`, `connected`, `disconnected`)
 *   data-gate-key      the gate key the relay PROVED on this session; absent in every other state
 *   data-wiki-doc-url  the document the vessel mounted as its wiki; absent until a mount stands
 */
export function connectionData(snapshot: BrowserConnectionSnapshot): { readonly gateKey: string | null; readonly wikiDocUrl: string | null } {
  return {
    gateKey: snapshot.status === "connected" ? snapshot.peer.gatePubKey : null,
    wikiDocUrl: snapshot.wikiDocUrl ?? null,
  };
}

function setOrRemove(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** Paint the vessel's replica of its current relay state; this reports the adapter's causal edges. */
export function mountLiveStatus(parent: HTMLElement, state: Pick<BrowserConnectionState, "getSnapshot" | "subscribe">): () => void {
  const connectionRow = makeRow(parent, "crossing", "connection");
  const modeRow = makeRow(parent, "mode", "mode");
  let authenticatedBefore = false;
  const paint = (snapshot: BrowserConnectionSnapshot): void => {
    if (snapshot.status === "connected") authenticatedBefore = true;
    const presentation = connectionPresentation(snapshot, authenticatedBefore);
    connectionRow.value.textContent = presentation.connection;
    connectionRow.value.className = `v ${presentation.tone}`;
    const data = connectionData(snapshot);
    connectionRow.value.setAttribute("data-standing", snapshot.status);
    setOrRemove(connectionRow.value, "data-gate-key", data.gateKey);
    setOrRemove(connectionRow.value, "data-wiki-doc-url", data.wikiDocUrl);
    modeRow.value.textContent = presentation.mode;
    modeRow.value.className = `v ${presentation.tone}`;
  };
  paint(state.getSnapshot());
  return state.subscribe(paint);
}

function makeRow(parent: HTMLElement, label: string, id: string): { value: HTMLElement } {
  const line = document.createElement("div");
  line.className = "row";
  const key = document.createElement("span");
  key.className = "k";
  key.textContent = label;
  const value = document.createElement("span");
  value.className = "v";
  value.dataset["liveStatus"] = id;
  line.append(key, value);
  parent.append(line);
  return { value };
}
