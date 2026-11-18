/**
 * canon-mounts-after-ea — the face's daemon canon never holds an island's boot on its own door.
 *
 * The canon (`recipe.canonBag`) rests sealed under the face, and its values open only through the island's document-store
 * door, which stands with the island's holder at `onEa`. A boot that resolved it among the pre-ea slots waited on itself on
 * every restart (e2e `kahua-founding-stage` CONTROL: the slot "never arrived over syncPort", the unlock refused). The kernel
 * defers it and mounts it once ea has gone out. Static: the order lives in one function body.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const kernel = readFileSync(new URL("../src/sovereign-kernel.ts", import.meta.url), "utf8");

describe("the face's canon mounts after ea", () => {
  test("RED (static): the pre-ea slot loop defers the canon slot, and its mount runs after ea is sent", () => {
    const loop = kernel.slice(kernel.indexOf("for (const slot of slots) {"), kernel.indexOf('tick("slot-ready")'));
    expect(loop).toMatch(/slot === msg\.recipe\.canonBag\) \{ deferredCanon = \{ slot, url: docUrl \}; continue; \}/);
    const ea = kernel.indexOf("handler.sendEa(msg.wikiUri);");
    const mount = kernel.indexOf("void _mountDeferredCanon(");
    expect(ea).toBeGreaterThan(0);
    expect(mount).toBeGreaterThan(ea);
  });
});
