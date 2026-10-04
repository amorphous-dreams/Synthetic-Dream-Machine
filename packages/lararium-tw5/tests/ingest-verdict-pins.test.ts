/**
 * THE GATE'S DECISION, ONE ROW PER DIAGNOSTIC PRODUCER.
 *
 * ingest(bytes) = decide(parse(bytes), verdict(bytes)). Every producer that can move a decision — the
 * frame verdict, the carrier checks, the advisories — owns one row here, so moving a producer from one
 * module to another can never silently change what the gate decides. A row names the decision and the
 * `code:severity` set the decision carries.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { frameCarrier } from "@lararium/memetic-frame";
import { decideIngest } from "../src/ingest-gate.js";

const sha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

const URI  = "lar:///t/pin";
const META = "```toml meta\ntitle    = \"lar:///t/pin\"\ntype     = \"text/memetic-wikitext+tiddlywiki\"\nuri-path = \"t/pin\"\n```";
const canonical = frameCarrier({ head: { uri: URI }, body: `${META}\n\n! Pin\n\n<<~ ahu #/a>>\n\nslot a\n\n<<~/ahu>>` });
const STX = '<<^ code="&#x0002;">>';
const ETX = '<<^ code="&#x0003;">>';
const CHECK = /ni:\/\/\/sha-256;[A-Za-z0-9_-]+/;
const STALE = "ni:///sha-256;0000000000000000000000000000000000000000000";

const BARE      = "just bare data found on the internet\n\nno frame at all\n";
const BARE_TOML = "```toml meta\ncustom = \"lifted\"\n```\n\nbare body\n<<~ ahu #/a>>\n\nslot\n\n<<~/ahu>>\n";

interface Row { readonly text: string; readonly decision: string; readonly codes: readonly string[] }

const ROWS: Record<string, Row> = {
  "a canonical carrier echoes":            { text: canonical, decision: "noop/disk-matches-synced", codes: [] },
  "a stale check alone is framing-only":   { text: canonical.replace(CHECK, STALE), decision: "noop/canonical-equivalent", codes: [] },
  "a stale check over an edit ingests":    { text: canonical.replace("! Pin", "! Pin edited").replace(CHECK, STALE), decision: "ingest", codes: ["block-check-mismatch:warning"] },
  "an absent check is framing-only":       { text: canonical.replace(CHECK, ""), decision: "noop/canonical-equivalent", codes: [] },
  "a torn frame refuses":                  { text: canonical.slice(0, canonical.indexOf(ETX)), decision: "refuse", codes: ["block-check-torn:error"] },
  "a second live ETX refuses":             { text: canonical.replace(ETX, `${ETX}\n\nstray\n\n${ETX}`), decision: "refuse", codes: ["frame-malformed:error", "postamble-content:error"] },
  "an ETX before STX refuses":             { text: canonical.replace(STX, `${ETX}\n${STX}`), decision: "refuse", codes: ["frame-malformed:error"] },
  "content between ETX and EOT refuses":   { text: canonical.replace(/(ni:\/\/\/sha-256;[A-Za-z0-9_-]+)\n/, "$1\nstranded prose\n"), decision: "refuse", codes: ["postamble-content:error"] },
  "an ETX swallowed by a fence refuses":   { text: canonical.replace(`\n${ETX}`, `\n\`\`\`text\n${ETX}`), decision: "refuse", codes: ["block-check-torn:error", "shore-round-trip:error"] },
  "root meta before STX refuses":          { text: canonical.replace(`${STX}\n\n${META}\n`, `${META}\n\n${STX}\n`), decision: "refuse", codes: ["block-check-mismatch:warning", "shore-round-trip:error"] },
  "duplicate root meta refuses":           { text: canonical.replace(STX, `\`\`\`toml meta\ncustom = "x"\n\`\`\`\n\n${STX}`), decision: "refuse", codes: ["shore-round-trip:error", "shore-round-trip:error"] },
  "a title naming another uri refuses":    { text: canonical.replace('title    = "lar:///t/pin"', 'title    = "lar:///t/other"'), decision: "refuse", codes: ["block-check-mismatch:warning", "shore-round-trip:error"] },
  "a uri-path naming another refuses":     { text: canonical.replace('uri-path = "t/pin"', 'uri-path = "t/other"'), decision: "refuse", codes: ["block-check-mismatch:warning", "shore-round-trip:error"] },
  "a root `text` key refuses":             { text: canonical.replace('uri-path = "t/pin"', 'text     = "x"\nuri-path = "t/pin"'), decision: "refuse", codes: ["block-check-mismatch:warning", "shore-round-trip:error"] },
  "a slot `text` key refuses":             { text: canonical.replace("<<~ ahu #/a>>\n", "<<~ ahu #/a>>\n```toml meta\ntext = \"x\"\n```\n"), decision: "refuse", codes: ["block-check-mismatch:warning", "shore-round-trip:error"] },
  "a head-only carrier ingests":           { text: '<<^ code="&#x0001;" from="?" -> to="lar:///t/pin">>\n\nhead only prose\n\n<<^ code="&#x0004;" -> to="?">>\n', decision: "ingest", codes: [] },
  "bare data is held, flagged UNSTABLE":   { text: BARE, decision: "ingest", codes: ["bare-data:warning"] },
  "bare data with a toml fence is held":   { text: BARE_TOML, decision: "ingest", codes: ["bare-data:warning"] },
};

function decide(text: string): { decision: string; codes: string[] } {
  const d = decideIngest({
    uri: URI, diskText: text, diskHash: sha(text),
    syncedHash: sha(canonical), currentRenderHash: sha(canonical), hash: sha,
  });
  return {
    decision: d.kind === "noop" ? `noop/${d.reason}` : d.kind,
    codes: d.kind === "noop" ? [] : d.diagnostics.map((x) => `${x.code}:${x.severity}`).sort(),
  };
}

describe("★ the gate's decision, one row per diagnostic producer ★", () => {
  for (const [name, row] of Object.entries(ROWS)) {
    test(name, () => {
      expect(row.text).not.toBe(name === "a canonical carrier echoes" ? "" : canonical);
      expect(decide(row.text)).toEqual({ decision: row.decision, codes: [...row.codes].sort() });
    });
  }
});

describe("★ bare data is held, never parsed as a meme ★", () => {
  for (const text of [BARE, BARE_TOML]) {
    test(`held verbatim as ONE record — no meta lifted, no slot split: ${JSON.stringify(text.slice(0, 24))}`, () => {
      const d = decideIngest({ uri: URI, diskText: text, diskHash: sha(text), syncedHash: null, currentRenderHash: "none", hash: sha });
      expect(d.kind).toBe("ingest");
      if (d.kind !== "ingest") return;
      expect(d.records).toEqual([{ title: URI, type: "text/plain", text }]);
      expect(d.canonicalText).toBe(text);
      expect(d.diagnostics.map((x) => x.message).join(" ")).toMatch(/UNSTABLE/);
    });
  }

  test("a stale check names BOTH digests on the diagnostic", () => {
    const text = canonical.replace("! Pin", "! Pin edited").replace(CHECK, STALE);
    const d = decideIngest({ uri: URI, diskText: text, diskHash: sha(text), syncedHash: null, currentRenderHash: "none", hash: sha });
    const stale = d.kind === "ingest" ? d.diagnostics.find((x) => x.code === "block-check-mismatch") : undefined;
    expect(stale?.message).toContain(STALE);
    expect(stale?.message).toMatch(/computed ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}/);
  });
});
