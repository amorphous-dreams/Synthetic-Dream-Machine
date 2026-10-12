/**
 * introduction.test — a guest introduces, an operator admits, and the answer consumes the introduction.
 *
 * A pure act with no caller proves itself by vectors alone. Proven here:
 *   · an introduction stands only as its guest signed it: each field tampered in turn refuses by name, and a
 *     signature by any key but the named introducer refuses;
 *   · it stands only in the hearth's Nexus and at one of its live hosting epochs;
 *   · THE CONSUMPTION: an answer holds no byte of the introducer's key or of the signature, two guests'
 *     answers for one newcomer read alike, and an answer's keys stand fixed;
 *   · the friend who holds the nonce's secret owns the answer, and nobody else does;
 *   · the open-introductions dial reads a count per proven key and no clock;
 *   · a decline mints nothing, an admit mints once, and the minted token verifies at the hearth's epoch;
 *   · an introduction's signature verifies as no hosting act;
 *   · the module stays out of the package barrel and reads no clock.
 */
import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { canonicalJsonBytes, hex, hexToBytes } from "../src/crypto.js";
import { HOSTING_ACT_DOMAIN, HOSTING_INTRODUCTION_DOMAIN } from "../src/domains.js";
import { hostingActBytes, mintHostingAct, mintHostToken, tokenVerifiesAt, type InviteToken } from "../src/hosting.js";
import {
  IntroductionError, answerIntroduction, answerIsFor, introductionBytes, isAnswer, isIntroduction,
  newcomerNonceOf, openSlots, signIntroduction, verifyIntroduction,
  type Introduction, type IntroductionFields,
} from "../src/introduction.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const pubOf = (s: Uint8Array): Promise<string> => ed.getPublicKeyAsync(s).then(hex);
const signerOf = (s: Uint8Array) => (bytes: Uint8Array): Promise<string> => ed.signAsync(bytes, s).then(hex);

const NEXUS = `epoch0-${"a1".repeat(32)}`;
const HEARTH = seed(40), GUEST = seed(1), OTHER_GUEST = seed(2), STRANGER = seed(3);
const FRIEND_SECRET = seed(9), OTHER_SECRET = seed(10);
const STUB_TOKEN: InviteToken = { purpose: "host-invite", n: "1".repeat(64), y: "2".repeat(128) };

/** A hearth with two live hosting epochs, and one guest's introduction of one friend at the current epoch. */
async function standing(guest: Uint8Array = GUEST, secret: Uint8Array = FRIEND_SECRET) {
  const previous = await mintHostingAct({ leafSeed: HEARTH, nexusAid: NEXUS, prev: null, cap: 3 });
  const current = await mintHostingAct({ leafSeed: HEARTH, nexusAid: NEXUS, prev: previous.cid, cap: 3 });
  const live = { nexus: NEXUS, epochs: [current.cid, previous.cid] };
  const fields: IntroductionFields = {
    nexus: NEXUS, epoch: current.cid, newcomerNonce: newcomerNonceOf(secret), introducer: await pubOf(guest),
  };
  const intro = await signIntroduction(fields, signerOf(guest));
  return { previous, current, live, fields, intro };
}

/** Does `text` hold `value`, or any 16-character run of it? */
function holdsAnyRunOf(text: string, value: string): boolean {
  for (let i = 0; i + 16 <= value.length; i++) if (text.includes(value.slice(i, i + 16))) return true;
  return text.includes(value);
}
const flip = (h: string): string => (h[0] === "0" ? "1" : "0") + h.slice(1);

describe("an introduction stands only as its guest signed it", () => {
  test("★ each field tampered in turn refuses by name ★", async () => {
    const { intro, live, previous } = await standing();
    expect(isIntroduction(intro)).toBe(true);
    expect(verifyIntroduction(intro, live)).toEqual({ ok: true });                       // CONTROL
    const refusalOf = (v: unknown) => verifyIntroduction(v, live);
    expect(refusalOf({ ...intro, nexus: `epoch0-${"b2".repeat(32)}` })).toEqual({ ok: false, refusal: "introduction-nexus-foreign" });
    expect(refusalOf({ ...intro, epoch: flip(intro.epoch) })).toEqual({ ok: false, refusal: "introduction-epoch-dead" });
    // A LIVE epoch other than the one signed still breaks the signature: the epoch sits under it.
    expect(refusalOf({ ...intro, epoch: previous.cid })).toEqual({ ok: false, refusal: "introduction-unsigned" });
    expect(refusalOf({ ...intro, newcomerNonce: flip(intro.newcomerNonce) })).toEqual({ ok: false, refusal: "introduction-unsigned" });
    expect(refusalOf({ ...intro, introducer: await pubOf(OTHER_GUEST) })).toEqual({ ok: false, refusal: "introduction-unsigned" });
    expect(refusalOf({ ...intro, signature: flip(intro.signature) })).toEqual({ ok: false, refusal: "introduction-unsigned" });
    for (const malformed of [
      { ...intro, kind: HOSTING_ACT_DOMAIN }, { ...intro, extra: "x" }, { ...intro, signature: intro.signature.slice(2) },
      { ...intro, introducer: intro.introducer.toUpperCase() }, { ...intro, newcomerNonce: 7 }, { ...intro, nexus: "" },
      (({ signature: _s, ...rest }) => rest)(intro), null, "an introduction", [intro],
    ]) expect(refusalOf(malformed)).toEqual({ ok: false, refusal: "introduction-malformed" });
  });

  test("★ a signature by any key but the named introducer refuses ★", async () => {
    const { fields, intro, live } = await standing();
    const forged = await signIntroduction(fields, signerOf(STRANGER));       // names GUEST, signed by STRANGER
    expect(forged.introducer).toBe(await pubOf(GUEST));
    expect(verifyIntroduction(forged, live)).toEqual({ ok: false, refusal: "introduction-unsigned" });
    expect(verifyIntroduction(intro, live)).toEqual({ ok: true });           // CONTROL
  });

  test("it stands at the current and the previous epoch, and at no other", async () => {
    const { fields, intro, live, previous } = await standing();
    const atPrevious = await signIntroduction({ ...fields, epoch: previous.cid }, signerOf(GUEST));
    expect(verifyIntroduction(atPrevious, live)).toEqual({ ok: true });
    expect(verifyIntroduction(atPrevious, { ...live, epochs: [live.epochs[0]!] })).toEqual({ ok: false, refusal: "introduction-epoch-dead" });
    expect(verifyIntroduction(intro, { ...live, epochs: [] })).toEqual({ ok: false, refusal: "introduction-epoch-dead" });
    // The Nexus reads case-blind and trimmed, as every hosting act reads it.
    expect(verifyIntroduction(intro, { ...live, nexus: `  ${NEXUS.toUpperCase()} ` })).toEqual({ ok: true });
  });

  test("a guest signs nothing malformed", async () => {
    const { fields } = await standing();
    let asked = 0;
    const sign = (bytes: Uint8Array): Promise<string> => { asked++; return signerOf(GUEST)(bytes); };
    for (const bad of [{ ...fields, epoch: "not-a-cid" }, { ...fields, introducer: "ff" }, { ...fields, newcomerNonce: "" }, { ...fields, nexus: " " }]) {
      await expect(signIntroduction(bad, sign)).rejects.toThrow(IntroductionError);
    }
    expect(asked).toBe(0);
    await expect(signIntroduction(fields, async () => "not-a-signature")).rejects.toThrow(IntroductionError);
    expect((await signIntroduction(fields, sign)).kind).toBe(HOSTING_INTRODUCTION_DOMAIN);   // CONTROL
    expect(asked).toBe(1);
  });
});

describe("the answer consumes the introduction", () => {
  test("★ no answer holds a byte of the introducer's key or of the signature ★", async () => {
    const { intro } = await standing();
    const admitted = answerIntroduction(intro, true, () => STUB_TOKEN);
    const declined = answerIntroduction(intro, false);
    for (const answer of [admitted, declined]) {
      const bytes = JSON.stringify(answer);
      expect(holdsAnyRunOf(bytes, intro.introducer)).toBe(false);
      expect(holdsAnyRunOf(bytes, intro.signature)).toBe(false);
      expect(isAnswer(answer)).toBe(true);
    }
    // KNOWN POSITIVE: the same probe finds both in the introduction itself.
    expect(holdsAnyRunOf(JSON.stringify(intro), intro.introducer)).toBe(true);
    expect(holdsAnyRunOf(JSON.stringify(intro), intro.signature)).toBe(true);
    expect(Object.keys(declined).sort()).toEqual(["admitted", "epoch", "newcomerNonce", "nexus"]);
    expect(Object.keys(admitted).sort()).toEqual(["admitted", "epoch", "newcomerNonce", "nexus", "token"]);
    expect(isAnswer({ ...declined, introducer: intro.introducer })).toBe(false);
    expect(isAnswer({ ...declined, signature: intro.signature })).toBe(false);
    expect(isAnswer({ ...declined, token: STUB_TOKEN })).toBe(false);          // a decline carries no token
  });

  test("★ two guests' answers for one newcomer read alike ★", async () => {
    const a = await standing(GUEST), b = await standing(OTHER_GUEST);
    expect(a.intro.introducer).not.toBe(b.intro.introducer);                   // CONTROL: two guests
    expect(a.intro.signature).not.toBe(b.intro.signature);
    for (const admit of [true, false]) {
      expect(answerIntroduction(a.intro, admit, () => STUB_TOKEN)).toEqual(answerIntroduction(b.intro, admit, () => STUB_TOKEN));
    }
  });

  test("a decline mints nothing; an admit mints once; the token verifies at the hearth's epoch", async () => {
    const { intro, current } = await standing();
    let calls = 0;
    const mint = (): InviteToken => { calls++; return mintHostToken(current); };
    const declined = answerIntroduction(intro, false, mint);
    expect("token" in declined).toBe(false);
    expect(declined.admitted).toBe(false);
    expect(calls).toBe(0);
    const admitted = answerIntroduction(intro, true, mint);
    expect(calls).toBe(1);
    expect(admitted.admitted).toBe(true);
    expect(admitted.token!.purpose).toBe("host-invite");
    expect(tokenVerifiesAt(current, admitted.token!)).toBe(true);
    expect("token" in answerIntroduction(intro, true)).toBe(false);            // an admit with no mint carries none
    // The token's nonce runs random: nothing of the introduction derives it.
    const again = answerIntroduction(intro, true, mint);
    expect(again.token!.n).not.toBe(admitted.token!.n);
    for (const part of [intro.newcomerNonce, intro.introducer, intro.signature]) expect(holdsAnyRunOf(JSON.stringify(admitted.token), part)).toBe(false);
  });

  test("only a well-formed introduction gets answered", async () => {
    const { intro } = await standing();
    expect(() => answerIntroduction({ ...intro, extra: "x" } as Introduction, true)).toThrow(IntroductionError);
    expect(() => answerIntroduction(null as unknown as Introduction, false)).toThrow(IntroductionError);
    expect(() => answerIntroduction(intro, true, () => ({ purpose: "host-invite", n: "short", y: "short" }))).toThrow(IntroductionError);
    expect(answerIntroduction(intro, false).newcomerNonce).toBe(intro.newcomerNonce);   // CONTROL
  });

  test("the friend who holds the secret owns the answer, and nobody else does", async () => {
    const { intro } = await standing();
    const answer = answerIntroduction(intro, true, () => STUB_TOKEN);
    expect(answerIsFor(answer, FRIEND_SECRET)).toBe(true);
    expect(answerIsFor(answer, OTHER_SECRET)).toBe(false);
    expect(answerIsFor(answer, FRIEND_SECRET.slice(0, 31))).toBe(false);
    expect(answerIsFor({ ...answer, introducer: intro.introducer } as never, FRIEND_SECRET)).toBe(false);
    expect(() => newcomerNonceOf(new Uint8Array(31))).toThrow(IntroductionError);
    expect(newcomerNonceOf(FRIEND_SECRET)).toMatch(/^[0-9a-f]{64}$/);
    // The nonce commits to the secret and never spells it.
    expect(holdsAnyRunOf(JSON.stringify(intro), hex(FRIEND_SECRET))).toBe(false);
    expect(newcomerNonceOf(FRIEND_SECRET)).not.toBe(newcomerNonceOf(OTHER_SECRET));
  });
});

describe("the open-introductions dial reads a count per proven key", () => {
  test("★ a guest at its dial holds no further slot; another guest still does ★", async () => {
    const g = (await standing(GUEST)).intro, g2 = (await standing(GUEST, OTHER_SECRET)).intro;
    const h = (await standing(OTHER_GUEST)).intro;
    const G = await pubOf(GUEST), H = await pubOf(OTHER_GUEST), S = await pubOf(STRANGER);
    expect(openSlots([g], G, 1)).toBe(0);
    expect(openSlots([g], H, 1)).toBe(1);
    expect(openSlots([g, g2, h], G, 3)).toBe(1);
    expect(openSlots([g, g2, h], H, 3)).toBe(2);
    expect(openSlots([g, g2, h], S, 3)).toBe(3);
    expect(openSlots([g, g2], G, 1)).toBe(0);                                  // never below zero
    expect(openSlots([g], G.toUpperCase(), 1)).toBe(0);                        // one key, however spelled
    for (const who of [G, H, S]) expect(openSlots([g], who, 0)).toBe(0);       // CONTROL: a closed dial
    for (const dial of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(openSlots([], H, dial)).toBe(0);
    expect(openSlots([], H, 2)).toBe(2);
  });
});

describe("an introduction verifies as nothing else", () => {
  test("its signature fails over a hosting act's bytes, and its two labelled parts differ", async () => {
    const { fields, intro, current } = await standing();
    const key = hexToBytes(intro.introducer), sig = hexToBytes(intro.signature);
    expect(await ed.verifyAsync(sig, introductionBytes(fields), key)).toBe(true);                    // CONTROL
    const { sig: _sig, ...act } = current.act;
    expect(await ed.verifyAsync(sig, hostingActBytes({ ...act, hearthLeaf: intro.introducer }), key)).toBe(false);
    const asNewcomerPart = canonicalJsonBytes({ kind: HOSTING_INTRODUCTION_DOMAIN, part: "newcomer", ...fields });
    expect(hex(introductionBytes(fields))).not.toBe(hex(asNewcomerPart));
    expect(await ed.verifyAsync(sig, asNewcomerPart, key)).toBe(false);
    expect(new TextDecoder().decode(introductionBytes(fields))).toContain(HOSTING_INTRODUCTION_DOMAIN);
  });
});

describe("the module stays out of the barrel and reads no clock", () => {
  test("the barrel names it nowhere; its source names no clock and no timer", () => {
    const barrel = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(barrel).not.toContain("./introduction.js");
    expect(barrel).toContain("./hosting.js");                                  // KNOWN POSITIVE
    const source = readFileSync(new URL("../src/introduction.ts", import.meta.url), "utf8");
    for (const clock of [/\bDate\b/, /performance\./, /setTimeout|setInterval/]) expect(clock.test(source)).toBe(false);
    expect(/\bDate\b/.test(readFileSync(new URL("../src/tiddler-store.ts", import.meta.url), "utf8"))).toBe(true);   // KNOWN POSITIVE
  });
});
