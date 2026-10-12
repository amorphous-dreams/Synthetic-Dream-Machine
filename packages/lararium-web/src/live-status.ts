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
