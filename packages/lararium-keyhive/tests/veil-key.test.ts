import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import * as keyhive from "../src/index.js";

test("keyhive exports no place-seed veil derivation", () => {
  expect("veilFromDeviceKey" in keyhive).toBe(false);
  expect("deriveVeilFromDeviceKey" in keyhive).toBe(false);
  expect("mintDeviceMintedKey" in keyhive).toBe(false);
});

test("no keyhive source calls a place-seed veil derivation", () => {
  const dir = new URL("../src/", import.meta.url).pathname;
  const callers = readdirSync(dir).filter((f) => f.endsWith(".ts"))
    .filter((f) => /\b(?:deriveDyadVeil|deriveVeilFromDeviceKey|veilFromDeviceKey)\s*\(/.test(readFileSync(join(dir, f), "utf8")));
  expect(callers).toEqual([]);
});
