/**
 * k23-identity-slot-burnt — K23 retires: `KeyhiveIdentitySlot` and `deriveActorId` stand nowhere in the packages.
 *
 * The unwired-code review (stable-founding-road K23): production constructed no `KeyhiveIdentitySlot`, and its
 * `deriveActorId` stood orphaned; the self-DID verifier alone binds nothing, and any peer-bound restriction rides `P27`.
 * Lane b5b burns both names with every caller, export and test that served only them.
 *
 *   K1  RED: no source or test file under `packages/` names either.
 *   K0  CONTROL: the scan reaches the files it reads (it finds `IdentitySlot` itself, which stays).
 *
 * Canon: lar:///ha.ka.ba/lares/docs/stable-founding-road (K23)
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGES = fileURLToPath(new URL("../..", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const SKIP = new Set(["node_modules", "dist", ".vitest", "TiddlyWiki5", "coverage"]);

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const at = join(dir, name);
    const st = statSync(at);
    if (st.isDirectory()) sources(at, out);
    else if (/\.(ts|mts|mjs|js)$/.test(name) && at !== SELF) out.push(at);
  }
  return out;
}

describe("K23 retires the Keyhive identity slot", () => {
  const files = sources(PACKAGES);
  test("K0 CONTROL: the scan reads the identity slot's interface, which stays", () => {
    expect(files.some((f) => /\binterface IdentitySlot\b/.test(readFileSync(f, "utf8")))).toBe(true);
  });
  test("K1 RED: no file under packages/ names `KeyhiveIdentitySlot` or `deriveActorId`", () => {
    const named = files.filter((f) => /\bKeyhiveIdentitySlot\b|\bderiveActorId\b/.test(readFileSync(f, "utf8")));
    expect(named.map((f) => f.slice(PACKAGES.length))).toEqual([]);
  });
});
