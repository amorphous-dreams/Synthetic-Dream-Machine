/**
 * founding-entry-points — every path that signs a face's founding log pins F in the same act.
 *
 * The weld reads the source: `signFoundingLog` is called from ONE place, `landFaceGenesis` (ceremony-core.ts), whose planes map
 * names `FACE_PLANE`; every founding entry point (`foundTheFace`'s callers) reaches it. A planted path that signs a log without the pin reads red.
 * CONTROL: the real tree reads green, and the detector reads a planted source without `FACE_PLANE` as a fault.
 */
import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../../", import.meta.url).pathname;
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (n === "node_modules" || n === "dist" || n.endsWith(".generated.ts")) return [];
  return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
});

/** Files under `packages/*\/src` that CALL signFoundingLog, and the ones among them whose planes map omits FACE_PLANE. */
export function foundingSigners(sources: ReadonlyMap<string, string>): { callers: string[]; missingPin: string[] } {
  const callers = [...sources].filter(([, text]) => /\bsignFoundingLog\s*\(/.test(text) && !/export async function signFoundingLog/.test(text)).map(([f]) => f);
  const missingPin = callers.filter((f) => !/\[FACE_PLANE\]\s*:/.test(sources.get(f)!));
  return { callers, missingPin };
}

const real = new Map(readdirSync(join(ROOT, "packages")).flatMap((pkg) => {
  const src = join(ROOT, "packages", pkg, "src");
  try { return walk(src).map((f) => [f.slice(ROOT.length), readFileSync(f, "utf8")] as const); } catch { return []; }
}));

describe("every founding signer pins F", () => {
  test("RED: signFoundingLog has callers on the tree and each one names the FACE_PLANE pin", () => {
    const { callers, missingPin } = foundingSigners(real);
    expect(callers.length).toBeGreaterThan(0);
    expect(callers).toEqual(["packages/lararium-keyhive/src/ceremony-core.ts"]);
    expect(missingPin).toEqual([]);
  });
  test("RED: a planted founding path that signs a log with no FACE_PLANE entry reads as missing the pin", () => {
    const planted = new Map(real).set("packages/x/src/planted.ts", "await signFoundingLog({ planes: { persona: u } }, signer);");
    expect(foundingSigners(planted).missingPin).toEqual(["packages/x/src/planted.ts"]);
  });
  test("CONTROL: a planted path that names the pin reads clean", () => {
    const planted = new Map(real).set("packages/x/src/planted.ts", "await signFoundingLog({ planes: { [FACE_PLANE]: f } }, signer);");
    expect(foundingSigners(planted).missingPin).toEqual([]);
  });
});
