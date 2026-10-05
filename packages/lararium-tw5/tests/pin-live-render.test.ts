/**
 * pin-live-render — aka/kanawai RENDER BY TARGET, in a live wiki (unit C2, weave roadmap item 1).
 *
 * `aka`'s house template transcluded whatever currently sat at the pin's address, LIVE, inside a
 * `<details>` — that contradicted canon (api/pono/kahea.mem #/head: `aka` holds the PINNED pole).
 * This suite pins the fix: the shared pin template (`templates/pin/html`, reached through the
 * `meme-pin` filter operator) renders a REFERENCE meme as a citation card and a CONTENT slot as the
 * frozen image — the target's current bytes, pinned with its own `ni:` check — exactly the split
 * `readPin`/`weaveAka` already hold for the outward markdown weave (weave.test.ts's LOOP 7 suite).
 * `aka`/`kanawai` differ ONLY in `pin-role` (informative/binding) — operator ruling, loop 7: the
 * SIGIL decides the role, never the target.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */
import { describe, test, expect, beforeAll } from "vitest";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";

const REF_URI = "lar:///t/pin-ref";
const CONTENT_URI = "lar:///t/pin-content";
const NOWHERE_URI = "lar:///t/pin-nowhere";

const refMeme = (uri: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n<<^ code="&#x0002;">>\n\n` +
  "```toml meta\n" +
  'reference-author     = "A. Author"\n' +
  'reference-date       = "January 2024"\n' +
  'reference-kind       = "rfc"\n' +
  'reference-seriesinfo = "Informational"\n' +
  'reference-target     = "https://example.org/ref"\n' +
  'reference-title      = "An Example Reference"\n' +
  `uri-path             = "${uri.replace(/^lar:\/\/\//, "")}"\n` +
  "```\n\n" +
  "! Target body heading — must not render\n\n" +
  '<<^ code="&#x0003;">>ni:///sha-256;REFCHECK\n' +
  '<<^ code="&#x0004;" -> to="?">>\n';

const contentMeme = (uri: string, slotText: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n<<^ code="&#x0002;">>\n\n` +
  "```toml meta\n" +
  `uri-path = "${uri.replace(/^lar:\/\/\//, "")}"\n` +
  "```\n\n" +
  `<<~ ahu #/s>>\n\n! Slot S\n\n${slotText}\n\n<<~/ahu>>\n\n` +
  '<<^ code="&#x0003;">>ni:///sha-256;WHOLECHECK\n' +
  '<<^ code="&#x0004;" -> to="?">>\n';

describe.skipIf(wikiSkip)(`aka/kanawai render by target — reference card or frozen image${skipNote}`, () => {
  let engine: TW5Engine;
  let face: LaresMemeFace;

  beforeAll(async () => {
    engine = await bootTestWiki();
    face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
    await face.place(REF_URI, refMeme(REF_URI));
    await face.place(CONTENT_URI, contentMeme(CONTENT_URI, "Slot s content, version one."));
  });

  const render = (src: string) => renderWikitext(engine, src);

  test("★ (a) aka of a REFERENCE meme renders a citation card — title, author, date, seriesinfo, a link to target — never the target's body ★", () => {
    const html = render(`<<~ aka "${REF_URI}">>`);
    expect(html).toContain("lar-pin-card");
    expect(html).toContain("An Example Reference");
    expect(html).toContain("A. Author");
    expect(html).toContain("January 2024");
    expect(html).toContain("Informational");
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.org\/ref"[^>]*>/);
    expect(html).not.toContain("Target body heading");
  });

  test("★ (b) kanawai of the SAME reference meme renders the same card shape, with the BINDING role ★", () => {
    const html = render(`<<~ kanawai "${REF_URI}">>`);
    expect(html).toContain("lar-pin-card");
    expect(html).toContain("An Example Reference");
    expect(html).toContain("A. Author");
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.org\/ref"[^>]*>/);
    expect(html).toContain("binding");
    expect(html).not.toContain("Target body heading");
  });

  test("★ (c) aka of a CONTENT slot renders the slot's own body plus a badge equal to meme-pin[check] for that slot; editing the slot changes the badge ★", () => {
    const checkNow = (): string =>
      (engine.wiki.filterTiddlers(`[[${CONTENT_URI}#/s]] +[meme-pin[check]]`) as string[])[0] ?? "";

    const before = checkNow();
    expect(before).toMatch(/^ni:\/\/\/sha-256;/);
    const html1 = render(`<<~ aka "${CONTENT_URI}#/s">>`);
    expect(html1).toContain("Slot s content, version one.");
    expect(html1).toContain("lar-pin-digest");
    expect(html1).toContain(before);

    // CONTROL — editing the target slot changes the badge.
    return face.place(CONTENT_URI, contentMeme(CONTENT_URI, "Slot s content, version TWO.")).then(() => {
      const after = checkNow();
      expect(after).toMatch(/^ni:\/\/\/sha-256;/);
      expect(after).not.toBe(before);
      const html2 = render(`<<~ aka "${CONTENT_URI}#/s">>`);
      expect(html2).toContain("Slot s content, version TWO.");
      expect(html2).toContain(after);
      expect(html2).not.toContain(before);
    });
  });

  test("★ (d) pin/law render identically to aka/kanawai ★", () => {
    expect(render(`<<~ pin "${REF_URI}">>`)).toBe(render(`<<~ aka "${REF_URI}">>`));
    expect(render(`<<~ law "${REF_URI}">>`)).toBe(render(`<<~ kanawai "${REF_URI}">>`));
  });

  test("★ (e) an unresolved target renders a clearly marked unresolved line, naming the uri ★", () => {
    const html = render(`<<~ aka "${NOWHERE_URI}">>`);
    expect(html).toContain("lar-pin-unresolved");
    expect(html).toContain("unresolved");
    expect(html).toContain(NOWHERE_URI);
  });

  test("★ (f) meme-pin — an unknown part THROWS, naming the registered parts ★", () => {
    expect(() => engine.wiki.filterTiddlers(`[[${REF_URI}]] +[meme-pin[bogus]]`)).toThrow(/meme-pin.*bogus/);
  });

  test("CONTROL — meme-pin[kind] answers unresolved for a target no record stands at", () => {
    expect((engine.wiki.filterTiddlers(`[[${NOWHERE_URI}]] +[meme-pin[kind]]`) as string[])[0]).toBe("unresolved");
  });

  test("CONTROL — meme-pin[kind] answers reference/content for the two fixtures", () => {
    expect((engine.wiki.filterTiddlers(`[[${REF_URI}]] +[meme-pin[kind]]`) as string[])[0]).toBe("reference");
    expect((engine.wiki.filterTiddlers(`[[${CONTENT_URI}]] +[meme-pin[kind]]`) as string[])[0]).toBe("content");
  });
});
