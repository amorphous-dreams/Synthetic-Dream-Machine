import { describe, test, expect } from "@jest/globals";
import { MemeStreamParser } from "../src/meme-stream.js";

// Minimal carrier fixture using the HTML entity forms the parser regexes match.
// Real .md carrier files on disk use these exact string forms (not raw control chars).
const URI = "lar:///ha.ka.ba/api/v0.1/lararium/templates/meme-strategic";
const CARRIER = [
  `<!-- <<~ !DOCTYPE = ${URI} >> -->`,
  ``,
  `<<~&#x0001; ? -> ${URI} >>`,
  ``,
  `<<~ ahu #iam >>`,
  "```toml",
  `uri-path     = "ha.ka.ba/api/v0.1/lararium/templates/meme-strategic"`,
  `content-type = "text/x-memetic-wikitext"`,
  `kumu-name    = "meme-strategic"`,
  "```",
  `<<~/ahu >>`,
  ``,
  `<<~&#x0002;>>`,
  ``,
  `<<~ ahu #body >>`,
  `Some body text.`,
  `<<~/ahu >>`,
  ``,
  `<<~&#x0003;>>`,
  `<<~ -> ? >>`,
].join("\n");

describe("MemeStreamParser", () => {
  test("batch push — emits carrier-open, ahu-child (body), carrier-close", () => {
    const parser = new MemeStreamParser();
    const events = parser.push(CARRIER);

    const open = events.find((e) => e.kind === "carrier-open");
    expect(open).toBeDefined();
    expect((open as any).uri).toBe(URI);

    // #iam is in the header (before STX) — not emitted as ahu-child
    // #body is in the body — should be emitted
    const children = events.filter((e) => e.kind === "ahu-child");
    expect(children.length).toBeGreaterThanOrEqual(1);
    expect((children[0] as any).slot).toBe("#body");

    const close = events.find((e) => e.kind === "carrier-close");
    expect(close).toBeDefined();
    expect((close as any).uri).toBe(URI);
    // fullText should include the SOH sigil and the full carrier body
    expect((close as any).fullText).toContain("&#x0001;");
    expect((close as any).fullText).toContain("kumu-name");
  });

  test("fullText in carrier-close spans SOH→ETX (includes #iam TOML)", () => {
    const parser = new MemeStreamParser();
    const events = parser.push(CARRIER);
    const close = events.find((e) => e.kind === "carrier-close") as any;
    expect(close.fullText).toContain("kumu-name");
    expect(close.fullText).toContain("Some body text");
  });

  test("chunk streaming — same event kinds regardless of chunk size", () => {
    const fullEvents = new MemeStreamParser().push(CARRIER);
    const fullKinds  = fullEvents.map((e) => e.kind);

    // Split into single-character chunks
    const byteParser = new MemeStreamParser();
    const byteEvents: any[] = [];
    for (const ch of CARRIER) byteEvents.push(...byteParser.push(ch));
    byteEvents.push(...byteParser.flush());

    expect(byteEvents.map((e: any) => e.kind)).toEqual(fullKinds);
  });

  test("two carriers in sequence — both parsed", () => {
    const URI2 = URI.replace("meme-strategic", "meme-operational");
    const CARRIER2 = CARRIER.replace(new RegExp(URI, "g"), URI2);
    const parser = new MemeStreamParser();
    const events = parser.push(CARRIER + "\n" + CARRIER2);
    expect(events.filter((e) => e.kind === "carrier-open").length).toBe(2);
    expect(events.filter((e) => e.kind === "carrier-close").length).toBe(2);
  });

  test("realm-done emitted after final EOT with empty remaining buffer", () => {
    const parser = new MemeStreamParser();
    const events = parser.push(CARRIER);
    expect(events.some((e) => e.kind === "realm-done")).toBe(true);
  });
});
