/**
 * Boot receipt meta-frame injection tests.
 *
 * Verifies that injectBootReceiptFrame + buildBootReceiptMeta produce a valid
 * hidden frame shape that the browser bridge can discover via the stable shape ID.
 */

import { describe, test, expect } from "@jest/globals";
import {
  injectBootReceiptFrame,
  buildBootReceiptMeta,
  BOOT_RECEIPT_SHAPE_ID,
} from "../src/boot-receipt.js";
import type { LarariumBootReceiptMeta } from "@lararium/core";

const TEST_PAGE_ID   = "page:test_page";
const TEST_ROOM_ID   = "boot-abc123def456789";
const TEST_RECEIPT   = "a".repeat(64); // 64-char hex stand-in for SHA-256

// ---------------------------------------------------------------------------
// buildBootReceiptMeta
// ---------------------------------------------------------------------------

describe("buildBootReceiptMeta", () => {
  test("produces correct id and typeName", () => {
    const meta = buildBootReceiptMeta({ roomId: TEST_ROOM_ID, receiptHash: TEST_RECEIPT });
    expect(meta.id).toBe("lararium:boot-receipt");
    expect(meta.typeName).toBe("lararium:room-meta");
  });

  test("copies roomId and receiptHash", () => {
    const meta = buildBootReceiptMeta({ roomId: TEST_ROOM_ID, receiptHash: TEST_RECEIPT });
    expect(meta.roomId).toBe(TEST_ROOM_ID);
    expect(meta.receiptHash).toBe(TEST_RECEIPT);
  });

  test("defaults to local-operator authority mode", () => {
    const meta = buildBootReceiptMeta({ roomId: TEST_ROOM_ID, receiptHash: TEST_RECEIPT });
    expect(meta.authorityMode).toBe("local-operator");
  });

  test("issuedAt is a valid ISO date string when not provided", () => {
    const meta = buildBootReceiptMeta({ roomId: TEST_ROOM_ID, receiptHash: TEST_RECEIPT });
    expect(() => new Date(meta.issuedAt)).not.toThrow();
    expect(new Date(meta.issuedAt).toISOString()).toBe(meta.issuedAt);
  });

  test("accepts custom issuedAt", () => {
    const fixed = "2026-04-28T00:00:00.000Z";
    const meta = buildBootReceiptMeta({ roomId: TEST_ROOM_ID, receiptHash: TEST_RECEIPT, issuedAt: fixed });
    expect(meta.issuedAt).toBe(fixed);
  });

  test("Brooklyn compat: issuer/subject/capability/proofs/graph are absent by default", () => {
    const meta = buildBootReceiptMeta({ roomId: TEST_ROOM_ID, receiptHash: TEST_RECEIPT });
    expect(meta.issuer).toBeUndefined();
    expect(meta.subject).toBeUndefined();
    expect(meta.capability).toBeUndefined();
    expect(meta.proofs).toBeUndefined();
    expect(meta.graph).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// injectBootReceiptFrame
// ---------------------------------------------------------------------------

describe("injectBootReceiptFrame", () => {
  function makeReceipt(): LarariumBootReceiptMeta {
    return buildBootReceiptMeta({ roomId: TEST_ROOM_ID, receiptHash: TEST_RECEIPT });
  }

  test("injects shape under stable BOOT_RECEIPT_SHAPE_ID key", () => {
    const store: Record<string, unknown> = {};
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    expect(store[BOOT_RECEIPT_SHAPE_ID]).toBeDefined();
  });

  test("injected shape has typeName=shape and type=frame", () => {
    const store: Record<string, unknown> = {};
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    const shape = store[BOOT_RECEIPT_SHAPE_ID] as Record<string, unknown>;
    expect(shape["typeName"]).toBe("shape");
    expect(shape["type"]).toBe("frame");
  });

  test("shape is hidden: opacity=0 and isLocked=true", () => {
    const store: Record<string, unknown> = {};
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    const shape = store[BOOT_RECEIPT_SHAPE_ID] as Record<string, unknown>;
    expect(shape["opacity"]).toBe(0);
    expect(shape["isLocked"]).toBe(true);
  });

  test("shape is off-screen: x and y at -999999", () => {
    const store: Record<string, unknown> = {};
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    const shape = store[BOOT_RECEIPT_SHAPE_ID] as Record<string, unknown>;
    expect(shape["x"]).toBe(-999999);
    expect(shape["y"]).toBe(-999999);
  });

  test("parentId set to provided pageId", () => {
    const store: Record<string, unknown> = {};
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    const shape = store[BOOT_RECEIPT_SHAPE_ID] as Record<string, unknown>;
    expect(shape["parentId"]).toBe(TEST_PAGE_ID);
  });

  test("meta carries frameKind=lararium-meta and metaKind=boot-receipt", () => {
    const store: Record<string, unknown> = {};
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    const shape = store[BOOT_RECEIPT_SHAPE_ID] as Record<string, unknown>;
    const meta  = shape["meta"] as Record<string, unknown>;
    expect(meta["frameKind"]).toBe("lararium-meta");
    expect(meta["metaKind"]).toBe("boot-receipt");
  });

  test("meta contains receiptHash from LarariumBootReceiptMeta", () => {
    const store: Record<string, unknown> = {};
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    const shape = store[BOOT_RECEIPT_SHAPE_ID] as Record<string, unknown>;
    const meta  = shape["meta"] as Record<string, unknown>;
    expect(meta["receiptHash"]).toBe(TEST_RECEIPT);
  });

  test("meta contains authorityMode from LarariumBootReceiptMeta", () => {
    const store: Record<string, unknown> = {};
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    const shape = store[BOOT_RECEIPT_SHAPE_ID] as Record<string, unknown>;
    const meta  = shape["meta"] as Record<string, unknown>;
    expect(meta["authorityMode"]).toBe("local-operator");
  });

  test("idempotent: second call overwrites, does not duplicate", () => {
    const store: Record<string, unknown> = {};
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    const shapeKeys = Object.keys(store).filter((k) => k === BOOT_RECEIPT_SHAPE_ID);
    expect(shapeKeys).toHaveLength(1);
  });

  test("does not disturb other records already in store", () => {
    const store: Record<string, unknown> = {
      "page:existing": { id: "page:existing", typeName: "page" },
      "shape:meme_1":  { id: "shape:meme_1",  typeName: "shape" },
    };
    injectBootReceiptFrame(store, { pageId: TEST_PAGE_ID, receipt: makeReceipt() });
    expect(store["page:existing"]).toBeDefined();
    expect(store["shape:meme_1"]).toBeDefined();
  });
});
