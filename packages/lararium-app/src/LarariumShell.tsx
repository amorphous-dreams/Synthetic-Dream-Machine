/**
 * LarariumShell — tldraw-native chrome architecture.
 *
 * Architecture:
 *   - <LarariumCanvas> fills 100vw × 100vh; drawingMode toggles full tldraw chrome
 *   - Nav chrome (breadcrumb, room name) → tldraw MenuPanel slot
 *   - Theme toggle → tldraw SharePanel slot
 *   - Back + graph toggle → tldraw HelperButtons slot
 *   - LarariumPanel → floating HUD chip that expands into TW5 wiki frame (portal)
 *
 * Keyboard:
 *   ⌘K / Ctrl+K  → toggle wiki panel (LarariumPanel expanded state)
 *   `             → toggle drawing mode (show/hide full tldraw chrome)
 *   Escape        → close wiki panel (handled inside LarariumPanel)
 *
 * Platform targets: Windows 11 / Ubuntu WSL (mouse+kb), Android Samsung (touch).
 * All tap targets ≥ 44×44px. No hover-only affordances.
 */

import { useReducer, useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { Editor } from "tldraw";
import { createPortal } from "react-dom";
import { INITIAL_VIEW_STATE, viewStateReducer, MemeCanvasProjection } from "@lararium/tldraw";
import type { LarViewAction, ZoomLevel } from "@lararium/tldraw";
import { ReactionEngine } from "@lararium/core";
import { LarariumCanvas } from "./LarariumCanvas.js";
import { LarHUD } from "./LarHUD.js";
import { BootSplash } from "./BootSplash.js";
import { LarariumCtx, useTheme } from "./lararium-context.js";
import { useBrowserLarPeer } from "./open-browser-lar-peer.js";
import { debugSet } from "./debug.js";
import "./lararium-theme.css";
import type { MemeEntry } from "./App.js";


interface ShellProps {
  memes: MemeEntry[];
  onMemes: (memes: MemeEntry[]) => void;
}

// ---------------------------------------------------------------------------
// Shell root
// ---------------------------------------------------------------------------

export function LarariumShell({ memes, onMemes }: ShellProps) {
  const [navState, dispatch] = useReducer(viewStateReducer, INITIAL_VIEW_STATE);
  const [wikiOpen,    setWikiOpen]    = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [zoomLevel,   setZoomLevel]   = useState<ZoomLevel>("tactical");
  const [dockEdge,    setDockEdge]    = useState<"right" | "bottom">("right");
  const [theme, cycleTheme] = useTheme();
  const [editor, setEditorState] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const setEditor = useCallback((e: Editor | null) => { setEditorState(e); editorRef.current = e; }, []);
  // In dev: Vite proxies /ws → ws://localhost:8080 (node peer).
  // VITE_LAR_WS_URL overrides (e.g. wss://elyncia.app/ws in prod).
  // Omitting wsUrl gives tabs-only offline mode.
  // useMemo: stable reference — avoids re-triggering the peer hook on every render.
  const wsUrl = useMemo(
    () => (import.meta.env.VITE_LAR_WS_URL as string | undefined)
      ?? (import.meta.env.DEV ? `ws://${window.location.host}/ws` : undefined),
    [],
  );
  const { phase: openPhase, peer, tw5, pool } =
    useBrowserLarPeer({ hostId: "lararium-browser", roomId: "altar-fire", ...(wsUrl !== undefined && { wsUrl }) });

  const engineRef = useRef<ReactionEngine>(new ReactionEngine());
  const [graphReady, setGraphReady] = useState(false);
  const canvasProjectionRef = useRef(new MemeCanvasProjection());

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // fn-based reaction handlers — registered once, never re-subscribed.
  useEffect(() => {
    const e = engineRef.current;
    const unsubs = [
      e.subscribeByFn("navigate", (b) => {
        dispatchRef.current({ type: "GO_TO_ROOM", roomId: b.toUri });
      }),
      e.subscribeByFn("zoom", (b) => {
        dispatchRef.current({ type: "ZOOM_IN", uri: b.toUri });
      }),
      e.subscribeByFn("relay", (b, payload) => {
        if (b.listenable) engineRef.current.fireSync(b.toUri, b.listenable, payload);
      }),
    ];
    return () => { unsubs.forEach((u) => u()); };
  }, []);

  const scanMemesFromTw5 = useCallback(() => {
    if (!tw5) return;
    const uris: string[] = tw5.filterTiddlers("[all[tiddlers]prefix[lar:]]");
    const entries = uris.map((uri) => {
      const t = tw5.getTiddler(uri);
      return {
        uri,
        depth: Number(t?.["depth"] ?? 0),
        kind:  String(t?.["rating"] ?? "meme"),
      };
    }).filter((e) => e.uri.startsWith("lar:"));
    onMemes(entries);
  }, [tw5, onMemes]);

  useEffect(() => {
    if (!tw5 || !peer) return;
    engineRef.current.boot(tw5); setGraphReady(true);
    scanMemesFromTw5();
    // Route CRDT changes through ReactionEngine (MemeProjection bus).
    const unsubEngine = peer.addProjection(engineRef.current);
    // Canvas projection: CRDT changes → CanvasPatch → TldrawCanvasBinding.
    // The binding is wired to the editor inside LarariumCanvas.onMount via
    // canvasProjectionRef.current.bindView(new TldrawCanvasBinding(editor)).
    const unsubCanvas = peer.addProjection(canvasProjectionRef.current);
    // Also scan memes on every lar: tiddler change for the HUD list.
    const unsubScan = peer.addProjection({
      onUriChanged(change) {
        if (change.title.startsWith("lar:")) scanMemesFromTw5();
      },
    });
    return () => { unsubEngine(); unsubCanvas(); unsubScan(); };
  }, [tw5, peer, scanMemesFromTw5]);

  // Canvas binding is wired from LarariumCanvas.onMount via canvasProjectionRef.
  // No store.put() here — the projection layer drives the canvas view.

  const reactionGraph = graphReady ? engineRef.current : null;

  const fireMeme = useCallback((fromUri: string, trigger: string, payload: unknown = {}) => {
    engineRef.current.fireSync(fromUri, trigger, payload);
  }, []);

  useEffect(() => {
    if (!tw5) return;
    const paletteName = theme === "gruvbox-light"
      ? "lar:///ha.ka.ba/api/v0.1/lararium/palette/gruvbox-light"
      : "lar:///ha.ka.ba/api/v0.1/lararium/palette/gruvbox-dark";
    tw5.setPalette(paletteName);
  }, [theme, tw5]);

  // Global keyboard: ⌘K → wiki toggle, ` → drawing mode toggle.
  // Escape and tldraw passthrough handled inside LarariumPanel.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setWikiOpen((v) => !v);
        return;
      }
      if (e.key === "`") {
        e.preventDefault();
        setDrawingMode((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  debugSet("openPhase", openPhase);
  debugSet("tw5",       tw5);
  debugSet("dispatch",  dispatch);

  const ctxValue = {
    navState,
    dispatch:      dispatch as React.Dispatch<LarViewAction>,
    memes,
    wikiOpen,      setWikiOpen,
    drawingMode,   setDrawingMode,
    zoomLevel,
    theme,         cycleTheme,
    dockEdge,      setDockEdge,
    editor,        setEditor,
    openPhase,
    peer,
    tw5,
    reactionGraph,
    fireMeme,
  };

  const shellStyle = {
    ...css.shellRoot,
    flexDirection: (dockEdge === "bottom" ? "column" : "row") as "column" | "row",
  };

  return (
    <LarariumCtx.Provider value={ctxValue}>
      <div style={shellStyle}>
        {/* Canvas shrinks to accommodate LarHUD push — no z-index management needed */}
        <div style={css.canvasWrap}>
          <LarariumCanvas
            navState={navState}
            dispatch={dispatch as React.Dispatch<LarViewAction>}
            drawingMode={drawingMode}
            onZoomLevel={setZoomLevel}
            canvasProjection={canvasProjectionRef.current}
          />
        </div>
        <LarHUD />
        {createPortal(<BootSplash phase={openPhase} />, document.body)}
      </div>
    </LarariumCtx.Provider>
  );
}

const css = {
  // Flex row: [canvas flex:1] [LarHUD fixed-width]
  shellRoot: {
    width:    "100%",
    height:   "100%",
    display:  "flex",
    flexDirection: "row" as const,
    overflow: "hidden",
  },
  canvasWrap: {
    flex:      1,
    minWidth:  0,
    minHeight: 0,
    overflow:  "hidden",
    position:  "relative" as const,
  },
} as const;
