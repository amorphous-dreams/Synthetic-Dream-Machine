/**
 * boot-receipt — injectBootReceiptFrame
 *
 * Injects a hidden tldraw frame shape carrying LarariumBootReceiptMeta into
 * the room snapshot store dict.  Called by serve.ts before the snapshot is
 * sealed into SQLiteSyncStorage.
 *
 * The frame is a transitional metadata carrier:
 *   - opacity 0, isLocked true, position far off-screen (-999999, -999999)
 *   - stable shape ID "shape:lararium_boot_receipt" — idempotent across reseeds
 *   - typeName "shape" so tldraw CRDT carries it without schema changes
 *   - meta.frameKind = "lararium-meta", meta.metaKind = "boot-receipt"
 *
 * Browser clients discover it via:
 *   editor.store.get("shape:lararium_boot_receipt" as TLShapeId)
 * or by scanning allRecords() for meta.metaKind === "boot-receipt".
 */

import type { LarariumBootReceiptMeta } from "@lararium/core";

export const BOOT_RECEIPT_SHAPE_ID = "shape:lararium_boot_receipt";

export interface BootReceiptInjectionOpts {
  /** ID of the page this shape belongs to (must exist in snapshot). */
  pageId:        string;
  /** Full receipt metadata to embed in shape.meta. */
  receipt:       LarariumBootReceiptMeta;
}

/**
 * Inject one hidden boot-receipt frame into a tldraw snapshot store dict.
 * Mutates `store` in place (same pattern as serve.ts snapshot building).
 * Safe to call multiple times — stable ID means it overwrites, not duplicates.
 */
export function injectBootReceiptFrame(
  store:   Record<string, unknown>,
  opts:    BootReceiptInjectionOpts,
): void {
  const r = opts.receipt;
  store[BOOT_RECEIPT_SHAPE_ID] = {
    id:       BOOT_RECEIPT_SHAPE_ID,
    typeName: "shape",
    type:     "frame",
    x:        -999999,
    y:        -999999,
    rotation: 0,
    // "a1" is the smallest valid tldraw fractional index value.
    index:    "a1",
    parentId: opts.pageId,
    isLocked: true,
    opacity:  0,
    props:    { w: 1, h: 1, name: "lararium:boot-receipt", color: "grey" },
    meta: {
      frameKind:     "lararium-meta",
      metaKind:      "boot-receipt",
      // Explicit field spread — exclude id/typeName which conflict with tldraw's schema system.
      roomId:        r.roomId,
      receiptHash:   r.receiptHash,
      issuedAt:      r.issuedAt,
      authorityMode: r.authorityMode,
      ...(r.issuer     !== undefined && { issuer:     r.issuer }),
      ...(r.subject    !== undefined && { subject:    r.subject }),
      ...(r.capability !== undefined && { capability: r.capability }),
      ...(r.proofs     !== undefined && { proofs:     r.proofs }),
      ...(r.graph      !== undefined && { graph:      r.graph }),
    },
  };
}

/**
 * Build a LarariumBootReceiptMeta from serve-time values.
 */
export function buildBootReceiptMeta(opts: {
  roomId:        string;
  receiptHash:   string;
  issuedAt?:     string;
  operatorDid?:  string;   // did:key of the node operator — absent in anonymous local-operator mode
}): LarariumBootReceiptMeta {
  return {
    id:            "lararium:boot-receipt",
    typeName:      "lararium:room-meta",
    roomId:        opts.roomId,
    receiptHash:   opts.receiptHash,
    issuedAt:      opts.issuedAt ?? new Date().toISOString(),
    authorityMode: "local-operator",
    ...(opts.operatorDid && {
      issuer: { kind: "did", id: opts.operatorDid },
    }),
  };
}
