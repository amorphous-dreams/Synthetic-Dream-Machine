/**
 * introduction.test — a guest introduces, an operator admits, and the answer consumes the introduction.
 *
 * A pure act with no caller proves itself by vectors alone. Proven here:
 *   · an introduction stands only as its guest signed it: each field tampered in turn refuses by name, and a
 *     signature by any key but the named introducer refuses;
 *   · it stands only in the hearth's Nexus and at one of its live hosting epochs;
 *   · a small-order introducer key, which signs for anyone under a lenient verify, refuses;
 *   · THE CONSUMPTION: an answer rides sealed to the newcomer's key. Opened, it holds no nonce, no key and no
 *     signature of the introduction; sealed, it shares no byte with it and reads the same length whether it
 *     admits or declines; two guests' answers for one newcomer open alike;
 *   · the friend who holds the secret opens the answer, and nobody else does;
 *   · a guard never throws at a hostile object;
 *   · the open-introductions dial reads a count per proven key and no clock;
 *   · a decline mints nothing, an admit mints once, and the minted token verifies at the hearth's epoch;
 *   · an introduction's signature verifies as no hosting act;
 *   · the module stays out of the package barrel and reads no clock.
 */
import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { ed25519 as ed25519Curve } from "@noble/curves/ed25519.js";
import { canonicalJsonBytes, hex, hexToBytes } from "../src/crypto.js";
import { HOSTING_ACT_DOMAIN, HOSTING_INTRODUCTION_DOMAIN } from "../src/domains.js";
import { sealToRecipient } from "../src/sealed-box.js";
import { hostingActBytes, mintHostingAct, mintHostToken, tokenVerifiesAt, type InviteToken } from "../src/hosting.js";
import {
  IntroductionError, answerIntroduction, introductionBytes, isAnswer, isIntroduction, isSealedAnswer,
  newcomerKeyOf, openAnswer, openSlots, signIntroduction, verifyIntroduction,
  type Answer, type Introduction, type IntroductionFields,
} from "../src/introduction.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const pubOf = (s: Uint8Array): Promise<string> => ed.getPublicKeyAsync(s).then(hex);
const signerOf = (s: Uint8Array) => (bytes: Uint8Array): Promise<string> => ed.signAsync(bytes, s).then(hex);

const NEXUS = `nexus-${"a1".repeat(32)}`;
const HEARTH = seed(40), GUEST = seed(1), OTHER_GUEST = seed(2), STRANGER = seed(3);
const FRIEND_SECRET = seed(9), OTHER_SECRET = seed(10);
const STUB_TOKEN: InviteToken = { purpose: "host-invite", n: "1".repeat(64), y: "2".repeat(128) };

/** A hearth with two live hosting epochs, and one guest's introduction of one friend at the current epoch. */
async function standing(guest: Uint8Array = GUEST, secret: Uint8Array = FRIEND_SECRET) {
  const previous = await mintHostingAct({ leafSeed: HEARTH, nexusAid: NEXUS, prev: null, cap: 3 });
  const current = await mintHostingAct({ leafSeed: HEARTH, nexusAid: NEXUS, prev: previous.cid, cap: 3 });
  const live = { nexus: NEXUS, epochs: [current.cid, previous.cid] };
  const fields: IntroductionFields = {
    nexus: NEXUS, epoch: current.cid, newcomerKey: newcomerKeyOf(secret), introducer: await pubOf(guest),
  };
  const signed = await signIntroduction(fields, signerOf(guest));
  const verdict = verifyIntroduction(signed, live);
  if (!verdict.ok) throw new Error(`the standing introduction refused: ${verdict.refusal}`);
  // `intro` is the VERIFIED copy: the only thing an operator may answer. `signed` is what came over the wire.
  return { previous, current, live, fields, intro: verdict.introduction, signed };
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
    expect(verifyIntroduction(intro, live).ok).toBe(true);                       // CONTROL
    const refusalOf = (v: unknown) => verifyIntroduction(v, live);
    expect(refusalOf({ ...intro, nexus: `nexus-${"b2".repeat(32)}` })).toEqual({ ok: false, refusal: "introduction-nexus-foreign" });
    expect(refusalOf({ ...intro, epoch: flip(intro.epoch) })).toEqual({ ok: false, refusal: "introduction-epoch-dead" });
    // A LIVE epoch other than the one signed still breaks the signature: the epoch sits under it.
    expect(refusalOf({ ...intro, epoch: previous.cid })).toEqual({ ok: false, refusal: "introduction-unsigned" });
    expect(refusalOf({ ...intro, newcomerKey: flip(intro.newcomerKey) })).toEqual({ ok: false, refusal: "introduction-unsigned" });
    expect(refusalOf({ ...intro, introducer: await pubOf(OTHER_GUEST) })).toEqual({ ok: false, refusal: "introduction-unsigned" });
    expect(refusalOf({ ...intro, signature: flip(intro.signature) })).toEqual({ ok: false, refusal: "introduction-unsigned" });
    for (const malformed of [
      { ...intro, kind: HOSTING_ACT_DOMAIN }, { ...intro, extra: "x" }, { ...intro, signature: intro.signature.slice(2) },
      { ...intro, introducer: intro.introducer.toUpperCase() }, { ...intro, newcomerKey: 7 }, { ...intro, nexus: "" },
      (({ signature: _s, ...rest }) => rest)(intro), null, "an introduction", [intro],
    ]) expect(refusalOf(malformed)).toEqual({ ok: false, refusal: "introduction-malformed" });
  });

  test("★ a signature by any key but the named introducer refuses ★", async () => {
    const { fields, intro, live } = await standing();
    const forged = await signIntroduction(fields, signerOf(STRANGER));       // names GUEST, signed by STRANGER
    expect(forged.introducer).toBe(await pubOf(GUEST));
    expect(verifyIntroduction(forged, live)).toEqual({ ok: false, refusal: "introduction-unsigned" });
    expect(verifyIntroduction(intro, live).ok).toBe(true);           // CONTROL
  });

  test("★ a small-order introducer key signs for nobody ★", async () => {
    const { fields, live } = await standing();
    // The identity point as a key, the identity as R and zero as S: an equation a cofactored verify reads true
    // for EVERY message, so "signed by the named introducer" would mean nothing.
    const identity = `01${"00".repeat(31)}`;
    const forged = {
      kind: HOSTING_INTRODUCTION_DOMAIN, ...fields, introducer: identity, signature: `${identity}${"00".repeat(32)}`,
    };
    expect(isIntroduction(forged)).toBe(true);                               // well-formed by shape alone
    expect(verifyIntroduction(forged, live)).toEqual({ ok: false, refusal: "introduction-unsigned" });
    const eightTorsion = "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a";   // a point of order 8
    expect(verifyIntroduction({ ...forged, introducer: eightTorsion }, live)).toEqual({ ok: false, refusal: "introduction-unsigned" });
    // KNOWN POSITIVE: the lenient equation does read this forgery as signed, so the vector bites.
    expect(ed25519Curve.verify(hexToBytes(forged.signature), introductionBytes({ ...fields, introducer: identity }), hexToBytes(identity), { zip215: true })).toBe(true);
  });

  test("★ a value that answers differently at each read signs for nobody ★", async () => {
    const { fields, live } = await standing();
    // The attacker signs bytes that NAME the guest, under its own key, then hands over an object whose
    // `introducer` reads as the guest's key for the signed bytes and as the attacker's key for the verify.
    const guestKey = await pubOf(GUEST), attackerKey = await pubOf(STRANGER);
    const signature = await signerOf(STRANGER)(introductionBytes({ ...fields, introducer: guestKey }));
    for (const attackerOn of [[2], [3], [2, 3], [1, 3], [3, 4]]) {
      let reads = 0;
      const shifting = {
        kind: HOSTING_INTRODUCTION_DOMAIN, nexus: fields.nexus, epoch: fields.epoch, newcomerKey: fields.newcomerKey,
        get introducer(): string { reads++; return attackerOn.includes(reads) ? attackerKey : guestKey; },
        signature,
      };
      const verdict = verifyIntroduction(shifting, live);
      expect(verdict.ok).toBe(false);
      expect(reads).toBe(1);                                                 // read once, then never again
    }
    // What a lawful verdict hands back is a frozen copy: the caller answers THAT, never the value it was handed.
    const { intro } = await standing();
    const verdict = verifyIntroduction(intro, live);
    if (!verdict.ok) throw new Error("the control introduction refused");
    expect(verdict.introduction).toEqual(intro);
    expect(verdict.introduction).not.toBe(intro);
    expect(Object.isFrozen(verdict.introduction)).toBe(true);
    // ★ ONLY a verified copy gets answered. The value that was handed in, a look-alike with every byte equal, and
    // a shifting object that verified a moment ago all refuse: nothing re-reads a value after its signature read. ★
    const wire = await signIntroduction(fields, signerOf(GUEST));
    expect(verifyIntroduction(wire, live).ok).toBe(true);
    expect(() => answerIntroduction(wire, true)).toThrow("introduction-unverified");
    expect(() => answerIntroduction({ ...verdict.introduction }, true)).toThrow("introduction-unverified");
    const attackerBox = newcomerKeyOf(seed(77));
    let keyReads = 0;
    const swapping = { ...wire, get newcomerKey(): string { keyReads++; return keyReads === 1 ? wire.newcomerKey : attackerBox; } };
    const swapVerdict = verifyIntroduction(swapping, live);
    expect(swapVerdict.ok).toBe(true);                                       // it verifies: the first read is the signed key
    expect(() => answerIntroduction(swapping as Introduction, true)).toThrow("introduction-unverified");
    if (!swapVerdict.ok) throw new Error("unreachable");
    const sealed = answerIntroduction(swapVerdict.introduction, false);      // CONTROL: the verdict's copy answers,
    expect(openAnswer(sealed, FRIEND_SECRET)).not.toBeNull();                // sealed to the key the guest SIGNED,
    expect(openAnswer(sealed, seed(77))).toBeNull();                         // never to the swapped one.
    // A signer that receives shifting fields signs what it validated, and the act names what it signed.
    let fieldReads = 0;
    const shiftingFields = { ...fields, get introducer(): string { fieldReads++; return fieldReads === 1 ? guestKey : attackerKey; } };
    const signed = await signIntroduction(shiftingFields, signerOf(GUEST));
    expect(fieldReads).toBe(1);
    expect(signed.introducer).toBe(guestKey);
    expect(verifyIntroduction(signed, live).ok).toBe(true);
  });

  test("a guard never throws at a hostile object", async () => {
    const { intro, live } = await standing();
    const thrower = new Proxy({}, { ownKeys() { throw new Error("hostile"); }, get() { throw new Error("hostile"); }, has() { throw new Error("hostile"); } });
    const getter = { ...intro, get signature(): string { throw new Error("hostile"); } };
    for (const hostile of [thrower, getter]) {
      expect(verifyIntroduction(hostile, live)).toEqual({ ok: false, refusal: "introduction-malformed" });
      expect(isIntroduction(hostile)).toBe(false);
      expect(isAnswer(hostile)).toBe(false);
      expect(isSealedAnswer(hostile)).toBe(false);
      expect(openAnswer(hostile as never, FRIEND_SECRET)).toBeNull();
    }
    expect(verifyIntroduction(intro, thrower as never)).toEqual({ ok: false, refusal: "introduction-malformed" });
    expect(verifyIntroduction(intro, live).ok).toBe(true);           // CONTROL
  });

  test("it stands at the current and the previous epoch, and at no other", async () => {
    const { fields, intro, live, previous } = await standing();
    const atPrevious = await signIntroduction({ ...fields, epoch: previous.cid }, signerOf(GUEST));
    expect(verifyIntroduction(atPrevious, live).ok).toBe(true);
    expect(verifyIntroduction(atPrevious, { ...live, epochs: [live.epochs[0]!] })).toEqual({ ok: false, refusal: "introduction-epoch-dead" });
    expect(verifyIntroduction(intro, { ...live, epochs: [] })).toEqual({ ok: false, refusal: "introduction-epoch-dead" });
    // The Nexus reads case-blind and trimmed, as every hosting act reads it.
    expect(verifyIntroduction(intro, { ...live, nexus: `  ${NEXUS.toUpperCase()} ` }).ok).toBe(true);
  });

  test("a guest signs nothing malformed", async () => {
    const { fields } = await standing();
    let asked = 0;
    const sign = (bytes: Uint8Array): Promise<string> => { asked++; return signerOf(GUEST)(bytes); };
    for (const bad of [{ ...fields, epoch: "not-a-cid" }, { ...fields, introducer: "ff" }, { ...fields, newcomerKey: "" }, { ...fields, nexus: " " }]) {
      await expect(signIntroduction(bad, sign)).rejects.toThrow(IntroductionError);
    }
    expect(asked).toBe(0);
    await expect(signIntroduction(fields, async () => "not-a-signature")).rejects.toThrow(IntroductionError);
    expect((await signIntroduction(fields, sign)).kind).toBe(HOSTING_INTRODUCTION_DOMAIN);   // CONTROL
    expect(asked).toBe(1);
  });
});

describe("the answer consumes the introduction", () => {
  /** Open an answer as the friend, or fail the test. */
  const opened = (sealed: unknown, secret: Uint8Array = FRIEND_SECRET): Answer => {
    const answer = openAnswer(sealed as never, secret);
    if (answer === null) throw new Error("the friend's secret opened nothing");
    return answer;
  };

  test("★ an opened answer holds no nonce, no key and no signature of the introduction ★", async () => {
    const { intro } = await standing();
    const admitted = opened(answerIntroduction(intro, true, () => STUB_TOKEN));
    const declined = opened(answerIntroduction(intro, false));
    expect(Object.keys(declined).sort()).toEqual(["admitted", "epoch", "nexus"]);
    expect(Object.keys(admitted).sort()).toEqual(["admitted", "epoch", "nexus", "token"]);
    for (const answer of [admitted, declined]) {
      const bytes = JSON.stringify(answer);
      for (const part of [intro.introducer, intro.signature, intro.newcomerKey]) expect(holdsAnyRunOf(bytes, part)).toBe(false);
      expect(isAnswer(answer)).toBe(true);
      expect(answer.nexus).toBe(NEXUS);
      expect(answer.epoch).toBe(intro.epoch);
    }
    // KNOWN POSITIVE: the same probe finds all three in the introduction itself.
    for (const part of [intro.introducer, intro.signature, intro.newcomerKey]) expect(holdsAnyRunOf(JSON.stringify(intro), part)).toBe(true);
    for (const extra of [{ introducer: intro.introducer }, { signature: intro.signature }, { newcomerKey: intro.newcomerKey }]) {
      expect(isAnswer({ ...declined, ...extra })).toBe(false);
    }
    expect(isAnswer({ ...declined, token: STUB_TOKEN })).toBe(false);          // a decline carries no token
  });

  test("★ a sealed answer shares no byte with its introduction, and reads one length either way ★", async () => {
    const { intro } = await standing();
    const admitted = answerIntroduction(intro, true, () => STUB_TOKEN);
    const declined = answerIntroduction(intro, false);
    const again = answerIntroduction(intro, false);
    for (const sealed of [admitted, declined]) {
      expect(isSealedAnswer(sealed)).toBe(true);
      expect(Object.keys(sealed).sort()).toEqual(["ciphertext", "nonce", "sender"]);
      const bytes = JSON.stringify(sealed);
      // 8-character runs: a link by a short copy would show as surely as a whole one.
      for (const part of [intro.introducer, intro.signature, intro.newcomerKey, intro.epoch]) {
        for (let i = 0; i + 8 <= part.length; i += 8) expect(bytes.includes(part.slice(i, i + 8))).toBe(false);
      }
    }
    // An admit and a decline weigh the same, so a reader of the sealed bytes learns neither.
    expect(admitted.ciphertext.length).toBe(declined.ciphertext.length);
    // Two seals of one answer share no sender key, nonce or ciphertext: nothing indexes a sealed answer by its newcomer.
    expect(again.sender).not.toBe(declined.sender);
    expect(again.nonce).not.toBe(declined.nonce);
    expect(again.ciphertext).not.toBe(declined.ciphertext);
    expect(opened(again)).toEqual(opened(declined));                            // CONTROL: one answer inside
  });

  test("★ only the exact bytes the answer's own encoder writes open as an answer ★", async () => {
    const { intro, current } = await standing();
    const info = canonicalJsonBytes({ kind: HOSTING_INTRODUCTION_DOMAIN, part: "answer" });
    const sealBody = (body: string, width = 512) => {
      const plaintext = new Uint8Array(width).fill(0x20);
      plaintext.set(new TextEncoder().encode(body), 0);
      const box = sealToRecipient({ recipientPub: hexToBytes(intro.newcomerKey), plaintext, info });
      return { sender: hex(box.senderEphemeralPub), nonce: hex(box.aeadNonce), ciphertext: hex(box.ciphertext) };
    };
    const n = "1".repeat(64), y = "2".repeat(128);
    const lawful = `{"admitted":true,"epoch":"${current.cid}","nexus":"${NEXUS}","token":{"n":"${n}","purpose":"host-invite","y":"${y}"}}`;
    // CONTROL: the canonical body, sealed by hand under the same name, opens.
    expect(openAnswer(sealBody(lawful), FRIEND_SECRET)).toEqual({ admitted: true, epoch: current.cid, nexus: NEXUS, token: STUB_TOKEN });
    const crafted = [
      lawful.replace(`"y":"${y}"`, `"y":"${y}","note":"extra meaning"`),                 // a token with one more key
      `{"nexus":"${NEXUS}","admitted":true,"epoch":"${current.cid}"}`,                   // the keys in another order
      `{"admitted":false,"admitted":true,"epoch":"${current.cid}","nexus":"${NEXUS}"}`,  // a key spelled twice
      ` {"admitted":true,"epoch":"${current.cid}","nexus":"${NEXUS}"}`,                  // a body that starts late
      `{"admitted":true, "epoch":"${current.cid}","nexus":"${NEXUS}"}`,                  // inner whitespace
      `{"admitted":true,"epoch":"${current.cid}","nexus":"${NEXUS.toUpperCase()}"}`,     // a Nexus in another case
    ];
    for (const body of crafted) expect(openAnswer(sealBody(body), FRIEND_SECRET)).toBeNull();
    expect(new TextEncoder().encode(lawful).length).toBeLessThan(512);                    // the widest lawful answer fits
    expect(openAnswer(sealBody(lawful, 600), FRIEND_SECRET)).toBeNull();                  // another width
    expect(openAnswer(sealBody(`{"admitted":true,"epoch":"${current.cid}","nexus":"${NEXUS}"}`), FRIEND_SECRET)).toEqual({ admitted: true, epoch: current.cid, nexus: NEXUS });
  });

  test("★ two guests' answers for one newcomer open alike ★", async () => {
    const a = await standing(GUEST), b = await standing(OTHER_GUEST);
    expect(a.intro.introducer).not.toBe(b.intro.introducer);                   // CONTROL: two guests
    expect(a.intro.signature).not.toBe(b.intro.signature);
    for (const admit of [true, false]) {
      expect(opened(answerIntroduction(a.intro, admit, () => STUB_TOKEN))).toEqual(opened(answerIntroduction(b.intro, admit, () => STUB_TOKEN)));
    }
  });

  test("a decline mints nothing; an admit mints once; the token verifies at the hearth's epoch", async () => {
    const { intro, current } = await standing();
    let calls = 0;
    const mint = (): InviteToken => { calls++; return mintHostToken(current); };
    const declined = opened(answerIntroduction(intro, false, mint));
    expect("token" in declined).toBe(false);
    expect(declined.admitted).toBe(false);
    expect(calls).toBe(0);
    const admitted = opened(answerIntroduction(intro, true, mint));
    expect(calls).toBe(1);
    expect(admitted.admitted).toBe(true);
    expect(admitted.token!.purpose).toBe("host-invite");
    expect(tokenVerifiesAt(current, admitted.token!)).toBe(true);
    expect("token" in opened(answerIntroduction(intro, true))).toBe(false);    // an admit with no mint carries none
    // The token's nonce runs random: nothing of the introduction derives it.
    const again = opened(answerIntroduction(intro, true, mint));
    expect(again.token!.n).not.toBe(admitted.token!.n);
    for (const part of [intro.newcomerKey, intro.introducer, intro.signature]) expect(holdsAnyRunOf(JSON.stringify(admitted.token), part)).toBe(false);
  });

  test("only a well-formed introduction gets answered", async () => {
    const { intro } = await standing();
    expect(() => answerIntroduction({ ...intro, extra: "x" } as Introduction, true)).toThrow(IntroductionError);
    expect(() => answerIntroduction(null as unknown as Introduction, false)).toThrow(IntroductionError);
    expect(() => answerIntroduction(intro, true, () => ({ purpose: "host-invite", n: "short", y: "short" }))).toThrow("answer-token-malformed");
    // A minted token gets read ONCE: a token that reads lawful first and otherwise after never rides an answer.
    let tokenReads = 0;
    const shiftingToken = { purpose: "host-invite" as const, y: STUB_TOKEN.y, get n(): string { tokenReads++; return tokenReads === 1 ? STUB_TOKEN.n : "f".repeat(64); } };
    const withShifting = openAnswer(answerIntroduction(intro, true, () => shiftingToken), FRIEND_SECRET);
    expect(tokenReads).toBe(1);
    expect(withShifting?.token).toEqual(STUB_TOKEN);
    // A key nobody holds: an all-zero newcomer key refuses at the signing, and a hand-built copy at the reading
    // (`ed25519-door-families.test.ts` walks all seven low-order points).
    const { fields } = await standing();
    await expect(signIntroduction({ ...fields, newcomerKey: "00".repeat(32) }, signerOf(GUEST))).rejects.toThrow("introduction-newcomer-key-refused");
    expect(opened(answerIntroduction(intro, false)).admitted).toBe(false);     // CONTROL
  });

  test("★ the friend who holds the secret opens the answer, and nobody else does ★", async () => {
    const { intro } = await standing();
    const sealed = answerIntroduction(intro, true, () => STUB_TOKEN);
    expect(opened(sealed).admitted).toBe(true);
    expect(openAnswer(sealed, OTHER_SECRET)).toBeNull();
    expect(openAnswer(sealed, FRIEND_SECRET.slice(0, 31))).toBeNull();
    // The guest holds the introduction and every public value in it, and still opens nothing.
    expect(openAnswer(sealed, hexToBytes(intro.newcomerKey))).toBeNull();
    expect(openAnswer(sealed, GUEST)).toBeNull();
    for (const field of ["sender", "nonce", "ciphertext"] as const) {
      expect(openAnswer({ ...sealed, [field]: flip(sealed[field]) }, FRIEND_SECRET)).toBeNull();
    }
    expect(openAnswer({ ...sealed, extra: "x" } as never, FRIEND_SECRET)).toBeNull();
    expect(() => newcomerKeyOf(new Uint8Array(31))).toThrow(IntroductionError);
    expect(newcomerKeyOf(FRIEND_SECRET)).toMatch(/^[0-9a-f]{64}$/);
    expect(newcomerKeyOf(FRIEND_SECRET)).not.toBe(newcomerKeyOf(OTHER_SECRET));
    // The key commits to the secret and never spells it.
    expect(holdsAnyRunOf(JSON.stringify(intro), hex(FRIEND_SECRET))).toBe(false);
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
    // A damaged entry still holds its guest's slot: damage never frees one.
    const damaged = { ...g, signature: "torn" } as Introduction;
    expect(openSlots([damaged], G, 1)).toBe(0);
    expect(openSlots([null as never, "junk" as never, damaged], H, 1)).toBe(1);
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
