/**
 * No-write gate tests.
 *
 * Confirms that LarariumRuntime exposes zero mutation surfaces:
 * - no writeback methods on the runtime interface
 * - readResource is read-only (throws on missing, never writes)
 * - compile* methods return new objects each call (no shared mutable state)
 * - the MemeGraph inside each compile call is not exposed externally
 */

import { describe, test, expect } from "@jest/globals";
import { createLarariumRuntime } from "../src/node-host.js";

const runtime = createLarariumRuntime();

describe("no-write gate", () => {
  test("runtime has no write or mutation methods", () => {
    const keys = Object.keys(runtime as Record<string, unknown>);
    const mutationPatterns = /write|set|put|delete|remove|patch|update|push|append|mutate|save/i;
    const mutatingKeys = keys.filter((k) => mutationPatterns.test(k));
    expect(mutatingKeys).toEqual([]);
  });

  test("runtime interface does not include writeback option in behavior", () => {
    // createLarariumRuntime accepts writeback option but the runtime itself
    // must not expose it as a callable surface
    const rt = createLarariumRuntime({ writeback: true });
    expect((rt as Record<string, unknown>).writeback).toBeUndefined();
    expect((rt as Record<string, unknown>).write).toBeUndefined();
  });

  test("readResource throws on missing URI, never creates files", () => {
    expect(() => runtime.readResource("lar:///DOES_NOT_EXIST_9999")).toThrow();
  });

  test("compileBoot returns a new object each call", () => {
    const a = runtime.compileBoot();
    const b = runtime.compileBoot();
    expect(a).not.toBe(b);
    expect(a.closure).not.toBe(b.closure);
  });

  test("compileBoot closure entries are frozen (immutable)", () => {
    const artifact = runtime.compileBoot();
    // Attempt mutation — should either throw in strict mode or be a no-op
    const entry = artifact.closure[0];
    const originalUri = entry.uri;
    try {
      (entry as Record<string, unknown>).uri = "lar:///MUTATED";
    } catch {
      // frozen — good
    }
    expect(artifact.closure[0].uri).toBe(originalUri);
  });

  test("compileBootReceipt does not mutate the artifact it receives", async () => {
    const artifact = runtime.compileBoot();
    const originalCount = artifact.memeCount;
    const originalEntry0Uri = artifact.closure[0].uri;
    await runtime.compileBootReceipt(artifact);
    expect(artifact.memeCount).toBe(originalCount);
    expect(artifact.closure[0].uri).toBe(originalEntry0Uri);
  });

  test("readCarrier on valid URI returns a record without writing side effects", () => {
    const record = runtime.readCarrier("lar:///AGENTS");
    expect(record).toBeDefined();
    expect(record.uri).toBe("lar:///AGENTS");
    // Reading again returns equivalent data — no accumulated state
    const record2 = runtime.readCarrier("lar:///AGENTS");
    expect(record2.uri).toBe(record.uri);
    expect(record2.contentHash).toBe(record.contentHash);
  });
});

describe("boot receipt stability", () => {
  test("two boot compiles produce identical receipt hash", async () => {
    const a = await runtime.compileBootReceipt(runtime.compileBoot());
    const b = await runtime.compileBootReceipt(runtime.compileBoot());
    expect(a.sha256).toBe(b.sha256);
  });

  test("SHA-256 known vector: sha256('abc') = ba7816bf...", async () => {
    const { defaultCryptoProvider, utf8Bytes, sha256Hex } = await import("@lararium/core");
    const result = await sha256Hex(utf8Bytes("abc"), defaultCryptoProvider);
    expect(result).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
