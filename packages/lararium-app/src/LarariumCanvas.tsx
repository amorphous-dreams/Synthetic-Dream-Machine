import { useEffect, useRef } from "react";
import { Tldraw } from "tldraw";
import type { TLShapeId, TLComponents } from "tldraw";
import "tldraw/tldraw.css";
import type { LarViewState, LarViewAction, TldrawEditorLike, ZoomLevel } from "@lararium/tldraw";
import { goToStoryRiver, goToGraph, goToRoom, zoomToMeme, classifyZoom } from "@lararium/tldraw";
import { RATING_COLOR, type Rating5 } from "@lararium/core";
import { LarariumMenuPanel, LarariumSharePanel, LarariumHelperButtons, useLararium } from "./lararium-context.js";
import { getActiveTW5 } from "@lararium/tw5";
import { debugSet } from "./debug.js";

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

// Canvas mode: restore full tldraw drawing chrome alongside Lararium slots.
// TopPanel stays null — that zone is owned by Lararium slots.
// PageMenu is restored — it serves as an additional portal / page-switch surface.
const CANVAS_COMPONENTS: TLComponents = {
  TopPanel:      null,
  MenuPanel:     LarariumMenuPanel,
  SharePanel:    LarariumSharePanel,
  HelperButtons: LarariumHelperButtons,
};

interface Props {
  wsUrl: string;
  navState: LarViewState;
  dispatch: React.Dispatch<LarViewAction>;
  drawingMode: boolean;
  onZoomLevel?: (level: ZoomLevel) => void;
}

type TldrawEditor = Parameters<NonNullable<React.ComponentProps<typeof Tldraw>["onMount"]>>[0];

// ---------------------------------------------------------------------------
// applyZoomTemplate — batch-update meme frame props for the active zoom level
// ---------------------------------------------------------------------------

// Hardcoded fallback layout when no kumu def tiddler is found for the level.
const ZOOM_DEFAULTS: Record<string, { w: number; h: number; color: string; includeAhu: boolean; showCarrier: boolean }> = {
  strategic:   { w: 60,  h: 28,  color: "grey",   includeAhu: false, showCarrier: false },
  operational: { w: 120, h: 52,  color: "rating",  includeAhu: false, showCarrier: false },
  tactical:    { w: 220, h: 100, color: "rating",  includeAhu: false, showCarrier: false },
  combat:      { w: 320, h: 160, color: "rating",  includeAhu: true,  showCarrier: false },
  action:      { w: 400, h: 220, color: "rating",  includeAhu: true,  showCarrier: true  },
};

function applyZoomTemplate(editor: TldrawEditor, level: ZoomLevel) {
  // Read layout props from TW5 kumu def tiddler (lar:///kumu/meme-<level>).
  // TW5 is the first-class source of truth — no shape.meta.templateProps needed.
  const tw5 = getActiveTW5();
  const tl = tw5?.getZoomLayout(level) ?? ZOOM_DEFAULTS[level] ?? ZOOM_DEFAULTS["tactical"]!;

  const shapes = editor.getCurrentPageShapes();
  const updates: { id: string; type: string; x?: number; y?: number; opacity?: number; props?: Record<string, unknown> }[] = [];

  // Pass 1: meme frames — resize/recolor; collect per-frame layout flags.
  const memeIncludeAhu  = new Map<string, boolean>();
  const memeShowCarrier = new Map<string, boolean>();
  for (const shape of shapes) {
    if (shape.type !== "frame") continue;
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (meta?.frameKind !== "meme") continue;

    const rating = typeof meta?.uri === "string" ? ratingFromShape(shape) : "black";
    const color  = tl.color === "rating" ? rating : tl.color;
    updates.push({ id: shape.id, type: "frame", props: { w: tl.w, h: tl.h, color } });
    memeIncludeAhu.set(shape.id,  tl.includeAhu);
    memeShowCarrier.set(shape.id, tl.showCarrier);
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

export function LarariumCanvas({ wsUrl: _wsUrl, navState, dispatch, drawingMode, onZoomLevel }: Props) {
  const editorRef = useRef<TldrawEditor | null>(null);
  const { theme, setEditor, tiddlerStore } = useLararium();

  // Sync tldraw colorScheme when Lararium theme changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const colorScheme = theme === "gruvbox-dark" ? "dark" : theme === "gruvbox-light" ? "light" : "system";
    editor.user.updateUserPreferences({ colorScheme });
  }, [theme]);

  // Store → shape.meta sync — when the Automerge store receives a content change,
  // update the relevant canvas shape's meta.rating so zoom-template colors stay current.
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !tiddlerStore) return;
    return tiddlerStore.subscribe((change) => {
      if (change.origin.kind === "canvas-draft") return;
      if (!change.record || change.record.deleted) return;
      const rating = change.record.fields["rating"];
      if (!rating) return;
      const uri = change.record.title;
      const targets = ed.getCurrentPageShapes().filter((s) => {
        const m = s.meta as Record<string, unknown> | undefined;
        return m?.uri === uri && s.type === "frame" && m?.frameKind === "meme";
      });
      if (targets.length === 0) return;
      ed.updateShapes(
        targets.map((s) => ({ id: s.id, type: s.type, meta: { ...s.meta, rating } })),
      );
    });
  }, [tiddlerStore]);

  // Double-click: geo portal → GO_TO_ROOM, meme frame → ZOOM_IN.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => {
      if (e?.name !== "double_click" || e?.target !== "shape" || e?.phase !== "up") return;
      const shapeId: TLShapeId | undefined = e?.shape?.id;
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
    editor.on("event" as any, handler);
    return () => { editor.off("event" as any, handler); };
  }, [dispatch]);

  // Nav state → tldraw camera.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    syncNavState(editor, navState);
  }, [navState]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={fill}>
      <Tldraw
        components={drawingMode ? CANVAS_COMPONENTS : WIKI_COMPONENTS}
        onMount={(editor) => {
          editorRef.current = editor;
          setEditor(editor);
          debugSet("editor",       editor);
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

          // Canvas write-back — body node text edit → Automerge meme store.
          // Body node shapes (meta.bodyNodeKind, meta.uri) carry carrier text
          // visible at action zoom. When a user edits them in-canvas, the change
          // flows: tldraw CRDT → store.put(canvas-draft) → adaptor → TW5.
          // The adaptor's _applying guard prevents the echo TW5→store loop.
          editor.store.listen(
            (event) => {
              const store = tiddlerStore;
              if (!store) return;
              for (const [, next] of Object.values(event.changes.updated) as [unknown, { type: string; id: string; meta?: Record<string, unknown>; props?: Record<string, unknown> }][]) {
                if (next.type !== "geo") continue;
                const meta = next.meta as Record<string, unknown> | undefined;
                if (!meta?.bodyNodeKind || !meta?.uri) continue;
                const uri  = String(meta.uri);
                const text = String((next.props as Record<string, unknown>)["text"] ?? "");
                store.put(
                  { title: uri, fields: {}, text },
                  { kind: "canvas-draft", shapeId: next.id },
                ).catch((e) => console.warn("[lararium] canvas write-back failed:", e));
              }
            },
            { scope: "document" },
          );
        }}
      />
    </div>
  );
}

const fill = { width: "100%", height: "100%" } as const;
