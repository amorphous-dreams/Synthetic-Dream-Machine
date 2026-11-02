/**
 * glass-no-promote-route — the mirror's message handlers and the page's port roads name no promote verb: nothing the page's content can
 * send (a `tm-*` message, a widget action, a port record) reaches the promote api. A weld test over the sources.
 * Meme: lar:///ha.ka.ba/lararium/tw5/glass-mirror
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTE = /promote\.(api|claim)|promoteCommand|promotePanelApi|claimablePromoteApi|claimPanel|kapae-(raise|lower)|promote-(commit|drop|orphan)|\.claim\(\)/;
const dir = (rel: string) => join(new URL(".", import.meta.url).pathname, "..", rel);
const sources = (rel: string, re: RegExp) => readdirSync(dir(rel)).filter((f) => re.test(f)).map((f) => [join(rel, f), readFileSync(join(dir(rel), f), "utf8")] as const);

describe("the mirror reaches no promote verb", () => {
  test("RED: no glass or port-road source names a promote verb or the claim door; CONTROL: the scan reads real sources (the mirror and the census are among them)", () => {
    const tw5 = sources("src", /^glass-.*\.ts$/);
    const web = sources("../lararium-web/src/glass", /\.ts$/).concat(sources("../lararium-web/src", /^(page-mirror|page-port|port-transport|projection-sink|wiki-coherence-sink)\.ts$/));
    expect(tw5.map(([f]) => f)).toContain("src/glass-mirror.ts");
    expect(web.length).toBeGreaterThan(4);
    for (const [file, text] of [...tw5, ...web]) expect(ROUTE.test(text), file).toBe(false);
  });
});
