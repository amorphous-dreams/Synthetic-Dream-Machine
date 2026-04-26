import { useReducer } from "react";
import { INITIAL_VIEW_STATE, viewStateReducer } from "@lararium/tldraw";
import type { LarViewAction } from "@lararium/tldraw";
import { LarariumCanvas } from "./LarariumCanvas.js";
import { SidePanel } from "./SidePanel.js";

// WS URL injected by serve.ts via <meta name="lararium-ws"> — falls back to
// same-host default for dev.
function getWsUrl(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="lararium-ws"]');
  if (meta?.content) return meta.content;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/rooms/boot`;
}

export function App() {
  const [navState, dispatch] = useReducer(viewStateReducer, INITIAL_VIEW_STATE);
  const wsUrl = getWsUrl();

  return (
    <div style={styles.root}>
      <LarariumCanvas wsUrl={wsUrl} navState={navState} dispatch={dispatch} />
      <SidePanel
        navState={navState}
        app={null}
        dispatch={dispatch as React.Dispatch<LarViewAction>}
      />
    </div>
  );
}

const styles = {
  root: { width: "100%", height: "100%", position: "relative" as const },
} as const;
