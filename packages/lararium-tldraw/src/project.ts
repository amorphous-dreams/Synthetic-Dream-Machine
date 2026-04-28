/**
 * projectToTldraw — pure projection from a Lararium boot artifact to a tldraw snapshot.
 *
 * No tldraw runtime import. No I/O. No Node APIs.
 * Output is a LarTLSnapshot (data only — no geometry). Layout is computed
 * separately by layout.ts, which reads the snapshot and returns a LarTLLayout.
 */

import { type BootArtifact } from "@lararium/core";
import { parsePranalaEdges } from "@lararium/core";

import {
  type LarTLSnapshot,
  type LarTLPage,
  type LarTLFrame,
  type LarTLArrow,
  type LarTLNote,
  type TemplatePropsByLevel,
  memeFrameId,
  ahuFrameId,
  edgeArrowId,
  pageId,
  buildTemplatePropsByLevel,
} from "./records.js";

// ---------------------------------------------------------------------------
// projectToTldraw
// ---------------------------------------------------------------------------

export interface ProjectOptions {
  /** Include ahu socket sub-frames. Default: true. */
  includeAhuFrames?: boolean;
  /** Include carrier metadata notes. Default: false (verbose). */
  includeNotes?: boolean;
  /** Read carrier text for edge extraction (uri → text). Required for arrows. */
  readText?: (uri: string) => string | null;
  /** KumuRegistry — when provided, reads meme-* template defs to build templateProps. */
  registry?: { get(name: string): import("@lararium/core").KumuDef | undefined };
}

export function projectToTldraw(artifact: BootArtifact, opts: ProjectOptions = {}): LarTLSnapshot {
  const {
    includeAhuFrames = true,
    includeNotes = false,
    readText,
    registry,
  } = opts;

  const templateProps: TemplatePropsByLevel | undefined = registry
    ? buildTemplatePropsByLevel(registry)
    : undefined;

  const page: LarTLPage = {
    type: "page",
    id: pageId(artifact.artifact),
    scope: "document",
    name: "Boot",
    compiledAt: artifact.compiledAt,
    memeCount: artifact.memeCount,
  };

  // Group closure entries by depth for layout
  const byDepth = new Map<number, typeof artifact.closure>();
  for (const entry of artifact.closure) {
    const band = byDepth.get(entry.depth) ?? [];
    band.push(entry);
    byDepth.set(entry.depth, band);
  }

  const frames: LarTLFrame[] = [];
  const notes: LarTLNote[] = [];
  const arrows: LarTLArrow[] = [];

  // Build meme frames
  for (const [depth, band] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    band.forEach((entry) => {
      const fid = memeFrameId(entry.uri);
      const lastSegment = entry.uri.split("/").at(-1) ?? entry.uri;

      const carrierText = readText ? (readText(entry.uri) ?? undefined) : undefined;
      frames.push({
        type: "frame",
        id: fid,
        scope: "document",
        pageId: page.id,
        parentId: null,
        uri: entry.uri,
        name: lastSegment,
        depth,
        frameKind: "meme",
        rating: entry.kind,
        implements: entry.implements,
        ...(carrierText !== undefined && { carrierText }),
        ...(templateProps !== undefined && { templateProps }),
      });

      // Metadata note inside frame
      if (includeNotes && entry.exists) {
        const noteLines = [
          `uri: ${entry.uri}`,
          `kind: ${entry.kind}`,
          entry.implements.length > 0 ? `implements: ${entry.implements.join(", ")}` : null,
        ].filter(Boolean).join("\n");

        notes.push({
          type: "note",
          id: `shape:note_${fid.replace(/^shape:/, "")}` as `shape:${string}`,
          scope: "document",
          pageId: page.id,
          parentFrameId: fid,
          text: noteLines,
        });
      }

      // Ahu socket sub-frames from pranala edges if readText provided
      if (includeAhuFrames && readText) {
        const text = readText(entry.uri);
        if (text) {
          const edges = parsePranalaEdges(entry.uri, text);
          // fromSlot = named outgoing slot on the ahu; fromSocket = the ahu itself
          const sockets = new Set(
            edges.flatMap((e) => [e.fromSocket, e.fromSlot].filter((s): s is string => !!s && s.includes("#")))
          );
          [...sockets].forEach((socket, sockIdx) => {
            const socketName = (socket.split("#")[1] as string | undefined) ?? socket;
            frames.push({
              type: "frame",
              id: ahuFrameId(entry.uri, socket),
              scope: "document",
              pageId: page.id,
              parentId: fid,
              uri: socket,
              name: `#${socketName}`,
              depth: depth + 0.5,
              frameKind: "ahu",
              rating: "socket",
              implements: [],
            });
            void sockIdx; // layout handled by tldraw itself for child frames
          });
        }
      }
    });
  }

  // Build arrows from pranala edges
  if (readText) {
    const frameIds = new Set(frames.map((f) => f.id));

    for (const entry of artifact.closure) {
      const text = readText(entry.uri);
      if (!text) continue;
      const edges = parsePranalaEdges(entry.uri, text);

      for (const edge of edges) {
        // Prefer the named slot frame; fall back to the ahu socket frame; then meme frame
        const slotOrSocket = edge.fromSlot ?? (edge.fromSocket.includes("#") ? edge.fromSocket : null);
        const fromId = slotOrSocket
          ? ahuFrameId(entry.uri, slotOrSocket)
          : memeFrameId(edge.fromUri);
        const toId = memeFrameId(edge.toUri);

        if (!frameIds.has(fromId) || !frameIds.has(toId)) continue;
        if (fromId === toId) continue; // skip self-loops

        const arrowId = edgeArrowId(edge.fromSocket, edge.toUri);
        // Deduplicate arrows
        if (!arrows.some((a) => a.id === arrowId)) {
          arrows.push({
            type: "arrow",
            id: arrowId,
            scope: "document",
            pageId: page.id,
            fromFrameId: fromId,
            toFrameId: toId,
            family: edge.family,
            role: edge.role,
            label: edge.label,
          });
        }
      }
    }
  }

  return Object.freeze({
    version: 1 as const,
    projectedAt: new Date().toISOString(),
    pages: Object.freeze([page]),
    frames: Object.freeze(frames),
    arrows: Object.freeze(arrows),
    notes: Object.freeze(notes),
  });
}
