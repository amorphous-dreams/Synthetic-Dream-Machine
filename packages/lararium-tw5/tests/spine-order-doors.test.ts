/**
 * A FRAME OUT OF SPINE ORDER HOLDS VERBATIM AT EVERY DOOR, AND THE GATE REFUSES IT.
 *
 * memetic-wikitext-framing #/carrier-spine: SOH, STX, ETX, EOT "in this order"; a release standing
 * before the text closes, or a second heading inside the first carrier's frame, is a frame no reader
 * divides without choosing — the frame verdict names it torn. The registered deserializer (every TW5
 * door, every bag door through it) then holds the bytes as ONE flagged record rather than dividing
 * them one way or another, and the Confluence gate refuses on the frame's own grade.
 *
 * CONTROL: the same carrier in spine order decomposes and ingests.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { stampCarrier } from "@lararium/memetic-frame";
import { memeticWikitextDeserializer, TORN_FIELD, BARE_DATA_TYPE } from "../src/deserializer.js";
import { decideIngest } from "../src/ingest-gate.js";

const URI = "lar:///t/spine-doors";
const HEAD = (uri: string) => `<<^ code="&#x0001;" from="?" -> to="${uri}">>`;
const STX = '<<^ code="&#x0002;">>';
const EOT = '<<^ code="&#x0004;" -> to="?">>';
const carrier = (body: string, head = HEAD(URI)): string => stampCarrier(
  `${head}\n${STX}\n\n\`\`\`toml meta\nuri-path = "${URI.slice(7)}"\n\`\`\`\n\n${body}\n\n<<^ code="&#x0003;">>\n\n${EOT}\n`);
const SOUND = carrier("<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\nprose");

const OUT_OF_ORDER: Record<string, string> = {
  "EOT inside the text":  carrier(`prose\n\n${EOT}\n\nbytes the check covers`),
  "EOT before STX":       carrier("prose", `${HEAD(URI)}\n${EOT}`),
  "SOH inside the text":  carrier(`prose\n\n${HEAD("lar:///t/phantom")}\n\nmore prose`),
  "SOH before STX":       carrier("prose", `${HEAD(URI)}\n${HEAD("lar:///t/phantom")}`),
};

const sha = (s: string): string => `sha256:${createHash("sha256").update(s).digest("hex")}`;
const decide = (text: string) => decideIngest({
  uri: URI, diskText: text, diskHash: sha(text), syncedHash: null, currentRenderHash: sha("records"), hash: sha,
});

describe("★ spine order at the doors — held verbatim, refused at the gate ★", () => {
  for (const [name, text] of Object.entries(OUT_OF_ORDER)) {
    test(`${name}: the deserializer holds ONE record, verbatim, flagged torn`, () => {
      const records = memeticWikitextDeserializer(text, { title: URI });
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ title: URI, type: BARE_DATA_TYPE, text });
      expect(String(records[0]![TORN_FIELD])).toMatch(/spine|EOT|heading/);
    });

    test(`${name}: the gate refuses on the frame's own grade`, () => {
      const decision = decide(text);
      expect(decision.kind).toBe("refuse");
      expect(decision.kind === "refuse" && decision.diagnostics.map((d) => d.code)).toContain("frame-malformed");
    });
  }

  test("CONTROL — the carrier in spine order decomposes and ingests", () => {
    const records = memeticWikitextDeserializer(SOUND, { title: URI });
    expect(records.map((r) => r.title)).toContain(`${URI}#/a`);
    expect(records.some((r) => r[TORN_FIELD] !== undefined)).toBe(false);
    expect(decide(SOUND).kind).toBe("ingest");
  });
});
