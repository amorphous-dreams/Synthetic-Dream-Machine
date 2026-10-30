/**
 * L16 · identity rides verified bytes — a signature or receipt verifies exactly the bytes it asserts
 * (any one-byte change refuses); an encode/decode pair round-trips verbatim and decodes malformed input
 * to null rather than forging; one artifact keeps one identity across every ingress path; a stamp
 * attests only a bounded, complete span.
 *
 * Census seeds ride as `examples`: promotion-receipt, ed25519-door-cli, handle-carriage, capture-source,
 * normalize-restamps (the stamp function, in-process; no founding, no binary). Synthetic keys only.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test as plain } from "vitest";
import { fc, test } from "@fast-check/vitest";
import * as ed from "@noble/ed25519";
import { base64UrlEncode, hex, utf8Bytes, verifyEd25519, HANDLE_CARD_DOMAIN, type HandleCard } from "@lararium/mesh";
import { stampCarrier, verifyBcc, checkSpan } from "@lararium/memetic-frame";
import { mintPromotionReceipt, verifyPromotionReceipt, type PromotionReceipt } from "../../src/promotion-receipt.js";
import { parseHandleCardCarriage, toHandleCardCarriage } from "../../src/handle-carriage.js";
import { captureSourceFile } from "../../src/commands/capture/harvest.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const SEED = seedOf(0xa1);
const STRANGER = seedOf(0xb2);
const pubOf = async (s: Uint8Array): Promise<string> => hex(await ed.getPublicKeyAsync(s));

// ── generators ──────────────────────────────────────────────────────────────
const bytes = fc.uint8Array({ minLength: 1, maxLength: 96 });
const word = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,15}$/);
const lar = word.map((w) => `lar:///ha.ka.ba/bags/${w}`);
const niHash = fc.stringMatching(/^[A-Za-z0-9_-]{43}$/).map((h) => `ni:///sha-256;${h}`);

// ── 1 · a signature verifies exactly the bytes it asserts ───────────────────
describe("L16 · sign → verify holds; one changed byte refuses", () => {
  test.prop([bytes], { examples: [[Uint8Array.of(0)], [new TextEncoder().encode("lar:///ha.ka.ba/bags/lares")]] })(
    "sign then verify holds for any payload",
    async (msg) => {
      const sig = hex(await ed.signAsync(msg, SEED));
      expect(await verifyEd25519(sig, msg, await pubOf(SEED))).toBe(true);
    });

  test.prop([bytes, fc.nat(), fc.integer({ min: 1, max: 255 })])(
    "flipping any one payload byte refuses",
    async (msg, at, xor) => {
      const sig = hex(await ed.signAsync(msg, SEED));
      const bent = Uint8Array.from(msg); bent[at % bent.length]! ^= xor;
      expect(await verifyEd25519(sig, bent, await pubOf(SEED))).toBe(false);
    });

  test.prop([bytes, fc.nat(), fc.integer({ min: 1, max: 15 })])(
    "flipping any one signature digit refuses; a foreign key refuses",
    async (msg, at, d) => {
      const sig = hex(await ed.signAsync(msg, SEED));
      const i = at % sig.length;
      const bentSig = sig.slice(0, i) + ((parseInt(sig[i]!, 16) ^ d).toString(16)) + sig.slice(i + 1);
      expect(await verifyEd25519(bentSig, msg, await pubOf(SEED))).toBe(false);
      expect(await verifyEd25519(sig, msg, await pubOf(STRANGER))).toBe(false);
    });
});

// ── 2 · a promotion receipt verifies exactly its asserted bytes ─────────────
const FIELDS = ["subjectUri", "carrierHash", "fromBag", "toBag", "proposerNym", "approverNym"] as const;
async function mint(subjectUri: string, carrierHash: string, fromBag: string, toBag: string, proposerNym: string): Promise<PromotionReceipt> {
  const did = await pubOf(SEED);
  const r = await mintPromotionReceipt({
    subjectUri, carrierHash, fromBag, toBag, proposerNym, approverNym: did, approverKeyDid: did,
    subject: { tags: ["lifecycle/standing"] },
    holdsAdmin: (n, b) => n === did && b === toBag,
    sign: async (b) => hex(await ed.signAsync(b, SEED)),
  });
  if (!r.ok) throw new Error(r.reason);
  return r.receipt;
}
const crossing = fc.tuple(lar, niHash, word, word, word).filter(([, , f, t]) => f !== t)
  .map(([s, h, f, t, p]) => [s, h, `lar:///ha.ka.ba/bags/${f}`, `lar:///ha.ka.ba/bags/${t}`, p] as const);

describe("L16 · a promotion receipt verifies exactly its assertion", () => {
  const seed = [["lar:///ha.ka.ba/lares/docs/pono/t-witness-promote", "ni:///sha-256;s9wMX2yprC8TPIZRdXj0IdPXjLCmt9WM-qYIq-7UQSo", "lar:///ha.ka.ba/bags/working", "lar:///ha.ka.ba/bags/lares", "proposer-nym"]] as const;
  test.prop([crossing], { examples: [[seed[0]]] })("a minted receipt verifies; moving the attached region leaves it valid", async (c) => {
    const r = await mint(...c);
    expect(await verifyPromotionReceipt(r)).toBe(true);
    expect(await verifyPromotionReceipt({ ...r, attached: { readAt: "2099", note: "refreshed" } })).toBe(true);
  });

  test.prop([crossing, fc.constantFrom(...FIELDS), fc.stringMatching(/^[a-z0-9]{1,6}$/)], { examples: [[seed[0], "toBag", "moved"]] })(
    "moving any asserted field refuses",
    async (c, field, suffix) => {
      const r = await mint(...c);
      const tampered = { ...r, assertion: { ...r.assertion, [field]: `${r.assertion[field]}${suffix}` } };
      expect(await verifyPromotionReceipt(tampered)).toBe(false);
    });

  test.prop([crossing, fc.nat(), fc.integer({ min: 1, max: 15 })])("flipping any one sig digit refuses", async (c, at, d) => {
    const r = await mint(...c);
    const i = at % r.sig.length;
    const sig = r.sig.slice(0, i) + (parseInt(r.sig[i]!, 16) ^ d).toString(16) + r.sig.slice(i + 1);
    expect(await verifyPromotionReceipt({ ...r, sig })).toBe(false);
  });

  test.prop([crossing])("a foreign key's signature over the asserted bytes refuses", async (c) => {
    const r = await mint(...c);
    const { promotionAssertionBytes } = await import("../../src/promotion-receipt.js");
    const forged = { ...r, sig: hex(await ed.signAsync(promotionAssertionBytes(r.assertion), STRANGER)) };
    expect(await verifyPromotionReceipt(forged)).toBe(false);
  });
});

// ── 3 · encode/decode round-trips verbatim; garbage decodes to null ─────────
const json: fc.Arbitrary<unknown> = fc.jsonValue({ maxDepth: 2 });
const card = fc.record({
  kind: fc.constant(HANDLE_CARD_DOMAIN), nym: word, sig: fc.stringMatching(/^[0-9a-f]{8,64}$/),
  actCid: fc.stringMatching(/^[0-9a-f]{64}$/), parents: fc.array(word, { maxLength: 3 }),
  chain: fc.array(fc.dictionary(word, fc.oneof(word, fc.integer()), { maxKeys: 3 }), { minLength: 1, maxLength: 4 }),
  glamour: fc.string({ maxLength: 12 }),
}).map((c) => c as unknown as HandleCard);
const toToken = (v: unknown): string => base64UrlEncode(utf8Bytes(JSON.stringify(v)));

describe("L16 · the card carriage round-trips verbatim and withholds rather than forges", () => {
  const SEEDCARD = { kind: HANDLE_CARD_DOMAIN, nym: "n", sig: "ab", actCid: "c".repeat(64).replace(/c/g, "a"), parents: [], chain: [{ a: 1 }], glamour: "Eris" } as unknown as HandleCard;
  test.prop([card], { examples: [[SEEDCARD]] })("parse(encode(card)) returns the card, in fragment, bare, and wrapped forms", (c) => {
    const carriage = toHandleCardCarriage(c);
    expect(parseHandleCardCarriage(carriage)).toEqual(c);
    expect(parseHandleCardCarriage(carriage.slice("#card=".length))).toEqual(c);
    expect(parseHandleCardCarriage(`  ${carriage}\n`)).toEqual(c);
  });

  test.prop([fc.string({ maxLength: 80 })], { examples: [[""], ["#card=@@@not-base64@@@"], ["#admit=deadbeef"]] })(
    "arbitrary text never throws, and anything it decodes wears the card shape",
    (s) => {
      const got = parseHandleCardCarriage(s);
      if (got !== null) expect((got as { kind: unknown }).kind).toBe(HANDLE_CARD_DOMAIN);
    });

  test.prop([json], { examples: [[null], [[]], [{ kind: "not-a-handle-card" }]] })("a well-formed token over a non-card value decodes to null", (v) => {
    expect(parseHandleCardCarriage(`#card=${toToken(v)}`)).toBeNull();
  });

  test.prop([card, fc.constantFrom("kind", "nym", "sig", "actCid", "parents", "chain")])("a card missing a load-bearing field decodes to null", (c, drop) => {
    const { [drop as keyof HandleCard]: _gone, ...rest } = c as unknown as Record<string, unknown>;
    void _gone;
    expect(parseHandleCardCarriage(`#card=${toToken(rest)}`)).toBeNull();
  });
});

// ── 4 · one artifact, one identity across every ingress path ────────────────
const SURFACES: Array<[string, (n: string) => string]> = [
  ["claude", (n) => `/home/op/.claude/projects/p/${n}`],
  ["codex", (n) => `/home/op/.codex/sessions/2026/${n}`],
  ["copilot-vscode", (n) => `/home/op/.config/Code/User/workspaceStorage/x/GitHub.copilot-chat/transcripts/${n}`],
  ["copilot-cli", (n) => `/home/op/.copilot/session-state/${n}`],
];
describe("L16 · a capture source keeps one identity across ingress", () => {
  const fname = fc.stringMatching(/^[a-z0-9][a-z0-9._-]{0,20}$/).map((s) => `${s}.jsonl`);
  test.prop([word.map((w) => `wing_${w}`), fc.constantFrom(...SURFACES), fname, fc.constantFrom("live", "bulk"), word],
    { examples: [["wing_synthetic_dream_machine", SURFACES[0]!, "session-123.jsonl", "live", "hash"], ["wing_a", SURFACES[1]!, "rollout-a.jsonl", "bulk", "h"]] })(
    "direct capture and staged capture converge, and carry the wing and surface once",
    (wing, [surface, direct], name, stage, hash) => {
      const want = `${wing}/${surface}__${name}`;
      expect(captureSourceFile(wing, direct(name))).toBe(want);
      expect(captureSourceFile(wing, `/state/harvest-stage/${stage}/${wing}/${surface}/${hash}/${name}`)).toBe(want);
    });
});

// ── 5 · a stamp attests only a bounded, complete span ───────────────────────
const line = fc.stringMatching(/^[A-Za-z0-9 ,.-]{0,30}$/);
const body = fc.array(line, { minLength: 1, maxLength: 6 }).map((ls) => ls.join("\n"));
const HEAD = '<<^ code="&#x0001;" namespace="⊙" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/t">>\n';
const STX = '<<^ code="&#x0002;">>\n';
const ETX = '<<^ code="&#x0003;">>';
const EOT = '\n\n<<^ code="&#x0004;" -> to="?">>\n';
const framed = (b: string): string => `${HEAD}${STX}${b}\n\n${ETX}${EOT}`;

describe("L16 · a stamp attests a bounded, complete span", () => {
  test.prop([body], { examples: [["hello"], ["a\nb\nc"]] })("stamping a framed carrier mints a check that verifies, and a second stamp changes nothing", (b) => {
    const stamped = stampCarrier(framed(b));
    expect(verifyBcc(stamped)).toBe("ok");
    expect(stampCarrier(stamped)).toBe(stamped);
  });

  test.prop([body, fc.nat(), fc.integer({ min: 1, max: 5 })])("one changed byte inside the span turns the stamp to mismatch", (b, at, shift) => {
    const stamped = stampCarrier(framed(b));
    const span = checkSpan(stamped)!;
    const inner = span.start + STX.length - 1 + 1;   // a byte after the STX sigil, before the ETX sigil
    const i = inner + (at % (span.end - inner - ETX.length));
    const ch = stamped.charCodeAt(i);
    const bent = stamped.slice(0, i) + String.fromCharCode(33 + ((ch - 33 + shift) % 90)) + stamped.slice(i + 1);
    fc.pre(bent !== stamped);
    expect(verifyBcc(bent)).not.toBe("ok");
  });

  test.prop([body], { examples: [["hello"]] })("a torn carrier (no close) gains no stamp; a frameless carrier gains none", (b) => {
    const torn = `${HEAD}${STX}${b}\n`;
    expect(verifyBcc(torn)).toBe("torn");
    expect(stampCarrier(torn)).toBe(torn);
    expect(stampCarrier(b)).toBe(b);
    expect(stampCarrier(b)).not.toMatch(/ni:\/\/\//);
  });
});

// ── CONTROL ─────────────────────────────────────────────────────────────────
describe("L16 · CONTROL — the instruments can fail", () => {
  plain("a verifier that reads only a prefix accepts a last-byte flip that the real door refuses", async () => {
    const msg = new TextEncoder().encode("one asserted record");
    const sig = hex(await ed.signAsync(msg, SEED));
    const bent = Uint8Array.from(msg); bent[bent.length - 1]! ^= 1;
    const prefixOnly = async (m: Uint8Array): Promise<boolean> => (await verifyEd25519(sig, msg, await pubOf(SEED))) && m.slice(0, 5).every((x, i) => x === msg[i]);
    expect(await prefixOnly(bent)).toBe(true);                                        // the weak reader passes the tamper
    expect(await verifyEd25519(sig, bent, await pubOf(SEED))).toBe(false);           // the door refuses it
    expect(await verifyEd25519(sig, msg, await pubOf(SEED))).toBe(true);             // known positive
  });

  plain("a stamped carrier whose body moves reads mismatch; the unmoved one reads ok", () => {
    const s = stampCarrier(framed("alpha"));
    expect(verifyBcc(s)).toBe("ok");
    expect(verifyBcc(s.replace("alpha", "alphb"))).toBe("mismatch");
  });

  plain("a receipt with a moved field fails where the unmoved one passes", async () => {
    const r = await mint("lar:///ha.ka.ba/bags/s", "ni:///sha-256;" + "A".repeat(43), "lar:///ha.ka.ba/bags/a", "lar:///ha.ka.ba/bags/b", "p");
    expect(await verifyPromotionReceipt(r)).toBe(true);
    expect(await verifyPromotionReceipt({ ...r, assertion: { ...r.assertion, toBag: "lar:///ha.ka.ba/bags/c" } })).toBe(false);
  });
});
