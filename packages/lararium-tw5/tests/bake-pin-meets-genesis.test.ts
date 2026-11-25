/**
 * bake-pin-meets-genesis — the vendor bake's core pin names the engine the genesis seed names.
 *
 * `build-tw5-vendor` writes the core blob and `TW5_CORE_SHA256` in one pass, so a CI rebuild that bakes other bytes rewrites the
 * pin beside them and every vendored-core boot vouches for itself. The tracked genesis seed names the engine every founded vessel
 * boots; holding the bake's pin to that row keeps the pin an outside witness: a bake that drifts from genesis reads red here until
 * someone bakes genesis on purpose (`tools/genesis-parity-witness.sh`) or the drift is cured.
 */
import { describe, expect, test } from "vitest";
import { genesisCoreBlob, genesisNote, genesisSkip } from "./genesis-boot.harness.js";
import { TW5_CORE_SHA256 } from "../src/generated-tw5-version.js";

describe.skipIf(genesisSkip)(`the bake's core pin${genesisNote}`, () => {
  test("TW5_CORE_SHA256 equals the genesis seed's tiddlywikicore sha256", () => {
    expect(TW5_CORE_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(TW5_CORE_SHA256, "the vendor bake moved past the engine genesis names").toBe(genesisCoreBlob().sha256);
  });
});
