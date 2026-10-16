import type { BrowserConnectionSnapshot, BrowserConnectionState } from "@lararium/browser";

export interface ServedLocation {
  readonly origin: string;
  readonly protocol: string;
  readonly host: string;
}

/** The served page and its node share an origin when a gate pin carries no separate route. */
export function defaultReadFace(location: Pick<ServedLocation, "origin">): string {
  return location.origin;
}

export function sameOriginRelayUrl(location: Pick<ServedLocation, "protocol" | "host">): string {
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location.host}/ws`;
}

/** A supplied relay remains explicit; a gate-pinned same-origin node derives its own WS route. */
export function resolveRelayUrl(
  location: Pick<ServedLocation, "protocol" | "host">,
  params: URLSearchParams,
): string | undefined {
  const explicit = params.get("relay");
  if (explicit) return explicit;
  if (!params.get("gate")) return undefined;
  return sameOriginRelayUrl(location);
}

/**
 * The line the web status owes when `?oracle=` names a hearth other than the relay's: a read at another hearth
 * dials under no Nexus the page holds, so the browser reads only its own hearth's oracle until a carried pin set
 * reaches browsers. Null when `?oracle=` is absent or names the relay's own host.
 */
export function oracleElsewhereNote(oracleParam: string | null, relayUrl: string | undefined): string | null {
  if (oracleParam === null || oracleParam === "") return null;
  const hostOf = (url: string): string | null => { try { return new URL(url).host; } catch { return null; } };
  const here = hostOf(oracleParam);
  const relayHost = relayUrl === undefined ? null : hostOf(relayUrl);
  if (here !== null && here === relayHost) return null;
  return "the browser reads only its own hearth's oracle until a carried pin set reaches browsers; an ?oracle= naming another host is not read";
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
    case "missing-pin":
      return { connection: `not attached — ${snapshot.reason}`, mode: "crossing refused · no gate pin", tone: "warn" };
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
        return { connection: `gate-unreachable — ${snapshot.gatePubKey}`, mode: `local path to ${snapshot.gatePubKey} did not reach a gate`, tone: "warn" };
      }
      return { connection: `disconnected from ${snapshot.gatePubKey}`, mode: `node ${snapshot.gatePubKey} disconnected`, tone: "warn" };
  }
}

/**
 * What the connection row publishes as data, for a reader that must not parse prose:
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
