/**
 * projectToTldraw — pure projection from a Lararium boot artifact to a tldraw snapshot.
 *
 * No tldraw runtime import. No I/O. No Node APIs.
 * Output is a LarTLSnapshot (data only — no geometry). Layout is computed
 * separately by layout.ts, which reads the snapshot and returns a LarTLLayout.
 */

import { type BootArtifact, scalarToStageBand } from "@lararium/core";
import { parsePranalaEdges } from "@lararium/core";

import {
  type LarTLSnapshot,
  type LarTLPage,
  type LarTLFrame,
  type LarTLSocket,
  type LarTLArrow,
  type LarTLNote,
  type TemplatePropsByLevel,
  memeFrameId,
  ahuFrameId,
  socketShapeId,
  edgeArrowId,
  ownsArrowId,
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

  const frames:  LarTLFrame[]  = [];
  const sockets: LarTLSocket[] = [];
  const notes:   LarTLNote[]   = [];
  const arrows:  LarTLArrow[]  = [];

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
        stage: scalarToStageBand(entry.confidence),
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

      // Ahu socket sub-frames + socket port shapes from pranala edges if readText provided
      if (includeAhuFrames && readText) {
        const text = readText(entry.uri);
        if (text) {
          const edges = parsePranalaEdges(entry.uri, text);
          // Collect all #fragment identifiers that appear as fromSocket or fromSlot
          const slotSet = new Set(
            edges.flatMap((e) => [e.fromSocket, e.fromSlot].filter((s): s is string => !!s && s.includes("#")))
          );
          [...slotSet].forEach((slot, ahuIdx) => {
            const slotName = (slot.split("#")[1] as string | undefined) ?? slot;
            const ahuId = ahuFrameId(entry.uri, slot);
            const sockId = socketShapeId(entry.uri, slot);
            // Ahu sub-frame: visual container visible at high zoom
            frames.push({
              type: "frame",
              id: ahuId,
              scope: "document",
              pageId: page.id,
              parentId: fid,
              uri: slot,
              name: `#${slotName}`,
              depth: depth + 0.5,
              frameKind: "ahu",
              rating: "socket",
              stage: scalarToStageBand(entry.confidence),
              implements: [],
            });
            // Socket port shape: stable arrow binding target, repositioned by applyZoomTemplate
            sockets.push({
              type: "socket",
              id: sockId,
              scope: "document",
              pageId: page.id,
              parentId: fid,
              memeUri: entry.uri,
              slotId: slot,
              ahuIdx,
            });
            // Ownership skeleton: meme → ahu and meme → socket (control:owns, hidden at low zoom)
            arrows.push({
              type: "arrow",
              id: ownsArrowId(fid, ahuId),
              scope: "document",
              pageId: page.id,
              fromFrameId: fid,
              toFrameId: ahuId,
              family: "control",
              role: "owns",
              label: "",
              isOwnership: true,
            });
            arrows.push({
              type: "arrow",
              id: ownsArrowId(fid, sockId),
              scope: "document",
              pageId: page.id,
              fromFrameId: fid,
              toFrameId: sockId,
              family: "control",
              role: "owns",
              label: "",
              isOwnership: true,
            });
          });
        }
      }
    });
  }

  // Build arrows from pranala edges
  if (readText) {
    const knownIds = new Set([...frames.map((f) => f.id), ...sockets.map((s) => s.id)]);

    for (const entry of artifact.closure) {
      const text = readText(entry.uri);
      if (!text) continue;
      const edges = parsePranalaEdges(entry.uri, text);

      for (const edge of edges) {
        // Arrows bind to socket port shapes (stable targets) not ahu sub-frames
        const slotOrSocket = edge.fromSlot ?? (edge.fromSocket.includes("#") ? edge.fromSocket : null);
        const fromId = slotOrSocket
          ? socketShapeId(entry.uri, slotOrSocket)
          : memeFrameId(edge.fromUri);
        const toId = memeFrameId(edge.toUri);

        if (!knownIds.has(fromId) || !knownIds.has(toId)) continue;
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
    pages:   Object.freeze([page]),
    frames:  Object.freeze(frames),
    sockets: Object.freeze(sockets),
    arrows:  Object.freeze(arrows),
    notes:   Object.freeze(notes),
  });
}
