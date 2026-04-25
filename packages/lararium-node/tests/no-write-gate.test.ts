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

  test("compileMinimalBoot returns a new object each call", () => {
    const a = runtime.compileMinimalBoot();
    const b = runtime.compileMinimalBoot();
    expect(a).not.toBe(b);
    expect(a.closure).not.toBe(b.closure);
  });

  test("compileMinimalBoot closure entries are frozen (immutable)", () => {
    const artifact = runtime.compileMinimalBoot();
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

  test("compileFullBoot does not share closure array with minimal boot", () => {
    const minimal = runtime.compileMinimalBoot();
    const full = runtime.compileFullBoot();
    expect(minimal.closure).not.toBe(full.closure);
  });

  test("compileBootReceipt does not mutate the artifact it receives", () => {
    const artifact = runtime.compileMinimalBoot();
    const originalCount = artifact.memeCount;
    const originalEntry0Uri = artifact.closure[0].uri;
    runtime.compileBootReceipt(artifact);
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
  test("two minimal boot compiles produce identical receipt hash", () => {
    const a = runtime.compileBootReceipt(runtime.compileMinimalBoot());
    const b = runtime.compileBootReceipt(runtime.compileMinimalBoot());
    expect(a.sha256).toBe(b.sha256);
  });

  test("two full boot compiles produce identical receipt hash", () => {
    const a = runtime.compileBootReceipt(runtime.compileFullBoot());
    const b = runtime.compileBootReceipt(runtime.compileFullBoot());
    expect(a.sha256).toBe(b.sha256);
  });

  test("minimal and full boot produce different receipt hashes", () => {
    const minimal = runtime.compileBootReceipt(runtime.compileMinimalBoot());
    const full = runtime.compileBootReceipt(runtime.compileFullBoot());
    expect(minimal.sha256).not.toBe(full.sha256);
  });
});
