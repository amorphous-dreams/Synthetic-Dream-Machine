import type { BrowserConnectionSnapshot, BrowserConnectionState } from "@lararium/browser";
import type { FloorAnchor, HearthFloorCard } from "@lararium/mesh";

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
 * The hearth's floor card the arrival URL carries in its fragment (`#floor=<card>`), which never reaches a server: the place's
 * signed floor pin claim for the flow route and the KEL rows that fold to its head, read by the mesh's one reader
 * (`readHearthFloorCard`). A torn card reads none. The card never anchors itself (`floorAnchorOf`).
 */
export function floorCardOf(
  hash: string,
  read: (text: string) => HearthFloorCard | null,
): { readonly text: string; readonly card: HearthFloorCard | null } | null {
  const text = new URLSearchParams(hash.replace(/^#/, "")).get("floor");
  return text ? { text, card: read(text) } : null;
}

/**
 * The place AID conveyed APART from the card (W14 first contact): a deliberate person-to-person transfer in the fragment
 * (`#anchor=<aid>`, the AID the hearth's banner prints on its own line), or the one this browser kept from an earlier transfer or
 * an authenticated admit (`kept`). The card in the same fragment carries no weight toward it. Only a 64-hex AID reads; else null.
 */
export function floorAnchorOf(hash: string, kept?: { readonly aid: string; readonly via: "admit" | "transfer" | "genesis" } | null): FloorAnchor | null {
  const carried = new URLSearchParams(hash.replace(/^#/, "")).get("anchor");
  if (carried !== null && /^[0-9a-f]{64}$/.test(carried)) return { aid: carried, via: "transfer" };
  return kept && /^[0-9a-f]{64}$/.test(kept.aid) ? { aid: kept.aid, via: kept.via } : null;
}

/** The relay a page dials: the `?relay=` its URL names (the hearth's banner prints it), or none for a pure local boot. */
export function resolveRelayUrl(params: URLSearchParams): string | undefined {
  return params.get("relay") || undefined;
}

/**
 * The line the web status owes when `?flow=` names a hearth other than the relay's: a read at another hearth
 * dials under no Nexus the page holds, so the browser reads only its own hearth's flow until a carried pin set
 * reaches browsers. Null when `?flow=` is absent or names the relay's own host.
 */
export function flowElsewhereNote(flowParam: string | null, relayUrl: string | undefined): string | null {
  if (flowParam === null || flowParam === "") return null;
  const hostOf = (url: string): string | null => { try { return new URL(url).host; } catch { return null; } };
  const here = hostOf(flowParam);
  const relayHost = relayUrl === undefined ? null : hostOf(relayUrl);
  if (here !== null && here === relayHost) return null;
  return "the browser reads only its own hearth's flow until a carried pin set reaches browsers; an ?flow= naming another host is not read";
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
export function mountLiveStatus(parent: HTMLElement, state: BrowserConnectionState): () => void {
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
