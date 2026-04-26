import { useEffect, useReducer, useState } from "react";
import type { LarApp } from "@lararium/web";
import { bootFromEmbedded, renderAppViews } from "@lararium/web";
import { INITIAL_VIEW_STATE, viewStateReducer } from "@lararium/tldraw";
import type { LarViewAction } from "@lararium/tldraw";
import { LarariumCanvas } from "./LarariumCanvas.js";
import { SidePanel } from "./SidePanel.js";

type BootState =
  | { status: "loading" }
  | { status: "ready"; app: LarApp }
  | { status: "error"; message: string };

export function App() {
  const [boot, setBoot] = useState<BootState>({ status: "loading" });
  const [navState, dispatch] = useReducer(viewStateReducer, INITIAL_VIEW_STATE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const app = await bootFromEmbedded();
        const appWithViews = await renderAppViews(app);
        if (!cancelled) setBoot({ status: "ready", app: appWithViews });
      } catch (e) {
        if (!cancelled) setBoot({ status: "error", message: String(e) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (boot.status === "loading") {
    return <div style={styles.splash}>Lararium loading…</div>;
  }
  if (boot.status === "error") {
    return <div style={styles.error}>Boot error: {boot.message}</div>;
  }

  return (
    <div style={styles.root}>
      <LarariumCanvas
        app={boot.app}
        navState={navState}
        dispatch={dispatch}
      />
      <SidePanel
        navState={navState}
        app={boot.app}
        dispatch={dispatch as React.Dispatch<LarViewAction>}
      />
    </div>
  );
}

const styles = {
  root: { width: "100%", height: "100%", position: "relative" as const },
  splash: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "100%", height: "100%",
    color: "#888", fontSize: "14px", letterSpacing: "0.05em",
  },
  error: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "100%", height: "100%",
    color: "#e06c75", fontSize: "14px", padding: "2rem",
  },
} as const;
