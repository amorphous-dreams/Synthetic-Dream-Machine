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
import { ReactionGraph } from "@lararium/core";
import { LarariumCanvas } from "./LarariumCanvas.js";
import { LarariumPanel } from "./LarariumPanel.js";
import { BootSplash } from "./BootSplash.js";
import { LarariumCtx, useTheme } from "./lararium-context.js";
import { useLarariumHostOpen } from "./lararium-browser-host.js";
import { projectFromTw5 } from "./tw5-canvas-projection.js";
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
  const [theme, cycleTheme] = useTheme();
  const [editor, setEditorState] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const setEditor = useCallback((e: Editor | null) => { setEditorState(e); editorRef.current = e; }, []);
  const { phase: openPhase, store: tiddlerStore, tw5 } =
    useLarariumHostOpen({ hostId: "lararium-browser", recipeUri: "lar:///recipe/room", roomId: "altar-fire" });

  const [hostReceipt] = useState<string | null>(() =>
    typeof document !== "undefined"
      ? document.querySelector('meta[name="lararium-receipt"]')?.getAttribute("content") ?? null
      : null
  );

  const graphRef = useRef<ReactionGraph>(new ReactionGraph());
  const [graphReady, setGraphReady] = useState(false);
  const projectedIdsRef = useRef<Set<string>>(new Set());

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // fn-based reaction handlers — registered once, never re-subscribed.
  useEffect(() => {
    const g = graphRef.current;
    const unsubs = [
      g.subscribeByFn("navigate", (b) => {
        dispatchRef.current({ type: "GO_TO_ROOM", roomId: b.toUri });
      }),
      g.subscribeByFn("zoom", (b) => {
        dispatchRef.current({ type: "ZOOM_IN", uri: b.toUri });
      }),
      g.subscribeByFn("relay", (b, payload) => {
        if (b.trigger) graphRef.current.fireSync(b.toUri, b.trigger, payload);
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
    if (!tw5) return;
    const initial = tw5.buildReactionGraph();
    if (initial) { graphRef.current.load(initial.bindings); setGraphReady(true); }
    scanMemesFromTw5();
    return tw5.onWikiChange((changes: Record<string, unknown>) => {
      let changed = false;
      for (const uri of Object.keys(changes)) {
        if (!uri.startsWith("lar:")) continue;
        const bindings = tw5.bindingsForUri(uri);
        if (bindings.length > 0) graphRef.current.updateUri(uri, bindings);
        else graphRef.current.removeUri(uri);
        changed = true;
      }
      if (!changed) return;
      scanMemesFromTw5();
      // Incremental canvas re-projection: diff shape IDs, put new/updated, remove deleted.
      const ed = editorRef.current;
      if (!ed) return;
      const { pages, shapes, bindings: newBindings } = projectFromTw5(tw5);
      const newRecords = [...pages, ...shapes, ...newBindings];
      const newIds = new Set(newRecords.map((r) => r.id));
      const prevIds = projectedIdsRef.current;
      const removed = [...prevIds].filter((id) => !newIds.has(id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ed as any).store.put(newRecords);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (removed.length > 0) (ed as any).store.remove(removed);
      projectedIdsRef.current = newIds;
    });
  }, [tw5, scanMemesFromTw5]);

  useEffect(() => {
    if (!editor || !tw5) return;
    const { pages, shapes, bindings } = projectFromTw5(tw5);
    const records = [...pages, ...shapes, ...bindings];
    projectedIdsRef.current = new Set(records.map((r) => r.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).store.put(records);
  }, [editor, tw5]);

  const reactionGraph = graphReady ? graphRef.current : null;

  const fireMeme = useCallback((fromUri: string, trigger: string, payload: unknown = {}) => {
    graphRef.current.fireSync(fromUri, trigger, payload);
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

  debugSet("openPhase",    openPhase);
  debugSet("tw5",          tw5);
  debugSet("dispatch",     dispatch);
  debugSet("tiddlerStore", tiddlerStore);

  const ctxValue = {
    navState,
    dispatch:      dispatch as React.Dispatch<LarViewAction>,
    memes,
    wikiOpen,      setWikiOpen,
    drawingMode,   setDrawingMode,
    zoomLevel,
    theme,         cycleTheme,
    editor,        setEditor,
    openPhase,
    tiddlerStore,
    tw5,
    hostReceipt,
    reactionGraph,
    fireMeme,
  };

  return (
    <LarariumCtx.Provider value={ctxValue}>
      <div style={css.shellRoot}>
        <LarariumCanvas
          navState={navState}
          dispatch={dispatch as React.Dispatch<LarViewAction>}
          drawingMode={drawingMode}
          onZoomLevel={setZoomLevel}
        />
        {createPortal(<LarariumPanel />,           document.body)}
        {createPortal(<BootSplash phase={openPhase} />, document.body)}
      </div>
    </LarariumCtx.Provider>
  );
}

const css = {
  shellRoot: {
    width: "100%", height: "100%",
    position: "relative" as const,
    overflow: "hidden",
  },
} as const;
