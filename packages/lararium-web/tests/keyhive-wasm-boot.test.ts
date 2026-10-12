/**
 * The worker boot stands the keyhive wasm from content before any island code runs: a keyhive call throws
 * before `initKeyhiveWasm`, answers after it, and a second boot agrees with the instance already live.
 */
import { describe, expect, test } from "vitest";

describe("keyhive slim wasm boot", () => {
  test("the signer is dead before the worker boot and live after it", async () => {
    const { Signer } = await import("@keyhive/keyhive/slim");
    // CONTROL: nothing has instantiated the wasm in this file's module registry.
    expect(() => Signer.memorySignerFromBytes(new Uint8Array(32))).toThrow();

    const { initKeyhiveWasm } = await import("../src/workers/worker-boot.js");
    await initKeyhiveWasm();
    expect(Signer.memorySignerFromBytes(new Uint8Array(32)).verifyingKey).toHaveLength(32);
    await expect(initKeyhiveWasm()).resolves.toBeUndefined();
  });
});
