/**
 * MemeStreamParser — carrier stream protocol tests.
 *
 * Carrier framing uses HTML-entity control sigils:
 *   &#x0001; SOH  — opens a carrier, declares lar:/// URI
 *   &#x0002; STX  — header → body boundary (root TOML #meta begins the body)
 *   &#x0003; ETX  — body done (carrier close)
 *   &#x0004; EOT  — carrier exit (optional tail)
 *
 * <<~ ahu #slot>> ... <<~/ahu>> sections arrive as ahu-child events.
 *
 * Parser stays isomorphic — no fs/DOM/TW5 dependencies.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */

import { describe, test, expect } from "vitest";
import { MemeStreamParser } from "../src/meme-stream.js";
import { CARRIER_DECLARATION as DECLARATION } from "@lararium/memetic-frame";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const URI = "lar:///ha.ka.ba/lares/api/mu";

const FULL_CARRIER = [
  DECLARATION,
  ``,
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>`,
  ``,
  `<<^ code="&#x0002;">>`,
  ``,
  "```toml meta",
  `uri-path = "ha.ka.ba/lares/api/mu"`,
  `type     = "text/memetic-wikitext+tiddlywiki"`,
  "```",
  ``,
  `<<~ ahu #/spine>>`,
  `Core invariants.`,
  `<<~/ahu>>`,
  ``,
  `<<~ ahu #/edges>>`,
  `<<~ pranala ? -> lar:///AGENTS family=control role=implements>>`,
  `<<~/ahu>>`,
  ``,
  `<<^ code="&#x0003;">>`,
  `<<^ code="&#x0004;" -> to="?">>`,
].join("\n");

// ---------------------------------------------------------------------------
// Full carrier round-trip
// ---------------------------------------------------------------------------

describe("MemeStreamParser — full carrier", () => {
  test("emits carrier-open with correct URI", () => {
    const parser = new MemeStreamParser();
    const events = parser.push(FULL_CARRIER);
    const open   = events.find((e) => e.kind === "carrier-open");
    expect(open).toBeDefined();
    expect((open as { kind: "carrier-open"; uri: string }).uri).toBe(URI);
  });

  test("emits carrier-close with correct URI", () => {
    const events = new MemeStreamParser().push(FULL_CARRIER);
    const close  = events.find((e) => e.kind === "carrier-close");
    expect(close).toBeDefined();
    expect((close as { kind: "carrier-close"; uri: string; fullText: string }).uri).toBe(URI);
  });

  test("carrier-close fullText spans SOH → ETX", () => {
    const events = new MemeStreamParser().push(FULL_CARRIER);
    const close  = events.find((e) => e.kind === "carrier-close") as { fullText: string } | undefined;
    expect(close?.fullText).toContain("&#x0001;");
    expect(close?.fullText).toContain("&#x0003;");
  });

  test("emits ahu-child for each ahu section in the body", () => {
    const events   = new MemeStreamParser().push(FULL_CARRIER);
    const children = events.filter((e) => e.kind === "ahu-child");
    expect(children.length).toBeGreaterThanOrEqual(2); // #spine and #edges
  });

  test("ahu-child carries slot name and body text", () => {
    const events  = new MemeStreamParser().push(FULL_CARRIER);
    const spine   = events.find(
      (e) => e.kind === "ahu-child" && (e as { slot: string }).slot === "#/spine",
    ) as { slot: string; bodyText: string } | undefined;
    expect(spine).toBeDefined();
    expect(spine?.bodyText).toContain("Core invariants");
  });

  test("root TOML #meta stays in the root body — not emitted as ahu-child body", () => {
    const events   = new MemeStreamParser().push(FULL_CARRIER);
    const children = events.filter((e) => e.kind === "ahu-child");
    const slots    = children.map((e) => (e as { slot: string }).slot);
    expect(slots).not.toContain("#/meta");
  });
});

// ---------------------------------------------------------------------------
// Streaming incremental push
// ---------------------------------------------------------------------------

describe("MemeStreamParser — incremental streaming", () => {
  test("events appear after push containing the closing marker", () => {
    const parser = new MemeStreamParser();
    // Push the opening portion — no carrier-close yet
    const partial = [
      `<<^ code="&#x0001;" from="?" -> to="${URI}">>`,
      `<<^ code="&#x0002;">>`,
      `<<~ ahu #body>>`,
      `body text`,
      `<<~/ahu>>`,
    ].join("\n");
    const mid = parser.push(partial);
    expect(mid.some((e) => e.kind === "carrier-close")).toBe(false);

    // Push the closing portion
    const tail = "\n<<^ code=\"&#x0003;\">>\n<<^ code=\"&#x0004;\" -> to=\"?\">>";
    const final = parser.push(tail);
    expect(final.some((e) => e.kind === "carrier-close")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Minimal carrier — no ahu sections
// ---------------------------------------------------------------------------

describe("MemeStreamParser — minimal carrier (no ahu body)", () => {
  test("emits open and close for a data carrier with no ahu body", () => {
    const URI2   = "lar:///ha.ka.ba/lares/api/pono/invariant";
    const minimal = [
      `<<^ code="&#x0001;" from="?" -> to="${URI2}">>`,
      `<<^ code="&#x0002;">>`,
      `<<^ code="&#x0003;">>`,
    ].join("\n");
    const events = new MemeStreamParser().push(minimal);
    expect(events.some((e) => e.kind === "carrier-open")).toBe(true);
    expect(events.some((e) => e.kind === "carrier-close")).toBe(true);
    expect(events.filter((e) => e.kind === "ahu-child")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// EOT retires the speaking head and the bare return-throat (J4) — the frame locked to `<<^`
// (action-handler.ts's CARRIER_SOH never admits `<<~`); an EOT reader that still did would close a
// carrier on a speaking-head sigil or a bare arrow with no code at all, silently, exactly the
// detection-blindness classifier-decides.test.ts exists to catch on the SOH side.
// ---------------------------------------------------------------------------

describe("MemeStreamParser — EOT reads the control head only, never the speaking one", () => {
  const openBody = (uri: string) => [
    `<<^ code="&#x0001;" from="?" -> to="${uri}">>`,
    `<<^ code="&#x0002;">>`,
    `body text`,
  ].join("\n");

  test("a bare return-throat (<<~ -> \"?\">>) never closes a carrier", () => {
    const uri    = "lar:///ha.ka.ba/lares/api/pono/invariant";
    const text   = `${openBody(uri)}\n<<~ -> "?">>`;
    const events = new MemeStreamParser().push(text);
    expect(events.some((e) => e.kind === "carrier-open")).toBe(true);
    expect(events.some((e) => e.kind === "carrier-close")).toBe(false);
  });

  test("the speaking head's own EOT spelling (<<~ code=\"&#x0004;\">>) never closes a carrier", () => {
    const uri    = "lar:///ha.ka.ba/lares/api/pono/invariant";
    const text   = `${openBody(uri)}\n<<~ code="&#x0004;" -> "?">>`;
    const events = new MemeStreamParser().push(text);
    expect(events.some((e) => e.kind === "carrier-open")).toBe(true);
    expect(events.some((e) => e.kind === "carrier-close")).toBe(false);
  });

  test("a canonical control-head EOT (<<^ code=\"&#x0004;\">>) still closes the carrier", () => {
    const uri    = "lar:///ha.ka.ba/lares/api/pono/invariant";
    const text   = `${openBody(uri)}\n<<^ code="&#x0004;" -> to="?">>`;
    const events = new MemeStreamParser().push(text);
    expect(events.some((e) => e.kind === "carrier-open")).toBe(true);
    expect(events.some((e) => e.kind === "carrier-close")).toBe(true);
  });
});
