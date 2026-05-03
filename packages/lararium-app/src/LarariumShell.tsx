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

import { useReducer, useEffect, useState, useRef, useCallback } from "react";
import type { Editor } from "tldraw";
import { createPortal } from "react-dom";
import { INITIAL_VIEW_STATE, viewStateReducer } from "@lararium/tldraw";
import type { LarViewAction, ZoomLevel } from "@lararium/tldraw";
import { ReactionEngine } from "@lararium/core";
import { LarariumCanvas } from "./LarariumCanvas.js";
import { LarHUD } from "./LarHUD.js";
import { BootSplash } from "./BootSplash.js";
import { LarariumCtx, useTheme } from "./lararium-context.js";
import { useBrowserLarPeer } from "./open-browser-lar-peer.js";
import { projectFromTw5 } from "@lararium/tldraw";
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
  const { phase: openPhase, peer, tw5, pool } =
    useBrowserLarPeer({ hostId: "lararium-browser", roomId: "altar-fire" });

  const engineRef = useRef<ReactionEngine>(new ReactionEngine());
  const [graphReady, setGraphReady] = useState(false);
  const projectedIdsRef = useRef<Set<string>>(new Set());

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wiki = tw5.wiki as any;
    const uris: string[] = tw5.filterTiddlers("[all[tiddlers]prefix[lar:]]");
    const entries = uris.map((uri) => {
      const t = wiki.getTiddler?.(uri);
      return {
        uri,
        depth: Number(t?.fields?.depth ?? 0),
        kind:  String(t?.fields?.rating ?? "meme"),
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
    // Canvas re-projection on any lar: tiddler change.
    const unsubCanvas = peer.addProjection({
      onUriChanged(change) {
        if (!change.title.startsWith("lar:")) return;
        scanMemesFromTw5();
        const ed = editorRef.current;
        if (!ed) return;
        const { pages, shapes, bindings: newBindings } = projectFromTw5(tw5);
        const newRecords = [...pages, ...shapes, ...newBindings];
        const newIds = new Set(newRecords.map((r) => r.id));
        const prevIds = projectedIdsRef.current;
        const removed = [...prevIds].filter((id) => !newIds.has(id));
        // projectFromTw5 emits plain string IDs; tldraw store expects branded TLBindingId.
        // Cast until the projection layer uses createBindingId() for arrow bindings.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ed.store as any).put(newRecords);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (removed.length > 0) (ed.store as any).remove(removed);
        projectedIdsRef.current = newIds;
      },
    });
    return () => { unsubEngine(); unsubCanvas(); };
  }, [tw5, peer, scanMemesFromTw5]);

  useEffect(() => {
    if (!editor || !tw5) return;
    const { pages, shapes, bindings } = projectFromTw5(tw5);
    const records = [...pages, ...shapes, ...bindings];
    projectedIdsRef.current = new Set(records.map((r) => r.id));
    // projectFromTw5 emits plain string IDs; tldraw store expects branded TLBindingId.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor.store as any).put(records);
  }, [editor, tw5]);

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
