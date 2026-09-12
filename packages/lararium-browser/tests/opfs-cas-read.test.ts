/**
 * The OPFS CAS read takes the sync leg where the platform offers it, and falls to the async read where
 * it does not — one async face, two legs, byte-equal bytes against the CID either way.
 *
 * `createSyncAccessHandle` exists only in a dedicated worker — exactly where the island runs. A read of
 * an immutable content-addressed blob needs no lock dance there. The main thread (and an engine without
 * the handle) reads through `getFile().arrayBuffer()` as before. The CID proves both legs took the same
 * bytes: a leg that read short, or read stale, mints a different address.
 */
import { describe, expect, test } from "vitest";
import { cidV1Sha256 } from "@lararium/mesh";

import { readCasFileBytes, type CasFileHandleLike } from "../src/browser-genesis.js";

const payload = new TextEncoder().encode("the breath path carries engine bytes by CID; ".repeat(97));
const cid     = cidV1Sha256(payload);

/** A handle that offers the sync access handle — the dedicated-worker shape. */
function syncHandle(log: string[]): CasFileHandleLike {
  return {
    getFile: async () => { log.push("getFile"); return { arrayBuffer: async () => payload.slice().buffer }; },
    createSyncAccessHandle: async () => {
      log.push("sync:open");
      let closed = false;
      return {
        getSize: () => payload.byteLength,
        read: (buffer: ArrayBufferView, opts?: { at?: number }) => {
          log.push("sync:read");
          const at = opts?.at ?? 0;
          const out = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
          const n = Math.min(out.byteLength, payload.byteLength - at);
          out.set(payload.subarray(at, at + n));
          return n;
        },
        close: () => { log.push("sync:close"); closed = true; },
        get closed() { return closed; },
      };
    },
  };
}

/** A handle without the sync access handle — the main-thread shape, and older engines. */
function asyncOnlyHandle(log: string[]): CasFileHandleLike {
  return {
    getFile: async () => { log.push("getFile"); return { arrayBuffer: async () => payload.slice().buffer }; },
  };
}

describe("the sync leg reads the bytes where the handle offers it", () => {
  test("a handle with createSyncAccessHandle: read via the sync handle, closed after, never getFile", async () => {
    const log: string[] = [];
    const bytes = await readCasFileBytes(syncHandle(log));
    expect(bytes).not.toBeNull();
    expect(cidV1Sha256(bytes!)).toBe(cid);
    expect(log).toEqual(["sync:open", "sync:read", "sync:close"]);
  });

  test("a sync handle that throws on open falls to the async read — the floor, never a null", async () => {
    const log: string[] = [];
    const h = syncHandle(log);
    h.createSyncAccessHandle = async () => { log.push("sync:refused"); throw new DOMException("NoModificationAllowedError"); };
    const bytes = await readCasFileBytes(h);
    expect(cidV1Sha256(bytes!)).toBe(cid);
    expect(log).toEqual(["sync:refused", "getFile"]);
  });
});

describe("CONTROL — the async leg stands where the handle offers no sync access", () => {
  test("a handle without createSyncAccessHandle reads through getFile, byte-equal against the CID", async () => {
    const log: string[] = [];
    const bytes = await readCasFileBytes(asyncOnlyHandle(log));
    expect(cidV1Sha256(bytes!)).toBe(cid);
    expect(log).toEqual(["getFile"]);
  });

  test("against the LIVE main thread: the real OPFS handle offers no sync access here, and the read agrees with the CID", async () => {
    const root = await navigator.storage.getDirectory();
    const dir  = await root.getDirectoryHandle("cas-read-witness", { create: true });
    const fh   = await dir.getFileHandle(cid, { create: true });
    const w    = await (fh as FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }).createWritable();
    await w.write(payload.slice()); await w.close();
    expect(typeof (fh as unknown as { createSyncAccessHandle?: unknown }).createSyncAccessHandle).toBe("undefined");
    const bytes = await readCasFileBytes(fh as unknown as CasFileHandleLike);
    expect(cidV1Sha256(bytes!)).toBe(cid);
  });
});
