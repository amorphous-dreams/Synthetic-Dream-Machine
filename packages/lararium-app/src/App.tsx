import { useReducer, useEffect, useState } from "react";
import { INITIAL_VIEW_STATE, viewStateReducer } from "@lararium/tldraw";
import type { LarViewAction } from "@lararium/tldraw";
import { LarariumCanvas } from "./LarariumCanvas.js";
import { SidePanel } from "./SidePanel.js";

export interface MemeEntry {
  uri: string;
  depth: number;
  kind: string;
}

function getWsUrl(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="lararium-ws"]');
  if (meta?.content) return meta.content;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/rooms/boot`;
}

function getApiBase(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="lararium-ws"]');
  if (meta?.content) {
    const u = new URL(meta.content);
    return `${u.protocol === "wss:" ? "https:" : "http:"}//${u.host}`;
  }
  return "";
}

export function App() {
  const [navState, dispatch] = useReducer(viewStateReducer, INITIAL_VIEW_STATE);
  const [memes, setMemes] = useState<MemeEntry[]>([]);
  const wsUrl = getWsUrl();

  useEffect(() => {
    fetch(`${getApiBase()}/api/memes`)
      .then((r) => r.json())
      .then((data: MemeEntry[]) => setMemes(data))
      .catch((e) => console.warn("[lararium] /api/memes fetch failed:", e));
  }, []);

  return (
    <div style={styles.root}>
      <LarariumCanvas wsUrl={wsUrl} navState={navState} dispatch={dispatch} />
      <SidePanel
        memes={memes}
        navState={navState}
        dispatch={dispatch as React.Dispatch<LarViewAction>}
      />
    </div>
  );
}

const styles = {
  root: { width: "100%", height: "100%", position: "relative" as const },
} as const;
