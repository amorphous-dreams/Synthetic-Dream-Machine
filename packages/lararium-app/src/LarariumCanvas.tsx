import { useEffect, useRef } from "react";
import { Tldraw, inlineBase64AssetStore } from "tldraw";
import type { TLShapeId, TLComponents } from "tldraw";
import { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import type { LarViewState, LarViewAction, TldrawEditorLike, ZoomLevel } from "@lararium/tldraw";
import { goToStoryRiver, goToGraph, goToRoom, zoomToMeme, classifyZoom } from "@lararium/tldraw";
import { LarariumMenuPanel, LarariumSharePanel, LarariumHelperButtons, useLararium } from "./lararium-context.js";

// Wiki mode: suppress tldraw chrome; Lararium slot components fill the UI.
// All slot components are stable module-level refs — tldraw won't remount them.
const WIKI_COMPONENTS: TLComponents = {
  Toolbar:      null,
  StylePanel:   null,
  PageMenu:     null,
  MainMenu:     null,
  ZoomMenu:     null,
  QuickActions: null,
  TopPanel:     null,
  // NavigationPanel (minimap + zoom) left at default — owns the bottom-left zone
  // Lararium slots — room/status top-left, ⌘K top-right, controls row
  MenuPanel:    LarariumMenuPanel,
  SharePanel:   LarariumSharePanel,
  HelperButtons: LarariumHelperButtons,
};

// Canvas mode: restore tldraw drawing chrome alongside Lararium slots.
// PageMenu and TopPanel stay null — nav owned by Lararium slots.
const CANVAS_COMPONENTS: TLComponents = {
  PageMenu:      null,
  TopPanel:      null,
  MenuPanel:     LarariumMenuPanel,
  SharePanel:    LarariumSharePanel,
  HelperButtons: LarariumHelperButtons,
};

interface Props {
  wsUrl: string;
  navState: LarViewState;
  dispatch: React.Dispatch<LarViewAction>;
  canvasMode: boolean;
  onZoomLevel?: (level: ZoomLevel) => void;
  onMemes?: (memes: { uri: string; depth: number; kind: string }[]) => void;
}

type TldrawEditor = Parameters<NonNullable<React.ComponentProps<typeof Tldraw>["onMount"]>>[0];

// ---------------------------------------------------------------------------
// applyZoomTemplate — batch-update meme frame props for the active zoom level
// ---------------------------------------------------------------------------

type ZoomTemplateKey = "strategic" | "operational" | "tactical" | "combat" | "action";

function applyZoomTemplate(editor: TldrawEditor, level: ZoomLevel) {
  const key = level as ZoomTemplateKey;
  const shapes = editor.getCurrentPageShapes();
  const updates: { id: string; type: string; props: Record<string, unknown> }[] = [];

  for (const shape of shapes) {
    if (shape.type !== "frame") continue;
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (meta?.frameKind !== "meme") continue;
    const tpl = (meta?.templateProps as Record<string, unknown> | undefined)?.[key] as Record<string, unknown> | undefined;
    if (!tpl) continue;

    const rating = typeof meta?.uri === "string" ? ratingFromShape(shape) : "black";
    const color = tpl["color"] === "rating" ? rating : (tpl["color"] as string ?? "grey");

    updates.push({
      id:    shape.id,
      type:  "frame",
      props: { w: tpl["w"], h: tpl["h"], color },
    });
  }

  if (updates.length > 0) {
    editor.updateShapes(updates as Parameters<typeof editor.updateShapes>[0]);
  }
}

function ratingFromShape(shape: ReturnType<TldrawEditor["getCurrentPageShapes"]>[number]): string {
  const meta = shape.meta as Record<string, unknown> | undefined;
  const rating = meta?.rating as string | undefined;
  if (rating === "kapu")  return "orange";
  if (rating === "ano")   return "blue";
  if (rating === "meme")  return "violet";
  if (rating === "data")  return "grey";
  return "black";
}

function syncNavState(editor: TldrawEditor, navState: LarViewState) {
  const ed = editor as unknown as TldrawEditorLike;
  if (navState.activeView === "graph") {
    goToGraph(ed);
  } else if (navState.activeView === "room" && navState.focusUri) {
    goToRoom(ed, navState.focusUri);
  } else if (navState.activeView === "meme-detail" && navState.focusUri) {
    zoomToMeme(ed, navState.focusUri);
  } else {
    goToStoryRiver(ed);
  }
}

function getLarUriFromShape(editor: TldrawEditor, shapeId: TLShapeId): string | null {
  const shape = editor.getShape(shapeId);
  if (!shape) return null;
  const meta = shape.meta as Record<string, unknown> | undefined;
  if (meta?.uri && typeof meta.uri === "string") return meta.uri;
  if (meta?.larUri && typeof meta.larUri === "string") return meta.larUri;
  if (shape.type === "frame" || shape.type === "geo") {
    const props = shape.props as unknown as Record<string, unknown>;
    const name = props.name ?? props.text;
    if (typeof name === "string" && name.startsWith("lar:")) return name;
  }
  return null;
}

export function LarariumCanvas({ wsUrl, navState, dispatch, canvasMode, onZoomLevel, onMemes }: Props) {
  const store = useSync({ uri: wsUrl, assets: inlineBase64AssetStore });
  const editorRef = useRef<TldrawEditor | null>(null);
  const { theme, setEditor } = useLararium();
  if (process.env.NODE_ENV === "development") {
    (window as any).__larariumDebug ??= {};
    (window as any).__larariumDebug.store = store;
  }

  // Populate meme list reactively — CRDT-native, no /api/memes fetch.
  // One-shot scan on sync, then store.listen for document mutations (shape add/remove/update).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || store.status !== "synced-remote" || !onMemes) return;

    const scanMemes = () => {
      const memes = editor.getCurrentPageShapes()
        .filter((s) => {
          const meta = s.meta as Record<string, unknown> | undefined;
          return s.type === "frame" && meta?.frameKind === "meme";
        })
        .map((s) => {
          const meta = s.meta as Record<string, unknown>;
          return {
            uri:   String(meta.uri ?? ""),
            depth: Number(meta.depth ?? 0),
            kind:  String(meta.kind ?? "meme"),
          };
        })
        .filter((m) => m.uri.startsWith("lar:"));
      onMemes(memes);
    };

    scanMemes();

    // Re-scan on any document mutation (shape add/remove/meta change).
    // scope:'document' skips camera/presence records — fires ~100x less than default.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const unsub = editor.store.listen(
      () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(scanMemes, 150);
      },
      { scope: "document" },
    );

    return () => {
      unsub();
      if (debounce) clearTimeout(debounce);
    };
  }, [store.status, onMemes]);

  // Sync tldraw colorScheme when Lararium theme changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const colorScheme = theme === "gruvbox-dark" ? "dark" : theme === "gruvbox-light" ? "light" : "system";
    editor.user.updateUserPreferences({ colorScheme });
  }, [theme]);

  // Double-click: geo portal (meta.larPortal) → GO_TO_ROOM, meme frame → ZOOM_IN
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || store.status !== "synced-remote") return;
    const handler = (e: { target?: { id?: TLShapeId } }) => {
      const shapeId = e?.target?.id;
      if (!shapeId) return;
      const shape = editor.getShape(shapeId);
      const meta = shape?.meta as Record<string, unknown> | undefined;
      if (meta?.larPortal && typeof meta.targetRoomId === "string") {
        dispatch({ type: "GO_TO_ROOM", roomId: meta.targetRoomId });
        return;
      }
      const uri = getLarUriFromShape(editor, shapeId);
      if (uri) dispatch({ type: "ZOOM_IN", uri });
    };
    editor.on("doubleClickShape" as any, handler);
    return () => { editor.off("doubleClickShape" as any, handler); };
  }, [store.status, dispatch]);

  // Nav state → tldraw camera.
  // Only execute navState commands — do NOT push a page on sync.
  // Page ordering (page:boot has index a1) makes tldraw default to the right page
  // on first connect without an imperative setCurrentPage override that fights
  // with in-progress navigation.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || store.status !== "synced-remote") return;
    syncNavState(editor, navState);
  }, [navState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom level → page auto-switch.
  // scope:'session' filters to camera/presence records only — avoids firing on
  // every document mutation (shape moves, text edits, etc.).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || store.status !== "synced-remote") return;

    let lastLevel = classifyZoom(editor.getZoomLevel());

    const unsub = editor.store.listen(
      () => {
        const zoom  = editor.getZoomLevel();
        const level = classifyZoom(zoom);
        if (level === lastLevel) return;
        lastLevel = level;

        onZoomLevel?.(level);
        applyZoomTemplate(editor, level);
      },
      { scope: "session" },
    );

    return unsub;
  }, [store.status]);

  if (store.status === "loading") {
    return <div style={fill}>Connecting to Lararium…</div>;
  }
  if (store.status === "error") {
    return (
      <div style={{ ...fill, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "red", gap: 12 }}>
        <span>Sync error: {store.error?.message ?? "unknown"}</span>
        <button onClick={() => window.location.reload()} style={{ padding: "6px 16px", cursor: "pointer" }}>Reload</button>
      </div>
    );
  }

  return (
    <div style={fill}>
      <Tldraw
        store={store.store}
        components={canvasMode ? CANVAS_COMPONENTS : WIKI_COMPONENTS}
        onMount={(editor) => {
          editorRef.current = editor;
          setEditor(editor);
          if (process.env.NODE_ENV === "development") {
            (window as any).__larariumDebug ??= {};
            (window as any).__larariumDebug.editor = editor;
          }
          editor.user.updateUserPreferences({ colorScheme: "dark" });
          editor.setCurrentTool("select");
        }}
      />
    </div>
  );
}

const fill = { width: "100%", height: "100%" } as const;
