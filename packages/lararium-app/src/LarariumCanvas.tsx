import { useEffect, useRef } from "react";
import { Tldraw, inlineBase64AssetStore } from "tldraw";
import type { TLShapeId, TLComponents } from "tldraw";
import { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import type { LarViewState, LarViewAction, TldrawEditorLike, ZoomLevel } from "@lararium/tldraw";
import { goToStoryRiver, goToGraph, goToRoom, zoomToMeme, classifyZoom } from "@lararium/tldraw";
import { RATING_COLOR, type Rating5, type ChangeOrigin } from "@lararium/core";
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
  const updates: { id: string; type: string; x?: number; y?: number; opacity?: number; props?: Record<string, unknown> }[] = [];

  // Pass 1: meme frames — resize/recolor; collect per-frame templateProp flags.
  const memeIncludeAhu  = new Map<string, boolean>();
  const memeShowCarrier = new Map<string, boolean>();
  for (const shape of shapes) {
    if (shape.type !== "frame") continue;
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (meta?.frameKind !== "meme") continue;
    const tpl = (meta?.templateProps as Record<string, unknown> | undefined)?.[key] as Record<string, unknown> | undefined;
    if (!tpl) continue;

    const rating = typeof meta?.uri === "string" ? ratingFromShape(shape) : "black";
    const color = tpl["color"] === "rating" ? rating : (tpl["color"] as string ?? "grey");
    updates.push({ id: shape.id, type: "frame", props: { w: tpl["w"], h: tpl["h"], color } });
    memeIncludeAhu.set(shape.id,  tpl["includeAhu"]  === true);
    memeShowCarrier.set(shape.id, tpl["showCarrier"] === true);
  }

  // Pass 2: ahu sub-frames + ownership arrows — hide when parent meme has includeAhu=false
  // so ahu frames stay inside shrunken meme bounds and tldraw won't reparent them on drag
  for (const shape of shapes) {
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (shape.type === "frame" && meta?.frameKind === "ahu") {
      const visible = memeIncludeAhu.get(shape.parentId as string) ?? false;
      updates.push({ id: shape.id, type: "frame", opacity: visible ? 1 : 0 });
    } else if (shape.type === "arrow" && meta?.isOwnership === true) {
      // Ownership arrow's fromFrameId is in meta.family="control" — look up parent via parentId chain
      // The arrow is on the page, so we need to check the source meme's includeAhu.
      // Store meme URI in meta at emission and look it up via the meme frame's includeAhu flag.
      // For now: show ownership arrows when ANY meme has includeAhu (conservative; refined below)
      const memeId = (meta.ownsMemeId as string | undefined);
      const visible = memeId ? (memeIncludeAhu.get(memeId) ?? false) : false;
      updates.push({ id: shape.id, type: "arrow", opacity: visible ? 0.3 : 0 });
    }
  }

  // Pass 3: socket port shapes — reposition between meme-center and ahu-spread
  for (const shape of shapes) {
    if (shape.type !== "geo") continue;
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (meta?.socketKind !== "port") continue;

    const spread = memeIncludeAhu.get(shape.parentId as string) ?? false;
    const x = spread ? (meta["spreadX"] as number) : (meta["centerX"] as number);
    const y = spread ? (meta["spreadY"] as number) : (meta["centerY"] as number);
    updates.push({ id: shape.id, type: "geo", x, y });
  }

  // Pass 4: body node shapes — show/hide based on parent frame's showCarrier flag (built in Pass 1).
  // showCarrier=true only at "action" zoom level — keeps canvas uncluttered at overview scales.
  for (const shape of shapes) {
    if (shape.type !== "geo") continue;
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (!meta?.bodyNodeKind) continue;
    const visible = memeShowCarrier.get(shape.parentId as string) ?? false;
    updates.push({ id: shape.id, type: "geo", opacity: visible ? 1 : 0 });
  }

  if (updates.length > 0) {
    editor.updateShapes(updates as Parameters<typeof editor.updateShapes>[0]);
  }
}

function ratingFromShape(shape: ReturnType<TldrawEditor["getCurrentPageShapes"]>[number]): string {
  const meta = shape.meta as Record<string, unknown> | undefined;
  const rating = (meta?.rating as string | undefined)?.toLowerCase() as Rating5 | undefined;
  return (rating && RATING_COLOR[rating]) ?? "black";
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
  const { theme, setEditor, editor, tiddlerStore, hostReceipt } = useLararium();
  (window as any).__larariumDebug ??= {};
  (window as any).__larariumDebug.store             = store;
  (window as any).__larariumDebug.tiddlerStore      = tiddlerStore;
  (window as any).__larariumDebug.hostReceipt       = hostReceipt;
  (window as any).__larariumDebug.projectionCacheCount =
    tiddlerStore ? "call __larariumDebug.tiddlerStore.listVisible().then(console.log)" : 0;

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

  // Projection-cache intake — seed MemoryTiddlerStore from shape.meta.carrierText.
  // Gates on hostReceipt being non-null (receipt must arrive from boot-receipt meta-frame
  // via useBridgeReceiptFromEditor before any projection-cache writes are allowed).
  // Re-runs when receipt upgrades from null to real hash; re-seeds on document mutations.
  useEffect(() => {
    if (!editor || !tiddlerStore || !hostReceipt) return;
    const receipt = hostReceipt;

    const seedAll = () => {
      for (const record of editor.store.allRecords()) {
        const r = record as unknown as Record<string, unknown>;
        if (r["typeName"] !== "shape" || r["type"] !== "frame") continue;
        const meta = r["meta"] as Record<string, unknown> | undefined;
        if (meta?.["frameKind"] !== "meme") continue;
        const text = typeof meta["carrierText"] === "string" ? meta["carrierText"] : undefined;
        const uri  = typeof meta["uri"] === "string"         ? meta["uri"]         : undefined;
        if (!text || !uri || !uri.startsWith("lar:")) continue;
        const origin: ChangeOrigin = { kind: "projection-cache", shapeId: r["id"] as string, receipt };
        void tiddlerStore.put({ title: uri, fields: {}, text }, origin);
      }
    };

    seedAll();
    const unsub = editor.store.listen(() => seedAll(), { scope: "document" });
    return unsub;
  }, [editor, tiddlerStore, hostReceipt]);

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

  // Q1: mount tldraw immediately — no blocking spinner on loading.
  // Opening status surfaces in LarariumMenuPanel via openPhase from context.
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
          (window as any).__larariumDebug ??= {};
          (window as any).__larariumDebug.editor      = editor;
          (window as any).__larariumDebug.receiptShape = editor.store.get("shape:lararium_boot_receipt" as any);
          editor.user.updateUserPreferences({ colorScheme: "dark" });
          editor.setCurrentTool("select");

          let lastLevel = classifyZoom(editor.getZoomLevel());
          applyZoomTemplate(editor, lastLevel);

          editor.store.listen(
            () => {
              const level = classifyZoom(editor.getZoomLevel());
              if (level === lastLevel) return;
              lastLevel = level;
              onZoomLevel?.(level);
              applyZoomTemplate(editor, level);
            },
            { scope: "session" },
          );
        }}
      />
    </div>
  );
}

const fill = { width: "100%", height: "100%" } as const;
